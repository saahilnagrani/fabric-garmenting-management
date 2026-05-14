-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "fabric3Name" TEXT,
  ADD COLUMN "fabric3CostPerKg" DECIMAL(10,2),
  ADD COLUMN "assumedFabric3GarmentsPerKg" DECIMAL(10,2),
  ADD COLUMN "fabric3VendorId" TEXT,
  ADD COLUMN "fabric4Name" TEXT,
  ADD COLUMN "fabric4CostPerKg" DECIMAL(10,2),
  ADD COLUMN "assumedFabric4GarmentsPerKg" DECIMAL(10,2),
  ADD COLUMN "fabric4VendorId" TEXT,
  ADD COLUMN "cuttingReportGarmentsPerKg3" DECIMAL(10,2),
  ADD COLUMN "cuttingReportGarmentsPerKg4" DECIMAL(10,2),
  ADD COLUMN "fabric3OrderedQuantityKg" DECIMAL(10,2),
  ADD COLUMN "fabric3ShippedQuantityKg" DECIMAL(10,2),
  ADD COLUMN "fabric4OrderedQuantityKg" DECIMAL(10,2),
  ADD COLUMN "fabric4ShippedQuantityKg" DECIMAL(10,2);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_fabric3VendorId_fkey"
  FOREIGN KEY ("fabric3VendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD CONSTRAINT "Product_fabric4VendorId_fkey"
  FOREIGN KEY ("fabric4VendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Product_fabric3VendorId_idx" ON "Product"("fabric3VendorId");
CREATE INDEX "Product_fabric4VendorId_idx" ON "Product"("fabric4VendorId");
