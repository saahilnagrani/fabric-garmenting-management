"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getProductPrefillFromFabricOrder } from "@/actions/fabric-orders";
import type { ColDef, GridApi, GridReadyEvent, ColumnState, ColumnPinnedType, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
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
import { Plus, Check } from "lucide-react";
import { ProductOrderSheet } from "./product-order-sheet";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "@/components/ag-grid/add-column-dialog";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import "../ag-grid/ag-grid-theme.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type Vendor = { id: string; name: string; type?: string };
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
    orderDate: s(p.orderDate) || "15 Nov 2025",
    styleNumber: s(p.styleNumber), articleNumber: s(p.articleNumber), skuCode: s(p.skuCode),
    colourOrdered: s(p.colourOrdered), isRepeat: Boolean(p.isRepeat),
    type: s(p.type), gender: s(p.gender), productName: s(p.productName),
    status: s(p.status) || "PLANNED", fabricVendorId: s(p.fabricVendorId),
    fabricName: s(p.fabricName), fabricGsm: toNum(p.fabricGsm),
    fabricCostPerKg: toNum(p.fabricCostPerKg), assumedFabricGarmentsPerKg: toNum(p.assumedFabricGarmentsPerKg),
    fabric2Name: s(p.fabric2Name), fabric2CostPerKg: toNum(p.fabric2CostPerKg),
    assumedFabric2GarmentsPerKg: toNum(p.assumedFabric2GarmentsPerKg),
    fabricOrderedQuantityKg: toNum(p.fabricOrderedQuantityKg), fabricShippedQuantityKg: toNum(p.fabricShippedQuantityKg),
    fabric2OrderedQuantityKg: toNum(p.fabric2OrderedQuantityKg), fabric2ShippedQuantityKg: toNum(p.fabric2ShippedQuantityKg),
    fabric2VendorId: s(p.fabric2VendorId),
    garmentNumber: toNum(p.garmentNumber),
    actualStitchedXS: toNum(p.actualStitchedXS) ?? 0, actualStitchedS: toNum(p.actualStitchedS) ?? 0, actualStitchedM: toNum(p.actualStitchedM) ?? 0,
    actualStitchedL: toNum(p.actualStitchedL) ?? 0, actualStitchedXL: toNum(p.actualStitchedXL) ?? 0, actualStitchedXXL: toNum(p.actualStitchedXXL) ?? 0,
    actualInwardXS: toNum(p.actualInwardXS) ?? 0, actualInwardS: toNum(p.actualInwardS) ?? 0, actualInwardM: toNum(p.actualInwardM) ?? 0,
    actualInwardL: toNum(p.actualInwardL) ?? 0, actualInwardXL: toNum(p.actualInwardXL) ?? 0, actualInwardXXL: toNum(p.actualInwardXXL) ?? 0,
    actualInwardTotal: toNum(p.actualInwardTotal) ?? 0,
    invoiceNumber: s(p.invoiceNumber),
    stitchingCost: toNum(p.stitchingCost), brandLogoCost: toNum(p.brandLogoCost),
    neckTwillCost: toNum(p.neckTwillCost), reflectorsCost: toNum(p.reflectorsCost),
    fusingCost: toNum(p.fusingCost), accessoriesCost: toNum(p.accessoriesCost),
    brandTagCost: toNum(p.brandTagCost), sizeTagCost: toNum(p.sizeTagCost),
    packagingCost: toNum(p.packagingCost), outwardShippingCost: toNum(p.outwardShippingCost),
    proposedMrp: toNum(p.proposedMrp), onlineMrp: toNum(p.onlineMrp),
    garmentingAt: s(p.garmentingAt),
  };
}

const COL_STATE_KEY = "ag-grid-col-state-products-v2";

type SizeDistItem = { size: string; percentage: number };

