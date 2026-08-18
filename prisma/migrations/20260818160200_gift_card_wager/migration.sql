-- AlterTable
ALTER TABLE "User" ADD COLUMN "wagerRemainingUsd" REAL NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GiftCard" ADD COLUMN "wagerMultiplier" REAL NOT NULL DEFAULT 10;
