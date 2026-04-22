"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createAccessoryPurchasesBatch, updateAccessoryPurchase, deleteAccessoryPurchase,
  getPurchasesByPoNumber, bulkUpdateAccessoryPurchaseStatus, cancelAccessoryPurchaseOrder,
} from "@/actions/accessory-purchases";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, X } from "lucide-react";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { CATEGORIES } from "@/lib/accessory-categories";
import type { AccessoryPurchaseStatus } from "@/generated/prisma/client";

export type AccessoryPurchaseRow = {
  id: string;
  phaseId: string;
  accessoryId: string;
  accessoryDisplayName: string;
  accessoryUnit: string;
  vendorId: string | null;
  vendorName: string | null;
  quantity: number;
  costPerUnit: number | null;
  invoiceNumber: string | null;
  purchaseDate: string | null;
  comments: string | null;
  status: string;
  poNumber: string | null;
  shipToVendorId: string | null;
  shipToVendorName: string | null;
};

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

type Vendor = { id: string; name: string; type?: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const STATUS_OPTIONS: { value: AccessoryPurchaseStatus; label: string }[] = [
  { value: "DRAFT_ORDER",       label: "Draft" },
  { value: "PO_SENT",           label: "PO Sent" },
  { value: "PI_RECEIVED",       label: "PI Received" },
  { value: "ADVANCE_PAID",      label: "Advance Paid" },
  { value: "PARTIALLY_SHIPPED", label: "Partially Shipped" },
  { value: "DISPATCHED",        label: "Dispatched" },
  { value: "RECEIVED",          label: "Received" },
  { value: "FULLY_SETTLED",     label: "Fully Settled" },
  { value: "CANCELLED",         label: "Cancelled" },
];

// Statuses that require a PO to have been generated first.
const REQUIRES_PO: AccessoryPurchaseStatus[] = ["PO_SENT", "PI_RECEIVED", "ADVANCE_PAID", "PARTIALLY_SHIPPED", "DISPATCHED", "RECEIVED", "FULLY_SETTLED"];

// Statuses for which a group-sync prompt is shown (moving to or from PO_SENT implies
// the whole PO group should move together).
const GROUP_SYNC_STATUSES: AccessoryPurchaseStatus[] = ["PO_SENT", "PI_RECEIVED", "ADVANCE_PAID", "PARTIALLY_SHIPPED", "DISPATCHED", "RECEIVED", "FULLY_SETTLED"];

// --- Create-mode types ---

type LineItem = {
  _key: string;
  accessoryId: string;
  vendorId: string;
  quantity: string;
  costPerUnit: string;
};

type SharedFields = {
  category: string;
  invoiceNumber: string;
  purchaseDate: string;
  comments: string;
};

function newLine(): LineItem {
  return { _key: Math.random().toString(36).slice(2), accessoryId: "", vendorId: "", quantity: "", costPerUnit: "" };
}

function emptyShared(): SharedFields {
  return { category: "", invoiceNumber: "", purchaseDate: new Date().toISOString().slice(0, 10), comments: "" };
}

// --- Edit-mode form ---

type EditFormData = {
  accessoryId: string;
  categoryFilter: string;
  vendorId: string;
  quantity: string;
  costPerUnit: string;
  invoiceNumber: string;
  purchaseDate: string;
  comments: string;
  status: AccessoryPurchaseStatus;
};

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ label: c.label, value: c.value }));

// Group-update prompt state
type GroupPrompt = {
  newStatus: AccessoryPurchaseStatus;
  siblingIds: string[];   // IDs of OTHER rows (excluding current row) sharing the PO
  poNumber: string;
};

