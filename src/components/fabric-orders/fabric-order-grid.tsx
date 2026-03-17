"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef, CellValueChangedEvent, GridApi, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { createFabricOrder, updateFabricOrder } from "@/actions/fabric-orders";
import { validateFabricOrder } from "@/lib/validations";
import { GENDER_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Strikethrough, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DateCellEditor } from "@/components/ag-grid/date-cell-editor";
import { FabricOrderSheet } from "./fabric-order-sheet";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;
type RowStatus = "clean" | "dirty" | "saving" | "error";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPayload(data: Record<string, unknown>, phaseId?: string): any {
  const numOrNull = (v: unknown) => toNum(v);
  const strOrNull = (v: unknown) => (v ? String(v) : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    vendorId: String(data.vendorId || ""),
    styleNumbers: String(data.styleNumbers || ""),
    fabricName: String(data.fabricName || ""),
    colour: String(data.colour || ""),
    gender: strOrNull(data.gender),
    billNumber: strOrNull(data.billNumber),
    receivedAt: strOrNull(data.receivedAt),
    availableColour: strOrNull(data.availableColour),
    costPerUnit: numOrNull(data.costPerUnit),
    quantityOrdered: numOrNull(data.quantityOrdered),
    quantityShipped: numOrNull(data.quantityShipped),
    fabricCostTotal: numOrNull(data.fabricCostTotal),
    orderDate: strOrNull(data.orderDate),
    isRepeat: Boolean(data.isRepeat),
    isStrikedThrough: Boolean(data.isStrikedThrough),
  };
  if (phaseId) payload.phaseId = phaseId;
  return payload;
}

function StatusCellRenderer(props: { data: { __status?: RowStatus } }) {
  const status = props.data?.__status;
  if (status === "saving") return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (status === "error") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (status === "dirty") return <div className="h-2 w-2 rounded-full bg-yellow-400" />;
  return <Check className="h-3 w-3 text-green-500 opacity-0 group-hover:opacity-100" />;
}

