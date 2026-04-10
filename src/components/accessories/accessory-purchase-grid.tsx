"use client";

import { useMemo, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryPurchaseSheet, type AccessoryPurchaseRow } from "./accessory-purchase-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";

type Vendor = { id: string; name: string };
type AccessoryOption = {
  id: string;
  baseName: string;
  colour: string | null;
  size: string | null;
  unit: string;
  defaultCostPerUnit: number | null;
  vendorId: string | null;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function AccessoryPurchaseGrid({
  purchases,
  phaseId,
  accessories,
  vendors,
}: {
  purchases: unknown[];
  phaseId: string;
  accessories: AccessoryOption[];
  vendors: Vendor[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryPurchaseRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: AccessoryPurchaseRow[] = useMemo(
    () =>
      (purchases as Record<string, unknown>[]).map((p) => {
        const acc = p.accessory as Record<string, unknown> | undefined;
        const vendor = p.vendor as Record<string, unknown> | undefined;
        return {
          id: p.id as string,
          phaseId: p.phaseId as string,
          accessoryId: p.accessoryId as string,
          accessoryDisplayName: acc
            ? accessoryDisplayName({
                baseName: String(acc.baseName ?? ""),
                colour: (acc.colour as string | null) ?? null,
                size: (acc.size as string | null) ?? null,
              })
            : "(unknown)",
          accessoryUnit: String((acc?.unit as string) || ""),
          vendorId: (p.vendorId as string | null) ?? null,
          vendorName: vendor ? String(vendor.name ?? "") : null,
          quantity: Number(p.quantity ?? 0),
          costPerUnit: toNum(p.costPerUnit),
          invoiceNumber: (p.invoiceNumber as string | null) ?? null,
          purchaseDate: (p.purchaseDate as string | null) ?? null,
          comments: (p.comments as string | null) ?? null,
        };
      }),
    [purchases]
  );

  const columnDefs = useMemo<ColDef<AccessoryPurchaseRow>[]>(
    () => [
      {
        field: "purchaseDate",
        headerName: "Date",
        minWidth: 110,
        editable: false,
        valueFormatter: (p) =>
          p.value ? new Date(p.value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
      },
      {
        field: "accessoryDisplayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 220,
        editable: false,
      },
      { field: "accessoryUnit", headerName: "Unit", minWidth: 80, editable: false },
      {
        field: "quantity",
        headerName: "Quantity",
        minWidth: 100,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "costPerUnit",
        headerName: "Cost / unit",
        minWidth: 110,
        type: "numericColumn",
        editable: false,
      },
      {
        headerName: "Total",
        minWidth: 120,
        type: "numericColumn",
        editable: false,
        valueGetter: (p) => (p.data ? p.data.quantity * (p.data.costPerUnit || 0) : 0),
        valueFormatter: (p) =>
          (p.value as number).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      { field: "vendorName", headerName: "Vendor", minWidth: 140, editable: false },
      { field: "invoiceNumber", headerName: "Invoice #", minWidth: 120, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ],
    []
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setSheetOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Purchase
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-purchases"
        />
      </div>
      <DataGrid<AccessoryPurchaseRow>
        gridId="accessory-purchases"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "purchaseDate", sort: "desc" }]}
        hideAddRowButtons
        onRowClicked={(data) => { setEditingRow(data); setSheetOpen(true); }}
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <AccessoryPurchaseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        phaseId={phaseId}
        accessories={accessories}
        vendors={vendors}
      />
    </>
  );
}
