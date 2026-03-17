"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColDef, CellValueChangedEvent, GridApi, GridReadyEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { createProduct, updateProduct } from "@/actions/products";
import { validateProduct } from "@/lib/validations";
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
import { Plus, Strikethrough, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DateCellEditor } from "@/components/ag-grid/date-cell-editor";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPayload(data: Record<string, unknown>, phaseId?: string): any {
  const numOrNull = (v: unknown) => toNum(v);
  const intOrNull = (v: unknown) => { const n = toNum(v); return n !== null ? Math.round(n) : null; };
  const strOrNull = (v: unknown) => (v ? String(v) : null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    date: String(data.date || "15 Nov 2025"),
    styleNumber: String(data.styleNumber), articleNumber: strOrNull(data.articleNumber),
    skuCode: strOrNull(data.skuCode), colour: String(data.colour || ""),
    isRepeat: Boolean(data.isRepeat), type: String(data.type || ""),
    gender: String(data.gender || "MENS"), productName: strOrNull(data.productName),
    status: String(data.status || "PROCESSING"), vendorId: String(data.vendorId || ""),
    fabricName: String(data.fabricName || ""), fabricGsm: numOrNull(data.fabricGsm),
    fabricCostPerKg: numOrNull(data.fabricCostPerKg), garmentsPerKg: numOrNull(data.garmentsPerKg),
    fabric2Name: strOrNull(data.fabric2Name), fabric2CostPerKg: numOrNull(data.fabric2CostPerKg),
    fabric2GarmentsPerKg: numOrNull(data.fabric2GarmentsPerKg),
    quantityOrderedKg: numOrNull(data.quantityOrderedKg), quantityShippedKg: numOrNull(data.quantityShippedKg),
    garmentNumber: intOrNull(data.garmentNumber), actualGarmentStitched: intOrNull(data.actualGarmentStitched),
    sizeXS: intOrNull(data.sizeXS) ?? 0, sizeS: intOrNull(data.sizeS) ?? 0,
    sizeM: intOrNull(data.sizeM) ?? 0, sizeL: intOrNull(data.sizeL) ?? 0,
    sizeXL: intOrNull(data.sizeXL) ?? 0, sizeXXL: intOrNull(data.sizeXXL) ?? 0,
    stitchingCost: numOrNull(data.stitchingCost), brandLogoCost: numOrNull(data.brandLogoCost),
    neckTwillCost: numOrNull(data.neckTwillCost), reflectorsCost: numOrNull(data.reflectorsCost),
    fusingCost: numOrNull(data.fusingCost), accessoriesCost: numOrNull(data.accessoriesCost),
    brandTagCost: numOrNull(data.brandTagCost), sizeTagCost: numOrNull(data.sizeTagCost),
    packagingCost: numOrNull(data.packagingCost), inwardShipping: numOrNull(data.inwardShipping),
    mrp: numOrNull(data.mrp), proposedMrp: numOrNull(data.proposedMrp),
    onlineMrp: numOrNull(data.onlineMrp), garmentingAt: strOrNull(data.garmentingAt),
    isStrikedThrough: Boolean(data.isStrikedThrough),
  };
  if (phaseId) payload.phaseId = phaseId;
  return payload;
}

type RowStatus = "clean" | "dirty" | "saving" | "error";

function StatusCellRenderer(props: { data: { __status?: RowStatus } }) {
  const status = props.data?.__status;
  if (status === "saving") return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (status === "error") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (status === "dirty") return <div className="h-2 w-2 rounded-full bg-yellow-400" />;
  return <Check className="h-3 w-3 text-green-500 opacity-0 group-hover:opacity-100" />;
}

