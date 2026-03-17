"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef, CellValueChangedEvent, GridApi, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createFabricOrder, updateFabricOrder, deleteFabricOrder } from "@/actions/fabric-orders";
import { validateFabricOrder } from "@/lib/validations";
import { GENDER_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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
    isRepeat: Boolean(o.isRepeat),
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
    isRepeat: Boolean(data.isRepeat),
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
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isAutoPopulating = useRef(false);

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
    { field: "vendorId", headerName: "Vendor", minWidth: 120, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: vendorValues }, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "styleNumbers", headerName: "Style #s", minWidth: 130, editable: true },
    { field: "fabricName", headerName: "Fabric", minWidth: 120, editable: true },
    { field: "colour", headerName: "Colour", minWidth: 100, editable: true },
    { field: "availableColour", headerName: "Avail. Colour", minWidth: 110, editable: true },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: genderValues }, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "billNumber", headerName: "Bill #", minWidth: 90, editable: true },
    { field: "receivedAt", headerName: "Received At", minWidth: 110, editable: true },
    numCol("costPerUnit", "Cost/Unit", 85),
    numCol("quantityOrdered", "Ordered", 80),
    numCol("quantityShipped", "Shipped", 80),
    numCol("fabricCostTotal", "Total Cost", 90),
    // Computed: cost * qty
    {
      headerName: "Calc Cost", minWidth: 90, editable: false, cellClass: "computed-cell",
      valueGetter: (p) => {
        if (!p.data) return 0;
        const cost = toNum(p.data.costPerUnit) || 0;
        const qty = toNum(p.data.quantityOrdered) || 0;
        return cost * qty;
      },
      valueFormatter: (p) => formatCurrency(p.value),
    },
    { field: "isRepeat", headerName: "Rpt", minWidth: 55, maxWidth: 55, editable: true, cellDataType: "boolean" },
    // Actions
    {
      headerName: "", width: 45, maxWidth: 45, pinned: "right", editable: false, sortable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        return (
          <button onClick={() => handleDelete(params.data)} className="opacity-50 hover:opacity-100 p-1">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        const created = await createFabricOrder(toPayload(data, phaseId));
        const api = gridApiRef.current;
        if (api) {
          api.applyTransaction({ remove: [data] });
          api.applyTransaction({ add: [{ ...toRow(created), __status: "clean" }] });
        }
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
      }
    }

    debouncedSave(event.data);
  }

  async function handleDelete(data: Record<string, unknown>) {
    const rowId = String(data.id);
    if (rowId.startsWith("__new_")) {
      gridApiRef.current?.applyTransaction({ remove: [data] });
      return;
    }
    try {
      await deleteFabricOrder(rowId);
      gridApiRef.current?.applyTransaction({ remove: [data] });
      toast.success("Order deleted");
    } catch { toast.error("Failed to delete"); }
  }

  function addRow() {
    const id = `__new_${++tempId}_${Date.now()}`;
    gridApiRef.current?.applyTransaction({
      add: [{
        id, phaseId, vendorId: vendors[0]?.id || "", styleNumbers: "", fabricName: "",
        colour: "", gender: "", billNumber: "", receivedAt: "", availableColour: "",
        costPerUnit: null, quantityOrdered: null, quantityShipped: null, fabricCostTotal: null,
        isRepeat: currentTab === "repeat", __status: "dirty",
      }],
      addIndex: 0,
    });
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

  const enrichedData = useMemo(() =>
    rowData.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || "clean" })),
    [rowData, statusMap]
  );

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
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Vendor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="ag-theme-quartz" style={{ height: "600px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => { gridApiRef.current = e.api; }}
          onCellValueChanged={onCellValueChanged}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: true, sortable: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          rowClass="group"
          animateRows={false}
        />
      </div>

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row
      </Button>
    </div>
  );
}
