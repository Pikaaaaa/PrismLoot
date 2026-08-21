import { getCase } from "@/data/cases";
import { getCatalogItem } from "@/lib/itemCatalog";
import { looksLikeTradeUrl, normalizeTradeUrl } from "@/lib/auth/account";
import {
  cryptoFromUsd,
  demoDepositAddress,
  getDepositCoin,
  getDepositNetwork,
  isDepositAsset,
  type DepositAsset,
} from "@/lib/deposits/catalog";
import { isLiveUsdtTrc20Enabled, liveUsdtTrc20Address, uniqueUsdtSendAmount } from "@/lib/deposits/live";
import { amountsMatch, listRecentUsdtDeposits } from "@/lib/deposits/tron";
import { isCaseCouponSchemaError } from "@/lib/case-coupons/ensure";
import { consumeFreeCaseClaims, listUserFreeCaseClaims } from "@/lib/case-coupons/store";
import type { FreeCaseClaimSummary } from "@/lib/case-coupons/types";
import { depositDelegate, ensurePrisma, giftCardDelegate, prisma, usd, withdrawalDelegate } from "@/lib/db";
import { generateGiftCode, isGiftCodeFormat, normalizeGiftCode } from "@/lib/gift-cards/codes";
import { clampWagerMultiplier } from "@/lib/gift-cards/wager";
import { resolvePromoCode } from "@/lib/promos/rotating";
import { loadPlayerActivity } from "@/lib/persist/activity";
import { isPrismaFkError } from "@/lib/persist/errors";
import { ensureInventoryHistorySchema } from "@/lib/persist/inventory-schema";
import { marketValueUsd } from "@/lib/economy";
import { getSkinPrice } from "@/lib/services/prices";
import type { InventoryItem, InventoryLeftVia, Skin, Wear } from "@/lib/types";
import type { BestDrop as DbBestDrop, Prisma } from "@prisma/client";

export type PersistSource = "CASE" | "UPGRADE" | "CONTRACT" | "ADMIN" | "PROMO";

type Tx = Prisma.TransactionClient;
type CatalogDb = Pick<Tx, "skin" | "case">;

function prismaErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("code" in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function rethrowPlayPersist(context: Record<string, unknown>, err: unknown): never {
  const message = err instanceof Error ? err.message : "";
  const expected =
    message === "USER_NOT_FOUND" ||
    message === "USER_BANNED" ||
    message === "INSUFFICIENT_BALANCE" ||
    message === "ITEMS_UNAVAILABLE" ||
    message === "AUTH_REQUIRED" ||
    message === "CASE_NOT_FOUND";
  if (!expected) {
    console.error("[play] persist failed", {
      ...context,
      prismaCode: prismaErrorCode(err),
      err,
    });
  }
  if (isPrismaFkError(err)) throw new Error("CATALOG_MISSING");
  throw err;
}

function skinRowFromCatalog(skin: Skin) {
  return {
    id: skin.id,
    weapon: skin.weapon,
    name: skin.name,
    rarity: skin.rarity,
    wear: skin.wear,
    image: skin.image ?? null,
    collection: skin.collection ?? null,
    priceUsd: usd(skin.price),
    enabled: true,
    colors: JSON.stringify(skin.colors ?? []),
    availableWears: JSON.stringify(skin.availableWears ?? []),
  };
}

/** Insert missing Skin rows. Never overwrite admin priceUsd/enabled. */
export async function ensurePlaySkins(tx: CatalogDb, skinIds: Iterable<string>) {
  const unique = [...new Set([...skinIds].filter(Boolean))];
  for (const id of unique) {
    const catalog = getCatalogItem(id);
    if (!catalog) throw new Error("CATALOG_SKIN_MISSING");
    await tx.skin.upsert({
      where: { id },
      create: skinRowFromCatalog(catalog),
      update: {},
    });
  }
}

/**
 * Vercel builds do not seed. Empty Neon Case/Skin tables fail CaseOpen/InventoryItem FKs.
 * Lazy-upsert the opened crate + dropped skins; leave existing admin fields alone.
 */
export async function ensurePlayCatalog(
  tx: CatalogDb,
  input: { caseId: string; items: Array<{ id: string }> },
) {
  const crate = getCase(input.caseId);
  if (!crate) throw new Error("CASE_NOT_FOUND");
  await tx.case.upsert({
    where: { id: input.caseId },
    create: {
      id: input.caseId,
      name: crate.name,
      description: crate.description,
      priceUsd: usd(crate.price),
      enabled: true,
      rtp: crate.rtp,
      houseEdge: crate.houseEdge,
      rtpPreset: crate.rtpPreset,
      section: crate.section,
      tags: JSON.stringify(crate.tags),
      accent: crate.accent,
      accent2: crate.accent2,
      blurb: crate.blurb,
      image: crate.image ?? null,
      thumbnail: crate.thumbnail ?? null,
      animationType: crate.animationType,
      featuredReward: crate.featuredReward,
      popularity: crate.popularity,
    },
    update: {},
  });
  await ensurePlaySkins(tx, input.items.map((item) => item.id));
}

function itemPriceUsd(item: InventoryItem) {
  const market = marketValueUsd(item.id, item.wear, item.stickers, item.price);
  return usd(market ?? item.price);
}

export function serializeBestDrop(row: DbBestDrop & { item?: { soldAt: Date | null } | null }) {
  return {
    skinId: row.skinId,
    wear: row.wear,
    instanceId: row.inventoryItemId,
    snapshot: {
      name: row.name,
      image: row.image ?? undefined,
      rarity: row.rarity,
      weapon: row.weapon,
    },
    valueUsd: row.priceUsd,
    obtainedAt: row.obtainedAt.getTime(),
    sold: Boolean(row.item?.soldAt),
  };
}

function parseLeftVia(value: unknown): InventoryLeftVia | null {
  if (value === "sell" || value === "upgrade" || value === "contract" || value === "withdraw") return value;
  return null;
}

function parseIdList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function inferLeftVia(
  row: { id: string; soldAt?: Date | null; salePriceUsd?: number | null; leftVia?: string | null },
  ctx: { pending: Set<string>; withdrawn: Set<string>; upgradeIds: Set<string>; contractIds: Set<string> },
): InventoryLeftVia | null {
  const stamped = parseLeftVia(row.leftVia);
  if (stamped) return stamped;
  if (ctx.pending.has(row.id) || ctx.withdrawn.has(row.id)) return "withdraw";
  if (!row.soldAt) return null;
  if (row.salePriceUsd != null) return "sell";
  if (ctx.upgradeIds.has(row.id)) return "upgrade";
  if (ctx.contractIds.has(row.id)) return "contract";
  return "sell";
}

async function stampLeftVia(tx: Tx, ids: string[], leftVia: InventoryLeftVia | null) {
  if (!ids.length) return;
  try {
    await tx.inventoryItem.updateMany({
      where: { id: { in: ids } },
      data: { leftVia } as { leftVia: InventoryLeftVia | null },
    });
  } catch {
    for (const id of ids) {
      await tx.$executeRaw`UPDATE "InventoryItem" SET "leftVia" = ${leftVia} WHERE "id" = ${id}`;
    }
  }
}

export function serializeVaultItem(
  row: {
    id: string;
    skinId: string;
    wear: string;
    stattrak: boolean;
    acquiredAt: Date;
    soldAt?: Date | null;
    salePriceUsd?: number | null;
    leftVia?: string | null;
  },
  extras?: { withdrawPending?: boolean; leftVia?: InventoryLeftVia | null },
): InventoryItem | null {
  const catalog = getCatalogItem(row.skinId);
  if (!catalog) return null;
  const wear = row.wear as Wear;
  const quote = getSkinPrice(row.skinId, wear);
  const leftVia = extras?.leftVia !== undefined ? extras.leftVia : parseLeftVia(row.leftVia);
  return {
    ...catalog,
    wear,
    stattrak: row.stattrak,
    price: quote.available && quote.price != null ? quote.price : catalog.price,
    instanceId: row.id,
    obtainedAt: row.acquiredAt.getTime(),
    soldAt: row.soldAt ? row.soldAt.getTime() : null,
    leftVia,
    withdrawPending: extras?.withdrawPending || undefined,
  };
}

export async function loadPlayUser(userId?: string) {
  if (!userId) throw new Error("AUTH_REQUIRED");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

export function assertPlayable(user: { banned: boolean }) {
  if (user.banned) throw new Error("USER_BANNED");
}

export function assertWithdrawable(user: { wagerRemainingUsd: number }) {
  if (user.wagerRemainingUsd > 1e-9) throw new Error("WAGER_LOCKED");
}

async function maybeUpdateBestDrop(input: {
  userId: string;
  itemId: string;
  item: InventoryItem;
  source: PersistSource;
  priceUsd: number;
}) {
  if (!(input.priceUsd > 0)) return;
  const current = await prisma.bestDrop.findUnique({ where: { userId: input.userId } });
  if (current && current.priceUsd >= input.priceUsd) return;
  await prisma.bestDrop.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      inventoryItemId: input.itemId,
      skinId: input.item.id,
      name: input.item.name,
      wear: input.item.wear,
      rarity: input.item.rarity,
      weapon: input.item.weapon,
      image: input.item.image ?? null,
      priceUsd: input.priceUsd,
      obtainedAt: new Date(input.item.obtainedAt || Date.now()),
      source: input.source,
    },
    update: {
      inventoryItemId: input.itemId,
      skinId: input.item.id,
      name: input.item.name,
      wear: input.item.wear,
      rarity: input.item.rarity,
      weapon: input.item.weapon,
      image: input.item.image ?? null,
      priceUsd: input.priceUsd,
      obtainedAt: new Date(input.item.obtainedAt || Date.now()),
      source: input.source,
    },
  });
}

