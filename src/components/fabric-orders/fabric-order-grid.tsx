"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getFabricOrderPrefillFromProduct } from "@/actions/products";
import type { ColDef, GridApi, GridReadyEvent, ColumnState, ColumnPinnedType, RowClickedEvent, SelectionChangedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { GENDER_LABELS, FABRIC_ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/formatters";
import { Plus, Check, FileText } from "lucide-react";
import { FabricOrderSheet } from "./fabric-order-sheet";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "@/components/ag-grid/add-column-dialog";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;
type ProductMasterType = Record<string, unknown>;

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
    fabricVendorId: s(o.fabricVendorId),
    articleNumbers: s(o.articleNumbers),
    fabricName: s(o.fabricName),
    colour: s(o.colour),
    gender: s(o.gender),
    invoiceNumber: s(o.invoiceNumber),
    receivedAt: s(o.receivedAt),
    availableColour: s(o.availableColour),
    costPerUnit: toNum(o.costPerUnit),
    fabricOrderedQuantityKg: toNum(o.fabricOrderedQuantityKg),
    fabricShippedQuantityKg: toNum(o.fabricShippedQuantityKg),
    orderDate: s(o.orderDate),
    isRepeat: Boolean(o.isRepeat),
    orderStatus: s(o.orderStatus),
    poNumber: s(o.poNumber),
    piReceivedAt: o.piReceivedAt ? new Date(o.piReceivedAt as string | Date).toISOString() : "",
    advancePaidAt: o.advancePaidAt ? new Date(o.advancePaidAt as string | Date).toISOString() : "",
    garmentingAt: s(o.garmentingAt),
  };
}

/**
 * Compute a derived "awaiting" tag for a fabric order based on its status and
 * the optional payment timestamps. Returns an empty string if nothing relevant
 * is being awaited (e.g. status is DRAFT_ORDER or FULLY_SETTLED).
 */
function awaitingTag(orderStatus: string, piReceivedAt: string, advancePaidAt: string): string {
  if (orderStatus === "PO_SENT" && !piReceivedAt) return "Awaiting PI";
  if (orderStatus === "PI_RECEIVED" && !advancePaidAt) return "Awaiting Advance Payment";
  if (orderStatus === "RECEIVED") return "Awaiting Full Payment";
  return "";
}

const COL_STATE_KEY = "ag-grid-col-state-fabric-orders-v2";

