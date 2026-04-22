"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = "purchases" | "dispatches" | "balance" | "purchase-orders" | "dispatch-notes";

const TABS: { value: Tab; label: string; badge?: string }[] = [
  { value: "purchases", label: "Purchases" },
  { value: "purchase-orders", label: "Purchase Orders", badge: "AUDIT" },
  { value: "dispatches", label: "Dispatches" },
  { value: "dispatch-notes", label: "Dispatch Notes", badge: "AUDIT" },
  { value: "balance", label: "Balance" },
];

export function AccessoryTabBar({ activeTab }: { activeTab: Tab }) {
  const searchParams = useSearchParams();

  function hrefForTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Don't carry phaseId across to purchases/dispatches tabs
    if (tab !== "balance") params.delete("phaseId");
    // fy belongs to the audit tabs only
    if (tab !== "purchase-orders" && tab !== "dispatch-notes") params.delete("fy");
    return `/accessories?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-0 border-b border-border">
      <h1 className="text-2xl font-bold mr-6">Accessories</h1>
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={hrefForTab(t.value)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-block",
            activeTab === t.value
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="relative inline-block">
            {t.label}
            {t.badge && (
              <span className="absolute -top-3 right-0 rounded border border-amber-300 bg-amber-50 px-[3px] py-[1px] text-[7px] font-semibold uppercase tracking-[0.08em] text-amber-700 leading-none">
                {t.badge}
              </span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
