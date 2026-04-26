-- ─────────────────────────────────────────────────────────────────
-- Rollback for Bundle 1 Phase A.
-- This drops the new FK columns, indexes, constraints, and join tables.
-- The original string columns are untouched, so the app reverts to pre-migration behaviour.
--
-- To run:
--   psql "$DATABASE_URL" < down.sql
-- And then mark the migration as rolled-back:
--   npx prisma migrate resolve --rolled-back 20260426060000_bundle1_add_lookup_fks
--
-- Optionally, to also remove auto-inserted master rows that didn't exist before,
-- restore from .backups/backup-<timestamp>-pre-bundle1.sql instead. Keeping the rows
-- is harmless because they're orphans without the FK columns.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE "AccessoryDispatch" DROP CONSTRAINT IF EXISTS "AccessoryDispatch_destinationGarmenterId_fkey";
ALTER TABLE "AccessoryMaster"   DROP CONSTRAINT IF EXISTS "AccessoryMaster_colourId_fkey";
ALTER TABLE "ProductMaster"     DROP CONSTRAINT IF EXISTS "ProductMaster_typeRefId_fkey";
ALTER TABLE "FabricBalance"     DROP CONSTRAINT IF EXISTS "FabricBalance_colourId_fkey";
ALTER TABLE "FabricBalance"     DROP CONSTRAINT IF EXISTS "FabricBalance_garmentingLocationId_fkey";
ALTER TABLE "FabricOrder"       DROP CONSTRAINT IF EXISTS "FabricOrder_colourId_fkey";
ALTER TABLE "FabricOrder"       DROP CONSTRAINT IF EXISTS "FabricOrder_availableColourId_fkey";
ALTER TABLE "FabricOrder"       DROP CONSTRAINT IF EXISTS "FabricOrder_garmentingAtId_fkey";
ALTER TABLE "Product"           DROP CONSTRAINT IF EXISTS "Product_colourOrderedId_fkey";
ALTER TABLE "Product"           DROP CONSTRAINT IF EXISTS "Product_typeRefId_fkey";
ALTER TABLE "Product"           DROP CONSTRAINT IF EXISTS "Product_garmentingAtId_fkey";

DROP TABLE IF EXISTS "FabricMasterColour";
DROP TABLE IF EXISTS "ProductMasterColour";

DROP INDEX IF EXISTS "AccessoryDispatch_destinationGarmenterId_idx";
DROP INDEX IF EXISTS "AccessoryMaster_colourId_idx";
DROP INDEX IF EXISTS "FabricBalance_colourId_idx";
DROP INDEX IF EXISTS "FabricBalance_garmentingLocationId_idx";
DROP INDEX IF EXISTS "FabricOrder_colourId_idx";
DROP INDEX IF EXISTS "FabricOrder_availableColourId_idx";
DROP INDEX IF EXISTS "FabricOrder_garmentingAtId_idx";
DROP INDEX IF EXISTS "Product_colourOrderedId_idx";
DROP INDEX IF EXISTS "Product_typeRefId_idx";
DROP INDEX IF EXISTS "Product_garmentingAtId_idx";
DROP INDEX IF EXISTS "ProductMaster_typeRefId_idx";

ALTER TABLE "AccessoryDispatch" DROP COLUMN IF EXISTS "destinationGarmenterId";
ALTER TABLE "AccessoryMaster"   DROP COLUMN IF EXISTS "colourId";
ALTER TABLE "FabricBalance"     DROP COLUMN IF EXISTS "colourId",
                                DROP COLUMN IF EXISTS "garmentingLocationId";
ALTER TABLE "FabricOrder"       DROP COLUMN IF EXISTS "colourId",
                                DROP COLUMN IF EXISTS "availableColourId",
                                DROP COLUMN IF EXISTS "garmentingAtId";
ALTER TABLE "Product"           DROP COLUMN IF EXISTS "colourOrderedId",
                                DROP COLUMN IF EXISTS "typeRefId",
                                DROP COLUMN IF EXISTS "garmentingAtId";
ALTER TABLE "ProductMaster"     DROP COLUMN IF EXISTS "typeRefId";
