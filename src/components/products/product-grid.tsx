"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef, GridApi, GridReadyEvent, ColumnState, ColumnPinnedType, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { updateProduct } from "@/actions/products";
import { PRODUCT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalCost,
  computeTotalLandedCost,
  computeDealerPrice,
  computeProfitMargin,
  computeTotalSizeCount,
} from "@/lib/computations";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { Plus, Strikethrough, Check } from "lucide-react";
import { toast } from "sonner";
import { ProductOrderSheet } from "./product-order-sheet";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "@/components/ag-grid/add-column-dialog";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string };
type ProductMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(p: any): Record<string, unknown> {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: p.id,
    phaseId: p.phaseId,
    date: s(p.date) || "15 Nov 2025",
    styleNumber: s(p.styleNumber), articleNumber: s(p.articleNumber), skuCode: s(p.skuCode),
    colour: s(p.colour), isRepeat: Boolean(p.isRepeat),
    type: s(p.type), gender: s(p.gender), productName: s(p.productName),
    status: s(p.status) || "PROCESSING", vendorId: s(p.vendorId),
    fabricName: s(p.fabricName), fabricGsm: toNum(p.fabricGsm),
    fabricCostPerKg: toNum(p.fabricCostPerKg), garmentsPerKg: toNum(p.garmentsPerKg),
    fabric2Name: s(p.fabric2Name), fabric2CostPerKg: toNum(p.fabric2CostPerKg),
    fabric2GarmentsPerKg: toNum(p.fabric2GarmentsPerKg),
    quantityOrderedKg: toNum(p.quantityOrderedKg), quantityShippedKg: toNum(p.quantityShippedKg),
    garmentNumber: toNum(p.garmentNumber), actualGarmentStitched: toNum(p.actualGarmentStitched),
    sizeXS: toNum(p.sizeXS) ?? 0, sizeS: toNum(p.sizeS) ?? 0, sizeM: toNum(p.sizeM) ?? 0,
    sizeL: toNum(p.sizeL) ?? 0, sizeXL: toNum(p.sizeXL) ?? 0, sizeXXL: toNum(p.sizeXXL) ?? 0,
    stitchingCost: toNum(p.stitchingCost), brandLogoCost: toNum(p.brandLogoCost),
    neckTwillCost: toNum(p.neckTwillCost), reflectorsCost: toNum(p.reflectorsCost),
    fusingCost: toNum(p.fusingCost), accessoriesCost: toNum(p.accessoriesCost),
    brandTagCost: toNum(p.brandTagCost), sizeTagCost: toNum(p.sizeTagCost),
    packagingCost: toNum(p.packagingCost), inwardShipping: toNum(p.inwardShipping),
    mrp: toNum(p.mrp), proposedMrp: toNum(p.proposedMrp), onlineMrp: toNum(p.onlineMrp),
    dp: toNum(p.dp), garmentingAt: s(p.garmentingAt),
    isStrikedThrough: Boolean(p.isStrikedThrough),
  };
}

const COL_STATE_KEY = "ag-grid-col-state-products";

