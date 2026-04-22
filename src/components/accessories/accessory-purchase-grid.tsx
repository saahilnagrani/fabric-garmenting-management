"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Loader2, Plus } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryPurchaseSheet, type AccessoryPurchaseRow } from "./accessory-purchase-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { generateAccessoryPurchaseOrders } from "@/actions/accessory-purchases";
import { toast } from "sonner";

type Vendor = { id: string; name: string; type: string };
type AccessoryOption = {
  id: string;
  displayName: string;
  category: string;
  unit: string;
  defaultCostPerUnit: number | null;
  vendorId: string | null;
  baseName?: string | null;
  colour?: string | null;
  size?: string | null;
};

const VENDOR_TYPE_LABELS: Record<string, string> = {
  FABRIC_SUPPLIER: "Fabric Supplier",
  GARMENTING: "Garmenting",
  ACCESSORIES: "Accessories",
  BRAND_TAG: "Brand Tag",
  OTHER: "Other",
  PACKAGING: "Packaging",
  INLAY_PRINTING: "Inlay Printing",
  REFLECTORS: "Reflectors",
  OFFICE: "Office",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT_ORDER:       { label: "Draft",          className: "bg-gray-100 text-gray-700 border-gray-200" },
  PO_SENT:           { label: "PO Sent",         className: "bg-blue-100 text-blue-700 border-blue-200" },
  PI_RECEIVED:       { label: "PI Received",     className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  ADVANCE_PAID:      { label: "Advance Paid",    className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  PARTIALLY_SHIPPED: { label: "Partial Ship",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  DISPATCHED:        { label: "Dispatched",      className: "bg-purple-100 text-purple-700 border-purple-200" },
  RECEIVED:          { label: "Received",        className: "bg-green-100 text-green-700 border-green-200" },
  FULLY_SETTLED:     { label: "Settled",         className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED:         { label: "Cancelled",       className: "bg-red-100 text-red-700 border-red-200" },
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function AccessoryPurchaseGrid({
  purchases,
  phaseId,
  accessories,
  vendors,
}: {
  purchases: unknown[];
  phaseId: string;
  accessories: AccessoryOption[];
  vendors: Vendor[];
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryPurchaseRow | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  // Ship-to dialog state
  const [shipToOpen, setShipToOpen] = useState(false);
  const [shipToVendorId, setShipToVendorId] = useState("");
  const [generatingPO, setGeneratingPO] = useState(false);
  const pendingIdsRef = useRef<string[]>([]);

  const vendorOptions = vendors.map((v) => ({
    label: `${v.name} (${VENDOR_TYPE_LABELS[v.type] ?? v.type})`,
    value: v.id,
  }));

  function openShipToDialog() {
    const api = gridApiRef.current;
    if (!api) return;
    const rows = api.getSelectedRows() as AccessoryPurchaseRow[];
    if (rows.length === 0) return;

    // Pre-flight checks (mirror the server-side rules in
    // ensurePoNumberForAccessoryGroup so the user doesn't fill in ship-to
    // just to see an error at submit time).
    const missingVendor = rows.filter((r) => !r.vendorId);
    if (missingVendor.length > 0) {
      toast.error(`${missingVendor.length} row(s) have no supplier vendor. Set a vendor before generating a PO.`);
      return;
    }

    // Group by vendor and check each group for a mixed/conflicting PO state.
    const byVendor = new Map<string, AccessoryPurchaseRow[]>();
    for (const r of rows) {
      const list = byVendor.get(r.vendorId!) ?? [];
      list.push(r);
      byVendor.set(r.vendorId!, list);
    }
    for (const group of byVendor.values()) {
      const existing = [...new Set(group.map((r) => r.poNumber).filter((n): n is string => !!n))];
      if (existing.length > 1) {
        toast.error(`Selected rows span multiple POs (${existing.join(", ")}). Print them separately.`);
        return;
      }
      if (existing.length === 1 && group.some((r) => !r.poNumber)) {
        toast.error(`Some selected rows belong to PO ${existing[0]} and others don't. Deselect the mixed rows, or reprint ${existing[0]} on its own.`);
        return;
      }
    }

    pendingIdsRef.current = [...new Set(rows.map((r) => r.id))];
    setShipToVendorId("");
    setShipToOpen(true);
  }

  async function handleConfirmGeneratePO() {
    if (!shipToVendorId) { toast.error("Select a ship-to destination"); return; }
    const ids = pendingIdsRef.current;
    setGeneratingPO(true);
    try {
      await generateAccessoryPurchaseOrders(ids, shipToVendorId);
      setShipToOpen(false);
      router.refresh();
      // Open ALL the stamped rows in one tab — the print page groups by vendor
      // and renders one PO page per vendor bundle, matching the fabric-PO flow.
      window.open(
        `/accessory-purchases/purchase-order?ids=${encodeURIComponent(ids.join(","))}`,
        "_blank",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate POs");
    } finally {
      setGeneratingPO(false);
    }
  }

  const rowData: AccessoryPurchaseRow[] = useMemo(
    () =>
      (purchases as Record<string, unknown>[]).map((p) => {
        const acc = p.accessory as Record<string, unknown> | undefined;
        const vendor = p.vendor as Record<string, unknown> | undefined;
        const shipTo = p.shipToVendor as Record<string, unknown> | undefined;
        return {
          id: p.id as string,
          phaseId: p.phaseId as string,
          accessoryId: p.accessoryId as string,
          accessoryDisplayName: acc ? accessoryDisplayName(acc) : "(unknown)",
          accessoryUnit: String((acc?.unit as string) || ""),
          vendorId: (p.vendorId as string | null) ?? null,
          vendorName: vendor ? String(vendor.name ?? "") : null,
          quantity: Number(p.quantity ?? 0),
          costPerUnit: toNum(p.costPerUnit),
          invoiceNumber: (p.invoiceNumber as string | null) ?? null,
          purchaseDate: (p.purchaseDate as string | null) ?? null,
          comments: (p.comments as string | null) ?? null,
          status: (p.status as string) ?? "DRAFT_ORDER",
          poNumber: (p.poNumber as string | null) ?? null,
          shipToVendorId: (p.shipToVendorId as string | null) ?? null,
          shipToVendorName: shipTo ? String(shipTo.name ?? "") : null,
        };
      }),
    [purchases],
  );

  const columnDefs = useMemo<ColDef<AccessoryPurchaseRow>[]>(
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
        // Only DRAFT_ORDER rows are selectable.
        checkboxSelection: (params) => params.data?.status === "DRAFT_ORDER",
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
          const cfg = STATUS_CONFIG[params.value] ?? STATUS_CONFIG.DRAFT_ORDER;
          return (
            <span className={`inline-flex items-center rounded border px-1.5 text-[10px] font-medium whitespace-nowrap h-5 ${cfg.className}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        field: "poNumber",
        headerName: "PO #",
        minWidth: 160,
        editable: false,
        cellRenderer: (params: { value: string | null; data?: AccessoryPurchaseRow }) => {
          if (!params.value) return null;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/accessory-purchases/purchase-order?poNumber=${encodeURIComponent(params.value!)}`, "_blank");
              }}
              className="text-[11px] text-blue-600 underline cursor-pointer font-mono"
            >
              {params.value}
            </button>
          );
        },
      },
      {
        field: "purchaseDate",
        headerName: "Date",
        minWidth: 110,
        editable: false,
        valueFormatter: (p) =>
          p.value
            ? new Date(p.value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "",
      },
      {
        field: "accessoryDisplayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 220,
        editable: false,
      },
      { field: "accessoryUnit", headerName: "Unit", minWidth: 80, editable: false },
      { field: "quantity", headerName: "Quantity", minWidth: 100, type: "numericColumn", editable: false },
      { field: "costPerUnit", headerName: "Cost / unit", minWidth: 110, type: "numericColumn", editable: false },
      {
        headerName: "Total",
        minWidth: 120,
        type: "numericColumn",
        editable: false,
        valueGetter: (p) => (p.data ? p.data.quantity * (p.data.costPerUnit || 0) : 0),
        valueFormatter: (p) =>
          (p.value as number).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      },
      { field: "vendorName", headerName: "Vendor", minWidth: 140, editable: false },
      { field: "shipToVendorName", headerName: "Ship To", minWidth: 140, editable: false },
      { field: "invoiceNumber", headerName: "Invoice #", minWidth: 120, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ],
    [],
  );

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={() => { setEditingRow(null); setSheetOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Purchase
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openShipToDialog}
          disabled={selectedCount === 0}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Generate Purchase Orders{selectedCount > 0 ? ` (${selectedCount})` : ""}
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-purchases"
        />
      </div>

      <DataGrid<AccessoryPurchaseRow>
        gridId="accessory-purchases"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={{}}
        onGridApiReady={(api) => {
          gridApiRef.current = api;
          api.addEventListener("selectionChanged", () => {
            setSelectedCount(api.getSelectedRows().length);
          });
        }}
        defaultSort={[{ colId: "purchaseDate", sort: "desc" }]}
        hideAddRowButtons
        onRowClicked={(data) => { setEditingRow(data); setSheetOpen(true); }}
        rowSelection="multiple"
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />

      <AccessoryPurchaseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        phaseId={phaseId}
        accessories={accessories}
        vendors={vendors}
      />

      {/* Ship-to dialog */}
      <Dialog open={shipToOpen} onOpenChange={setShipToOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Purchase Orders</DialogTitle>
            <DialogDescription className="text-[11px]">
              Select where these {pendingIdsRef.current.length} accessory purchase{pendingIdsRef.current.length === 1 ? "" : "s"} should be shipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-[11px]">Ship To *</Label>
            <Combobox
              value={shipToVendorId}
              onValueChange={setShipToVendorId}
              options={vendorOptions}
              placeholder="Select destination..."
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleConfirmGeneratePO}
              disabled={generatingPO || !shipToVendorId}
              size="sm"
            >
              {generatingPO && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Generate POs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
