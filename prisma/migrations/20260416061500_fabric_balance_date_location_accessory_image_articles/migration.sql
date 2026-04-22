-- AlterTable
ALTER TABLE "AccessoryMaster" ADD COLUMN IF NOT EXISTS "articleCodeUnits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "FabricBalance" ADD COLUMN IF NOT EXISTS "garmentingLocation" TEXT,
ADD COLUMN IF NOT EXISTS "updateDate" TIMESTAMP(3);
