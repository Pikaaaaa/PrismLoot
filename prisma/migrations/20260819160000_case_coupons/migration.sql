-- CreateTable
CREATE TABLE "CaseCoupon" (
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
    CONSTRAINT "CaseCoupon_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseCouponClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "remaining" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseCouponClaim_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "CaseCoupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseCouponClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseCoupon_code_key" ON "CaseCoupon"("code");

-- CreateIndex
CREATE INDEX "CaseCoupon_enabled_idx" ON "CaseCoupon"("enabled");

-- CreateIndex
CREATE INDEX "CaseCoupon_caseId_idx" ON "CaseCoupon"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseCouponClaim_couponId_userId_key" ON "CaseCouponClaim"("couponId", "userId");

-- CreateIndex
CREATE INDEX "CaseCouponClaim_userId_caseId_idx" ON "CaseCouponClaim"("userId", "caseId");
