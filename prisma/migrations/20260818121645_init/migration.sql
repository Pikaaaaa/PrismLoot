-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "steamId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "balanceUsd" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "role" TEXT NOT NULL DEFAULT 'USER',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Skin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weapon" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "wear" TEXT NOT NULL,
    "image" TEXT,
    "collection" TEXT,
    "priceUsd" REAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "colors" TEXT NOT NULL DEFAULT '[]',
    "availableWears" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceUsd" REAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rtp" REAL NOT NULL,
    "houseEdge" REAL NOT NULL,
    "rtpPreset" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "accent" TEXT NOT NULL DEFAULT '#2fddb0',
    "accent2" TEXT NOT NULL DEFAULT '#a78bfa',
    "blurb" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "thumbnail" TEXT,
    "animationType" TEXT NOT NULL DEFAULT 'roulette',
    "featuredReward" TEXT NOT NULL DEFAULT '',
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CaseReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "chance" REAL NOT NULL,
    "weight" REAL NOT NULL DEFAULT 0,
    "value" REAL NOT NULL DEFAULT 0,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    CONSTRAINT "CaseReward_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseReward_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "Skin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "wear" TEXT NOT NULL,
    "stattrak" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "soldAt" DATETIME,
    "salePriceUsd" REAL,
    "caseOpenId" TEXT,
    CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "Skin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_caseOpenId_fkey" FOREIGN KEY ("caseOpenId") REFERENCES "CaseOpen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BestDrop" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wear" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "weapon" TEXT NOT NULL,
    "image" TEXT,
    "priceUsd" REAL NOT NULL,
    "obtainedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    CONSTRAINT "BestDrop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestDrop_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseOpen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "skinId" TEXT NOT NULL,
    "costUsd" REAL NOT NULL,
    "payoutUsd" REAL NOT NULL,
    "wear" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaseOpen_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CaseOpen_skinId_fkey" FOREIGN KEY ("skinId") REFERENCES "Skin" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UpgradeAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inputIds" TEXT NOT NULL,
    "targetSkinId" TEXT NOT NULL,
    "chance" REAL NOT NULL,
    "extraUsd" REAL NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL,
    "resultSkinId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UpgradeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inputIds" TEXT NOT NULL,
    "resultSkinId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "percentBonus" INTEGER NOT NULL DEFAULT 20,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRedemptions" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PromoRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRedemption_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "PromoCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT '',
    "targetId" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE INDEX "CaseReward_caseId_idx" ON "CaseReward"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseReward_caseId_skinId_key" ON "CaseReward"("caseId", "skinId");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_soldAt_idx" ON "InventoryItem"("userId", "soldAt");

-- CreateIndex
CREATE INDEX "InventoryItem_skinId_idx" ON "InventoryItem"("skinId");

-- CreateIndex
CREATE UNIQUE INDEX "BestDrop_inventoryItemId_key" ON "BestDrop"("inventoryItemId");

-- CreateIndex
CREATE INDEX "CaseOpen_createdAt_idx" ON "CaseOpen"("createdAt");

-- CreateIndex
CREATE INDEX "CaseOpen_userId_idx" ON "CaseOpen"("userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UpgradeAttempt_userId_idx" ON "UpgradeAttempt"("userId");

-- CreateIndex
CREATE INDEX "ContractAttempt_userId_idx" ON "ContractAttempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PromoRedemption_promoId_userId_key" ON "PromoRedemption"("promoId", "userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