async function grantVaultItem(
  tx: Tx,
  input: {
    userId: string;
    item: InventoryItem;
    source: PersistSource;
    caseOpenId?: string | null;
  },
) {
  const existing = await tx.inventoryItem.findUnique({ where: { id: input.item.instanceId } });
  if (existing) return false;
  await ensurePlaySkins(tx, [input.item.id]);
  await tx.inventoryItem.create({
    data: {
      id: input.item.instanceId,
      userId: input.userId,
      skinId: input.item.id,
      wear: input.item.wear,
      stattrak: input.item.stattrak,
      acquiredAt: new Date(input.item.obtainedAt || Date.now()),
      source: input.source,
      caseOpenId: input.caseOpenId ?? null,
    },
  });
  return true;
}

async function consumeVaultItems(tx: Tx, userId: string, ids: string[], leftVia: InventoryLeftVia) {
  if (!ids.length) throw new Error("ITEMS_UNAVAILABLE");
  const rows = await tx.inventoryItem.findMany({ where: { id: { in: ids }, userId } });
  if (rows.length !== ids.length || rows.some((row) => row.soldAt)) {
    throw new Error("ITEMS_UNAVAILABLE");
  }
  await tx.inventoryItem.updateMany({
    where: { id: { in: ids }, userId, soldAt: null },
    data: { soldAt: new Date() },
  });
  await stampLeftVia(tx, ids, leftVia);
}

/**
 * Playthrough (отыгровка) counts **bet volume**, not winnings:
 * - cases: USD charged to open
 * - upgrades: extra USD + market value of skins staked
 * - contracts: market value of skins contracted
 * Selling to site balance does not count. Withdraw is blocked until remaining is 0.
 */
function nextWagerRemaining(current: number, volumeUsd: number) {
  return usd(Math.max(0, current - Math.max(0, volumeUsd)));
}

async function vaultStakeUsd(tx: Tx, userId: string, ids: string[]) {
  if (!ids.length) return 0;
  const rows = await tx.inventoryItem.findMany({ where: { id: { in: ids }, userId } });
  let total = 0;
  for (const row of rows) {
    const item = serializeVaultItem(row);
    if (item) total += itemPriceUsd(item);
  }
  return usd(total);
}

/** Inventory rows held by a pending SKIN withdrawal (soldAt set, still shown in vault). */
async function loadSkinWithdrawIds(userId: string): Promise<{ pending: string[]; withdrawn: string[] }> {
  const empty = { pending: [] as string[], withdrawn: [] as string[] };
  const db = withdrawalDelegate();
  try {
    if (db) {
      const rows = await db.findMany({
        where: { userId, kind: "SKIN" },
        select: { inventoryItemId: true, status: true },
      });
      const pending: string[] = [];
      const withdrawn: string[] = [];
      for (const row of rows) {
        const id = row.inventoryItemId;
        if (!id) continue;
        if (row.status === "PENDING") pending.push(id);
        else if (row.status === "APPROVED") withdrawn.push(id);
      }
      return { pending, withdrawn };
    }
    const rows = await prisma.$queryRaw<Array<{ inventoryItemId: string | null; status: string }>>`
      SELECT inventoryItemId, status FROM Withdrawal
      WHERE userId = ${userId} AND kind = ${"SKIN"}
    `;
    const pending: string[] = [];
    const withdrawn: string[] = [];
    for (const row of rows) {
      const id = row.inventoryItemId;
      if (!id) continue;
      if (row.status === "PENDING") pending.push(id);
      else if (row.status === "APPROVED") withdrawn.push(id);
    }
    return { pending, withdrawn };
  } catch (err) {
    console.error("[me] skin withdraw ids failed", err);
    return empty;
  }
}

