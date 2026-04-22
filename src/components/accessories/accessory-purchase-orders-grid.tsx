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

export type PurchaseOrderRow = {
  poNumber: string;
  vendorName: string | null;
  shipToVendorName: string | null;
  lineCount: number;
  totalAmount: number;
  status: string;
  generatedAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT_ORDER:       { label: "Draft",          className: "bg-gray-100 text-gray-700 border-gray-200" },
  PO_SENT:           { label: "PO Sent",         className: "bg-blue-100 text-blue-700 border-blue-200" },
  PI_RECEIVED:       { label: "PI Received",     className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  ADVANCE_PAID:      { label: "Advance Paid",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  PARTIALLY_SHIPPED: { label: "Partial Ship",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  DISPATCHED:        { label: "Dispatched",      className: "bg-purple-100 text-purple-700 border-purple-200" },
  RECEIVED:          { label: "Received",        className: "bg-green-100 text-green-700 border-green-200" },
  FULLY_SETTLED:     { label: "Settled",         className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED:         { label: "Cancelled",       className: "bg-red-100 text-red-700 border-red-200" },
};

export function AccessoryPurchaseOrdersGrid({
  orders,
  fiscalYears,
  selectedFiscalYear,
}: {
  orders: PurchaseOrderRow[];
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

  const columnDefs = useMemo<ColDef<PurchaseOrderRow>[]>(
    () => [
      {
        field: "poNumber",
        headerName: "PO #",
        pinned: "left",
        minWidth: 180,
        editable: false,
        cellRenderer: (params: { value: string }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/accessory-purchases/purchase-order?poNumber=${encodeURIComponent(params.value)}`, "_blank");
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
          const cfg = STATUS_CONFIG[params.value] ?? STATUS_CONFIG.DRAFT_ORDER;
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
      { field: "vendorName", headerName: "Vendor", minWidth: 160, editable: false },
      { field: "shipToVendorName", headerName: "Ship To", minWidth: 160, editable: false },
      {
        field: "lineCount",
        headerName: "Line Items",
        minWidth: 100,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "totalAmount",
        headerName: "Total (Rs)",
        minWidth: 130,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) =>
          (p.value as number).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
          colStateKey="ag-grid-col-state-accessory-purchase-orders"
        />
      </div>

      <DataGrid<PurchaseOrderRow>
        gridId="accessory-purchase-orders"
        rowData={orders}
        columnDefs={columnDefs}
        defaultRow={{}}
        getRowId={(d) => d.poNumber}
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
