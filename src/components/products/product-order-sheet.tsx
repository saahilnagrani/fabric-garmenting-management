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
import { createProduct, updateProduct, deleteProduct, getProductLinkedFabricOrders } from "@/actions/products";
import { getBomForProduct } from "@/actions/accessory-dispatches";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { GENDER_LABELS, PRODUCT_STATUS_LABELS, FABRIC_ORDER_STATUS_LABELS } from "@/lib/constants";
import { showAutoAdvanceToast } from "@/lib/toast-helpers";
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
import { Loader2, Trash2, ChevronsUpDown } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

type Vendor = { id: string; name: string; type?: string };
type ProductMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Parse any stored date format ("15 Nov 2025", ISO, Date) to a yyyy-mm-dd value for <input type="date">. */
function toIsoInputValue(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Format a yyyy-mm-dd ISO input value as "10 Apr 2026" for display/storage. */
function isoToDisplayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
  cuttingReportGarmentsPerKg: string;
  fabric2Name: string;
  fabric2CostPerKg: string;
  assumedFabric2GarmentsPerKg: string;
  cuttingReportGarmentsPerKg2: string;
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
  orderDate: string; // stored as yyyy-mm-dd while editing
  garmentNumber: string; // target quantity for the order
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
  status: "PLANNED",
  fabricName: "",
  fabricGsm: "",
  fabricCostPerKg: "",
  assumedFabricGarmentsPerKg: "",
  cuttingReportGarmentsPerKg: "",
  fabric2Name: "",
  fabric2CostPerKg: "",
  assumedFabric2GarmentsPerKg: "",
  cuttingReportGarmentsPerKg2: "",
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
  garmentNumber: "",
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
    status: s(row.status) || "PLANNED",
    fabricName: s(row.fabricName),
    fabricGsm: s(row.fabricGsm),
    fabricCostPerKg: s(row.fabricCostPerKg),
    assumedFabricGarmentsPerKg: s(row.assumedFabricGarmentsPerKg),
    cuttingReportGarmentsPerKg: s(row.cuttingReportGarmentsPerKg),
    fabric2Name: s(row.fabric2Name),
    fabric2CostPerKg: s(row.fabric2CostPerKg),
    assumedFabric2GarmentsPerKg: s(row.assumedFabric2GarmentsPerKg),
    cuttingReportGarmentsPerKg2: s(row.cuttingReportGarmentsPerKg2),
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
    orderDate: toIsoInputValue(row.orderDate),
    garmentNumber: sNum(row.garmentNumber),
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
  "linkedFabricOrders",
  "accessoryBom",
  "quantities",
  "garmentingCosts",
  "pricing",
] as const;

type LinkedFabricOrder = {
  id: string;
  fabricName: string;
  colour: string;
  orderStatus: string;
  orderedKg: number | null;
  shippedKg: number | null;
  vendorName: string;
  fabricSlot: number;
};
type SectionName = (typeof SECTIONS)[number];

type SizeDistItem = { size: string; percentage: number };

