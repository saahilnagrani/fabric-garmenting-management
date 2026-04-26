-- ─────────────────────────────────────────────────────────────────
-- Bundle 1 Phase A: add nullable FK columns + join tables.
-- Backfill from existing string columns. Old strings stay (drop in Phase C).
-- All operations are additive: ALTER ADD COLUMN, CREATE TABLE, INSERT, UPDATE.
-- Paired rollback in down.sql.
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Schema additions ──────────────────────────────────────────

-- AlterTable
ALTER TABLE "AccessoryDispatch" ADD COLUMN     "destinationGarmenterId" TEXT;

-- AlterTable
ALTER TABLE "AccessoryMaster" ADD COLUMN     "colourId" TEXT;

-- AlterTable
ALTER TABLE "FabricBalance" ADD COLUMN     "colourId" TEXT,
ADD COLUMN     "garmentingLocationId" TEXT;

-- AlterTable
ALTER TABLE "FabricOrder" ADD COLUMN     "availableColourId" TEXT,
ADD COLUMN     "colourId" TEXT,
ADD COLUMN     "garmentingAtId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colourOrderedId" TEXT,
ADD COLUMN     "garmentingAtId" TEXT,
ADD COLUMN     "typeRefId" TEXT;

-- AlterTable
ALTER TABLE "ProductMaster" ADD COLUMN     "typeRefId" TEXT;

-- CreateTable
CREATE TABLE "FabricMasterColour" (
    "fabricMasterId" TEXT NOT NULL,
    "colourId" TEXT NOT NULL,

    CONSTRAINT "FabricMasterColour_pkey" PRIMARY KEY ("fabricMasterId","colourId")
);

-- CreateTable
CREATE TABLE "ProductMasterColour" (
    "productMasterId" TEXT NOT NULL,
    "colourId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "ProductMasterColour_pkey" PRIMARY KEY ("productMasterId","colourId","slot")
);

