import { looksLikeTradeUrl, normalizeTradeUrl } from "@/lib/auth/account";
import { SKIN_MAP } from "@/data/skins";
import { DEMO_USER_ID, prisma } from "@/lib/db";
import { STARTING_INVENTORY_IDS } from "@/lib/mock-data";
import { ensurePlaySkins } from "@/lib/persist/game";

const DEMO_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=123456789&token=PrismLootDemo";

function isMissingColumn(err: unknown) {
  if (!err || typeof err !== "object" || !("code" in err)) return false;
  return (err as { code?: string }).code === "P2022";
}

/** Local SQLite can lag Prisma schema (avatarUrl). Never run this against Vercel/Postgres. */
async function ensureSqliteUserColumns() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^file:/i.test(url)) return;
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT NOT NULL DEFAULT ''`,
    );
  } catch {
    // Column already exists.
  }
}

export async function ensureDemoUser() {
  await ensureSqliteUserColumns();
  try {
    return await upsertDemoUser();
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    await ensureSqliteUserColumns();
    return upsertDemoUser();
  }
}

async function upsertDemoUser() {
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
  if (!looksLikeTradeUrl(existing)) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { tradeUrl: DEMO_TRADE_URL },
      });
    } catch (err) {
      console.warn("[withdraw] User.tradeUrl update via Prisma failed, using SQL", err);
      await prisma.$executeRaw`UPDATE User SET tradeUrl = ${DEMO_TRADE_URL} WHERE id = ${user.id}`;
    }
  }
  await ensureDemoVault(user.id);
  return { ...user, tradeUrl: looksLikeTradeUrl(existing) ? existing : DEMO_TRADE_URL };
}

/** Local preview only — fill an empty vault so /profile has a real item grid. */
async function ensureDemoVault(userId: string) {
  const live = await prisma.inventoryItem.count({ where: { userId, soldAt: null } });
  if (live > 0) return;

  const rows = STARTING_INVENTORY_IDS.filter((row) => SKIN_MAP[row.skinId]);
  if (!rows.length) return;

  await prisma.$transaction(async (tx) => {
    await ensurePlaySkins(
      tx,
      rows.map((row) => row.skinId),
    );
    await tx.inventoryItem.createMany({
      data: rows.map((row, index) => ({
        id: `local_demo_${index}_${row.skinId}`,
        userId,
        skinId: row.skinId,
        wear: row.wear,
        stattrak: row.stattrak,
        source: "PROMO",
        acquiredAt: new Date(Date.now() - index * 86_000_000),
      })),
    });
  });
}
