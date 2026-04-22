"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { resetPoCounterForFy, type PoCounterRow, type CounterType } from "@/actions/po-counter";

const SECTIONS: { type: CounterType; title: string; prefix: string; unitLabel: string }[] = [
  { type: "FABRIC_PO",    title: "Fabric POs",       prefix: "HYP/FPO/YYYY-YY/NNNN", unitLabel: "fabric order" },
  { type: "ACCESSORY_PO", title: "Accessory POs",    prefix: "HYP/APO/YYYY-YY/NNNN", unitLabel: "accessory purchase" },
  { type: "ACCESSORY_DN", title: "Accessory DNs",    prefix: "HYP/ADN/YYYY-YY/NNNN", unitLabel: "accessory dispatch" },
];

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
  const [confirming, setConfirming] = useState<string | null>(null);

  async function performReset(type: CounterType, fy: string, unitLabel: string) {
    const key = `${type}:${fy}`;
    setResetting(key);
    try {
      const { clearedCount } = await resetPoCounterForFy(type, fy);
      toast.success(
        `Counter for ${fy} reset. Cleared numbers from ${clearedCount} ${unitLabel}${clearedCount === 1 ? "" : "s"}.`,
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
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const rows = counters.filter((c) => c.type === section.type);
        return (
          <div key={section.type} className="space-y-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <code className="text-[11px] bg-muted px-1 rounded text-muted-foreground">{section.prefix}</code>
            </div>
            <table className="w-full text-xs border rounded overflow-hidden">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium w-[180px]">Fiscal Year</th>
                  <th className="text-left p-2 font-medium w-[140px]">Last Number</th>
                  <th className="text-left p-2 font-medium w-[160px]">Issued</th>
                  <th className="text-left p-2 font-medium">Last Updated</th>
                  <th className="text-right p-2 font-medium w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                      No counter rows yet. The first {section.title.toLowerCase().replace(/s$/, "")} generation will create one.
                    </td>
                  </tr>
                )}
                {rows.map((c) => {
                  const isCurrent = c.fiscalYear === currentFy;
                  const key = `${c.type}:${c.fiscalYear}`;
                  const isConfirming = confirming === key;
                  const isResetting = resetting === key;
                  return (
                    <tr key={key} className="align-top">
                      <td className="p-2 font-mono font-semibold">
                        {c.fiscalYear}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] text-green-700 bg-green-50 border border-green-200 px-1 rounded">
                            current
                          </span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{c.lastNumber}</td>
                      <td className="p-2">{c.issuedCount}</td>
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
                              onClick={() => performReset(c.type, c.fiscalYear, section.unitLabel)}
                              disabled={isResetting}
                              className="h-7 text-xs px-2"
                            >
                              {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes, reset"}
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
                            onClick={() => setConfirming(key)}
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
          </div>
        );
      })}

      <p className="text-[11px] text-muted-foreground italic">
        Resetting a fiscal year clears every document number of that type/FY and deletes the counter row.
        The next allocated number will start at 0101. Never run against a live FY where real documents
        have been sent to vendors or garmenters.
      </p>
    </div>
  );
}
