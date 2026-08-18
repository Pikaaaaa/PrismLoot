-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "Withdrawal" ADD COLUMN "inventoryItemId" TEXT;
ALTER TABLE "Withdrawal" ADD COLUMN "itemName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Withdrawal_kind_status_idx" ON "Withdrawal"("kind", "status");
CREATE INDEX "Withdrawal_inventoryItemId_idx" ON "Withdrawal"("inventoryItemId");
