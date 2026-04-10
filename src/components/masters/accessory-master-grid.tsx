"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryMasterSheet, type AccessoryMasterRow } from "./accessory-master-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function AccessoryMasterGrid({
  masters,
  vendors,
  categories,
  showArchived = false,
}: {
  masters: unknown[];
  vendors: Vendor[];
  categories: string[];
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryMasterRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: AccessoryMasterRow[] = useMemo(
    () =>
      (masters as Record<string, unknown>[]).map((m) => ({
        id: m.id as string,
        baseName: String(m.baseName ?? ""),
        colour: (m.colour as string | null) ?? null,
        size: (m.size as string | null) ?? null,
        category: String(m.category ?? ""),
        unit: String(m.unit ?? "PIECES"),
        vendorId: (m.vendorId as string | null) ?? null,
        defaultCostPerUnit: toNum(m.defaultCostPerUnit),
        hsnCode: (m.hsnCode as string | null) ?? null,
        comments: (m.comments as string | null) ?? null,
        isStrikedThrough: Boolean(m.isStrikedThrough),
        displayName: accessoryDisplayName({
          baseName: String(m.baseName ?? ""),
          colour: (m.colour as string | null) ?? null,
          size: (m.size as string | null) ?? null,
        }),
      })),
    [masters]
  );

  const columnDefs = useMemo<ColDef<AccessoryMasterRow>[]>(() => {
    const vendorLabels: Record<string, string> = {};
    vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

    return [
      {
        field: "displayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 220,
        editable: false,
      },
      { field: "category", headerName: "Category", minWidth: 120, editable: false },
      { field: "unit", headerName: "Unit", minWidth: 90, editable: false },
      {
        field: "vendorId",
        headerName: "Vendor",
        minWidth: 140,
        editable: false,
        valueFormatter: (p) => (p.value ? vendorLabels[p.value] || p.value : ""),
      },
      {
        field: "defaultCostPerUnit",
        headerName: "Default Cost",
        minWidth: 110,
        editable: false,
        type: "numericColumn",
      },
      { field: "hsnCode", headerName: "HSN", minWidth: 90, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ];
  }, [vendors]);

  const defaultRow: Partial<AccessoryMasterRow> = {
    baseName: "",
    colour: null,
    size: null,
    category: "",
    unit: "PIECES",
    vendorId: null,
    defaultCostPerUnit: null,
  };

  function handleRowClicked(data: AccessoryMasterRow) {
    setEditingRow(data);
    setSheetOpen(true);
  }
  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }
  function toggleArchived() {
    router.push(showArchived ? "/accessory-masters" : "/accessory-masters?showArchived=true");
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Accessory
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-masters"
        />
        <Button variant="ghost" size="sm" onClick={toggleArchived} className="text-muted-foreground">
          {showArchived ? (
            <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide Archived</>
          ) : (
            <><Eye className="mr-1.5 h-3.5 w-3.5" />Show Archived</>
          )}
        </Button>
      </div>
      <DataGrid<AccessoryMasterRow>
        gridId="accessory-masters"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={defaultRow}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "displayName", sort: "asc" }]}
        hideAddRowButtons
        onRowClicked={handleRowClicked}
        getRowClass={(params) => (params.data?.isStrikedThrough ? "opacity-40" : "")}
        // Master grid is read-only — sheet handles all writes. Stub onCreate/onSave.
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <AccessoryMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        vendors={vendors}
        categories={categories}
      />
    </>
  );
}
