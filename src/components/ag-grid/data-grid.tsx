"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi, type CellValueChangedEvent, type GridReadyEvent } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Plus, Strikethrough, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import "./ag-grid-theme.css";

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule]);

type RowStatus = "clean" | "dirty" | "saving" | "error";

type DataGridProps<T extends Record<string, unknown>> = {
  gridId: string;
  rowData: T[];
  columnDefs: ColDef<T>[];
  defaultRow: Partial<T>;
  onSave: (id: string, data: T) => Promise<unknown>;
  onCreate: (data: T) => Promise<unknown>;
  onStrikethrough: (id: string, isStrikedThrough: boolean) => Promise<unknown>;
  validate?: (data: T) => Record<string, string> | null;
  getRowId?: (data: T) => string;
  pinnedBottomRowData?: T[];
  height?: string;
  autoHeight?: boolean;
  onCellValueChangedExtra?: (event: CellValueChangedEvent<T>) => void;
  showStrikethrough?: boolean;
};

let tempIdCounter = 0;
function nextTempId() {
  return `__new_${++tempIdCounter}_${Date.now()}`;
}

// Status cell renderer
function StatusCellRenderer(props: { data: { __status?: RowStatus } }) {
  const status = props.data?.__status;
  if (status === "saving") return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (status === "error") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (status === "dirty") return <div className="h-2 w-2 rounded-full bg-yellow-400" />;
  return <Check className="h-3 w-3 text-green-500 opacity-0 group-hover:opacity-100" />;
}

