"use client";

import { useState, useEffect, useMemo } from "react";
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
  createFabricBalancesBulk, updateFabricBalance, deleteFabricBalance,
} from "@/actions/fabric-balance";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, X } from "lucide-react";

export type FabricBalanceRow = {
  id: string;
  fabricMasterId: string;
  fabricName: string;
  vendorId: string;
  vendorName: string;
  colour: string;
  remainingKg: number;
  costPerKg: number;
  sourcePhaseId: string | null;
  sourcePhaseLabel: string | null;
  targetPhaseId: string | null;
  targetPhaseLabel: string | null;
  notes: string | null;
};

type FabricMasterOption = {
  id: string;
  fabricName: string;
  vendorId: string;
  vendorName: string;
  coloursAvailable: string[];
  defaultCostPerKg: number | null;
};

type PhaseOption = { id: string; label: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type ColourEntry = { colour: string; remainingKg: string };

type FormData = {
  fabricMasterId: string;
  costPerKg: string;
  sourcePhaseId: string;
  targetPhaseId: string;
  notes: string;
  entries: ColourEntry[];
};

const emptyForm: FormData = {
  fabricMasterId: "",
  costPerKg: "",
  sourcePhaseId: "",
  targetPhaseId: "",
  notes: "",
  entries: [{ colour: "", remainingKg: "" }],
};

export function FabricBalanceSheet({
  open,
  onOpenChange,
  editingRow,
  fabricMasters,
  phases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: FabricBalanceRow | null;
  fabricMasters: FabricMasterOption[];
  phases: PhaseOption[];
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
          fabricMasterId: editingRow.fabricMasterId,
          costPerKg: String(editingRow.costPerKg),
          sourcePhaseId: editingRow.sourcePhaseId || "",
          targetPhaseId: editingRow.targetPhaseId || "",
          notes: editingRow.notes || "",
          entries: [{ colour: editingRow.colour, remainingKg: String(editingRow.remainingKg) }],
        });
      } else {
        setForm({ ...emptyForm, entries: [{ colour: "", remainingKg: "" }] });
      }
      setShowDeleteConfirm(false);
    }
  }, [open, editingRow]);

  const selectedFabric = useMemo(
    () => fabricMasters.find((f) => f.id === form.fabricMasterId) || null,
    [form.fabricMasterId, fabricMasters]
  );

  const colourOptions = useMemo(
    () => (selectedFabric?.coloursAvailable || []).map((c) => ({ label: c, value: c })),
    [selectedFabric]
  );

  // Auto-populate cost/kg and reset colour rows when fabric changes.
  // Only runs in create mode — edit mode uses whatever's saved on the row.
  useEffect(() => {
    if (isEdit) return;
    if (!selectedFabric) return;
    setForm((prev) => ({
      ...prev,
      // Only populate if the user hasn't typed a cost yet (don't clobber edits).
      costPerKg:
        prev.costPerKg === "" && selectedFabric.defaultCostPerKg != null
          ? String(selectedFabric.defaultCostPerKg)
          : prev.costPerKg,
      // Drop any colour entries that aren't valid for the new fabric.
      entries: prev.entries.map((e) =>
        e.colour && !selectedFabric.coloursAvailable.includes(e.colour)
          ? { ...e, colour: "" }
          : e
      ),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabric?.id]);

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateEntry(idx: number, patch: Partial<ColourEntry>) {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    }));
  }

  function addEntry() {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, { colour: "", remainingKg: "" }] }));
  }

  function removeEntry(idx: number) {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.length > 1 ? prev.entries.filter((_, i) => i !== idx) : prev.entries,
    }));
  }

  async function handleSubmit() {
    if (!form.fabricMasterId) {
      toast.error("Fabric is required");
      return;
    }
    if (!selectedFabric) {
      toast.error("Selected fabric not found");
      return;
    }
    const costPerKg = toNum(form.costPerKg);
    if (costPerKg === null || costPerKg <= 0) {
      toast.error("Cost per kg must be greater than 0");
      return;
    }

    // Validate every colour row. Drop fully-blank rows silently so the user
    // can leave a stray empty row at the bottom without it blocking save.
    const cleaned: Array<{ colour: string; remainingKg: number }> = [];
    for (let i = 0; i < form.entries.length; i++) {
      const e = form.entries[i];
      const colour = e.colour.trim();
      const rem = toNum(e.remainingKg);
      const blankRow = !colour && rem === null;
      if (blankRow) continue;
      if (!colour) {
        toast.error(`Row ${i + 1}: colour is required`);
        return;
      }
      if (rem === null || rem <= 0) {
        toast.error(`Row ${i + 1}: remaining weight must be greater than 0`);
        return;
      }
      cleaned.push({ colour, remainingKg: rem });
    }
    if (cleaned.length === 0) {
      toast.error("Add at least one colour row with a weight");
      return;
    }

    // Prevent duplicate colour rows within a single submission.
    const seen = new Set<string>();
    for (const c of cleaned) {
      const key = c.colour.toLowerCase();
      if (seen.has(key)) {
        toast.error(`Duplicate colour "${c.colour}" — merge the rows or remove one`);
        return;
      }
      seen.add(key);
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        // Edit mode: single row only.
        const e = cleaned[0];
        await updateFabricBalance(editingRow.id, {
          fabricMasterId: form.fabricMasterId,
          vendorId: selectedFabric.vendorId,
          colour: e.colour,
          remainingKg: e.remainingKg,
          costPerKg,
          sourcePhaseId: form.sourcePhaseId || null,
          targetPhaseId: form.targetPhaseId || null,
          notes: form.notes.trim() || null,
        });
        toast.success("Fabric balance updated");
      } else {
        const rows = await createFabricBalancesBulk({
          fabricMasterId: form.fabricMasterId,
          vendorId: selectedFabric.vendorId,
          costPerKg,
          sourcePhaseId: form.sourcePhaseId || null,
          targetPhaseId: form.targetPhaseId || null,
          notes: form.notes.trim() || null,
          entries: cleaned,
        });
        toast.success(
          `Recorded ${rows.length} fabric balance${rows.length === 1 ? "" : " entries"}`
        );
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
      await deleteFabricBalance(editingRow.id);
      toast.success("Fabric balance deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const totalKg = form.entries.reduce((s, e) => s + (toNum(e.remainingKg) || 0), 0);
  const totalCost = totalKg * (toNum(form.costPerKg) || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Fabric Balance" : "New Fabric Balance"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit
              ? "Update the surplus fabric record."
              : "Record leftover fabric for one or more colours of a single fabric. Cost/kg is shared across all colours in this batch."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          <div className="space-y-0.5">
            <Label className="text-[11px]">Fabric *</Label>
            <Combobox
              value={form.fabricMasterId}
              onValueChange={(v) => updateField("fabricMasterId", v)}
              options={fabricMasters.map((f) => ({
                label: `${f.fabricName} — ${f.vendorName}`,
                value: f.id,
                searchText: `${f.fabricName} ${f.vendorName}`,
              }))}
              placeholder="Select fabric..."
            />
            {selectedFabric && (
              <div className="text-[10px] text-muted-foreground italic">
                Vendor: {selectedFabric.vendorName}
              </div>
            )}
          </div>

          <div className="space-y-0.5">
            <Label className="text-[11px]">Cost / kg (Rs) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.costPerKg}
              onChange={(e) => updateField("costPerKg", e.target.value)}
              className="h-8 text-xs"
              placeholder={selectedFabric?.defaultCostPerKg != null ? `Default: ₹${selectedFabric.defaultCostPerKg}` : "e.g. 450.00"}
            />
            <p className="text-[10px] text-muted-foreground">
              Applied to every colour row below.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Colours *</Label>
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-1.5"
                  onClick={addEntry}
                  disabled={!selectedFabric}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add colour
                </Button>
              )}
            </div>
            {form.entries.map((entry, idx) => (
              <div key={idx} className="grid gap-2" style={{ gridTemplateColumns: "1fr 120px 24px" }}>
                <div>
                  {colourOptions.length > 0 ? (
                    <Combobox
                      value={entry.colour}
                      onValueChange={(v) => updateEntry(idx, { colour: v })}
                      options={colourOptions}
                      placeholder="Select colour..."
                    />
                  ) : (
                    <Input
                      className="h-8 text-xs"
                      value={entry.colour}
                      onChange={(e) => updateEntry(idx, { colour: e.target.value })}
                      placeholder={selectedFabric ? "No colours on master" : "Select fabric first"}
                      disabled={!selectedFabric}
                    />
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={entry.remainingKg}
                  onChange={(e) => updateEntry(idx, { remainingKg: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="kg"
                  disabled={!selectedFabric}
                />
                {!isEdit && form.entries.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-6 p-0"
                    onClick={() => removeEntry(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            ))}
            {totalKg > 0 && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Total: {totalKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg · ₹{" "}
                {totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                attributed
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Source Phase</Label>
              <Combobox
                value={form.sourcePhaseId}
                onValueChange={(v) => updateField("sourcePhaseId", v)}
                options={phases.map((p) => ({ label: p.label, value: p.id }))}
                placeholder="Where it came from"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Target Phase</Label>
              <Combobox
                value={form.targetPhaseId}
                onValueChange={(v) => updateField("targetPhaseId", v)}
                options={phases.map((p) => ({ label: p.label, value: p.id }))}
                placeholder="Where it'll be used"
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <Label className="text-[11px]">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
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
                isEdit ? "Update Balance" : "Record Balances"
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
                Delete this fabric balance permanently?
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
