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
  createAccessoryDispatch, updateAccessoryDispatch, deleteAccessoryDispatch,
  getDispatchSuggestionForProduct, getDispatchesByDnNumber,
  bulkUpdateAccessoryDispatchStatus, cancelAccessoryDispatchNote,
} from "@/actions/accessory-dispatches";
import { toast } from "sonner";
import { Loader2, Trash2, Wand2, X } from "lucide-react";
import { accessoryDisplayName } from "@/lib/accessory-display";
import type { AccessoryDispatchStatus } from "@/generated/prisma/client";

export type AccessoryDispatchRow = {
  id: string;
  phaseId: string;
  accessoryId: string;
  accessoryDisplayName: string;
  accessoryUnit: string;
  quantity: number;
  destinationGarmenter: string | null;
  productId: string | null;
  productLabel: string | null;
  dispatchDate: string | null;
  comments: string | null;
  status: string;
  dnNumber: string | null;
};

type AccessoryOption = {
  id: string;
  displayName: string;
  category: string;
  unit: string;
  baseName?: string | null;
  colour?: string | null;
  size?: string | null;
};

type ProductOption = { id: string; label: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const STATUS_OPTIONS: { value: AccessoryDispatchStatus; label: string }[] = [
  { value: "DRAFT",      label: "Draft" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "RECEIVED",   label: "Received" },
  { value: "CANCELLED",  label: "Cancelled" },
];

// Statuses requiring a DN to have been generated first.
const REQUIRES_DN: AccessoryDispatchStatus[] = ["DISPATCHED", "RECEIVED", "CANCELLED"];

// Statuses for which a group-sync prompt is shown. Once a DN is issued,
// moving any row past Draft implies the whole group moves with it.
const GROUP_SYNC_STATUSES: AccessoryDispatchStatus[] = ["DISPATCHED", "RECEIVED"];

type GroupPrompt = {
  newStatus: AccessoryDispatchStatus;
  siblingIds: string[];
  dnNumber: string;
};

type FormData = {
  accessoryId: string;
  quantity: string;
  destinationGarmenter: string;
  productId: string;
  dispatchDate: string;
  comments: string;
  status: AccessoryDispatchStatus;
};

const emptyForm: FormData = {
  accessoryId: "",
  quantity: "",
  destinationGarmenter: "",
  productId: "",
  dispatchDate: new Date().toISOString().slice(0, 10),
  comments: "",
  status: "DRAFT",
};

export function AccessoryDispatchSheet({
  open,
  onOpenChange,
  editingRow,
  phaseId,
  accessories,
  garmenters,
  products,
  productsByAccessory = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: AccessoryDispatchRow | null;
  phaseId: string;
  accessories: AccessoryOption[];
  garmenters: string[];
  products: ProductOption[];
  productsByAccessory?: Record<string, string[]>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionBasis, setSuggestionBasis] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelDnConfirm, setShowCancelDnConfirm] = useState(false);
  const [cancellingDn, setCancellingDn] = useState(false);
  const [dnSiblingCount, setDnSiblingCount] = useState<number | null>(null);
  const [groupPrompt, setGroupPrompt] = useState<GroupPrompt | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const isEdit = editingRow !== null;

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm({
          accessoryId: editingRow.accessoryId,
          quantity: String(editingRow.quantity),
          destinationGarmenter: editingRow.destinationGarmenter || "",
          productId: editingRow.productId || "",
          dispatchDate: editingRow.dispatchDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          comments: editingRow.comments || "",
          status: (editingRow.status ?? "DRAFT") as AccessoryDispatchStatus,
        });
      } else {
        setForm({ ...emptyForm });
      }
      setShowDeleteConfirm(false);
      setShowCancelDnConfirm(false);
      setDnSiblingCount(null);
      setSuggestionBasis(null);
      setGroupPrompt(null);
    }
  }, [open, editingRow]);

  function updateField(field: keyof Omit<FormData, "status">, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleStatusChange(newStatus: AccessoryDispatchStatus) {
    const prev = form.status;
    if (newStatus === prev) return;

    if (REQUIRES_DN.includes(newStatus) && !editingRow?.dnNumber) {
      toast.error("Generate a DN first before setting this status.");
      return;
    }

    const shouldPrompt =
      !!editingRow?.dnNumber &&
      (GROUP_SYNC_STATUSES.includes(newStatus) || GROUP_SYNC_STATUSES.includes(prev));

    if (shouldPrompt) {
      setLoadingPrompt(true);
      try {
        const siblings = await getDispatchesByDnNumber(editingRow!.dnNumber!);
        const otherIds = siblings.filter((s) => s.id !== editingRow!.id).map((s) => s.id);
        if (otherIds.length > 0) {
          setForm((f) => ({ ...f, status: newStatus }));
          setGroupPrompt({ newStatus, siblingIds: otherIds, dnNumber: editingRow!.dnNumber! });
          return;
        }
      } catch {
        // fall through on fetch failure
      } finally {
        setLoadingPrompt(false);
      }
    }

    setForm((f) => ({ ...f, status: newStatus }));
  }

  async function handleSuggest() {
    if (!form.productId || !form.accessoryId) {
      toast.error("Pick both product and accessory first");
      return;
    }
    setSuggesting(true);
    try {
      const result = await getDispatchSuggestionForProduct(form.productId, form.accessoryId);
      if (!result) {
        toast.error("No BOM line found for this product+accessory");
        setSuggestionBasis(null);
        return;
      }
      setForm((prev) => ({ ...prev, quantity: String(result.quantity) }));
      setSuggestionBasis(result.basis);
      toast.success("Suggested from BOM");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suggest failed");
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit() {
    if (!form.accessoryId) { toast.error("Accessory is required"); return; }
    if (toNum(form.quantity) === null) { toast.error("Quantity is required"); return; }

    setSubmitting(true);
    try {
      const payload = {
        phaseId,
        accessoryId: form.accessoryId,
        quantity: toNum(form.quantity),
        destinationGarmenter: form.destinationGarmenter.trim() || null,
        productId: form.productId || null,
        dispatchDate: form.dispatchDate ? new Date(form.dispatchDate) : null,
        comments: form.comments.trim() || null,
        ...(isEdit ? { status: form.status, statusChangedAt: new Date() } : {}),
      };
      if (isEdit) {
        await updateAccessoryDispatch(editingRow.id, payload);
        toast.success("Dispatch updated");
      } else {
        await createAccessoryDispatch(payload);
        toast.success("Dispatch recorded");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGroupUpdateAll() {
    if (!groupPrompt) return;
    setSubmitting(true);
    try {
      await updateAccessoryDispatch(editingRow!.id, {
        phaseId,
        accessoryId: form.accessoryId,
        quantity: toNum(form.quantity),
        destinationGarmenter: form.destinationGarmenter.trim() || null,
        productId: form.productId || null,
        dispatchDate: form.dispatchDate ? new Date(form.dispatchDate) : null,
        comments: form.comments.trim() || null,
        status: groupPrompt.newStatus,
        statusChangedAt: new Date(),
      });
      await bulkUpdateAccessoryDispatchStatus(groupPrompt.siblingIds, groupPrompt.newStatus);
      toast.success(`Status updated for all ${groupPrompt.siblingIds.length + 1} rows in DN ${groupPrompt.dnNumber}`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGroupCancel() {
    setForm((f) => ({ ...f, status: (editingRow?.status ?? "DRAFT") as AccessoryDispatchStatus }));
    setGroupPrompt(null);
  }

  async function openCancelDnConfirm() {
    if (!editingRow?.dnNumber) return;
    try {
      const siblings = await getDispatchesByDnNumber(editingRow.dnNumber);
      setDnSiblingCount(siblings.length);
      setShowCancelDnConfirm(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load DN rows");
    }
  }

  async function handleCancelDn() {
    if (!editingRow?.dnNumber) return;
    setCancellingDn(true);
    try {
      const count = await cancelAccessoryDispatchNote(editingRow.dnNumber);
      toast.success(`DN ${editingRow.dnNumber} cancelled — ${count} row${count === 1 ? "" : "s"} marked Cancelled`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancellingDn(false);
      setShowCancelDnConfirm(false);
    }
  }

  async function handleDelete() {
    if (!editingRow) return;
    setDeleting(true);
    try {
      await deleteAccessoryDispatch(editingRow.id);
      toast.success("Dispatch deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const selectedAccessory = accessories.find((a) => a.id === form.accessoryId);
  const hasDnNumber = !!editingRow?.dnNumber;
  const isCancelled = editingRow?.status === "CANCELLED";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[480px] w-full overflow-hidden border-t-4 border-t-sky-400">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Dispatch" : "New Accessory Dispatch"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit ? "Update dispatch details." : "Record accessories shipped to a garmenter for the current phase."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 space-y-3 px-4 overflow-y-auto">
          {isEdit && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => handleStatusChange(v as AccessoryDispatchStatus)}
                    disabled={loadingPrompt || isCancelled}
                  >
                    <SelectTrigger size="sm" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => {
                        const locked = REQUIRES_DN.includes(opt.value) && !hasDnNumber;
                        return (
                          <SelectItem key={opt.value} value={opt.value} disabled={locked}>
                            {opt.label}{locked ? " (needs DN)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {editingRow?.dnNumber && (
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">DN Number</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => window.open(`/accessory-dispatches/dispatch-note?dnNumber=${encodeURIComponent(editingRow.dnNumber!)}`, "_blank")}
                        className="flex h-7 flex-1 min-w-0 items-center rounded-lg border border-border px-2 text-[11px] text-blue-600 underline font-mono hover:bg-muted/50 transition-colors"
                      >
                        <span className="truncate">{editingRow.dnNumber}</span>
                      </button>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={openCancelDnConfirm}
                          title="Cancel DN (marks all rows Cancelled)"
                          disabled={cancellingDn}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {groupPrompt && (
                <div className="rounded-md border-l-2 border-l-blue-500 border-y border-r border-border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] leading-snug text-foreground">
                    <span className="font-mono">{groupPrompt.dnNumber}</span> is linked to {groupPrompt.siblingIds.length + 1} dispatch rows.
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
                    This dispatch is part of a <span className="font-medium">cancelled DN</span>. Fields are read-only to preserve the audit trail — the DN number is burned and won&apos;t be reused.
                  </p>
                  <p className="text-[10px] leading-snug text-muted-foreground mt-1">
                    To correct a mistake, delete this row and create a new dispatch.
                  </p>
                </div>
              )}
            </>
          )}

          <fieldset disabled={isCancelled} className={isCancelled ? "opacity-60 pointer-events-none space-y-3" : "space-y-3"}>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Accessory *</Label>
              <Combobox
                value={form.accessoryId}
                onValueChange={(v) => updateField("accessoryId", v)}
                options={accessories.map((a) => ({
                  label: accessoryDisplayName(a),
                  value: a.id,
                  searchText: accessoryDisplayName(a),
                }))}
                placeholder="Select accessory..."
              />
              {selectedAccessory && (
                <div className="text-[10px] text-muted-foreground italic">
                  Unit: {selectedAccessory.unit}
                </div>
              )}
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px]">Linked Product (optional)</Label>
              {(() => {
                const allowedIds = form.accessoryId ? productsByAccessory[form.accessoryId] : undefined;
                const filteredProducts = allowedIds
                  ? products.filter((p) => allowedIds.includes(p.id))
                  : [];
                const placeholder = !form.accessoryId
                  ? "Pick an accessory first"
                  : filteredProducts.length === 0
                    ? "No articles in this phase use this accessory (per BOM)"
                    : "(none — bulk dispatch)";
                return (
                  <Combobox
                    value={form.productId}
                    onValueChange={(v) => updateField("productId", v)}
                    options={filteredProducts.map((p) => ({ label: p.label, value: p.id }))}
                    placeholder={placeholder}
                  />
                );
              })()}
              {form.accessoryId && (
                <p className="text-[10px] text-muted-foreground">
                  Only articles whose master declares this accessory in BOM are shown.
                </p>
              )}
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px]">Quantity *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => updateField("quantity", e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggest}
                  disabled={suggesting || !form.productId || !form.accessoryId}
                  className="h-8 text-xs"
                  title="Suggest qty from BOM"
                >
                  {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  <span className="ml-1">Suggest</span>
                </Button>
              </div>
              {suggestionBasis && (
                <div className="text-[10px] text-muted-foreground italic">From BOM: {suggestionBasis}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Destination Garmenter</Label>
                <Input
                  value={form.destinationGarmenter}
                  onChange={(e) => updateField("destinationGarmenter", e.target.value)}
                  placeholder="Garmenter name"
                  list="dispatch-garmenters"
                  className="h-8 text-xs"
                />
                <datalist id="dispatch-garmenters">
                  {garmenters.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Dispatch Date</Label>
                <Input
                  type="date"
                  value={form.dispatchDate}
                  onChange={(e) => updateField("dispatchDate", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px]">Comments</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => updateField("comments", e.target.value)}
                className="min-h-[60px] resize-none text-xs"
              />
            </div>
          </fieldset>
        </div>

        <SheetFooter>
          {!showDeleteConfirm && !showCancelDnConfirm && (
            <div className={`flex gap-2 ${isEdit ? "" : "flex-col"}`}>
              {!isCancelled && (
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={submitting || !!groupPrompt}
                  title={groupPrompt ? "Resolve the DN-group prompt above first" : undefined}
                  className="flex-1"
                >
                  {submitting
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : "Recording..."}</>
                    : isEdit ? "Update Dispatch" : "Record Dispatch"}
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
          {isEdit && showCancelDnConfirm && editingRow?.dnNumber && (
            <div className="w-full rounded-md border-l-2 border-l-amber-500 border-y border-r border-border bg-muted/40 px-3 py-2 space-y-1">
              <p className="text-[11px] leading-snug text-foreground">
                Cancel DN <span className="font-mono">{editingRow.dnNumber}</span>
                {dnSiblingCount && dnSiblingCount > 1 ? ` and mark all ${dnSiblingCount} rows Cancelled?` : " and mark this row Cancelled?"}
              </p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Rows are marked Cancelled. The DN stays on record (and in the Dispatch Notes tab) for audit; the number is not reused.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <Button variant="destructive" size="sm" onClick={handleCancelDn} disabled={cancellingDn} className="h-7 text-[11px] px-2.5">
                  {cancellingDn ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Cancelling...</> : "Yes, Cancel DN"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCancelDnConfirm(false)} disabled={cancellingDn} className="h-7 text-[11px] px-2.5 text-muted-foreground">
                  Keep DN
                </Button>
              </div>
            </div>
          )}
          {isEdit && showDeleteConfirm && (
            <div className="w-full rounded-md border-l-2 border-l-destructive border-y border-r border-border bg-muted/40 px-3 py-2 space-y-1.5">
              <p className="text-[11px] leading-snug text-foreground">
                Delete this dispatch permanently? Balance will recalculate.
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