let tempId = 0;

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
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const [tempRows, setTempRows] = useState<Record<string, unknown>[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isAutoPopulating = useRef(false);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem("ag-grid-col-state-fabric-orders", JSON.stringify(state));
  }, []);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  const rowData = useMemo((): (Record<string, unknown> & { __status: RowStatus })[] => {
    return (orders as Record<string, unknown>[]).map((o) => ({
      ...toRow(o),
      __status: "clean" as RowStatus,
    }));
  }, [orders]);

  const vendorValues = vendors.map((v) => v.id);
  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });
  const genderValues = Object.keys(GENDER_LABELS);

  const numCol = (field: string, headerName: string, w = 80): ColDef => ({
    field, headerName, minWidth: w, type: "numericColumn", editable: true,
    valueParser: (p) => toNum(p.newValue),
  });

  const columnDefs = useMemo<ColDef[]>(() => [
    { headerName: "", field: "__status", width: 40, maxWidth: 40, pinned: "left", editable: false, sortable: false, cellRenderer: StatusCellRenderer, cellClass: "status-cell" },
    { field: "fabricName", headerName: "Fabric Name", minWidth: 120, pinned: "left", editable: true },
    { field: "vendorId", headerName: "Vendor", minWidth: 120, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: vendorValues }, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "orderDate", headerName: "Order Date", minWidth: 130, editable: true, cellEditor: DateCellEditor },
    { field: "styleNumbers", headerName: "Fabric used for styles", minWidth: 160, editable: true },
    { field: "colour", headerName: "Colours", minWidth: 100, editable: true },
    { field: "availableColour", headerName: "Avail. Colour", minWidth: 110, editable: true },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: genderValues }, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "billNumber", headerName: "Invoice #", minWidth: 90, editable: true },
    { field: "receivedAt", headerName: "Received At", minWidth: 130, editable: true, cellEditor: DateCellEditor },
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
            <button
              onClick={() => {
                const rowId = String(params.data.id);
                const updated = { ...params.data, isRepeat: !checked };
                gridApiRef.current?.applyTransaction({ update: [updated] });
                setStatus(rowId, "dirty");
                if (rowId.startsWith("__new_")) {
                  setTempRows((prev) => prev.map((r) => String(r.id) === rowId ? updated : r));
                }
                debouncedSave(updated);
              }}
              className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}
            >
              {checked && <Check className="h-3 w-3 text-white" />}
            </button>
          </div>
        );
      },
    },
    // Actions
    {
      headerName: "", width: 45, maxWidth: 45, pinned: "right", editable: false, sortable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        const isStruck = Boolean(params.data.isStrikedThrough);
        return (
          <button onClick={() => handleStrikethrough(params.data)} className={`p-1 ${isStruck ? "opacity-100" : "opacity-40 hover:opacity-100"}`} title={isStruck ? "Remove strikethrough" : "Strikethrough row"}>
            <Strikethrough className={`h-3.5 w-3.5 ${isStruck ? "text-red-500" : "text-gray-500"}`} />
          </button>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  function setStatus(id: string, status: RowStatus) {
    setStatusMap((prev) => { const next = new Map(prev); next.set(id, status); return next; });
  }

  const saveRow = useCallback(async (data: Record<string, unknown>) => {
    const rowId = String(data.id);
    const isNew = rowId.startsWith("__new_");

    if (validateFabricOrder(data)) {
      setStatus(rowId, "error");
      return;
    }

    setStatus(rowId, "saving");
    try {
      if (isNew) {
        await createFabricOrder(toPayload(data, phaseId));
        setTempRows((prev) => prev.filter((r) => String(r.id) !== rowId));
        setStatusMap((prev) => { const next = new Map(prev); next.delete(rowId); return next; });
        toast.success("Order created");
      } else {
        await updateFabricOrder(rowId, toPayload(data));
        setStatus(rowId, "clean");
      }
    } catch {
      setStatus(rowId, "error");
      toast.error("Failed to save");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId]);

  function debouncedSave(data: Record<string, unknown>) {
    const rowId = String(data.id);
    const existing = saveTimers.current.get(rowId);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(rowId, setTimeout(() => { saveTimers.current.delete(rowId); saveRow(data); }, 800));
  }

  function onCellValueChanged(event: CellValueChangedEvent) {
    if (isAutoPopulating.current || !event.data) return;
    const rowId = String(event.data.id);
    setStatus(rowId, "dirty");

    let dataToSave = event.data;

    // Auto-populate from FabricMaster when fabricName changes
    if (event.column.getColId() === "fabricName" && event.data.fabricName) {
      const master = fabricMasters.find((m) => String(m.fabricName) === event.data.fabricName);
      if (master) {
        isAutoPopulating.current = true;
        const merged = { ...event.data };
        if (master.vendorId) merged.vendorId = String(master.vendorId);
        if (master.mrp !== undefined && master.mrp !== null) merged.costPerUnit = toNum(master.mrp);
        gridApiRef.current?.applyTransaction({ update: [merged] });
        setTimeout(() => { isAutoPopulating.current = false; }, 100);
        dataToSave = merged;
      }
    }

    // Keep temp rows in sync with grid edits
    if (rowId.startsWith("__new_")) {
      setTempRows((prev) => prev.map((r) => String(r.id) === rowId ? { ...dataToSave } : r));
    }

    debouncedSave(dataToSave);
  }

  async function handleStrikethrough(data: Record<string, unknown>) {
    const rowId = String(data.id);
    if (rowId.startsWith("__new_")) {
      setTempRows((prev) => prev.filter((r) => String(r.id) !== rowId));
      setStatusMap((prev) => { const next = new Map(prev); next.delete(rowId); return next; });
      return;
    }
    const toggled = !data.isStrikedThrough;
    try {
      await updateFabricOrder(rowId, { isStrikedThrough: toggled });
      const updated = { ...data, isStrikedThrough: toggled };
      gridApiRef.current?.applyTransaction({ update: [updated] });
      toast.success(toggled ? "Row striked through" : "Strikethrough removed");
    } catch { toast.error("Failed to update"); }
  }

  function addRow(position: "top" | "bottom") {
    const id = `__new_${++tempId}_${Date.now()}`;
    const newRow = {
      id, phaseId, vendorId: vendors[0]?.id || "", styleNumbers: "", fabricName: "",
      colour: "", gender: "", billNumber: "", receivedAt: "", availableColour: "",
      costPerUnit: null, quantityOrdered: null, quantityShipped: null, fabricCostTotal: null,
      orderDate: "", isRepeat: currentTab === "repeat", isStrikedThrough: false,
    };
    setTempRows((prev) => position === "top" ? [newRow, ...prev] : [...prev, newRow]);
    setStatus(id, "dirty");
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
    const serverRows = rowData.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("clean" as RowStatus) }));
    const tempEnriched = tempRows.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("dirty" as RowStatus) }));
    const all = [...tempEnriched, ...serverRows];
    return all.sort((a, b) => {
      const aStruck = (a as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      const bStruck = (b as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      return aStruck - bStruck;
    });
  }, [rowData, statusMap, tempRows]);

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

      <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Fabric Order
      </Button>

      <FabricOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vendors={vendors}
        phaseId={phaseId}
        fabricMasters={fabricMasters}
        isRepeatTab={currentTab === "repeat"}
      />

      <div className="ag-theme-quartz" style={{ height: "600px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem("ag-grid-col-state-fabric-orders");
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                // Preserve pinned settings from column defs
                const pinnedMap: Record<string, string | null> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field] = col.pinned as string; });
                const merged = parsed.map((cs: { colId?: string; pinned?: string | null }) => {
                  if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
                  return cs;
                });
                e.api.applyColumnState({ state: merged, applyOrder: true });
              } catch {
                // Ignore invalid saved state
              }
            }
          }}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: true, sortable: true, unSortIcon: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          rowClass="group"
          getRowClass={(params) => params.data?.isStrikedThrough ? "strikethrough-row" : undefined}
          animateRows={false}
        />
      </div>

    </div>
  );
}
