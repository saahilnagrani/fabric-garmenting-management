"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi, type CellValueChangedEvent, type GridReadyEvent } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import "./ag-grid-theme.css";

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule]);

type RowStatus = "clean" | "dirty" | "saving" | "error";

type DataGridProps<T extends Record<string, unknown>> = {
  rowData: T[];
  columnDefs: ColDef<T>[];
  defaultRow: Partial<T>;
  onSave: (id: string, data: T) => Promise<unknown>;
  onCreate: (data: T) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  validate?: (data: T) => Record<string, string> | null;
  getRowId?: (data: T) => string;
  pinnedBottomRowData?: T[];
  height?: string;
  onCellValueChangedExtra?: (event: CellValueChangedEvent<T>) => void;
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
  rowData,
  columnDefs,
  defaultRow,
  onSave,
  onCreate,
  onDelete,
  validate,
  getRowId: getRowIdProp,
  pinnedBottomRowData,
  height = "600px",
  onCellValueChangedExtra,
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isAutoPopulating = useRef(false);

  // Enrich row data with status for rendering
  const enrichedData = useMemo(() => {
    return rowData.map((row) => ({
      ...row,
      __status: statusMap.get(getRowIdFn(row)) || ("clean" as RowStatus),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData, statusMap]);

  function getRowIdFn(data: T): string {
    if (getRowIdProp) return getRowIdProp(data);
    return (data as Record<string, unknown>).id as string || (data as Record<string, unknown>).__tempId as string;
  }

  const onGridReady = useCallback((params: GridReadyEvent<T>) => {
    gridApiRef.current = params.api;
  }, []);

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
          // Remove internal fields before sending
          const cleanData = { ...data };
          delete (cleanData as Record<string, unknown>).__tempId;
          delete (cleanData as Record<string, unknown>).__status;
          const created = await onCreate(cleanData);
          // Update the row in grid with the real ID
          const createdData = created as T;
          const api = gridApiRef.current;
          if (api) {
            api.applyTransaction({ remove: [data] });
            api.applyTransaction({ add: [createdData] });
          }
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

      // Allow parent to hook into cell changes (for auto-populate)
      onCellValueChangedExtra?.(event);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSave, onCellValueChangedExtra]
  );

  const addRow = useCallback(() => {
    const tempId = nextTempId();
    const newRow = {
      ...defaultRow,
      id: tempId,
      __tempId: tempId,
    } as unknown as T;
    gridApiRef.current?.applyTransaction({ add: [newRow], addIndex: 0 });
    setStatus(tempId, "dirty");
  }, [defaultRow, setStatus]);

  const deleteRowHandler = useCallback(
    async (data: T) => {
      const rowId = getRowIdFn(data);
      const isNew = rowId.startsWith("__new_");

      if (isNew) {
        gridApiRef.current?.applyTransaction({ remove: [data] });
        setStatusMap((prev) => {
          const next = new Map(prev);
          next.delete(rowId);
          return next;
        });
        return;
      }

      try {
        await onDelete(rowId);
        gridApiRef.current?.applyTransaction({ remove: [data] });
        setStatusMap((prev) => {
          const next = new Map(prev);
          next.delete(rowId);
          return next;
        });
        toast.success("Row deleted");
      } catch {
        toast.error("Failed to delete");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDelete]
  );

  // Build full column defs with status and actions columns
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
        return (
          <button
            onClick={() => deleteRowHandler(params.data)}
            className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity p-1"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        );
      },
    };

    return [statusCol, ...columnDefs, actionsCol];
  }, [columnDefs, deleteRowHandler]);

  return (
    <div className="space-y-3">
      <div className="ag-theme-quartz" style={{ height, width: "100%" }}>
        <AgGridReact<T>
          ref={gridRef}
          rowData={enrichedData}
          columnDefs={fullColumnDefs}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          getRowId={(params) => getRowIdFn(params.data)}
          defaultColDef={{
            editable: true,
            sortable: true,
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
          animateRows={false}
          suppressClickEdit={false}
        />
      </div>
      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row
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
