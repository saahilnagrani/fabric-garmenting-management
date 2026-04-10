"use client";

import { useMemo, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { FabricBalanceSheet, type FabricBalanceRow } from "./fabric-balance-sheet";

type FabricMasterOption = {
  id: string;
  fabricName: string;
  vendorId: string;
  vendorName: string;
  coloursAvailable: string[];
};

type PhaseOption = { id: string; label: string };

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FabricBalanceGrid({
  balances,
  fabricMasters,
  phases,
}: {
  balances: unknown[];
  fabricMasters: FabricMasterOption[];
  phases: PhaseOption[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FabricBalanceRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: FabricBalanceRow[] = useMemo(
    () =>
      (balances as Record<string, unknown>[]).map((b) => {
        const fm = b.fabricMaster as Record<string, unknown> | undefined;
        const vendor = b.vendor as Record<string, unknown> | undefined;
        const sourcePhase = b.sourcePhase as Record<string, unknown> | undefined;
        const targetPhase = b.targetPhase as Record<string, unknown> | undefined;
        return {
          id: b.id as string,
          fabricMasterId: b.fabricMasterId as string,
          fabricName: fm ? String(fm.fabricName ?? "") : "",
          vendorId: b.vendorId as string,
          vendorName: vendor ? String(vendor.name ?? "") : "",
          colour: String(b.colour ?? ""),
          remainingKg: Number(b.remainingKg ?? 0),
          costPerKg: Number(b.costPerKg ?? 0),
          sourcePhaseId: (b.sourcePhaseId as string | null) ?? null,
          sourcePhaseLabel: sourcePhase
            ? `Phase ${sourcePhase.number} — ${sourcePhase.name}`
            : null,
          targetPhaseId: (b.targetPhaseId as string | null) ?? null,
          targetPhaseLabel: targetPhase
            ? `Phase ${targetPhase.number} — ${targetPhase.name}`
            : null,
          notes: (b.notes as string | null) ?? null,
        };
      }),
    [balances]
  );

  const columnDefs = useMemo<ColDef<FabricBalanceRow>[]>(
    () => [
      { field: "fabricName", headerName: "Fabric", pinned: "left", minWidth: 200, editable: false },
      { field: "vendorName", headerName: "Vendor", minWidth: 160, editable: false },
      { field: "colour", headerName: "Colour", minWidth: 120, editable: false },
      {
        field: "remainingKg",
        headerName: "Remaining (kg)",
        minWidth: 130,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) =>
          p.value != null ? Number(p.value).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "",
      },
      {
        field: "costPerKg",
        headerName: "Cost / kg",
        minWidth: 110,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Cost Attributed",
        minWidth: 140,
        type: "numericColumn",
        editable: false,
        valueGetter: (p) => (p.data ? p.data.remainingKg * p.data.costPerKg : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      { field: "sourcePhaseLabel", headerName: "From Phase", minWidth: 160, editable: false },
      { field: "targetPhaseLabel", headerName: "For Phase", minWidth: 160, editable: false },
      { field: "notes", headerName: "Notes", minWidth: 180, editable: false },
    ],
    []
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setSheetOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Balance
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-fabric-balance"
        />
      </div>
      <DataGrid<FabricBalanceRow>
        gridId="fabric-balance"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "fabricName", sort: "asc" }]}
        hideAddRowButtons
        onRowClicked={(data) => { setEditingRow(data); setSheetOpen(true); }}
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <FabricBalanceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        fabricMasters={fabricMasters}
        phases={phases}
      />
    </>
  );
}