export async function loadPlayerSnapshot(userId: string) {
  await ensureInventoryHistorySchema();
  const user = await loadPlayUser(userId);
  const [vault, withdrawIds, best, openedCases, upgradeRows, contractRows, activity] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId: user.id },
      orderBy: { acquiredAt: "desc" },
    }),
    loadSkinWithdrawIds(user.id),
    prisma.bestDrop.findUnique({
      where: { userId: user.id },
      include: { item: { select: { soldAt: true } } },
    }),
    prisma.caseOpen.count({ where: { userId: user.id } }),
    prisma.upgradeAttempt.findMany({ where: { userId: user.id }, select: { inputIds: true } }),
    prisma.contractAttempt.findMany({ where: { userId: user.id }, select: { inputIds: true } }),
    loadPlayerActivity(user.id),
  ]);

  const pendingSet = new Set(withdrawIds.pending);
  const withdrawnSet = new Set(withdrawIds.withdrawn);
  const upgradeIds = new Set(upgradeRows.flatMap((row) => parseIdList(row.inputIds)));
  const contractIds = new Set(contractRows.flatMap((row) => parseIdList(row.inputIds)));
  const leftCtx = { pending: pendingSet, withdrawn: withdrawnSet, upgradeIds, contractIds };

  const inventory = vault
    .map((row) => {
      const item = serializeVaultItem(row, {
        withdrawPending: pendingSet.has(row.id),
        leftVia: inferLeftVia(
          {
            id: row.id,
            soldAt: row.soldAt,
            salePriceUsd: row.salePriceUsd,
            leftVia: (row as { leftVia?: string | null }).leftVia,
          },
          leftCtx,
        ),
      });
      return item;
    })
    .filter((row): row is InventoryItem => !!row);

  let freeCaseClaims: FreeCaseClaimSummary[] = [];
  try {
    freeCaseClaims = await listUserFreeCaseClaims(user.id);
  } catch (err) {
    console.error("[play] free case claims load failed", { userId: user.id, err });
  }

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      steamId: user.steamId,
      avatarUrl: (user as { avatarUrl?: string }).avatarUrl ?? "",
      banned: user.banned,
      balanceUsd: usd(user.balanceUsd),
      wagerRemainingUsd: usd(user.wagerRemainingUsd),
      tradeUrl: user.tradeUrl ?? "",
      email: user.email ?? "",
      createdAt: user.createdAt.getTime(),
    },
    balance: usd(user.balanceUsd),
    wagerRemainingUsd: usd(user.wagerRemainingUsd),
    tradeUrl: user.tradeUrl ?? "",
    banned: user.banned,
    inventory,
    bestDrop: best ? serializeBestDrop(best) : null,
    history: activity.history,
    joinedAt: user.createdAt.getTime(),
    email: user.email ?? "",
    freeCaseClaims,
    stats: {
      openedCases,
      upgrades: upgradeRows.length,
      contracts: contractRows.length,
      wageredUsd: activity.wageredUsd,
      upgradesWon: activity.upgradesWon,
      upgradesLost: activity.upgradesLost,
    },
  };
}

export async function persistCaseOpens(input: {
  userId: string;
  caseId: string;
  costUsd: number;
  items: InventoryItem[];
}): Promise<{ chargedUsd: number; freeCount: number }> {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const userId = user.id;
  const perCost = input.items.length ? usd(input.costUsd / input.items.length) : 0;
  const granted: InventoryItem[] = [];
  let chargedUsd = usd(input.costUsd);
  let freeCount = 0;

  try {
    // Catalog upserts outside the money tx: Neon pooler often kills long interactive txs,
    // and Vercel never seeds Case/Skin rows. Second Open still works if the tx then fails.
    await ensurePlayCatalog(prisma, { caseId: input.caseId, items: input.items });
    await prisma.$transaction(async (tx) => {
      await ensurePlayCatalog(tx, { caseId: input.caseId, items: input.items });
      const current = await tx.user.findUnique({ where: { id: userId } });
      if (!current) throw new Error("USER_NOT_FOUND");
      if (current.banned) throw new Error("USER_BANNED");
      const ids = input.items.map((item) => item.instanceId);
      const existing = ids.length
        ? await tx.inventoryItem.findMany({ where: { id: { in: ids } } })
        : [];
      const have = new Set(existing.map((row) => row.id));
      const fresh = input.items.filter((item) => !have.has(item.instanceId));
      if (!fresh.length) {
        chargedUsd = 0;
        freeCount = 0;
        return;
      }

      if (existing.length === 0) {
        try {
          freeCount = await consumeFreeCaseClaims(tx, {
            userId,
            caseId: input.caseId,
            count: input.items.length,
          });
        } catch (err) {
          if (!isCaseCouponSchemaError(err)) throw err;
          console.error("[play] free case claim consume skipped", err);
          freeCount = 0;
        }
        const paidCount = Math.max(0, input.items.length - freeCount);
        chargedUsd = usd(perCost * paidCount);
        if (chargedUsd > 0 && current.balanceUsd + 1e-9 < chargedUsd) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        const balance = chargedUsd > 0 ? usd(current.balanceUsd - chargedUsd) : usd(current.balanceUsd);
        if (chargedUsd > 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              balanceUsd: balance,
              wagerRemainingUsd: nextWagerRemaining(current.wagerRemainingUsd, chargedUsd),
            },
          });
        }
        await tx.ledgerEntry.create({
          data: {
            userId,
            kind: "CASE_OPEN",
            amountUsd: usd(-chargedUsd),
            balanceAfter: balance,
            note:
              freeCount > 0
                ? `Opened ${input.caseId} ×${input.items.length} (${freeCount} free)`
                : `Opened ${input.caseId} ×${input.items.length}`,
            meta: JSON.stringify({
              caseId: input.caseId,
              count: input.items.length,
              freeCount,
            }),
          },
        });
      }

      let remainingFree = freeCount;
      for (const item of fresh) {
        const payout = itemPriceUsd(item);
        const costUsd = remainingFree > 0 ? 0 : perCost;
        if (remainingFree > 0) remainingFree -= 1;
        const open = await tx.caseOpen.create({
          data: {
            userId,
            caseId: input.caseId,
            skinId: item.id,
            costUsd,
            payoutUsd: payout,
            wear: item.wear,
          },
        });
        const created = await grantVaultItem(tx, {
          userId,
          item,
          source: "CASE",
          caseOpenId: open.id,
        });
        if (created) granted.push(item);
      }
    }, { maxWait: 8_000, timeout: 15_000 });
  } catch (err) {
    rethrowPlayPersist(
      { op: "persistCaseOpens", userId, caseId: input.caseId, skinIds: input.items.map((item) => item.id) },
      err,
    );
  }

  for (const item of granted) {
    try {
      await maybeUpdateBestDrop({
        userId,
        itemId: item.instanceId,
        item,
        source: "CASE",
        priceUsd: itemPriceUsd(item),
      });
    } catch (err) {
      console.error("[play] best drop update failed after open", { userId, itemId: item.instanceId, err });
    }
  }

  return { chargedUsd, freeCount };
}