export function ProductGrid({
  products,
  vendors,
  currentTab,
  phaseId,
  productMasters,
  fabricMasters = [],
  sizeDistributions = [],
}: {
  products: unknown[];
  vendors: Vendor[];
  currentTab: string;
  phaseId: string;
  productMasters: ProductMasterType[];
  fabricMasters?: ProductMasterType[];
  sizeDistributions?: SizeDistItem[];
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

  // Helper: expected garments = assumedFabricGarmentsPerKg * fabricShippedQuantityKg
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedGarments = (data: any): number =>
    (toNum(data?.assumedFabricGarmentsPerKg) || 0) * (toNum(data?.fabricShippedQuantityKg) || 0);

  const baseColumnDefs = useMemo<ColDef[]>(() => [
    { field: "styleNumber", headerName: "Style # (legacy)", pinned: "left", minWidth: 90, editable: false },
    {
      field: "orderDate", headerName: "Order Date", minWidth: 120, editable: false,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const d = new Date(String(p.value));
        if (isNaN(d.getTime())) return String(p.value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      },
    },
    { field: "skuCode", headerName: "Article Code", minWidth: 90, editable: false },
    { field: "articleNumber", headerName: "Article #", minWidth: 80, editable: false },
    { field: "colourOrdered", headerName: "Colour", minWidth: 100, editable: false },
    { field: "productName", headerName: "Product Name", minWidth: 110, editable: false },
    { field: "type", headerName: "Product Type", minWidth: 90, editable: false },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: false, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "fabricVendorId", headerName: "Fabric Vendor", minWidth: 110, editable: false, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "status", headerName: "Status", minWidth: 120, editable: false, valueFormatter: (p) => PRODUCT_STATUS_LABELS[p.value] || p.value || "" },
    {
      field: "isRepeat", headerName: "Repeat Order?", minWidth: 80, editable: false,
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
    numCol("fabricGsm", "Fabric GSM", 65),
    numCol("fabricCostPerKg", "Fabric Cost/kg", 100),
    numCol("assumedFabricGarmentsPerKg", "Assumed No of Garments/kg (Fabric 1)", 160),
    { field: "fabric2Name", headerName: "Fabric 2 Name", minWidth: 110, editable: false },
    numCol("fabric2CostPerKg", "Fabric 2 Cost/kg", 100),
    numCol("assumedFabric2GarmentsPerKg", "Assumed No of Garments/kg (Fabric 2)", 160),
    { field: "fabric2VendorId", headerName: "Fabric 2 Vendor", minWidth: 110, editable: false, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    // Quantities
    numCol("fabricOrderedQuantityKg", "Fabric Ordered Qty (kg)", 130),
    numCol("fabricShippedQuantityKg", "Fabric Shipped Qty (kg)", 130),
    numCol("fabric2OrderedQuantityKg", "Fabric 2 Ordered Qty (kg)", 140),
    numCol("fabric2ShippedQuantityKg", "Fabric 2 Shipped Qty (kg)", 140),
    // Invoice
    { field: "invoiceNumber", headerName: "Invoice Number", minWidth: 110, editable: false },
    // Expected & Actual Garment Counts
    { headerName: "Expected No. Of Garments", minWidth: 130, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? expectedGarments(p.data) : 0 },
    { headerName: "Actual No. of Garments Stitched", minWidth: 140, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalSizeCount(p.data) : 0 },
    // Sizes - Stitched
    { headerName: "Expected XS", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: () => 0 },
    numCol("actualStitchedXS", "Actual Stitched - XS", 85),
    { headerName: "Expected S", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 8) : 0 },
    numCol("actualStitchedS", "Actual Stitched - S", 85),
    { headerName: "Expected M", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("actualStitchedM", "Actual Stitched - M", 85),
    { headerName: "Expected L", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("actualStitchedL", "Actual Stitched - L", 85),
    { headerName: "Expected XL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 4) : 0 },
    numCol("actualStitchedXL", "Actual Stitched - XL", 90),
    { headerName: "Expected XXL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? Math.round(expectedGarments(p.data) / 8) : 0 },
    numCol("actualStitchedXXL", "Actual Stitched - XXL", 95),
    // Sizes - Inward
    numCol("actualInwardXS", "Actual Inward XS", 85),
    numCol("actualInwardS", "Actual Inward S", 80),
    numCol("actualInwardM", "Actual Inward M", 80),
    numCol("actualInwardL", "Actual Inward L", 80),
    numCol("actualInwardXL", "Actual Inward XL", 85),
    numCol("actualInwardXXL", "Actual Inward XXL", 90),
    numCol("actualInwardTotal", "Actual Inward Total", 100),
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
    { headerName: "Total Fabric Cost (Rs)", minWidth: 100, editable: false, cellClass: "computed-cell", valueGetter: (p) => { if (!p.data) return 0; return (toNum(p.data.fabricCostPerKg) || 0) * (toNum(p.data.fabricOrderedQuantityKg) || 0); }, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Total Cost per piece (Rs)", minWidth: 125, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    // Pricing
    numCol("outwardShippingCost", "Shipping Cost per piece (Rs)", 125),
    { headerName: "Total Landed Cost per piece (Rs)", minWidth: 145, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalLandedCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    numCol("proposedMrp", "Proposed MRP", 90),
    numCol("onlineMrp", "Online MRP", 90),
    { headerName: "Dealer Price (50% off)", minWidth: 115, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeDealerPrice(p.data.proposedMrp) : 0, valueFormatter: (p) => formatCurrency(p.value) },
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
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColumnDefs, customColumns]);

  function handleRowClicked(event: RowClickedEvent) {
    if (event.data) {
      setEditingRow(event.data);
      setSheetOpen(true);
    }
  }

  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }

  // Open sheet for an existing article order when navigated from another
  // sheet's "Linked Article Orders" section via ?openId=<productId>.
  const openIdParam = searchParams.get("openId");
  const processedOpenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openIdParam) return;
    if (processedOpenIdRef.current === openIdParam) return;
    processedOpenIdRef.current = openIdParam;
    const row = rowData.find((r) => r.id === openIdParam);
    if (row) {
      setEditingRow(row);
      setSheetOpen(true);
    }
    // Strip the param from the URL so it doesn't re-trigger on refresh.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openId");
    const qs = params.toString();
    router.replace(`/products${qs ? `?${qs}` : ""}`);
  }, [openIdParam, rowData, router, searchParams]);

  // Open sheet with prefill data when navigated from fabric order "Create matching article order"
  const prefillFabricOrderId = searchParams.get("prefillFromFabricOrderId");
  const processedPrefillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!prefillFabricOrderId) return;
    if (processedPrefillRef.current === prefillFabricOrderId) return;
    processedPrefillRef.current = prefillFabricOrderId;
    getProductPrefillFromFabricOrder(prefillFabricOrderId)
      .then((prefill) => {
        if (prefill) {
          setEditingRow(prefill as Record<string, unknown>);
          setSheetOpen(true);
        } else {
          toast.error("Could not load prefill data");
        }
      })
      .catch(() => toast.error("Failed to load prefill data"));
  }, [prefillFabricOrderId]);

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
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Search article, code, name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" />
        </form>
        <Select value={searchParams.get("vendor") || "all"} onValueChange={(v) => applyFilter("vendor", v)}>
          <SelectTrigger className="w-[150px]">
            <span className="truncate">{vendorLabels[searchParams.get("vendor") || ""] || "All Vendors"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors
              .filter((v) => v.type === "FABRIC_SUPPLIER")
              .map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
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
          Add Article Order
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey={COL_STATE_KEY}
        />
      </div>

      <ProductOrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        vendors={vendors}
        phaseId={phaseId}
        productMasters={productMasters}
        fabricMasters={fabricMasters}
        isRepeatTab={currentTab === "repeat"}
        editingRow={editingRow}
        sizeDistributions={sizeDistributions}
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
                state: [{ colId: "orderDate", sort: "desc" }],
                defaultState: { sort: null },
              });
            }
          }}
          onRowClicked={handleRowClicked}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          onSortChanged={saveColumnState}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: false, sortable: true, unSortIcon: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true, wrapText: true, autoHeight: true }}
          autoSizeStrategy={hasSavedColState ? undefined : { type: "fitCellContents" }}
          rowClass="group"
          animateRows={false}
        />
      </div>

    </div>
  );
}
