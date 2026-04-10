"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { createFabricMaster, updateFabricMaster, deleteFabricMaster, getStyleNumbersByGenders } from "@/actions/fabric-masters";
import { getPhaseCosts, upsertPhaseCost } from "@/actions/phase-costs";
import { GENDER_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronRight, ChevronsUpDown, Archive, Trash2 } from "lucide-react";

export type FabricMasterRow = {
  id: string;
  fabricName: string;
  vendorId: string;
  genders: string[];
  articleNumbers: string[];
  deletedArticleNumbers: string[];
  coloursAvailable: string[];
  mrp: number | null;
  hsnCode: string | null;
  comments: string | null;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };
type Phase = { id: string; name: string; number: number };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricName: string;
  vendorId: string;
  genders: string[];
  articleNumbers: string[];
  coloursAvailable: string[];
  mrp: string;
  hsnCode: string;
  comments: string;
};

const emptyForm: FormData = {
  fabricName: "",
  vendorId: "",
  genders: [],
  articleNumbers: [],
  coloursAvailable: [],
  mrp: "",
  hsnCode: "",
  comments: "",
};

function rowToForm(row: FabricMasterRow): FormData {
  const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
  return {
    fabricName: s(row.fabricName),
    vendorId: s(row.vendorId),
    genders: row.genders || [],
    articleNumbers: row.articleNumbers || [],
    coloursAvailable: row.coloursAvailable || [],
    mrp: s(row.mrp),
    hsnCode: s(row.hsnCode),
    comments: s(row.comments),
  };
}

