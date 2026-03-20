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
import { createFabricOrder, updateFabricOrder, deleteFabricOrder } from "@/actions/fabric-orders";
import { GENDER_LABELS, FABRIC_ORDER_STATUS_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2, Trash2, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import React from "react";

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;
type ProductMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricName: string;
  fabricVendorId: string;
  styleNumbers: string;
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
};

const emptyForm: FormData = {
  fabricName: "",
  fabricVendorId: "",
  styleNumbers: "",
  colour: "",
  availableColour: "",
  gender: "",
  invoiceNumber: "",
  receivedAt: "",
  orderDate: "",
  costPerUnit: "",
  fabricOrderedQuantityKg: "",
  fabricShippedQuantityKg: "",
  isRepeat: false,
  orderStatus: "DRAFT_ORDER",
  garmentingAt: "",
};

const SECTIONS = ["fabricInfo", "orderDetails", "styles", "quantitiesCost"] as const;
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
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm, isRepeat: isRepeatTab });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Collapsible section state
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

  // Build Combobox options for style numbers (search across product master fields)
  const styleOptions = useMemo(() => {
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

  // Reset form when sheet opens
  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm({
          fabricName: String(editingRow.fabricName ?? ""),
          fabricVendorId: String(editingRow.fabricVendorId ?? ""),
          styleNumbers: String(editingRow.styleNumbers ?? ""),
          colour: String(editingRow.colour ?? ""),
          availableColour: String(editingRow.availableColour ?? ""),
          gender: String(editingRow.gender ?? ""),
          invoiceNumber: String(editingRow.invoiceNumber ?? ""),
          receivedAt: String(editingRow.receivedAt ?? ""),
          orderDate: String(editingRow.orderDate ?? ""),
          costPerUnit: editingRow.costPerUnit != null ? String(editingRow.costPerUnit) : "",
          fabricOrderedQuantityKg: editingRow.fabricOrderedQuantityKg != null ? String(editingRow.fabricOrderedQuantityKg) : "",
          fabricShippedQuantityKg: editingRow.fabricShippedQuantityKg != null ? String(editingRow.fabricShippedQuantityKg) : "",
          isRepeat: Boolean(editingRow.isRepeat),
          orderStatus: String(editingRow.orderStatus ?? "DRAFT_ORDER"),
          garmentingAt: String(editingRow.garmentingAt ?? ""),
        });
      } else {
        setForm({ ...emptyForm, isRepeat: isRepeatTab });
      }
      setShowDeleteConfirm(false);
      setAllSections(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isRepeatTab, vendors, editingRow]);

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
    // Append to existing styleNumbers (comma-separated)
    setForm((prev) => {
      const existing = prev.styleNumbers.trim();
      if (existing) {
        // Don't add duplicate
        const parts = existing.split(",").map((s) => s.trim());
        if (parts.includes(skuCode)) return prev;
        return { ...prev, styleNumbers: `${existing}, ${skuCode}` };
      }
      return { ...prev, styleNumbers: skuCode };
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

    setSubmitting(true);
    try {
      const payload = {
        fabricVendorId: form.fabricVendorId,
        styleNumbers: form.styleNumbers,
        fabricName: form.fabricName,
        colour: form.colour,
        gender: form.gender || null,
        invoiceNumber: form.invoiceNumber || null,
        receivedAt: form.receivedAt || null,
        orderDate: form.orderDate || null,
        availableColour: form.availableColour || null,
        costPerUnit: toNum(form.costPerUnit),
        fabricOrderedQuantityKg: toNum(form.fabricOrderedQuantityKg),
        fabricShippedQuantityKg: toNum(form.fabricShippedQuantityKg),
        isRepeat: form.isRepeat,
        isStrikedThrough: false,
        orderStatus: form.orderStatus || "DRAFT_ORDER",
        garmentingAt: form.garmentingAt || null,
      };

      if (isEditing && editingRow?.id) {
        await updateFabricOrder(String(editingRow.id), payload);
        toast.success("Fabric order updated");
      } else {
        await createFabricOrder({ ...payload, phaseId });
        toast.success("Fabric order created");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isEditing ? "Failed to update fabric order" : "Failed to create fabric order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingRow?.id) return;
    setDeleting(true);
    try {
      await deleteFabricOrder(String(editingRow.id));
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
      <SheetContent side="right" className="max-w-[750px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle>{isEditing ? "Edit Fabric Order" : "New Fabric Order"}</SheetTitle>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Order</span>
              </div>
              <SheetDescription>
                {isEditing
                  ? "Update the fabric order details below"
                  : "Enter fabric name to auto-populate from Fabrics Master DB"}
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
          {/* Fabric Info */}
          <CollapsibleSection
            title="Fabric Info"
            expanded={expandedSections.fabricInfo}
            onToggle={() => toggleSection("fabricInfo")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Fabric Name *</Label>
                <Combobox
                  value={form.fabricName}
                  onValueChange={handleFabricNameSelect}
                  options={fabricNameOptions}
                  placeholder="Search fabric name or vendor..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fabric Vendor *</Label>
                <Select value={form.fabricVendorId} onValueChange={(v) => updateField("fabricVendorId", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{vendorLabels[form.fabricVendorId] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Colour</Label>
                {colourOptions.length > 0 ? (
                  <Combobox
                    value={form.colour}
                    onValueChange={(v) => updateField("colour", v)}
                    options={colourOptions}
                    placeholder="Select colour..."
                  />
                ) : (
                  <Input value={form.colour} onChange={(e) => updateField("colour", e.target.value)} placeholder={form.fabricName ? "No colours in master" : "Select fabric first"} />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avail. Colour</Label>
                {colourOptions.length > 0 ? (
                  <Combobox
                    value={form.availableColour}
                    onValueChange={(v) => updateField("availableColour", v)}
                    options={colourOptions}
                    placeholder="Select colour..."
                  />
                ) : (
                  <Input value={form.availableColour} onChange={(e) => updateField("availableColour", e.target.value)} placeholder={form.fabricName ? "No colours in master" : "Select fabric first"} />
                )}
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
            </div>
          </CollapsibleSection>

          {/* Order Details */}
          <CollapsibleSection
            title="Order Details"
            expanded={expandedSections.orderDetails}
            onToggle={() => toggleSection("orderDetails")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Order Status</Label>
                <Select value={form.orderStatus} onValueChange={(v) => updateField("orderStatus", v ?? "DRAFT_ORDER")}>
                  <SelectTrigger>
                    <span className="truncate">{FABRIC_ORDER_STATUS_LABELS[form.orderStatus] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FABRIC_ORDER_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Garmenting Location</Label>
                <Select value={form.garmentingAt} onValueChange={(v) => updateField("garmentingAt", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{form.garmentingAt || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {garmentingLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice #</Label>
                <Input value={form.invoiceNumber} onChange={(e) => updateField("invoiceNumber", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Order Date</Label>
                <Input type="date" value={form.orderDate} onChange={(e) => updateField("orderDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Received At</Label>
                <Input type="date" value={form.receivedAt} onChange={(e) => updateField("receivedAt", e.target.value)} />
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

          {/* Styles */}
          <CollapsibleSection
            title="Styles"
            expanded={expandedSections.styles}
            onToggle={() => toggleSection("styles")}
          >
            <div className="space-y-1">
              <Label className="text-xs">Fabric used for styles</Label>
              <Combobox
                value=""
                onValueChange={handleStyleSelect}
                options={styleOptions}
                placeholder="Search SKU, style, article, name, type..."
              />
              {form.styleNumbers && (
                <div className="flex items-center justify-between gap-2 mt-1 p-1.5 bg-gray-50 rounded border">
                  <span className="text-xs text-muted-foreground">{form.styleNumbers}</span>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    onClick={() => updateField("styleNumbers", "")}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Quantities & Cost */}
          <CollapsibleSection
            title="Quantities & Cost"
            expanded={expandedSections.quantitiesCost}
            onToggle={() => toggleSection("quantitiesCost")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cost/Unit (Rs)</Label>
                <Input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => updateField("costPerUnit", e.target.value)} />
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
            {/* Computed fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Expected Cost = Cost/Unit x Ordered Qty</div>
                <div className="text-sm font-semibold mt-0.5">
                  {computedExpectedCost > 0 ? `Rs ${computedExpectedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <div className="text-[10px] text-muted-foreground">Actual Cost = Cost/Unit x Shipped Qty</div>
                <div className="text-sm font-semibold mt-0.5">
                  {computedActualCost > 0 ? `Rs ${computedActualCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
                </div>
              </div>
            </div>
          </CollapsibleSection>
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
                isEditing ? "Update Order" : "Create Fabric Order"
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
                Are you sure you want to delete this fabric order? This action cannot be undone.
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
