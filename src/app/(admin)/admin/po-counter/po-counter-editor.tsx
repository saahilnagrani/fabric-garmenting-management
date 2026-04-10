"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { resetPoCounterForFy, type PoCounterRow } from "@/actions/po-counter";

export function PoCounterEditor({
  counters,
  currentFy,
}: {
  counters: PoCounterRow[];
  currentFy: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [resetting, setResetting] = useState<string | null>(null);
  // Two-step confirmation per row.
  const [confirming, setConfirming] = useState<string | null>(null);

  async function performReset(fy: string) {
    setResetting(fy);
    try {
      const { clearedOrders } = await resetPoCounterForFy(fy);
      toast.success(
        `Counter for ${fy} reset. Cleared PO numbers from ${clearedOrders} fabric order${clearedOrders === 1 ? "" : "s"}.`
      );
      setConfirming(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(null);
    }
  }

  return (
    <div className="space-y-3">
      <table className="w-full text-xs border rounded overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2 font-medium w-[120px]">Fiscal Year</th>
            <th className="text-left p-2 font-medium w-[140px]">Last Number</th>
            <th className="text-left p-2 font-medium w-[160px]">POs Issued</th>
            <th className="text-left p-2 font-medium">Last Updated</th>
            <th className="text-right p-2 font-medium w-[200px]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {counters.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                No counter rows yet. The first PO generation will create one for the current FY.
              </td>
            </tr>
          )}
          {counters.map((c) => {
            const isCurrent = c.fiscalYear === currentFy;
            const isConfirming = confirming === c.fiscalYear;
            const isResetting = resetting === c.fiscalYear;
            return (
              <tr key={c.fiscalYear} className="align-top">
                <td className="p-2 font-mono font-semibold">
                  {c.fiscalYear}
                  {isCurrent && (
                    <span className="ml-2 text-[10px] text-green-700 bg-green-50 border border-green-200 px-1 rounded">
                      current
                    </span>
                  )}
                </td>
                <td className="p-2 font-mono">{c.lastNumber}</td>
                <td className="p-2">{c.poCount}</td>
                <td className="p-2 text-muted-foreground">
                  {c.updatedAt.toLocaleString("en-IN")}
                </td>
                <td className="p-2 text-right">
                  {isConfirming ? (
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-red-700 mr-1">Are you sure?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => performReset(c.fiscalYear)}
                        disabled={isResetting}
                        className="h-7 text-xs px-2"
                      >
                        {isResetting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Yes, reset"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirming(null)}
                        disabled={isResetting}
                        className="h-7 text-xs px-2"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirming(c.fiscalYear)}
                      className="h-7 text-xs px-2 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Reset {c.fiscalYear}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] text-muted-foreground italic">
        Resetting a fiscal year clears every <code>poNumber</code> on fabric orders for that
        FY and deletes the counter row. The next allocated PO under that FY will start at 0101.
      </p>
    </div>
  );
}
