-- CreateEnum
CREATE TYPE "AllocationStage" AS ENUM ('AT_VENDOR', 'IN_OUR_HANDS', 'AT_GARMENTER');

-- AlterTable
ALTER TABLE "Phase" ADD COLUMN     "isTestPhase" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FabricReceipt" (
    "id" TEXT NOT NULL,
    "fabricOrderId" TEXT NOT NULL,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lotRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarmenterDispatch" (
    "id" TEXT NOT NULL,
    "fabricOrderId" TEXT NOT NULL,
    "garmenterId" TEXT NOT NULL,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarmenterDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "fabricOrderId" TEXT NOT NULL,
    "garmenterId" TEXT,
    "qtyKg" DECIMAL(10,2) NOT NULL,
    "stage" "AllocationStage" NOT NULL DEFAULT 'AT_VENDOR',
    "consumedKg" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isReservation" BOOLEAN NOT NULL DEFAULT false,
    "reservationPurpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FabricReceipt_fabricOrderId_idx" ON "FabricReceipt"("fabricOrderId");

-- CreateIndex
CREATE INDEX "GarmenterDispatch_fabricOrderId_idx" ON "GarmenterDispatch"("fabricOrderId");

-- CreateIndex
CREATE INDEX "GarmenterDispatch_garmenterId_idx" ON "GarmenterDispatch"("garmenterId");

-- CreateIndex
CREATE INDEX "Allocation_fabricOrderId_idx" ON "Allocation"("fabricOrderId");

-- CreateIndex
CREATE INDEX "Allocation_productId_idx" ON "Allocation"("productId");

-- CreateIndex
CREATE INDEX "Allocation_garmenterId_idx" ON "Allocation"("garmenterId");

-- AddForeignKey
ALTER TABLE "FabricReceipt" ADD CONSTRAINT "FabricReceipt_fabricOrderId_fkey" FOREIGN KEY ("fabricOrderId") REFERENCES "FabricOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmenterDispatch" ADD CONSTRAINT "GarmenterDispatch_fabricOrderId_fkey" FOREIGN KEY ("fabricOrderId") REFERENCES "FabricOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GarmenterDispatch" ADD CONSTRAINT "GarmenterDispatch_garmenterId_fkey" FOREIGN KEY ("garmenterId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_fabricOrderId_fkey" FOREIGN KEY ("fabricOrderId") REFERENCES "FabricOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_garmenterId_fkey" FOREIGN KEY ("garmenterId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

