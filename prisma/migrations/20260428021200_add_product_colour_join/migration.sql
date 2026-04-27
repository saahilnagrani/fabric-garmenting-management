-- ─────────────────────────────────────────────────────────────────
-- ProductColour join table: per-slot colour links for multi-colour products.
-- Bundle 1 extension. The ProductMasterColour pattern, applied to Product.
-- Backfill splits Product.colourOrdered on "/" and inserts one row per slot.
-- ─────────────────────────────────────────────────────────────────

-- 1. Schema additions
CREATE TABLE "ProductColour" (
    "productId" TEXT NOT NULL,
    "colourId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    CONSTRAINT "ProductColour_pkey" PRIMARY KEY ("productId","colourId","slot")
);

CREATE INDEX "ProductColour_productId_idx" ON "ProductColour"("productId");
CREATE INDEX "ProductColour_colourId_idx"  ON "ProductColour"("colourId");

ALTER TABLE "ProductColour" ADD CONSTRAINT "ProductColour_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductColour" ADD CONSTRAINT "ProductColour_colourId_fkey"
  FOREIGN KEY ("colourId")  REFERENCES "Colour"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Auto-create Colour master rows for any single names that appear in slash-separated combos
--    but didn't exist as a single-colour entry yet (e.g. "Tint Pink" from "Tint Pink/Kofee").
INSERT INTO "Colour" (id, name, code, "createdAt", "updatedAt")
SELECT 'c' || md5(random()::text || clock_timestamp()::text || x.name), x.name, '', NOW(), NOW()
FROM (
  SELECT DISTINCT TRIM(part) AS name
  FROM "Product" p
  CROSS JOIN LATERAL unnest(string_to_array(p."colourOrdered", '/')) AS arr(part)
  WHERE p."colourOrdered" IS NOT NULL AND TRIM(p."colourOrdered") <> ''
) x
WHERE x.name IS NOT NULL AND x.name <> ''
ON CONFLICT (name) DO NOTHING;

-- 3. Populate ProductColour by splitting colourOrdered on "/" and joining to Colour by name.
--    Slot is the 1-based ordinal within the slash-split.
INSERT INTO "ProductColour" ("productId", "colourId", "slot")
SELECT p.id, c.id, arr.slot
FROM "Product" p
CROSS JOIN LATERAL (
  SELECT TRIM(part) AS name, ord AS slot
  FROM unnest(string_to_array(p."colourOrdered", '/')) WITH ORDINALITY arr(part, ord)
) arr
JOIN "Colour" c ON c.name = arr.name
WHERE p."colourOrdered" IS NOT NULL AND TRIM(p."colourOrdered") <> '' AND arr.name <> ''
ON CONFLICT DO NOTHING;

-- 4. Sanity report. All counts should be 0; non-zero means a slash-part didn't match a Colour master.
DO $$
DECLARE
  unmatched INT;
  total_links INT;
  total_products_with_colour INT;
BEGIN
  WITH parts AS (
    SELECT p.id AS pid, TRIM(part) AS name
    FROM "Product" p,
         LATERAL unnest(string_to_array(p."colourOrdered", '/')) AS arr(part)
    WHERE p."colourOrdered" IS NOT NULL AND TRIM(p."colourOrdered") <> '' AND TRIM(part) <> ''
  )
  SELECT COUNT(*) INTO unmatched
  FROM parts pa
  LEFT JOIN "Colour" c ON c.name = pa.name
  WHERE c.id IS NULL;

  SELECT COUNT(*) INTO total_links FROM "ProductColour";
  SELECT COUNT(*) INTO total_products_with_colour
    FROM "Product" WHERE "colourOrdered" IS NOT NULL AND TRIM("colourOrdered") <> '';

  RAISE NOTICE 'ProductColour backfill report:';
  RAISE NOTICE '  Products with colourOrdered set: %', total_products_with_colour;
  RAISE NOTICE '  ProductColour rows inserted:    %', total_links;
  RAISE NOTICE '  Slash-parts with no master row: %  (should be 0)', unmatched;
END $$;
