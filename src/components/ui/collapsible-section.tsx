"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase text-foreground tracking-wider">
          {title}
        </span>
      </button>
      {expanded && <div className="px-2 py-2 space-y-1.5">{children}</div>}
    </div>
  );
}
