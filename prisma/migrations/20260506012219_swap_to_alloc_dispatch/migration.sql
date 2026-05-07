-- AlterEnum
ALTER TYPE "AllocationStage" ADD VALUE 'PARTIALLY_AT_GARMENTER';
-- DropForeignKey
ALTER TABLE "AllocationReceipt" DROP CONSTRAINT "AllocationReceipt_allocationId_fkey";
-- DropForeignKey
ALTER TABLE "AllocationReceipt" DROP CONSTRAINT "AllocationReceipt_fabricReceiptId_fkey";
-- DropTable
DROP TABLE "AllocationReceipt";
-- CreateTable
CREATE TABLE "AllocationDispatch" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "garmenterDispatchId" TEXT NOT NULL,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllocationDispatch_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "AllocationDispatch_allocationId_idx" ON "AllocationDispatch"("allocationId");
-- CreateIndex
CREATE INDEX "AllocationDispatch_garmenterDispatchId_idx" ON "AllocationDispatch"("garmenterDispatchId");
-- AddForeignKey
ALTER TABLE "AllocationDispatch" ADD CONSTRAINT "AllocationDispatch_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AllocationDispatch" ADD CONSTRAINT "AllocationDispatch_garmenterDispatchId_fkey" FOREIGN KEY ("garmenterDispatchId") REFERENCES "GarmenterDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Normalize stale Allocation.stage values from the prior model.
-- Anything previously IN_OUR_HANDS / PARTIALLY_IN_HANDS (which model A used)
-- becomes AT_VENDOR again, since under model B nothing is in-hand-per-alloc
-- until a dispatch row exists.
UPDATE "Allocation"
SET stage = 'AT_VENDOR'
WHERE stage IN ('IN_OUR_HANDS', 'PARTIALLY_IN_HANDS');
