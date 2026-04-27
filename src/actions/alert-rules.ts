"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";
import { ALERT_RULE_CATALOG, type AlertRuleDefinition } from "@/lib/alert-rules-catalog";

async function requireAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session;
}

export type AlertRuleSetting = {
  id: string;
  enabled: boolean;
  thresholdDays: number | null;
  criticalThresholdDays: number | null;
};

export type AlertRuleRow = AlertRuleDefinition & AlertRuleSetting;

/**
 * Load the current settings for every rule in the catalog.
 * Rules missing from the DB fall back to defaults from the catalog.
 * Intended for use by both the admin UI and the dashboard evaluator.
 */
export async function getAlertRulesMerged(): Promise<AlertRuleRow[]> {
  const rows = await db.alertRule.findMany();
  const byId = new Map(rows.map((r) => [r.id, r]));

  return ALERT_RULE_CATALOG.map((def) => {
    const row = byId.get(def.id);
    return {
      ...def,
      enabled: row?.enabled ?? def.defaultEnabled,
      thresholdDays: row?.thresholdDays ?? def.defaultThresholdDays,
      criticalThresholdDays:
        row?.criticalThresholdDays ?? def.defaultCriticalThresholdDays,
    };
  });
}

/**
 * Update one rule. Admin only. Upserts so rules that aren't in the DB yet
 * (e.g. newly added to the catalog) get created on first edit.
 */
export async function updateAlertRule(
  id: string,
  data: {
    enabled?: boolean;
    thresholdDays?: number | null;
    criticalThresholdDays?: number | null;
  }
) {
  const session = await requireAdmin();

  const def = ALERT_RULE_CATALOG.find((r) => r.id === id);
  if (!def) throw new Error(`Unknown alert rule: ${id}`);

  // Silently clamp negative thresholds to 0 — negative days is meaningless.
  const clamp = (n: number | null | undefined) =>
    n == null ? null : Math.max(0, Math.floor(n));

  const upsertData = {
    enabled: data.enabled ?? def.defaultEnabled,
    thresholdDays:
      data.thresholdDays !== undefined
        ? clamp(data.thresholdDays)
        : def.defaultThresholdDays,
    criticalThresholdDays:
      data.criticalThresholdDays !== undefined
        ? clamp(data.criticalThresholdDays)
        : def.defaultCriticalThresholdDays,
  };

  const previous = await db.alertRule.findUnique({ where: { id } });

  const row = await db.alertRule.upsert({
    where: { id },
    create: { id, ...upsertData },
    update: {
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.thresholdDays !== undefined ? { thresholdDays: clamp(data.thresholdDays) } : {}),
      ...(data.criticalThresholdDays !== undefined
        ? { criticalThresholdDays: clamp(data.criticalThresholdDays) }
        : {}),
    },
  });

  logAction(
    session.user!.id!,
    session.user!.name!,
    "UPDATE",
    "AlertRule",
    id,
    {
      enabled: { old: previous?.enabled ?? def.defaultEnabled, new: row.enabled },
      thresholdDays: {
        old: previous?.thresholdDays ?? def.defaultThresholdDays,
        new: row.thresholdDays,
      },
      criticalThresholdDays: {
        old: previous?.criticalThresholdDays ?? def.defaultCriticalThresholdDays,
        new: row.criticalThresholdDays,
      },
    }
  );

  revalidatePath("/admin/alert-rules");
  revalidatePath("/dashboard");
  return row;
}

/**
 * Reset one rule to the catalog defaults. Admin only.
 */
export async function resetAlertRule(id: string) {
  const session = await requireAdmin();
  const def = ALERT_RULE_CATALOG.find((r) => r.id === id);
  if (!def) throw new Error(`Unknown alert rule: ${id}`);

  const row = await db.alertRule.upsert({
    where: { id },
    create: {
      id,
      enabled: def.defaultEnabled,
      thresholdDays: def.defaultThresholdDays,
      criticalThresholdDays: def.defaultCriticalThresholdDays,
    },
    update: {
      enabled: def.defaultEnabled,
      thresholdDays: def.defaultThresholdDays,
      criticalThresholdDays: def.defaultCriticalThresholdDays,
    },
  });

  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AlertRule", id, {
    reset: { new: true },
  });

  revalidatePath("/admin/alert-rules");
  revalidatePath("/dashboard");
  return row;
}
