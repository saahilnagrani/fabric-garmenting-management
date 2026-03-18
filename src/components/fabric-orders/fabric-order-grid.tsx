"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef, GridApi, GridReadyEvent, ColumnState, ColumnPinnedType, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { updateFabricOrder } from "@/actions/fabric-orders";
import { GENDER_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Strikethrough, Check } from "lucide-react";
import { toast } from "sonner";
import { FabricOrderSheet } from "./fabric-order-sheet";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "@/components/ag-grid/add-column-dialog";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(o: any): Record<string, unknown> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: o.id,
    phaseId: o.phaseId,
    vendorId: s(o.vendorId),
    styleNumbers: s(o.styleNumbers),
    fabricName: s(o.fabricName),
    colour: s(o.colour),
    gender: s(o.gender),
    billNumber: s(o.billNumber),
    receivedAt: s(o.receivedAt),
    availableColour: s(o.availableColour),
    costPerUnit: toNum(o.costPerUnit),
    quantityOrdered: toNum(o.quantityOrdered),
    quantityShipped: toNum(o.quantityShipped),
    fabricCostTotal: toNum(o.fabricCostTotal),
    orderDate: s(o.orderDate),
    isRepeat: Boolean(o.isRepeat),
    isStrikedThrough: Boolean(o.isStrikedThrough),
  };
}

const COL_STATE_KEY = "ag-grid-col-state-fabric-orders";