let tempId = 0;

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
  const [statusMap, setStatusMap] = useState<Map<string, RowStatus>>(new Map());
  const [tempRows, setTempRows] = useState<Record<string, unknown>[]>([]);
  const saveTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isAutoPopulating = useRef(false);
  const colSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const saveColumnState = useCallback(() => {
    if (!gridApiRef.current) return;
    const state = gridApiRef.current.getColumnState();
    localStorage.setItem("ag-grid-col-state-products", JSON.stringify(state));
  }, []);

  const saveColumnStateDebounced = useCallback(() => {
    if (colSaveTimer.current) clearTimeout(colSaveTimer.current);
    colSaveTimer.current = setTimeout(() => {
      saveColumnState();
    }, 300);
  }, [saveColumnState]);

  const rowData = useMemo((): (Record<string, unknown> & { __status: RowStatus })[] => {
    return (products as Record<string, unknown>[]).map((p) => ({
      ...toRow(p),
      __status: "clean" as RowStatus,
    }));
  }, [products]);

  const vendorValues = vendors.map((v) => v.id);
  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const genderValues = Object.keys(GENDER_LABELS);
  const statusValues = Object.keys(PRODUCT_STATUS_LABELS);

  const numCol = (field: string, headerName: string, w = 70): ColDef => ({
    field, headerName, minWidth: w, type: "numericColumn", editable: true,
    valueParser: (p) => toNum(p.newValue),
  });

  // Helper: expected garments = garmentsPerKg * quantityShippedKg
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expectedGarments = (data: any): number =>
    (toNum(data?.garmentsPerKg) || 0) * (toNum(data?.quantityShippedKg) || 0);

  const columnDefs = useMemo<ColDef[]>(() => [
    { headerName: "", field: "__status", width: 40, maxWidth: 40, pinned: "left", editable: false, sortable: false, cellRenderer: StatusCellRenderer, cellClass: "status-cell" },
    { field: "styleNumber", headerName: "Style #", pinned: "left", minWidth: 90, editable: true },
    { field: "date", headerName: "Date", minWidth: 130, editable: true, cellEditor: DateCellEditor },
    { field: "skuCode", headerName: "SKU", minWidth: 90, editable: true },
    { field: "articleNumber", headerName: "Art #", minWidth: 80, editable: true },
    { field: "colour", headerName: "Colour", minWidth: 90, editable: true },
    { field: "productName", headerName: "Product", minWidth: 110, editable: true },
    { field: "type", headerName: "Type", minWidth: 90, editable: true },
    { field: "gender", headerName: "Gender", minWidth: 85, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: genderValues }, valueFormatter: (p) => GENDER_LABELS[p.value] || p.value || "" },
    { field: "vendorId", headerName: "Vendor", minWidth: 110, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: vendorValues }, valueFormatter: (p) => vendorLabels[p.value] || p.value || "" },
    { field: "status", headerName: "Status", minWidth: 120, editable: true, cellEditor: "agSelectCellEditor", cellEditorParams: { values: statusValues }, valueFormatter: (p) => PRODUCT_STATUS_LABELS[p.value] || p.value || "" },
    {
      field: "isRepeat", headerName: "Repeat", minWidth: 65, editable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        const checked = Boolean(params.data.isRepeat);
        return (
          <div className="flex items-center justify-center h-full">
            <button
              onClick={() => {
                const rowId = String(params.data.id);
                const updated = { ...params.data, isRepeat: !checked };
                gridApiRef.current?.applyTransaction({ update: [updated] });
                setStatus(rowId, "dirty");
                if (rowId.startsWith("__new_")) {
                  setTempRows((prev) => prev.map((r) => String(r.id) === rowId ? updated : r));
                }
                debouncedSave(updated);
              }}
              className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${checked ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}
            >
              {checked && <Check className="h-3 w-3 text-white" />}
            </button>
          </div>
        );
      },
    },
    // Fabric
    { field: "fabricName", headerName: "Fabric Name", minWidth: 110, editable: true },
    numCol("fabricGsm", "GSM", 65),
    numCol("fabricCostPerKg", "Fabric 1 Cost/kg", 100),
    numCol("garmentsPerKg", "No of Garments/kg (Fabric 1)", 140),
    { field: "fabric2Name", headerName: "Ordered Qty (Fabric 2; kg)", minWidth: 140, editable: true },
    numCol("fabric2CostPerKg", "Fabric 2 Cost/kg", 100),
    numCol("fabric2GarmentsPerKg", "No of Garments/kg (Fabric 2)", 140),
    // Quantities
    numCol("quantityOrderedKg", "Ordered Qty (Fabric 1; kg)", 130),
    numCol("quantityShippedKg", "Shipped Qty (Fabric 1; kg)", 130),
    // Expected & Actual Garment Counts
    { headerName: "Expected No. Of Garments", minWidth: 130, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? expectedGarments(p.data) : 0 },
    { headerName: "Actual No. of Garments", minWidth: 120, editable: false, cellClass: "computed-cell", valueGetter: (p) => p.data ? computeTotalSizeCount(p.data) : 0 },
    numCol("actualGarmentStitched", "Stitched", 75),
    // Sizes – Expected then Actual for each size
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
    { field: "garmentingAt", headerName: "Garmenting At", minWidth: 110, editable: true },
    // Actions
    {
      headerName: "", width: 45, maxWidth: 45, pinned: "right", editable: false, sortable: false,
      cellRenderer: (params: { data: Record<string, unknown> }) => {
        if (!params.data) return null;
        const isStruck = Boolean(params.data.isStrikedThrough);
        return (
          <button onClick={() => handleStrikethrough(params.data)} className={`p-1 ${isStruck ? "opacity-100" : "opacity-40 hover:opacity-100"}`} title={isStruck ? "Remove strikethrough" : "Strikethrough row"}>
            <Strikethrough className={`h-3.5 w-3.5 ${isStruck ? "text-red-500" : "text-gray-500"}`} />
          </button>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  function setStatus(id: string, status: RowStatus) {
    setStatusMap((prev) => { const next = new Map(prev); next.set(id, status); return next; });
  }

  const saveRow = useCallback(async (data: Record<string, unknown>) => {
    const rowId = String(data.id);
    const isNew = rowId.startsWith("__new_");

    if (validateProduct(data)) {
      setStatus(rowId, "error");
      return;
    }

    setStatus(rowId, "saving");
    try {
      if (isNew) {
        await createProduct(toPayload(data, phaseId));
        setTempRows((prev) => prev.filter((r) => String(r.id) !== rowId));
        setStatusMap((prev) => { const next = new Map(prev); next.delete(rowId); return next; });
        toast.success("Product created");
      } else {
        await updateProduct(rowId, toPayload(data));
        setStatus(rowId, "clean");
      }
    } catch {
      setStatus(rowId, "error");
      toast.error("Failed to save");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseId]);

  function debouncedSave(data: Record<string, unknown>) {
    const rowId = String(data.id);
    const existing = saveTimers.current.get(rowId);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(rowId, setTimeout(() => { saveTimers.current.delete(rowId); saveRow(data); }, 800));
  }

  function onCellValueChanged(event: CellValueChangedEvent) {
    if (isAutoPopulating.current || !event.data) return;
    const rowId = String(event.data.id);
    setStatus(rowId, "dirty");

    let dataToSave = event.data;

    // Auto-populate from ProductMaster when styleNumber changes
    if (event.column.getColId() === "styleNumber" && event.data.styleNumber) {
      const master = productMasters.find((m) => String(m.styleNumber) === event.data.styleNumber);
      if (master) {
        isAutoPopulating.current = true;
        const merged = { ...event.data };
        const fields = ["fabricName", "type", "gender", "productName", "garmentsPerKg", "stitchingCost", "brandLogoCost", "neckTwillCost", "reflectorsCost", "fusingCost", "accessoriesCost", "brandTagCost", "sizeTagCost", "packagingCost", "fabricCostPerKg", "fabric2CostPerKg", "inwardShipping", "proposedMrp", "onlineMrp"];
        fields.forEach((f) => { if (master[f] !== undefined && master[f] !== null) merged[f] = toNum(master[f]) ?? String(master[f]); });
        gridApiRef.current?.applyTransaction({ update: [merged] });
        setTimeout(() => { isAutoPopulating.current = false; }, 100);
        dataToSave = merged;
      }
    }

    // Keep temp rows in sync with grid edits
    if (rowId.startsWith("__new_")) {
      setTempRows((prev) => prev.map((r) => String(r.id) === rowId ? { ...dataToSave } : r));
    }

    debouncedSave(dataToSave);
  }

  async function handleStrikethrough(data: Record<string, unknown>) {
    const rowId = String(data.id);
    if (rowId.startsWith("__new_")) {
      setTempRows((prev) => prev.filter((r) => String(r.id) !== rowId));
      setStatusMap((prev) => { const next = new Map(prev); next.delete(rowId); return next; });
      return;
    }
    const toggled = !data.isStrikedThrough;
    try {
      await updateProduct(rowId, { isStrikedThrough: toggled });
      const updated = { ...data, isStrikedThrough: toggled };
      gridApiRef.current?.applyTransaction({ update: [updated] });
      toast.success(toggled ? "Row striked through" : "Strikethrough removed");
    } catch { toast.error("Failed to update"); }
  }

  function addRow(position: "top" | "bottom") {
    const id = `__new_${++tempId}_${Date.now()}`;
    const newRow = {
      id, phaseId, date: "15 Nov 2025", styleNumber: "", colour: "", type: "", gender: "MENS", vendorId: vendors[0]?.id || "",
      fabricName: "", status: "PROCESSING", isRepeat: currentTab === "repeat", isStrikedThrough: false,
      sizeXS: 0, sizeS: 0, sizeM: 0, sizeL: 0, sizeXL: 0, sizeXXL: 0,
    };
    setTempRows((prev) => position === "top" ? [newRow, ...prev] : [...prev, newRow]);
    setStatus(id, "dirty");
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

  // Enrich with status from statusMap, merge temp rows
  const enrichedData = useMemo(() => {
    const serverRows = rowData.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("clean" as RowStatus) }));
    const tempEnriched = tempRows.map((r) => ({ ...r, __status: statusMap.get(String(r.id)) || ("dirty" as RowStatus) }));
    const all = [...tempEnriched, ...serverRows];
    return all.sort((a, b) => {
      const aStruck = (a as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      const bStruck = (b as Record<string, unknown>).isStrikedThrough ? 1 : 0;
      return aStruck - bStruck;
    });
  }, [rowData, statusMap, tempRows]);

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

      <Button variant="outline" size="sm" onClick={() => addRow("top")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Top
      </Button>

      <div className="ag-theme-quartz" style={{ height: "650px", width: "100%" }}>
        <AgGridReact
          rowData={enrichedData}
          columnDefs={columnDefs}
          onGridReady={(e: GridReadyEvent) => {
            gridApiRef.current = e.api;
            const saved = localStorage.getItem("ag-grid-col-state-products");
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                const pinnedMap: Record<string, string | null> = {};
                columnDefs.forEach((col) => { if (col.field && col.pinned) pinnedMap[col.field] = col.pinned as string; });
                const merged = parsed.map((cs: { colId?: string; pinned?: string | null }) => {
                  if (cs.colId && pinnedMap[cs.colId] !== undefined) return { ...cs, pinned: pinnedMap[cs.colId] };
                  return cs;
                });
                e.api.applyColumnState({ state: merged, applyOrder: true });
              } catch {
                // Ignore invalid saved state
              }
            }
          }}
          onCellValueChanged={onCellValueChanged}
          onColumnMoved={saveColumnState}
          onColumnResized={saveColumnStateDebounced}
          getRowId={(params) => String(params.data.id)}
          defaultColDef={{ editable: true, sortable: true, filter: false, resizable: true, minWidth: 60, wrapHeaderText: true, autoHeaderHeight: true }}
          autoSizeStrategy={{ type: "fitCellContents" }}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          rowClass="group"
          getRowClass={(params) => params.data?.isStrikedThrough ? "strikethrough-row" : undefined}
          animateRows={false}
        />
      </div>

      <Button variant="outline" size="sm" onClick={() => addRow("bottom")}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Row Bottom
      </Button>
    </div>
  );
}
