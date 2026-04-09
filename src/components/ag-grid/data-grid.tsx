"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi, type CellValueChangedEvent, type GridReadyEvent, type ColumnState, type ColumnPinnedType, type RowClickedEvent } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "./add-column-dialog";
import { ManageColumnsDialog } from "./manage-columns-dialog";
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
  validate?: (data: T) => Record<string, string> | null;
  getRowId?: (data: T) => string;
  pinnedBottomRowData?: T[];
  height?: string;
  autoHeight?: boolean;
  onCellValueChangedExtra?: (event: CellValueChangedEvent<T>) => void;
  defaultSort?: { colId: string; sort: "asc" | "desc" }[];
  hideAddRowButtons?: boolean;
  onRowClicked?: (data: T) => void;
  getRowClass?: (params: { data?: T }) => string;
  onGridApiReady?: (api: GridApi<T>) => void;
};

let tempIdCounter = 0;
function nextTempId() {
  return `__new_${++tempIdCounter}_${Date.now()}`;
}

export function DataGrid<T extends Record<string, unknown>>({
  gridId,
  rowData,
  columnDefs,
  defaultRow,
  onSave,
  onCreate,
  validate,
  getRowId: getRowIdProp,
  pinnedBottomRowData,
  height = "600px",
  autoHeight = false,
  onCellValueChangedExtra,
  defaultSort,
  hideAddRowButtons = false,
  onRowClicked,
  getRowClass,
  onGridApiReady,
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const isInitializing = useRef(true);
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [topTempRows, setTopTempRows] = useState<T[]>([]);
  const [bottomTempRows, setBottomTempRows] = useState<T[]>([]);
  const isAutoPopulating = useRef(false);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom columns
  const { columns: customColumns, addColumn, removeColumn, setCellValue: setCustomCellValue, enrichRowData } = useCustomColumns(gridId);

  const colStateKey = `ag-grid-col-state-${gridId}`;

  // Check if saved state exists (for autoSizeStrategy)
  const hasSavedColState = typeof window !== "undefined" && !!localStorage.getItem(colStateKey);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current || isInitializing.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(colStateKey, JSON.stringify(state));
    // Keep fingerprint in sync
    const allColFields = gridApiRef.current.getColumns()?.map((c) => c.getColId()) || [];
    localStorage.setItem(colStateKey + "-fingerprint", allColFields.join("|"));
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

  // Enrich row data with status and custom columns
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
    return enrichRowData(all);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, statusMap, topTempRows, bottomTempRows, enrichRowData]);

  const onGridReady = useCallback((params: GridReadyEvent<T>) => {
    gridApiRef.current = params.api;
    onGridApiReady?.(params.api);
    const saved = localStorage.getItem(colStateKey);
    if (saved) {
      try {
        const parsed: ColumnState[] = JSON.parse(saved);

        // Build a fingerprint of the current column defs to detect changes
        const allColFields = params.api.getColumns()?.map((c) => c.getColId()) || [];
        const currentFingerprint = allColFields.join("|");
        const savedFingerprint = localStorage.getItem(colStateKey + "-fingerprint");

        // Preserve pinned settings from column defs
        const pinnedMap: Record<string, ColumnPinnedType> = {};
        columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field as string] = col.pinned as ColumnPinnedType; });

        if (currentFingerprint !== savedFingerprint) {
          // Columns changed: preserve saved order & widths, append new columns at their code-defined position
          const savedColIds = parsed.map((cs) => cs.colId).filter(Boolean) as string[];
          const savedMap = new Map<string, ColumnState>();
          parsed.forEach((cs) => { if (cs.colId) savedMap.set(cs.colId, cs); });

          const currentSet = new Set(allColFields);
          // Start with saved columns that still exist (preserves user's order)
          const merged: ColumnState[] = savedColIds
            .filter((colId) => currentSet.has(colId))
            .map((colId) => {
              const entry = { ...savedMap.get(colId)! };
              if (pinnedMap[colId] !== undefined) entry.pinned = pinnedMap[colId];
              return entry;
            });

          // Append any new columns (ones not in saved state) at the end
          const mergedSet = new Set(merged.map((cs) => cs.colId));
          allColFields.forEach((colId) => {
            if (!mergedSet.has(colId)) {
              const entry: ColumnState = { colId };
              if (pinnedMap[colId] !== undefined) entry.pinned = pinnedMap[colId];
              merged.push(entry);
            }
          });

          params.api.applyColumnState({ state: merged, applyOrder: true });
          // Persist clean state and fingerprint
          localStorage.setItem(colStateKey, JSON.stringify(params.api.getColumnState()));
          localStorage.setItem(colStateKey + "-fingerprint", currentFingerprint);
        } else {
          // Columns unchanged: restore saved order and widths exactly
          const merged = parsed.map((cs) => {
            if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
            return cs;
          });
          params.api.applyColumnState({ state: merged, applyOrder: true });
        }
      } catch {
        // Ignore invalid saved state
      }
    } else {
      // No saved state — store initial fingerprint
      const allColFields = params.api.getColumns()?.map((c) => c.getColId()) || [];
      localStorage.setItem(colStateKey + "-fingerprint", allColFields.join("|"));
    }

    // Always apply default sort if no sort is currently set
    if (defaultSort) {
      const currentState = params.api.getColumnState();
      const hasSort = currentState.some((cs) => cs.sort);
      if (!hasSort) {
        params.api.applyColumnState({
          state: defaultSort.map((s) => ({ colId: s.colId, sort: s.sort })),
          defaultState: { sort: null },
        });
      }
    }
    // Allow saving column state after initialization completes
    setTimeout(() => { isInitializing.current = false; }, 100);
  }, [colStateKey, columnDefs, defaultSort]);

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
          // Remove custom column fields before saving to DB
          Object.keys(cleanData).forEach((k) => {
            if (k.startsWith("__custom_")) delete (cleanData as Record<string, unknown>)[k];
          });
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
          // Remove custom column fields before saving to DB
          Object.keys(cleanData).forEach((k) => {
            if (k.startsWith("__custom_")) delete (cleanData as Record<string, unknown>)[k];
          });
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

      const colId = event.column.getColId();
      const rowId = getRowIdFn(event.data);

      // Handle custom column edits - save to localStorage, not DB
      if (colId.startsWith("__custom_")) {
        setCustomCellValue(rowId, colId, String(event.newValue ?? ""));
        return;
      }

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
    [debouncedSave, onCellValueChangedExtra, setCustomCellValue]
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

  // Build full column defs with custom columns
  const fullColumnDefs = useMemo<ColDef<T>[]>(() => {
    // Custom column defs — filter out any that conflict with code-defined columns (by field or header name)
    const definedFields = new Set(columnDefs.map((c) => c.field).filter(Boolean));
    const definedHeaders = new Set(columnDefs.map((c) => c.headerName?.toLowerCase()).filter(Boolean));
    const customColDefs: ColDef<T>[] = customColumns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c) => !definedFields.has(c.field as any) && !definedHeaders.has(c.headerName.toLowerCase()))
      .map((c) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field: c.field as any,
        headerName: c.headerName,
        minWidth: 100,
        editable: true,
      }));

    const cols: ColDef<T>[] = [...columnDefs, ...customColDefs];

    return cols;
  }, [columnDefs, customColumns]);

  const handleRowClicked = useCallback((event: RowClickedEvent<T>) => {
    if (!onRowClicked || !event.data) return;
    // Don't trigger if clicking the action column
    const colId = event.event?.target instanceof HTMLElement
      ? event.event.target.closest('[col-id]')?.getAttribute('col-id')
      : null;
    if (colId === '0') return; // 0 is the actions column index
    onRowClicked(event.data);
  }, [onRowClicked]);

  return (
    <div className="space-y-3">
      {!hideAddRowButtons && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addRow("top")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Row Top
          </Button>
          <AddColumnButton
            columns={customColumns}
            onAdd={addColumn}
            onRemove={removeColumn}
          />
          <ManageColumnsDialog
            gridApiRef={gridApiRef}
            colStateKey={colStateKey}
          />
        </div>
      )}
      <div className="ag-theme-quartz" style={autoHeight ? { width: "100%", maxHeight: height } : { height, width: "100%" }}>
        <AgGridReact<T>
          theme="legacy"
          ref={gridRef}
          rowData={enrichedData}
          columnDefs={fullColumnDefs}
          maintainColumnOrder
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          onSortChanged={saveColumnState}
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
          autoSizeStrategy={hasSavedColState ? undefined : { type: "fitCellContents", skipHeader: true }}
          pinnedBottomRowData={pinnedBottomRowData}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          undoRedoCellEditing={true}
          rowClass="group cursor-pointer"
          getRowClass={getRowClass ? (params) => getRowClass({ data: params.data as T | undefined }) : undefined}
          animateRows={false}
          suppressClickEdit={false}
          domLayout={autoHeight ? "autoHeight" : "normal"}
          onRowClicked={onRowClicked ? handleRowClicked : undefined}
        />
      </div>
      {!hideAddRowButtons && (
        <Button variant="outline" size="sm" onClick={() => addRow("bottom")}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Row Bottom
        </Button>
      )}
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