export async function persistItemsLeftVault(input: {
  userId: string;
  ids: string[];
  sales?: Record<string, number>;
  leftVia?: InventoryLeftVia;
}) {
  if (!input.ids.length) return;
  await ensureInventoryHistorySchema();
  const user = await loadPlayUser(input.userId);
  const userId = user.id;
  const now = new Date();
  let credit = 0;
  const soldIds: string[] = [];
  const leftVia = input.leftVia ?? "sell";

  await prisma.$transaction(async (tx) => {
    for (const id of input.ids) {
      const row = await tx.inventoryItem.findFirst({ where: { id, userId, soldAt: null } });
      if (!row) continue;
      const sale = input.sales?.[id];
      const saleUsd = typeof sale === "number" && Number.isFinite(sale) ? usd(sale) : undefined;
      await tx.inventoryItem.update({
        where: { id },
        data: { soldAt: now, salePriceUsd: saleUsd },
      });
      await stampLeftVia(tx, [id], leftVia);
      if (saleUsd) credit = usd(credit + saleUsd);
      soldIds.push(id);
    }
    if (credit > 0) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { balanceUsd: { increment: credit } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          kind: "SELL",
          amountUsd: credit,
          balanceAfter: usd(updated.balanceUsd),
          note: `Sold ${soldIds.length} item(s)`,
          meta: JSON.stringify({ ids: soldIds }),
        },
      });
    }
  });
}

export async function persistGrant(input: {
  userId: string;
  item: InventoryItem;
  note?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const created = await prisma.$transaction(async (tx) => grantVaultItem(tx, {
    userId: input.userId,
    item: input.item,
    source: "ADMIN",
  }));
  if (!created) return;
  await maybeUpdateBestDrop({
    userId: input.userId,
    itemId: input.item.instanceId,
    item: input.item,
    source: "ADMIN",
    priceUsd: itemPriceUsd(input.item),
  });
  await prisma.ledgerEntry.create({
    data: {
      userId: input.userId,
      kind: "ADMIN_GRANT",
      amountUsd: 0,
      balanceAfter: usd(user.balanceUsd),
      note: input.note ?? `Granted ${input.item.name}`,
      meta: JSON.stringify({ instanceId: input.item.instanceId, skinId: input.item.id }),
    },
  });
}

export async function persistBalanceAdjust(input: {
  userId: string;
  deltaUsd: number;
  note?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const next = usd(user.balanceUsd + input.deltaUsd);
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { balanceUsd: next },
  });
  await prisma.ledgerEntry.create({
    data: {
      userId: input.userId,
      kind: "ADMIN_ADJUST",
      amountUsd: usd(input.deltaUsd),
      balanceAfter: usd(updated.balanceUsd),
      note: input.note ?? "Admin balance adjustment",
    },
  });
  return updated;
}

export async function persistWagerReset(input: { userId: string; note?: string }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  const previousUsd = usd(user.wagerRemainingUsd);
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { wagerRemainingUsd: 0 },
  });
  await prisma.ledgerEntry.create({
    data: {
      userId: input.userId,
      kind: "ADMIN_ADJUST",
      amountUsd: 0,
      balanceAfter: usd(updated.balanceUsd),
      note: input.note?.trim() || `Wager reset (was ${previousUsd})`,
      meta: JSON.stringify({ wagerReset: true, previousUsd }),
    },
  });
  return { previousUsd, wagerRemainingUsd: 0 };
}

export async function persistPromoRedeem(input: { userId: string; code: string }) {
  const userId = input.userId;
  await loadPlayUser(userId);
  const promo = await resolvePromoCode(input.code);
  if (!promo) return { ok: false as const, error: "INVALID_CODE" };
  try {
    await prisma.promoRedemption.create({
      data: { promoId: promo.id, userId },
    });
  } catch {
    return { ok: true as const, already: true, percentBonus: promo.percentBonus };
  }
  return { ok: true as const, already: false, percentBonus: promo.percentBonus };
}

export async function persistUpgradeAttempt(input: {
  userId: string;
  sourceInstanceIds: string[];
  extraUsd: number;
  chance: number;
  targetSkinId: string;
  success: boolean;
  item: InventoryItem | null;
}) {
  await ensureInventoryHistorySchema();
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const extra = usd(Math.max(0, input.extraUsd));
  let granted = false;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current) throw new Error("USER_NOT_FOUND");
      if (current.banned) throw new Error("USER_BANNED");
      if (extra > 0 && current.balanceUsd + 1e-9 < extra) throw new Error("INSUFFICIENT_BALANCE");
      const stakeUsd = await vaultStakeUsd(tx, user.id, input.sourceInstanceIds);
      const volumeUsd = usd(extra + stakeUsd);
      await consumeVaultItems(tx, user.id, input.sourceInstanceIds, "upgrade");
      let balance = current.balanceUsd;
      if (extra > 0) {
        balance = usd(balance - extra);
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          balanceUsd: balance,
          wagerRemainingUsd: nextWagerRemaining(current.wagerRemainingUsd, volumeUsd),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          kind: "UPGRADE",
          amountUsd: usd(-extra),
          balanceAfter: usd(balance),
          note: input.success ? `Upgrade win ${input.targetSkinId}` : "Upgrade fail",
          meta: JSON.stringify({
            sourceIds: input.sourceInstanceIds,
            targetSkinId: input.targetSkinId,
            success: input.success,
          }),
        },
      });
      await tx.upgradeAttempt.create({
        data: {
          userId: user.id,
          inputIds: JSON.stringify(input.sourceInstanceIds),
          targetSkinId: input.targetSkinId,
          chance: input.chance,
          extraUsd: extra,
          success: input.success,
          resultSkinId: input.item?.id ?? null,
        },
      });
      if (input.success && input.item) {
        await ensurePlaySkins(tx, [input.item.id]);
        granted = await grantVaultItem(tx, { userId: user.id, item: input.item, source: "UPGRADE" });
      }
    });
  } catch (err) {
    rethrowPlayPersist(
      {
        op: "persistUpgradeAttempt",
        userId: user.id,
        targetSkinId: input.targetSkinId,
        skinId: input.item?.id,
      },
      err,
    );
  }

  if (granted && input.item) {
    await maybeUpdateBestDrop({
      userId: user.id,
      itemId: input.item.instanceId,
      item: input.item,
      source: "UPGRADE",
      priceUsd: itemPriceUsd(input.item),
    });
  }
}

