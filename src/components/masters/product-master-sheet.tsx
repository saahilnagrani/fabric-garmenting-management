"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import {
  createProductMaster,
  updateProductMaster,
  deleteProductMaster,
  batchCreateProductMasters,
  getNextStyleSequence,
} from "@/actions/product-masters";
import { getFabricMasterColours } from "@/actions/fabric-masters";
import { getPhaseCosts, upsertPhaseCost } from "@/actions/phase-costs";
import { GENDER_LABELS } from "@/lib/constants";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalCost,
  computeTotalLandedCost,
  computeDealerPrice,
  computeProfitMargin,
} from "@/lib/computations";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronRight, ChevronsUpDown, Archive, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";

// Gender prefix for SKU code: MENS→M, WOMENS→W, KIDS→K
const GENDER_PREFIX: Record<string, string> = { MENS: "M", WOMENS: "W", KIDS: "K" };

export type ProductMasterRow = {
  id: string;
  skuCode: string;
  styleNumber: string;
  articleNumber: string;
  fabricName: string;
  fabric2Name: string;
  type: string;
  gender: string;
  productName: string;
  coloursAvailable: string[];
  colours2Available: string[];
  garmentsPerKg: number | null;
  garmentsPerKg2: number | null;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  inwardShipping: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
  [key: string]: unknown;
};

