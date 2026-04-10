"use client";

import { useMemo, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Plus, Printer } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryDispatchSheet, type AccessoryDispatchRow } from "./accessory-dispatch-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";

type AccessoryOption = {
  id: string;
  baseName: string;
  colour: string | null;
  size: string | null;
  unit: string;
};

type ProductOption = { id: string; label: string };

export function AccessoryDispatchGrid({
  dispatches,
  phaseId,
  accessories,
  garmenters,
  products,
  productsByAccessory = {},
}: {
  dispatches: unknown[];
  phaseId: string;
  accessories: AccessoryOption[];
  garmenters: string[];
  products: ProductOption[];
  productsByAccessory?: Record<string, string[]>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryDispatchRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: AccessoryDispatchRow[] = useMemo(
    () =>
      (dispatches as Record<string, unknown>[]).map((d) => {
        const acc = d.accessory as Record<string, unknown> | undefined;
        const product = d.product as Record<string, unknown> | undefined;
        return {
          id: d.id as string,
          phaseId: d.phaseId as string,
          accessoryId: d.accessoryId as string,
          accessoryDisplayName: acc
            ? accessoryDisplayName({
                baseName: String(acc.baseName ?? ""),
                colour: (acc.colour as string | null) ?? null,
                size: (acc.size as string | null) ?? null,
              })
            : "(unknown)",
          accessoryUnit: String((acc?.unit as string) || ""),
          quantity: Number(d.quantity ?? 0),
          destinationGarmenter: (d.destinationGarmenter as string | null) ?? null,
          productId: (d.productId as string | null) ?? null,
          productLabel: product
            ? `${product.articleNumber || ""} ${product.colourOrdered || ""}`.trim() ||
              String(product.productName || "")
            : null,
          dispatchDate: (d.dispatchDate as string | null) ?? null,
          comments: (d.comments as string | null) ?? null,
        };
      }),
    [dispatches]
  );

  const columnDefs = useMemo<ColDef<AccessoryDispatchRow>[]>(
    () => [
      {
        field: "dispatchDate",
        headerName: "Date",
        minWidth: 130,
        editable: false,
        checkboxSelection: true,
        headerCheckboxSelection: true,
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
      { field: "destinationGarmenter", headerName: "To Garmenter", minWidth: 150, editable: false },
      { field: "productLabel", headerName: "Linked Article", minWidth: 150, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ],
    []
  );

  function generateDispatchNote() {
    if (!gridApiRef.current) return;
    const selected = gridApiRef.current.getSelectedRows() as AccessoryDispatchRow[];
    if (selected.length === 0) {
      alert("Select at least one dispatch row first.");
      return;
    }
    const ids = selected.map((r) => r.id).join(",");
    window.open(`/accessory-dispatches/dispatch-note?ids=${ids}`, "_blank");
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setSheetOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Dispatch
        </Button>
        <Button variant="outline" size="sm" onClick={generateDispatchNote}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Generate Dispatch Note
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-dispatches"
        />
      </div>
      <DataGrid<AccessoryDispatchRow>
        gridId="accessory-dispatches"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "dispatchDate", sort: "desc" }]}
        hideAddRowButtons
        rowSelection="multiple"
        onRowClicked={(data) => { setEditingRow(data); setSheetOpen(true); }}
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <AccessoryDispatchSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        phaseId={phaseId}
        accessories={accessories}
        garmenters={garmenters}
        products={products}
        productsByAccessory={productsByAccessory}
      />
    </>
  );
}
