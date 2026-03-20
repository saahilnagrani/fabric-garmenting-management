"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { createProduct, updateProduct, deleteProduct } from "@/actions/products";
import { GENDER_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { Combobox } from "@/components/ui/combobox";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalCost,
  computeTotalLandedCost,
  computeDealerPrice,
  computeProfitMargin,
} from "@/lib/computations";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";
import { Loader2, Trash2, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";

type Vendor = { id: string; name: string };
type ProductMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  styleNumber: string;
  articleNumber: string;
  skuCode: string;
  colourOrdered: string;
  type: string;
  gender: string;
  productName: string;
  fabricVendorId: string;
  fabric2VendorId: string;
  status: string;
  fabricName: string;
  fabricGsm: string;
  fabricCostPerKg: string;
  assumedFabricGarmentsPerKg: string;
  fabric2Name: string;
  fabric2CostPerKg: string;
  assumedFabric2GarmentsPerKg: string;
  fabricOrderedQuantityKg: string;
  fabricShippedQuantityKg: string;
  fabric2OrderedQuantityKg: string;
  fabric2ShippedQuantityKg: string;
  stitchingCost: string;
  brandLogoCost: string;
  neckTwillCost: string;
  reflectorsCost: string;
  fusingCost: string;
  accessoriesCost: string;
  brandTagCost: string;
  sizeTagCost: string;
  packagingCost: string;
  outwardShippingCost: string;
  proposedMrp: string;
  onlineMrp: string;
  invoiceNumber: string;
  garmentingAt: string;
  isRepeat: boolean;
  orderDate: string;
  actualStitchedXS: string;
  actualStitchedS: string;
  actualStitchedM: string;
  actualStitchedL: string;
  actualStitchedXL: string;
  actualStitchedXXL: string;
  actualInwardXS: string;
  actualInwardS: string;
  actualInwardM: string;
  actualInwardL: string;
  actualInwardXL: string;
  actualInwardXXL: string;
  actualInwardTotal: string;
};

const emptyForm: FormData = {
  styleNumber: "",
  articleNumber: "",
  skuCode: "",
  colourOrdered: "",
  type: "",
  gender: "MENS",
  productName: "",
  fabricVendorId: "",
  fabric2VendorId: "",
  status: "PROCESSING",
  fabricName: "",
  fabricGsm: "",
  fabricCostPerKg: "",
  assumedFabricGarmentsPerKg: "",
  fabric2Name: "",
  fabric2CostPerKg: "",
  assumedFabric2GarmentsPerKg: "",
  fabricOrderedQuantityKg: "",
  fabricShippedQuantityKg: "",
  fabric2OrderedQuantityKg: "",
  fabric2ShippedQuantityKg: "",
  stitchingCost: "",
  brandLogoCost: "",
  neckTwillCost: "",
  reflectorsCost: "",
  fusingCost: "",
  accessoriesCost: "",
  brandTagCost: "",
  sizeTagCost: "",
  packagingCost: "",
  outwardShippingCost: "",
  proposedMrp: "",
  onlineMrp: "",
  invoiceNumber: "",
  garmentingAt: "",
  isRepeat: false,
  orderDate: "",
  actualStitchedXS: "",
  actualStitchedS: "",
  actualStitchedM: "",
  actualStitchedL: "",
  actualStitchedXL: "",
  actualStitchedXXL: "",
  actualInwardXS: "",
  actualInwardS: "",
  actualInwardM: "",
  actualInwardL: "",
  actualInwardXL: "",
  actualInwardXXL: "",
  actualInwardTotal: "",
};