export function FabricOrderGrid({
  orders,
  vendors,
  currentTab,
  phaseId,
  fabricMasters,
}: {
  orders: unknown[];
  vendors: Vendor[];
  currentTab: string;
  phaseId: string;
  fabricMasters: FabricMasterType[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gridApiRef = useRef<GridApi | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom columns
  const { columns: customColumns, addColumn, removeColumn, enrichRowData } = useCustomColumns("fabric-orders");

  // Check if saved state exists (for autoSizeStrategy)
  const hasSavedColState = typeof window !== "undefined" && !!localStorage.getItem(COL_STATE_KEY);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(COL_STATE_KEY, JSON.stringify(state));
  }, []);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  const rowData = useMemo((): Record<string, unknown>[] => {
    return (orders as Record<string, unknown>[]).map((o) => toRow(o));
  }, [orders]);

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const numCol = (field: string, headerName: string, w = 80): ColDef => ({
    field, headerName, minWidth: w, type: "numericColumn", editable: false,
  });

  const baseColumnDefs = useMemo<ColDef[]>(() => [
    { field: "fabricName", headerName: "Fabric Name", minWidth: 120, pinned: "left", editable: false },
    { field: "vendorId", headerName: "Vendor", minWidth: 120, editable: false, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "orderDate", headerName: "Order Date", minWidth: 130, editable: false },
    { field: "styleNumbers", headerName: "Fabric used for styles", minWidth: 160, editable: false },
    { field: "colour", headerName: "Colours", minWidth: 100, editable: false },
    { field: "availableColour", headerName: "Avail. Colour", minWidth: 110, editable: false },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: false, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "billNumber", headerName: "Invoice #", minWidth: 90, editable: false },
    { field: "receivedAt", headerName: "Received At", minWidth: 130, editable: false },
    numCol("costPerUnit", "Cost/Unit", 85),
    numCol("quantityOrdered", "Ordered Qty (kg)", 110),
    numCol("quantityShipped", "Shipped Qty (kg)", 110),
    numCol("fabricCostTotal", "Expected Cost (Rs)", 130),
    // Computed: Ordered Qty * Cost/Unit
    {
      headerName: "Fabric Cost (Rs)", minWidth: 110, editable: false, cellClass: "computed-cell",
      valueGetter: (p) => {
        if (!p.data) return 0;
        const cost = toNum(p.data.costPerUnit) || 0;
        const qty = toNum(p.data.quantityOrdered) || 0;
        return cost * qty;
      },
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: "isRepeat", headerName: "Repeat", minWidth: 75, maxWidth: 75, editable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        const checked = Boolean(params.data.isRepeat);
        return (
          <div className="flex items-center justify-center h-full">
            <div className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}>
              {checked && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // Merge custom columns and actions column
  const columnDefs = useMemo<ColDef[]>(() => {
    const customColDefs: ColDef[] = customColumns.map((c) => ({
      field: c.field,
      headerName: c.headerName,
      minWidth: 100,
      editable: false,
    }));

    return [
      ...baseColumnDefs,
      ...customColDefs,
      // Actions
      {
        headerName: "", field: "__actions", width: 45, maxWidth: 45, pinned: "right", editable: false, sortable: false,
        cellRenderer: (params: { data: Record<string, unknown> }) => {
          if (!params.data) return null;
          const isStruck = Boolean(params.data.isStrikedThrough);
          return (
            <button onClick={(e) => { e.stopPropagation(); handleStrikethrough(params.data); }} className={`p-1 ${isStruck ? "opacity-100" : "opacity-40 hover:opacity-100"}`} title={isStruck ? "Remove strikethrough" : "Strikethrough row"}>
              <Strikethrough className={`h-3.5 w-3.5 ${isStruck ? "text-red-500" : "text-gray-500"}`} />
            </button>
          );
        },
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColumnDefs, customColumns]);

  async function handleStrikethrough(data: Record<string, unknown>) {
    const rowId = String(data.id);
    const toggled = !data.isStrikedThrough;
    try {
      await updateFabricOrder(rowId, { isStrikedThrough: toggled });
      toast.success(toggled ? "Row striked through" : "Strikethrough removed");
      router.refresh();
    } catch { toast.error("Failed to update"); }
  }

  function handleRowClicked(event: RowClickedEvent) {
    // Skip if clicking the actions column (strikethrough button)
    const target = event.event?.target as HTMLElement | null;
    if (target?.closest("[col-id='__actions']")) return;
    if (event.data) {
      setEditingRow(event.data);
      setSheetOpen(true);
    }
  }

  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }

  function applyFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/fabric-orders?${params.toString()}`);
  }

  const tabs = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "repeat", label: "Repeat" },
  ];

  const enrichedData = useMemo(() => {
    const sorted = [...rowData].sort((a, b) => {
      const aStruck = a.isStrikedThrough ? 1 : 0;
      const bStruck = b.isStrikedThrough ? 1 : 0;
      return aStruck - bStruck;
    });
    return enrichRowData(sorted);
  }, [rowData, enrichRowData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Button key={tab.key} variant={currentTab === tab.key ? "default" : "outline"} size="sm" onClick={() => applyFilter("tab", tab.key)}>
            {tab.label}
          </Button>
        ))}
        <div className="ml-auto" />
        <Select value={searchParams.get("vendor") || "all"} onValueChange={(v) => applyFilter("vendor", v)}>
          <SelectTrigger className="w-[150px]">
            <span className="truncate">{vendorLabels[searchParams.get("vendor") || ""] || "All Vendors"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Fabric Order
        </Button>
        <AddColumnButton
          columns={customColumns}
          onAdd={addColumn}
          onRemove={removeColumn}
        />
      </div>

      <FabricOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vendors={vendors}
        phaseId={phaseId}
        fabricMasters={fabricMasters}
        isRepeatTab={currentTab === "repeat"}
        editingRow={editingRow}
      />

      <div className="ag-theme-quartz" style={{ height: "600px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem(COL_STATE_KEY);
            if (saved) {
              try {
                const parsed: ColumnState[] = JSON.parse(saved);
                // Preserve pinned settings from column defs
                const pinnedMap: Record<string, ColumnPinnedType> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field] = col.pinned as ColumnPinnedType; });
                const merged = parsed.map((cs) => {
                  if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
                  return cs;
                });
                e.api.applyColumnState({ state: merged, applyOrder: true });
              } catch {
                // ignore
              }
            }
            // Always apply default sort if no sort is currently set
            const currentState = e.api.getColumnState();
            const hasSort = currentState.some((cs) => cs.sort);
            if (!hasSort) {
              e.api.applyColumnState({
                state: [{ colId: "orderDate", sort: "desc" }],
                defaultState: { sort: null },
              });
            }
          }}
          onRowClicked={handleRowClicked}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          onSortChanged={saveColumnState}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: false, sortable: true, unSortIcon: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={hasSavedColState ? undefined : { type: "fitCellContents" }}
          rowClass="group"
          getRowClass={(params) => params.data?.isStrikedThrough ? "strikethrough-row" : undefined}
          animateRows={false}
        />
      </div>

    </div>
  );
}
