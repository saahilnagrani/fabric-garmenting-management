-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('FABRIC_SUPPLIER', 'GARMENTING', 'ACCESSORIES', 'BRAND_TAG', 'OTHER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MENS', 'WOMENS', 'KIDS');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PROCESSING', 'SAMPLE_WITH_ST', 'SAMPLE_READY', 'READY_AT_GARSEM', 'READY_AT_MUMTAZ', 'RECEIVED_AT_WAREHOUSE', 'SHIPPED');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FABRIC_VENDOR', 'GARMENTING', 'BRAND_TAG', 'ACCESSORIES', 'SHIPPING', 'PACKAGING', 'OTHER');

-- CreateEnum
CREATE TYPE "FabricStatus" AS ENUM ('FULLY_CONSUMED', 'TO_BE_CONSUMED', 'FULLY_INWARDED', 'PARTIALLY_INWARDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VendorType" NOT NULL,
    "contactInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "styleNumber" TEXT NOT NULL,
    "articleNumber" TEXT,
    "skuCode" TEXT,
    "colour" TEXT NOT NULL,
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "productName" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'PROCESSING',
    "vendorId" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "fabricGsm" DECIMAL(10,2),
    "fabricCostPerKg" DECIMAL(10,2),
    "garmentsPerKg" DECIMAL(10,2),
    "fabric2Name" TEXT,
    "fabric2CostPerKg" DECIMAL(10,2),
    "fabric2GarmentsPerKg" DECIMAL(10,2),
    "quantityOrderedKg" DECIMAL(10,2),
    "quantityShippedKg" DECIMAL(10,2),
    "garmentNumber" INTEGER,
    "actualGarmentStitched" INTEGER,
    "sizeXS" INTEGER NOT NULL DEFAULT 0,
    "sizeS" INTEGER NOT NULL DEFAULT 0,
    "sizeM" INTEGER NOT NULL DEFAULT 0,
    "sizeL" INTEGER NOT NULL DEFAULT 0,
    "sizeXL" INTEGER NOT NULL DEFAULT 0,
    "sizeXXL" INTEGER NOT NULL DEFAULT 0,
    "stitchingCost" DECIMAL(10,2),
    "brandLogoCost" DECIMAL(10,2),
    "neckTwillCost" DECIMAL(10,2),
    "reflectorsCost" DECIMAL(10,2),
    "fusingCost" DECIMAL(10,2),
    "accessoriesCost" DECIMAL(10,2),
    "brandTagCost" DECIMAL(10,2),
    "sizeTagCost" DECIMAL(10,2),
    "packagingCost" DECIMAL(10,2),
    "inwardShipping" DECIMAL(10,2),
    "mrp" DECIMAL(10,2),
    "proposedMrp" DECIMAL(10,2),
    "onlineMrp" DECIMAL(10,2),
    "dp" DECIMAL(10,2),
    "garmentingAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FabricOrder" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "gender" "Gender",
    "billNumber" TEXT,
    "receivedAt" TEXT,
    "styleNumbers" TEXT NOT NULL,
    "fabricName" TEXT NOT NULL,
    "colour" TEXT NOT NULL,
    "availableColour" TEXT,
    "costPerUnit" DECIMAL(10,2),
    "quantityOrdered" DECIMAL(10,2),
    "quantityShipped" DECIMAL(10,2),
    "fabricCostTotal" DECIMAL(12,2),
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FabricOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "vendorId" TEXT,
    "invoiceNumber" TEXT,
    "specification" "ExpenseType" NOT NULL,
    "date" TIMESTAMP(3),
    "description" TEXT,
    "quantity" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "deliveredAt" TEXT,
    "productNote" TEXT,
    "note" TEXT,
    "garmentBifurcation" TEXT,
    "totalGarments" INTEGER,
    "fabricStatus" "FabricStatus",
    "inwardDate" TIMESTAMP(3),
    "expectedInward" TIMESTAMP(3),
    "actualInward" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Phase_number_key" ON "Phase"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Product_phaseId_idx" ON "Product"("phaseId");

-- CreateIndex
CREATE INDEX "Product_styleNumber_idx" ON "Product"("styleNumber");

-- CreateIndex
CREATE INDEX "Product_vendorId_idx" ON "Product"("vendorId");

-- CreateIndex
CREATE INDEX "Product_isRepeat_idx" ON "Product"("isRepeat");

-- CreateIndex
CREATE INDEX "FabricOrder_phaseId_idx" ON "FabricOrder"("phaseId");

-- CreateIndex
CREATE INDEX "FabricOrder_vendorId_idx" ON "FabricOrder"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_phaseId_idx" ON "Expense"("phaseId");

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_specification_idx" ON "Expense"("specification");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FabricOrder" ADD CONSTRAINT "FabricOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
