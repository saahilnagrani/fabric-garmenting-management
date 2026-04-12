"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  createAccessoryMaster, updateAccessoryMaster, deleteAccessoryMaster,
  bulkCreateAccessoryMasters,
} from "@/actions/accessories";
import { CATEGORIES, getCategoryConfig, type AttributeField } from "@/lib/accessory-categories";
import { toast } from "sonner";
import { Loader2, Archive, Trash2, Plus, X } from "lucide-react";

const UNIT_OPTIONS = ["PIECES", "METERS", "KG", "GRAMS", "ROLLS", "PACKS"] as const;

export type AccessoryMasterRow = {
  id: string;
  displayName: string;
  category: string;
  attributes: Record<string, unknown>;
  priceTiers: unknown[];
  vendorPageRef: string | null;
  unit: string;
  vendorId: string | null;
  defaultCostPerUnit: number | null;
  hsnCode: string | null;
  comments: string | null;
  isStrikedThrough: boolean;
  // Legacy (nullable now)
  baseName: string | null;
  colour: string | null;
  size: string | null;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };

type PriceTierRow = { minQty: string; maxQty: string; rate: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  category: string;
  unit: string;
  vendorId: string;
  vendorPageRef: string;
  defaultCostPerUnit: string;
  hsnCode: string;
  comments: string;
  attributes: Record<string, string>;
  priceTiers: PriceTierRow[];
};

const emptyForm: FormData = {
  category: "",
  unit: "PIECES",
  vendorId: "",
  vendorPageRef: "",
  defaultCostPerUnit: "",
  hsnCode: "",
  comments: "",
  attributes: {},
  priceTiers: [],
};

function rowToForm(row: AccessoryMasterRow): FormData {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.attributes ?? {})) {
    if (v == null) continue;
    attrs[k] = String(v);
  }
  const tiers: PriceTierRow[] = (row.priceTiers ?? []).map((t) => {
    const tier = t as { minQty?: number; maxQty?: number; rate?: number };
    return {
      minQty: tier.minQty != null ? String(tier.minQty) : "",
      maxQty: tier.maxQty != null ? String(tier.maxQty) : "",
      rate: tier.rate != null ? String(tier.rate) : "",
    };
  });
  return {
    category: row.category,
    unit: row.unit,
    vendorId: row.vendorId || "",
    vendorPageRef: row.vendorPageRef || "",
    defaultCostPerUnit: row.defaultCostPerUnit != null ? String(row.defaultCostPerUnit) : "",
    hsnCode: row.hsnCode || "",
    comments: row.comments || "",
    attributes: attrs,
    priceTiers: tiers,
  };
}