export function FabricOrderGrid({
  orders,
  vendors,
  currentTab,
  phaseId,
  fabricMasters,
  productMasters,
  garmentingLocations,
}: {
  orders: unknown[];
  vendors: Vendor[];
  currentTab: string;
  phaseId: string;
  fabricMasters: FabricMasterType[];
  productMasters: ProductMasterType[];
  garmentingLocations: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gridApiRef = useRef<GridApi | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRows, setEditingRows] = useState<Record<string, unknown>[]>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom columns
  const { columns: customColumns, addColumn, removeColumn, enrichRowData } = useCustomColumns("fabric-orders");

  // Check if saved state exists (for autoSizeStrategy)
  const hasSavedColState = typeof window !== "undefined" && !!localStorage.getItem(COL_STATE_KEY);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem(COL_STATE_KEY, JSON.stringify(state));
  }, []);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  // Keep raw rows for the edit sheet (so clicking a row can find the original orders)
  const rawRows = useMemo((): Record<string, unknown>[] => {
    return (orders as Record<string, unknown>[]).map((o) => toRow(o));
  }, [orders]);

  // Aggregate rows by (fabricName, fabricVendorId, colour): sum numeric fields, concatenate text fields
  const rowData = useMemo((): Record<string, unknown>[] => {
    const groupKey = (r: Record<string, unknown>) =>
      `${r.fabricVendorId}||${r.fabricName}||${r.colour}`;

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rawRows) {
      const key = groupKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const concatUnique = (rows: Record<string, unknown>[], field: string): string => {
      const vals = [...new Set(rows.map((r) => String(r[field] || "")).filter(Boolean))];
      return vals.join(", ");
    };
    const sumField = (rows: Record<string, unknown>[], field: string): number | null => {
      let total = 0;
      let hasValue = false;
      for (const r of rows) {
        const n = toNum(r[field]);
        if (n !== null) { total += n; hasValue = true; }
      }
      return hasValue ? total : null;
    };

    const aggregated: Record<string, unknown>[] = [];
    for (const [, rows] of groups) {
      const first = rows[0];
      aggregated.push({
        // Use a composite id for the aggregated row
        id: rows.map((r) => r.id).join("+"),
        __sourceIds: rows.map((r) => r.id),
        phaseId: first.phaseId,
        fabricVendorId: first.fabricVendorId,
        fabricName: first.fabricName,
        colour: first.colour,
        gender: [...new Set(rows.map((r) => GENDER_LABELS[String(r.gender || "")] || String(r.gender || "")).filter(Boolean))].join(", "),
        articleNumbers: concatUnique(rows, "articleNumbers"),
        orderDate: concatUnique(rows, "orderDate"),
        invoiceNumber: concatUnique(rows, "invoiceNumber"),
        receivedAt: concatUnique(rows, "receivedAt"),
        availableColour: first.availableColour,
        costPerUnit: toNum(first.costPerUnit),
        fabricOrderedQuantityKg: sumField(rows, "fabricOrderedQuantityKg"),
        fabricShippedQuantityKg: sumField(rows, "fabricShippedQuantityKg"),
        isRepeat: rows.some((r) => r.isRepeat),
        orderStatus: concatUnique(rows, "orderStatus"),
        poNumber: concatUnique(rows, "poNumber"),
        piReceivedAt: rows.find((r) => r.piReceivedAt)?.piReceivedAt ?? "",
        advancePaidAt: rows.find((r) => r.advancePaidAt)?.advancePaidAt ?? "",
        garmentingAt: concatUnique(rows, "garmentingAt"),
      });
    }

    // Sort by vendor → fabric name → colour for grouping display
    aggregated.sort((a, b) => {
      const vA = String(a.fabricVendorId || "");
      const vB = String(b.fabricVendorId || "");
      if (vA !== vB) return vA.localeCompare(vB);
      const fA = String(a.fabricName || "");
      const fB = String(b.fabricName || "");
      if (fA !== fB) return fA.localeCompare(fB);
      const cA = String(a.colour || "");
      const cB = String(b.colour || "");
      return cA.localeCompare(cB);
    });

    return aggregated;
  }, [rawRows]);

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const numCol = (field: string, headerName: string, w = 80): ColDef => ({
    field, headerName, minWidth: w, type: "numericColumn", editable: false,
  });

  // Span maps stored in refs so they can be recalculated imperatively on sort changes
  const groupSpanMapRef = useRef(new Map<number, number>());
  const groupStartsRef = useRef(new Set<number>());

  const recalcGroupSpans = useCallback(() => {
    const spanMap = new Map<number, number>();
    const starts = new Set<number>();

    // Walk rows in their current display order (or fall back to rowData array order before grid is ready)
    const displayRows: Record<string, unknown>[] = [];
    const api = gridApiRef.current;
    if (api) {
      api.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) displayRows.push(node.data as Record<string, unknown>);
      });
    }
    const rows = displayRows.length > 0 ? displayRows : rowData;

    let i = 0;
    while (i < rows.length) {
      let j = i + 1;
      while (
        j < rows.length &&
        String(rows[j].fabricVendorId) === String(rows[i].fabricVendorId) &&
        String(rows[j].fabricName) === String(rows[i].fabricName)
      ) {
        j++;
      }
      const span = j - i;
      starts.add(i);
      spanMap.set(i, span);
      for (let k = i + 1; k < j; k++) {
        spanMap.set(k, 1);
      }
      i = j;
    }

    groupSpanMapRef.current = spanMap;
    groupStartsRef.current = starts;
  }, [rowData]);

  // Compute initial spans from rowData order (before grid is ready)
  useMemo(() => {
    recalcGroupSpans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalcGroupSpans]);

  const baseColumnDefs = useMemo<ColDef[]>(() => [
    {
      colId: "__select",
      headerName: "",
      width: 42,
      minWidth: 42,
      maxWidth: 42,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      suppressMovable: true,
    },
    {
      field: "fabricName",
      headerName: "Fabric",
      minWidth: 90,
      pinned: "left",
      editable: false,
      rowSpan: (params) => {
        const idx = params.node?.rowIndex;
        if (idx == null) return 1;
        return groupStartsRef.current.has(idx) ? (groupSpanMapRef.current.get(idx) || 1) : 1;
      },
      cellClassRules: {
        "row-span-cell": (params) => {
          const idx = params.node?.rowIndex;
          return idx != null && groupStartsRef.current.has(idx) && (groupSpanMapRef.current.get(idx) || 1) > 1;
        },
      },
    },
    {
      field: "fabricVendorId",
      headerName: "Vendor",
      minWidth: 80,
      editable: false,
      sortable: true,
      unSortIcon: true,
      valueFormatter: (p) => vendorLabels[p.value] || p.value || "",
      rowSpan: (params) => {
        const idx = params.node?.rowIndex;
        if (idx == null) return 1;
        return groupStartsRef.current.has(idx) ? (groupSpanMapRef.current.get(idx) || 1) : 1;
      },
      cellClassRules: {
        "row-span-cell": (params) => {
          const idx = params.node?.rowIndex;
          return idx != null && groupStartsRef.current.has(idx) && (groupSpanMapRef.current.get(idx) || 1) > 1;
        },
      },
    },
    {
      field: "orderDate", headerName: "Order Date", minWidth: 90, maxWidth: 140, editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        // Handle concatenated dates (from aggregation)
        const dates = String(p.value).split(",").map((d) => d.trim());
        return dates.map((d) => {
          const parsed = new Date(d);
          if (isNaN(parsed.getTime())) return d;
          return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        }).join(", ");
      },
    },
    { field: "articleNumbers", headerName: "Articles", minWidth: 80, editable: false },
    { field: "colour", headerName: "Colour", minWidth: 70, editable: false },
    { field: "gender", headerName: "Gender", minWidth: 65, editable: false },
    { field: "invoiceNumber", headerName: "Invoice #", minWidth: 70, editable: false },
    { field: "receivedAt", headerName: "Received At", minWidth: 90, editable: false },
    numCol("costPerUnit", "Cost/Unit", 70),
    numCol("fabricOrderedQuantityKg", "Ordered (kg)", 80),
    numCol("fabricShippedQuantityKg", "Shipped (kg)", 80),
    // Computed: Expected Fabric Cost = Cost/Unit * Ordered Qty
    {
      headerName: "Expected Cost", minWidth: 90, editable: false, cellClass: "computed-cell",
      valueGetter: (p) => {
        if (!p.data) return 0;
        const cost = toNum(p.data.costPerUnit) || 0;
        const qty = toNum(p.data.fabricOrderedQuantityKg) || 0;
        return cost * qty;
      },
      valueFormatter: (p) => formatCurrency(p.value),
    },
    // Computed: Actual Fabric Cost = Cost/Unit * Shipped Qty
    {
      headerName: "Actual Cost", minWidth: 90, editable: false, cellClass: "computed-cell",
      valueGetter: (p) => {
        if (!p.data) return 0;
        const cost = toNum(p.data.costPerUnit) || 0;
        const qty = toNum(p.data.fabricShippedQuantityKg) || 0;
        return cost * qty;
      },
      valueFormatter: (p) => formatCurrency(p.value),
    },
    { field: "poNumber", headerName: "PO Number", minWidth: 140, editable: false },
    { field: "orderStatus", headerName: "Status", minWidth: 100, editable: false, valueFormatter: (p) => FABRIC_ORDER_STATUS_LABELS[p.value] || p.value || "" },
    {
      headerName: "Awaiting",
      colId: "awaiting",
      minWidth: 160,
      editable: false,
      valueGetter: (p) => {
        if (!p.data) return "";
        return awaitingTag(
          String(p.data.orderStatus || ""),
          String(p.data.piReceivedAt || ""),
          String(p.data.advancePaidAt || ""),
        );
      },
      // Compute tag from the row data directly so we never depend on AG Grid
      // having populated params.value for a column without a `field`.
      cellRenderer: (params: { data?: Record<string, unknown> }) => {
        if (!params.data) return null;
        const tag = awaitingTag(
          String(params.data.orderStatus || ""),
          String(params.data.piReceivedAt || ""),
          String(params.data.advancePaidAt || ""),
        );
        if (!tag) return null;
        return (
          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800">
            {tag}
          </span>
        );
      },
    },
    { field: "garmentingAt", headerName: "Garmenting", minWidth: 90, editable: false },
    {
      field: "isRepeat", headerName: "Repeat Order?", minWidth: 85, maxWidth: 85, editable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        const checked = Boolean(params.data.isRepeat);
        return (
          <div className="flex items-center justify-center h-full">
            <div className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}>
              {checked && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  // Merge custom columns and actions column
  const columnDefs = useMemo<ColDef[]>(() => {
    const customColDefs: ColDef[] = customColumns.map((c) => ({
      field: c.field,
      headerName: c.headerName,
      minWidth: 100,
      editable: false,
    }));

    return [
      ...baseColumnDefs,
      ...customColDefs,
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColumnDefs, customColumns]);

  const handleSortChanged = useCallback(() => {
    saveColumnState();
    recalcGroupSpans();
    if (gridApiRef.current) {
      gridApiRef.current.refreshCells({
        columns: ["fabricName", "fabricVendorId"],
        force: true,
      });
    }
  }, [saveColumnState, recalcGroupSpans]);

  function handleRowClicked(event: RowClickedEvent) {
    if (!event.data) return;

    // Don't open sheet when clicking on merged fabric/vendor cells
    const clickedColId = (event.event?.target as HTMLElement)?.closest?.('[col-id]')?.getAttribute('col-id');
    if ((clickedColId === 'fabricName' || clickedColId === 'fabricVendorId')) {
      const idx = event.node?.rowIndex;
      if (idx != null && groupStartsRef.current.has(idx) && (groupSpanMapRef.current.get(idx) || 1) > 1) {
        return;
      }
    }

    {
      const sourceIds = event.data.__sourceIds as string[] | undefined;
      if (sourceIds && sourceIds.length > 0) {
        const sourceRows = sourceIds
          .map((id) => rawRows.find((r) => r.id === id))
          .filter(Boolean) as Record<string, unknown>[];
        setEditingRows(sourceRows.length > 0 ? sourceRows : [event.data]);
      } else {
        setEditingRows([event.data]);
      }
      setSheetOpen(true);
    }
  }

  function handleAddNew() {
    setEditingRows([]);
    setSheetOpen(true);
  }

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const rows = event.api.getSelectedRows() as Record<string, unknown>[];
    setSelectedRows(rows);
  }, []);

  function handleGeneratePO() {
    if (selectedRows.length === 0) return;
    const ids = selectedRows.flatMap((r) => {
      const sourceIds = r.__sourceIds as string[] | undefined;
      return sourceIds && sourceIds.length > 0 ? sourceIds : [String(r.id)];
    });
    const unique = [...new Set(ids)];
    window.open(`/fabric-orders/purchase-order?ids=${unique.join(",")}`, "_blank");
  }

  // Open sheet with prefill data when navigated from product "Create matching fabric order"
  const prefillProductId = searchParams.get("prefillFromProductId");
  const processedPrefillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!prefillProductId) return;
    if (processedPrefillRef.current === prefillProductId) return;
    processedPrefillRef.current = prefillProductId;
    getFabricOrderPrefillFromProduct(prefillProductId, 1)
      .then((prefill) => {
        if (prefill) {
          setEditingRows([prefill as unknown as Record<string, unknown>]);
          setSheetOpen(true);
        } else {
          toast.error("Could not load prefill data");
        }
      })
      .catch(() => toast.error("Failed to load prefill data"));
  }, [prefillProductId]);

  // Open sheet for an existing fabric order when navigated from another
  // sheet's "Linked Fabric Orders" section via ?openId=<fabricOrderId>.
  const openIdParam = searchParams.get("openId");
  const processedOpenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openIdParam) return;
    if (processedOpenIdRef.current === openIdParam) return;
    processedOpenIdRef.current = openIdParam;
    // The row grid aggregates by vendor — find the underlying source row whose
    // id matches. rowData holds aggregated rows, so we search __sourceIds.
    const match = rowData.find((r) => {
      const sourceIds = (r.__sourceIds as string[] | undefined) || [];
      return sourceIds.includes(openIdParam) || r.id === openIdParam;
    });
    if (match) {
      setEditingRows([match]);
      setSheetOpen(true);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openId");
    const qs = params.toString();
    router.replace(`/fabric-orders${qs ? `?${qs}` : ""}`);
  }, [openIdParam, rowData, router, searchParams]);

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

  const enrichedData = useMemo(() => {
    return enrichRowData([...rowData]);
  }, [rowData, enrichRowData]);

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
          <SelectTrigger className="w-[150px]">
            <span className="truncate">{vendorLabels[searchParams.get("vendor") || ""] || "All Vendors"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Fabric Order
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGeneratePO}
          disabled={selectedRows.length === 0}
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          Generate Purchase Orders{selectedRows.length > 0 ? ` (${selectedRows.length})` : ""}
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey={COL_STATE_KEY}
        />
      </div>

      <FabricOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vendors={vendors}
        phaseId={phaseId}
        fabricMasters={fabricMasters}
        productMasters={productMasters}
        garmentingLocations={garmentingLocations}
        isRepeatTab={currentTab === "repeat"}
        editingRows={editingRows}
      />

      <div className="ag-theme-quartz" style={{ height: "550px", width: "100%" }}>
        <AgGridReact
          theme="legacy"
          rowData={enrichedData}
          columnDefs={columnDefs}
          maintainColumnOrder
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem(COL_STATE_KEY);
            if (saved) {
              try {
                const parsed: ColumnState[] = JSON.parse(saved);
                // Preserve pinned settings from column defs
                const pinnedMap: Record<string, ColumnPinnedType> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field] = col.pinned as ColumnPinnedType; });
                // Columns that use rowSpan must never be sorted (breaks merged cell display)
                const noSortCols = new Set(["fabricName", "fabricVendorId"]);
                const merged = parsed.map((cs) => {
                  const patched = { ...cs };
                  if (cs.colId && pinnedMap[cs.colId] !== undefined) patched.pinned = pinnedMap[cs.colId];
                  if (cs.colId && noSortCols.has(cs.colId)) { patched.sort = null; patched.sortIndex = null; }
                  return patched;
                });
                // Ensure __select column is always first and pinned left, even for users
                // whose saved column state predates it.
                const withoutSelect = merged.filter((cs) => cs.colId !== "__select");
                const finalState: ColumnState[] = [
                  { colId: "__select", pinned: "left", hide: false, width: 42 },
                  ...withoutSelect,
                ];
                e.api.applyColumnState({ state: finalState, applyOrder: true });
              } catch {
                // ignore
              }
            }
            // Data is already pre-sorted by vendor → fabric → colour in the rowData memo,
            // so no grid-level default sort is needed (avoids "Fabric 2" / "Vendor 1" labels).
            // Recalculate spans based on actual grid display order
            recalcGroupSpans();
          }}
          rowSelection="multiple"
          suppressRowClickSelection
          onSelectionChanged={handleSelectionChanged}
          onRowClicked={handleRowClicked}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          onSortChanged={handleSortChanged}
          onRowDataUpdated={() => {
            recalcGroupSpans();
            gridApiRef.current?.refreshCells({ columns: ["fabricName", "fabricVendorId"], force: true });
          }}
          suppressRowTransform
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: false, sortable: false, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={hasSavedColState ? undefined : { type: "fitCellContents" }}
          rowClass="group"
          animateRows={false}
        />
      </div>

    </div>
  );
}
