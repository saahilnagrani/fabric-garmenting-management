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
  createAccessoryPurchase, updateAccessoryPurchase, deleteAccessoryPurchase,
} from "@/actions/accessory-purchases";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { accessoryDisplayName } from "@/lib/accessory-display";

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
};

type AccessoryOption = {
  id: string;
  baseName: string;
  colour: string | null;
  size: string | null;
  unit: string;
  defaultCostPerUnit: number | null;
  vendorId: string | null;
};

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  accessoryId: string;
  vendorId: string;
  quantity: string;
  costPerUnit: string;
  invoiceNumber: string;
  purchaseDate: string;
  comments: string;
};

const emptyForm: FormData = {
  accessoryId: "",
  vendorId: "",
  quantity: "",
  costPerUnit: "",
  invoiceNumber: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  comments: "",
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
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = editingRow !== null;

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm({
          accessoryId: editingRow.accessoryId,
          vendorId: editingRow.vendorId || "",
          quantity: String(editingRow.quantity),
          costPerUnit: editingRow.costPerUnit != null ? String(editingRow.costPerUnit) : "",
          invoiceNumber: editingRow.invoiceNumber || "",
          purchaseDate: editingRow.purchaseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          comments: editingRow.comments || "",
        });
      } else {
        setForm({ ...emptyForm });
      }
      setShowDeleteConfirm(false);
    }
  }, [open, editingRow]);

  // When the user picks an accessory in create mode, prefill cost + vendor from defaults.
  function handleAccessoryChange(id: string) {
    const acc = accessories.find((a) => a.id === id);
    setForm((prev) => ({
      ...prev,
      accessoryId: id,
      vendorId: prev.vendorId || acc?.vendorId || "",
      costPerUnit: prev.costPerUnit || (acc?.defaultCostPerUnit != null ? String(acc.defaultCostPerUnit) : ""),
    }));
  }

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        vendorId: form.vendorId || null,
        quantity: toNum(form.quantity),
        costPerUnit: toNum(form.costPerUnit),
        invoiceNumber: form.invoiceNumber.trim() || null,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate) : null,
        comments: form.comments.trim() || null,
      };
      if (isEdit) {
        await updateAccessoryPurchase(editingRow.id, payload);
        toast.success("Purchase updated");
      } else {
        await createAccessoryPurchase(payload);
        toast.success("Purchase recorded");
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

  const selectedAccessory = accessories.find((a) => a.id === form.accessoryId);
  const total = (toNum(form.quantity) || 0) * (toNum(form.costPerUnit) || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[480px] w-full overflow-y-auto border-t-4 border-t-emerald-400">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Purchase" : "New Accessory Purchase"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit ? "Update purchase details." : "Record a bulk accessory purchase for the current phase."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          <div className="space-y-0.5">
            <Label className="text-[11px]">Accessory *</Label>
            <Combobox
              value={form.accessoryId}
              onValueChange={handleAccessoryChange}
              options={accessories.map((a) => ({
                label: accessoryDisplayName(a),
                value: a.id,
                searchText: `${accessoryDisplayName(a)} ${a.unit}`,
              }))}
              placeholder="Select accessory..."
            />
            {selectedAccessory && (
              <div className="text-[10px] text-muted-foreground italic">
                Unit: {selectedAccessory.unit}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Quantity *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => updateField("quantity", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Cost / unit (Rs)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costPerUnit}
                onChange={(e) => updateField("costPerUnit", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {total > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Line total: ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Vendor</Label>
              <Combobox
                value={form.vendorId}
                onValueChange={(v) => updateField("vendorId", v)}
                options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                placeholder="Select vendor..."
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Purchase Date</Label>
              <Input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => updateField("purchaseDate", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <Label className="text-[11px]">Invoice Number</Label>
            <Input
              value={form.invoiceNumber}
              onChange={(e) => updateField("invoiceNumber", e.target.value)}
              className="h-8 text-xs"
            />
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
                isEdit ? "Update Purchase" : "Record Purchase"
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
                Delete this purchase permanently? Balance will recalculate.
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
