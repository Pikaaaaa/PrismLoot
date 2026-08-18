import { SKIN_MAP } from "@/data/skins";
import { looksLikeTradeUrl, normalizeTradeUrl } from "@/lib/auth/account";
import {
  cryptoFromUsd,
  demoDepositAddress,
  getDepositCoin,
  getDepositNetwork,
  isDepositAsset,
  type DepositAsset,
} from "@/lib/deposits/catalog";
import { DEMO_USER_ID, depositDelegate, ensurePrisma, giftCardDelegate, prisma, usd, withdrawalDelegate } from "@/lib/db";
import { generateGiftCode, isGiftCodeFormat, normalizeGiftCode } from "@/lib/gift-cards/codes";
import { clampWagerMultiplier } from "@/lib/gift-cards/wager";
import { getSkinPrice } from "@/lib/services/prices";
import type { InventoryItem, Wear } from "@/lib/types";
import type { BestDrop as DbBestDrop, Prisma } from "@prisma/client";

export type PersistSource = "CASE" | "UPGRADE" | "CONTRACT" | "ADMIN" | "PROMO";

type Tx = Prisma.TransactionClient;

function itemPriceUsd(item: InventoryItem) {
  const quote = getSkinPrice(item.id, item.wear);
  return quote.available && quote.price != null ? usd(quote.price) : usd(item.price);
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

export function serializeVaultItem(row: {
  id: string;
  skinId: string;
  wear: string;
  stattrak: boolean;
  acquiredAt: Date;
}): InventoryItem | null {
  const catalog = SKIN_MAP[row.skinId];
  if (!catalog) return null;
  const wear = row.wear as Wear;
  const quote = getSkinPrice(row.skinId, wear);
  return {
    ...catalog,
    wear,
    stattrak: row.stattrak,
    price: quote.available && quote.price != null ? quote.price : catalog.price,
    instanceId: row.id,
    obtainedAt: row.acquiredAt.getTime(),
  };
}

const DEMO_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=123456789&token=PrismLootDemo";

export async function ensureDemoUser() {
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    create: {
      id: DEMO_USER_ID,
      displayName: "NovaPrime",
      role: "USER",
      balanceUsd: 12500,
      tradeUrl: DEMO_TRADE_URL,
    },
    update: {},
  });
  const existing = normalizeTradeUrl((user as { tradeUrl?: string }).tradeUrl ?? "");
  if (looksLikeTradeUrl(existing)) return user;
  try {
    return await prisma.user.update({
      where: { id: user.id },
      data: { tradeUrl: DEMO_TRADE_URL },
    });
  } catch (err) {
    console.warn("[withdraw] User.tradeUrl update via Prisma failed, using SQL", err);
    await prisma.$executeRaw`UPDATE User SET tradeUrl = ${DEMO_TRADE_URL} WHERE id = ${user.id}`;
    return { ...user, tradeUrl: DEMO_TRADE_URL };
  }
}

