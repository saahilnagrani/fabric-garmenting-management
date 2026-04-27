-- CreateTable
CREATE TABLE "PhasePlanDraft" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhasePlanDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhasePlanDraft_phaseId_idx" ON "PhasePlanDraft"("phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "PhasePlanDraft_phaseId_userId_key" ON "PhasePlanDraft"("phaseId", "userId");
