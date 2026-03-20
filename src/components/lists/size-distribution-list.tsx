"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAllSizeDistributions } from "@/actions/size-distributions";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";

type SizeDistribution = {
  id: string;
  size: string;
  percentage: number;
  sortOrder: number;
};

export function SizeDistributionList({
  distributions,
}: {
  distributions: SizeDistribution[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(distributions.map((d) => [d.id, String(d.percentage)]))
  );
  const [saving, setSaving] = useState(false);

  const total = Object.values(values).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const isValid = Math.abs(total - 100) < 0.01;
  const hasChanges = distributions.some(
    (d) => String(d.percentage) !== values[d.id]
  );

  function handleReset() {
    setValues(
      Object.fromEntries(distributions.map((d) => [d.id, String(d.percentage)]))
    );
  }

  async function handleSave() {
    if (!isValid) {
      toast.error("Percentages must add up to 100%");
      return;
    }
    setSaving(true);
    try {
      const items = distributions.map((d) => ({
        id: d.id,
        percentage: parseFloat(values[d.id]) || 0,
      }));
      await updateAllSizeDistributions(items);
      toast.success("Size distribution updated");
      router.refresh();
    } catch {
      toast.error("Failed to update size distribution");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          <span>Size</span>
          <span>Percentage (%)</span>
          <span>Preview (of 100 pcs)</span>
        </div>

        {/* Rows */}
        {distributions.map((d) => {
          const pct = parseFloat(values[d.id]) || 0;
          const preview = Math.round(pct);
          return (
            <div
              key={d.id}
              className="grid grid-cols-3 gap-4 px-4 py-2 items-center border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium">{d.size}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={values[d.id]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {preview} pcs
              </span>
            </div>
          );
        })}

        {/* Total row */}
        <div className="grid grid-cols-3 gap-4 px-4 py-2.5 bg-muted/50 border-t items-center">
          <span className="text-sm font-semibold">Total</span>
          <span
            className={`text-sm font-semibold ${
              isValid
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {total.toFixed(1)}%
            {!isValid && (
              <span className="text-xs font-normal ml-1">
                ({total > 100 ? "+" : ""}{(total - 100).toFixed(1)}%)
              </span>
            )}
          </span>
          <span className="text-sm font-semibold text-muted-foreground">
            {Math.round(total)} pcs
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanges || !isValid}
        >
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {hasChanges && (
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        )}
        {!isValid && (
          <span className="text-xs text-red-600">
            Percentages must add up to 100%
          </span>
        )}
      </div>
    </div>
  );
}
