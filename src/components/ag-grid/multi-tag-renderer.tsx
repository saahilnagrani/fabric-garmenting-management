"use client";

import type { CustomCellRendererProps } from "ag-grid-react";

export function MultiTagRenderer(props: CustomCellRendererProps) {
  const values: string[] = props.value || [];
  if (!values.length)
    return <span className="text-muted-foreground text-xs">-</span>;

  return (
    <div className="flex items-center gap-1 overflow-hidden h-full">
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-gray-200 text-gray-700 border border-gray-300 px-1.5 text-[11px] font-medium whitespace-nowrap h-5"
        >
          {v}
        </span>
      ))}
    </div>
  );
}
