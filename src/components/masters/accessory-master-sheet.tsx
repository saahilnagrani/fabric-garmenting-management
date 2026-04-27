"use client";

import React, { useState, useEffect, useRef } from "react";
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
  createAccessoryMastersTyped, updateAccessoryMaster, deleteAccessoryMaster,
} from "@/actions/accessories";
import { CATEGORIES } from "@/lib/accessory-categories";
import { toast } from "sonner";
import { Loader2, Archive, Trash2, Plus, X, ImageIcon } from "lucide-react";

const UNIT_OPTIONS = ["PIECES", "METERS", "KG", "GRAMS", "ROLLS", "PACKS"] as const;

export type AccessoryMasterRow = {
  id: string;
  displayName: string;
  category: string;
  attributes: Record<string, unknown>;
  priceTiers: unknown[];
  unit: string;
  vendorId: string | null;
  defaultCostPerUnit: number | null;
  hsnCode: string | null;
  comments: string | null;
  imageUrl: string | null;
  articleCodeUnits: Array<{ code: string; units: number }>;
  isStrikedThrough: boolean;
  baseName: string | null;
  colour: string | null;
  size: string | null;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };

type ArticleCodeRow = { code: string; units: string };

type TypeRow = {
  name: string;
  defaultCostPerUnit: string;
  imageUrl: string | null;    // base64 data URL
  imageName: string | null;   // original filename for display
  articleCodeUnits: ArticleCodeRow[];
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function emptyTypeRow(): TypeRow {
  return { name: "", defaultCostPerUnit: "", imageUrl: null, imageName: null, articleCodeUnits: [] };
}

// Shared form state (category, vendor, unit, etc.)
type SharedForm = {
  category: string;
  unit: string;
  vendorId: string;
  hsnCode: string;
  comments: string;
};

const emptyShared: SharedForm = {
  category: "",
  unit: "PIECES",
  vendorId: "",
  hsnCode: "",
  comments: "",
};

// Edit form (single row)
type EditForm = SharedForm & {
  name: string;
  defaultCostPerUnit: string;
  imageUrl: string | null;
  imageName: string | null;
  articleCodeUnits: ArticleCodeRow[];
};

function rowToEditForm(row: AccessoryMasterRow): EditForm {
  const attrName = typeof row.attributes?.name === "string" ? row.attributes.name : null;
  return {
    category: row.category,
    name: attrName || row.displayName,
    unit: row.unit,
    vendorId: row.vendorId || "",
    hsnCode: row.hsnCode || "",
    comments: row.comments || "",
    defaultCostPerUnit: row.defaultCostPerUnit != null ? String(row.defaultCostPerUnit) : "",
    imageUrl: row.imageUrl || null,
    imageName: row.imageUrl ? "Existing image" : null,
    articleCodeUnits: (row.articleCodeUnits ?? []).map((a) => ({
      code: a.code,
      units: String(a.units),
    })),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type ArticleCodeOption = { value: string; label: string };

export function AccessoryMasterSheet({
  open,
  onOpenChange,
  editingRow,
  vendors,
  articleCodes = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: AccessoryMasterRow | null;
  vendors: Vendor[];
  categories?: string[];
  articleCodes?: ArticleCodeOption[];
}) {
  const router = useRouter();
  const isEdit = editingRow !== null;

  // Create mode state
  const [shared, setShared] = useState<SharedForm>({ ...emptyShared });
  const [typeRows, setTypeRows] = useState<TypeRow[]>([emptyTypeRow()]);

  // Edit mode state
  const [editForm, setEditForm] = useState<EditForm>({
    ...emptyShared, name: "", defaultCostPerUnit: "", imageUrl: null, imageName: null, articleCodeUnits: [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setEditForm(rowToEditForm(editingRow));
      } else {
        setShared({ ...emptyShared });
        setTypeRows([emptyTypeRow()]);
      }
      setShowDeleteConfirm(false);
    }
  }, [open, editingRow]);

  // ── Shared field helpers ──────────────────────────────────────────
  function updateShared<K extends keyof SharedForm>(field: K, value: SharedForm[K]) {
    setShared((prev) => ({ ...prev, [field]: value }));
  }

  // ── Type-row helpers (create mode) ───────────────────────────────
  function addTypeRow() {
    setTypeRows((prev) => [...prev, emptyTypeRow()]);
  }

  function removeTypeRow(idx: number) {
    setTypeRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  function updateTypeRow(idx: number, patch: Partial<TypeRow>) {
    setTypeRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  async function handleImageUpload(idx: number, file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      updateTypeRow(idx, { imageUrl: dataUrl, imageName: file.name });
    } catch {
      toast.error("Failed to load image");
    }
  }

  async function handleEditImageUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2 MB");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setEditForm((prev) => ({ ...prev, imageUrl: dataUrl, imageName: file.name }));
    } catch {
      toast.error("Failed to load image");
    }
  }

  function addArticleRow(typeIdx: number) {
    updateTypeRow(typeIdx, {
      articleCodeUnits: [...typeRows[typeIdx].articleCodeUnits, { code: "", units: "" }],
    });
  }

  function updateArticleRow(typeIdx: number, artIdx: number, patch: Partial<ArticleCodeRow>) {
    const updated = typeRows[typeIdx].articleCodeUnits.map((r, i) =>
      i === artIdx ? { ...r, ...patch } : r
    );
    updateTypeRow(typeIdx, { articleCodeUnits: updated });
  }

  function removeArticleRow(typeIdx: number, artIdx: number) {
    const updated = typeRows[typeIdx].articleCodeUnits.filter((_, i) => i !== artIdx);
    updateTypeRow(typeIdx, { articleCodeUnits: updated });
  }

  // ── Edit-mode article helpers ─────────────────────────────────────
  function addEditArticleRow() {
    setEditForm((prev) => ({
      ...prev,
      articleCodeUnits: [...prev.articleCodeUnits, { code: "", units: "" }],
    }));
  }

  function updateEditArticleRow(idx: number, patch: Partial<ArticleCodeRow>) {
    setEditForm((prev) => ({
      ...prev,
      articleCodeUnits: prev.articleCodeUnits.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }));
  }

  function removeEditArticleRow(idx: number) {
    setEditForm((prev) => ({
      ...prev,
      articleCodeUnits: prev.articleCodeUnits.filter((_, i) => i !== idx),
    }));
  }

  // ── Validate & clean article codes ───────────────────────────────
  function cleanArticleCodes(rows: ArticleCodeRow[]): Array<{ code: string; units: number }> | null {
    const out: Array<{ code: string; units: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const code = rows[i].code.trim();
      const units = toNum(rows[i].units);
      if (!code && units === null) continue;
      if (!code) { toast.error(`Article code row ${i + 1}: code is required`); return null; }
      if (units === null || units <= 0) { toast.error(`Article code row ${i + 1}: units must be > 0`); return null; }
      out.push({ code, units });
    }
    return out;
  }

  // ── Submit (create) ───────────────────────────────────────────────
  async function handleCreate() {
    if (!shared.category.trim()) { toast.error("Category is required"); return; }

    const entries: Array<{
      name: string;
      defaultCostPerUnit: number | null;
      imageUrl: string | null;
      articleCodeUnits: Array<{ code: string; units: number }>;
    }> = [];

    for (let i = 0; i < typeRows.length; i++) {
      const row = typeRows[i];
      const name = row.name.trim();
      if (!name) { toast.error(`Type ${i + 1}: name is required`); return; }
      const cost = toNum(row.defaultCostPerUnit);
      const articleCodeUnits = cleanArticleCodes(row.articleCodeUnits);
      if (articleCodeUnits === null) return;
      entries.push({ name, defaultCostPerUnit: cost, imageUrl: row.imageUrl, articleCodeUnits });
    }

    setSubmitting(true);
    try {
      const created = await createAccessoryMastersTyped(
        {
          category: shared.category.trim(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unit: shared.unit as any,
          vendorId: shared.vendorId || null,
          hsnCode: shared.hsnCode.trim() || null,
          comments: shared.comments.trim() || null,
        },
        entries
      );
      toast.success(`Created ${created.length} accessor${created.length === 1 ? "y" : "ies"}`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit (edit) ─────────────────────────────────────────────────
  async function handleUpdate() {
    if (!editForm.category.trim()) { toast.error("Category is required"); return; }
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    const articleCodeUnits = cleanArticleCodes(editForm.articleCodeUnits);
    if (articleCodeUnits === null) return;

    setSubmitting(true);
    try {
      await updateAccessoryMaster(editingRow!.id, {
        category: editForm.category.trim(),
        name: editForm.name.trim(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unit: editForm.unit as any,
        vendorId: editForm.vendorId || null,
        imageUrl: editForm.imageUrl || null,
        defaultCostPerUnit: toNum(editForm.defaultCostPerUnit),
        hsnCode: editForm.hsnCode.trim() || null,
        comments: editForm.comments.trim() || null,
        articleCodeUnits,
      });
      toast.success("Accessory updated");
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
      <SheetContent side="right" className="max-w-[600px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm">{isEdit ? "Edit Accessory" : "New Accessories"}</SheetTitle>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 px-1.5 py-0.5 rounded">Master</span>
          </div>
          <SheetDescription className="text-[11px]">
            {isEdit
              ? "Edit this accessory type."
              : "Select a category and add one or more types. Each type becomes its own DB row."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {isEdit ? (
            <EditModeForm
              form={editForm}
              vendors={vendors}
              articleCodes={articleCodes}
              onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
              onImageUpload={handleEditImageUpload}
              onAddArticle={addEditArticleRow}
              onUpdateArticle={updateEditArticleRow}
              onRemoveArticle={removeEditArticleRow}
            />
          ) : (
            <CreateModeForm
              shared={shared}
              typeRows={typeRows}
              vendors={vendors}
              articleCodes={articleCodes}
              onSharedChange={updateShared}
              onAddType={addTypeRow}
              onRemoveType={removeTypeRow}
              onUpdateType={updateTypeRow}
              onImageUpload={handleImageUpload}
              onAddArticle={addArticleRow}
              onUpdateArticle={updateArticleRow}
              onRemoveArticle={removeArticleRow}
            />
          )}
        </div>

        <SheetFooter>
          <div className={`flex gap-2 ${isEdit ? "flex-wrap" : "flex-col"}`}>
            <Button
              size="lg"
              onClick={isEdit ? handleUpdate : handleCreate}
              disabled={submitting || archiving}
              className="flex-1"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? "Updating..." : "Creating..."}</>
              ) : (
                isEdit
                  ? "Update Accessory"
                  : `Create ${typeRows.length} Accessor${typeRows.length === 1 ? "y" : "ies"}`
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

// ─── Shared section (category, vendor, unit, HSN) ────────────────────────────

function SharedFields({
  shared,
  vendors,
  onChange,
}: {
  shared: { category: string; unit: string; vendorId: string; hsnCode: string; comments: string };
  vendors: { id: string; name: string }[];
  onChange: (patch: Partial<typeof shared>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px]">Category *</Label>
          <Select value={shared.category} onValueChange={(v) => onChange({ category: v ?? "" })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px]">Unit *</Label>
          <Select value={shared.unit} onValueChange={(v) => onChange({ unit: v ?? "PIECES" })}>
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
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px]">Vendor</Label>
          <Combobox
            value={shared.vendorId}
            onValueChange={(v) => onChange({ vendorId: v })}
            options={vendors.map((v) => ({ label: v.name, value: v.id }))}
            placeholder="Select vendor..."
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px]">HSN Code</Label>
          <Input
            value={shared.hsnCode}
            onChange={(e) => onChange({ hsnCode: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Article codes sub-table ─────────────────────────────────────────────────

function ArticleCodesSection({
  rows,
  articleCodes,
  onAdd,
  onUpdate,
  onRemove,
}: {
  rows: ArticleCodeRow[];
  articleCodes: ArticleCodeOption[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<ArticleCodeRow>) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
          Article Codes
        </span>
        <Button type="button" variant="outline" size="sm" className="h-5 text-[10px] px-1" onClick={onAdd}>
          <Plus className="h-2.5 w-2.5 mr-0.5" />Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No article codes yet.</p>
      ) : (
        rows.map((row, idx) => (
          <div key={idx} className="grid gap-1 items-center" style={{ gridTemplateColumns: "1fr 80px 20px" }}>
            <Combobox
              value={row.code}
              onValueChange={(v) => onUpdate(idx, { code: v })}
              options={articleCodes}
              placeholder="Search article..."
            />
            <Input
              type="number"
              step="0.01"
              value={row.units}
              onChange={(e) => onUpdate(idx, { units: e.target.value })}
              className="h-6 text-[11px]"
              placeholder="qty"
            />
            <Button type="button" variant="ghost" size="sm" className="h-6 w-5 p-0" onClick={() => onRemove(idx)}>
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Image upload button ──────────────────────────────────────────────────────

function ImageUploadButton({
  imageUrl,
  imageName,
  onUpload,
  onClear,
}: {
  imageUrl: string | null;
  imageName: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-0.5">
      <Label className="text-[11px]">Image</Label>
      <div className="flex flex-col gap-1.5">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="preview" className="w-full max-h-56 rounded border border-border object-contain bg-muted" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{imageName}</span>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2"
                  onClick={() => inputRef.current?.click()}>
                  Replace
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-red-500" onClick={onClear}>
                  Remove
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] px-2"
            onClick={() => inputRef.current?.click()}
          >
            <ImageIcon className="h-3 w-3 mr-1" />
            Upload image
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ─── Create mode form ─────────────────────────────────────────────────────────

function CreateModeForm({
  shared,
  typeRows,
  vendors,
  articleCodes,
  onSharedChange,
  onAddType,
  onRemoveType,
  onUpdateType,
  onImageUpload,
  onAddArticle,
  onUpdateArticle,
  onRemoveArticle,
}: {
  shared: SharedForm;
  typeRows: TypeRow[];
  vendors: { id: string; name: string }[];
  articleCodes: ArticleCodeOption[];
  onSharedChange: <K extends keyof SharedForm>(field: K, value: SharedForm[K]) => void;
  onAddType: () => void;
  onRemoveType: (idx: number) => void;
  onUpdateType: (idx: number, patch: Partial<TypeRow>) => void;
  onImageUpload: (idx: number, file: File) => void;
  onAddArticle: (typeIdx: number) => void;
  onUpdateArticle: (typeIdx: number, artIdx: number, patch: Partial<ArticleCodeRow>) => void;
  onRemoveArticle: (typeIdx: number, artIdx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <SharedFields
        shared={shared}
        vendors={vendors}
        onChange={(patch) => {
          for (const [k, v] of Object.entries(patch)) {
            onSharedChange(k as keyof SharedForm, v as SharedForm[keyof SharedForm]);
          }
        }}
      />

      {/* Type rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
            Types ({typeRows.length})
          </div>
          <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={onAddType}>
            <Plus className="h-3 w-3 mr-1" />
            Add type
          </Button>
        </div>

        {typeRows.map((row, idx) => (
          <div key={idx} className="border border-border rounded p-2.5 space-y-2 relative">
            {typeRows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1.5 right-1.5 h-5 w-5 p-0 text-muted-foreground"
                onClick={() => onRemoveType(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            <p className="text-[10px] font-medium text-muted-foreground">Type {idx + 1}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Name *</Label>
                <Input
                  value={row.name}
                  onChange={(e) => onUpdateType(idx, { name: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="e.g. Horn Button 4-hole Navy"
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Cost (Rs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={row.defaultCostPerUnit}
                  onChange={(e) => onUpdateType(idx, { defaultCostPerUnit: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="per unit"
                />
              </div>
            </div>

            <ImageUploadButton
              imageUrl={row.imageUrl}
              imageName={row.imageName}
              onUpload={(file) => onImageUpload(idx, file)}
              onClear={() => onUpdateType(idx, { imageUrl: null, imageName: null })}
            />

            <ArticleCodesSection
              rows={row.articleCodeUnits}
              articleCodes={articleCodes}
              onAdd={() => onAddArticle(idx)}
              onUpdate={(artIdx, patch) => onUpdateArticle(idx, artIdx, patch)}
              onRemove={(artIdx) => onRemoveArticle(idx, artIdx)}
            />
          </div>
        ))}
      </div>

      <div className="space-y-0.5">
        <Label className="text-[11px]">Comments</Label>
        <Textarea
          value={shared.comments}
          onChange={(e) => onSharedChange("comments", e.target.value)}
          className="min-h-[50px] resize-none text-xs"
        />
      </div>
    </div>
  );
}

// ─── Edit mode form ───────────────────────────────────────────────────────────

function EditModeForm({
  form,
  vendors,
  articleCodes,
  onChange,
  onImageUpload,
  onAddArticle,
  onUpdateArticle,
  onRemoveArticle,
}: {
  form: EditForm;
  vendors: { id: string; name: string }[];
  articleCodes: ArticleCodeOption[];
  onChange: (patch: Partial<EditForm>) => void;
  onImageUpload: (file: File) => void;
  onAddArticle: () => void;
  onUpdateArticle: (idx: number, patch: Partial<ArticleCodeRow>) => void;
  onRemoveArticle: (idx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <SharedFields
        shared={form}
        vendors={vendors}
        onChange={(patch) => onChange(patch)}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px]">Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-8 text-xs"
            placeholder="e.g. Horn Button 4-hole Navy"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px]">Cost (Rs)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.defaultCostPerUnit}
            onChange={(e) => onChange({ defaultCostPerUnit: e.target.value })}
            className="h-8 text-xs"
            placeholder="per unit"
          />
        </div>
      </div>

      <ImageUploadButton
        imageUrl={form.imageUrl}
        imageName={form.imageName}
        onUpload={onImageUpload}
        onClear={() => onChange({ imageUrl: null, imageName: null })}
      />

      <div className="border border-border rounded p-2 space-y-1.5">
        <ArticleCodesSection
          rows={form.articleCodeUnits}
          articleCodes={articleCodes}
          onAdd={onAddArticle}
          onUpdate={onUpdateArticle}
          onRemove={onRemoveArticle}
        />
      </div>

      <div className="space-y-0.5">
        <Label className="text-[11px]">Comments</Label>
        <Textarea
          value={form.comments}
          onChange={(e) => onChange({ comments: e.target.value })}
          className="min-h-[50px] resize-none text-xs"
        />
      </div>
    </div>
  );
}