export async function loadPlayUser(userId?: string) {
  const id = userId || DEMO_USER_ID;
  const user = id === DEMO_USER_ID ? await ensureDemoUser() : await prisma.user.findUnique({ where: { id } });
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

async function consumeVaultItems(tx: Tx, userId: string, ids: string[]) {
  if (!ids.length) throw new Error("ITEMS_UNAVAILABLE");
  const rows = await tx.inventoryItem.findMany({ where: { id: { in: ids }, userId } });
  if (rows.length !== ids.length || rows.some((row) => row.soldAt)) {
    throw new Error("ITEMS_UNAVAILABLE");
  }
  await tx.inventoryItem.updateMany({
    where: { id: { in: ids }, userId, soldAt: null },
    data: { soldAt: new Date() },
  });
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
async function pendingSkinHoldIds(userId: string): Promise<string[]> {
  const db = withdrawalDelegate();
  try {
    if (db) {
      const rows = await db.findMany({
        where: { userId, status: "PENDING", kind: "SKIN" },
        select: { inventoryItemId: true },
      });
      return rows.map((row) => row.inventoryItemId).filter((id): id is string => Boolean(id));
    }
    const rows = await prisma.$queryRaw<Array<{ inventoryItemId: string | null }>>`
      SELECT inventoryItemId FROM Withdrawal
      WHERE userId = ${userId} AND status = ${"PENDING"} AND kind = ${"SKIN"}
    `;
    return rows.map((row) => row.inventoryItemId).filter((id): id is string => Boolean(id));
  } catch (err) {
    console.error("[me] pending skin holds failed", err);
    return [];
  }
}

export async function loadDemoSnapshot() {
  const user = await ensureDemoUser();
  const [vault, pendingHoldIds, best, openedCases, upgrades, contracts] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { userId: user.id, soldAt: null },
      orderBy: { acquiredAt: "desc" },
    }),
    pendingSkinHoldIds(user.id),
    prisma.bestDrop.findUnique({
      where: { userId: user.id },
      include: { item: { select: { soldAt: true } } },
    }),
    prisma.caseOpen.count({ where: { userId: user.id } }),
    prisma.upgradeAttempt.count({ where: { userId: user.id } }),
    prisma.contractAttempt.count({ where: { userId: user.id } }),
  ]);

  const vaultIds = new Set(vault.map((row) => row.id));
  const missingHoldIds = pendingHoldIds.filter((id) => !vaultIds.has(id));
  const held =
    missingHoldIds.length > 0
      ? await prisma.inventoryItem.findMany({ where: { id: { in: missingHoldIds }, userId: user.id } })
      : [];
  const pendingSet = new Set(pendingHoldIds);
  const merged = [...held, ...vault].sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime());
  const inventory = merged
    .map((row) => {
      const item = serializeVaultItem(row);
      if (!item) return null;
      return pendingSet.has(row.id) ? { ...item, withdrawPending: true } : item;
    })
    .filter((row): row is InventoryItem => !!row);

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      banned: user.banned,
      balanceUsd: usd(user.balanceUsd),
      wagerRemainingUsd: usd(user.wagerRemainingUsd),
      tradeUrl: user.tradeUrl ?? "",
    },
    balance: usd(user.balanceUsd),
    wagerRemainingUsd: usd(user.wagerRemainingUsd),
    tradeUrl: user.tradeUrl ?? "",
    banned: user.banned,
    inventory,
    bestDrop: best ? serializeBestDrop(best) : null,
    stats: { openedCases, upgrades, contracts },
  };
}

