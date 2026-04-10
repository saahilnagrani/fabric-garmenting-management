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
  createAccessoryMasters, updateAccessoryMaster, deleteAccessoryMaster,
} from "@/actions/accessories";
import { toast } from "sonner";
import { Loader2, Archive, Trash2 } from "lucide-react";

const UNIT_OPTIONS = ["PIECES", "METERS", "KG", "GRAMS", "ROLLS", "PACKS"] as const;

export type AccessoryMasterRow = {
  id: string;
  baseName: string;
  colour: string | null;
  size: string | null;
  category: string;
  unit: string;
  vendorId: string | null;
  defaultCostPerUnit: number | null;
  hsnCode: string | null;
  comments: string | null;
  isStrikedThrough: boolean;
  displayName: string;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseCsv(s: string): string[] {
  return s.split(",").map((p) => p.trim()).filter(Boolean);
}

type FormData = {
  baseName: string;
  category: string;
  unit: string;
  vendorId: string;
  defaultCostPerUnit: string;
  hsnCode: string;
  comments: string;
  // Edit-mode single-row fields
  colour: string;
  size: string;
  // Create-mode multi-axis comma-separated fields
  coloursCsv: string;
  sizesCsv: string;
};

const emptyForm: FormData = {
  baseName: "",
  category: "",
  unit: "PIECES",
  vendorId: "",
  defaultCostPerUnit: "",
  hsnCode: "",
  comments: "",
  colour: "",
  size: "",
  coloursCsv: "",
  sizesCsv: "",
};

function rowToForm(row: AccessoryMasterRow): FormData {
  return {
    baseName: row.baseName,
    category: row.category,
    unit: row.unit,
    vendorId: row.vendorId || "",
    defaultCostPerUnit: row.defaultCostPerUnit != null ? String(row.defaultCostPerUnit) : "",
    hsnCode: row.hsnCode || "",
    comments: row.comments || "",
    colour: row.colour || "",
    size: row.size || "",
    coloursCsv: "",
    sizesCsv: "",
  };
}

export function AccessoryMasterSheet({
  open,
  onOpenChange,
  editingRow,
  vendors,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: AccessoryMasterRow | null;
  vendors: Vendor[];
  categories: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = editingRow !== null;

  useEffect(() => {
    if (open) {
      if (editingRow) setForm(rowToForm(editingRow));
      else setForm({ ...emptyForm });
      setShowDeleteConfirm(false);
    }
  }, [open, editingRow]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.baseName.trim()) {
      toast.error("Base name is required");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const payload = {
          baseName: form.baseName.trim(),
          category: form.category.trim(),
          unit: form.unit,
          vendorId: form.vendorId || null,
          defaultCostPerUnit: toNum(form.defaultCostPerUnit),
          hsnCode: form.hsnCode.trim() || null,
          comments: form.comments.trim() || null,
          colour: form.colour.trim() || null,
          size: form.size.trim() || null,
        };
        await updateAccessoryMaster(editingRow.id, payload);
        toast.success("Accessory updated");
      } else {
        const colours = parseCsv(form.coloursCsv);
        const sizes = parseCsv(form.sizesCsv);
        const created = await createAccessoryMasters({
          baseName: form.baseName.trim(),
          category: form.category.trim(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unit: form.unit as any,
          vendorId: form.vendorId || null,
          defaultCostPerUnit: toNum(form.defaultCostPerUnit),
          hsnCode: form.hsnCode.trim() || null,
          comments: form.comments.trim() || null,
          colours,
          sizes,
        });
        toast.success(`Created ${created.length} variant${created.length === 1 ? "" : "s"}`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  const isArchived = editingRow?.isStrikedThrough === true;

  async function handleArchive() {
    if (!editingRow) return;
    setArchiving(true);
    try {
      await updateAccessoryMaster(editingRow.id, { isStrikedThrough: !isArchived });
      toast.success(isArchived ? "Accessory unarchived" : "Accessory archived");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Archive failed");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!editingRow) return;
    setDeleting(true);
    try {
      await deleteAccessoryMaster(editingRow.id);
      toast.success("Accessory deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm">{isEdit ? "Edit Accessory" : "New Accessory"}</SheetTitle>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Master</span>
          </div>
          <SheetDescription className="text-[11px]">
            {isEdit
              ? "Single-row edit. Variant axes can be changed individually."
              : "Pick base name + multi-select colours/sizes to bulk-create variants in one go."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {/* Identity */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Base Name *</Label>
                <Input
                  value={form.baseName}
                  onChange={(e) => updateField("baseName", e.target.value)}
                  autoFocus
                  className="h-8 text-xs"
                  placeholder="e.g. Zipper YKK #5"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Category *</Label>
                <Input
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  placeholder="e.g. Zipper, Drawstring, Bra Pad"
                  list="accessory-categories"
                  className="h-8 text-xs"
                />
                <datalist id="accessory-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Unit *</Label>
                <Select value={form.unit} onValueChange={(v) => updateField("unit", v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Label className="text-[11px]">Default Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.defaultCostPerUnit}
                  onChange={(e) => updateField("defaultCostPerUnit", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">HSN Code</Label>
                <Input
                  value={form.hsnCode}
                  onChange={(e) => updateField("hsnCode", e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Variant axes */}
          {isEdit ? (
            <div className="border border-gray-200 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Variant
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Colour</Label>
                  <Input
                    value={form.colour}
                    onChange={(e) => updateField("colour", e.target.value)}
                    placeholder="(none)"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[11px]">Size</Label>
                  <Input
                    value={form.size}
                    onChange={(e) => updateField("size", e.target.value)}
                    placeholder="(none)"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded p-2 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Variants (comma-separated, leave blank if not applicable)
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Colours</Label>
                <Input
                  value={form.coloursCsv}
                  onChange={(e) => updateField("coloursCsv", e.target.value)}
                  placeholder="e.g. Red, Black, White"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Sizes</Label>
                <Input
                  value={form.sizesCsv}
                  onChange={(e) => updateField("sizesCsv", e.target.value)}
                  placeholder="e.g. 15cm, 20cm, 25cm"
                  className="h-8 text-xs"
                />
              </div>
              <div className="text-[10px] text-muted-foreground italic">
                Will create {Math.max(parseCsv(form.coloursCsv).length, 1)} × {Math.max(parseCsv(form.sizesCsv).length, 1)} = {Math.max(parseCsv(form.coloursCsv).length, 1) * Math.max(parseCsv(form.sizesCsv).length, 1)} row{Math.max(parseCsv(form.coloursCsv).length, 1) * Math.max(parseCsv(form.sizesCsv).length, 1) === 1 ? "" : "s"}.
              </div>
            </div>
          )}

          {/* Comments */}
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
            <Button size="lg" onClick={handleSubmit} disabled={submitting || archiving} className="flex-1">
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : "Creating..."}</>
              ) : (
                isEdit ? "Update Accessory" : "Create Accessory"
              )}
            </Button>
            {isEdit && (
              <Button variant="outline" size="lg" onClick={handleArchive} disabled={submitting || archiving} className="flex-1">
                {archiving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isArchived ? "Unarchiving..." : "Archiving..."}</>
                ) : (
                  <><Archive className="mr-2 h-4 w-4" />{isArchived ? "Unarchive" : "Archive"}</>
                )}
              </Button>
            )}
            {isEdit && !showDeleteConfirm && (
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || archiving || deleting}
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
                Delete this accessory permanently? This cannot be undone.
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