function rowToForm(row: Record<string, unknown>): FormData {
  const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
  const sNum = (v: unknown) => (v !== null && v !== undefined && v !== 0 ? String(v) : "");
  return {
    styleNumber: s(row.styleNumber),
    articleNumber: s(row.articleNumber),
    skuCode: s(row.skuCode),
    colourOrdered: s(row.colourOrdered),
    type: s(row.type),
    gender: s(row.gender) || "MENS",
    productName: s(row.productName),
    fabricVendorId: s(row.fabricVendorId),
    fabric2VendorId: s(row.fabric2VendorId),
    status: s(row.status) || "PROCESSING",
    fabricName: s(row.fabricName),
    fabricGsm: s(row.fabricGsm),
    fabricCostPerKg: s(row.fabricCostPerKg),
    assumedFabricGarmentsPerKg: s(row.assumedFabricGarmentsPerKg),
    fabric2Name: s(row.fabric2Name),
    fabric2CostPerKg: s(row.fabric2CostPerKg),
    assumedFabric2GarmentsPerKg: s(row.assumedFabric2GarmentsPerKg),
    fabricOrderedQuantityKg: s(row.fabricOrderedQuantityKg),
    fabricShippedQuantityKg: s(row.fabricShippedQuantityKg),
    fabric2OrderedQuantityKg: s(row.fabric2OrderedQuantityKg),
    fabric2ShippedQuantityKg: s(row.fabric2ShippedQuantityKg),
    stitchingCost: s(row.stitchingCost),
    brandLogoCost: s(row.brandLogoCost),
    neckTwillCost: s(row.neckTwillCost),
    reflectorsCost: s(row.reflectorsCost),
    fusingCost: s(row.fusingCost),
    accessoriesCost: s(row.accessoriesCost),
    brandTagCost: s(row.brandTagCost),
    sizeTagCost: s(row.sizeTagCost),
    packagingCost: s(row.packagingCost),
    outwardShippingCost: s(row.outwardShippingCost),
    proposedMrp: s(row.proposedMrp),
    onlineMrp: s(row.onlineMrp),
    invoiceNumber: s(row.invoiceNumber),
    garmentingAt: s(row.garmentingAt),
    isRepeat: Boolean(row.isRepeat),
    orderDate: s(row.orderDate),
    actualStitchedXS: sNum(row.actualStitchedXS),
    actualStitchedS: sNum(row.actualStitchedS),
    actualStitchedM: sNum(row.actualStitchedM),
    actualStitchedL: sNum(row.actualStitchedL),
    actualStitchedXL: sNum(row.actualStitchedXL),
    actualStitchedXXL: sNum(row.actualStitchedXXL),
    actualInwardXS: sNum(row.actualInwardXS),
    actualInwardS: sNum(row.actualInwardS),
    actualInwardM: sNum(row.actualInwardM),
    actualInwardL: sNum(row.actualInwardL),
    actualInwardXL: sNum(row.actualInwardXL),
    actualInwardXXL: sNum(row.actualInwardXXL),
    actualInwardTotal: sNum(row.actualInwardTotal),
  };
}

// Section names for collapse/expand state
const SECTIONS = [
  "productInfo",
  "orderDetails",
  "fabric1",
  "fabric2",
  "quantities",
  "garmentingCosts",
  "pricing",
] as const;
type SectionName = (typeof SECTIONS)[number];

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          {title}
        </span>
      </button>
      {expanded && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
}

type SizeDistItem = { size: string; percentage: number };

