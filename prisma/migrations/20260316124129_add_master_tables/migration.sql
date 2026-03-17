-- CreateTable
CREATE TABLE "FabricMaster" (
    "id" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "genders" TEXT[],
    "styleNumbers" TEXT[],
    "coloursAvailable" TEXT[],
    "mrp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMaster" (
    "id" TEXT NOT NULL,
    "styleNumber" TEXT NOT NULL,
    "skuCode" TEXT,
    "fabricName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "productName" TEXT,
    "coloursAvailable" TEXT[],
    "colours2Available" TEXT[],
    "garmentsPerKg" DECIMAL(10,2),
    "garmentsPerKg2" DECIMAL(10,2),
    "stitchingCost" DECIMAL(10,2),
    "brandLogoCost" DECIMAL(10,2),
    "neckTwillCost" DECIMAL(10,2),
    "reflectorsCost" DECIMAL(10,2),
    "fusingCost" DECIMAL(10,2),
    "accessoriesCost" DECIMAL(10,2),
    "brandTagCost" DECIMAL(10,2),
    "sizeTagCost" DECIMAL(10,2),
    "packagingCost" DECIMAL(10,2),
    "fabricCostPerKg" DECIMAL(10,2),
    "fabric2CostPerKg" DECIMAL(10,2),
    "inwardShipping" DECIMAL(10,2),
    "proposedMrp" DECIMAL(10,2),
    "onlineMrp" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FabricMaster_fabricName_key" ON "FabricMaster"("fabricName");

-- CreateIndex
CREATE INDEX "FabricMaster_vendorId_idx" ON "FabricMaster"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMaster_styleNumber_key" ON "ProductMaster"("styleNumber");

-- CreateIndex
CREATE INDEX "ProductMaster_styleNumber_idx" ON "ProductMaster"("styleNumber");

-- AddForeignKey
ALTER TABLE "FabricMaster" ADD CONSTRAINT "FabricMaster_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