export function ProductGrid({
  products,
  vendors,
  currentTab,
  phaseId,
  productMasters,
}: {
  products: unknown[];
  vendors: Vendor[];
  currentTab: string;
  phaseId: string;
  productMasters: ProductMasterType[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const gridApiRef = useRef<GridApi | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom columns
  const { columns: customColumns, addColumn, removeColumn, enrichRowData } = useCustomColumns("products");

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

  const rowData = useMemo((): Record<string, unknown>[] => {
    return (products as Record<string, unknown>[]).map((p) => toRow(p));
  }, [products]);

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const numCol = (field: string, headerName: string, w = 70): ColDef => ({
    field, headerName, minWidth: w, type: "numericColumn", editable: false,
  });

  // Helper: expected garments = garmentsPerKg * quantityShippedKg
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedGarments = (data: any): number =>
    (toNum(data?.garmentsPerKg) || 0) * (toNum(data?.quantityShippedKg) || 0);

  const baseColumnDefs = useMemo<ColDef[]>(() => [
    { field: "styleNumber", headerName: "Style #", pinned: "left", minWidth: 90, editable: false },
    { field: "date", headerName: "Date", minWidth: 130, editable: false },
    { field: "skuCode", headerName: "SKU", minWidth: 90, editable: false },
    { field: "articleNumber", headerName: "Art #", minWidth: 80, editable: false },
    { field: "colour", headerName: "Colour", minWidth: 90, editable: false },
    { field: "productName", headerName: "Product", minWidth: 110, editable: false },
    { field: "type", headerName: "Type", minWidth: 90, editable: false },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: false, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "vendorId", headerName: "Vendor", minWidth: 110, editable: false, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "status", headerName: "Status", minWidth: 120, editable: false, valueFormatter: (p) => PRODUCT_STATUS_LABELS[p.value] || p.value || "" },
    {
      field: "isRepeat", headerName: "Repeat", minWidth: 65, editable: false,
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
    // Fabric
    { field: "fabricName", headerName: "Fabric Name", minWidth: 110, editable: false },
    numCol("fabricGsm", "GSM", 65),
    numCol("fabricCostPerKg", "Fabric 1 Cost/kg", 100),
    numCol("garmentsPerKg", "No of Garments/kg (Fabric 1)", 140),
    { field: "fabric2Name", headerName: "Fabric 2 Name", minWidth: 110, editable: false },
    numCol("fabric2CostPerKg", "Fabric 2 Cost/kg", 100),
    numCol("fabric2GarmentsPerKg", "No of Garments/kg (Fabric 2)", 140),
    // Quantities
    numCol("quantityOrderedKg", "Ordered Qty (Fabric 1; kg)", 130),
    numCol("quantityShippedKg", "Shipped Qty (Fabric 1; kg)", 130),
    // Expected & Actual Garment Counts
    { headerName: "Expected No. Of Garments", minWidth: 130, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? expectedGarments(p.data) : 0 },
    { headerName: "Actual No. of Garments", minWidth: 120, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalSizeCount(p.data) : 0 },
    numCol("actualGarmentStitched", "Stitched", 75),
    // Sizes
    { headerName: "Expected XS", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: () => 0 },
    numCol("sizeXS", "Actual XS", 65),
    { headerName: "Expected S", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 8) : 0 },
    numCol("sizeS", "Actual S", 60),
    { headerName: "Expected M", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("sizeM", "Actual M", 60),
    { headerName: "Expected L", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("sizeL", "Actual L", 60),
    { headerName: "Expected XL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("sizeXL", "Actual XL", 65),
    { headerName: "Expected XXL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 8) : 0 },
    numCol("sizeXXL", "Actual XXL", 70),
    // Garmenting Costs
    numCol("stitchingCost", "Stitching Cost (Rs)", 110),
    numCol("brandLogoCost", "Logo Cost (Rs)", 95),
    numCol("neckTwillCost", "Neck Twill Cost (Rs)", 110),
    numCol("reflectorsCost", "Reflectors Cost (Rs)", 110),
    numCol("fusingCost", "Fusing Cost (Rs)", 100),
    numCol("accessoriesCost", "Accessories Cost (Rs)", 115),
    numCol("brandTagCost", "Brand Tag Cost (Rs)", 110),
    numCol("sizeTagCost", "Size Tag Cost (Rs)", 105),
    numCol("packagingCost", "Packaging Cost (Rs)", 110),
    // Computed
    { headerName: "Total Garmenting Cost (Rs)", minWidth: 130, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalGarmenting(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Fabric Cost per Piece (Rs)", minWidth: 125, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeFabricCostPerPiece(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Fab Cost", minWidth: 80, editable: false, cellClass: "computed-cell", valueGetter: (p) => { if (!p.data) return 0; return (toNum(p.data.fabricCostPerKg) || 0) * (toNum(p.data.quantityOrderedKg) || 0); }, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Total Cost per piece (Rs)", minWidth: 125, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    // Pricing
    numCol("inwardShipping", "Shipping Cost per piece (Rs)", 125),
    { headerName: "Total Landed Cost per piece (Rs)", minWidth: 145, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalLandedCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    numCol("mrp", "MRP", 75),
    { headerName: "Dealer Price (50% off)", minWidth: 115, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeDealerPrice(p.data.mrp) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Profit Margin (%)", minWidth: 100, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeProfitMargin(p.data) : 0, valueFormatter: (p) => formatPercent(p.value) },
    { field: "garmentingAt", headerName: "Garmenting At", minWidth: 110, editable: false },
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
      // Actions
      {
        headerName: "", field: "__actions", width: 45, maxWidth: 45, pinned: "right", editable: false, sortable: false,
        cellRenderer: (params: { data: Record<string, unknown> }) => {
          if (!params.data) return null;
          const isStruck = Boolean(params.data.isStrikedThrough);
          return (
            <button onClick={(e) => { e.stopPropagation(); handleStrikethrough(params.data); }} className={`p-1 ${isStruck ? "opacity-100" : "opacity-40 hover:opacity-100"}`} title={isStruck ? "Remove strikethrough" : "Strikethrough row"}>
              <Strikethrough className={`h-3.5 w-3.5 ${isStruck ? "text-red-500" : "text-gray-500"}`} />
            </button>
          );
        },
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColumnDefs, customColumns]);

  async function handleStrikethrough(data: Record<string, unknown>) {
    const rowId = String(data.id);
    const toggled = !data.isStrikedThrough;
    try {
      await updateProduct(rowId, { isStrikedThrough: toggled });
      toast.success(toggled ? "Row striked through" : "Strikethrough removed");
      router.refresh();
    } catch { toast.error("Failed to update"); }
  }

  function handleRowClicked(event: RowClickedEvent) {
    // Skip if clicking the actions column (strikethrough button)
    const target = event.event?.target as HTMLElement | null;
    if (target?.closest("[col-id='__actions']")) return;
    if (event.data) {
      setEditingRow(event.data);
      setSheetOpen(true);
    }
  }

  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }

  function applyFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`/products?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) { e.preventDefault(); applyFilter("search", search); }

  const tabs = [
    { key: "all", label: "All" },
    { key: "new", label: "New Designs" },
    { key: "repeat", label: "Repeat Designs" },
  ];

  const enrichedData = useMemo(() => {
    const sorted = [...rowData].sort((a, b) => {
      const aStruck = a.isStrikedThrough ? 1 : 0;
      const bStruck = b.isStrikedThrough ? 1 : 0;
      return aStruck - bStruck;
    });
    return enrichRowData(sorted);
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
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Search style, SKU, name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" />
        </form>
        <Select value={searchParams.get("vendor") || "all"} onValueChange={(v) => applyFilter("vendor", v)}>
          <SelectTrigger className="w-[150px]">
            <span className="truncate">{vendorLabels[searchParams.get("vendor") || ""] || "All Vendors"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("status") || "all"} onValueChange={(v) => applyFilter("status", v)}>
          <SelectTrigger className="w-[170px]">
            <span className="truncate">{PRODUCT_STATUS_LABELS[searchParams.get("status") || ""] || "All Statuses"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Product Order
        </Button>
        <AddColumnButton
          columns={customColumns}
          onAdd={addColumn}
          onRemove={removeColumn}
        />
      </div>

      <ProductOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vendors={vendors}
        phaseId={phaseId}
        productMasters={productMasters}
        isRepeatTab={currentTab === "repeat"}
        editingRow={editingRow}
      />

      <div className="ag-theme-quartz" style={{ height: "650px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem(COL_STATE_KEY);
            if (saved) {
              try {
                const parsed: ColumnState[] = JSON.parse(saved);
                const pinnedMap: Record<string, ColumnPinnedType> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field] = col.pinned as ColumnPinnedType; });
                const merged = parsed.map((cs) => {
                  if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
                  return cs;
                });
                e.api.applyColumnState({ state: merged, applyOrder: true });
              } catch {
                // ignore
              }
            }
            // Always apply default sort if no sort is currently set
            const currentState = e.api.getColumnState();
            const hasSort = currentState.some((cs) => cs.sort);
            if (!hasSort) {
              e.api.applyColumnState({
                state: [{ colId: "date", sort: "desc" }],
                defaultState: { sort: null },
              });
            }
          }}
          onRowClicked={handleRowClicked}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          onSortChanged={saveColumnState}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: false, sortable: true, unSortIcon: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={hasSavedColState ? undefined : { type: "fitCellContents" }}
          rowClass="group"
          getRowClass={(params) => params.data?.isStrikedThrough ? "strikethrough-row" : undefined}
          animateRows={false}
        />
      </div>

    </div>
  );
}
