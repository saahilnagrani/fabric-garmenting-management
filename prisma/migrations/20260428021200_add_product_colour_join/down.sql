-- Rollback for the ProductColour join migration.
-- Drops the new table, indexes, and constraints. Product.colourOrdered (string)
-- is unchanged, so the app reverts to pre-migration behaviour.
--
-- To roll back:
--   psql "$DATABASE_URL" < down.sql
--   npx prisma migrate resolve --rolled-back 20260428021200_add_product_colour_join

ALTER TABLE "ProductColour" DROP CONSTRAINT IF EXISTS "ProductColour_productId_fkey";
ALTER TABLE "ProductColour" DROP CONSTRAINT IF EXISTS "ProductColour_colourId_fkey";

DROP INDEX IF EXISTS "ProductColour_productId_idx";
DROP INDEX IF EXISTS "ProductColour_colourId_idx";

DROP TABLE IF EXISTS "ProductColour";