export function ProductOrderSheet({
  open,
  onOpenChange,
  vendors,
  phaseId,
  productMasters,
  fabricMasters = [],
  isRepeatTab,
  editingRow = null,
  sizeDistributions = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  phaseId: string;
  productMasters: ProductMasterType[];
  fabricMasters?: ProductMasterType[];
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

  // Edit mode requires an id on the row. Rows without id are treated as prefill for create mode.
  const isEditing = !!editingRow?.id;

  function toggleSection(section: SectionName) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections(
      Object.fromEntries(SECTIONS.map((s) => [s, expanded])) as Record<SectionName, boolean>
    );
  }

  // Lookup: fabricName → vendorId, resolved from FabricMaster records. Used to
  // auto-populate fabric vendor when the user picks a ProductMaster.
  const fabricNameToVendorId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fabricMasters as Array<Record<string, unknown>>) {
      const name = String(f.fabricName || "");
      const vid = String(f.vendorId || "");
      if (name && vid) map.set(name, vid);
    }
    return map;
  }, [fabricMasters]);

  // Build Combobox options for SKU search.
  // Label format: "<articleNumber> - <skuCode> - <productName> (<colour>)"
  // Each ProductMaster row has one colour in coloursAvailable[0].
  const skuOptions = React.useMemo(() => {
    return productMasters.map((m) => {
      const skuCode = String(m.skuCode || "");
      const styleName = String(m.productName || "");
      const articleNum = String(m.articleNumber || "");
      const coloursAvailable = Array.isArray(m.coloursAvailable) ? (m.coloursAvailable as string[]) : [];
      const colour = coloursAvailable[0] || "";
      const parts: string[] = [];
      if (articleNum) parts.push(articleNum);
      if (skuCode) parts.push(skuCode);
      if (styleName) parts.push(styleName);
      const head = parts.join(" - ");
      const label = colour ? `${head} (${colour})` : head;
      const searchText = [
        articleNum,
        String(m.styleNumber || ""),
        skuCode,
        styleName,
        String(m.type || ""),
        colour,
      ].join(" ");
      return { label, value: skuCode, searchText };
    });
  }, [productMasters]);

  useEffect(() => {
    if (open) {
      const isNew = !editingRow;
      if (editingRow) {
        setForm(rowToForm(editingRow));
      } else {
        setForm({ ...emptyForm, isRepeat: isRepeatTab, fabricVendorId: vendors.find((v) => v.type === "FABRIC_SUPPLIER")?.id || "" });
      }
      setShowDeleteConfirm(false);
      // All sections expanded by default, EXCEPT Fabric 2 which starts collapsed
      // when creating a new order or editing an existing one with no fabric 2 data.
      const fabric2HasData =
        !!editingRow &&
        (!!editingRow.fabric2Name || !!editingRow.fabric2CostPerKg || !!editingRow.fabric2OrderedQuantityKg);
      setExpandedSections(
        Object.fromEntries(
          SECTIONS.map((s) => {
            if (s === "fabric2") return [s, !isNew && fabric2HasData];
            if (s === "accessoryBom") return [s, false];
            return [s, true];
          })
        ) as Record<SectionName, boolean>
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRepeatTab, vendors, editingRow]);

  // Fetch linked fabric orders when editing
  const [linkedFabricOrders, setLinkedFabricOrders] = useState<LinkedFabricOrder[]>([]);
  const editingRowId = editingRow?.id as string | undefined;
  useEffect(() => {
    if (open && editingRowId) {
      getProductLinkedFabricOrders(editingRowId)
        .then((data) => setLinkedFabricOrders(data as LinkedFabricOrder[]))
        .catch(() => setLinkedFabricOrders([]));
    } else {
      setLinkedFabricOrders([]);
    }
  }, [open, editingRowId]);

  // Fetch accessory BOM when editing an existing article
  type BomLine = Awaited<ReturnType<typeof getBomForProduct>>["lines"][number];
  const [bom, setBom] = useState<{ lines: BomLine[]; pieces: number; masterFound: boolean }>({
    lines: [],
    pieces: 0,
    masterFound: false,
  });
  useEffect(() => {
    if (open && editingRowId) {
      getBomForProduct(editingRowId)
        .then((data) => setBom(data))
        .catch(() => setBom({ lines: [], pieces: 0, masterFound: false }));
    } else {
      setBom({ lines: [], pieces: 0, masterFound: false });
    }
  }, [open, editingRowId]);

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
    const coloursAvailable = Array.isArray(master.coloursAvailable)
      ? (master.coloursAvailable as string[])
      : [];
    const colour = coloursAvailable[0] || "";
    // Resolve fabric vendor ids from the fabricName → vendorId lookup (built
    // from FabricMaster records passed to the sheet).
    const fabricName = s(master.fabricName);
    const fabric2Name = s(master.fabric2Name);
    const resolvedFabricVendor = fabricName ? fabricNameToVendorId.get(fabricName) : undefined;
    const resolvedFabric2Vendor = fabric2Name ? fabricNameToVendorId.get(fabric2Name) : undefined;
    setForm((prev) => ({
      ...prev,
      styleNumber: s(master.styleNumber),
      articleNumber: s(master.articleNumber) || prev.articleNumber,
      skuCode: s(master.skuCode) || prev.skuCode,
      colourOrdered: colour || prev.colourOrdered,
      fabricVendorId: resolvedFabricVendor || prev.fabricVendorId,
      fabric2VendorId: resolvedFabric2Vendor || prev.fabric2VendorId,
      fabricName: fabricName || prev.fabricName,
      fabric2Name: fabric2Name || prev.fabric2Name,
      type: s(master.type) || prev.type,
      gender: s(master.gender) || prev.gender,
      productName: s(master.productName) || prev.productName,
      assumedFabricGarmentsPerKg: s(master.garmentsPerKg) || prev.assumedFabricGarmentsPerKg,
      assumedFabric2GarmentsPerKg: s(master.garmentsPerKg2) || prev.assumedFabric2GarmentsPerKg,
      cuttingReportGarmentsPerKg: s(master.cuttingReportGarmentsPerKg) || prev.cuttingReportGarmentsPerKg,
      cuttingReportGarmentsPerKg2: s(master.cuttingReportGarmentsPerKg2) || prev.cuttingReportGarmentsPerKg2,
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

  /** When the user sets a target quantity, auto-estimate the fabric ordered kg
   *  if it's still blank. Formula: target / garmentsPerKg (rounded up). */
  function handleTargetQuantityChange(value: string) {
    setForm((prev) => {
      const target = Number(value);
      const g1 = Number(prev.assumedFabricGarmentsPerKg);
      const g2 = Number(prev.assumedFabric2GarmentsPerKg);
      const next = { ...prev, garmentNumber: value };
      if (target > 0 && g1 > 0 && !prev.fabricOrderedQuantityKg) {
        next.fabricOrderedQuantityKg = String(Math.ceil(target / g1));
      }
      if (target > 0 && g2 > 0 && !prev.fabric2OrderedQuantityKg) {
        next.fabric2OrderedQuantityKg = String(Math.ceil(target / g2));
      }
      return next;
    });
  }

  // Build a numeric object for computations
  function formAsData(): Record<string, unknown> {
    return {
      ...form,
      fabricCostPerKg: toNum(form.fabricCostPerKg),
      assumedFabricGarmentsPerKg: toNum(form.assumedFabricGarmentsPerKg),
      cuttingReportGarmentsPerKg: toNum(form.cuttingReportGarmentsPerKg),
      fabric2CostPerKg: toNum(form.fabric2CostPerKg),
      assumedFabric2GarmentsPerKg: toNum(form.assumedFabric2GarmentsPerKg),
      cuttingReportGarmentsPerKg2: toNum(form.cuttingReportGarmentsPerKg2),
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
      toast.error("Article # is required");
      return;
    }
    if (!form.articleNumber.trim()) {
      toast.error("Article # is required");
      return;
    }
    if (!form.skuCode.trim()) {
      toast.error("Article Code is required");
      return;
    }
    if (!form.productName.trim()) {
      toast.error("Product Name is required");
      return;
    }
    if (!form.colourOrdered.trim()) {
      toast.error("Colour is required");
      return;
    }
    if (!form.type.trim()) {
      toast.error("Type is required");
      return;
    }
    if (!form.gender) {
      toast.error("Gender is required");
      return;
    }
    if (!form.garmentNumber.trim() || Number(form.garmentNumber) <= 0) {
      toast.error("Target Quantity is required");
      return;
    }
    if (!form.garmentingAt.trim()) {
      toast.error("Garmenting At is required");
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

    setSubmitting(true);
    try {
      const numOrNull = (v: string) => toNum(v);
      const orderDateDisplay = form.orderDate
        ? isoToDisplayDate(form.orderDate)
        : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const payload = {
        phaseId: isEditing ? (editingRow.phaseId as string) : phaseId,
        orderDate: orderDateDisplay,
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
        cuttingReportGarmentsPerKg: numOrNull(form.cuttingReportGarmentsPerKg),
        fabric2Name: form.fabric2Name || null,
        fabric2CostPerKg: numOrNull(form.fabric2CostPerKg),
        assumedFabric2GarmentsPerKg: numOrNull(form.assumedFabric2GarmentsPerKg),
        cuttingReportGarmentsPerKg2: numOrNull(form.cuttingReportGarmentsPerKg2),
        fabricOrderedQuantityKg: numOrNull(form.fabricOrderedQuantityKg),
        fabricShippedQuantityKg: numOrNull(form.fabricShippedQuantityKg),
        fabric2OrderedQuantityKg: numOrNull(form.fabric2OrderedQuantityKg),
        fabric2ShippedQuantityKg: numOrNull(form.fabric2ShippedQuantityKg),
        garmentNumber: numOrNull(form.garmentNumber),
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
        const { autoAdvanced, dispatchResult } = await updateProduct(editingRow.id as string, payload);
        toast.success("Article order updated");
        showAutoAdvanceToast(autoAdvanced ? [autoAdvanced] : []);
        if (dispatchResult) {
          if (dispatchResult.warning) {
            toast.warning(`Accessory auto-dispatch skipped: ${dispatchResult.warning}`, { duration: 7000 });
          } else if (dispatchResult.created > 0) {
            toast.success(
              `Generated ${dispatchResult.created} draft accessory dispatch${dispatchResult.created === 1 ? "" : "es"} from BOM${dispatchResult.skipped > 0 ? ` (${dispatchResult.skipped} already existed)` : ""}`,
              {
                action: {
                  label: "Review",
                  onClick: () => router.push("/accessories?tab=dispatches"),
                },
                duration: 8000,
              }
            );
          }
        }
      } else {
        const { product, linkedCount } = await createProduct(payload);
        if (linkedCount > 0) {
          toast.success(`Article order created — linked to ${linkedCount} fabric order${linkedCount === 1 ? "" : "s"}`);
        } else {
          toast.success("Article order created", {
            description: "No matching fabric orders found.",
            action: {
              label: "Create fabric order",
              onClick: () => router.push(`/fabric-orders?prefillFromProductId=${product.id}`),
            },
            duration: 8000,
          });
        }
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      // Surface server-side validation errors (e.g. state machine rejection) verbatim
      const message = err instanceof Error ? err.message : null;
      toast.error(
        message || (isEditing ? "Failed to update article order" : "Failed to create article order")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingRow?.id) return;
    setDeleting(true);
    try {
      await deleteProduct(String(editingRow.id));
      toast.success("Article order deleted");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete article order");
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

  // Expected total = target quantity entered at the top.
  // Falls back to the old "shipped/ordered kg × garments/kg" calc only if no target is set.
  const targetQty = toNum(form.garmentNumber) || 0;
  const fabricQtyKg = toNum(form.fabricShippedQuantityKg) || toNum(form.fabricOrderedQuantityKg) || 0;
  const garmentsPerKg = toNum(form.assumedFabricGarmentsPerKg) || 0;
  const expectedTotal = targetQty > 0 ? targetQty : Math.round(fabricQtyKg * garmentsPerKg);

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
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl font-semibold">
                  {isEditing ? (form.articleNumber.trim() || "Article Order") : "New Article Order"}
                </SheetTitle>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Order</span>
              </div>
              <SheetDescription className="sr-only">
                {isEditing ? "Edit article order" : "Create article order"}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted/50 shrink-0"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {allExpanded ? "Collapse All" : allCollapsed ? "Expand All" : "Collapse All"}
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 px-4 overflow-y-auto [&>div:nth-child(even)]:bg-muted/30">
          {/* Primary field - SKU search + Target Quantity (always visible, not collapsible) */}
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold">Article # *</Label>
              <Combobox
                value={form.skuCode}
                onValueChange={handleSkuSelect}
                options={skuOptions}
                placeholder="Search article number, article code, product name, colour"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px] font-semibold">Target Qty *</Label>
              <Input
                className="h-8 text-xs md:text-xs"
                type="number"
                min="1"
                step="1"
                value={form.garmentNumber}
                onChange={(e) => handleTargetQuantityChange(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
          </div>

          {/* Product Info */}
          <CollapsibleSection
            title="Product Info"
            expanded={expandedSections.productInfo}
            onToggle={() => toggleSection("productInfo")}
          >
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Article # *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Article Code *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.skuCode} onChange={(e) => updateField("skuCode", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Product Name *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Colour *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.colourOrdered} onChange={(e) => updateField("colourOrdered", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Type *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.type} onChange={(e) => updateField("type", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Gender *</Label>
                <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
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
                <Label className="text-[11px]">Repeat Order</Label>
              </div>
            </div>
          </CollapsibleSection>

          {/* Order Details */}
          <CollapsibleSection
            title="Order Details"
            expanded={expandedSections.orderDetails}
            onToggle={() => toggleSection("orderDetails")}
          >
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Status</Label>
                <Select value={form.status} onValueChange={(v) => updateField("status", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{PRODUCT_STATUS_LABELS[form.status] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Order Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs md:text-xs"
                  value={form.orderDate}
                  onChange={(e) => updateField("orderDate", e.target.value)}
                />
                {form.orderDate && (
                  <p className="text-[10px] text-muted-foreground">{isoToDisplayDate(form.orderDate)}</p>
                )}
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Invoice Number</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Garmenting At *</Label>
                <Select value={form.garmentingAt} onValueChange={(v) => updateField("garmentingAt", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{form.garmentingAt || "Select garmenter"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors
                      .filter((v) => v.type === "GARMENTING")
                      .map((v) => (
                        <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          {/* Fabric 1 */}
          <CollapsibleSection
            title="Fabric 1"
            expanded={expandedSections.fabric1}
            onToggle={() => toggleSection("fabric1")}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Fabric Name *</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Fabric Vendor *</Label>
                <Select value={form.fabricVendorId} onValueChange={(v) => updateField("fabricVendorId", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{vendorLabels[form.fabricVendorId] || "Select vendor"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors
                      .filter((v) => v.type === "FABRIC_SUPPLIER")
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Garments/kg</Label>
                <div className="grid grid-cols-2 gap-1">
                  <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" placeholder="Assumed" title="Assumed (from master)" value={form.assumedFabricGarmentsPerKg} onChange={(e) => updateField("assumedFabricGarmentsPerKg", e.target.value)} />
                  <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" placeholder="Actual" title="Cutting Report (actual)" value={form.cuttingReportGarmentsPerKg} onChange={(e) => updateField("cuttingReportGarmentsPerKg", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Cost/kg (Rs)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Ordered Qty (kg)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabricOrderedQuantityKg} onChange={(e) => updateField("fabricOrderedQuantityKg", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Shipped Qty (kg)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabricShippedQuantityKg} onChange={(e) => updateField("fabricShippedQuantityKg", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Fabric 2 */}
          <CollapsibleSection
            title="Fabric 2"
            expanded={expandedSections.fabric2}
            onToggle={() => toggleSection("fabric2")}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Fabric 2 Name</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.fabric2Name} onChange={(e) => updateField("fabric2Name", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Fabric 2 Vendor</Label>
                <Select value={form.fabric2VendorId} onValueChange={(v) => updateField("fabric2VendorId", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{vendorLabels[form.fabric2VendorId] || "Select vendor"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {vendors
                      .filter((v) => v.type === "FABRIC_SUPPLIER")
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Garments/kg</Label>
                <div className="grid grid-cols-2 gap-1">
                  <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" placeholder="Assumed" title="Assumed (from master)" value={form.assumedFabric2GarmentsPerKg} onChange={(e) => updateField("assumedFabric2GarmentsPerKg", e.target.value)} />
                  <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" placeholder="Actual" title="Cutting Report (actual)" value={form.cuttingReportGarmentsPerKg2} onChange={(e) => updateField("cuttingReportGarmentsPerKg2", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Cost/kg (Rs)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabric2CostPerKg} onChange={(e) => updateField("fabric2CostPerKg", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Ordered Qty (kg)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabric2OrderedQuantityKg} onChange={(e) => updateField("fabric2OrderedQuantityKg", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Shipped Qty (kg)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabric2ShippedQuantityKg} onChange={(e) => updateField("fabric2ShippedQuantityKg", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Linked Fabric Orders - only visible when editing */}
          {isEditing && (
            <CollapsibleSection
              title={`Linked Fabric Orders (${linkedFabricOrders.length})`}
              expanded={expandedSections.linkedFabricOrders}
              onToggle={() => toggleSection("linkedFabricOrders")}
            >
              {linkedFabricOrders.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  No fabric orders linked to this article order yet.
                </p>
              ) : (
                <div className="border rounded divide-y">
                  {linkedFabricOrders.map((lfo) => (
                    <button
                      key={lfo.id}
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/fabric-orders?openId=${lfo.id}`);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-left hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] text-muted-foreground px-1 py-0.5 rounded bg-muted shrink-0">
                          Fabric {lfo.fabricSlot}
                        </span>
                        <span className="font-medium truncate text-blue-600 underline-offset-2 hover:underline">{lfo.fabricName}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="truncate">{lfo.colour}</span>
                        <span className="text-muted-foreground truncate">({lfo.vendorName})</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lfo.orderedKg !== null && (
                          <span className="text-muted-foreground">
                            {lfo.shippedKg ?? 0}/{lfo.orderedKg} kg
                          </span>
                        )}
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          {FABRIC_ORDER_STATUS_LABELS[lfo.orderStatus] || lfo.orderStatus}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* Accessory BOM - only visible when editing (needs a saved article
              to resolve the matching ProductMaster). Collapsed by default. */}
          {isEditing && (
            <CollapsibleSection
              title={`Accessory BOM (${bom.lines.length})`}
              expanded={expandedSections.accessoryBom}
              onToggle={() => toggleSection("accessoryBom")}
            >
              {!bom.masterFound ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  No matching ProductMaster found for this SKU — BOM cannot be resolved.
                </p>
              ) : bom.lines.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  This article&apos;s ProductMaster has no accessory BOM configured.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>
                      {bom.lines.length} accessor{bom.lines.length === 1 ? "y" : "ies"} ·{" "}
                      {bom.pieces > 0
                        ? `${bom.pieces} pcs`
                        : "no piece count set — totals will be 0"}
                    </span>
                  </div>
                  <div className="border rounded divide-y">
                    {bom.lines.map((line) => (
                      <div
                        key={line.accessoryId}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[9px] text-muted-foreground px-1 py-0.5 rounded bg-muted shrink-0">
                            {line.category}
                          </span>
                          <span className="font-medium truncate">
                            {accessoryDisplayName({
                              baseName: line.baseName,
                              colour: line.colour,
                              size: line.size,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px]">
                          <span className="text-muted-foreground">
                            {line.quantityPerPiece} {line.unit.toLowerCase()}/pc
                          </span>
                          <span className="font-semibold tabular-nums">
                            = {line.totalQuantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
                            {line.unit.toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CollapsibleSection>
          )}

          {/* Quantities - Expected, Actual Stitched & Actual Inward */}
          <CollapsibleSection
            title="Quantities"
            expanded={expandedSections.quantities}
            onToggle={() => toggleSection("quantities")}
          >
            <div className="space-y-0.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Expected</Label>
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
                {targetQty > 0
                  ? `Total Expected Quantity = Target Qty (${targetQty})`
                  : `Total Expected Quantity = ${fabricQtyKg > 0 ? `${toNum(form.fabricShippedQuantityKg) ? "Shipped" : "Ordered"} Qty (${fabricQtyKg} kg)` : "Fabric Qty"} x ${garmentsPerKg > 0 ? `Garments/kg (${garmentsPerKg})` : "Garments/kg"}`}
              </p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Actual Stitched</Label>
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
                      className="h-8 text-xs md:text-xs text-center px-1"
                      value={(form as unknown as Record<string, string>)[key]}
                      onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-center block font-semibold">Total</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-semibold bg-primary/5 rounded border border-primary/20 text-primary">
                    {stitchedTotal}
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Actual Inward</Label>
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
                      className="h-8 text-xs md:text-xs text-center px-1"
                      value={(form as unknown as Record<string, string>)[key]}
                      onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-center block font-semibold">Total</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-semibold bg-primary/5 rounded border border-primary/20 text-primary">
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
                <div key={key} className="space-y-0.5">
                  <Label className="text-[10px]">{label}</Label>
                  <Input
                    className="h-8 text-xs md:text-xs"
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
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Shipping Cost/piece (Rs)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.outwardShippingCost} onChange={(e) => updateField("outwardShippingCost", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Proposed MRP (Rs)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.proposedMrp} onChange={(e) => updateField("proposedMrp", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Online MRP (Rs)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.onlineMrp} onChange={(e) => updateField("onlineMrp", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Computed Summary (always visible) */}
          <div className="rounded-lg border border-border border-l-4 border-l-primary px-2 py-1.5 space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase text-primary tracking-wider">Summary</h4>
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
            <Button size="lg" onClick={handleSubmit} disabled={submitting || deleting} className="flex-1 min-h-9">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Article Order" : "Create Article Order"
              )}
            </Button>
            {isEditing && !showDeleteConfirm && (
              <Button
                variant="destructive"
                size="lg"
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
                Are you sure you want to delete this article order? This action cannot be undone.
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
