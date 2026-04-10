"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { createFabricOrder, updateFabricOrder, deleteFabricOrder, findExistingOrdersForFabricColour, getFabricOrderLinkedProducts } from "@/actions/fabric-orders";
import { GENDER_LABELS, FABRIC_ORDER_STATUS_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { showAutoAdvanceToast } from "@/lib/toast-helpers";
import { toast } from "sonner";
import { Loader2, Trash2, ChevronDown, ChevronRight, ChevronLeft, ChevronsUpDown } from "lucide-react";
import React from "react";

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;
type ProductMasterType = Record<string, unknown>;

function toISODate(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v; // can't parse, send as-is
  return d.toISOString();
}

/** Parse any stored date format to yyyy-mm-dd for <input type="date">. */
function toIsoInputValue(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Format a yyyy-mm-dd ISO date value as "10 Apr 2026". */
function isoToDisplayDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricName: string;
  fabricVendorId: string;
  articleNumbers: string;
  colour: string;
  availableColour: string;
  gender: string;
  invoiceNumber: string;
  receivedAt: string;
  orderDate: string;
  costPerUnit: string;
  fabricOrderedQuantityKg: string;
  fabricShippedQuantityKg: string;
  isRepeat: boolean;
  orderStatus: string;
  garmentingAt: string;
  // Read-only display fields (set on the server, not edited via the sheet).
  poNumber: string;
  piReceivedAt: string;
  advancePaidAt: string;
};

const emptyForm: FormData = {
  fabricName: "",
  fabricVendorId: "",
  articleNumbers: "",
  colour: "",
  availableColour: "",
  gender: "",
  invoiceNumber: "",
  receivedAt: "",
  orderDate: new Date().toISOString().slice(0, 10),
  costPerUnit: "",
  fabricOrderedQuantityKg: "",
  fabricShippedQuantityKg: "",
  isRepeat: false,
  orderStatus: "DRAFT_ORDER",
  garmentingAt: "",
  poNumber: "",
  piReceivedAt: "",
  advancePaidAt: "",
};

function awaitingTag(orderStatus: string, piReceivedAt: string, advancePaidAt: string): string {
  if (orderStatus === "PO_SENT" && !piReceivedAt) return "Awaiting PI";
  if (orderStatus === "PI_RECEIVED" && !advancePaidAt) return "Awaiting Advance Payment";
  if (orderStatus === "RECEIVED") return "Awaiting Full Payment";
  return "";
}

const SECTIONS = ["fabricInfo", "orderDetails", "styles", "quantitiesCost", "linkedProducts"] as const;

type LinkedProduct = {
  id: string;
  articleNumber: string | null;
  colourOrdered: string;
  productName: string | null;
  status: string;
  garmentNumber: number | null;
  fabricSlot: number;
};
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
    <div className="border border-gray-200 rounded overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
          {title}
        </span>
      </button>
      {expanded && <div className="px-2 py-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

export function FabricOrderSheet({
  open,
  onOpenChange,
  vendors,
  phaseId,
  fabricMasters,
  productMasters,
  garmentingLocations,
  isRepeatTab,
  editingRow = null,
  editingRows = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  phaseId: string;
  fabricMasters: FabricMasterType[];
  productMasters: ProductMasterType[];
  garmentingLocations: string[];
  isRepeatTab: boolean;
  editingRow?: Record<string, unknown> | null;
  editingRows?: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm, isRepeat: isRepeatTab });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Multi-order navigation
  const [navIndex, setNavIndex] = useState(0);
  const hasMultipleOrders = editingRows.length > 1;
  // Use editingRows if provided, otherwise fall back to legacy editingRow prop
  const activeRow = editingRows.length > 0 ? editingRows[navIndex] ?? null : editingRow;

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s, true])) as Record<SectionName, boolean>
  );

  // Edit mode requires an id on the row. Rows without id are treated as prefill for create mode.
  const isEditing = !!activeRow?.id;

  function toggleSection(section: SectionName) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections(
      Object.fromEntries(SECTIONS.map((s) => [s, expanded])) as Record<SectionName, boolean>
    );
  }

  // Build vendor labels lookup
  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  // Build Combobox options for fabric name search (searches across fabric name + vendor name)
  const fabricNameOptions = useMemo(() => {
    return fabricMasters.map((m) => {
      const fabricName = String(m.fabricName || "");
      const vendorId = String(m.vendorId || "");
      const vendorName = vendorLabels[vendorId] || "";
      const label = fabricName;
      const searchText = `${fabricName} ${vendorName}`;
      return { label, value: fabricName, searchText };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricMasters]);

  // Build Combobox options for article numbers (deduplicated by articleNumber)
  const articleOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { label: string; value: string; searchText: string }[] = [];
    for (const m of productMasters) {
      const articleNum = String(m.articleNumber || "");
      if (!articleNum || seen.has(articleNum)) continue;
      seen.add(articleNum);
      const productName = String(m.productName || "");
      const label = `${articleNum}${productName ? ` - ${productName}` : ""}`;
      const searchText = [
        articleNum,
        String(m.skuCode || ""),
        String(m.productName || ""),
        String(m.type || ""),
      ].join(" ");
      opts.push({ label, value: articleNum, searchText });
    }
    // Sort by article number descending (numeric)
    opts.sort((a, b) => {
      const na = Number(a.value);
      const nb = Number(b.value);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.value.localeCompare(a.value);
    });
    return opts;
  }, [productMasters]);

  // Get available colours from the selected fabric master
  const selectedFabricColours = useMemo(() => {
    if (!form.fabricName) return [];
    const master = fabricMasters.find(
      (m) => String(m.fabricName || "").toLowerCase() === form.fabricName.toLowerCase()
    );
    if (!master) return [];
    const colours = master.coloursAvailable;
    if (Array.isArray(colours)) return colours.map(String);
    return [];
  }, [form.fabricName, fabricMasters]);

  function loadRowIntoForm(row: Record<string, unknown> | null) {
    if (row) {
      setForm({
        fabricName: String(row.fabricName ?? ""),
        fabricVendorId: String(row.fabricVendorId ?? ""),
        articleNumbers: String(row.articleNumbers ?? ""),
        colour: String(row.colour ?? ""),
        availableColour: String(row.availableColour ?? ""),
        gender: String(row.gender ?? ""),
        invoiceNumber: String(row.invoiceNumber ?? ""),
        receivedAt: toIsoInputValue(row.receivedAt),
        orderDate: toIsoInputValue(row.orderDate),
        costPerUnit: row.costPerUnit != null ? String(row.costPerUnit) : "",
        fabricOrderedQuantityKg: row.fabricOrderedQuantityKg != null ? String(row.fabricOrderedQuantityKg) : "",
        fabricShippedQuantityKg: row.fabricShippedQuantityKg != null ? String(row.fabricShippedQuantityKg) : "",
        isRepeat: Boolean(row.isRepeat),
        orderStatus: String(row.orderStatus ?? "DRAFT_ORDER"),
        garmentingAt: String(row.garmentingAt ?? ""),
        poNumber: String(row.poNumber ?? ""),
        piReceivedAt: row.piReceivedAt ? String(row.piReceivedAt) : "",
        advancePaidAt: row.advancePaidAt ? String(row.advancePaidAt) : "",
      });
    } else {
      setForm({ ...emptyForm, isRepeat: isRepeatTab });
    }
  }

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      setNavIndex(0);
      loadRowIntoForm(activeRow);
      setShowDeleteConfirm(false);
      setAllSections(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRepeatTab]);

  // Fetch linked products when editing
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const activeRowId = activeRow?.id as string | undefined;
  useEffect(() => {
    if (open && activeRowId) {
      getFabricOrderLinkedProducts(activeRowId)
        .then((data) => setLinkedProducts(data as LinkedProduct[]))
        .catch(() => setLinkedProducts([]));
    } else {
      setLinkedProducts([]);
    }
  }, [open, activeRowId]);

  // Update form when navigating between orders
  function navigateTo(index: number) {
    if (index < 0 || index >= editingRows.length) return;
    setNavIndex(index);
    loadRowIntoForm(editingRows[index]);
    setShowDeleteConfirm(false);
  }

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFabricNameSelect(fabricName: string) {
    const master = fabricMasters.find((m) => String(m.fabricName || "") === fabricName);
    if (master) {
      setForm((prev) => ({
        ...prev,
        fabricName: String(master.fabricName || ""),
        fabricVendorId: master.vendorId ? String(master.vendorId) : prev.fabricVendorId,
        costPerUnit: master.mrp !== undefined && master.mrp !== null ? String(master.mrp) : prev.costPerUnit,
      }));
    } else {
      updateField("fabricName", fabricName);
    }
  }

  function handleStyleSelect(skuCode: string) {
    // Append to existing articleNumbers (comma-separated)
    setForm((prev) => {
      const existing = prev.articleNumbers.trim();
      if (existing) {
        // Don't add duplicate
        const parts = existing.split(",").map((s) => s.trim());
        if (parts.includes(skuCode)) return prev;
        return { ...prev, articleNumbers: `${existing}, ${skuCode}` };
      }
      return { ...prev, articleNumbers: skuCode };
    });
  }

  async function handleSubmit() {
    // Validate required fields
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.fabricVendorId) {
      toast.error("Fabric Vendor is required");
      return;
    }
    if (!form.colour.trim()) {
      toast.error("Colour is required");
      return;
    }
    if (toNum(form.costPerUnit) === null) {
      toast.error("Cost/Unit is required");
      return;
    }
    if (toNum(form.fabricOrderedQuantityKg) === null) {
      toast.error("Ordered Qty is required");
      return;
    }
    if (!form.orderStatus) {
      toast.error("Order Status is required");
      return;
    }
    if (!form.garmentingAt.trim()) {
      toast.error("Garmenting At is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fabricVendorId: form.fabricVendorId,
        articleNumbers: form.articleNumbers,
        fabricName: form.fabricName,
        colour: form.colour,
        gender: form.gender || null,
        invoiceNumber: form.invoiceNumber || null,
        receivedAt: toISODate(form.receivedAt || null),
        orderDate: toISODate(form.orderDate || null),
        availableColour: form.availableColour || null,
        costPerUnit: toNum(form.costPerUnit),
        fabricOrderedQuantityKg: toNum(form.fabricOrderedQuantityKg),
        fabricShippedQuantityKg: toNum(form.fabricShippedQuantityKg),
        isRepeat: form.isRepeat,
        isStrikedThrough: false,
        orderStatus: form.orderStatus || "DRAFT_ORDER",
        garmentingAt: form.garmentingAt || null,
      };

      if (isEditing && activeRow?.id) {
        const { autoAdvanced } = await updateFabricOrder(String(activeRow.id), payload);
        toast.success("Fabric order updated");
        showAutoAdvanceToast(autoAdvanced);
        onOpenChange(false);
        router.refresh();
      } else {
        // Check for existing orders with same fabric+colour in this phase (info only)
        if (payload.colour && payload.fabricName) {
          const existing = await findExistingOrdersForFabricColour(
            phaseId,
            payload.fabricName,
            payload.colour,
          );
          if (existing.length > 0) {
            const totalQty = existing.reduce((sum, o) => sum + (Number(o.fabricOrderedQuantityKg) || 0), 0);
            const styles = existing.map((o) => o.articleNumbers).filter(Boolean).join(", ");
            toast.info(
              `Note: ${existing.length} existing order${existing.length > 1 ? "s" : ""} for ${payload.fabricName} / ${payload.colour} (${totalQty}kg${styles ? `, styles: ${styles}` : ""}). New separate order created.`,
              { duration: 6000 }
            );
          }
        }
        const { order, linkedCount, autoAdvanced } = await createFabricOrder({ ...payload, phaseId });
        if (linkedCount > 0) {
          toast.success(`Fabric order created — linked to ${linkedCount} article order${linkedCount === 1 ? "" : "s"}`);
        } else {
          toast.success("Fabric order created", {
            description: "No matching article orders found.",
            action: {
              label: "Create article order",
              onClick: () => router.push(`/products?prefillFromFabricOrderId=${order.id}`),
            },
            duration: 8000,
          });
        }
        showAutoAdvanceToast(autoAdvanced);
        onOpenChange(false);
        router.refresh();
      }
    } catch {
      toast.error(isEditing ? "Failed to update fabric order" : "Failed to create fabric order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!activeRow?.id) return;
    setDeleting(true);
    try {
      await deleteFabricOrder(String(activeRow.id));
      toast.success("Fabric order deleted");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete fabric order");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const computedExpectedCost = (toNum(form.costPerUnit) || 0) * (toNum(form.fabricOrderedQuantityKg) || 0);
  const computedActualCost = (toNum(form.costPerUnit) || 0) * (toNum(form.fabricShippedQuantityKg) || 0);

  // Build colour options from selected fabric
  const colourOptions = selectedFabricColours.map((c) => ({ label: c, value: c }));

  const allExpanded = SECTIONS.every((s) => expandedSections[s]);
  const allCollapsed = SECTIONS.every((s) => !expandedSections[s]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <SheetTitle className="text-sm">{isEditing ? "Edit Fabric Order" : "New Fabric Order"}</SheetTitle>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-1 py-0.5 rounded leading-none">Order</span>
              </div>
              <SheetDescription className="text-[11px]">
                {isEditing
                  ? "Update the fabric order details below"
                  : "Enter fabric name to auto-populate from Fabrics Master DB"}
              </SheetDescription>
              {hasMultipleOrders && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={navIndex === 0}
                    onClick={() => navigateTo(navIndex - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Order {navIndex + 1} of {editingRows.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={navIndex === editingRows.length - 1}
                    onClick={() => navigateTo(navIndex + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-gray-200 hover:bg-gray-50 shrink-0"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {allExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-2 px-4 overflow-y-auto">
          {/* Fabric Info */}
          <CollapsibleSection
            title="Fabric Info"
            expanded={expandedSections.fabricInfo}
            onToggle={() => toggleSection("fabricInfo")}
          >
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 110px 110px" }}>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Fabric Name *</Label>
                <Combobox
                  value={form.fabricName}
                  onValueChange={handleFabricNameSelect}
                  options={fabricNameOptions}
                  placeholder="Search fabric..."
                />
              </div>
              <div className="space-y-0.5 min-w-0 overflow-hidden">
                <Label className="text-[11px]">Vendor *</Label>
                <Select value={form.fabricVendorId} onValueChange={(v) => updateField("fabricVendorId", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full overflow-hidden">
                    <span className="truncate block">{vendorLabels[form.fabricVendorId] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Colour *</Label>
                {colourOptions.length > 0 ? (
                  <Combobox
                    value={form.colour}
                    onValueChange={(v) => updateField("colour", v)}
                    options={colourOptions}
                    placeholder="Colour..."
                  />
                ) : (
                  <Input className="h-8 text-xs md:text-xs" value={form.colour} onChange={(e) => updateField("colour", e.target.value)} placeholder={form.fabricName ? "No colours" : "Fabric first"} />
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Quantities & Cost — moved up per requirement */}
          <CollapsibleSection
            title="Quantities & Cost"
            expanded={expandedSections.quantitiesCost}
            onToggle={() => toggleSection("quantitiesCost")}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Cost/Unit (Rs) *</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.costPerUnit} onChange={(e) => updateField("costPerUnit", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Ordered Qty (kg) *</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabricOrderedQuantityKg} onChange={(e) => updateField("fabricOrderedQuantityKg", e.target.value)} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Shipped Qty (kg)</Label>
                <Input className="h-8 text-xs md:text-xs" type="number" step="0.01" value={form.fabricShippedQuantityKg} onChange={(e) => updateField("fabricShippedQuantityKg", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                <div className="text-[9px] text-muted-foreground">Expected = Unit x Ordered</div>
                <div className="text-xs font-semibold">
                  {computedExpectedCost > 0 ? `Rs ${computedExpectedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                </div>
              </div>
              <div className="rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                <div className="text-[9px] text-muted-foreground">Actual = Unit x Shipped</div>
                <div className="text-xs font-semibold">
                  {computedActualCost > 0 ? `Rs ${computedActualCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Order Details */}
          <CollapsibleSection
            title="Order Details"
            expanded={expandedSections.orderDetails}
            onToggle={() => toggleSection("orderDetails")}
          >
            {(form.poNumber || awaitingTag(form.orderStatus, form.piReceivedAt, form.advancePaidAt)) && (
              <div className="flex items-center gap-2 mb-1">
                {form.poNumber && (
                  <div className="text-[11px] flex items-center gap-1">
                    <span className="text-muted-foreground">PO:</span>
                    <span className="font-mono font-semibold">{form.poNumber}</span>
                  </div>
                )}
                {awaitingTag(form.orderStatus, form.piReceivedAt, form.advancePaidAt) && (
                  <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {awaitingTag(form.orderStatus, form.piReceivedAt, form.advancePaidAt)}
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Order Status *</Label>
                <Select value={form.orderStatus} onValueChange={(v) => updateField("orderStatus", v ?? "DRAFT_ORDER")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{FABRIC_ORDER_STATUS_LABELS[form.orderStatus] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FABRIC_ORDER_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Garmenting At *</Label>
                <Select value={form.garmentingAt} onValueChange={(v) => updateField("garmentingAt", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{form.garmentingAt || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {garmentingLocations.map((loc) => (
                      <SelectItem key={loc} value={loc} className="text-xs">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Invoice #</Label>
                <Input className="h-8 text-xs md:text-xs" value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
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
                <Label className="text-[11px]">Received At</Label>
                <Input
                  type="date"
                  className="h-8 text-xs md:text-xs"
                  value={form.receivedAt}
                  onChange={(e) => updateField("receivedAt", e.target.value)}
                />
                {form.receivedAt && (
                  <p className="text-[10px] text-muted-foreground">{isoToDisplayDate(form.receivedAt)}</p>
                )}
              </div>
              <div className="flex items-end pb-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateField("isRepeat", !form.isRepeat)}
                  className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-colors shrink-0 ${form.isRepeat ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}
                >
                  {form.isRepeat && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <Label className="text-[11px]">Repeat</Label>
              </div>
            </div>
          </CollapsibleSection>

          {/* Articles */}
          <CollapsibleSection
            title="Articles"
            expanded={expandedSections.styles}
            onToggle={() => toggleSection("styles")}
          >
            <div className="grid gap-2" style={{ gridTemplateColumns: "4fr 1fr" }}>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Article Numbers</Label>
                <MultiCombobox
                  values={form.articleNumbers ? form.articleNumbers.split(",").map((s) => s.trim()).filter(Boolean) : []}
                  onValuesChange={(vals) => updateField("articleNumbers", vals.join(", "))}
                  options={articleOptions}
                  placeholder="Search article number, article code, product name, product type"
                  showValueInChip
                />
              </div>
              <div className="space-y-0.5 min-w-0">
                <Label className="text-[11px]">Gender</Label>
                <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                  <SelectTrigger className="h-8 text-xs md:text-xs w-full">
                    <span className="truncate">{GENDER_LABELS[form.gender] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleSection>

          {isEditing && (
            <CollapsibleSection
              title={`Linked Article Orders (${linkedProducts.length})`}
              expanded={expandedSections.linkedProducts}
              onToggle={() => toggleSection("linkedProducts")}
            >
              {linkedProducts.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-1">
                  No article orders linked to this fabric order.
                </p>
              ) : (
                <div className="border rounded divide-y">
                  {linkedProducts.map((lp) => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/products?openId=${lp.id}`);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-left hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-blue-600 underline-offset-2 hover:underline">{lp.articleNumber || "—"}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{lp.colourOrdered}</span>
                        <span className="text-[9px] text-muted-foreground px-1 py-0.5 rounded bg-muted">
                          Fabric {lp.fabricSlot}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {lp.garmentNumber !== null && (
                          <span className="text-muted-foreground">{lp.garmentNumber} pcs</span>
                        )}
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          {PRODUCT_STATUS_LABELS[lp.status] || lp.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          )}
        </div>

        <SheetFooter className="flex-col gap-1.5 pt-2">
          <div className={`flex gap-2 ${isEditing ? "" : "flex-col"}`}>
            <Button size="lg" onClick={handleSubmit} disabled={submitting || deleting} className="flex-1 min-h-9">
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEditing ? "Update Order" : "Create Fabric Order"
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
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
          {isEditing && showDeleteConfirm && (
            <div className="w-full rounded border border-red-200 bg-red-50 p-2 space-y-1.5">
              <p className="text-xs font-medium text-red-800">
                Delete this fabric order? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="flex-1 h-7 text-xs">
                  {deleting ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Deleting...</> : "Yes, Delete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 h-7 text-xs">
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