export function ProductOrderSheet({
  open,
  onOpenChange,
  vendors,
  phaseId,
  productMasters,
  isRepeatTab,
  editingRow = null,
  sizeDistributions = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  phaseId: string;
  productMasters: ProductMasterType[];
  isRepeatTab: boolean;
  editingRow?: Record<string, unknown> | null;
  sizeDistributions?: SizeDistItem[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Collapsible section state - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s, true])) as Record<SectionName, boolean>
  );

  const isEditing = editingRow !== null && editingRow !== undefined;

  function toggleSection(section: SectionName) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections(
      Object.fromEntries(SECTIONS.map((s) => [s, expanded])) as Record<SectionName, boolean>
    );
  }

  // Build Combobox options for SKU search
  const skuOptions = React.useMemo(() => {
    return productMasters.map((m) => {
      const skuCode = String(m.skuCode || "");
      const styleName = String(m.productName || "");
      const articleNum = String(m.articleNumber || "");
      const label = `${skuCode}${styleName ? ` - ${styleName}` : ""}${articleNum ? ` (${articleNum})` : ""}`;
      const searchText = [
        String(m.articleNumber || ""),
        String(m.styleNumber || ""),
        String(m.skuCode || ""),
        String(m.productName || ""),
        String(m.type || ""),
      ].join(" ");
      return { label, value: skuCode, searchText };
    });
  }, [productMasters]);

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm(rowToForm(editingRow));
      } else {
        setForm({ ...emptyForm, isRepeat: isRepeatTab, fabricVendorId: vendors[0]?.id || "" });
      }
      setShowDeleteConfirm(false);
      // Reset all sections to expanded when form opens
      setAllSections(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRepeatTab, vendors, editingRow]);

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSkuSelect(skuCode: string) {
    const master = productMasters.find((m) => String(m.skuCode) === skuCode);
    if (master) {
      selectProductMaster(master);
    }
  }

  function selectProductMaster(master: ProductMasterType) {
    const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
    setForm((prev) => ({
      ...prev,
      styleNumber: s(master.styleNumber),
      articleNumber: s(master.articleNumber) || prev.articleNumber,
      skuCode: s(master.skuCode) || prev.skuCode,
      fabricName: s(master.fabricName) || prev.fabricName,
      type: s(master.type) || prev.type,
      gender: s(master.gender) || prev.gender,
      productName: s(master.productName) || prev.productName,
      assumedFabricGarmentsPerKg: s(master.garmentsPerKg) || prev.assumedFabricGarmentsPerKg,
      fabricCostPerKg: s(master.fabricCostPerKg) || prev.fabricCostPerKg,
      fabric2CostPerKg: s(master.fabric2CostPerKg) || prev.fabric2CostPerKg,
      stitchingCost: s(master.stitchingCost) || prev.stitchingCost,
      brandLogoCost: s(master.brandLogoCost) || prev.brandLogoCost,
      neckTwillCost: s(master.neckTwillCost) || prev.neckTwillCost,
      reflectorsCost: s(master.reflectorsCost) || prev.reflectorsCost,
      fusingCost: s(master.fusingCost) || prev.fusingCost,
      accessoriesCost: s(master.accessoriesCost) || prev.accessoriesCost,
      brandTagCost: s(master.brandTagCost) || prev.brandTagCost,
      sizeTagCost: s(master.sizeTagCost) || prev.sizeTagCost,
      packagingCost: s(master.packagingCost) || prev.packagingCost,
      outwardShippingCost: s(master.inwardShipping) || prev.outwardShippingCost,
      proposedMrp: s(master.proposedMrp) || prev.proposedMrp,
      onlineMrp: s(master.onlineMrp) || prev.onlineMrp,
    }));
  }

  // Build a numeric object for computations
  function formAsData(): Record<string, unknown> {
    return {
      ...form,
      fabricCostPerKg: toNum(form.fabricCostPerKg),
      assumedFabricGarmentsPerKg: toNum(form.assumedFabricGarmentsPerKg),
      fabric2CostPerKg: toNum(form.fabric2CostPerKg),
      assumedFabric2GarmentsPerKg: toNum(form.assumedFabric2GarmentsPerKg),
      stitchingCost: toNum(form.stitchingCost),
      brandLogoCost: toNum(form.brandLogoCost),
      neckTwillCost: toNum(form.neckTwillCost),
      reflectorsCost: toNum(form.reflectorsCost),
      fusingCost: toNum(form.fusingCost),
      accessoriesCost: toNum(form.accessoriesCost),
      brandTagCost: toNum(form.brandTagCost),
      sizeTagCost: toNum(form.sizeTagCost),
      packagingCost: toNum(form.packagingCost),
      outwardShippingCost: toNum(form.outwardShippingCost),
      proposedMrp: toNum(form.proposedMrp),
    };
  }

  async function handleSubmit() {
    if (!form.styleNumber.trim()) {
      toast.error("Style # is required");
      return;
    }
    if (!form.fabricVendorId) {
      toast.error("Fabric Vendor is required");
      return;
    }
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.colourOrdered.trim()) {
      toast.error("Colour Ordered is required");
      return;
    }

    setSubmitting(true);
    try {
      const numOrNull = (v: string) => toNum(v);
      const payload = {
        phaseId: isEditing ? (editingRow.phaseId as string) : phaseId,
        orderDate: form.orderDate || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        styleNumber: form.styleNumber,
        articleNumber: form.articleNumber || null,
        skuCode: form.skuCode || null,
        colourOrdered: form.colourOrdered,
        type: form.type,
        gender: form.gender,
        productName: form.productName || null,
        isRepeat: form.isRepeat,
        status: form.status,
        fabricVendorId: form.fabricVendorId,
        fabric2VendorId: form.fabric2VendorId || null,
        fabricName: form.fabricName,
        fabricGsm: numOrNull(form.fabricGsm),
        fabricCostPerKg: numOrNull(form.fabricCostPerKg),
        assumedFabricGarmentsPerKg: numOrNull(form.assumedFabricGarmentsPerKg),
        fabric2Name: form.fabric2Name || null,
        fabric2CostPerKg: numOrNull(form.fabric2CostPerKg),
        assumedFabric2GarmentsPerKg: numOrNull(form.assumedFabric2GarmentsPerKg),
        fabricOrderedQuantityKg: numOrNull(form.fabricOrderedQuantityKg),
        fabricShippedQuantityKg: numOrNull(form.fabricShippedQuantityKg),
        fabric2OrderedQuantityKg: numOrNull(form.fabric2OrderedQuantityKg),
        fabric2ShippedQuantityKg: numOrNull(form.fabric2ShippedQuantityKg),
        garmentNumber: isEditing ? (editingRow.garmentNumber ?? null) : null,
        actualStitchedXS: numOrNull(form.actualStitchedXS) ?? 0,
        actualStitchedS: numOrNull(form.actualStitchedS) ?? 0,
        actualStitchedM: numOrNull(form.actualStitchedM) ?? 0,
        actualStitchedL: numOrNull(form.actualStitchedL) ?? 0,
        actualStitchedXL: numOrNull(form.actualStitchedXL) ?? 0,
        actualStitchedXXL: numOrNull(form.actualStitchedXXL) ?? 0,
        actualInwardXS: numOrNull(form.actualInwardXS) ?? 0,
        actualInwardS: numOrNull(form.actualInwardS) ?? 0,
        actualInwardM: numOrNull(form.actualInwardM) ?? 0,
        actualInwardL: numOrNull(form.actualInwardL) ?? 0,
        actualInwardXL: numOrNull(form.actualInwardXL) ?? 0,
        actualInwardXXL: numOrNull(form.actualInwardXXL) ?? 0,
        actualInwardTotal: numOrNull(form.actualInwardTotal) ?? 0,
        invoiceNumber: form.invoiceNumber || null,
        stitchingCost: numOrNull(form.stitchingCost),
        brandLogoCost: numOrNull(form.brandLogoCost),
        neckTwillCost: numOrNull(form.neckTwillCost),
        reflectorsCost: numOrNull(form.reflectorsCost),
        fusingCost: numOrNull(form.fusingCost),
        accessoriesCost: numOrNull(form.accessoriesCost),
        brandTagCost: numOrNull(form.brandTagCost),
        sizeTagCost: numOrNull(form.sizeTagCost),
        packagingCost: numOrNull(form.packagingCost),
        outwardShippingCost: numOrNull(form.outwardShippingCost),
        proposedMrp: numOrNull(form.proposedMrp),
        onlineMrp: numOrNull(form.onlineMrp),
        garmentingAt: form.garmentingAt || null,
        isStrikedThrough: isEditing ? Boolean(editingRow.isStrikedThrough) : false,
      };

      if (isEditing && editingRow.id) {
        await updateProduct(editingRow.id as string, payload);
        toast.success("Product order updated");
      } else {
        await createProduct(payload);
        toast.success("Product order created");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isEditing ? "Failed to update product order" : "Failed to create product order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingRow?.id) return;
    setDeleting(true);
    try {
      await deleteProduct(String(editingRow.id));
      toast.success("Product order deleted");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete product order");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const data = formAsData();
  const totalGarmenting = computeTotalGarmenting(data);
  const fabricCostPerPiece = computeFabricCostPerPiece(data);
  const totalCost = computeTotalCost(data);
  const totalLanded = computeTotalLandedCost(data);
  const dealerPrice = computeDealerPrice(toNum(form.proposedMrp));
  const profitMargin = computeProfitMargin(data);

  // Compute expected total: shippedQty * garmentsPerKg, fallback to orderedQty
  const fabricQtyKg = toNum(form.fabricShippedQuantityKg) || toNum(form.fabricOrderedQuantityKg) || 0;
  const garmentsPerKg = toNum(form.assumedFabricGarmentsPerKg) || 0;
  const expectedTotal = Math.round(fabricQtyKg * garmentsPerKg);

  // Compute expected per-size using size distribution percentages
  const sizeDistMap = new Map(sizeDistributions.map((d) => [d.size, d.percentage]));
  const expectedPerSize: Record<string, number> = {};
  for (const size of ["XS", "S", "M", "L", "XL", "XXL"]) {
    const pct = sizeDistMap.get(size) || 0;
    expectedPerSize[size] = Math.round((expectedTotal * pct) / 100);
  }

  // Compute totals for quantities section
  const stitchedTotal = [
    form.actualStitchedXS, form.actualStitchedS, form.actualStitchedM,
    form.actualStitchedL, form.actualStitchedXL, form.actualStitchedXXL,
  ].reduce((sum, v) => sum + (toNum(v) || 0), 0);

  const inwardTotal = [
    form.actualInwardXS, form.actualInwardS, form.actualInwardM,
    form.actualInwardL, form.actualInwardXL, form.actualInwardXXL,
  ].reduce((sum, v) => sum + (toNum(v) || 0), 0);

  const allExpanded = SECTIONS.every((s) => expandedSections[s]);
  const allCollapsed = SECTIONS.every((s) => !expandedSections[s]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[750px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle>{isEditing ? "Edit Product Order" : "New Product Order"}</SheetTitle>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Order</span>
              </div>
              <SheetDescription>
                {isEditing
                  ? "Update the product order details below"
                  : "Enter Style # to auto-populate from Products Master DB"}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 shrink-0"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {allExpanded ? "Collapse All" : allCollapsed ? "Expand All" : "Collapse All"}
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {/* Primary field - SKU search (always visible, not collapsible) */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">SKU / Style # *</Label>
            {isEditing ? (
              <Input
                value={form.styleNumber}
                onChange={(e) => updateField("styleNumber", e.target.value)}
              />
            ) : (
              <Combobox
                value={form.skuCode}
                onValueChange={handleSkuSelect}
                options={skuOptions}
                placeholder="Search SKU, style, article, name, type..."
              />
            )}
          </div>

          {/* Product Info */}
          <CollapsibleSection
            title="Product Info"
            expanded={expandedSections.productInfo}
            onToggle={() => toggleSection("productInfo")}
          >
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Article #</Label>
                <Input value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU Code</Label>
                <Input value={form.skuCode} onChange={(e) => updateField("skuCode", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Name</Label>
                <Input value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Colour Ordered *</Label>
                <Input value={form.colourOrdered} onChange={(e) => updateField("colourOrdered", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Input value={form.type} onChange={(e) => updateField("type", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{GENDER_LABELS[form.gender] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1.5 gap-2">
                <button
                  type="button"
                  onClick={() => updateField("isRepeat", !form.isRepeat)}
                  className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${form.isRepeat ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}
                >
                  {form.isRepeat && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <Label className="text-xs">Repeat Order</Label>
              </div>
            </div>
          </CollapsibleSection>

          {/* Order Details */}
          <CollapsibleSection
            title="Order Details"
            expanded={expandedSections.orderDetails}
            onToggle={() => toggleSection("orderDetails")}
          >
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => updateField("status", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{PRODUCT_STATUS_LABELS[form.status] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order Date</Label>
                <Input value={form.orderDate} onChange={(e) => updateField("orderDate", e.target.value)} placeholder="e.g. 15 Nov 2025" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice Number</Label>
                <Input value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Garmenting At</Label>
                <Input value={form.garmentingAt} onChange={(e) => updateField("garmentingAt", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Fabric 1 */}
          <CollapsibleSection
            title="Fabric 1"
            expanded={expandedSections.fabric1}
            onToggle={() => toggleSection("fabric1")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric Name *</Label>
                <Input value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fabric Vendor *</Label>
                <Select value={form.fabricVendorId} onValueChange={(v) => updateField("fabricVendorId", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{vendorLabels[form.fabricVendorId] || "Select vendor"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assumed Garments/kg</Label>
                <Input type="number" step="0.01" value={form.assumedFabricGarmentsPerKg} onChange={(e) => updateField("assumedFabricGarmentsPerKg", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ordered Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.fabricOrderedQuantityKg} onChange={(e) => updateField("fabricOrderedQuantityKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shipped Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.fabricShippedQuantityKg} onChange={(e) => updateField("fabricShippedQuantityKg", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Fabric 2 */}
          <CollapsibleSection
            title="Fabric 2"
            expanded={expandedSections.fabric2}
            onToggle={() => toggleSection("fabric2")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric 2 Name</Label>
                <Input value={form.fabric2Name} onChange={(e) => updateField("fabric2Name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fabric 2 Vendor</Label>
                <Select value={form.fabric2VendorId} onValueChange={(v) => updateField("fabric2VendorId", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{vendorLabels[form.fabric2VendorId] || "Select vendor"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assumed Garments/kg</Label>
                <Input type="number" step="0.01" value={form.assumedFabric2GarmentsPerKg} onChange={(e) => updateField("assumedFabric2GarmentsPerKg", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.fabric2CostPerKg} onChange={(e) => updateField("fabric2CostPerKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ordered Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.fabric2OrderedQuantityKg} onChange={(e) => updateField("fabric2OrderedQuantityKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shipped Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.fabric2ShippedQuantityKg} onChange={(e) => updateField("fabric2ShippedQuantityKg", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Quantities - Expected, Actual Stitched & Actual Inward */}
          <CollapsibleSection
            title="Quantities"
            expanded={expandedSections.quantities}
            onToggle={() => toggleSection("quantities")}
          >
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Expected</Label>
              <div className="grid grid-cols-7 gap-2">
                {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                  <div key={size} className="space-y-0.5">
                    <Label className="text-[10px] text-center block">{size}</Label>
                    <div className="h-8 flex items-center justify-center text-sm bg-blue-50 rounded border border-blue-200 text-blue-700">
                      {expectedTotal > 0 ? expectedPerSize[size] : "-"}
                    </div>
                  </div>
                ))}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-center block font-semibold">Total</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-semibold bg-blue-50 rounded border border-blue-200 text-blue-700">
                    {expectedTotal || "-"}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Total Expected Quantity = {fabricQtyKg > 0 ? `${toNum(form.fabricShippedQuantityKg) ? "Shipped" : "Ordered"} Qty (${fabricQtyKg} kg)` : "Fabric Qty"} x {garmentsPerKg > 0 ? `Garments/kg (${garmentsPerKg})` : "Garments/kg"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Actual Stitched</Label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { key: "actualStitchedXS", label: "XS" },
                  { key: "actualStitchedS", label: "S" },
                  { key: "actualStitchedM", label: "M" },
                  { key: "actualStitchedL", label: "L" },
                  { key: "actualStitchedXL", label: "XL" },
                  { key: "actualStitchedXXL", label: "XXL" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-[10px] text-center block">{label}</Label>
                    <Input
                      type="number"
                      className="text-center px-1"
                      value={(form as unknown as Record<string, string>)[key]}
                      onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-center block font-semibold">Total</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-semibold bg-gray-50 rounded border">
                    {stitchedTotal}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Actual Inward</Label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { key: "actualInwardXS", label: "XS" },
                  { key: "actualInwardS", label: "S" },
                  { key: "actualInwardM", label: "M" },
                  { key: "actualInwardL", label: "L" },
                  { key: "actualInwardXL", label: "XL" },
                  { key: "actualInwardXXL", label: "XXL" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-[10px] text-center block">{label}</Label>
                    <Input
                      type="number"
                      className="text-center px-1"
                      value={(form as unknown as Record<string, string>)[key]}
                      onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-center block font-semibold">Total</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-semibold bg-gray-50 rounded border">
                    {inwardTotal}
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Garmenting Costs */}
          <CollapsibleSection
            title="Garmenting Costs"
            expanded={expandedSections.garmentingCosts}
            onToggle={() => toggleSection("garmentingCosts")}
          >
            <div className="grid grid-cols-5 gap-2">
              {[
                { key: "stitchingCost", label: "Stitching" },
                { key: "brandLogoCost", label: "Brand Logo" },
                { key: "neckTwillCost", label: "Neck Twill" },
                { key: "reflectorsCost", label: "Reflectors" },
                { key: "fusingCost", label: "Fusing" },
                { key: "accessoriesCost", label: "Accessories" },
                { key: "brandTagCost", label: "Brand Tag" },
                { key: "sizeTagCost", label: "Size Tag" },
                { key: "packagingCost", label: "Packaging" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px]">{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(form as unknown as Record<string, string>)[key]}
                    onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Pricing */}
          <CollapsibleSection
            title="Pricing"
            expanded={expandedSections.pricing}
            onToggle={() => toggleSection("pricing")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shipping Cost/piece (Rs)</Label>
                <Input type="number" step="0.01" value={form.outwardShippingCost} onChange={(e) => updateField("outwardShippingCost", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Proposed MRP (Rs)</Label>
                <Input type="number" step="0.01" value={form.proposedMrp} onChange={(e) => updateField("proposedMrp", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Online MRP (Rs)</Label>
                <Input type="number" step="0.01" value={form.onlineMrp} onChange={(e) => updateField("onlineMrp", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Computed Summary (always visible) */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Summary</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-[10px]">Total Garmenting</span>
                <div className="font-semibold">{formatCurrency(totalGarmenting)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Fabric Cost/Piece</span>
                <div className="font-semibold">{formatCurrency(fabricCostPerPiece)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Total Cost/Piece</span>
                <div className="font-semibold">{formatCurrency(totalCost)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Total Landed Cost</span>
                <div className="font-semibold">{formatCurrency(totalLanded)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Dealer Price</span>
                <div className="font-semibold">{formatCurrency(dealerPrice)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Profit Margin</span>
                <div className="font-semibold">{formatPercent(profitMargin)}</div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="flex-col gap-2">
          <div className={`flex gap-2 ${isEditing ? "" : "flex-col"}`}>
            <Button onClick={handleSubmit} disabled={submitting || deleting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Order" : "Create Product Order"
              )}
            </Button>
            {isEditing && !showDeleteConfirm && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || deleting}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Order
              </Button>
            )}
          </div>
          {isEditing && showDeleteConfirm && (
            <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-sm font-medium text-red-800">
                Are you sure you want to delete this product order? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Yes, Delete"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
