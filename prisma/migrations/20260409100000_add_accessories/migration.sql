-- CreateEnum
CREATE TYPE "AccessoryUnit" AS ENUM ('PIECES', 'METERS', 'KG', 'GRAMS', 'ROLLS', 'PACKS');

-- CreateTable
CREATE TABLE "AccessoryMaster" (
    "id" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "colour" TEXT,
    "size" TEXT,
    "category" TEXT NOT NULL,
    "unit" "AccessoryUnit" NOT NULL,
    "vendorId" TEXT,
    "defaultCostPerUnit" DECIMAL(10,2),
    "hsnCode" TEXT,
    "comments" TEXT,
    "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryPurchase" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "vendorId" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "costPerUnit" DECIMAL(10,2),
    "invoiceNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "comments" TEXT,
    "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryDispatch" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "destinationGarmenter" TEXT,
    "productId" TEXT,
    "dispatchDate" TIMESTAMP(3),
    "comments" TEXT,
    "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessoryDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMasterAccessory" (
    "id" TEXT NOT NULL,
    "productMasterId" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "quantityPerPiece" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMasterAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessoryMaster_baseName_colour_size_key" ON "AccessoryMaster"("baseName", "colour", "size");

-- CreateIndex
CREATE INDEX "AccessoryMaster_category_idx" ON "AccessoryMaster"("category");

-- CreateIndex
CREATE INDEX "AccessoryMaster_vendorId_idx" ON "AccessoryMaster"("vendorId");

-- CreateIndex
CREATE INDEX "AccessoryPurchase_phaseId_idx" ON "AccessoryPurchase"("phaseId");

-- CreateIndex
CREATE INDEX "AccessoryPurchase_accessoryId_idx" ON "AccessoryPurchase"("accessoryId");

-- CreateIndex
CREATE INDEX "AccessoryPurchase_vendorId_idx" ON "AccessoryPurchase"("vendorId");

-- CreateIndex
CREATE INDEX "AccessoryDispatch_phaseId_idx" ON "AccessoryDispatch"("phaseId");

-- CreateIndex
CREATE INDEX "AccessoryDispatch_accessoryId_idx" ON "AccessoryDispatch"("accessoryId");

-- CreateIndex
CREATE INDEX "AccessoryDispatch_productId_idx" ON "AccessoryDispatch"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMasterAccessory_productMasterId_accessoryId_key" ON "ProductMasterAccessory"("productMasterId", "accessoryId");

-- CreateIndex
CREATE INDEX "ProductMasterAccessory_productMasterId_idx" ON "ProductMasterAccessory"("productMasterId");

-- CreateIndex
CREATE INDEX "ProductMasterAccessory_accessoryId_idx" ON "ProductMasterAccessory"("accessoryId");

-- AddForeignKey
ALTER TABLE "AccessoryMaster" ADD CONSTRAINT "AccessoryMaster_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryPurchase" ADD CONSTRAINT "AccessoryPurchase_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryPurchase" ADD CONSTRAINT "AccessoryPurchase_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "AccessoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryPurchase" ADD CONSTRAINT "AccessoryPurchase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDispatch" ADD CONSTRAINT "AccessoryDispatch_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDispatch" ADD CONSTRAINT "AccessoryDispatch_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "AccessoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryDispatch" ADD CONSTRAINT "AccessoryDispatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterAccessory" ADD CONSTRAINT "ProductMasterAccessory_productMasterId_fkey" FOREIGN KEY ("productMasterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterAccessory" ADD CONSTRAINT "ProductMasterAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "AccessoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
