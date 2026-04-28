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
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { Plus, Check, FileDown, ChevronDown } from "lucide-react";
import { ProductOrderSheet } from "./product-order-sheet";
import { useCustomColumns } from "@/hooks/use-custom-columns";
import { AddColumnButton } from "@/components/ag-grid/add-column-dialog";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { ExportExcelButton } from "@/components/ag-grid/export-excel-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const COL_STATE_KEY = "ag-grid-col-state-products-v3";

type SizeDistItem = { size: string; percentage: number };

export function ProductGrid({
  products,
  vendors,
  currentTab,
  phaseId,
  productMasters,
  fabricMasters = [],
  sizeDistributions = [],
  lastPhaseMargins = {},
}: {
  products: unknown[];
  vendors: Vendor[];
  currentTab: string;
  phaseId: string;
  productMasters: ProductMasterType[];
  fabricMasters?: ProductMasterType[];
  sizeDistributions?: SizeDistItem[];
  lastPhaseMargins?: Record<string, number>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const gridApiRef = useRef<GridApi | null>(null);
  const colStateReadyRef = useRef(false);
  // Hold lastPhaseMargins in a ref so the column defs don't rebuild
  // when the parent re-renders with a new (but content-equivalent) object.
  // Rebuilding columnDefs causes AG-Grid to reset user-customized order.
  const lastPhaseMarginsRef = useRef(lastPhaseMargins);
  lastPhaseMarginsRef.current = lastPhaseMargins;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Custom columns
  const { columns: customColumns, addColumn, removeColumn, enrichRowData } = useCustomColumns("products");

  // Check if saved state exists (for autoSizeStrategy)
  const hasSavedColState = typeof window !== "undefined" && !!localStorage.getItem(COL_STATE_KEY);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    if (!colStateReadyRef.current) return;
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
    valueFormatter: (p) => (p.value === null || p.value === undefined || p.value === "" ? "" : formatNumber(p.value as number | string)),
  });

  // Mirror the order sheet logic:
  //   total = garmentNumber (target qty) when > 0, else round(fabricQtyKg × garmentsPerKg)
  //   fabricQtyKg = shipped || ordered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedGarments = (data: any): number => {
    const target = toNum(data?.garmentNumber) || 0;
    if (target > 0) return target;
    const kg = toNum(data?.fabricShippedQuantityKg) || toNum(data?.fabricOrderedQuantityKg) || 0;
    const gpk = toNum(data?.assumedFabricGarmentsPerKg) || 0;
    return Math.round(kg * gpk);
  };

  const sizePctMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sizeDistributions) m.set(s.size, s.percentage);
    return m;
  }, [sizeDistributions]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedForSize = (data: any, size: string): number => {
    const total = expectedGarments(data);
    if (!total) return 0;
    const pct = sizePctMap.get(size) || 0;
    return Math.round((total * pct) / 100);
  };

  const baseColumnDefs = useMemo<ColDef[]>(() => [
    // Pinned identity columns (default order)
    { field: "fabricVendorId", headerName: "Fabric 1 Vendor", pinned: "left", minWidth: 110, editable: false, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "fabricName", headerName: "Fabric 1", pinned: "left", minWidth: 110, editable: false },
    { field: "fabric2Name", headerName: "Fabric 2", pinned: "left", minWidth: 110, editable: false },
    { field: "productName", headerName: "Product Name", pinned: "left", minWidth: 110, editable: false },
    // Visible main columns
    { field: "type", headerName: "Type", minWidth: 90, editable: false },
    { field: "colourOrdered", headerName: "Colour", minWidth: 100, editable: false },
    { field: "skuCode", headerName: "Article Code", minWidth: 90, editable: false },
    { field: "articleNumber", headerName: "Article Number", minWidth: 80, editable: false },
    { field: "garmentingAt", headerName: "Garmenting At", minWidth: 110, editable: false },
    numCol("assumedFabricGarmentsPerKg", "Fabric 1 Garments/Kg", 130),
    numCol("fabricOrderedQuantityKg", "Fabric 1 Quantity", 110),
    numCol("fabric2OrderedQuantityKg", "Fabric 2 Quantity", 110),
    { headerName: "Expected FG", minWidth: 100, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedGarments(p.data) : 0 },
    { headerName: "Expected S", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "S") : 0 },
    { headerName: "Expected M", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "M") : 0 },
    { headerName: "Expected L", minWidth: 75, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "L") : 0 },
    { headerName: "Expected XL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "XL") : 0 },
    { headerName: "Expected XXL", minWidth: 80, editable: false, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "XXL") : 0 },
    numCol("stitchingCost", "Stitching Cost", 110),
    numCol("brandLogoCost", "Logo Cost", 95),
    numCol("neckTwillCost", "Neck Twill", 100),
    numCol("reflectorsCost", "Reflectors", 100),
    numCol("fusingCost", "Fusing", 90),
    numCol("accessoriesCost", "Accessories", 105),
    numCol("brandTagCost", "Brand Tag Cost", 110),
    numCol("sizeTagCost", "Size Tag/hyperballik", 130),
    numCol("packagingCost", "Packaging", 100),
    { headerName: "Total Garmenting", minWidth: 120, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalGarmenting(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Total Fabric Cost", minWidth: 110, editable: false, cellClass: "computed-cell", valueGetter: (p) => { if (!p.data) return 0; return (toNum(p.data.fabricCostPerKg) || 0) * (toNum(p.data.fabricOrderedQuantityKg) || 0); }, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Fabric Cost/Piece", minWidth: 115, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeFabricCostPerPiece(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Total Cost Per Piece", minWidth: 120, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    numCol("outwardShippingCost", "Inward Shipping", 110),
    { headerName: "Total Landed Cost Per Piece", minWidth: 140, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalLandedCost(p.data) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    numCol("proposedMrp", "Proposed MRP", 100),
    { headerName: "Dealer Price (50% off)", minWidth: 115, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeDealerPrice(p.data.proposedMrp) : 0, valueFormatter: (p) => formatCurrency(p.value) },
    { headerName: "Profit Margin", minWidth: 100, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeProfitMargin(p.data) : 0, valueFormatter: (p) => formatPercent(p.value) },
    {
      colId: "lastPhaseProfitMargin", headerName: "Last Phase Profit Margin", minWidth: 130, editable: false, cellClass: "computed-cell", type: "numericColumn",
      valueGetter: (p) => {
        const an = p.data?.articleNumber as string | undefined;
        if (!an) return null;
        const m = lastPhaseMarginsRef.current[an];
        return m === undefined ? null : m;
      },
      valueFormatter: (p) => p.value === null || p.value === undefined ? "" : formatPercent(p.value),
    },
    // Hidden by default (kept available so users can re-enable via Manage Columns)
    { field: "styleNumber", headerName: "Style # (legacy)", minWidth: 90, editable: false, hide: true },
    {
      field: "orderDate", headerName: "Order Date", minWidth: 120, editable: false, hide: true,
      valueFormatter: (p) => {
        if (!p.value) return "";
        const d = new Date(String(p.value));
        if (isNaN(d.getTime())) return String(p.value);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      },
    },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: false, hide: true, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "status", headerName: "Status", minWidth: 120, editable: false, hide: true, valueFormatter: (p) => PRODUCT_STATUS_LABELS[p.value] || p.value || "" },
    {
      field: "isRepeat", headerName: "Repeat Order?", minWidth: 80, editable: false, hide: true,
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
    { ...numCol("fabricGsm", "Fabric GSM", 65), hide: true },
    { ...numCol("fabricCostPerKg", "Fabric Cost/kg", 100), hide: true },
    { ...numCol("fabric2CostPerKg", "Fabric 2 Cost/kg", 100), hide: true },
    { ...numCol("assumedFabric2GarmentsPerKg", "Fabric 2 Garments/Kg", 130), hide: true },
    { field: "fabric2VendorId", headerName: "Fabric 2 Vendor", minWidth: 110, editable: false, hide: true, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { ...numCol("fabricShippedQuantityKg", "Fabric Shipped Qty (kg)", 130), hide: true },
    { ...numCol("fabric2ShippedQuantityKg", "Fabric 2 Shipped Qty (kg)", 140), hide: true },
    { field: "invoiceNumber", headerName: "Invoice Number", minWidth: 110, editable: false, hide: true },
    { headerName: "Actual No. of Garments Stitched", minWidth: 140, editable: false, hide: true, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalSizeCount(p.data) : 0 },
    { headerName: "Expected XS", minWidth: 75, editable: false, hide: true, cellClass: "computed-cell", type: "numericColumn", valueGetter: (p) => p.data ? expectedForSize(p.data, "XS") : 0 },
    { ...numCol("actualStitchedXS", "Actual Stitched - XS", 85), hide: true },
    { ...numCol("actualStitchedS", "Actual Stitched - S", 85), hide: true },
    { ...numCol("actualStitchedM", "Actual Stitched - M", 85), hide: true },
    { ...numCol("actualStitchedL", "Actual Stitched - L", 85), hide: true },
    { ...numCol("actualStitchedXL", "Actual Stitched - XL", 90), hide: true },
    { ...numCol("actualStitchedXXL", "Actual Stitched - XXL", 95), hide: true },
    { ...numCol("actualInwardXS", "Actual Inward XS", 85), hide: true },
    { ...numCol("actualInwardS", "Actual Inward S", 80), hide: true },
    { ...numCol("actualInwardM", "Actual Inward M", 80), hide: true },
    { ...numCol("actualInwardL", "Actual Inward L", 80), hide: true },
    { ...numCol("actualInwardXL", "Actual Inward XL", 85), hide: true },
    { ...numCol("actualInwardXXL", "Actual Inward XXL", 90), hide: true },
    { ...numCol("actualInwardTotal", "Actual Inward Total", 100), hide: true },
    { ...numCol("onlineMrp", "Online MRP", 90), hide: true },
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Garmenting Plan PDF
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {(() => {
              // Bucket the (filtered) article orders by garmenter directly from the
              // row data feeding the grid — rowData/enrichedData already reflects the
              // user's current filters via the URL searchParams that drive the fetch.
              const idsByGarmenter = new Map<string, string[]>();
              for (const r of enrichedData) {
                const id = r.id ? String(r.id) : "";
                const g = r.garmentingAt ? String(r.garmentingAt) : "";
                if (!id) continue;
                const key = g || "(Unassigned)";
                if (!idsByGarmenter.has(key)) idsByGarmenter.set(key, []);
                idsByGarmenter.get(key)!.push(id);
              }
              const entries = Array.from(idsByGarmenter.entries()).sort(([a], [b]) => a.localeCompare(b));
              if (entries.length === 0) {
                return <DropdownMenuItem disabled>No article orders</DropdownMenuItem>;
              }
              return (
                <>
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    Select a garmenter
                  </div>
                  <DropdownMenuSeparator />
                  {entries.map(([name, ids]) => (
                    <DropdownMenuItem
                      key={name}
                      onClick={() => {
                        window.open(`/products/garmenting-plan?ids=${ids.join(",")}`, "_blank");
                      }}
                    >
                      <span className="flex-1 truncate">{name}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">{ids.length}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              );
            })()}
          </DropdownMenuContent>
        </DropdownMenu>
        <ExportExcelButton gridApiRef={gridApiRef} fileName="article-orders" sheetName="Article Orders" />
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
                const savedColIds = new Set(parsed.map((cs) => cs.colId).filter(Boolean) as string[]);
                const pinnedFallback: Record<string, ColumnPinnedType> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedFallback[col.field] = col.pinned as ColumnPinnedType; });
                const merged = parsed.map((cs) => {
                  if (cs.colId && cs.pinned === undefined && pinnedFallback[cs.colId] !== undefined) {
                    return { ...cs, pinned: pinnedFallback[cs.colId] };
                  }
                  return cs;
                });
                Object.keys(pinnedFallback).forEach((colId) => {
                  if (!savedColIds.has(colId)) merged.push({ colId, pinned: pinnedFallback[colId] });
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
            // Allow persistence only after init completes, so AG-Grid's
            // own startup events don't lock in a stale order.
            setTimeout(() => { colStateReadyRef.current = true; }, 0);
          }}
          onRowClicked={handleRowClicked}
          onColumnMoved={saveColumnState}
          onColumnPinned={saveColumnState}
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
