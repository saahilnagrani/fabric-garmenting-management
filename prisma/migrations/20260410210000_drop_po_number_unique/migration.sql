-- Multiple FabricOrder rows from one vendor batch intentionally share the same
-- PO number (one printed PO, several line items). Drop the unique constraint
-- added in the state-machine refactor and keep a regular index for lookups.

DROP INDEX IF EXISTS "FabricOrder_poNumber_key";
CREATE INDEX "FabricOrder_poNumber_idx" ON "FabricOrder"("poNumber");
