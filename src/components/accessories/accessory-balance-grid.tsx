"use client";

import { useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type BalanceRowVM = {
  accessoryId: string;
  displayName: string;
  category: string;
  unit: string;
  opening: number;
  purchasedInPhase: number;
  dispatchedInPhase: number;
  closing: number;
  [key: string]: unknown;
};

type Phase = { id: string; name: string; number: number };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

export function AccessoryBalanceGrid({
  rows,
  phases,
  selectedPhaseId,
}: {
  rows: BalanceRowVM[];
  phases: Phase[];
  selectedPhaseId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  function changePhase(id: string) {
    if (pathname.startsWith("/accessories")) {
      router.push(`/accessories?tab=balance&phaseId=${id}`);
    } else {
      router.push(`/accessory-balance?phaseId=${id}`);
    }
  }

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);
  const selectedLabel = selectedPhase ? `Phase ${selectedPhase.number} — ${selectedPhase.name}` : "Select phase...";

  const columnDefs = useMemo<ColDef<BalanceRowVM>[]>(
    () => [
      {
        field: "displayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 220,
        editable: false,
      },
      { field: "category", headerName: "Category", minWidth: 120, editable: false },
      { field: "unit", headerName: "Unit", minWidth: 80, editable: false },
      {
        field: "opening",
        headerName: "Opening",
        minWidth: 110,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) => fmt(p.value as number),
      },
      {
        field: "purchasedInPhase",
        headerName: "Purchased",
        minWidth: 110,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) => fmt(p.value as number),
      },
      {
        field: "dispatchedInPhase",
        headerName: "Dispatched",
        minWidth: 110,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) => fmt(p.value as number),
      },
      {
        field: "closing",
        headerName: "Closing",
        minWidth: 120,
        type: "numericColumn",
        editable: false,
        valueFormatter: (p) => fmt(p.value as number),
        cellStyle: (p) => {
          const v = p.value as number;
          if (v < 0) return { color: "#b91c1c", fontWeight: 600 };
          if (v === 0) return { color: "#9ca3af" };
          return { fontWeight: 600 };
        },
      },
    ],
    []
  );

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Phase:</Label>
          <Select key={selectedPhaseId} value={selectedPhaseId} onValueChange={changePhase}>
            <SelectTrigger className="h-8 text-xs w-[220px]">
              <span className="truncate">{selectedLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {phases.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Phase {p.number} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-balance"
        />
      </div>
      <DataGrid<BalanceRowVM>
        gridId="accessory-balance"
        rowData={rows}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "displayName", sort: "asc" }]}
        hideAddRowButtons
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
    </>
  );
}
