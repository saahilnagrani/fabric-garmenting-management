-- CreateTable
CREATE TABLE "ArticleAccessory" (
    "id" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "accessoryId" TEXT NOT NULL,
    "quantityPerPiece" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "applicableSizes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArticleAccessory_articleNumber_accessoryId_key" ON "ArticleAccessory"("articleNumber", "accessoryId");

-- CreateIndex
CREATE INDEX "ArticleAccessory_articleNumber_idx" ON "ArticleAccessory"("articleNumber");

-- CreateIndex
CREATE INDEX "ArticleAccessory_accessoryId_idx" ON "ArticleAccessory"("accessoryId");

-- AddForeignKey
ALTER TABLE "ArticleAccessory" ADD CONSTRAINT "ArticleAccessory_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "AccessoryMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
