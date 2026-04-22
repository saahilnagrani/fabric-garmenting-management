-- Migrate articleCodeUnits JSON data into ProductMasterAccessory join table
-- Each entry {code: skuCode, units: number} becomes a proper BOM row.
INSERT INTO "ProductMasterAccessory" ("id", "productMasterId", "accessoryId", "quantityPerPiece", "createdAt")
SELECT
  gen_random_uuid()::text,
  pm.id,
  am.id,
  (elem->>'units')::numeric,
  NOW()
FROM "AccessoryMaster" am
CROSS JOIN LATERAL jsonb_array_elements(am."articleCodeUnits"::jsonb) AS elem
JOIN "ProductMaster" pm ON pm."skuCode" = elem->>'code'
WHERE am."articleCodeUnits" IS NOT NULL
  AND am."articleCodeUnits"::text != '[]'
  AND am."articleCodeUnits"::text != 'null'
  AND (elem->>'units')::numeric > 0
ON CONFLICT ("productMasterId", "accessoryId") DO NOTHING;

-- Drop the denormalized column
ALTER TABLE "AccessoryMaster" DROP COLUMN "articleCodeUnits";
