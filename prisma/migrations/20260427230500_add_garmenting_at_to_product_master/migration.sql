-- Add garmentingAt (string) and garmentingAtId (FK to GarmentingLocation) to ProductMaster.
-- Additive only: nullable columns + index + FK constraint.

ALTER TABLE "ProductMaster"
  ADD COLUMN "garmentingAt" TEXT,
  ADD COLUMN "garmentingAtId" TEXT;

CREATE INDEX "ProductMaster_garmentingAtId_idx" ON "ProductMaster"("garmentingAtId");

ALTER TABLE "ProductMaster"
  ADD CONSTRAINT "ProductMaster_garmentingAtId_fkey"
  FOREIGN KEY ("garmentingAtId") REFERENCES "GarmentingLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
