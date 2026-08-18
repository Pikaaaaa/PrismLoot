import { ensurePrisma, giftCardDelegate } from "@/lib/db";
import { prismaErrorCode } from "@/lib/persist/errors";

let ready: Promise<void> | null = null;

function isPostgres() {
  const url = process.env.DATABASE_URL ?? "";
  return /^postgres(ql)?:\/\//i.test(url) || process.env.VERCEL === "1";
}

export function isGiftCardSchemaError(err: unknown) {
  const code = prismaErrorCode(err);
  return code === "P2021" || code === "P2022";
}

function resetGiftCardSchema() {
  ready = null;
}

/**
 * Vercel `db push` can leave Neon without GiftCard / wagerMultiplier while the
 * generated client already expects them. Create the table on first use — no catalog seed.
 */
export function ensureGiftCardSchema() {
  ready ??= applyGiftCardSchema().catch((err) => {
    resetGiftCardSchema();
    throw err;
  });
  return ready;
}

export async function readyGiftCardDelegate() {
  await ensureGiftCardSchema();
  return giftCardDelegate();
}

async function applyGiftCardSchema() {
  const client = ensurePrisma();
  if (isPostgres()) {
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "GiftCard" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "amountUsd" DOUBLE PRECISION NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'UNUSED',
        "wagerMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 10,
        "createdBy" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3),
        "redeemedByUserId" TEXT,
        "redeemedAt" TIMESTAMP(3),
        "note" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
      )
    `;
    await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "GiftCard_code_key" ON "GiftCard"("code")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "GiftCard_status_idx" ON "GiftCard"("status")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "GiftCard_redeemedByUserId_idx" ON "GiftCard"("redeemedByUserId")`;
    await client.$executeRaw`
      ALTER TABLE "GiftCard" ADD COLUMN IF NOT EXISTS "wagerMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 10
    `;
    return;
  }

  await client.$executeRaw`
    CREATE TABLE IF NOT EXISTS "GiftCard" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "amountUsd" REAL NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'UNUSED',
      "wagerMultiplier" REAL NOT NULL DEFAULT 10,
      "createdBy" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME,
      "redeemedByUserId" TEXT,
      "redeemedAt" DATETIME,
      "note" TEXT NOT NULL DEFAULT '',
      FOREIGN KEY ("redeemedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `;
  await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "GiftCard_code_key" ON "GiftCard"("code")`;
  await client.$executeRaw`CREATE INDEX IF NOT EXISTS "GiftCard_status_idx" ON "GiftCard"("status")`;
  await client.$executeRaw`CREATE INDEX IF NOT EXISTS "GiftCard_redeemedByUserId_idx" ON "GiftCard"("redeemedByUserId")`;
  const cols = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("GiftCard")`);
  if (!cols.some((col) => col.name === "wagerMultiplier")) {
    await client.$executeRaw`ALTER TABLE "GiftCard" ADD COLUMN "wagerMultiplier" REAL NOT NULL DEFAULT 10`;
  }
}

export async function withGiftCardSchema<T>(run: () => Promise<T>): Promise<T> {
  await ensureGiftCardSchema();
  try {
    return await run();
  } catch (err) {
    if (!isGiftCardSchemaError(err)) throw err;
    console.error("[gift-cards] schema missing, retrying after CREATE TABLE", err);
    resetGiftCardSchema();
    await ensureGiftCardSchema();
    return run();
  }
}