export async function persistContractAttempt(input: {
  userId: string;
  sourceInstanceIds: string[];
  extraUsd?: number;
  item: InventoryItem;
}) {
  await ensureInventoryHistorySchema();
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const extra = usd(Math.max(0, input.extraUsd ?? 0));
  let granted = false;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id } });
      if (!current) throw new Error("USER_NOT_FOUND");
      if (current.banned) throw new Error("USER_BANNED");
      if (extra > 0 && current.balanceUsd + 1e-9 < extra) throw new Error("INSUFFICIENT_BALANCE");
      const stakeUsd = await vaultStakeUsd(tx, user.id, input.sourceInstanceIds);
      const volumeUsd = usd(extra + stakeUsd);
      await consumeVaultItems(tx, user.id, input.sourceInstanceIds, "contract");
      let balance = current.balanceUsd;
      if (extra > 0) {
        balance = usd(balance - extra);
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          balanceUsd: balance,
          wagerRemainingUsd: nextWagerRemaining(current.wagerRemainingUsd, volumeUsd),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          kind: "CONTRACT",
          amountUsd: usd(-extra),
          balanceAfter: usd(balance),
          note: `Contract → ${input.item.name}`,
          meta: JSON.stringify({
            sourceIds: input.sourceInstanceIds,
            resultSkinId: input.item.id,
            extraUsd: extra,
          }),
        },
      });
      await tx.contractAttempt.create({
        data: {
          userId: user.id,
          inputIds: JSON.stringify(input.sourceInstanceIds),
          resultSkinId: input.item.id,
        },
      });
      await ensurePlaySkins(tx, [input.item.id]);
      granted = await grantVaultItem(tx, { userId: user.id, item: input.item, source: "CONTRACT" });
    });
  } catch (err) {
    rethrowPlayPersist(
      { op: "persistContractAttempt", userId: user.id, skinId: input.item.id },
      err,
    );
  }

  if (granted) {
    await maybeUpdateBestDrop({
      userId: user.id,
      itemId: input.item.instanceId,
      item: input.item,
      source: "CONTRACT",
      priceUsd: itemPriceUsd(input.item),
    });
  }
}

export function serializeDeposit(row: {
  id: string;
  asset: string;
  network: string;
  address: string;
  amountUsd: number;
  amountCrypto: number;
  status: string;
  txNote: string;
  txHash?: string;
  promoCode?: string;
  bonusUsd?: number;
  createdAt: Date;
  reviewedAt: Date | null;
  userId?: string;
  user?: { displayName: string } | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    user: row.user?.displayName,
    asset: row.asset,
    network: row.network,
    address: row.address,
    amountUsd: usd(row.amountUsd),
    amountCrypto: row.amountCrypto,
    status: row.status,
    txNote: row.txNote,
    txHash: row.txHash ?? "",
    promoCode: row.promoCode ?? "",
  bonusUsd: usd(row.bonusUsd ?? 0),
  createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function persistDepositCreate(input: {
  userId: string;
  asset: string;
  network: string;
  amountUsd: number;
  txNote?: string;
  promoCode?: string;
}) {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  if (!isDepositAsset(input.asset)) throw new Error("INVALID_ASSET");
  const coin = getDepositCoin(input.asset);
  const network = coin ? getDepositNetwork(coin, input.network) : null;
  if (!coin || !network) throw new Error("INVALID_ASSET");
  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= coin.minUsd)) throw new Error("AMOUNT_TOO_LOW");

  const rawPromo = typeof input.promoCode === "string" ? input.promoCode.trim().toUpperCase() : "";
  const promoCode = rawPromo ? await resolveDepositPromo(user.id, rawPromo) : "";

  const address = demoDepositAddress(input.asset as DepositAsset, network.id);
  const amountCrypto = cryptoFromUsd(amountUsd, coin.usdRate);
  const db = depositDelegate();
  if (!db) throw new Error("DEPOSIT_UNAVAILABLE");
  const row = await db.create({
    data: {
      userId: user.id,
      asset: coin.asset,
      network: network.id,
      address,
      amountUsd,
      amountCrypto,
      status: "PENDING",
      txNote: (input.txNote ?? "").trim().slice(0, 240),
      promoCode,
    },
  });
  return serializeDeposit(row);
}

async function resolveDepositPromo(userId: string, rawPromo: string) {
  const code = rawPromo.trim().toUpperCase();
  if (!code) return "";
  const promo = await resolvePromoCode(code);
  if (!promo) throw new Error("PROMO_INVALID");
  const redemption = await prisma.promoRedemption.findUnique({
    where: { promoId_userId: { promoId: promo.id, userId } },
  });
  if (!redemption) throw new Error("PROMO_NOT_APPLIED");
  return promo.code;
}

async function creditDepositRow(
  tx: Prisma.TransactionClient,
  row: {
    id: string;
    userId: string;
    asset: string;
    network: string;
    amountUsd: number;
    promoCode: string;
    txHash?: string;
  },
  metaExtra?: Record<string, unknown>,
) {
  let bonusUsd = 0;
  let promoPercent = 0;
  if (row.promoCode) {
    const promo = await tx.promoCode.findUnique({ where: { code: row.promoCode } });
    if (promo?.enabled) {
      promoPercent = promo.percentBonus;
      bonusUsd = usd((row.amountUsd * promo.percentBonus) / 100);
    }
  }
  const creditUsd = usd(row.amountUsd + bonusUsd);
  const user = await tx.user.update({
    where: { id: row.userId },
    data: { balanceUsd: { increment: creditUsd } },
  });
  await tx.ledgerEntry.create({
    data: {
      userId: row.userId,
      kind: "DEPOSIT",
      amountUsd: creditUsd,
      balanceAfter: usd(user.balanceUsd),
      note:
        bonusUsd > 0
          ? `Crypto ${row.asset} ${row.network} · +${promoPercent}% ${row.promoCode}`
          : `Crypto ${row.asset} ${row.network}`,
      meta: JSON.stringify({
        depositId: row.id,
        asset: row.asset,
        network: row.network,
        baseUsd: usd(row.amountUsd),
        bonusUsd,
        promoCode: row.promoCode || null,
        txHash: row.txHash || null,
        ...metaExtra,
      }),
    },
  });
  return { bonusUsd, creditUsd, balanceUsd: usd(user.balanceUsd) };
}

