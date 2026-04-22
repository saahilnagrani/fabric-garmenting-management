"use client";

import { useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type DispatchNoteRow = {
  dnNumber: string;
  destinationGarmenter: string | null;
  lineCount: number;
  totalQuantity: number;
  status: string;
  generatedAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:      { label: "Draft",      className: "bg-gray-100 text-gray-700 border-gray-200" },
  DISPATCHED: { label: "Dispatched", className: "bg-purple-100 text-purple-700 border-purple-200" },
  RECEIVED:   { label: "Received",   className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "Cancelled",  className: "bg-red-100 text-red-700 border-red-200" },
};

export function AccessoryDispatchNotesGrid({
  notes,
  fiscalYears,
  selectedFiscalYear,
}: {
  notes: DispatchNoteRow[];
  fiscalYears: string[];
  selectedFiscalYear: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  function onFiscalYearChange(fy: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (fy === "ALL") params.delete("fy");
    else params.set("fy", fy);
    router.push(`/accessories?${params.toString()}`);
  }

  const columnDefs = useMemo<ColDef<DispatchNoteRow>[]>(
    () => [
      {
        field: "dnNumber",
        headerName: "DN #",
        pinned: "left",
        minWidth: 180,
        editable: false,
        cellRenderer: (params: { value: string }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/accessory-dispatches/dispatch-note?dnNumber=${encodeURIComponent(params.value)}`, "_blank");
            }}
            className="text-[11px] text-blue-600 underline cursor-pointer font-mono"
          >
            {params.value}
          </button>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 115,
        editable: false,
        cellRenderer: (params: { value: string }) => {
          const cfg = STATUS_CONFIG[params.value] ?? STATUS_CONFIG.DRAFT;
          return (
            <span className={`inline-flex items-center rounded border px-1.5 text-[10px] font-medium whitespace-nowrap h-5 ${cfg.className}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        field: "generatedAt",
        headerName: "Generated",
        minWidth: 120,
        editable: false,
        valueFormatter: (p) =>
          p.value
            ? new Date(p.value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "",
      },
      { field: "destinationGarmenter", headerName: "To Garmenter", minWidth: 180, editable: false },
      {
        field: "lineCount",
        headerName: "Line Items",
        minWidth: 100,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "totalQuantity",
        headerName: "Total Qty",
        minWidth: 120,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) =>
          (p.value as number).toLocaleString("en-IN", { maximumFractionDigits: 2 }),
      },
    ],
    [],
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Label className="text-[11px]">Fiscal year</Label>
          <Select value={selectedFiscalYear} onValueChange={onFiscalYearChange}>
            <SelectTrigger size="sm" className="text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((fy) => (
                <SelectItem key={fy} value={fy}>{fy}</SelectItem>
              ))}
              <SelectItem value="ALL">All years</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-dispatch-notes"
        />
      </div>

      <DataGrid<DispatchNoteRow>
        gridId="accessory-dispatch-notes"
        rowData={notes}
        columnDefs={columnDefs}
        defaultRow={{}}
        getRowId={(d) => d.dnNumber}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "generatedAt", sort: "desc" }]}
        hideAddRowButtons
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
    </>
  );
}
