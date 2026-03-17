-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FabricOrder" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isStrikedThrough" BOOLEAN NOT NULL DEFAULT false;
