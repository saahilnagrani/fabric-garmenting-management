"use client";

import type { CustomCellRendererProps } from "ag-grid-react";

const TAG_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-orange-100 text-orange-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
];

export function MultiTagRenderer(props: CustomCellRendererProps) {
  const values: string[] = props.value || [];
  if (!values.length)
    return <span className="text-muted-foreground text-xs">-</span>;

  return (
    <div className="flex items-center gap-1 overflow-hidden h-full">
      {values.map((v, i) => (
        <span
          key={i}
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TAG_COLORS[i % TAG_COLORS.length]}`}
        >
          {v}
        </span>
      ))}
    </div>
  );
}
