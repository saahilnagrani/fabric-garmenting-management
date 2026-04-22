"use client";

import { useState, useEffect, useCallback, type RefObject } from "react";
import type { GridApi, ColumnState } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Columns3, ChevronUp, ChevronDown, Pin, PinOff } from "lucide-react";

type ColumnInfo = {
  colId: string;
  headerName: string;
  field: string;
  pinned: "left" | "right" | null;
  visible: boolean;
};

export function ManageColumnsDialog({
  gridApiRef,
  colStateKey,
}: {
  gridApiRef: RefObject<GridApi | null>;
  colStateKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Header name overrides stored in localStorage
  const renameKey = `${colStateKey}-renames`;

  const getRenames = useCallback((): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(renameKey) || "{}");
    } catch {
      return {};
    }
  }, [renameKey]);

  const saveRenames = useCallback((renames: Record<string, string>) => {
    localStorage.setItem(renameKey, JSON.stringify(renames));
  }, [renameKey]);

  const loadColumns = useCallback(() => {
    if (!gridApiRef.current) return;
    const renames = getRenames();
    const state = gridApiRef.current.getColumnState();
    const cols: ColumnInfo[] = [];
    for (const cs of state) {
      if (!cs.colId) continue;
      const col = gridApiRef.current.getColumn(cs.colId);
      if (!col) continue;
      const colDef = col.getColDef();
      const originalName = colDef.headerName || cs.colId;
      cols.push({
        colId: cs.colId,
        headerName: renames[cs.colId] || originalName,
        field: (colDef.field as string) || cs.colId,
        pinned: (cs.pinned as "left" | "right") || null,
        visible: !cs.hide,
      });
    }
    setColumns(cols);
  }, [gridApiRef, getRenames]);

  useEffect(() => {
    if (open) loadColumns();
  }, [open, loadColumns]);

  function saveColumnState() {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(colStateKey, JSON.stringify(state));
  }

  function handleMove(index: number, direction: "up" | "down") {
    if (!gridApiRef.current) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const state = gridApiRef.current.getColumnState();
    const newState = [...state];
    const [moved] = newState.splice(index, 1);
    newState.splice(targetIndex, 0, moved);
    gridApiRef.current.applyColumnState({ state: newState, applyOrder: true });
    saveColumnState();
    loadColumns();
  }

  function handlePin(colId: string, pinned: "left" | null) {
    if (!gridApiRef.current) return;
    const col = gridApiRef.current.getColumn(colId);
    if (!col) return;
    gridApiRef.current.setColumnsPinned([colId], pinned);
    saveColumnState();
    loadColumns();
  }

  function handleRename(colId: string, newName: string) {
    if (!newName.trim()) return;
    const renames = getRenames();
    renames[colId] = newName.trim();
    saveRenames(renames);

    // Update the column header in the grid
    if (gridApiRef.current) {
      const col = gridApiRef.current.getColumn(colId);
      if (col) {
        const colDef = col.getColDef();
        colDef.headerName = newName.trim();
        gridApiRef.current.refreshHeader();
      }
    }

    setEditingId(null);
    setEditName("");
    loadColumns();
  }

  function startRename(col: ColumnInfo) {
    setEditingId(col.colId);
    setEditName(col.headerName);
  }

  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Columns3 className="mr-1.5 h-3.5 w-3.5" />
        Manage Columns
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setEditingId(null); }} />
          <div className="absolute top-full left-0 mt-1 z-50 w-80 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 space-y-2 max-h-[400px] overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Columns ({columns.length})
            </p>

            <div className="space-y-0.5">
              {columns.map((col, index) => (
                <div
                  key={col.colId}
                  className="flex items-center gap-1 py-1 px-1.5 rounded hover:bg-muted/50 group"
                >
                  {/* Name (editable) */}
                  {editingId === col.colId ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-6 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(col.colId, editName);
                        if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                      }}
                      onBlur={() => handleRename(col.colId, editName)}
                    />
                  ) : (
                    <div
                      className="flex-1 min-w-0 cursor-pointer hover:underline"
                      onClick={() => startRename(col)}
                      title="Click to rename"
                    >
                      <span className="text-xs text-foreground truncate block">{col.headerName}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">{col.field}</span>
                    </div>
                  )}

                  {/* Move + Pin buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      disabled={index === columns.length - 1}
                      onClick={() => handleMove(index, "down")}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    className={`p-1 rounded transition-colors ${col.pinned ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"}`}
                    onClick={() => handlePin(col.colId, col.pinned ? null : "left")}
                    title={col.pinned ? "Unpin column" : "Pin to left"}
                  >
                    {col.pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
