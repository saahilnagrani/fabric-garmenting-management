-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdDays" INTEGER,
    "criticalThresholdDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- Seed with the 7 existing hardcoded rules + their current default thresholds
INSERT INTO "AlertRule" ("id", "enabled", "thresholdDays", "criticalThresholdDays", "updatedAt") VALUES
  ('phase-deadline',         true, 7,    3,    NOW()),
  ('stale-ordered',          true, 7,    NULL, NOW()),
  ('missing-cutting-report', true, 3,    NULL, NOW()),
  ('sampling-overdue',       true, 5,    NULL, NOW()),
  ('production-stalled',     true, 14,   NULL, NOW()),
  ('unlinked-fabric',        true, NULL, NULL, NOW()),
  ('unlinked-products',      true, NULL, NULL, NOW());
