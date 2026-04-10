"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { updateAlertRule, resetAlertRule, type AlertRuleRow } from "@/actions/alert-rules";

const SEVERITY_BADGE: Record<AlertRuleRow["severity"], string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

type RowState = {
  enabled: boolean;
  thresholdDays: string; // string for input binding
  criticalThresholdDays: string;
  dirty: boolean;
  saving: boolean;
};

export function AlertRulesEditor({ initialRules }: { initialRules: AlertRuleRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      initialRules.map((r) => [
        r.id,
        {
          enabled: r.enabled,
          thresholdDays: r.thresholdDays != null ? String(r.thresholdDays) : "",
          criticalThresholdDays: r.criticalThresholdDays != null ? String(r.criticalThresholdDays) : "",
          dirty: false,
          saving: false,
        },
      ])
    )
  );

  function patch(id: string, patch: Partial<RowState>) {
    setState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch, dirty: true },
    }));
  }

  async function save(rule: AlertRuleRow) {
    const s = state[rule.id];
    if (!s.dirty || s.saving) return;

    // Validate numeric fields
    const parseDays = (v: string): number | null => {
      if (v.trim() === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return NaN;
      return Math.floor(n);
    };

    const thresholdDays = rule.supportsThreshold ? parseDays(s.thresholdDays) : null;
    const criticalThresholdDays = rule.supportsCriticalThreshold
      ? parseDays(s.criticalThresholdDays)
      : null;

    if (Number.isNaN(thresholdDays) || Number.isNaN(criticalThresholdDays)) {
      toast.error("Threshold must be a non-negative number");
      return;
    }

    setState((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], saving: true } }));
    try {
      await updateAlertRule(rule.id, {
        enabled: s.enabled,
        ...(rule.supportsThreshold ? { thresholdDays } : {}),
        ...(rule.supportsCriticalThreshold ? { criticalThresholdDays } : {}),
      });
      toast.success(`${rule.title} updated`);
      setState((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], dirty: false, saving: false } }));
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      setState((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], saving: false } }));
    }
  }

  async function reset(rule: AlertRuleRow) {
    setState((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], saving: true } }));
    try {
      await resetAlertRule(rule.id);
      setState((prev) => ({
        ...prev,
        [rule.id]: {
          enabled: true,
          thresholdDays: rule.defaultThresholdDays != null ? String(rule.defaultThresholdDays) : "",
          criticalThresholdDays:
            rule.defaultCriticalThresholdDays != null ? String(rule.defaultCriticalThresholdDays) : "",
          dirty: false,
          saving: false,
        },
      }));
      toast.success(`${rule.title} reset to defaults`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
      setState((prev) => ({ ...prev, [rule.id]: { ...prev[rule.id], saving: false } }));
    }
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-xs border rounded overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2 font-medium w-[200px]">Alert</th>
            <th className="text-left p-2 font-medium w-[80px]">Severity</th>
            <th className="text-left p-2 font-medium">Trigger</th>
            <th className="text-left p-2 font-medium w-[120px]">Warning ≥</th>
            <th className="text-left p-2 font-medium w-[120px]">Critical ≤</th>
            <th className="text-left p-2 font-medium w-[80px]">Enabled</th>
            <th className="text-right p-2 font-medium w-[130px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {initialRules.map((rule) => {
            const s = state[rule.id];
            return (
              <tr key={rule.id} className="align-top">
                <td className="p-2 font-medium">{rule.title}</td>
                <td className="p-2">
                  <span className={`inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[rule.severity]}`}>
                    {rule.severity}
                  </span>
                </td>
                <td className="p-2 text-muted-foreground">{rule.trigger}</td>
                <td className="p-2">
                  {rule.supportsThreshold ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={s.thresholdDays}
                        onChange={(e) => patch(rule.id, { thresholdDays: e.target.value })}
                        className="h-7 text-xs w-16"
                        disabled={s.saving}
                      />
                      <span className="text-[10px] text-muted-foreground">days</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">n/a</span>
                  )}
                </td>
                <td className="p-2">
                  {rule.supportsCriticalThreshold ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={s.criticalThresholdDays}
                        onChange={(e) => patch(rule.id, { criticalThresholdDays: e.target.value })}
                        className="h-7 text-xs w-16"
                        disabled={s.saving}
                      />
                      <span className="text-[10px] text-muted-foreground">days</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">n/a</span>
                  )}
                </td>
                <td className="p-2">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={(v: boolean) => patch(rule.id, { enabled: v })}
                    disabled={s.saving}
                  />
                </td>
                <td className="p-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => save(rule)}
                      disabled={!s.dirty || s.saving}
                      className="h-7 text-xs px-2"
                    >
                      {s.saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => reset(rule)}
                      disabled={s.saving}
                      className="h-7 w-7 p-0"
                      title="Reset to defaults"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground italic">
        Changes apply to the dashboard on next load. Use the reset button to restore a rule&apos;s default threshold and re-enable it.
      </p>
    </div>
  );
}
