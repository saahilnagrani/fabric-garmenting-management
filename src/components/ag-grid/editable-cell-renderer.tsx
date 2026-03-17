"use client";

import { Pencil } from "lucide-react";
import type { ICellRendererParams } from "ag-grid-community";

export function EditableCellRenderer(props: ICellRendererParams) {
  return (
    <div className="group/cell flex items-center w-full h-full">
      <span className="truncate">{props.valueFormatted ?? props.value}</span>
      <Pencil className="ml-auto h-3 w-3 shrink-0 text-slate-400 opacity-0 group-hover/cell:opacity-40 transition-opacity" />
    </div>
  );
}
