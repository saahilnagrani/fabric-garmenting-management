-- AlterTable
ALTER TABLE "ProductMasterAccessory" ADD COLUMN "applicableSizes" TEXT[] DEFAULT ARRAY[]::TEXT[];
