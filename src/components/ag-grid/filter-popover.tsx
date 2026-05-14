"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";

type Option = { key: string; label: string };
type VendorOption = { id: string; name: string };

export function FilterPopover({
  tabKey,
  tabs,
  onTabChange,
  vendors,
  selectedVendors,
  onVendorsChange,
  statuses,
  selectedStatuses,
  onStatusesChange,
  onClearAll,
}: {
  tabKey: string;
  tabs: Option[];
  onTabChange: (key: string) => void;
  vendors: VendorOption[];
  selectedVendors: string[];
  onVendorsChange: (ids: string[]) => void;
  statuses?: Option[];
  selectedStatuses?: string[];
  onStatusesChange?: (keys: string[]) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);

  const activeCount =
    (tabKey !== "all" ? 1 : 0) +
    selectedVendors.length +
    (selectedStatuses?.length ?? 0);

  function toggleVendor(id: string) {
    if (selectedVendors.includes(id)) onVendorsChange(selectedVendors.filter((v) => v !== id));
    else onVendorsChange([...selectedVendors, id]);
  }

  function toggleStatus(key: string) {
    if (!onStatusesChange || !selectedStatuses) return;
    if (selectedStatuses.includes(key)) onStatusesChange(selectedStatuses.filter((s) => s !== key));
    else onStatusesChange([...selectedStatuses, key]);
  }

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Filter className="mr-1.5 h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 h-4 text-[10px]">
            {activeCount}
          </Badge>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-[26rem] max-w-[calc(100vw-2rem)] bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 space-y-3">
            <ChipSection
              title="Type"
              options={tabs}
              isSelected={(key) => tabKey === key}
              onToggle={(key) => onTabChange(key)}
              singleSelect
              headerRight={
                activeCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground normal-case tracking-normal">{activeCount} active</span>
                    <button
                      onClick={onClearAll}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 normal-case tracking-normal"
                    >
                      Clear all <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null
              }
            />

            <ChipSection
              title={`Vendors${selectedVendors.length > 0 ? ` (${selectedVendors.length})` : ""}`}
              options={vendors.map((v) => ({ key: v.id, label: v.name }))}
              isSelected={(id) => selectedVendors.includes(id)}
              onToggle={(id) => toggleVendor(id)}
              emptyMessage="No vendors"
            />

            {statuses && selectedStatuses && onStatusesChange && (
              <ChipSection
                title={`Statuses${selectedStatuses.length > 0 ? ` (${selectedStatuses.length})` : ""}`}
                options={statuses}
                isSelected={(key) => selectedStatuses.includes(key)}
                onToggle={(key) => toggleStatus(key)}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChipSection({
  title,
  options,
  isSelected,
  onToggle,
  singleSelect,
  emptyMessage,
  headerRight,
}: {
  title: string;
  options: Option[];
  isSelected: (key: string) => boolean;
  onToggle: (key: string) => void;
  singleSelect?: boolean;
  emptyMessage?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {headerRight}
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const selected = isSelected(opt.key);
            return (
              <button
                key={opt.key}
                onClick={() => onToggle(opt.key)}
                className={`h-7 px-2.5 text-xs rounded-md border transition-colors ${
                  selected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-background border-border hover:bg-accent"
                } ${singleSelect ? "" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
