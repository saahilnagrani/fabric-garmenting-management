-- ─── State machine refactor ─────────────────────────────────────────
-- 1. Adds new ProductStatus / FabricOrderStatus values, drops SAMPLING,
--    folds DISCUSSED_WITH_VENDOR + ORDERED + SHIPPED into the new flow.
-- 2. Adds statusChangedAt to Product and FabricOrder, backfilled from updatedAt.
-- 3. Adds piReceivedAt, advancePaidAt, poNumber to FabricOrder.
-- 4. Back-assigns PO numbers (HYP/PO/<FY>/<seq>) to non-draft fabric orders.
-- 5. Creates PoCounter table and seeds it with max(seq) per FY.
-- 6. Creates FabricBalance table.

-- ── 1. New nullable columns (statusChangedAt added nullable so we can backfill)

ALTER TABLE "Product" ADD COLUMN "statusChangedAt" TIMESTAMP(3);

ALTER TABLE "FabricOrder"
  ADD COLUMN "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN "piReceivedAt"    TIMESTAMP(3),
  ADD COLUMN "advancePaidAt"   TIMESTAMP(3),
  ADD COLUMN "poNumber"        TEXT;

-- ── 2. Backfill statusChangedAt from updatedAt for existing rows

UPDATE "Product"     SET "statusChangedAt" = "updatedAt";
UPDATE "FabricOrder" SET "statusChangedAt" = "updatedAt";

ALTER TABLE "Product"     ALTER COLUMN "statusChangedAt" SET NOT NULL;
ALTER TABLE "Product"     ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FabricOrder" ALTER COLUMN "statusChangedAt" SET NOT NULL;
ALTER TABLE "FabricOrder" ALTER COLUMN "statusChangedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- ── 3. Recreate ProductStatus enum with CASE-mapped data migration

CREATE TYPE "ProductStatus_new" AS ENUM (
  'PLANNED',
  'FABRIC_ORDERED',
  'FABRIC_RECEIVED',
  'CUTTING_IN_PROGRESS',
  'CUTTING_COMPLETED',
  'CUTTING_REPORT_RECEIVED',
  'STITCHING_IN_PROGRESS',
  'STITCHING_COMPLETED',
  'TRIMS_ACCESSORIES_ATTACHED',
  'QC_IN_PROGRESS',
  'QC_APPROVED',
  'QC_FAILED',
  'PACKAGING_IN_PROGRESS',
  'PACKAGING_COMPLETED',
  'READY_FOR_DISPATCH',
  'DISPATCHED',
  'RECEIVED_AT_WAREHOUSE',
  'SHIPPED',
  'DELIVERED'
);

ALTER TABLE "Product" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Product"
  ALTER COLUMN "status" TYPE "ProductStatus_new"
  USING (
    CASE "status"::text
      WHEN 'SAMPLING'             THEN 'FABRIC_RECEIVED'
      WHEN 'CUTTING_REPORT'       THEN 'CUTTING_REPORT_RECEIVED'
      WHEN 'IN_PRODUCTION'        THEN 'STITCHING_IN_PROGRESS'
      WHEN 'READY_AT_GARMENTER'   THEN 'READY_FOR_DISPATCH'
      WHEN 'SHIPPED_TO_WAREHOUSE' THEN 'DISPATCHED'
      ELSE "status"::text
    END
  )::"ProductStatus_new";
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

DROP TYPE "ProductStatus";
ALTER TYPE "ProductStatus_new" RENAME TO "ProductStatus";

-- ── 4. Recreate FabricOrderStatus enum with CASE-mapped data migration

CREATE TYPE "FabricOrderStatus_new" AS ENUM (
  'DRAFT_ORDER',
  'PO_SENT',
  'PI_RECEIVED',
  'ADVANCE_PAID',
  'PARTIALLY_SHIPPED',
  'DISPATCHED',
  'RECEIVED',
  'FULLY_SETTLED'
);

ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" DROP DEFAULT;
ALTER TABLE "FabricOrder"
  ALTER COLUMN "orderStatus" TYPE "FabricOrderStatus_new"
  USING (
    CASE "orderStatus"::text
      WHEN 'DISCUSSED_WITH_VENDOR' THEN 'DRAFT_ORDER'
      WHEN 'ORDERED'               THEN 'PO_SENT'
      WHEN 'SHIPPED'               THEN 'DISPATCHED'
      ELSE "orderStatus"::text
    END
  )::"FabricOrderStatus_new";
ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" SET DEFAULT 'DRAFT_ORDER';

DROP TYPE "FabricOrderStatus";
ALTER TYPE "FabricOrderStatus_new" RENAME TO "FabricOrderStatus";

