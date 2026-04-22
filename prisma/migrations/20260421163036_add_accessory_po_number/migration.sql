-- AlterTable
ALTER TABLE "AccessoryPurchase" ADD COLUMN     "poNumber" TEXT;

-- CreateIndex
CREATE INDEX "AccessoryPurchase_poNumber_idx" ON "AccessoryPurchase"("poNumber");
