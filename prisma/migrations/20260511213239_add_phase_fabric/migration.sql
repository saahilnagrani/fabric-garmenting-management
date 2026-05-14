-- CreateTable
CREATE TABLE "PhaseFabric" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "productMasterId" TEXT NOT NULL,
    "fabricName" TEXT,
    "fabricVendorId" TEXT,
    "fabricCostPerKg" DECIMAL(10,2),
    "garmentsPerKg" DECIMAL(10,2),
    "fabric2Name" TEXT,
    "fabric2VendorId" TEXT,
    "fabric2CostPerKg" DECIMAL(10,2),
    "garmentsPerKg2" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhaseFabric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhaseFabric_productMasterId_idx" ON "PhaseFabric"("productMasterId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseFabric_phaseId_productMasterId_key" ON "PhaseFabric"("phaseId", "productMasterId");
