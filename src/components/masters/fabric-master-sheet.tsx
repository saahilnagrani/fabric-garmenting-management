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
import { createFabricMaster, updateFabricMaster } from "@/actions/fabric-masters";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronRight, ChevronsUpDown, Archive } from "lucide-react";

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

const SECTIONS = ["fabricInfo", "details"] as const;
type SectionName = (typeof SECTIONS)[number];

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          {title}
        </span>
      </button>
      {expanded && <div className="p-3 space-y-2">{children}</div>}
    </div>
  );
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
  const [archiving, setArchiving] = useState(false);
  const isEdit = editingRow !== null;

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<SectionName, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s, true])) as Record<SectionName, boolean>
  );

  function toggleSection(section: SectionName) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections(
      Object.fromEntries(SECTIONS.map((s) => [s, expanded])) as Record<SectionName, boolean>
    );
  }

  useEffect(() => {
    if (open) {
      if (editingRow) {
        setForm(rowToForm(editingRow));
      } else {
        setForm({ ...emptyForm, vendorId: vendors[0]?.id || "" });
      }
      setAllSections(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isArchived = editingRow?.isStrikedThrough === true;

  async function handleArchive() {
    if (!editingRow) return;
    setArchiving(true);
    try {
      await updateFabricMaster(editingRow.id, { isStrikedThrough: !isArchived });
      toast.success(isArchived ? "Fabric unarchived" : "Fabric archived");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isArchived ? "Failed to unarchive fabric" : "Failed to archive fabric");
    } finally {
      setArchiving(false);
    }
  }

  const allExpanded = SECTIONS.every((s) => expandedSections[s]);
  const allCollapsed = SECTIONS.every((s) => !expandedSections[s]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[750px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle>{isEdit ? "Edit Fabric Master" : "New Fabric Master"}</SheetTitle>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Master</span>
              </div>
              <SheetDescription>
                {isEdit ? "Update fabric details" : "Add a new fabric to the master database"}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 shrink-0"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {allExpanded ? "Collapse All" : allCollapsed ? "Expand All" : "Collapse All"}
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {/* Fabric Info */}
          <CollapsibleSection
            title="Fabric Info"
            expanded={expandedSections.fabricInfo}
            onToggle={() => toggleSection("fabricInfo")}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric Name *</Label>
                <Input value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} autoFocus />
              </div>
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
                <Label className="text-xs">Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.mrp} onChange={(e) => updateField("mrp", e.target.value)} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Details */}
          <CollapsibleSection
            title="Details"
            expanded={expandedSections.details}
            onToggle={() => toggleSection("details")}
          >
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
          </CollapsibleSection>
        </div>

        <SheetFooter>
          <div className={`flex gap-2 ${isEdit ? "" : "flex-col"}`}>
            <Button onClick={handleSubmit} disabled={submitting || archiving} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? "Updating..." : "Creating..."}
                </>
              ) : (
                isEdit ? "Update Fabric" : "Create Fabric"
              )}
            </Button>
            {isEdit && (
              <Button
                variant="outline"
                onClick={handleArchive}
                disabled={submitting || archiving}
                className="flex-1"
              >
                {archiving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isArchived ? "Unarchiving..." : "Archiving..."}
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    {isArchived ? "Unarchive Fabric" : "Archive Fabric"}
                  </>
                )}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
