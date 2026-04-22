"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Plus } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryDispatchSheet, type AccessoryDispatchRow } from "./accessory-dispatch-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { generateAccessoryDispatchNotes } from "@/actions/accessory-dispatches";
import { toast } from "sonner";

type AccessoryOption = {
  id: string;
  displayName: string;
  category: string;
  unit: string;
  baseName?: string | null;
  colour?: string | null;
  size?: string | null;
};

type ProductOption = { id: string; label: string };

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:      { label: "Draft",      className: "bg-gray-100 text-gray-700 border-gray-200" },
  DISPATCHED: { label: "Dispatched", className: "bg-purple-100 text-purple-700 border-purple-200" },
  RECEIVED:   { label: "Received",   className: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "Cancelled",  className: "bg-red-100 text-red-700 border-red-200" },
};

export function AccessoryDispatchGrid({
  dispatches,
  phaseId,
  accessories,
  garmenters,
  products,
  productsByAccessory = {},
}: {
  dispatches: unknown[];
  phaseId: string;
  accessories: AccessoryOption[];
  garmenters: string[];
  products: ProductOption[];
  productsByAccessory?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryDispatchRow | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [generatingDn, setGeneratingDn] = useState(false);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: AccessoryDispatchRow[] = useMemo(
    () =>
      (dispatches as Record<string, unknown>[]).map((d) => {
        const acc = d.accessory as Record<string, unknown> | undefined;
        const product = d.product as Record<string, unknown> | undefined;
        return {
          id: d.id as string,
          phaseId: d.phaseId as string,
          accessoryId: d.accessoryId as string,
          accessoryDisplayName: acc ? accessoryDisplayName(acc) : "(unknown)",
          accessoryUnit: String((acc?.unit as string) || ""),
          quantity: Number(d.quantity ?? 0),
          destinationGarmenter: (d.destinationGarmenter as string | null) ?? null,
          productId: (d.productId as string | null) ?? null,
          productLabel: product
            ? `${product.articleNumber || ""} ${product.colourOrdered || ""}`.trim() ||
              String(product.productName || "")
            : null,
          dispatchDate: (d.dispatchDate as string | null) ?? null,
          comments: (d.comments as string | null) ?? null,
          status: (d.status as string) ?? "DRAFT",
          dnNumber: (d.dnNumber as string | null) ?? null,
        };
      }),
    [dispatches]
  );

  const columnDefs = useMemo<ColDef<AccessoryDispatchRow>[]>(
    () => [
      {
        headerName: "",
        width: 42,
        minWidth: 42,
        maxWidth: 42,
        pinned: "left",
        editable: false,
        sortable: false,
        filter: false,
        resizable: false,
        // Only DRAFT rows are selectable — once a DN is issued, rows lock.
        checkboxSelection: (params) => params.data?.status === "DRAFT",
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        suppressMovable: true,
      },
      {
        field: "status",
        headerName: "Status",
        minWidth: 115,
        editable: false,
        cellRenderer: (params: { value: string }) => {
          const cfg = STATUS_CONFIG[params.value] ?? STATUS_CONFIG.DRAFT;
          return (
            <span className={`inline-flex items-center rounded border px-1.5 text-[10px] font-medium whitespace-nowrap h-5 ${cfg.className}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        field: "dnNumber",
        headerName: "DN #",
        minWidth: 160,
        editable: false,
        cellRenderer: (params: { value: string | null }) => {
          if (!params.value) return null;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/accessory-dispatches/dispatch-note?dnNumber=${encodeURIComponent(params.value!)}`, "_blank");
              }}
              className="text-[11px] text-blue-600 underline cursor-pointer font-mono"
            >
              {params.value}
            </button>
          );
        },
      },
      {
        field: "accessoryDisplayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 220,
        editable: false,
      },
      {
        field: "dispatchDate",
        headerName: "Date",
        minWidth: 130,
        editable: false,
        valueFormatter: (p) =>
          p.value ? new Date(p.value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
      },
      { field: "accessoryUnit", headerName: "Unit", minWidth: 80, editable: false },
      {
        field: "quantity",
        headerName: "Quantity",
        minWidth: 100,
        type: "numericColumn",
        editable: false,
      },
      { field: "destinationGarmenter", headerName: "To Garmenter", minWidth: 150, editable: false },
      { field: "productLabel", headerName: "Linked Article", minWidth: 150, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ],
    []
  );

  async function handleGenerateDn() {
    const api = gridApiRef.current;
    if (!api) return;
    const rows = api.getSelectedRows() as AccessoryDispatchRow[];
    if (rows.length === 0) { toast.error("Select at least one dispatch row"); return; }

    const missingDest = rows.filter((r) => !r.destinationGarmenter);
    if (missingDest.length > 0) {
      toast.error(`${missingDest.length} row(s) have no destination garmenter. Set a destination before generating a DN.`);
      return;
    }

    const byGarmenter = new Map<string, AccessoryDispatchRow[]>();
    for (const r of rows) {
      const list = byGarmenter.get(r.destinationGarmenter!) ?? [];
      list.push(r);
      byGarmenter.set(r.destinationGarmenter!, list);
    }
    for (const group of byGarmenter.values()) {
      const existing = [...new Set(group.map((r) => r.dnNumber).filter((n): n is string => !!n))];
      if (existing.length > 1) {
        toast.error(`Selected rows span multiple DNs (${existing.join(", ")}). Print them separately.`);
        return;
      }
      if (existing.length === 1 && group.some((r) => !r.dnNumber)) {
        toast.error(`Some selected rows belong to DN ${existing[0]} and others don't. Deselect the mixed rows, or reprint ${existing[0]} on its own.`);
        return;
      }
    }

    const ids = [...new Set(rows.map((r) => r.id))];
    setGeneratingDn(true);
    try {
      await generateAccessoryDispatchNotes(ids);
      router.refresh();
      // Open all DNs in a single tab — the print page groups by garmenter and
      // renders one DN page per group.
      window.open(
        `/accessory-dispatches/dispatch-note?ids=${encodeURIComponent(ids.join(","))}`,
        "_blank",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate DNs");
    } finally {
      setGeneratingDn(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setSheetOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Dispatch
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateDn}
          disabled={selectedCount === 0 || generatingDn}
        >
          {generatingDn
            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            : <FileText className="mr-1.5 h-3.5 w-3.5" />}
          Generate Dispatch Notes{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-dispatches"
        />
      </div>
      <DataGrid<AccessoryDispatchRow>
        gridId="accessory-dispatches"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => {
          gridApiRef.current = api;
          api.addEventListener("selectionChanged", () => {
            setSelectedCount(api.getSelectedRows().length);
          });
        }}
        defaultSort={[{ colId: "dispatchDate", sort: "desc" }]}
        hideAddRowButtons
        rowSelection="multiple"
        onRowClicked={(data) => { setEditingRow(data); setSheetOpen(true); }}
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <AccessoryDispatchSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        phaseId={phaseId}
        accessories={accessories}
        garmenters={garmenters}
        products={products}
        productsByAccessory={productsByAccessory}
      />
    </>
  );
}
