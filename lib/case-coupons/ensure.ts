import { ensurePrisma } from "@/lib/db";
import { prismaErrorCode } from "@/lib/persist/errors";

let ready: Promise<void> | null = null;

export function isPostgres() {
  const url = process.env.DATABASE_URL ?? "";
  return /^postgres(ql)?:\/\//i.test(url) || process.env.VERCEL === "1";
}

export function isCaseCouponSchemaError(err: unknown) {
  const code = prismaErrorCode(err);
  return code === "P2021" || code === "P2022";
}

function resetCaseCouponSchema() {
  ready = null;
}

/**
 * Vercel `db push` can leave Neon without CaseCoupon while the app already
 * expects it. Create tables on first use — no catalog seed.
 */
export function ensureCaseCouponSchema() {
  ready ??= applyCaseCouponSchema().catch((err) => {
    resetCaseCouponSchema();
    throw err;
  });
  return ready;
}

async function applyCaseCouponSchema() {
  const client = ensurePrisma();
  if (isPostgres()) {
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CaseCoupon" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "caseId" TEXT NOT NULL,
        "maxUses" INTEGER NOT NULL DEFAULT 1,
        "remaining" INTEGER NOT NULL DEFAULT 1,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "opensPerRedeem" INTEGER NOT NULL DEFAULT 1,
        "expiresAt" TIMESTAMP(3),
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "createdBy" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "note" TEXT NOT NULL DEFAULT '',
        CONSTRAINT "CaseCoupon_pkey" PRIMARY KEY ("id")
      )
    `;
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "CaseCouponClaim" (
        "id" TEXT NOT NULL,
        "couponId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "caseId" TEXT NOT NULL,
        "remaining" INTEGER NOT NULL DEFAULT 1,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CaseCouponClaim_pkey" PRIMARY KEY ("id")
      )
    `;
    await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "CaseCoupon_code_key" ON "CaseCoupon"("code")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCoupon_enabled_idx" ON "CaseCoupon"("enabled")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCoupon_caseId_idx" ON "CaseCoupon"("caseId")`;
    await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "CaseCouponClaim_couponId_userId_key" ON "CaseCouponClaim"("couponId", "userId")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCouponClaim_userId_caseId_idx" ON "CaseCouponClaim"("userId", "caseId")`;
    return;
  }

  await client.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CaseCoupon" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "code" TEXT NOT NULL,
      "caseId" TEXT NOT NULL,
      "maxUses" INTEGER NOT NULL DEFAULT 1,
      "remaining" INTEGER NOT NULL DEFAULT 1,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "opensPerRedeem" INTEGER NOT NULL DEFAULT 1,
      "expiresAt" DATETIME,
      "enabled" BOOLEAN NOT NULL DEFAULT 1,
      "createdBy" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "note" TEXT NOT NULL DEFAULT '',
      FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )
  `;
  await client.$executeRaw`
    CREATE TABLE IF NOT EXISTS "CaseCouponClaim" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "couponId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "caseId" TEXT NOT NULL,
      "remaining" INTEGER NOT NULL DEFAULT 1,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("couponId") REFERENCES "CaseCoupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `;
  await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "CaseCoupon_code_key" ON "CaseCoupon"("code")`;
  await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCoupon_enabled_idx" ON "CaseCoupon"("enabled")`;
  await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCoupon_caseId_idx" ON "CaseCoupon"("caseId")`;
  await client.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "CaseCouponClaim_couponId_userId_key" ON "CaseCouponClaim"("couponId", "userId")`;
  await client.$executeRaw`CREATE INDEX IF NOT EXISTS "CaseCouponClaim_userId_caseId_idx" ON "CaseCouponClaim"("userId", "caseId")`;
}

export async function withCaseCouponSchema<T>(run: () => Promise<T>): Promise<T> {
  await ensureCaseCouponSchema();
  try {
    return await run();
  } catch (err) {
    if (!isCaseCouponSchemaError(err)) throw err;
    console.error("[case-coupons] schema missing, retrying after CREATE TABLE", err);
    resetCaseCouponSchema();
    await ensureCaseCouponSchema();
    return run();
  }
}
