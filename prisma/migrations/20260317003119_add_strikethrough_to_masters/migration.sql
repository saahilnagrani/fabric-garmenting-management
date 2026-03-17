-- AlterTable
ALTER TABLE "FabricMaster" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductMaster" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;