export function DataGrid<T extends Record<string, unknown>>({
  gridId,
  rowData,
  columnDefs,
  defaultRow,
  onSave,
  onCreate,
  onStrikethrough,
  validate,
  getRowId: getRowIdProp,
  pinnedBottomRowData,
  height = "600px",
  autoHeight = false,
  onCellValueChangedExtra,
  showStrikethrough = true,
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [topTempRows, setTopTempRows] = useState<T[]>([]);
  const [bottomTempRows, setBottomTempRows] = useState<T[]>([]);
  const isAutoPopulating = useRef(false);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const colStateKey = `ag-grid-col-state-${gridId}`;

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(colStateKey, JSON.stringify(state));
  }, [colStateKey]);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  function getRowIdFn(data: T): string {
    if (getRowIdProp) return getRowIdProp(data);
    return (data as Record<string, unknown>).id as string || (data as Record<string, unknown>).__tempId as string;
  }

  // Enrich row data with status for rendering
  const enrichedData = useMemo(() => {
    const topEnriched = topTempRows.map((row) => ({
      ...row,
      __status: statusMap.get(getRowIdFn(row)) || ("dirty" as RowStatus),
    }));
    const bottomEnriched = bottomTempRows.map((row) => ({
      ...row,
      __status: statusMap.get(getRowIdFn(row)) || ("dirty" as RowStatus),
    }));
    const serverEnriched = rowData.map((row) => ({
      ...row,
      __status: statusMap.get(getRowIdFn(row)) || ("clean" as RowStatus),
    }));
    const all = [...topEnriched, ...serverEnriched, ...bottomEnriched];
    return all.sort((a, b) => {
      const aStruck = (a as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      const bStruck = (b as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      return aStruck - bStruck;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, statusMap, topTempRows, bottomTempRows]);

  const onGridReady = useCallback((params: GridReadyEvent<T>) => {
    gridApiRef.current = params.api;
    const saved = localStorage.getItem(colStateKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Preserve pinned settings from column defs so code-defined pins persist
        const pinnedMap: Record<string, string | null> = {};
        columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field as string] = col.pinned as string; });
        const merged = parsed.map((cs: { colId?: string; pinned?: string | null }) => {
          if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
          return cs;
        });
        params.api.applyColumnState({ state: merged, applyOrder: true });
      } catch {
        // Ignore invalid saved state
      }
    }
  }, [colStateKey, columnDefs]);

  const setStatus = useCallback((id: string, status: RowStatus) => {
    setStatusMap((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }, []);

  const saveRow = useCallback(
    async (data: T) => {
      const rowId = getRowIdFn(data);
      const isNew = rowId.startsWith("__new_");

      // Validate
      if (validate) {
        const errors = validate(data);
        if (errors) {
          setStatus(rowId, "error");
          const firstError = Object.values(errors)[0];
          toast.error(firstError || "Validation failed");
          return;
        }
      }

      setStatus(rowId, "saving");

      try {
        if (isNew) {
          const cleanData = { ...data };
          delete (cleanData as Record<string, unknown>).__tempId;
          delete (cleanData as Record<string, unknown>).__status;
          await onCreate(cleanData);
          setTopTempRows((prev) => prev.filter((r) => getRowIdFn(r) !== rowId));
          setBottomTempRows((prev) => prev.filter((r) => getRowIdFn(r) !== rowId));
          setStatusMap((prev) => {
            const next = new Map(prev);
            next.delete(rowId);
            return next;
          });
          toast.success("Row created");
        } else {
          const cleanData = { ...data };
          delete (cleanData as Record<string, unknown>).__status;
          await onSave(rowId, cleanData);
          setStatus(rowId, "clean");
        }
      } catch {
        setStatus(rowId, "error");
        toast.error("Failed to save");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCreate, onSave, validate]
  );

  const debouncedSave = useCallback(
    (data: T) => {
      const rowId = getRowIdFn(data);
      const existing = saveTimers.current.get(rowId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        saveTimers.current.delete(rowId);
        saveRow(data);
      }, 800);
      saveTimers.current.set(rowId, timer);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saveRow]
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<T>) => {
      if (isAutoPopulating.current) return;
      if (!event.data) return;

      const rowId = getRowIdFn(event.data);
      setStatus(rowId, "dirty");
      debouncedSave(event.data);

      // Keep temp rows in sync
      if (rowId.startsWith("__new_")) {
        setTopTempRows((prev) => prev.map((r) => getRowIdFn(r) === rowId ? event.data : r));
        setBottomTempRows((prev) => prev.map((r) => getRowIdFn(r) === rowId ? event.data : r));
      }

      // Allow parent to hook into cell changes (for auto-populate)
      onCellValueChangedExtra?.(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSave, onCellValueChangedExtra]
  );

  const addRow = useCallback((position: "top" | "bottom") => {
    const tempId = nextTempId();
    const newRow = {
      ...defaultRow,
      id: tempId,
      __tempId: tempId,
    } as unknown as T;
    if (position === "top") {
      setTopTempRows((prev) => [newRow, ...prev]);
    } else {
      setBottomTempRows((prev) => [...prev, newRow]);
    }
    setStatus(tempId, "dirty");
  }, [defaultRow, setStatus]);

  const strikethroughHandler = useCallback(
    async (data: T) => {
      const rowId = getRowIdFn(data);
      const isNew = rowId.startsWith("__new_");

      if (isNew) {
        setTopTempRows((prev) => prev.filter((r) => getRowIdFn(r) !== rowId));
        setBottomTempRows((prev) => prev.filter((r) => getRowIdFn(r) !== rowId));
        setStatusMap((prev) => {
          const next = new Map(prev);
          next.delete(rowId);
          return next;
        });
        return;
      }

      const toggled = !(data as Record<string, unknown>).isStrikedThrough;
      try {
        await onStrikethrough(rowId, toggled);
        const updated = { ...data, isStrikedThrough: toggled };
        gridApiRef.current?.applyTransaction({ update: [updated] });
        toast.success(toggled ? "Row striked through" : "Strikethrough removed");
      } catch {
        toast.error("Failed to update");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onStrikethrough]
  );

  // Build full column defs with status and optionally actions columns
  const fullColumnDefs = useMemo<ColDef<T>[]>(() => {
    const statusCol: ColDef<T> = {
      headerName: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      field: "__status" as any,
      width: 40,
      maxWidth: 40,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false,
      cellRenderer: StatusCellRenderer,
      cellClass: "status-cell",
    };

    const cols: ColDef<T>[] = [statusCol, ...columnDefs];

    if (showStrikethrough) {
      const actionsCol: ColDef<T> = {
        headerName: "",
        width: 45,
        maxWidth: 45,
        pinned: "right",
        editable: false,
        sortable: false,
        filter: false,
        cellRenderer: (params: { data: T }) => {
          if (!params.data) return null;
          const isStruck = Boolean((params.data as Record<string, unknown>).isStrikedThrough);
          return (
            <button
              onClick={() => strikethroughHandler(params.data)}
              className={`p-1 cursor-pointer ${isStruck ? "opacity-100" : "opacity-40 hover:opacity-100"} transition-opacity`}
              title={isStruck ? "Remove strikethrough" : "Strikethrough row"}
            >
              <Strikethrough className={`h-3.5 w-3.5 ${isStruck ? "text-red-500" : "text-gray-500"}`} />
            </button>
          );
        },
      };
      cols.push(actionsCol);
    }

    return cols;
  }, [columnDefs, strikethroughHandler, showStrikethrough]);

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => addRow("top")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Top
      </Button>
      <div className="ag-theme-quartz" style={autoHeight ? { width: "100%", maxHeight: height } : { height, width: "100%" }}>
        <AgGridReact<T>
          ref={gridRef}
          rowData={enrichedData}
          columnDefs={fullColumnDefs}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          getRowId={(params) => getRowIdFn(params.data)}
          defaultColDef={{
            editable: true,
            sortable: true,
            unSortIcon: true,
            filter: false,
            resizable: true,
            minWidth: 60,
            wrapHeaderText: true,
            autoHeaderHeight: true,
          }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          pinnedBottomRowData={pinnedBottomRowData}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          undoRedoCellEditing={true}
          rowClass="group"
          getRowClass={(params) => (params.data as Record<string, unknown>)?.isStrikedThrough ? "strikethrough-row" : undefined}
          animateRows={false}
          suppressClickEdit={false}
          domLayout={autoHeight ? "autoHeight" : "normal"}
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => addRow("bottom")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Bottom
      </Button>
    </div>
  );
}

// Export the auto-populate helper for use in grid components
export function autoPopulateRow<T extends Record<string, unknown>>(
  gridApi: GridApi<T> | null,
  currentData: T,
  masterData: Partial<T>,
  isAutoPopulating: React.MutableRefObject<boolean>
) {
  if (!gridApi) return;
  isAutoPopulating.current = true;
  const merged = { ...currentData, ...masterData };
  gridApi.applyTransaction({ update: [merged] });
  // Reset flag after a tick so the onCellValueChanged handler can fire for future changes
  setTimeout(() => {
    isAutoPopulating.current = false;
  }, 100);
}