-- CreateIndex
CREATE INDEX "FabricMasterColour_colourId_idx" ON "FabricMasterColour"("colourId");
CREATE INDEX "ProductMasterColour_colourId_idx" ON "ProductMasterColour"("colourId");
CREATE INDEX "ProductMasterColour_productMasterId_idx" ON "ProductMasterColour"("productMasterId");
CREATE INDEX "AccessoryDispatch_destinationGarmenterId_idx" ON "AccessoryDispatch"("destinationGarmenterId");
CREATE INDEX "AccessoryMaster_colourId_idx" ON "AccessoryMaster"("colourId");
CREATE INDEX "FabricBalance_colourId_idx" ON "FabricBalance"("colourId");
CREATE INDEX "FabricBalance_garmentingLocationId_idx" ON "FabricBalance"("garmentingLocationId");
CREATE INDEX "FabricOrder_colourId_idx" ON "FabricOrder"("colourId");
CREATE INDEX "FabricOrder_availableColourId_idx" ON "FabricOrder"("availableColourId");
CREATE INDEX "FabricOrder_garmentingAtId_idx" ON "FabricOrder"("garmentingAtId");
CREATE INDEX "Product_colourOrderedId_idx" ON "Product"("colourOrderedId");
CREATE INDEX "Product_typeRefId_idx" ON "Product"("typeRefId");
CREATE INDEX "Product_garmentingAtId_idx" ON "Product"("garmentingAtId");
CREATE INDEX "ProductMaster_typeRefId_idx" ON "ProductMaster"("typeRefId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_colourOrderedId_fkey" FOREIGN KEY ("colourOrderedId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_typeRefId_fkey" FOREIGN KEY ("typeRefId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_garmentingAtId_fkey" FOREIGN KEY ("garmentingAtId") REFERENCES "GarmentingLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_availableColourId_fkey" FOREIGN KEY ("availableColourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_garmentingAtId_fkey" FOREIGN KEY ("garmentingAtId") REFERENCES "GarmentingLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricBalance" ADD CONSTRAINT "FabricBalance_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricBalance" ADD CONSTRAINT "FabricBalance_garmentingLocationId_fkey" FOREIGN KEY ("garmentingLocationId") REFERENCES "GarmentingLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FabricMasterColour" ADD CONSTRAINT "FabricMasterColour_fabricMasterId_fkey" FOREIGN KEY ("fabricMasterId") REFERENCES "FabricMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FabricMasterColour" ADD CONSTRAINT "FabricMasterColour_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMasterColour" ADD CONSTRAINT "ProductMasterColour_productMasterId_fkey" FOREIGN KEY ("productMasterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductMasterColour" ADD CONSTRAINT "ProductMasterColour_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductMaster" ADD CONSTRAINT "ProductMaster_typeRefId_fkey" FOREIGN KEY ("typeRefId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessoryMaster" ADD CONSTRAINT "AccessoryMaster_colourId_fkey" FOREIGN KEY ("colourId") REFERENCES "Colour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessoryDispatch" ADD CONSTRAINT "AccessoryDispatch_destinationGarmenterId_fkey" FOREIGN KEY ("destinationGarmenterId") REFERENCES "GarmentingLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 2. Backfill: ensure every distinct string in consumer columns has a master row ──

-- 2a. Colour master: insert any names not already in "Colour"
INSERT INTO "Colour" (id, name, code, "createdAt", "updatedAt")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || x.name), x.name, '', NOW(), NOW()
FROM (
  SELECT DISTINCT TRIM(unnest("coloursAvailable")) AS name FROM "FabricMaster"
  UNION SELECT DISTINCT TRIM("colour")             FROM "FabricOrder"   WHERE "colour"          IS NOT NULL AND TRIM("colour")          <> ''
  UNION SELECT DISTINCT TRIM("availableColour")    FROM "FabricOrder"   WHERE "availableColour" IS NOT NULL AND TRIM("availableColour") <> ''
  UNION SELECT DISTINCT TRIM("colourOrdered")      FROM "Product"       WHERE "colourOrdered"   IS NOT NULL AND TRIM("colourOrdered")   <> ''
  UNION SELECT DISTINCT TRIM("colour")             FROM "FabricBalance" WHERE "colour"          IS NOT NULL AND TRIM("colour")          <> ''
  UNION SELECT DISTINCT TRIM("colour")             FROM "AccessoryMaster" WHERE "colour"        IS NOT NULL AND TRIM("colour")          <> ''
  UNION SELECT DISTINCT TRIM(unnest("coloursAvailable"))  FROM "ProductMaster"
  UNION SELECT DISTINCT TRIM(unnest("colours2Available")) FROM "ProductMaster"
  UNION SELECT DISTINCT TRIM(unnest("colours3Available")) FROM "ProductMaster"
  UNION SELECT DISTINCT TRIM(unnest("colours4Available")) FROM "ProductMaster"
) x
WHERE x.name IS NOT NULL AND x.name <> ''
ON CONFLICT (name) DO NOTHING;

-- 2b. ProductType master
INSERT INTO "ProductType" (id, name, code, "createdAt", "updatedAt")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || x.name), x.name, '', NOW(), NOW()
FROM (
  SELECT DISTINCT TRIM("type") AS name FROM "Product"       WHERE "type" IS NOT NULL AND TRIM("type") <> ''
  UNION SELECT DISTINCT TRIM("type")    FROM "ProductMaster" WHERE "type" IS NOT NULL AND TRIM("type") <> ''
) x
WHERE x.name <> ''
ON CONFLICT (name) DO NOTHING;

-- 2c. GarmentingLocation master
INSERT INTO "GarmentingLocation" (id, name, "createdAt", "updatedAt")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || x.name), x.name, NOW(), NOW()
FROM (
  SELECT DISTINCT TRIM("garmentingAt") AS name FROM "Product"           WHERE "garmentingAt"         IS NOT NULL AND TRIM("garmentingAt")         <> ''
  UNION SELECT DISTINCT TRIM("garmentingAt")     FROM "FabricOrder"        WHERE "garmentingAt"         IS NOT NULL AND TRIM("garmentingAt")         <> ''
  UNION SELECT DISTINCT TRIM("destinationGarmenter") FROM "AccessoryDispatch" WHERE "destinationGarmenter" IS NOT NULL AND TRIM("destinationGarmenter") <> ''
  UNION SELECT DISTINCT TRIM("garmentingLocation")   FROM "FabricBalance"     WHERE "garmentingLocation"   IS NOT NULL AND TRIM("garmentingLocation")   <> ''
) x
WHERE x.name <> ''
ON CONFLICT (name) DO NOTHING;

-- ── 3. Populate scalar FK columns by joining to master.name ──

UPDATE "Product" p          SET "typeRefId"        = pt.id FROM "ProductType" pt          WHERE pt.name = TRIM(p."type") AND p."type" IS NOT NULL;
UPDATE "ProductMaster" pm   SET "typeRefId"        = pt.id FROM "ProductType" pt          WHERE pt.name = TRIM(pm."type") AND pm."type" IS NOT NULL;
UPDATE "Product" p          SET "colourOrderedId"  = c.id  FROM "Colour" c                WHERE c.name  = TRIM(p."colourOrdered") AND p."colourOrdered" IS NOT NULL;
UPDATE "FabricOrder" fo     SET "colourId"         = c.id  FROM "Colour" c                WHERE c.name  = TRIM(fo."colour") AND fo."colour" IS NOT NULL;
UPDATE "FabricOrder" fo     SET "availableColourId"= c.id  FROM "Colour" c                WHERE fo."availableColour" IS NOT NULL AND c.name = TRIM(fo."availableColour");
UPDATE "FabricBalance" fb   SET "colourId"         = c.id  FROM "Colour" c                WHERE c.name  = TRIM(fb."colour") AND fb."colour" IS NOT NULL;
UPDATE "AccessoryMaster" am SET "colourId"         = c.id  FROM "Colour" c                WHERE am."colour" IS NOT NULL AND c.name = TRIM(am."colour");

UPDATE "Product" p           SET "garmentingAtId"          = g.id FROM "GarmentingLocation" g WHERE p."garmentingAt"         IS NOT NULL AND g.name = TRIM(p."garmentingAt");
UPDATE "FabricOrder" fo      SET "garmentingAtId"          = g.id FROM "GarmentingLocation" g WHERE fo."garmentingAt"        IS NOT NULL AND g.name = TRIM(fo."garmentingAt");
UPDATE "AccessoryDispatch" ad SET "destinationGarmenterId" = g.id FROM "GarmentingLocation" g WHERE ad."destinationGarmenter" IS NOT NULL AND g.name = TRIM(ad."destinationGarmenter");
UPDATE "FabricBalance" fb    SET "garmentingLocationId"    = g.id FROM "GarmentingLocation" g WHERE fb."garmentingLocation"  IS NOT NULL AND g.name = TRIM(fb."garmentingLocation");

-- ── 4. Populate join tables for array columns ──

INSERT INTO "FabricMasterColour" ("fabricMasterId", "colourId")
SELECT fm.id, c.id
FROM "FabricMaster" fm
CROSS JOIN LATERAL unnest(fm."coloursAvailable") AS arr(name)
JOIN "Colour" c ON c.name = TRIM(arr.name)
WHERE arr.name IS NOT NULL AND TRIM(arr.name) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "ProductMasterColour" ("productMasterId", "colourId", "slot")
SELECT pm.id, c.id, arr.slot
FROM "ProductMaster" pm
CROSS JOIN LATERAL (
  SELECT 1 AS slot, unnest(pm."coloursAvailable")  AS name UNION ALL
  SELECT 2,         unnest(pm."colours2Available") UNION ALL
  SELECT 3,         unnest(pm."colours3Available") UNION ALL
  SELECT 4,         unnest(pm."colours4Available")
) arr
JOIN "Colour" c ON c.name = TRIM(arr.name)
WHERE arr.name IS NOT NULL AND TRIM(arr.name) <> ''
ON CONFLICT DO NOTHING;

-- ── 5. Sanity report. All counts should be 0; non-zero means a string failed to match a master row.
DO $$
DECLARE
  unmatched_product_type INT;
  unmatched_product_master_type INT;
  unmatched_product_colour INT;
  unmatched_fo_colour INT;
  unmatched_fo_avail INT;
  unmatched_fb_colour INT;
  unmatched_am_colour INT;
  unmatched_product_garmenting INT;
  unmatched_fo_garmenting INT;
  unmatched_ad_garmenting INT;
  unmatched_fb_garmenting INT;
BEGIN
  SELECT COUNT(*) INTO unmatched_product_type        FROM "Product"           WHERE "type"         IS NOT NULL AND TRIM("type")         <> '' AND "typeRefId"           IS NULL;
  SELECT COUNT(*) INTO unmatched_product_master_type FROM "ProductMaster"     WHERE "type"         IS NOT NULL AND TRIM("type")         <> '' AND "typeRefId"           IS NULL;
  SELECT COUNT(*) INTO unmatched_product_colour      FROM "Product"           WHERE "colourOrdered"IS NOT NULL AND TRIM("colourOrdered")<> '' AND "colourOrderedId"     IS NULL;
  SELECT COUNT(*) INTO unmatched_fo_colour            FROM "FabricOrder"       WHERE "colour"       IS NOT NULL AND TRIM("colour")       <> '' AND "colourId"            IS NULL;
  SELECT COUNT(*) INTO unmatched_fo_avail             FROM "FabricOrder"       WHERE "availableColour" IS NOT NULL AND TRIM("availableColour") <> '' AND "availableColourId" IS NULL;
  SELECT COUNT(*) INTO unmatched_fb_colour            FROM "FabricBalance"     WHERE "colour"       IS NOT NULL AND TRIM("colour")       <> '' AND "colourId"            IS NULL;
  SELECT COUNT(*) INTO unmatched_am_colour            FROM "AccessoryMaster"   WHERE "colour"       IS NOT NULL AND TRIM("colour")       <> '' AND "colourId"            IS NULL;
  SELECT COUNT(*) INTO unmatched_product_garmenting   FROM "Product"           WHERE "garmentingAt" IS NOT NULL AND TRIM("garmentingAt") <> '' AND "garmentingAtId"      IS NULL;
  SELECT COUNT(*) INTO unmatched_fo_garmenting        FROM "FabricOrder"       WHERE "garmentingAt" IS NOT NULL AND TRIM("garmentingAt") <> '' AND "garmentingAtId"      IS NULL;
  SELECT COUNT(*) INTO unmatched_ad_garmenting        FROM "AccessoryDispatch" WHERE "destinationGarmenter" IS NOT NULL AND TRIM("destinationGarmenter") <> '' AND "destinationGarmenterId" IS NULL;
  SELECT COUNT(*) INTO unmatched_fb_garmenting        FROM "FabricBalance"     WHERE "garmentingLocation"   IS NOT NULL AND TRIM("garmentingLocation")   <> '' AND "garmentingLocationId"   IS NULL;

  RAISE NOTICE 'Unmatched FK backfills (all should be 0):';
  RAISE NOTICE '  Product.typeRefId             unmatched: %', unmatched_product_type;
  RAISE NOTICE '  ProductMaster.typeRefId       unmatched: %', unmatched_product_master_type;
  RAISE NOTICE '  Product.colourOrderedId       unmatched: %', unmatched_product_colour;
  RAISE NOTICE '  FabricOrder.colourId          unmatched: %', unmatched_fo_colour;
  RAISE NOTICE '  FabricOrder.availableColourId unmatched: %', unmatched_fo_avail;
  RAISE NOTICE '  FabricBalance.colourId        unmatched: %', unmatched_fb_colour;
  RAISE NOTICE '  AccessoryMaster.colourId      unmatched: %', unmatched_am_colour;
  RAISE NOTICE '  Product.garmentingAtId        unmatched: %', unmatched_product_garmenting;
  RAISE NOTICE '  FabricOrder.garmentingAtId    unmatched: %', unmatched_fo_garmenting;
  RAISE NOTICE '  AccessoryDispatch.destinationGarmenterId unmatched: %', unmatched_ad_garmenting;
  RAISE NOTICE '  FabricBalance.garmentingLocationId unmatched: %', unmatched_fb_garmenting;
END $$;