export function AccessoryMasterSheet({
  open,
  onOpenChange,
  editingRow,
  vendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: AccessoryMasterRow | null;
  vendors: Vendor[];
  categories?: string[];  // legacy prop, kept for backwards compat
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const isEdit = editingRow !== null;

  useEffect(() => {
    if (open) {
      if (editingRow) setForm(rowToForm(editingRow));
      else setForm({ ...emptyForm });
      setShowDeleteConfirm(false);
      setBulkMode(false);
      setBulkText("");
    }
  }, [open, editingRow]);

  const categoryConfig = useMemo(() => getCategoryConfig(form.category), [form.category]);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateAttribute(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }));
  }

  function addTier() {
    setForm((prev) => ({
      ...prev,
      priceTiers: [...prev.priceTiers, { minQty: "", maxQty: "", rate: "" }],
    }));
  }

  function updateTier(idx: number, patch: Partial<PriceTierRow>) {
    setForm((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }

  function removeTier(idx: number) {
    setForm((prev) => ({
      ...prev,
      priceTiers: prev.priceTiers.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit() {
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!categoryConfig) {
      toast.error(`Unknown category: ${form.category}`);
      return;
    }

    // Coerce attribute values based on field type. Number fields become actual
    // numbers; strings stay as-is. Empty strings are dropped by the server.
    const attributes: Record<string, unknown> = {};
    for (const field of categoryConfig.fields) {
      const raw = form.attributes[field.key];
      if (raw == null || raw === "") continue;
      if (field.type === "number") {
        const n = toNum(raw);
        if (n !== null) attributes[field.key] = n;
      } else {
        attributes[field.key] = raw.trim();
      }
    }
    // Check at least one identifying attribute was provided
    const hasAny = Object.keys(attributes).length > 0;
    if (!hasAny) {
      toast.error("Fill in at least one field to identify the variant");
      return;
    }

    // Validate required fields
    for (const field of categoryConfig.fields) {
      if (field.required && (attributes[field.key] == null || attributes[field.key] === "")) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    // Validate and clean price tiers
    const tiers: Array<{ minQty: number; maxQty?: number; rate: number }> = [];
    for (let i = 0; i < form.priceTiers.length; i++) {
      const t = form.priceTiers[i];
      const blank = !t.minQty && !t.maxQty && !t.rate;
      if (blank) continue;
      const minQty = toNum(t.minQty);
      const rate = toNum(t.rate);
      if (minQty === null || minQty < 0) {
        toast.error(`Tier ${i + 1}: min qty is required and must be >= 0`);
        return;
      }
      if (rate === null || rate < 0) {
        toast.error(`Tier ${i + 1}: rate is required and must be >= 0`);
        return;
      }
      const maxQty = toNum(t.maxQty);
      tiers.push({ minQty, ...(maxQty != null ? { maxQty } : {}), rate });
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateAccessoryMaster(editingRow.id, {
          category: form.category.trim(),
          attributes,
          priceTiers: tiers,
          vendorPageRef: form.vendorPageRef.trim() || null,
          unit: form.unit,
          vendorId: form.vendorId || null,
          defaultCostPerUnit: toNum(form.defaultCostPerUnit),
          hsnCode: form.hsnCode.trim() || null,
          comments: form.comments.trim() || null,
        });
        toast.success("Accessory updated");
      } else {
        await createAccessoryMaster({
          category: form.category.trim(),
          attributes,
          priceTiers: tiers,
          vendorPageRef: form.vendorPageRef.trim() || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unit: form.unit as any,
          vendorId: form.vendorId || null,
          defaultCostPerUnit: toNum(form.defaultCostPerUnit),
          hsnCode: form.hsnCode.trim() || null,
          comments: form.comments.trim() || null,
        });
        toast.success("Accessory created");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Parse the bulk-paste textarea and create all rows in one transaction.
   * Each line is split by comma or tab. Columns map to the category's fields
   * in order (matching categoryConfig.fields).
   */
  async function handleBulkSubmit() {
    if (!form.category.trim()) {
      toast.error("Pick a category first");
      return;
    }
    if (!categoryConfig) {
      toast.error(`Unknown category: ${form.category}`);
      return;
    }

    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      toast.error("Paste at least one line");
      return;
    }

    const fieldKeys = categoryConfig.fields.map((f) => f.key);

    const rows: Array<{ attributes: Record<string, unknown> }> = [];
    for (let i = 0; i < lines.length; i++) {
      // Split by tab first, fall back to comma
      const parts = lines[i].includes("\t")
        ? lines[i].split("\t").map((p) => p.trim())
        : lines[i].split(",").map((p) => p.trim());
      const attributes: Record<string, unknown> = {};
      for (let j = 0; j < fieldKeys.length && j < parts.length; j++) {
        const val = parts[j];
        if (val) {
          const field = categoryConfig.fields[j];
          if (field.type === "number") {
            const n = Number(val);
            if (!isNaN(n)) attributes[fieldKeys[j]] = n;
          } else {
            attributes[fieldKeys[j]] = val;
          }
        }
      }
      if (Object.keys(attributes).length === 0) {
        toast.error(`Line ${i + 1} is empty after parsing`);
        return;
      }
      rows.push({ attributes });
    }

    setSubmitting(true);
    try {
      const created = await bulkCreateAccessoryMasters(
        {
          category: form.category.trim(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unit: form.unit as any,
          vendorId: form.vendorId || null,
          vendorPageRef: form.vendorPageRef.trim() || null,
          defaultCostPerUnit: toNum(form.defaultCostPerUnit),
          hsnCode: form.hsnCode.trim() || null,
          comments: form.comments.trim() || null,
          priceTiers: form.priceTiers
            .filter((t) => t.minQty && t.rate)
            .map((t) => ({
              minQty: Number(t.minQty),
              ...(t.maxQty ? { maxQty: Number(t.maxQty) } : {}),
              rate: Number(t.rate),
            })),
        },
        rows
      );
      toast.success(`Created ${created.length} accessor${created.length === 1 ? "y" : "ies"}`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk create failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Count parsed lines for the bulk preview
  const bulkLineCount = bulkText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;

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
      <SheetContent side="right" className="max-w-[560px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm">{isEdit ? "Edit Accessory" : "New Accessory"}</SheetTitle>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 px-1.5 py-0.5 rounded">Master</span>
          </div>
          <SheetDescription className="text-[11px]">
            Pick a category to see its variant fields. The display name is
            composed from whatever you fill in.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {/* Category picker */}
          <div className="space-y-0.5">
            <Label className="text-[11px]">Category *</Label>
            <Select value={form.category} onValueChange={(v) => updateField("category", v ?? "")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryConfig?.description && (
              <p className="text-[10px] text-muted-foreground">{categoryConfig.description}</p>
            )}
          </div>

          {/* Dynamic attribute fields based on category */}
          {categoryConfig && !bulkMode && (
            <div className="border border-border rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Variant attributes
                </div>
                {!isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setBulkMode(true)}
                  >
                    Bulk Add
                  </Button>
                )}
              </div>
              {(() => {
                // Split fields into "text/descriptive" (first row, 2-col)
                // and "measurement/select" (second row, equal-width columns).
                // Text fields = type "text" without options. Everything else
                // (number fields, select fields) goes in the compact row.
                const textFields = categoryConfig.fields.filter(
                  (f) => f.type === "text" && !f.options
                );
                const compactFields = categoryConfig.fields.filter(
                  (f) => f.type !== "text" || !!f.options
                );
                return (
                  <>
                    {textFields.length > 0 && (
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${textFields.length}, 1fr)` }}>
                        {textFields.map((field) => (
                          <AttributeInput
                            key={field.key}
                            field={field}
                            value={form.attributes[field.key] ?? ""}
                            onChange={(v) => updateAttribute(field.key, v)}
                          />
                        ))}
                      </div>
                    )}
                    {compactFields.length > 0 && (
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${compactFields.length}, 1fr)` }}>
                        {compactFields.map((field) => (
                          <AttributeInput
                            key={field.key}
                            field={field}
                            value={form.attributes[field.key] ?? ""}
                            onChange={(v) => updateAttribute(field.key, v)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Bulk paste mode */}
          {categoryConfig && bulkMode && !isEdit && (
            <div className="border border-border rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Bulk add ({bulkLineCount} row{bulkLineCount === 1 ? "" : "s"})
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setBulkMode(false)}
                >
                  Single mode
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Paste one accessory per line, columns separated by comma or tab.
                Column order: <strong>{categoryConfig.fields.map((f) => f.label).join(", ")}</strong>.
                All rows share the category, unit, vendor, cost, and tiers set above.
              </p>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={categoryConfig.fields.map((f) => f.label).join(", ") + "\ne.g. " + categoryConfig.fields.map((f) => {
                  if (f.type === "number") return "10";
                  if (f.options?.length) return f.options[0];
                  return f.label;
                }).join(", ")}
                className="min-h-[120px] text-xs font-mono resize-y"
                rows={8}
              />
            </div>
          )}

          {/* Purchase details */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Unit *</Label>
              <Select value={form.unit} onValueChange={(v) => updateField("unit", v ?? "PIECES")}>
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
              <Label className="text-[11px]">Catalog ref</Label>
              <Input
                value={form.vendorPageRef}
                onChange={(e) => updateField("vendorPageRef", e.target.value)}
                placeholder="Page 2, Item 4"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Default Cost (Rs)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.defaultCostPerUnit}
                onChange={(e) => updateField("defaultCostPerUnit", e.target.value)}
                className="h-8 text-xs"
                placeholder="Fallback when no tier matches"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">HSN Code</Label>
              <Input
                value={form.hsnCode}
                onChange={(e) => updateField("hsnCode", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Price tiers */}
          <div className="border border-border rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                Price Tiers (Rs / unit at quantity)
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-1.5"
                onClick={addTier}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add tier
              </Button>
            </div>
            {form.priceTiers.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No tiers. Purchases will use the default cost above.
              </p>
            ) : (
              form.priceTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="grid gap-1.5 items-center"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 24px" }}
                >
                  <Input
                    type="number"
                    placeholder="Min qty"
                    value={tier.minQty}
                    onChange={(e) => updateTier(idx, { minQty: e.target.value })}
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Max qty (opt)"
                    value={tier.maxQty}
                    onChange={(e) => updateTier(idx, { maxQty: e.target.value })}
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={tier.rate}
                    onChange={(e) => updateTier(idx, { rate: e.target.value })}
                    className="h-7 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-6 p-0"
                    onClick={() => removeTier(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
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
            <Button
              size="lg"
              onClick={bulkMode ? handleBulkSubmit : handleSubmit}
              disabled={submitting || archiving}
              className="flex-1"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : bulkMode ? `Creating ${bulkLineCount}...` : "Creating..."}</>
              ) : (
                isEdit ? "Update Accessory" : bulkMode ? `Create ${bulkLineCount} Accessor${bulkLineCount === 1 ? "y" : "ies"}` : "Create Accessory"
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
            <div className="w-full rounded border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-2 space-y-1.5">
              <p className="text-xs font-medium text-red-800 dark:text-red-200">
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

function AttributeInput({
  field,
  value,
  onChange,
}: {
  field: AttributeField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px]">
        {field.label}
        {field.unit && <span className="text-muted-foreground"> ({field.unit})</span>}
        {field.required && <span className="text-red-500"> *</span>}
      </Label>
      {field.type === "select" ? (
        <Select
          value={value || "__none__"}
          onValueChange={(v) => onChange(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="(none)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(none)</SelectItem>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={field.type === "number" ? "number" : "text"}
          step={field.type === "number" ? "0.01" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      )}
      {field.helper && <p className="text-[10px] text-muted-foreground italic">{field.helper}</p>}
    </div>
  );
}
