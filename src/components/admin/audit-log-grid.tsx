"use client";

import { useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { ExternalLink } from "lucide-react";
import { AuditEntitySheet } from "./audit-entity-sheet";

type AuditLogEntry = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: string | null;
  timestamp: string;
};

function ChangesRenderer({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!value) return <span className="text-muted-foreground">-</span>;

  let parsed: Record<string, { old: unknown; new: unknown }>;
  try {
    parsed = JSON.parse(value);
  } catch {
    return <span className="text-xs">{value}</span>;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return <span className="text-muted-foreground">-</span>;

  if (!expanded) {
    const summary = entries.map(([k]) => k).join(", ");
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-blue-600 hover:underline text-left"
      >
        {entries.length} field{entries.length > 1 ? "s" : ""}: {summary}
      </button>
    );
  }

  return (
    <div className="text-xs space-y-0.5">
      <button
        onClick={() => setExpanded(false)}
        className="text-blue-600 hover:underline text-[10px]"
      >
        collapse
      </button>
      {entries.map(([field, { old: oldVal, new: newVal }]) => (
        <div key={field}>
          <span className="font-medium">{field}</span>:{" "}
          <span className="text-red-500 line-through">{String(oldVal ?? "null")}</span>
          {" -> "}
          <span className="text-green-600">{String(newVal ?? "null")}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditLogGrid({ logs }: { logs: AuditLogEntry[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const columnDefs = useMemo<ColDef<AuditLogEntry>[]>(() => [
    {
      field: "timestamp",
      headerName: "Time",
      minWidth: 160,
      editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        return new Date(p.value).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      },
      sort: "desc",
    },
    { field: "userName", headerName: "User", minWidth: 120, editable: false },
    {
      field: "action",
      headerName: "Action",
      minWidth: 100,
      editable: false,
      cellClass: (p) => {
        const action = p.value;
        if (action === "CREATE") return "text-green-600 font-medium";
        if (action === "DELETE") return "text-red-600 font-medium";
        if (action === "MERGE") return "text-blue-600 font-medium";
        return "";
      },
    },
    {
      field: "entityType", headerName: "Entity", minWidth: 130, editable: false,
      valueFormatter: (p) => p.value === "Product" ? "ProductOrder" : p.value || "",
    },
    {
      field: "entityId",
      headerName: "Link",
      minWidth: 70,
      maxWidth: 70,
      editable: false,
      cellRenderer: () => (
        <span className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer">
          <ExternalLink className="h-3 w-3" />
          View
        </span>
      ),
    },
    {
      field: "changes",
      headerName: "Changes",
      minWidth: 250,
      editable: false,
      flex: 1,
      cellRenderer: ChangesRenderer,
      autoHeight: true,
      wrapText: true,
    },
  ], []);

  return (
    <>
      <DataGrid<AuditLogEntry>
        gridId="audit-log"
        rowData={logs}
        columnDefs={columnDefs}
        defaultRow={{}}
        onSave={async () => {}}
        onCreate={async () => {}}
        defaultSort={[{ colId: "timestamp", sort: "desc" }]}
        hideAddRowButtons
        height="600px"
        onRowClicked={(data) => {
          setSelectedEntry(data);
          setSheetOpen(true);
        }}
      />
      {selectedEntry && (
        <AuditEntitySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          entityType={selectedEntry.entityType}
          entityId={selectedEntry.entityId}
          changes={selectedEntry.changes}
          action={selectedEntry.action}
          timestamp={selectedEntry.timestamp}
        />
      )}
    </>
  );
}
