-- AlterTable
ALTER TABLE "ProductMaster" ADD COLUMN "previousSkuCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ArticleHistory" (
    "articleNumber" TEXT NOT NULL,
    "previousTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleHistory_pkey" PRIMARY KEY ("articleNumber")
);
