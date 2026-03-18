"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { createFabricMaster, updateFabricMaster } from "@/actions/fabric-masters";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type FabricMasterRow = {
  id: string;
  fabricName: string;
  vendorId: string;
  genders: string[];
  styleNumbers: string[];
  coloursAvailable: string[];
  mrp: number | null;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricName: string;
  vendorId: string;
  genders: string;
  styleNumbers: string;
  coloursAvailable: string;
  mrp: string;
};

const emptyForm: FormData = {
  fabricName: "",
  vendorId: "",
  genders: "",
  styleNumbers: "",
  coloursAvailable: "",
  mrp: "",
};

function rowToForm(row: FabricMasterRow): FormData {
  const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
  return {
    fabricName: s(row.fabricName),
    vendorId: s(row.vendorId),
    genders: (row.genders || []).join(", "),
    styleNumbers: (row.styleNumbers || []).join(", "),
    coloursAvailable: (row.coloursAvailable || []).join(", "),
    mrp: s(row.mrp),
  };
}

function parseCommaSeparated(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FabricMasterSheet({
  open,
  onOpenChange,
  editingRow,
  vendors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: FabricMasterRow | null;
  vendors: Vendor[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const isEdit = editingRow !== null;

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm(rowToForm(editingRow));
      } else {
        setForm({ ...emptyForm, vendorId: vendors[0]?.id || "" });
      }
    }
  }, [open, editingRow, vendors]);

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  async function handleSubmit() {
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.vendorId) {
      toast.error("Vendor is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fabricName: form.fabricName,
        vendorId: form.vendorId,
        genders: parseCommaSeparated(form.genders),
        styleNumbers: parseCommaSeparated(form.styleNumbers),
        coloursAvailable: parseCommaSeparated(form.coloursAvailable),
        mrp: toNum(form.mrp),
      };

      if (isEdit) {
        await updateFabricMaster(editingRow.id, payload);
        toast.success("Fabric master updated");
      } else {
        await createFabricMaster(payload);
        toast.success("Fabric master created");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to update fabric master" : "Failed to create fabric master");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Fabric Master" : "New Fabric Master"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update fabric details" : "Add a new fabric to the master database"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-4 overflow-y-auto">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Fabric Name *</Label>
            <Input value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Vendor *</Label>
              <Combobox
                value={form.vendorId}
                onValueChange={(v) => updateField("vendorId", v)}
                options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                placeholder="Select vendor..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MRP (Rs)</Label>
              <Input type="number" step="0.01" value={form.mrp} onChange={(e) => updateField("mrp", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Genders (comma-separated)</Label>
            <Input value={form.genders} onChange={(e) => updateField("genders", e.target.value)} placeholder="e.g. Mens, Womens, Kids" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Style Numbers (comma-separated)</Label>
            <Textarea
              value={form.styleNumbers}
              onChange={(e) => updateField("styleNumbers", e.target.value)}
              placeholder="e.g. ST001, ST002"
              className="min-h-9 resize-none"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Colours Available (comma-separated)</Label>
            <Textarea
              value={form.coloursAvailable}
              onChange={(e) => updateField("coloursAvailable", e.target.value)}
              placeholder="e.g. Black, Navy, White"
              className="min-h-9 resize-none"
            />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEdit ? "Update Fabric Master" : "Create Fabric Master"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
