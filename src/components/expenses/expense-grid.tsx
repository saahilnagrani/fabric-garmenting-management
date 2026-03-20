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
import { createExpense, updateExpense } from "@/actions/expenses";
import { validateExpense } from "@/lib/validations";
import { EXPENSE_TYPE_LABELS, FABRIC_STATUS_LABELS, DELIVERY_LOCATIONS } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DateCellEditor } from "@/components/ag-grid/date-cell-editor";
import { ExpenseDetailSheet } from "./expense-detail-sheet";
import type { RowClickedEvent } from "ag-grid-community";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string };
type RowStatus = "clean" | "dirty" | "saving" | "error";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function toDateStr(v: unknown): string {
  if (!v) return "";
  try {
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
  } catch { return ""; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(e: any): Record<string, unknown> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: e.id,
    phaseId: e.phaseId,
    invoiceNumber: s(e.invoiceNumber),
    vendorId: s(e.vendorId),
    specification: s(e.specification) || "FABRIC_VENDOR",
    sourceType: s(e.sourceType) || "MANUAL",
    date: toDateStr(e.date),
    description: s(e.description),
    quantity: s(e.quantity),
    amount: toNum(e.amount),
    deliveredAt: s(e.deliveredAt),
    productNote: s(e.productNote),
    note: s(e.note),
    garmentBifurcation: s(e.garmentBifurcation),
    totalGarments: toNum(e.totalGarments),
    fabricStatus: s(e.fabricStatus),
    inwardDate: toDateStr(e.inwardDate),
    expectedInward: toDateStr(e.expectedInward),
    actualInward: toDateStr(e.actualInward),
    isStrikedThrough: Boolean(e.isStrikedThrough),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPayload(data: Record<string, unknown>, phaseId?: string): any {
  const numOrNull = (v: unknown) => toNum(v);
  const intOrNull = (v: unknown) => { const n = toNum(v); return n !== null ? Math.round(n) : null; };
  const strOrNull = (v: unknown) => (v ? String(v) : null);
  const dateOrNull = (v: unknown) => {
    if (!v) return null;
    const d = new Date(v as string);
    return isNaN(d.getTime()) ? null : d;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    invoiceNumber: strOrNull(data.invoiceNumber),
    vendorId: strOrNull(data.vendorId),
    specification: String(data.specification || "FABRIC_VENDOR"),
    date: dateOrNull(data.date),
    description: strOrNull(data.description),
    quantity: strOrNull(data.quantity),
    amount: numOrNull(data.amount) ?? 0,
    deliveredAt: strOrNull(data.deliveredAt),
    productNote: strOrNull(data.productNote),
    note: strOrNull(data.note),
    garmentBifurcation: strOrNull(data.garmentBifurcation),
    totalGarments: intOrNull(data.totalGarments),
    fabricStatus: strOrNull(data.fabricStatus),
    inwardDate: dateOrNull(data.inwardDate),
    expectedInward: dateOrNull(data.expectedInward),
    actualInward: dateOrNull(data.actualInward),
    isStrikedThrough: Boolean(data.isStrikedThrough),
  };
  if (phaseId) payload.phaseId = phaseId;
  return payload;
}

let tempId = 0;

export function ExpenseGrid({
  expenses,
  vendors,
  phaseId,
}: {
  expenses: unknown[];
  vendors: Vendor[];
  phaseId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gridApiRef = useRef<GridApi | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const [tempRows, setTempRows] = useState<Record<string, unknown>[]>([]);
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Detail sheet state
  const [detailExpenseId, setDetailExpenseId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem("ag-grid-col-state-expenses", JSON.stringify(state));
  }, []);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  const rowData = useMemo((): (Record<string, unknown> & { __status: RowStatus })[] => {
    return (expenses as Record<string, unknown>[]).map((e) => ({
      ...toRow(e),
      __status: "clean" as RowStatus,
    }));
  }, [expenses]);

  const vendorValues = vendors.map((v) => v.id);
  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const typeValues = Object.keys(EXPENSE_TYPE_LABELS);
  const fabricStatusValues = Object.keys(FABRIC_STATUS_LABELS);
  const locationValues = [...DELIVERY_LOCATIONS];

  // Compute total for pinned bottom row
  const totalAmount = useMemo(() =>
    rowData.reduce((sum, r) => sum + (toNum(r.amount) || 0), 0),
    [rowData]
  );

  const pinnedBottomRowData = useMemo(() => [{
    id: "__total",
    invoiceNumber: "",
    vendorId: "",
    specification: "",
    date: "",
    description: "TOTAL",
    quantity: "",
    amount: totalAmount,
    deliveredAt: "",
    productNote: "",
    note: "",
    garmentBifurcation: "",
    totalGarments: null,
    fabricStatus: "",
    inwardDate: "",
    expectedInward: "",
    actualInward: "",
    __status: "clean",
  }], [totalAmount]);

  const columnDefs = useMemo<ColDef[]>(() => [
    { field: "invoiceNumber", headerName: "Invoice #", minWidth: 100, editable: true },
    {
      field: "sourceType", headerName: "Source", minWidth: 80, maxWidth: 100, editable: false, sortable: true,
      cellRenderer: (params: { value: string }) => {
        if (!params.value || params.value === "MANUAL") return <span className="text-xs text-muted-foreground">Manual</span>;
        const label = params.value === "FABRIC_ORDER" ? "Fabric" : "SKU";
        return <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">Auto: {label}</span>;
      },
    },
    { field: "vendorId", headerName: "Vendor", minWidth: 120, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: vendorValues }, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "specification", headerName: "Type", minWidth: 120, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: typeValues }, valueFormatter: (p) => EXPENSE_TYPE_LABELS[p.value] || p.value || "" },
    { field: "date", headerName: "Date", minWidth: 130, editable: true, cellEditor: DateCellEditor, cellEditorPopup: true },
    { field: "description", headerName: "Description", minWidth: 150, editable: true },
    { field: "quantity", headerName: "Qty", minWidth: 90, editable: true },
    {
      field: "amount", headerName: "Amount", minWidth: 100, type: "numericColumn",
      valueParser: (p) => toNum(p.newValue),
      valueFormatter: (p) => formatCurrency(p.value),
      cellClass: (params) => params.data?.sourceType && params.data.sourceType !== "MANUAL" ? "text-muted-foreground" : "",
    },
    { field: "deliveredAt", headerName: "Delivered At", minWidth: 110, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: locationValues } },
    { field: "productNote", headerName: "Product Note", minWidth: 130, editable: true },
    { field: "note", headerName: "Note", minWidth: 130, editable: true },
    { field: "garmentBifurcation", headerName: "Bifurcation", minWidth: 140, editable: true },
    {
      field: "totalGarments", headerName: "Garments", minWidth: 85, type: "numericColumn", editable: true,
      valueParser: (p) => toNum(p.newValue),
    },
    { field: "fabricStatus", headerName: "Fabric Status", minWidth: 130, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: fabricStatusValues }, valueFormatter: (p) => FABRIC_STATUS_LABELS[p.value] || p.value || "" },
    { field: "inwardDate", headerName: "Inward Date", minWidth: 130, editable: true, cellEditor: DateCellEditor, cellEditorPopup: true },
    { field: "expectedInward", headerName: "Exp Inward", minWidth: 130, editable: true, cellEditor: DateCellEditor, cellEditorPopup: true },
    { field: "actualInward", headerName: "Act Inward", minWidth: 130, editable: true, cellEditor: DateCellEditor, cellEditorPopup: true },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  function setStatus(id: string, status: RowStatus) {
    setStatusMap((prev) => { const next = new Map(prev); next.set(id, status); return next; });
  }

  const saveRow = useCallback(async (data: Record<string, unknown>) => {
    const rowId = String(data.id);
    const isNew = rowId.startsWith("__new_");

    if (validateExpense(data)) {
      setStatus(rowId, "error");
      return;
    }

    setStatus(rowId, "saving");
    try {
      if (isNew) {
        await createExpense(toPayload(data, phaseId));
        setTempRows((prev) => prev.filter((r) => String(r.id) !== rowId));
        setStatusMap((prev) => { const next = new Map(prev); next.delete(rowId); return next; });
        toast.success("Expense created");
      } else {
        await updateExpense(rowId, toPayload(data));
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
    if (!event.data || String(event.data.id) === "__total") return;
    const rowId = String(event.data.id);
    setStatus(rowId, "dirty");
    // Keep temp rows in sync with grid edits
    if (rowId.startsWith("__new_")) {
      setTempRows((prev) => prev.map((r) => String(r.id) === rowId ? { ...event.data } : r));
    }
    debouncedSave(event.data);
  }

  function addRow(position: "top" | "bottom") {
    const id = `__new_${++tempId}_${Date.now()}`;
    const newRow = {
      id, phaseId, invoiceNumber: "", vendorId: "", specification: "FABRIC_VENDOR",
      date: "", description: "", quantity: "", amount: null,
      deliveredAt: "", productNote: "", note: "", garmentBifurcation: "",
      totalGarments: null, fabricStatus: "",
      inwardDate: "", expectedInward: "", actualInward: "",
      isStrikedThrough: false,
    };
    setTempRows((prev) => position === "top" ? [newRow, ...prev] : [...prev, newRow]);
    setStatus(id, "dirty");
  }

  function applyFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/expenses?${params.toString()}`);
  }

  const enrichedData = useMemo(() => {
    const serverRows = rowData.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("clean" as RowStatus) }));
    const tempEnriched = tempRows.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("dirty" as RowStatus) }));
    const all = [...tempEnriched, ...serverRows];
    return all;
  }, [rowData, statusMap, tempRows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={searchParams.get("vendor") || "all"} onValueChange={(v) => applyFilter("vendor", v)}>
          <SelectTrigger className="w-[150px]">
            <span className="truncate">{vendorLabels[searchParams.get("vendor") || ""] || "All Vendors"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("type") || "all"} onValueChange={(v) => applyFilter("type", v)}>
          <SelectTrigger className="w-[170px]">
            <span className="truncate">{EXPENSE_TYPE_LABELS[searchParams.get("type") || ""] || "All Types"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="sm" onClick={() => addRow("top")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Top
      </Button>

      <div className="ag-theme-quartz" style={{ height: "600px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem("ag-grid-col-state-expenses");
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
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
          onRowClicked={(event: RowClickedEvent) => {
            if (!event.data) return;
            const id = String(event.data.id);
            if (id === "__total" || id.startsWith("__new_")) return;
            const sourceType = event.data.sourceType;
            if (sourceType && sourceType !== "MANUAL") {
              setDetailExpenseId(id);
              setDetailOpen(true);
            }
          }}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{
            editable: (params) => {
              // Auto-created expense rows are not editable
              const st = params.data?.sourceType;
              if (st && st !== "MANUAL") return false;
              return true;
            },
            sortable: true, unSortIcon: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true,
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          pinnedBottomRowData={pinnedBottomRowData}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          rowClass="group cursor-pointer"
          getRowClass={() => "cursor-pointer"}
          animateRows={false}
        />
      </div>

      <Button variant="outline" size="sm" onClick={() => addRow("bottom")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Bottom
      </Button>

      <ExpenseDetailSheet
        expenseId={detailExpenseId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
