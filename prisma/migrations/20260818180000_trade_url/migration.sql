-- AlterTable
ALTER TABLE "User" ADD COLUMN "tradeUrl" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN "tradeUrl" TEXT NOT NULL DEFAULT '';
