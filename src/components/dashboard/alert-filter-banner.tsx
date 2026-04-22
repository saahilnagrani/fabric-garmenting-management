"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X, Filter } from "lucide-react";

/**
 * Banner shown at the top of list pages when the user navigated in via a
 * dashboard alert. Displays the human label for the filter and a count of
 * filtered rows versus the phase total, with a dismiss button that strips
 * the `alertFilter` param and re-navigates.
 *
 * Server pages own the data fetching — this component is purely presentational
 * and owns the dismiss interaction.
 */
export function AlertFilterBanner({
  label,
  filteredCount,
  totalCount,
}: {
  label: string;
  filteredCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function dismiss() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("alertFilter");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Filter className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
        <span className="text-amber-900 dark:text-amber-200 truncate">
          <span className="font-medium">Filtered by alert:</span>{" "}
          <span>{label}</span>
        </span>
        <span className="shrink-0 rounded bg-amber-200/70 dark:bg-amber-900/60 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
          {filteredCount} of {totalCount}
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
        aria-label="Clear alert filter"
      >
        Clear filter
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
