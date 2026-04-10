"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Columns3, Plus, Trash2 } from "lucide-react";

type CustomColumnDef = {
  field: string;
  headerName: string;
};

export function AddColumnButton({
  columns,
  onAdd,
  onRemove,
}: {
  columns: CustomColumnDef[];
  onAdd: (name: string) => void;
  onRemove: (field: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
  };

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Columns3 className="mr-1.5 h-3.5 w-3.5" />
        Manage Columns
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Popover */}
          <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-white border border-border rounded-lg shadow-lg p-3 space-y-3">
            <p className="text-sm font-medium text-gray-900">
              Add Custom Column
            </p>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Column name..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!name.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {columns.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                  Custom columns
                </p>
                {columns.map((col) => (
                  <div
                    key={col.field}
                    className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50"
                  >
                    <span className="text-sm text-gray-700">
                      {col.headerName}
                    </span>
                    <button
                      onClick={() => onRemove(col.field)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {columns.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-1">
                No custom columns yet
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
