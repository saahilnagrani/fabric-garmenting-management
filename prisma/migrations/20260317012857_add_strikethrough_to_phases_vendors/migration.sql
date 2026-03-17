-- AlterTable
ALTER TABLE "Phase" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;
