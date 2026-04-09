import { toast } from "sonner";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";
import type { AutoAdvanceResult } from "@/lib/auto-transitions";

/**
 * Shows a toast summarizing auto-advanced product statuses after a mutation.
 * - 1 product: "Auto-advanced 2103/Black → Fabric Received"
 * - 2–3 products: lists all three
 * - 4+: summarizes count and groups by new status
 * Does nothing if the list is empty.
 */
export function showAutoAdvanceToast(advanced: AutoAdvanceResult[] | null | undefined) {
  if (!advanced || advanced.length === 0) return;

  if (advanced.length === 1) {
    const a = advanced[0];
    toast.info(
      `Auto-advanced ${a.articleNumber ?? "?"}/${a.colourOrdered} → ${PRODUCT_STATUS_LABELS[a.newStatus] || a.newStatus}`,
      { duration: 5000 }
    );
    return;
  }

  if (advanced.length <= 3) {
    const lines = advanced
      .map((a) => `${a.articleNumber ?? "?"}/${a.colourOrdered} → ${PRODUCT_STATUS_LABELS[a.newStatus] || a.newStatus}`)
      .join("\n");
    toast.info(`Auto-advanced ${advanced.length} article orders`, {
      description: lines,
      duration: 6000,
    });
    return;
  }

  // Group by new status for 4+
  const byStatus = new Map<string, number>();
  for (const a of advanced) {
    byStatus.set(a.newStatus, (byStatus.get(a.newStatus) || 0) + 1);
  }
  const groups = Array.from(byStatus.entries())
    .map(([s, count]) => `${count} → ${PRODUCT_STATUS_LABELS[s] || s}`)
    .join(", ");
  toast.info(`Auto-advanced ${advanced.length} article orders`, {
    description: groups,
    duration: 6000,
  });
}