export function AccessoryPurchaseSheet({
  open,
  onOpenChange,
  editingRow,
  phaseId,
  accessories,
  vendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: AccessoryPurchaseRow | null;
  phaseId: string;
  accessories: AccessoryOption[];
  vendors: Vendor[];
}) {
  const router = useRouter();
  const isEdit = editingRow !== null;

  // Create-mode state
  const [shared, setShared] = useState<SharedFields>(emptyShared());
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  // Edit-mode state
  const [editForm, setEditForm] = useState<EditFormData>({
    accessoryId: "",
    categoryFilter: "",
    vendorId: "",
    quantity: "",
    costPerUnit: "",
    invoiceNumber: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    comments: "",
    status: "DRAFT_ORDER",
  });

  // Inline group-update prompt
  const [groupPrompt, setGroupPrompt] = useState<GroupPrompt | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelPoConfirm, setShowCancelPoConfirm] = useState(false);
  const [cancellingPo, setCancellingPo] = useState(false);
  const [poSiblingCount, setPoSiblingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && editingRow) {
      const acc = accessories.find((a) => a.id === editingRow.accessoryId);
      setEditForm({
        accessoryId: editingRow.accessoryId,
        categoryFilter: acc?.category ?? "",
        vendorId: editingRow.vendorId ?? "",
        quantity: String(editingRow.quantity),
        costPerUnit: editingRow.costPerUnit != null ? String(editingRow.costPerUnit) : "",
        invoiceNumber: editingRow.invoiceNumber ?? "",
        purchaseDate: editingRow.purchaseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        comments: editingRow.comments ?? "",
        status: (editingRow.status ?? "DRAFT_ORDER") as AccessoryPurchaseStatus,
      });
    } else {
      setShared(emptyShared());
      setLines([newLine()]);
    }
    setGroupPrompt(null);
    setShowDeleteConfirm(false);
    setShowCancelPoConfirm(false);
    setPoSiblingCount(null);
  }, [open, editingRow, isEdit, accessories]);

  // When the user picks a new status in edit mode.
  async function handleStatusChange(newStatus: AccessoryPurchaseStatus) {
    const prev = editForm.status;
    if (newStatus === prev) return;

    // Validate: forward statuses require a PO number.
    if (REQUIRES_PO.includes(newStatus) && !editingRow?.poNumber) {
      toast.error("Generate a PO first before setting this status.");
      return;
    }

    // If this row belongs to a PO and both old/new status are in the "beyond draft" set
    // (or we're moving to/from PO_SENT), prompt to sync the group.
    const shouldPrompt =
      !!editingRow?.poNumber &&
      (GROUP_SYNC_STATUSES.includes(newStatus) || GROUP_SYNC_STATUSES.includes(prev));

    if (shouldPrompt) {
      setLoadingPrompt(true);
      try {
        const siblings = await getPurchasesByPoNumber(editingRow!.poNumber!);
        const otherIds = siblings.filter((s) => s.id !== editingRow!.id).map((s) => s.id);
        if (otherIds.length > 0) {
          // Apply the status change to the form immediately but hold submission.
          setEditForm((f) => ({ ...f, status: newStatus }));
          setGroupPrompt({ newStatus, siblingIds: otherIds, poNumber: editingRow!.poNumber! });
          return;
        }
      } catch {
        // If fetch fails, fall through and just update the form field.
      } finally {
        setLoadingPrompt(false);
      }
    }

    setEditForm((f) => ({ ...f, status: newStatus }));
  }

  // --- Create-mode helpers ---

  const categoryAccessories = shared.category ? accessories.filter((a) => a.category === shared.category) : [];

  function updateShared(field: keyof SharedFields, value: string) {
    setShared((prev) => ({ ...prev, [field]: value }));
    if (field === "category") {
      setLines((prev) => prev.map((l) => ({ ...l, accessoryId: "", vendorId: "", costPerUnit: "" })));
    }
  }

  function addLine() { setLines((prev) => [...prev, newLine()]); }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  function handleLineAccessoryChange(idx: number, id: string) {
    const acc = accessories.find((a) => a.id === id);
    setLines((prev) =>
      prev.map((l, i) =>
        i !== idx ? l : {
          ...l,
          accessoryId: id,
          vendorId: acc?.vendorId ?? l.vendorId,
          costPerUnit: acc?.defaultCostPerUnit != null ? String(acc.defaultCostPerUnit) : l.costPerUnit,
        },
      ),
    );
  }

  function updateLine(idx: number, field: keyof Omit<LineItem, "_key">, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function updateEditField(field: keyof Omit<EditFormData, "status">, value: string) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "categoryFilter") next.accessoryId = "";
      return next;
    });
  }

  function handleEditAccessoryChange(id: string) {
    const acc = accessories.find((a) => a.id === id);
    setEditForm((prev) => ({
      ...prev,
      accessoryId: id,
      vendorId: acc?.vendorId ?? prev.vendorId,
      costPerUnit: acc?.defaultCostPerUnit != null ? String(acc.defaultCostPerUnit) : prev.costPerUnit,
    }));
  }

  // --- Submit ---

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (isEdit) {
        if (!editForm.accessoryId) { toast.error("Accessory is required"); return; }
        if (toNum(editForm.quantity) === null) { toast.error("Quantity is required"); return; }

        // If there's a pending group prompt, "Update Purchase" means "update this row only".
        // The group prompt handles the sibling update separately.
        await updateAccessoryPurchase(editingRow!.id, {
          phaseId,
          accessoryId: editForm.accessoryId,
          vendorId: editForm.vendorId || null,
          quantity: toNum(editForm.quantity),
          costPerUnit: toNum(editForm.costPerUnit),
          invoiceNumber: editForm.invoiceNumber.trim() || null,
          purchaseDate: editForm.purchaseDate ? new Date(editForm.purchaseDate) : null,
          comments: editForm.comments.trim() || null,
          status: editForm.status,
          statusChangedAt: new Date(),
        });
        toast.success("Purchase updated");
      } else {
        if (!shared.category) { toast.error("Select a category first"); return; }
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].accessoryId) { toast.error(`Line ${i + 1}: accessory is required`); return; }
          if (toNum(lines[i].quantity) === null) { toast.error(`Line ${i + 1}: quantity is required`); return; }
        }
        await createAccessoryPurchasesBatch(
          lines.map((l) => ({
            phaseId,
            accessoryId: l.accessoryId,
            vendorId: l.vendorId || null,
            quantity: toNum(l.quantity),
            costPerUnit: toNum(l.costPerUnit),
            invoiceNumber: shared.invoiceNumber.trim() || null,
            purchaseDate: shared.purchaseDate ? new Date(shared.purchaseDate) : null,
            comments: shared.comments.trim() || null,
          })),
        );
        toast.success(lines.length === 1 ? "Purchase recorded" : `${lines.length} purchases recorded`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  // "Update all" in the group prompt: save this row + bulk-update siblings.
  async function handleGroupUpdateAll() {
    if (!groupPrompt) return;
    setSubmitting(true);
    try {
      // Save this row with the new status.
      await updateAccessoryPurchase(editingRow!.id, {
        phaseId,
        accessoryId: editForm.accessoryId,
        vendorId: editForm.vendorId || null,
        quantity: toNum(editForm.quantity),
        costPerUnit: toNum(editForm.costPerUnit),
        invoiceNumber: editForm.invoiceNumber.trim() || null,
        purchaseDate: editForm.purchaseDate ? new Date(editForm.purchaseDate) : null,
        comments: editForm.comments.trim() || null,
        status: groupPrompt.newStatus,
        statusChangedAt: new Date(),
      });
      // Bulk-update all siblings.
      await bulkUpdateAccessoryPurchaseStatus(groupPrompt.siblingIds, groupPrompt.newStatus);
      toast.success(`Status updated for all ${groupPrompt.siblingIds.length + 1} rows in PO ${groupPrompt.poNumber}`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGroupCancel() {
    // Revert the status in the form back to the row's current status.
    setEditForm((f) => ({ ...f, status: (editingRow?.status ?? "DRAFT_ORDER") as AccessoryPurchaseStatus }));
    setGroupPrompt(null);
  }

  async function openCancelPoConfirm() {
    if (!editingRow?.poNumber) return;
    try {
      const siblings = await getPurchasesByPoNumber(editingRow.poNumber);
      setPoSiblingCount(siblings.length);
      setShowCancelPoConfirm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load PO rows");
    }
  }

  async function handleCancelPo() {
    if (!editingRow?.poNumber) return;
    setCancellingPo(true);
    try {
      const count = await cancelAccessoryPurchaseOrder(editingRow.poNumber);
      toast.success(`PO ${editingRow.poNumber} cancelled — ${count} row${count === 1 ? "" : "s"} freed`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingPo(false);
      setShowCancelPoConfirm(false);
    }
  }

  async function handleDelete() {
    if (!editingRow) return;
    setDeleting(true);
    try {
      await deleteAccessoryPurchase(editingRow.id);
      toast.success("Purchase deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const grandTotal = lines.reduce((sum, l) => sum + (toNum(l.quantity) || 0) * (toNum(l.costPerUnit) || 0), 0);
  const editTotal = (toNum(editForm.quantity) || 0) * (toNum(editForm.costPerUnit) || 0);
  const hasPoNumber = !!editingRow?.poNumber;
  const isCancelled = editingRow?.status === "CANCELLED";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-hidden border-t-4 border-t-emerald-400">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Purchase" : "New Accessory Purchase"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit
              ? "Update purchase details."
              : "Select a category, then add one or more accessories from that category."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 space-y-3 px-4 overflow-y-auto">
          {isEdit ? (
            <>
              {/* Status + PO number row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(v) => handleStatusChange(v as AccessoryPurchaseStatus)}
                    disabled={loadingPrompt || isCancelled}
                  >
                    <SelectTrigger size="sm" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => {
                        const locked = REQUIRES_PO.includes(opt.value) && !hasPoNumber;
                        return (
                          <SelectItem key={opt.value} value={opt.value} disabled={locked}>
                            {opt.label}{locked ? " (needs PO)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {editingRow?.poNumber && (
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">PO Number</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => window.open(`/accessory-purchases/purchase-order?poNumber=${encodeURIComponent(editingRow.poNumber!)}`, "_blank")}
                        className="flex h-7 flex-1 min-w-0 items-center rounded-lg border border-border px-2 text-[11px] text-blue-600 underline font-mono hover:bg-muted/50 transition-colors"
                      >
                        <span className="truncate">{editingRow.poNumber}</span>
                      </button>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={openCancelPoConfirm}
                          title="Cancel PO (marks all rows Cancelled)"
                          disabled={cancellingPo}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Group-update prompt */}
              {groupPrompt && (
                <div className="rounded-md border-l-2 border-l-blue-500 border-y border-r border-border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] leading-snug text-foreground">
                    <span className="font-mono">{groupPrompt.poNumber}</span> is linked to {groupPrompt.siblingIds.length + 1} purchase rows.
                    Move all to <span className="font-medium">{STATUS_OPTIONS.find((s) => s.value === groupPrompt.newStatus)?.label}</span>?
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Button size="sm" onClick={handleGroupUpdateAll} disabled={submitting} className="h-7 text-[11px] px-2.5">
                      {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      Update all {groupPrompt.siblingIds.length + 1}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleGroupCancel} disabled={submitting} className="h-7 text-[11px] px-2.5 text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {isCancelled && (
                <div className="rounded-md border-l-2 border-l-red-500 border-y border-r border-border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] leading-snug text-foreground">
                    This purchase is part of a <span className="font-medium">cancelled PO</span>. Fields are read-only to preserve the audit trail — the PO number is burned and won&apos;t be reused.
                  </p>
                  <p className="text-[10px] leading-snug text-muted-foreground mt-1">
                    To correct a mistake, delete this row and create a new purchase.
                  </p>
                </div>
              )}

              <fieldset disabled={isCancelled} className={isCancelled ? "opacity-60 pointer-events-none" : ""}>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Category filter</Label>
                <Combobox
                  value={editForm.categoryFilter}
                  onValueChange={(v) => updateEditField("categoryFilter", v)}
                  options={CATEGORY_OPTIONS}
                  placeholder="All categories"
                />
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px]">Accessory *</Label>
                <Combobox
                  value={editForm.accessoryId}
                  onValueChange={handleEditAccessoryChange}
                  options={(editForm.categoryFilter
                    ? accessories.filter((a) => a.category === editForm.categoryFilter)
                    : accessories
                  ).map((a) => ({
                    label: accessoryDisplayName(a),
                    value: a.id,
                    searchText: `${accessoryDisplayName(a)} ${a.unit}`,
                  }))}
                  placeholder="Select accessory..."
                />
                {editForm.accessoryId && (() => {
                  const acc = accessories.find((a) => a.id === editForm.accessoryId);
                  return acc ? <div className="text-[10px] text-muted-foreground italic">Unit: {acc.unit}</div> : null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Quantity *</Label>
                  <Input type="number" step="0.01" value={editForm.quantity}
                    onChange={(e) => updateEditField("quantity", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Cost / unit (Rs)</Label>
                  <Input type="number" step="0.01" value={editForm.costPerUnit}
                    onChange={(e) => updateEditField("costPerUnit", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              {editTotal > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Line total: ₹ {editTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Vendor</Label>
                  <Combobox
                    value={editForm.vendorId}
                    onValueChange={(v) => updateEditField("vendorId", v)}
                    options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                    placeholder="Select vendor..."
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Purchase Date</Label>
                  <Input type="date" value={editForm.purchaseDate}
                    onChange={(e) => updateEditField("purchaseDate", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              {editingRow?.shipToVendorName && (
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Ship To</Label>
                  <Input value={editingRow.shipToVendorName} readOnly disabled className="h-8 text-xs" />
                  <div className="text-[10px] text-muted-foreground italic">
                    Set at PO generation. Cancel the PO to change.
                  </div>
                </div>
              )}

              <div className="space-y-0.5">
                <Label className="text-[11px]">Invoice Number</Label>
                <Input value={editForm.invoiceNumber}
                  onChange={(e) => updateEditField("invoiceNumber", e.target.value)} className="h-8 text-xs" />
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px]">Comments</Label>
                <Textarea value={editForm.comments}
                  onChange={(e) => updateEditField("comments", e.target.value)}
                  className="min-h-[60px] resize-none text-xs" />
              </div>
              </fieldset>
            </>
          ) : (
            <>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Category *</Label>
                <Combobox
                  value={shared.category}
                  onValueChange={(v) => updateShared("category", v)}
                  options={CATEGORY_OPTIONS}
                  placeholder="Select category..."
                />
              </div>

              {!shared.category && (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                  Select a category above to continue
                </div>
              )}

              {shared.category && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Purchase Date</Label>
                      <Input type="date" value={shared.purchaseDate}
                        onChange={(e) => updateShared("purchaseDate", e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Invoice Number</Label>
                      <Input value={shared.invoiceNumber}
                        onChange={(e) => updateShared("invoiceNumber", e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Comments</Label>
                    <Textarea value={shared.comments}
                      onChange={(e) => updateShared("comments", e.target.value)}
                      className="min-h-[48px] resize-none text-xs" />
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Accessories ({lines.length})
                    </div>

                    {lines.map((line, idx) => {
                      const lineAcc = accessories.find((a) => a.id === line.accessoryId);
                      const lineTotal = (toNum(line.quantity) || 0) * (toNum(line.costPerUnit) || 0);
                      return (
                        <div key={line._key} className="rounded border border-border p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-muted-foreground">Line {idx + 1}</span>
                            {lines.length > 1 && (
                              <button type="button" onClick={() => removeLine(idx)}
                                className="text-muted-foreground hover:text-destructive transition-colors">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <Label className="text-[11px]">Accessory *</Label>
                              <Combobox
                                value={line.accessoryId}
                                onValueChange={(id) => handleLineAccessoryChange(idx, id)}
                                options={categoryAccessories.map((a) => ({
                                  label: accessoryDisplayName(a),
                                  value: a.id,
                                  searchText: `${accessoryDisplayName(a)} ${a.unit}`,
                                }))}
                                placeholder={categoryAccessories.length === 0 ? "No accessories in this category" : "Select accessory..."}
                              />
                              {lineAcc && <div className="text-[10px] text-muted-foreground italic">Unit: {lineAcc.unit}</div>}
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[11px]">Vendor</Label>
                              <Combobox
                                value={line.vendorId}
                                onValueChange={(v) => updateLine(idx, "vendorId", v)}
                                options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                                placeholder="Select vendor..."
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <Label className="text-[11px]">Quantity *</Label>
                              <Input type="number" step="0.01" value={line.quantity}
                                onChange={(e) => updateLine(idx, "quantity", e.target.value)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-[11px]">Cost / unit (Rs)</Label>
                              <Input type="number" step="0.01" value={line.costPerUnit}
                                onChange={(e) => updateLine(idx, "costPerUnit", e.target.value)} className="h-8 text-xs" />
                            </div>
                          </div>

                          {lineTotal > 0 && (
                            <div className="text-[10px] text-muted-foreground text-right">
                              ₹ {lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <Button type="button" variant="outline" size="sm" onClick={addLine} className="w-full text-xs h-8">
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add another accessory
                    </Button>

                    {grandTotal > 0 && lines.length > 1 && (
                      <div className="text-[11px] font-medium text-right text-muted-foreground">
                        Grand total: ₹ {grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          {!showDeleteConfirm && !showCancelPoConfirm && (
            <div className={`flex gap-2 ${isEdit ? "" : "flex-col"}`}>
              {!isCancelled && (
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting || !!groupPrompt}
                  title={groupPrompt ? "Resolve the PO-group prompt above first" : undefined}
                  className="flex-1"
                >
                  {submitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : "Recording..."}</>
                    : isEdit ? "Update Purchase" : lines.length > 1 ? `Record ${lines.length} Purchases` : "Record Purchase"}
                </Button>
              )}
              {isEdit && (
                <Button variant="destructive" size="lg" onClick={() => setShowDeleteConfirm(true)}
                  disabled={submitting || deleting || !!groupPrompt} className="flex-1">
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </Button>
              )}
            </div>
          )}
          {isEdit && showCancelPoConfirm && editingRow?.poNumber && (
            <div className="w-full rounded-md border-l-2 border-l-amber-500 border-y border-r border-border bg-muted/40 px-3 py-2 space-y-1">
              <p className="text-[11px] leading-snug text-foreground">
                Cancel PO <span className="font-mono">{editingRow.poNumber}</span>
                {poSiblingCount && poSiblingCount > 1 ? ` and unstamp all ${poSiblingCount} rows?` : " and unstamp this row?"}
              </p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Rows are marked Cancelled. The PO stays on record (and in the Purchase Orders tab) for audit; the number is not reused.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button variant="destructive" size="sm" onClick={handleCancelPo} disabled={cancellingPo} className="h-7 text-[11px] px-2.5">
                  {cancellingPo ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Cancelling...</> : "Yes, Cancel PO"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCancelPoConfirm(false)} disabled={cancellingPo} className="h-7 text-[11px] px-2.5 text-muted-foreground">
                  Keep PO
                </Button>
              </div>
            </div>
          )}
          {isEdit && showDeleteConfirm && (
            <div className="w-full rounded-md border-l-2 border-l-destructive border-y border-r border-border bg-muted/40 px-3 py-2 space-y-1.5">
              <p className="text-[11px] leading-snug text-foreground">
                Delete this purchase permanently? Balance will recalculate.
              </p>
              <div className="flex items-center gap-1.5">
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="h-7 text-[11px] px-2.5">
                  {deleting ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Deleting...</> : "Yes, Delete"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="h-7 text-[11px] px-2.5 text-muted-foreground">
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
