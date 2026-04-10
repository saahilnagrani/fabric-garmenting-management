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
  createAccessoryDispatch, updateAccessoryDispatch, deleteAccessoryDispatch,
  getDispatchSuggestionForProduct,
} from "@/actions/accessory-dispatches";
import { toast } from "sonner";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { accessoryDisplayName } from "@/lib/accessory-display";

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
};

type AccessoryOption = {
  id: string;
  baseName: string;
  colour: string | null;
  size: string | null;
  unit: string;
};

type ProductOption = {
  id: string;
  label: string; // article number / colour / name
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  accessoryId: string;
  quantity: string;
  destinationGarmenter: string;
  productId: string;
  dispatchDate: string;
  comments: string;
};

const emptyForm: FormData = {
  accessoryId: "",
  quantity: "",
  destinationGarmenter: "",
  productId: "",
  dispatchDate: new Date().toISOString().slice(0, 10),
  comments: "",
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
        });
      } else {
        setForm({ ...emptyForm });
      }
      setShowDeleteConfirm(false);
      setSuggestionBasis(null);
    }
  }, [open, editingRow]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
    if (!form.accessoryId) {
      toast.error("Accessory is required");
      return;
    }
    if (toNum(form.quantity) === null) {
      toast.error("Quantity is required");
      return;
    }

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[480px] w-full overflow-y-auto border-t-4 border-t-sky-400">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Dispatch" : "New Accessory Dispatch"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit ? "Update dispatch details." : "Record accessories shipped to a garmenter for the current phase."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
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
        </div>

        <SheetFooter>
          <div className={`flex gap-2 ${isEdit ? "" : "flex-col"}`}>
            <Button size="lg" onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : "Recording..."}</>
              ) : (
                isEdit ? "Update Dispatch" : "Record Dispatch"
              )}
            </Button>
            {isEdit && !showDeleteConfirm && (
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || deleting}
                className="flex-1"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
          {isEdit && showDeleteConfirm && (
            <div className="w-full rounded border border-red-200 bg-red-50 p-2 space-y-1.5">
              <p className="text-xs font-medium text-red-800">
                Delete this dispatch? Balance will recalculate.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="flex-1">
                  {deleting ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Deleting...</> : "Yes, Delete"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1">
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