// Grouped row for the new grid
export type GroupedStyleRow = {
  articleNumber: string;
  styleNumber: string;
  fabricName: string;
  fabric2Name: string | null;
  type: string;
  gender: string;
  productName: string | null;
  colours: string[];
  skuCount: number;
  skus: { id: string; skuCode: string; colour: string; isStrikedThrough: boolean }[];
  garmentsPerKg: number | null;
  garmentsPerKg2: number | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  inwardShipping: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
  isStrikedThrough: boolean;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type StyleFormData = {
  styleNumber: string;
  articleNumber: string;
  fabricName: string;
  fabric2Name: string;
  type: string;
  gender: string;
  productName: string;
  garmentsPerKg: string;
  garmentsPerKg2: string;
  stitchingCost: string;
  brandLogoCost: string;
  neckTwillCost: string;
  reflectorsCost: string;
  fusingCost: string;
  accessoriesCost: string;
  brandTagCost: string;
  sizeTagCost: string;
  packagingCost: string;
  fabricCostPerKg: string;
  fabric2CostPerKg: string;
  inwardShipping: string;
  proposedMrp: string;
  onlineMrp: string;
};

const emptyStyleForm: StyleFormData = {
  styleNumber: "",
  articleNumber: "",
  fabricName: "",
  fabric2Name: "",
  type: "",
  gender: "MENS",
  productName: "",
  garmentsPerKg: "",
  garmentsPerKg2: "",
  stitchingCost: "",
  brandLogoCost: "",
  neckTwillCost: "",
  reflectorsCost: "",
  fusingCost: "",
  accessoriesCost: "",
  brandTagCost: "",
  sizeTagCost: "",
  packagingCost: "",
  fabricCostPerKg: "",
  fabric2CostPerKg: "",
  inwardShipping: "",
  proposedMrp: "",
  onlineMrp: "",
};

type SkuEntry = { colour: string; skuCode: string };

const SECTIONS = ["productInfo", "fabric", "colours", "garmentingCosts", "pricing", "phaseCosts"] as const;
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
        className="w-full flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
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

type FabricData = { name: string; mrp: number | null };
type Phase = { id: string; name: string; number: number };
type ProductTypeWithCode = { name: string; code: string };
type ColourWithCode = { name: string; code: string };

export function ProductMasterSheet({
  open,
  onOpenChange,
  editingRow,
  productTypes = [],
  productTypesWithCode = [],
  fabricData = [],
  colours = [],
  coloursWithCode = [],
  phases = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: GroupedStyleRow | null;
  productTypes?: string[];
  productTypesWithCode?: ProductTypeWithCode[];
  fabricData?: FabricData[];
  colours?: string[];
  coloursWithCode?: ColourWithCode[];
  phases?: Phase[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<StyleFormData>({ ...emptyStyleForm });
  const [skuEntries, setSkuEntries] = useState<SkuEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = editingRow !== null;

  // Wizard step: 1 = style info + fabric, 2 = colours + SKU preview, 3 = costs
  const [step, setStep] = useState(1);

  // Fabric colours from fabric master
  const [fabricColours, setFabricColours] = useState<string[]>([]);
  const [loadingFabricColours, setLoadingFabricColours] = useState(false);

  // Phase cost overrides
  const [phaseCostOverrides, setPhaseCostOverrides] = useState<Record<string, Record<string, string>>>({});

  // Collapsible section state (for edit mode)
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

  const fabricNames = useMemo(() => fabricData.map((f) => f.name), [fabricData]);
  const fabricMrpMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const f of fabricData) map.set(f.name, f.mrp);
    return map;
  }, [fabricData]);

  // Colour code lookup
  const colourCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of coloursWithCode) map.set(c.name, c.code);
    return map;
  }, [coloursWithCode]);

  // Type code lookup
  const typeCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of productTypesWithCode) map.set(t.name, t.code);
    return map;
  }, [productTypesWithCode]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setAllSections(true);
      if (editingRow) {
        const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
        setForm({
          styleNumber: s(editingRow.styleNumber),
          articleNumber: s(editingRow.articleNumber),
          fabricName: s(editingRow.fabricName),
          fabric2Name: s(editingRow.fabric2Name),
          type: s(editingRow.type),
          gender: s(editingRow.gender) || "MENS",
          productName: s(editingRow.productName),
          garmentsPerKg: s(editingRow.garmentsPerKg),
          garmentsPerKg2: s(editingRow.garmentsPerKg2),
          stitchingCost: s(editingRow.stitchingCost),
          brandLogoCost: s(editingRow.brandLogoCost),
          neckTwillCost: s(editingRow.neckTwillCost),
          reflectorsCost: s(editingRow.reflectorsCost),
          fusingCost: s(editingRow.fusingCost),
          accessoriesCost: s(editingRow.accessoriesCost),
          brandTagCost: s(editingRow.brandTagCost),
          sizeTagCost: s(editingRow.sizeTagCost),
          packagingCost: s(editingRow.packagingCost),
          fabricCostPerKg: s(editingRow.fabricCostPerKg),
          fabric2CostPerKg: s(editingRow.fabric2CostPerKg),
          inwardShipping: s(editingRow.inwardShipping),
          proposedMrp: s(editingRow.proposedMrp),
          onlineMrp: s(editingRow.onlineMrp),
        });
        setSkuEntries(
          editingRow.skus.map((sku) => ({
            colour: sku.colour,
            skuCode: sku.skuCode,
          }))
        );
        // Fetch fabric colours
        if (editingRow.fabricName) {
          getFabricMasterColours(editingRow.fabricName).then(setFabricColours).catch(() => {});
        }
      } else {
        setForm({ ...emptyStyleForm });
        setSkuEntries([]);
        setFabricColours([]);
      }
      setPhaseCostOverrides({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRow]);

  // Load phase costs for edit
  useEffect(() => {
    if (open && editingRow && editingRow.skus.length > 0) {
      getPhaseCosts("PRODUCT_MASTER", editingRow.skus[0].id).then((costs) => {
        const overrides: Record<string, Record<string, string>> = {};
        const fields = [
          "fabricCostPerKg", "fabric2CostPerKg", "stitchingCost", "brandLogoCost",
          "neckTwillCost", "reflectorsCost", "fusingCost", "accessoriesCost",
          "brandTagCost", "sizeTagCost", "packagingCost", "inwardShipping",
        ];
        for (const c of costs) {
          const values: Record<string, string> = {};
          for (const f of fields) {
            const val = (c as Record<string, unknown>)[f];
            if (val != null) values[f] = String(val);
          }
          if (Object.keys(values).length > 0) overrides[c.phaseId] = values;
        }
        setPhaseCostOverrides(overrides);
      }).catch(() => {});
    }
  }, [open, editingRow]);

  function updatePhaseCostField(phaseId: string, field: string, value: string) {
    setPhaseCostOverrides((prev) => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] || {}), [field]: value },
    }));
  }

  async function savePhaseCost(phaseId: string) {
    if (!editingRow || editingRow.skus.length === 0) return;
    const values = phaseCostOverrides[phaseId] || {};
    const data: Record<string, number | null> = {};
    for (const [key, val] of Object.entries(values)) {
      data[key] = val.trim() === "" ? null : Number(val);
    }
    try {
      await upsertPhaseCost(phaseId, "PRODUCT_MASTER", editingRow.skus[0].id, data);
      toast.success("Phase cost saved");
    } catch {
      toast.error("Failed to save phase cost");
    }
  }

  const updateField = useCallback((field: keyof StyleFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  function handleFabricNameChange(value: string) {
    updateField("fabricName", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabricCostPerKg", mrp != null ? String(mrp) : "");
    // Fetch colours from fabric master
    setLoadingFabricColours(true);
    getFabricMasterColours(value)
      .then((cols) => setFabricColours(cols))
      .catch(() => setFabricColours([]))
      .finally(() => setLoadingFabricColours(false));
  }

  function handleFabric2NameChange(value: string) {
    updateField("fabric2Name", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabric2CostPerKg", mrp != null ? String(mrp) : "");
  }

  // Generate SKU code for a colour
  function generateSkuCode(colour: string, seqNum: number): string {
    const genderP = GENDER_PREFIX[form.gender] || "M";
    const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
    const colourCode = colourCodeMap.get(colour) || colour.slice(0, 3).toUpperCase();
    const seq = String(seqNum).padStart(2, "0");
    return `${genderP} ${typeCode}${seq} ${colourCode}`;
  }

  // Add colours and auto-generate SKU codes
  async function handleColoursSelected(selectedColours: string[]) {
    // Find which are new
    const existingColours = new Set(skuEntries.map((e) => e.colour));
    const newColours = selectedColours.filter((c) => !existingColours.has(c));
    const removedColours = new Set(
      skuEntries.map((e) => e.colour).filter((c) => !selectedColours.includes(c))
    );

    // Remove deselected
    let updated = skuEntries.filter((e) => !removedColours.has(e.colour));

    if (newColours.length > 0) {
      // Get next sequence number
      const genderP = GENDER_PREFIX[form.gender] || "M";
      const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
      let nextSeq: number;
      try {
        nextSeq = await getNextStyleSequence(genderP, typeCode);
      } catch {
        nextSeq = 1;
      }
      // If we already have entries, use the same sequence number
      // All SKUs for the same style share the same number, only colour differs
      const seqNum = updated.length > 0
        ? parseInt(updated[0].skuCode.match(/\d+/)?.[0] || String(nextSeq), 10)
        : nextSeq;

      for (const colour of newColours) {
        updated.push({
          colour,
          skuCode: generateSkuCode(colour, seqNum),
        });
      }
    }
    setSkuEntries(updated);
  }

  function updateSkuCode(index: number, newCode: string) {
    setSkuEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], skuCode: newCode };
      return copy;
    });
  }

  function removeSkuEntry(index: number) {
    setSkuEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function formAsData(): Record<string, unknown> {
    return {
      ...form,
      fabricCostPerKg: toNum(form.fabricCostPerKg),
      fabric2CostPerKg: toNum(form.fabric2CostPerKg),
      garmentsPerKg: toNum(form.garmentsPerKg),
      garmentsPerKg2: toNum(form.garmentsPerKg2),
      assumedFabricGarmentsPerKg: toNum(form.garmentsPerKg),
      assumedFabric2GarmentsPerKg: toNum(form.garmentsPerKg2),
      outwardShippingCost: toNum(form.inwardShipping),
      stitchingCost: toNum(form.stitchingCost),
      brandLogoCost: toNum(form.brandLogoCost),
      neckTwillCost: toNum(form.neckTwillCost),
      reflectorsCost: toNum(form.reflectorsCost),
      fusingCost: toNum(form.fusingCost),
      accessoriesCost: toNum(form.accessoriesCost),
      brandTagCost: toNum(form.brandTagCost),
      sizeTagCost: toNum(form.sizeTagCost),
      packagingCost: toNum(form.packagingCost),
      inwardShipping: toNum(form.inwardShipping),
      proposedMrp: toNum(form.proposedMrp),
      onlineMrp: toNum(form.onlineMrp),
    };
  }

  async function handleSubmit() {
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.type.trim()) {
      toast.error("Type is required");
      return;
    }
    if (!form.gender) {
      toast.error("Gender is required");
      return;
    }
    if (skuEntries.length === 0) {
      toast.error("Select at least one colour to generate variants");
      return;
    }
    for (const entry of skuEntries) {
      if (!entry.skuCode.trim()) {
        toast.error(`Article code is missing for colour "${entry.colour}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const sharedPayload = {
        styleNumber: form.styleNumber || form.articleNumber || skuEntries[0]?.skuCode?.split(" ").slice(0, 2).join(" ") || "",
        articleNumber: form.articleNumber || null,
        fabricName: form.fabricName,
        fabric2Name: form.fabric2Name || null,
        type: form.type,
        gender: form.gender || "MENS",
        productName: form.productName || null,
        colours2Available: [] as string[],
        garmentsPerKg: toNum(form.garmentsPerKg),
        garmentsPerKg2: toNum(form.garmentsPerKg2),
        stitchingCost: toNum(form.stitchingCost),
        brandLogoCost: toNum(form.brandLogoCost),
        neckTwillCost: toNum(form.neckTwillCost),
        reflectorsCost: toNum(form.reflectorsCost),
        fusingCost: toNum(form.fusingCost),
        accessoriesCost: toNum(form.accessoriesCost),
        brandTagCost: toNum(form.brandTagCost),
        sizeTagCost: toNum(form.sizeTagCost),
        packagingCost: toNum(form.packagingCost),
        fabricCostPerKg: toNum(form.fabricCostPerKg),
        fabric2CostPerKg: toNum(form.fabric2CostPerKg),
        inwardShipping: toNum(form.inwardShipping),
        proposedMrp: toNum(form.proposedMrp),
        onlineMrp: toNum(form.onlineMrp),
      };

      if (isEdit) {
        // Update each existing SKU, create new ones, keeping shared data in sync
        for (const entry of skuEntries) {
          const existingSku = editingRow.skus.find((s) => s.skuCode === entry.skuCode || s.colour === entry.colour);
          if (existingSku) {
            await updateProductMaster(existingSku.id, {
              ...sharedPayload,
              skuCode: entry.skuCode,
              coloursAvailable: [entry.colour],
            });
          } else {
            await createProductMaster({
              ...sharedPayload,
              skuCode: entry.skuCode,
              coloursAvailable: [entry.colour],
            });
          }
        }
        // Archive SKUs that were removed
        const keptColours = new Set(skuEntries.map((e) => e.colour));
        for (const sku of editingRow.skus) {
          if (!keptColours.has(sku.colour) && !sku.isStrikedThrough) {
            await updateProductMaster(sku.id, { isStrikedThrough: true });
          }
        }
        toast.success("Article updated");
      } else {
        await batchCreateProductMasters(sharedPayload, skuEntries);
        toast.success(`${skuEntries.length} variant(s) created`);
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isDuplicate = message.includes("Unique constraint");
      toast.error(
        isDuplicate
          ? "An article with one of these codes already exists"
          : `Failed: ${message}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isArchived = editingRow?.isStrikedThrough === true;

  async function handleArchive() {
    if (!editingRow) return;
    setArchiving(true);
    try {
      for (const sku of editingRow.skus) {
        await updateProductMaster(sku.id, { isStrikedThrough: !isArchived });
      }
      toast.success(isArchived ? "Article unarchived" : "Article archived");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isArchived ? "Failed to unarchive" : "Failed to archive");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (!editingRow) return;
    setDeleting(true);
    try {
      for (const sku of editingRow.skus) {
        await deleteProductMaster(sku.id);
      }
      toast.success("Article deleted");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete article. It may be referenced by orders.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const data = formAsData();
  const totalGarmenting = computeTotalGarmenting(data);
  const fabricCostPerPiece = computeFabricCostPerPiece(data);
  const totalCost = computeTotalCost(data);
  const totalLanded = computeTotalLandedCost(data);
  const dealerPrice = computeDealerPrice(toNum(form.proposedMrp));
  const profitMargin = computeProfitMargin(data);

  const allExpanded = SECTIONS.every((s) => expandedSections[s]);
  const allCollapsed = SECTIONS.every((s) => !expandedSections[s]);

  const selectedColours = skuEntries.map((e) => e.colour);

  // For create mode: wizard steps
  // For edit mode: all sections visible (collapsible)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-sm">{isEdit ? "Edit Article" : "New Article"}</SheetTitle>
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Master</span>
              </div>
              <SheetDescription className="text-[11px]">
                {isEdit
                  ? `${editingRow.articleNumber || editingRow.styleNumber} — ${editingRow.skus.length} colour(s)`
                  : "Create an article and generate variants per colour"}
              </SheetDescription>
            </div>
            {isEdit && (
              <button
                type="button"
                onClick={() => setAllSections(allExpanded ? false : true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 shrink-0"
              >
                <ChevronsUpDown className="h-3 w-3" />
                {allExpanded ? "Collapse All" : allCollapsed ? "Expand All" : "Collapse All"}
              </button>
            )}
            {!isEdit && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={step >= 1 ? "text-amber-600 font-semibold" : ""}>Article</span>
                <span>→</span>
                <span className={step >= 2 ? "text-amber-600 font-semibold" : ""}>Colours</span>
                <span>→</span>
                <span className={step >= 3 ? "text-amber-600 font-semibold" : ""}>Costs</span>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-2 px-4 overflow-y-auto">
          {/* ─── CREATE MODE: WIZARD ─── */}
          {!isEdit && step === 1 && (
            <>
              <CollapsibleSection title="Product Info" expanded onToggle={() => {}}>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Article # *</Label>
                    <Input className="h-8 text-xs" value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} autoFocus placeholder="e.g. HB-RN-001" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Product Name</Label>
                    <Input className="h-8 text-xs" value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Style # (legacy)</Label>
                    <Input className="h-8 text-xs" value={form.styleNumber} onChange={(e) => updateField("styleNumber", e.target.value)} placeholder="Legacy field" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Product Type *</Label>
                    <Combobox
                      value={form.type}
                      onValueChange={(v) => updateField("type", v)}
                      options={productTypes}
                      placeholder="Select type..."
                    />
                    {form.type && typeCodeMap.get(form.type) && (
                      <p className="text-[10px] text-muted-foreground">Code: {typeCodeMap.get(form.type)}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Gender *</Label>
                    <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <span className="truncate">{GENDER_LABELS[form.gender] || "Select"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(GENDER_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Fabric" expanded onToggle={() => {}}>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Fabric Name *</Label>
                    <Combobox
                      value={form.fabricName}
                      onValueChange={handleFabricNameChange}
                      options={fabricNames}
                      placeholder="Select fabric..."
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Cost/kg (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garments/kg</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg} onChange={(e) => updateField("garmentsPerKg", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">2nd Fabric Name</Label>
                    <Combobox
                      value={form.fabric2Name}
                      onValueChange={handleFabric2NameChange}
                      options={fabricNames}
                      placeholder="Select fabric..."
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Cost/kg (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric2CostPerKg} onChange={(e) => updateField("fabric2CostPerKg", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garments/kg</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg2} onChange={(e) => updateField("garmentsPerKg2", e.target.value)} />
                  </div>
                </div>
              </CollapsibleSection>
            </>
          )}

          {!isEdit && step === 2 && (
            <div className="space-y-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold">Select Colours from Fabric</Label>
                {loadingFabricColours ? (
                  <p className="text-xs text-muted-foreground">Loading fabric colours...</p>
                ) : fabricColours.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No colours defined on fabric master &quot;{form.fabricName}&quot;. You can still pick from the global colour list below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fabricColours.map((colour) => {
                      const isSelected = selectedColours.includes(colour);
                      return (
                        <button
                          key={colour}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleColoursSelected(selectedColours.filter((c) => c !== colour));
                            } else {
                              handleColoursSelected([...selectedColours, colour]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            isSelected
                              ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {colour}
                          {colourCodeMap.get(colour) && (
                            <span className="ml-1 text-[10px] opacity-60">({colourCodeMap.get(colour)})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-1 pt-2">
                  <Label className="text-[11px] text-muted-foreground">Or add from all colours</Label>
                  <MultiCombobox
                    values={selectedColours}
                    onValuesChange={handleColoursSelected}
                    options={colours}
                    placeholder="Search colours..."
                  />
                </div>
              </div>

              {skuEntries.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold">Generated Article Codes</Label>
                  <p className="text-xs text-muted-foreground">
                    Format: {GENDER_PREFIX[form.gender] || "?"} {typeCodeMap.get(form.type) || "??"}## {"{CLR}"} — edit as needed
                  </p>
                  <div className="border rounded-lg divide-y">
                    {skuEntries.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs font-medium w-24 shrink-0">{entry.colour}</span>
                        <Input
                          value={entry.skuCode}
                          onChange={(e) => updateSkuCode(i, e.target.value.toUpperCase())}
                          className="flex-1 font-mono text-xs h-8"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => removeSkuEntry(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isEdit && step === 3 && (
            <>
              <CollapsibleSection title="Garmenting Costs" expanded onToggle={() => {}}>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "stitchingCost", label: "Stitching" },
                    { key: "brandLogoCost", label: "Brand Logo" },
                    { key: "neckTwillCost", label: "Neck Twill" },
                    { key: "reflectorsCost", label: "Reflectors" },
                    { key: "fusingCost", label: "Fusing" },
                    { key: "accessoriesCost", label: "Accessories" },
                    { key: "brandTagCost", label: "Brand Tag" },
                    { key: "sizeTagCost", label: "Size Tag" },
                    { key: "packagingCost", label: "Packaging" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-0.5">
                      <Label className="text-[10px]">{label}</Label>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        step="0.01"
                        value={(form as unknown as Record<string, string>)[key]}
                        onChange={(e) => updateField(key as keyof StyleFormData, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Pricing" expanded onToggle={() => {}}>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Shipping/piece (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.inwardShipping} onChange={(e) => updateField("inwardShipping", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Proposed MRP (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.proposedMrp} onChange={(e) => updateField("proposedMrp", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Online MRP (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.onlineMrp} onChange={(e) => updateField("onlineMrp", e.target.value)} />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Summary */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 space-y-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Summary</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Garmenting</span>
                    <div className="font-semibold">{formatCurrency(totalGarmenting)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Fabric Cost/Piece</span>
                    <div className="font-semibold">{formatCurrency(fabricCostPerPiece)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Cost/Piece</span>
                    <div className="font-semibold">{formatCurrency(totalCost)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Landed Cost</span>
                    <div className="font-semibold">{formatCurrency(totalLanded)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Dealer Price (50%)</span>
                    <div className="font-semibold">{formatCurrency(dealerPrice)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Profit Margin</span>
                    <div className="font-semibold">{formatPercent(profitMargin)}</div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Will create <strong>{skuEntries.length}</strong> variant(s): {skuEntries.map((e) => e.skuCode).join(", ")}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ─── EDIT MODE: ALL SECTIONS ─── */}
          {isEdit && (
            <>
              <CollapsibleSection
                title="Product Info"
                expanded={expandedSections.productInfo}
                onToggle={() => toggleSection("productInfo")}
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Article #</Label>
                    <Input className="h-8 text-xs" value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Style # (legacy)</Label>
                    <Input className="h-8 text-xs" value={form.styleNumber} onChange={(e) => updateField("styleNumber", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Product Name</Label>
                    <Input className="h-8 text-xs" value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Type *</Label>
                    <Combobox
                      value={form.type}
                      onValueChange={(v) => updateField("type", v)}
                      options={productTypes}
                      placeholder="Select type..."
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Gender *</Label>
                    <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <span className="truncate">{GENDER_LABELS[form.gender] || "Select"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(GENDER_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Fabric"
                expanded={expandedSections.fabric}
                onToggle={() => toggleSection("fabric")}
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Fabric Name *</Label>
                    <Combobox
                      value={form.fabricName}
                      onValueChange={handleFabricNameChange}
                      options={fabricNames}
                      placeholder="Select fabric..."
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Cost/kg (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garments/kg</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg} onChange={(e) => updateField("garmentsPerKg", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">2nd Fabric Name</Label>
                    <Combobox
                      value={form.fabric2Name}
                      onValueChange={handleFabric2NameChange}
                      options={fabricNames}
                      placeholder="Select fabric..."
                    />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Cost/kg (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric2CostPerKg} onChange={(e) => updateField("fabric2CostPerKg", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garments/kg</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg2} onChange={(e) => updateField("garmentsPerKg2", e.target.value)} />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={`Colour Variants (${skuEntries.length})`}
                expanded={expandedSections.colours}
                onToggle={() => toggleSection("colours")}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {fabricColours.map((colour) => {
                      const isSelected = selectedColours.includes(colour);
                      return (
                        <button
                          key={colour}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleColoursSelected(selectedColours.filter((c) => c !== colour));
                            } else {
                              handleColoursSelected([...selectedColours, colour]);
                            }
                          }}
                          className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                            isSelected
                              ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {colour}
                        </button>
                      );
                    })}
                  </div>
                  <MultiCombobox
                    values={selectedColours}
                    onValuesChange={handleColoursSelected}
                    options={colours}
                    placeholder="Add more colours..."
                  />
                  {skuEntries.length > 0 && (
                    <div className="border rounded-lg divide-y mt-2">
                      {skuEntries.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-xs font-medium w-24 shrink-0">{entry.colour}</span>
                          <Input
                            value={entry.skuCode}
                            onChange={(e) => updateSkuCode(i, e.target.value.toUpperCase())}
                            className="flex-1 font-mono text-xs h-8"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => removeSkuEntry(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Garmenting Costs"
                expanded={expandedSections.garmentingCosts}
                onToggle={() => toggleSection("garmentingCosts")}
              >
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { key: "stitchingCost", label: "Stitching" },
                    { key: "brandLogoCost", label: "Brand Logo" },
                    { key: "neckTwillCost", label: "Neck Twill" },
                    { key: "reflectorsCost", label: "Reflectors" },
                    { key: "fusingCost", label: "Fusing" },
                    { key: "accessoriesCost", label: "Accessories" },
                    { key: "brandTagCost", label: "Brand Tag" },
                    { key: "sizeTagCost", label: "Size Tag" },
                    { key: "packagingCost", label: "Packaging" },
                  ].map(({ key, label }) => (
                    <div key={key} className="space-y-0.5">
                      <Label className="text-[10px]">{label}</Label>
                      <Input
                        className="h-8 text-xs"
                        type="number"
                        step="0.01"
                        value={(form as unknown as Record<string, string>)[key]}
                        onChange={(e) => updateField(key as keyof StyleFormData, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Pricing"
                expanded={expandedSections.pricing}
                onToggle={() => toggleSection("pricing")}
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Shipping/piece (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.inwardShipping} onChange={(e) => updateField("inwardShipping", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Proposed MRP (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.proposedMrp} onChange={(e) => updateField("proposedMrp", e.target.value)} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Online MRP (Rs)</Label>
                    <Input className="h-8 text-xs" type="number" step="0.01" value={form.onlineMrp} onChange={(e) => updateField("onlineMrp", e.target.value)} />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Phase Costs */}
              {phases.length > 0 && (
                <CollapsibleSection
                  title="Phase Costs"
                  expanded={expandedSections.phaseCosts}
                  onToggle={() => toggleSection("phaseCosts")}
                >
                  <p className="text-xs text-muted-foreground mb-2">
                    Override costs per phase. Leave blank to use base costs. Saves on blur.
                  </p>
                  <div className="space-y-2">
                    {phases.map((phase) => {
                      const overrides = phaseCostOverrides[phase.id] || {};
                      const costFields = [
                        { key: "fabricCostPerKg", label: "Fabric Cost/kg" },
                        { key: "fabric2CostPerKg", label: "Fabric 2 Cost/kg" },
                        { key: "stitchingCost", label: "Stitching" },
                        { key: "brandLogoCost", label: "Brand Logo" },
                        { key: "neckTwillCost", label: "Neck Twill" },
                        { key: "reflectorsCost", label: "Reflectors" },
                        { key: "fusingCost", label: "Fusing" },
                        { key: "accessoriesCost", label: "Accessories" },
                        { key: "brandTagCost", label: "Brand Tag" },
                        { key: "sizeTagCost", label: "Size Tag" },
                        { key: "packagingCost", label: "Packaging" },
                        { key: "inwardShipping", label: "Shipping" },
                      ];
                      // Compute effective costs for this phase (override ?? base)
                      const effective = (key: string) => {
                        const ov = overrides[key];
                        if (ov != null && ov !== "") return Number(ov);
                        return toNum((form as unknown as Record<string, string>)[key]);
                      };
                      const phaseData = {
                        fabricCostPerKg: effective("fabricCostPerKg"),
                        fabric2CostPerKg: effective("fabric2CostPerKg"),
                        assumedFabricGarmentsPerKg: toNum(form.garmentsPerKg),
                        assumedFabric2GarmentsPerKg: toNum(form.garmentsPerKg2),
                        stitchingCost: effective("stitchingCost"),
                        brandLogoCost: effective("brandLogoCost"),
                        neckTwillCost: effective("neckTwillCost"),
                        reflectorsCost: effective("reflectorsCost"),
                        fusingCost: effective("fusingCost"),
                        accessoriesCost: effective("accessoriesCost"),
                        brandTagCost: effective("brandTagCost"),
                        sizeTagCost: effective("sizeTagCost"),
                        packagingCost: effective("packagingCost"),
                        outwardShippingCost: effective("inwardShipping"),
                        proposedMrp: toNum(form.proposedMrp),
                      };
                      const phaseTotalCost = computeTotalCost(phaseData);
                      const phaseLanded = computeTotalLandedCost(phaseData);
                      const phaseDealer = computeDealerPrice(toNum(form.proposedMrp));
                      const phasePM = computeProfitMargin(phaseData);
                      const isPhaseExpanded = expandedPhases[phase.id] ?? false;
                      return (
                        <div key={phase.id} className="border rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedPhases((prev) => ({ ...prev, [phase.id]: !prev[phase.id] }))}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          >
                            <div className="text-[11px] font-semibold truncate max-w-[120px]" title={phase.name}>{phase.name}</div>
                            <div className="flex items-center gap-2 text-[10px] shrink-0">
                              <span className="text-muted-foreground">Cost: <strong className="text-foreground">{formatCurrency(phaseTotalCost)}</strong></span>
                              <span className={`font-bold ${phasePM >= 0.2 ? "text-green-600" : phasePM >= 0.1 ? "text-amber-600" : "text-red-600"}`}>
                                PM: {formatPercent(phasePM)}
                              </span>
                            </div>
                          </button>
                          {isPhaseExpanded && (
                            <div className="px-2 py-1.5">
                              <div className="flex items-center gap-2 text-[10px] mb-1.5">
                                <span className="text-muted-foreground">Total: <strong>{formatCurrency(phaseTotalCost)}</strong></span>
                                <span className="text-muted-foreground">Landed: <strong>{formatCurrency(phaseLanded)}</strong></span>
                                <span className="text-muted-foreground">Dealer: <strong>{formatCurrency(phaseDealer)}</strong></span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {costFields.map(({ key, label }) => (
                                  <div key={key} className="space-y-0.5">
                                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-7 text-xs"
                                      value={overrides[key] ?? ""}
                                      placeholder={String(toNum((form as unknown as Record<string, string>)[key]) ?? "")}
                                      onChange={(e) => updatePhaseCostField(phase.id, key, e.target.value)}
                                      onBlur={() => savePhaseCost(phase.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}

              {/* Summary */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-1.5 space-y-1.5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Summary</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Garmenting</span>
                    <div className="font-semibold">{formatCurrency(totalGarmenting)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Fabric Cost/Piece</span>
                    <div className="font-semibold">{formatCurrency(fabricCostPerPiece)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Cost/Piece</span>
                    <div className="font-semibold">{formatCurrency(totalCost)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Total Landed Cost</span>
                    <div className="font-semibold">{formatCurrency(totalLanded)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Dealer Price (50%)</span>
                    <div className="font-semibold">{formatCurrency(dealerPrice)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Profit Margin</span>
                    <div className="font-semibold">{formatPercent(profitMargin)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <div className="flex gap-2 w-full">
            {/* Wizard navigation for create mode */}
            {!isEdit && step > 1 && (
              <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isEdit && step < 3 && (
              <Button
                size="lg"
                className="flex-1"
                onClick={() => {
                  if (step === 1) {
                    if (!form.type.trim()) { toast.error("Type is required"); return; }
                    if (!form.gender) { toast.error("Gender is required"); return; }
                    if (!form.fabricName.trim()) { toast.error("Fabric is required"); return; }
                  }
                  if (step === 2 && skuEntries.length === 0) {
                    toast.error("Select at least one colour");
                    return;
                  }
                  setStep(step + 1);
                }}
              >
                Next
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {!isEdit && step === 3 && (
              <Button size="lg" onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating {skuEntries.length} variant(s)...
                  </>
                ) : (
                  `Create ${skuEntries.length} variant(s)`
                )}
              </Button>
            )}
            {/* Edit mode buttons */}
            {isEdit && (
              <>
                <Button size="lg" onClick={handleSubmit} disabled={submitting || archiving} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Article"
                  )}
                </Button>
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
                      {isArchived ? "Unarchive" : "Archive"}
                    </>
                  )}
                </Button>
              </>
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
                Delete this article and all its variants permanently? This cannot be undone.
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
