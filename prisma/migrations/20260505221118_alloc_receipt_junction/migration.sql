-- AlterEnum
ALTER TYPE "AllocationStage" ADD VALUE 'PARTIALLY_IN_HANDS';
-- CreateTable
CREATE TABLE "AllocationReceipt" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "fabricReceiptId" TEXT NOT NULL,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllocationReceipt_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "AllocationReceipt_allocationId_idx" ON "AllocationReceipt"("allocationId");
-- CreateIndex
CREATE INDEX "AllocationReceipt_fabricReceiptId_idx" ON "AllocationReceipt"("fabricReceiptId");
-- AddForeignKey
ALTER TABLE "AllocationReceipt" ADD CONSTRAINT "AllocationReceipt_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AllocationReceipt" ADD CONSTRAINT "AllocationReceipt_fabricReceiptId_fkey" FOREIGN KEY ("fabricReceiptId") REFERENCES "FabricReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