/** Register amount to watch on-chain (live USDT TRC-20). */
export async function persistDepositWatch(input: {
  userId: string;
  amountUsd: number;
  promoCode?: string;
}) {
  if (!isLiveUsdtTrc20Enabled()) throw new Error("DEPOSIT_UNAVAILABLE");
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);

  const coin = getDepositCoin("USDT");
  if (!coin) throw new Error("INVALID_ASSET");
  const network = getDepositNetwork(coin, "trc20");
  if (!network) throw new Error("INVALID_ASSET");

  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= coin.minUsd)) throw new Error("AMOUNT_TOO_LOW");

  const promoCode = await resolveDepositPromo(user.id, input.promoCode ?? "");
  const sendUsdt = uniqueUsdtSendAmount(amountUsd, user.id);
  const address = liveUsdtTrc20Address();
  const db = depositDelegate();
  if (!db) throw new Error("DEPOSIT_UNAVAILABLE");

  const existing = await db.findMany({
    where: { userId: user.id, status: "PENDING", asset: "USDT", network: "trc20" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const prior = existing[0];
  if (prior && !(prior.txHash ?? "")) {
    const updated = await db.update({
      where: { id: prior.id },
      data: { amountUsd, amountCrypto: sendUsdt, promoCode, address },
    });
    return serializeDeposit(updated);
  }

  const row = await db.create({
    data: {
      userId: user.id,
      asset: "USDT",
      network: "trc20",
      address,
      amountUsd,
      amountCrypto: sendUsdt,
      status: "PENDING",
      promoCode,
    },
  });
  return serializeDeposit(row);
}

/** Scan Tron for a matching inbound transfer and credit balance. */
export async function persistDepositPoll(userId: string) {
  if (!isLiveUsdtTrc20Enabled()) return { ok: true as const, matched: false as const };

  const db = depositDelegate();
  if (!db) throw new Error("DEPOSIT_UNAVAILABLE");

  const watchRows = await db.findMany({
    where: { userId, status: "PENDING", asset: "USDT", network: "trc20" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const watch = watchRows[0];
  if (!watch || (watch.txHash ?? "")) return { ok: true as const, matched: false as const };

  const address = liveUsdtTrc20Address();
  const transfers = await listRecentUsdtDeposits(address, 50);

  for (const transfer of transfers) {
    if (!amountsMatch(watch.amountCrypto, transfer.amountUsdt)) continue;

    const usedRows = await db.findMany({
      where: { txHash: transfer.txId, status: "APPROVED" },
      take: 1,
    });
    if (usedRows.length) continue;

    const result = await prisma.$transaction(async (tx) => {
      const credit = await creditDepositRow(
        tx,
        {
          id: watch.id,
          userId: watch.userId,
          asset: watch.asset,
          network: watch.network,
          amountUsd: watch.amountUsd,
          promoCode: watch.promoCode ?? "",
          txHash: transfer.txId,
        },
        { auto: true },
      );
      return credit;
    });

    const updated = await db.update({
      where: { id: watch.id },
      data: {
        status: "APPROVED",
        txHash: transfer.txId,
        bonusUsd: result.bonusUsd,
        reviewedAt: new Date(),
        reviewedBy: "tron",
      },
    });

    return {
      ok: true as const,
      matched: true as const,
      deposit: serializeDeposit(updated),
      balance: result.balanceUsd,
      creditedUsd: result.creditUsd,
    };
  }

  return { ok: true as const, matched: false as const };
}

export async function persistDepositReview(input: {
  id: string;
  action: "APPROVED" | "REJECTED";
  reviewerId: string;
}) {
  const db = depositDelegate();
  if (!db) throw new Error("DEPOSIT_UNAVAILABLE");
  const row = await db.findUnique({ where: { id: input.id } });
  if (!row) throw new Error("DEPOSIT_NOT_FOUND");
  if (row.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

  if (input.action === "REJECTED") {
    const updated = await db.update({
      where: { id: row.id },
      data: { status: "REJECTED", reviewedBy: input.reviewerId, reviewedAt: new Date() },
      include: { user: { select: { displayName: true } } },
    });
    return serializeDeposit(updated);
  }

  const result = await prisma.$transaction(async (tx) => {
    return creditDepositRow(tx, {
      id: row.id,
      userId: row.userId,
      asset: row.asset,
      network: row.network,
      amountUsd: row.amountUsd,
      promoCode: row.promoCode ?? "",
    });
  });
  const updated = await db.update({
    where: { id: row.id },
    data: {
      status: "APPROVED",
      bonusUsd: result.bonusUsd,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    },
    include: { user: { select: { displayName: true } } },
  });
  void result.creditUsd;
  return serializeDeposit(updated);
}

export function serializeGiftCard(row: {
  id: string;
  code: string;
  amountUsd: number;
  status: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | null;
  note: string;
  wagerMultiplier?: number;
  redeemedBy?: { displayName: string } | null;
}) {
  const wagerMultiplier = clampWagerMultiplier(row.wagerMultiplier ?? 10);
  return {
    id: row.id,
    code: row.code,
    amountUsd: usd(row.amountUsd),
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    redeemedByUserId: row.redeemedByUserId,
    redeemedBy: row.redeemedBy?.displayName ?? null,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    note: row.note,
    wagerMultiplier,
  };
}

function giftDb() {
  const db = giftCardDelegate();
  if (!db) throw new Error("GIFT_CARD_UNAVAILABLE");
  return db;
}

export async function persistGiftCardsCreate(input: {
  amountUsd: number;
  quantity: number;
  note?: string;
  expiresAt?: Date | null;
  createdBy: string;
  wagerMultiplier?: number;
}) {
  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= 1)) throw new Error("AMOUNT_TOO_LOW");
  const quantity = Math.min(50, Math.max(1, Math.round(input.quantity)));
  const wagerMultiplier = clampWagerMultiplier(input.wagerMultiplier);
  const db = giftDb();
  const cards = [];
  for (let i = 0; i < quantity; i++) {
    let code = generateGiftCode();
    for (let attempt = 0; attempt < 8; attempt++) {
      const clash = await db.findUnique({ where: { code } });
      if (!clash) break;
      code = generateGiftCode();
    }
    const row = await db.create({
      data: {
        code,
        amountUsd,
        status: "UNUSED",
        createdBy: input.createdBy,
        expiresAt: input.expiresAt ?? null,
        note: (input.note ?? "").trim().slice(0, 240),
        wagerMultiplier,
      },
    });
    cards.push(serializeGiftCard(row));
  }
  return cards;
}

export async function persistGiftCardDisable(id: string) {
  const db = giftDb();
  const row = await db.findUnique({ where: { id } });
  if (!row) throw new Error("GIFT_CARD_INVALID");
  if (row.status === "REDEEMED") throw new Error("GIFT_CARD_USED");
  if (row.status === "DISABLED") return serializeGiftCard(row);
  const updated = await db.update({
    where: { id },
    data: { status: "DISABLED" },
    include: { redeemedBy: { select: { displayName: true } } },
  });
  return serializeGiftCard(updated);
}

export async function persistGiftCardRedeem(input: { code: string; userId: string }) {
  const code = normalizeGiftCode(input.code);
  if (!isGiftCodeFormat(code)) throw new Error("GIFT_CARD_INVALID");
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const db = giftDb();
  const card = await db.findUnique({ where: { code } });
  if (!card) throw new Error("GIFT_CARD_INVALID");
  if (card.status === "DISABLED") throw new Error("GIFT_CARD_DISABLED");
  if (card.status === "REDEEMED") throw new Error("GIFT_CARD_USED");
  if (card.expiresAt && card.expiresAt.getTime() <= Date.now()) throw new Error("GIFT_CARD_EXPIRED");

  const result = await prisma.$transaction(async (tx) => {
    const still = await tx.giftCard.findUnique({ where: { id: card.id } });
    if (!still || still.status !== "UNUSED") throw new Error("GIFT_CARD_USED");
    if (still.expiresAt && still.expiresAt.getTime() <= Date.now()) throw new Error("GIFT_CARD_EXPIRED");
    const wagerMultiplier = clampWagerMultiplier(still.wagerMultiplier);
    const wagerAddedUsd = usd(still.amountUsd * wagerMultiplier);
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        balanceUsd: { increment: still.amountUsd },
        wagerRemainingUsd: { increment: wagerAddedUsd },
      },
    });
    await tx.ledgerEntry.create({
      data: {
        userId: user.id,
        kind: "GIFT",
        amountUsd: usd(still.amountUsd),
        balanceAfter: usd(updatedUser.balanceUsd),
        note: `Gift card ${still.code}`,
        meta: JSON.stringify({ giftCardId: still.id, code: still.code }),
      },
    });
    const redeemed = await tx.giftCard.update({
      where: { id: still.id },
      data: {
        status: "REDEEMED",
        redeemedByUserId: user.id,
        redeemedAt: new Date(),
      },
    });
    return {
      redeemed,
      balance: usd(updatedUser.balanceUsd),
      amountUsd: usd(still.amountUsd),
      wagerMultiplier,
      wagerAddedUsd,
      wagerRemainingUsd: usd(updatedUser.wagerRemainingUsd),
    };
  });

  return {
    card: serializeGiftCard(result.redeemed),
    amountUsd: result.amountUsd,
    balance: result.balance,
    wagerMultiplier: result.wagerMultiplier,
    wagerAddedUsd: result.wagerAddedUsd,
    wagerRemainingUsd: result.wagerRemainingUsd,
  };
}

export const MIN_WITHDRAW_USD = 1;

type WithdrawalRow = {
  id: string;
  amountUsd: number;
  status: string;
  note: string;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  userId?: string;
  user?: { displayName: string } | null;
  kind?: string | null;
  inventoryItemId?: string | null;
  itemName?: string | null;
  tradeUrl?: string | null;
  inventoryItem?: {
    id: string;
    skinId: string;
    wear: string;
    stattrak: boolean;
    acquiredAt: Date;
  } | null;
};

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeWithdrawal(row: WithdrawalRow) {
  const kind = row.kind === "SKIN" ? "SKIN" : "CASH";
  const item = row.inventoryItem ? serializeVaultItem(row.inventoryItem) : null;
  return {
    id: row.id,
    userId: row.userId,
    user: row.user?.displayName,
    amountUsd: usd(row.amountUsd),
    status: row.status,
    kind,
    inventoryItemId: row.inventoryItemId ?? item?.instanceId ?? null,
    itemName: (row.itemName || item?.name || "").trim(),
    tradeUrl: (row.tradeUrl || "").trim(),
    note: row.note,
    createdAt: isoDate(row.createdAt) ?? new Date().toISOString(),
    reviewedAt: isoDate(row.reviewedAt),
    item,
  };
}

async function readStoredTradeUrl(userId: string, fallback = "") {
  const fromUser = normalizeTradeUrl(fallback);
  if (looksLikeTradeUrl(fromUser)) return fromUser;
  try {
    const rows = await prisma.$queryRaw<Array<{ tradeUrl: string | null }>>`
      SELECT tradeUrl FROM User WHERE id = ${userId}
    `;
    return normalizeTradeUrl(rows[0]?.tradeUrl ?? "");
  } catch {
    return "";
  }
}

function newWithdrawalId() {
  return `wth_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

type TxLike = {
  withdrawal?: {
    create: (args: Record<string, unknown>) => Promise<WithdrawalRow>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

async function countPendingSkin(tx: TxLike, inventoryItemId: string) {
  if (tx.withdrawal) {
    return tx.withdrawal.count({
      where: { inventoryItemId, status: "PENDING" },
    });
  }
  const rows = await tx.$queryRaw<Array<{ n: number | bigint }>>`
    SELECT COUNT(*) as n FROM Withdrawal WHERE inventoryItemId = ${inventoryItemId} AND status = 'PENDING'
  `;
  return Number(rows[0]?.n ?? 0);
}

async function insertSkinWithdrawal(
  tx: TxLike,
  data: {
    userId: string;
    amountUsd: number;
    inventoryItemId: string;
    itemName: string;
    tradeUrl: string;
  },
) {
  if (tx.withdrawal) {
    return tx.withdrawal.create({
      data: {
        userId: data.userId,
        amountUsd: data.amountUsd,
        status: "PENDING",
        kind: "SKIN",
        inventoryItemId: data.inventoryItemId,
        itemName: data.itemName,
        tradeUrl: data.tradeUrl,
        note: data.itemName,
      },
      include: { user: { select: { displayName: true } } },
    });
  }
  const id = newWithdrawalId();
  const createdAt = new Date();
  await tx.$executeRaw`
    INSERT INTO Withdrawal (id, userId, amountUsd, status, kind, inventoryItemId, itemName, tradeUrl, note, createdAt)
    VALUES (${id}, ${data.userId}, ${data.amountUsd}, ${"PENDING"}, ${"SKIN"}, ${data.inventoryItemId}, ${data.itemName}, ${data.tradeUrl}, ${data.itemName}, ${createdAt})
  `;
  return {
    id,
    userId: data.userId,
    amountUsd: data.amountUsd,
    status: "PENDING",
    kind: "SKIN",
    inventoryItemId: data.inventoryItemId,
    itemName: data.itemName,
    tradeUrl: data.tradeUrl,
    note: data.itemName,
    createdAt,
    reviewedAt: null,
    user: { displayName: data.userId },
  };
}

export async function persistTradeUrl(input: { userId: string; url: string }) {
  const user = await loadPlayUser(input.userId);
  const tradeUrl = normalizeTradeUrl(input.url);
  if (tradeUrl && !looksLikeTradeUrl(tradeUrl)) throw new Error("TRADE_URL_INVALID");
  try {
    await prisma.user.update({ where: { id: user.id }, data: { tradeUrl } });
  } catch (err) {
    console.warn("[withdraw] persistTradeUrl Prisma update failed, using SQL", err);
    await prisma.$executeRaw`UPDATE User SET tradeUrl = ${tradeUrl} WHERE id = ${user.id}`;
  }
  return { tradeUrl };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function persistAccountEmail(input: { userId: string; email: string }) {
  const user = await loadPlayUser(input.userId);
  const email = input.email.trim().slice(0, 190);
  if (email && !EMAIL_RE.test(email)) throw new Error("EMAIL_INVALID");
  const value = email || null;
  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: value } });
  } catch (err) {
    console.warn("[account] persistAccountEmail Prisma update failed, using SQL", err);
    await prisma.$executeRaw`UPDATE User SET email = ${value} WHERE id = ${user.id}`;
  }
  return { email: email };
}

export async function persistWithdrawalCreate(input: { userId: string; amountUsd: number; note?: string }) {
  ensurePrisma();
  const db = withdrawalDelegate();
  if (!db) {
    console.error("[withdraw] prisma.withdrawal missing — run npm run db:generate");
    throw new Error("WITHDRAWAL_UNAVAILABLE");
  }
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  assertWithdrawable(user);
  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= MIN_WITHDRAW_USD)) throw new Error("AMOUNT_TOO_LOW");
  const note = (input.note ?? "").trim().slice(0, 240);

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.banned) throw new Error("USER_BANNED");
    if (current.wagerRemainingUsd > 1e-9) throw new Error("WAGER_LOCKED");
    const pending = await tx.withdrawal.count({
      where: { userId: user.id, status: "PENDING", kind: "CASH" },
    });
    if (pending > 0) throw new Error("WITHDRAWAL_PENDING");
    if (current.balanceUsd + 1e-9 < amountUsd) throw new Error("INSUFFICIENT_BALANCE");
    const balance = usd(current.balanceUsd - amountUsd);
    await tx.user.update({
      where: { id: user.id },
      data: { balanceUsd: balance },
    });
    await tx.ledgerEntry.create({
      data: {
        userId: user.id,
        kind: "WITHDRAW",
        amountUsd: usd(-amountUsd),
        balanceAfter: balance,
        note: note ? `Withdraw ${note}` : "Withdraw request",
        meta: JSON.stringify({ amountUsd, note }),
      },
    });
    const row = await tx.withdrawal.create({
      data: {
        userId: user.id,
        amountUsd,
        status: "PENDING",
        kind: "CASH",
        note,
      },
    });
    return { withdrawal: serializeWithdrawal(row), balance };
  });
}

export async function persistSkinWithdrawalCreate(input: {
  userId: string;
  instanceId: string;
  tradeUrl?: string;
}) {
  const instanceId = input.instanceId.trim();
  if (!instanceId) throw new Error("INVALID_INPUT");
  const offered = normalizeTradeUrl(input.tradeUrl ?? "");
  if (offered && !looksLikeTradeUrl(offered)) throw new Error("TRADE_URL_INVALID");

  await ensureInventoryHistorySchema();
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  assertWithdrawable(user);

  const stored = await readStoredTradeUrl(user.id, (user as { tradeUrl?: string }).tradeUrl ?? "");
  const tradeUrl = looksLikeTradeUrl(offered) ? offered : stored;
  if (!looksLikeTradeUrl(tradeUrl)) throw new Error("TRADE_URL_REQUIRED");

  return prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.banned) throw new Error("USER_BANNED");
    if (current.wagerRemainingUsd > 1e-9) throw new Error("WAGER_LOCKED");

    if (tradeUrl !== stored) {
      try {
        await tx.user.update({ where: { id: user.id }, data: { tradeUrl } });
      } catch {
        await tx.$executeRaw`UPDATE User SET tradeUrl = ${tradeUrl} WHERE id = ${user.id}`;
      }
    }

    const vaultRow = await tx.inventoryItem.findFirst({
      where: { id: instanceId, userId: user.id, soldAt: null },
    });
    if (!vaultRow) throw new Error("ITEMS_UNAVAILABLE");

    const pendingSame = await countPendingSkin(tx as unknown as TxLike, instanceId);
    if (pendingSame > 0) throw new Error("WITHDRAWAL_PENDING");

    const item = serializeVaultItem(vaultRow);
    const itemName = item?.name ?? "";
    const amountUsd = item ? itemPriceUsd(item) : 0;

    await tx.inventoryItem.update({
      where: { id: instanceId },
      data: { soldAt: new Date(), salePriceUsd: null },
    });
    await stampLeftVia(tx as unknown as Tx, [instanceId], "withdraw");

    const row = await insertSkinWithdrawal(tx as unknown as TxLike, {
      userId: user.id,
      amountUsd,
      inventoryItemId: instanceId,
      itemName,
      tradeUrl,
    });
    return { withdrawal: serializeWithdrawal({ ...row, inventoryItem: vaultRow, tradeUrl }) };
  });
}

export async function persistWithdrawalReview(input: {
  id: string;
  action: "APPROVED" | "REJECTED";
  reviewerId: string;
}) {
  ensurePrisma();
  await ensureInventoryHistorySchema();
  const db = withdrawalDelegate();
  if (!db) {
    console.error("[withdraw] prisma.withdrawal missing — run npm run db:generate");
    throw new Error("WITHDRAWAL_UNAVAILABLE");
  }

  return prisma.$transaction(async (tx) => {
    const row = await tx.withdrawal.findUnique({ where: { id: input.id } });
    if (!row) throw new Error("WITHDRAWAL_NOT_FOUND");
    if (row.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

    if (input.action === "REJECTED") {
      if (row.kind === "SKIN") {
        if (row.inventoryItemId) {
          await tx.inventoryItem.updateMany({
            where: { id: row.inventoryItemId, userId: row.userId },
            data: { soldAt: null, salePriceUsd: null },
          });
          await stampLeftVia(tx as unknown as Tx, [row.inventoryItemId], null);
        }
      } else {
        const user = await tx.user.update({
          where: { id: row.userId },
          data: { balanceUsd: { increment: row.amountUsd } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId: row.userId,
            kind: "WITHDRAW_REFUND",
            amountUsd: usd(row.amountUsd),
            balanceAfter: usd(user.balanceUsd),
            note: "Withdrawal rejected",
            meta: JSON.stringify({ withdrawalId: row.id }),
          },
        });
      }
    }

    const updated = await tx.withdrawal.update({
      where: { id: row.id },
      data: {
        status: input.action,
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: { displayName: true } },
        inventoryItem: true,
      },
    });
    return serializeWithdrawal(updated);
  });
}