-- ── 5. Back-assign PO numbers to non-draft fabric orders.
--      Numbering is sequential per fiscal year (Apr–Mar) by createdAt, starting at 0101.

WITH numbered AS (
  SELECT
    "id",
    CASE
      WHEN EXTRACT(MONTH FROM "createdAt") >= 4
        THEN EXTRACT(YEAR FROM "createdAt")::int
      ELSE EXTRACT(YEAR FROM "createdAt")::int - 1
    END AS fy_start,
    ROW_NUMBER() OVER (
      PARTITION BY (
        CASE
          WHEN EXTRACT(MONTH FROM "createdAt") >= 4
            THEN EXTRACT(YEAR FROM "createdAt")::int
          ELSE EXTRACT(YEAR FROM "createdAt")::int - 1
        END
      )
      ORDER BY "createdAt", "id"
    ) + 100 AS seq
  FROM "FabricOrder"
  WHERE "orderStatus" <> 'DRAFT_ORDER'
)
UPDATE "FabricOrder" fo
SET "poNumber" =
  'HYP/PO/'
  || numbered.fy_start::text
  || '-'
  || LPAD(((numbered.fy_start + 1) % 100)::text, 2, '0')
  || '/'
  || LPAD(numbered.seq::text, 4, '0')
FROM numbered
WHERE fo."id" = numbered."id";

-- ── 6. PoCounter table

CREATE TABLE "PoCounter" (
  "fiscalYear" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 100,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PoCounter_pkey" PRIMARY KEY ("fiscalYear")
);

-- ── 7. Seed PoCounter from the back-assigned PO numbers (max seq per FY)

INSERT INTO "PoCounter" ("fiscalYear", "lastNumber", "updatedAt")
SELECT
  sub.fy_start::text || '-' || LPAD(((sub.fy_start + 1) % 100)::text, 2, '0'),
  MAX(sub.seq),
  CURRENT_TIMESTAMP
FROM (
  SELECT
    CASE
      WHEN EXTRACT(MONTH FROM "createdAt") >= 4
        THEN EXTRACT(YEAR FROM "createdAt")::int
      ELSE EXTRACT(YEAR FROM "createdAt")::int - 1
    END AS fy_start,
    ROW_NUMBER() OVER (
      PARTITION BY (
        CASE
          WHEN EXTRACT(MONTH FROM "createdAt") >= 4
            THEN EXTRACT(YEAR FROM "createdAt")::int
          ELSE EXTRACT(YEAR FROM "createdAt")::int - 1
        END
      )
      ORDER BY "createdAt", "id"
    ) + 100 AS seq
  FROM "FabricOrder"
  WHERE "orderStatus" <> 'DRAFT_ORDER'
) sub
GROUP BY sub.fy_start;

-- ── 8. Unique index on poNumber

CREATE UNIQUE INDEX "FabricOrder_poNumber_key" ON "FabricOrder"("poNumber");

-- ── 9. FabricBalance table + relations

CREATE TABLE "FabricBalance" (
  "id"               TEXT          NOT NULL,
  "fabricMasterId"   TEXT          NOT NULL,
  "vendorId"         TEXT          NOT NULL,
  "colour"           TEXT          NOT NULL,
  "remainingKg"      DECIMAL(12,2) NOT NULL,
  "costPerKg"        DECIMAL(10,2) NOT NULL,
  "sourcePhaseId"    TEXT,
  "targetPhaseId"    TEXT,
  "notes"            TEXT,
  "isStrikedThrough" BOOLEAN       NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "FabricBalance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FabricBalance_fabricMasterId_idx" ON "FabricBalance"("fabricMasterId");
CREATE INDEX "FabricBalance_vendorId_idx"       ON "FabricBalance"("vendorId");
CREATE INDEX "FabricBalance_sourcePhaseId_idx"  ON "FabricBalance"("sourcePhaseId");
CREATE INDEX "FabricBalance_targetPhaseId_idx"  ON "FabricBalance"("targetPhaseId");

ALTER TABLE "FabricBalance"
  ADD CONSTRAINT "FabricBalance_fabricMasterId_fkey"
  FOREIGN KEY ("fabricMasterId") REFERENCES "FabricMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FabricBalance"
  ADD CONSTRAINT "FabricBalance_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FabricBalance"
  ADD CONSTRAINT "FabricBalance_sourcePhaseId_fkey"
  FOREIGN KEY ("sourcePhaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FabricBalance"
  ADD CONSTRAINT "FabricBalance_targetPhaseId_fkey"
  FOREIGN KEY ("targetPhaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
