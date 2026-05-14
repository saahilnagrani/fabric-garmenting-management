-- AlterTable: add fabric slot 3 & 4 columns to PhaseFabric.
ALTER TABLE "PhaseFabric"
  ADD COLUMN "fabric3Name"      TEXT,
  ADD COLUMN "fabric3VendorId"  TEXT,
  ADD COLUMN "fabric3CostPerKg" DECIMAL(10,2),
  ADD COLUMN "garmentsPerKg3"   DECIMAL(10,2),
  ADD COLUMN "fabric4Name"      TEXT,
  ADD COLUMN "fabric4VendorId"  TEXT,
  ADD COLUMN "fabric4CostPerKg" DECIMAL(10,2),
  ADD COLUMN "garmentsPerKg4"   DECIMAL(10,2);
