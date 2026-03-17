"use client";

import type { CustomCellRendererProps } from "ag-grid-react";

export function MultiTagRenderer(props: CustomCellRendererProps) {
  const values: string[] = props.value || [];
  if (!values.length) return <span className="text-muted-foreground text-xs">-</span>;

  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary whitespace-nowrap"
        >
          {v}
        </span>
      ))}
    </div>
  );
}
