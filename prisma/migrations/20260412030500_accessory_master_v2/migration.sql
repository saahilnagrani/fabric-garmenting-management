-- ─── AccessoryMaster v2 ─────────────────────────────────────────
-- 1. Add new columns (displayName, attributes, priceTiers, vendorPageRef)
-- 2. Relax baseName NOT NULL so new code doesn't need to populate it
-- 3. Drop the old (baseName, colour, size) unique index
-- 4. Backfill displayName + attributes from the legacy columns
-- 5. Make displayName NOT NULL now that every row has one
-- 6. Add displayName index
-- 7. Seed the 18 reflector SKUs from the client's vendor sheet
-- 8. Fix poNumber index naming inherited from the earlier raw migration
--    (rename *_idx if it exists so Prisma's introspection stays in sync).

-- Step 1 + 2
ALTER TABLE "AccessoryMaster"
  ADD COLUMN "displayName"   TEXT,
  ADD COLUMN "attributes"    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "priceTiers"    JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "vendorPageRef" TEXT,
  ALTER COLUMN "baseName" DROP NOT NULL;

-- Step 3
DROP INDEX IF EXISTS "AccessoryMaster_baseName_colour_size_key";

-- Step 4: backfill from legacy columns
UPDATE "AccessoryMaster"
SET
  "displayName" = TRIM(BOTH ' / ' FROM
    COALESCE("baseName", '') ||
    COALESCE(' / ' || "colour", '') ||
    COALESCE(' / ' || "size", '')
  ),
  "attributes" = jsonb_strip_nulls(jsonb_build_object(
    'baseName', "baseName",
    'colour',   "colour",
    'size',     "size"
  ))
WHERE "displayName" IS NULL;

-- Step 5
ALTER TABLE "AccessoryMaster" ALTER COLUMN "displayName" SET NOT NULL;

-- Step 6
CREATE INDEX IF NOT EXISTS "AccessoryMaster_displayName_idx" ON "AccessoryMaster"("displayName");

-- Step 7: seed the 18 reflector SKUs from the vendor sheet attached by the
-- client. All assigned to KS Art & Craft (only accessory vendor in the DB).
-- Tier is labelled "5000–10000 pcs" on the sheet, so rate applies there.
-- Unit is PIECES since the BOM is per-garment. If/when you start buying
-- in rolls and converting, change the unit on specific rows.
DO $$
DECLARE
  vendor_id TEXT;
BEGIN
  SELECT id INTO vendor_id FROM "Vendor" WHERE type = 'ACCESSORIES' ORDER BY name LIMIT 1;

  -- Only seed if the vendor exists and no reflectors are already present.
  IF vendor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "AccessoryMaster" WHERE category = 'REFLECTOR') THEN

    INSERT INTO "AccessoryMaster" (
      id, "displayName", category, attributes, "priceTiers", "vendorPageRef",
      unit, "vendorId", "defaultCostPerUnit", "isStrikedThrough",
      "createdAt", "updatedAt"
    ) VALUES
      -- Page 1
      (gen_random_uuid()::text, 'Reflector · Logo',                 'REFLECTOR',
        '{"variant":"Logo","shape":"Logo"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":1.95}]'::jsonb,
        'Page 1, Item 1', 'PIECES', vendor_id, 1.95, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Style 2/12',           'REFLECTOR',
        '{"designRef":"2/12","variant":"Style"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":25}]'::jsonb,
        'Page 1, Item 2', 'PIECES', vendor_id, 25, false, NOW(), NOW()),

      -- Page 2: no-design variants keyed by page item number
      (gen_random_uuid()::text, 'Reflector · 6 inch',               'REFLECTOR',
        '{"designRef":"#1","widthInches":6}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":4.60}]'::jsonb,
        'Page 2, Item 1', 'PIECES', vendor_id, 4.60, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 1 inch',               'REFLECTOR',
        '{"designRef":"#2","widthInches":1}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":1.95}]'::jsonb,
        'Page 2, Item 2', 'PIECES', vendor_id, 1.95, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 4 inch',               'REFLECTOR',
        '{"designRef":"#3","widthInches":4}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":4.40}]'::jsonb,
        'Page 2, Item 3', 'PIECES', vendor_id, 4.40, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 4 inch · 6m',          'REFLECTOR',
        '{"designRef":"#4","widthInches":4,"lengthM":6}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.80}]'::jsonb,
        'Page 2, Item 4', 'PIECES', vendor_id, 3.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 4 inch · 4mm',         'REFLECTOR',
        '{"designRef":"#5","widthInches":4,"thicknessMm":4}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.60}]'::jsonb,
        'Page 2, Item 5', 'PIECES', vendor_id, 3.60, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 5mm width',            'REFLECTOR',
        '{"designRef":"#6","widthMm":5}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.60}]'::jsonb,
        'Page 2, Item 6', 'PIECES', vendor_id, 3.60, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 6mm width',            'REFLECTOR',
        '{"designRef":"#7","widthMm":6}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.80}]'::jsonb,
        'Page 2, Item 7', 'PIECES', vendor_id, 3.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 6mm Cross',            'REFLECTOR',
        '{"designRef":"#8","widthMm":6,"shape":"Cross"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":4.00}]'::jsonb,
        'Page 2, Item 8', 'PIECES', vendor_id, 4.00, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 1.25 inch width',      'REFLECTOR',
        '{"designRef":"#9","widthInches":1.25}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":6.20}]'::jsonb,
        'Page 2, Item 9', 'PIECES', vendor_id, 6.20, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 2.5 inch',             'REFLECTOR',
        '{"designRef":"#10","widthInches":2.5,"comments":"2.5 inch possible"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.60}]'::jsonb,
        'Page 2, Item 10', 'PIECES', vendor_id, 3.60, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Round dot',            'REFLECTOR',
        '{"designRef":"#11","shape":"Round dot"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":1.80}]'::jsonb,
        'Page 2, Item 11', 'PIECES', vendor_id, 1.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Moving DTF',           'REFLECTOR',
        '{"designRef":"#12","finish":"DTF","variant":"Moving"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":12}]'::jsonb,
        'Page 2, Item 12', 'PIECES', vendor_id, 12, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Neon Dot Arrow',       'REFLECTOR',
        '{"designRef":"#13","finish":"Neon","shape":"Dot Arrow"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.80}]'::jsonb,
        'Page 2, Item 13', 'PIECES', vendor_id, 3.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Box Dot',              'REFLECTOR',
        '{"designRef":"#14","shape":"Box Dot"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":7.80}]'::jsonb,
        'Page 2, Item 14', 'PIECES', vendor_id, 7.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · 5 inch · 6m',          'REFLECTOR',
        '{"designRef":"#15","widthInches":5,"lengthM":6}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":3.80}]'::jsonb,
        'Page 2, Item 15', 'PIECES', vendor_id, 3.80, false, NOW(), NOW()),

      (gen_random_uuid()::text, 'Reflector · Football',             'REFLECTOR',
        '{"designRef":"#16","shape":"Football","comments":"common price"}'::jsonb,
        '[{"minQty":5000,"maxQty":10000,"rate":15}]'::jsonb,
        'Page 2, Item 16', 'PIECES', vendor_id, 15, false, NOW(), NOW());

  END IF;
END $$;

-- Step 8: rename the poNumber index added via raw migration to match
-- Prisma's naming convention so future diffs are clean.
ALTER INDEX IF EXISTS "FabricOrder_poNumber_idx" RENAME TO "FabricOrder_poNumber_idx_old";
CREATE INDEX IF NOT EXISTS "FabricOrder_poNumber_idx" ON "FabricOrder"("poNumber");
DROP INDEX IF EXISTS "FabricOrder_poNumber_idx_old";
