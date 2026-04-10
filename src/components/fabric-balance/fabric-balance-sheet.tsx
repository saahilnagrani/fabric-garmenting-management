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
  createFabricBalance, updateFabricBalance, deleteFabricBalance,
} from "@/actions/fabric-balance";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

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
};

type PhaseOption = { id: string; label: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricMasterId: string;
  colour: string;
  remainingKg: string;
  costPerKg: string;
  sourcePhaseId: string;
  targetPhaseId: string;
  notes: string;
};

const emptyForm: FormData = {
  fabricMasterId: "",
  colour: "",
  remainingKg: "",
  costPerKg: "",
  sourcePhaseId: "",
  targetPhaseId: "",
  notes: "",
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
          colour: editingRow.colour,
          remainingKg: String(editingRow.remainingKg),
          costPerKg: String(editingRow.costPerKg),
          sourcePhaseId: editingRow.sourcePhaseId || "",
          targetPhaseId: editingRow.targetPhaseId || "",
          notes: editingRow.notes || "",
        });
      } else {
        setForm({ ...emptyForm });
      }
      setShowDeleteConfirm(false);
    }
  }, [open, editingRow]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const selectedFabric = useMemo(
    () => fabricMasters.find((f) => f.id === form.fabricMasterId) || null,
    [form.fabricMasterId, fabricMasters]
  );

  const colourOptions = useMemo(
    () => (selectedFabric?.coloursAvailable || []).map((c) => ({ label: c, value: c })),
    [selectedFabric]
  );

  // Reset colour when fabric changes if the current colour is no longer available.
  useEffect(() => {
    if (!selectedFabric) return;
    if (form.colour && !selectedFabric.coloursAvailable.includes(form.colour)) {
      setForm((prev) => ({ ...prev, colour: "" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabric?.id]);

  async function handleSubmit() {
    if (!form.fabricMasterId) {
      toast.error("Fabric is required");
      return;
    }
    if (!form.colour.trim()) {
      toast.error("Colour is required");
      return;
    }
    const remainingKg = toNum(form.remainingKg);
    const costPerKg = toNum(form.costPerKg);
    if (remainingKg === null || remainingKg <= 0) {
      toast.error("Remaining weight must be greater than 0");
      return;
    }
    if (costPerKg === null || costPerKg <= 0) {
      toast.error("Cost per kg must be greater than 0");
      return;
    }
    if (!selectedFabric) {
      toast.error("Selected fabric not found");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fabricMasterId: form.fabricMasterId,
        vendorId: selectedFabric.vendorId,
        colour: form.colour,
        remainingKg,
        costPerKg,
        sourcePhaseId: form.sourcePhaseId || null,
        targetPhaseId: form.targetPhaseId || null,
        notes: form.notes.trim() || null,
      };
      if (isEdit) {
        await updateFabricBalance(editingRow.id, payload);
        toast.success("Fabric balance updated");
      } else {
        await createFabricBalance(payload);
        toast.success("Fabric balance recorded");
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

  const total = (toNum(form.remainingKg) || 0) * (toNum(form.costPerKg) || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[480px] w-full overflow-y-auto border-t-4 border-t-blue-500">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-sm">{isEdit ? "Edit Fabric Balance" : "New Fabric Balance"}</SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEdit
              ? "Update the surplus fabric record."
              : "Record leftover fabric carried forward from a phase. Vendor is taken from the selected Fabric Master."}
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
            <Label className="text-[11px]">Colour *</Label>
            {colourOptions.length > 0 ? (
              <Combobox
                value={form.colour}
                onValueChange={(v) => updateField("colour", v)}
                options={colourOptions}
                placeholder="Select colour..."
              />
            ) : (
              <Input
                className="h-8 text-xs"
                value={form.colour}
                onChange={(e) => updateField("colour", e.target.value)}
                placeholder={selectedFabric ? "No colours on master" : "Select fabric first"}
                disabled={!selectedFabric}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[11px]">Remaining (kg) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.remainingKg}
                onChange={(e) => updateField("remainingKg", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Cost / kg (Rs) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costPerKg}
                onChange={(e) => updateField("costPerKg", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {total > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Cost attributed: ₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}

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
                isEdit ? "Update Balance" : "Record Balance"
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