function parseCommaSeparated(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const SECTIONS = ["fabricInfo", "details", "phaseCosts"] as const;
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
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-2 py-1 bg-muted/50 hover:bg-muted transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
          {title}
        </span>
      </button>
      {expanded && <div className="px-2 py-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

export function FabricMasterSheet({
  open,
  onOpenChange,
  editingRow,
  vendors,
  colours = [],
  phases = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: FabricMasterRow | null;
  vendors: Vendor[];
  colours?: string[];
  phases?: Phase[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [styleNumberOptions, setStyleNumberOptions] = useState<string[]>([]);
  const [, startTransition] = useTransition();
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

  // Fetch style numbers filtered by selected genders
  useEffect(() => {
    if (form.genders.length === 0) {
      setStyleNumberOptions([]);
      return;
    }
    startTransition(async () => {
      try {
        const styles = await getStyleNumbersByGenders(form.genders);
        setStyleNumberOptions(styles);
      } catch {
        setStyleNumberOptions([]);
      }
    });
  }, [form.genders]);

  // Phase cost overrides
  const [phaseCostOverrides, setPhaseCostOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && editingRow) {
      getPhaseCosts("FABRIC_MASTER", editingRow.id).then((costs) => {
        const overrides: Record<string, string> = {};
        for (const c of costs) {
          if (c.fabricCostPerKg != null) {
            overrides[c.phaseId] = String(c.fabricCostPerKg);
          }
        }
        setPhaseCostOverrides(overrides);
      }).catch(() => {});
    } else {
      setPhaseCostOverrides({});
    }
  }, [open, editingRow]);

  async function savePhaseCost(phaseId: string, value: string) {
    if (!editingRow) return;
    const num = value.trim() === "" ? null : Number(value);
    if (num !== null && isNaN(num)) return;
    try {
      await upsertPhaseCost(phaseId, "FABRIC_MASTER", editingRow.id, {
        fabricCostPerKg: num,
      });
      toast.success("Phase cost saved");
    } catch {
      toast.error("Failed to save phase cost");
    }
  }

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
    if (toNum(form.mrp) === null) {
      toast.error("Cost/kg is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fabricName: form.fabricName,
        vendorId: form.vendorId,
        genders: form.genders,
        articleNumbers: form.articleNumbers,
        coloursAvailable: form.coloursAvailable,
        mrp: toNum(form.mrp),
        hsnCode: form.hsnCode.trim() || null,
        comments: form.comments.trim() || null,
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

  async function handleDelete() {
    if (!editingRow) return;
    setDeleting(true);
    try {
      await deleteFabricMaster(editingRow.id);
      toast.success("Fabric deleted");
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete fabric.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const allExpanded = SECTIONS.every((s) => expandedSections[s]);
  const allCollapsed = SECTIONS.every((s) => !expandedSections[s]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-sm">{isEdit ? "Edit Fabric Master" : "New Fabric Master"}</SheetTitle>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Master</span>
              </div>
              <SheetDescription className="text-[11px]">
                {isEdit ? "Update fabric details" : "Add a new fabric to the master database"}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted/50 shrink-0"
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
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">Fabric Name *</Label>
                <Input value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} autoFocus className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Vendor *</Label>
                <Combobox
                  value={form.vendorId}
                  onValueChange={(v) => updateField("vendorId", v)}
                  options={vendors.map((v) => ({ label: v.name, value: v.id }))}
                  placeholder="Select vendor..."
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px]">Cost/kg (Rs) *</Label>
                <Input type="number" step="0.01" value={form.mrp} onChange={(e) => updateField("mrp", e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px]">HSN Code</Label>
                <Input value={form.hsnCode} onChange={(e) => updateField("hsnCode", e.target.value)} placeholder="e.g. 6004" className="h-8 text-xs" />
              </div>
            </div>
          </CollapsibleSection>

          {/* Phase Costs */}
          {isEdit && phases.length > 0 && (
            <CollapsibleSection
              title="Phase Costs"
              expanded={expandedSections.phaseCosts}
              onToggle={() => toggleSection("phaseCosts")}
            >
              <p className="text-[11px] text-muted-foreground mb-1.5">
                Override fabric cost/kg per phase. Leave blank to use the base cost.
              </p>
              <div className="space-y-1.5">
                {phases.map((phase) => (
                  <div key={phase.id} className="flex items-center gap-2">
                    <span className="text-[11px] font-medium w-40 shrink-0">{phase.name}</span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={form.mrp || "Base cost"}
                      value={phaseCostOverrides[phase.id] ?? ""}
                      onChange={(e) =>
                        setPhaseCostOverrides((prev) => ({ ...prev, [phase.id]: e.target.value }))
                      }
                      onBlur={() => savePhaseCost(phase.id, phaseCostOverrides[phase.id] ?? "")}
                      className="h-8 text-xs w-32"
                    />
                    <span className="text-[11px] text-muted-foreground">Rs/kg</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Details */}
          <CollapsibleSection
            title="Details"
            expanded={expandedSections.details}
            onToggle={() => toggleSection("details")}
          >
            <div className="space-y-0.5">
              <Label className="text-[11px]">Genders</Label>
              <MultiCombobox
                values={form.genders}
                onValuesChange={(v) => setForm((prev) => ({ ...prev, genders: v }))}
                options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ label, value }))}
                placeholder="Select genders..."
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Article Numbers</Label>
              <MultiCombobox
                values={form.articleNumbers}
                onValuesChange={(v) => setForm((prev) => ({ ...prev, articleNumbers: v }))}
                options={styleNumberOptions}
                placeholder={form.genders.length === 0 ? "Select genders first..." : "Select article numbers..."}
              />
            </div>
            {isEdit && editingRow?.deletedArticleNumbers && editingRow.deletedArticleNumbers.length > 0 && (
              <div className="space-y-0.5">
                <Label className="text-[11px] text-muted-foreground">Deleted Article Numbers</Label>
                <div className="flex flex-wrap gap-1 p-1.5 bg-red-50 border border-red-200 rounded min-h-[32px]">
                  {editingRow.deletedArticleNumbers.map((n, i) => (
                    <span key={i} className="inline-flex items-center rounded bg-red-100 text-red-700 px-1.5 py-0.5 text-[11px] font-medium">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[11px]">Colours Available</Label>
              <MultiCombobox
                values={form.coloursAvailable}
                onValuesChange={(v) => setForm((prev) => ({ ...prev, coloursAvailable: v }))}
                options={colours}
                placeholder="Select colours..."
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[11px]">Comments</Label>
              <Textarea
                value={form.comments}
                onChange={(e) => updateField("comments", e.target.value)}
                placeholder="Optional notes about this fabric..."
                className="min-h-[60px] resize-none text-xs"
              />
            </div>
          </CollapsibleSection>
        </div>

        <SheetFooter>
          <div className={`flex gap-2 ${isEdit ? "" : "flex-col"}`}>
            <Button size="lg" onClick={handleSubmit} disabled={submitting || archiving} className="flex-1 min-h-9">
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
                size="lg"
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
                Delete this fabric permanently? This cannot be undone.
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