export async function persistCaseOpens(input: {
  userId?: string;
  caseId: string;
  costUsd: number;
  items: InventoryItem[];
}) {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const userId = user.id;
  const perCost = input.items.length ? usd(input.costUsd / input.items.length) : 0;
  const granted: InventoryItem[] = [];

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.banned) throw new Error("USER_BANNED");
    const ids = input.items.map((item) => item.instanceId);
    const existing = ids.length
      ? await tx.inventoryItem.findMany({ where: { id: { in: ids } } })
      : [];
    const have = new Set(existing.map((row) => row.id));
    const fresh = input.items.filter((item) => !have.has(item.instanceId));
    if (!fresh.length) return;

    if (existing.length === 0) {
      if (current.balanceUsd + 1e-9 < input.costUsd) throw new Error("INSUFFICIENT_BALANCE");
      const balance = usd(current.balanceUsd - input.costUsd);
      await tx.user.update({
        where: { id: userId },
        data: {
          balanceUsd: balance,
          wagerRemainingUsd: nextWagerRemaining(current.wagerRemainingUsd, input.costUsd),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          userId,
          kind: "CASE_OPEN",
          amountUsd: usd(-input.costUsd),
          balanceAfter: balance,
          note: `Opened ${input.caseId} ×${input.items.length}`,
          meta: JSON.stringify({ caseId: input.caseId, count: input.items.length }),
        },
      });
    }

    for (const item of fresh) {
      const payout = itemPriceUsd(item);
      const open = await tx.caseOpen.create({
        data: {
          userId,
          caseId: input.caseId,
          skinId: item.id,
          costUsd: perCost,
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
  });

  for (const item of granted) {
    await maybeUpdateBestDrop({
      userId,
      itemId: item.instanceId,
      item,
      source: "CASE",
      priceUsd: itemPriceUsd(item),
    });
  }
}

export async function persistItemsLeftVault(input: {
  userId?: string;
  ids: string[];
  sales?: Record<string, number>;
}) {
  if (!input.ids.length) return;
  const user = await loadPlayUser(input.userId);
  const userId = user.id;
  const now = new Date();
  let credit = 0;
  const soldIds: string[] = [];

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

export async function persistPromoRedeem(input: { userId?: string; code: string }) {
  const user = await ensureDemoUser();
  const userId = input.userId || user.id;
  const promo = await prisma.promoCode.findUnique({ where: { code: input.code } });
  if (!promo || !promo.enabled) return { ok: false as const, error: "INVALID_CODE" };
  try {
    await prisma.promoRedemption.create({
      data: { promoId: promo.id, userId },
    });
  } catch {
    return { ok: true as const, already: true };
  }
  return { ok: true as const, already: false };
}

export async function persistUpgradeAttempt(input: {
  userId?: string;
  sourceInstanceIds: string[];
  extraUsd: number;
  chance: number;
  targetSkinId: string;
  success: boolean;
  item: InventoryItem | null;
}) {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const extra = usd(Math.max(0, input.extraUsd));
  let granted = false;

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.banned) throw new Error("USER_BANNED");
    if (extra > 0 && current.balanceUsd + 1e-9 < extra) throw new Error("INSUFFICIENT_BALANCE");
    const stakeUsd = await vaultStakeUsd(tx, user.id, input.sourceInstanceIds);
    const volumeUsd = usd(extra + stakeUsd);
    await consumeVaultItems(tx, user.id, input.sourceInstanceIds);
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
      granted = await grantVaultItem(tx, { userId: user.id, item: input.item, source: "UPGRADE" });
    }
  });

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
  userId?: string;
  sourceInstanceIds: string[];
  extraUsd?: number;
  item: InventoryItem;
}) {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  const extra = usd(Math.max(0, input.extraUsd ?? 0));
  let granted = false;

  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: user.id } });
    if (!current) throw new Error("USER_NOT_FOUND");
    if (current.banned) throw new Error("USER_BANNED");
    if (extra > 0 && current.balanceUsd + 1e-9 < extra) throw new Error("INSUFFICIENT_BALANCE");
    const stakeUsd = await vaultStakeUsd(tx, user.id, input.sourceInstanceIds);
    const volumeUsd = usd(extra + stakeUsd);
    await consumeVaultItems(tx, user.id, input.sourceInstanceIds);
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
    granted = await grantVaultItem(tx, { userId: user.id, item: input.item, source: "CONTRACT" });
  });

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
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function persistDepositCreate(input: {
  userId?: string;
  asset: string;
  network: string;
  amountUsd: number;
  txNote?: string;
}) {
  const user = await loadPlayUser(input.userId);
  assertPlayable(user);
  if (!isDepositAsset(input.asset)) throw new Error("INVALID_ASSET");
  const coin = getDepositCoin(input.asset);
  const network = coin ? getDepositNetwork(coin, input.network) : null;
  if (!coin || !network) throw new Error("INVALID_ASSET");
  const amountUsd = usd(input.amountUsd);
  if (!(amountUsd >= coin.minUsd)) throw new Error("AMOUNT_TOO_LOW");
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
    },
  });
  return serializeDeposit(row);
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
    const user = await tx.user.update({
      where: { id: row.userId },
      data: { balanceUsd: { increment: row.amountUsd } },
    });
    await tx.ledgerEntry.create({
      data: {
        userId: row.userId,
        kind: "DEPOSIT",
        amountUsd: usd(row.amountUsd),
        balanceAfter: usd(user.balanceUsd),
        note: `Crypto ${row.asset} ${row.network}`,
        meta: JSON.stringify({ depositId: row.id, asset: row.asset, network: row.network }),
      },
    });
    return user;
  });
  const updated = await db.update({
    where: { id: row.id },
    data: { status: "APPROVED", reviewedBy: input.reviewerId, reviewedAt: new Date() },
    include: { user: { select: { displayName: true } } },
  });
  void result;
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

export async function persistGiftCardRedeem(input: { code: string; userId?: string }) {
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
    user: { displayName: "NovaPrime" },
  };
}

export async function persistTradeUrl(input: { userId?: string; url: string }) {
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

export async function persistWithdrawalCreate(input: { userId?: string; amountUsd: number; note?: string }) {
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
  userId?: string;
  instanceId: string;
  tradeUrl?: string;
}) {
  const instanceId = input.instanceId.trim();
  if (!instanceId) throw new Error("INVALID_INPUT");
  const offered = normalizeTradeUrl(input.tradeUrl ?? "");
  if (offered && !looksLikeTradeUrl(offered)) throw new Error("TRADE_URL_INVALID");

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

