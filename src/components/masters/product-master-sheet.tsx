"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
import { cn } from "@/lib/utils";
import {
  createProductMaster,
  updateProductMaster,
  deleteProductMaster,
  batchCreateProductMasters,
  getNextStyleSequence,
  getArticleBom,
  checkSkuCodeExists,
  setArticleCleaned,
} from "@/actions/product-masters";
import { FEATURES } from "@/lib/feature-flags";
import { getFabricMasterColours } from "@/actions/fabric-masters";
import { getPhaseCosts, upsertPhaseCost, deletePhaseCost } from "@/actions/phase-costs";
import { getPhaseFabrics, upsertPhaseFabric, deletePhaseFabric } from "@/actions/phase-fabrics";
import { articleIntroductionPhaseNumber } from "@/lib/article-history";
import { GENDER_LABELS } from "@/lib/constants";
import { sizeLabelForGender } from "@/lib/size-labels";
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
import { Loader2, ChevronsUpDown, Archive, Plus, Trash2, ArrowLeft, ArrowRight, Lock, Unlock } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

// Gender prefix for SKU code: MENS→M, WOMENS→W, KIDS→K
const GENDER_PREFIX: Record<string, string> = { MENS: "M", WOMENS: "W", KIDS: "K" };

/**
 * Renders the sheet title at 20px and shrinks font-size step-by-step (down to
 * 12px) until it fits on a single line.
 */
function AutoFitTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [fontPx, setFontPx] = useState(16);

  useLayoutEffect(() => {
    setFontPx(16);
  }, [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth && fontPx > 12) {
      setFontPx((f) => Math.max(12, f - 1));
    }
  }, [fontPx, text]);

  return (
    <SheetTitle
      ref={ref}
      className="font-semibold whitespace-nowrap overflow-hidden"
      style={{ fontSize: `${fontPx}px`, lineHeight: 1.2 }}
    >
      {text}
    </SheetTitle>
  );
}

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
  skus: { id: string; skuCode: string; colour: string; colour2: string; colour3?: string; colour4?: string; isStrikedThrough: boolean; previousSkuCodes?: string[] }[];
  previousTypes?: string[];
  archivedSkus?: { id: string; skuCode: string; colour: string; colour2: string; colour3?: string; colour4?: string }[];
  manuallyCleanedAt?: Date | string | null;
  fabric3Name?: string | null;
  fabric4Name?: string | null;
  garmentsPerKg3?: number | null;
  garmentsPerKg4?: number | null;
  fabric3CostPerKg?: number | null;
  fabric4CostPerKg?: number | null;
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
  garmentingAt: string | null;
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
  fabric3Name: string;
  fabric4Name: string;
  type: string;
  gender: string;
  productName: string;
  garmentsPerKg: string;
  garmentsPerKg2: string;
  garmentsPerKg3: string;
  garmentsPerKg4: string;
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
  fabric3CostPerKg: string;
  fabric4CostPerKg: string;
  inwardShipping: string;
  proposedMrp: string;
  onlineMrp: string;
  garmentingAt: string;
};

const emptyStyleForm: StyleFormData = {
  styleNumber: "",
  articleNumber: "",
  fabricName: "",
  fabric2Name: "",
  fabric3Name: "",
  fabric4Name: "",
  type: "",
  gender: "MENS",
  productName: "",
  garmentsPerKg: "",
  garmentsPerKg2: "",
  garmentsPerKg3: "",
  garmentsPerKg4: "",
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
  fabric3CostPerKg: "",
  fabric4CostPerKg: "",
  inwardShipping: "",
  proposedMrp: "",
  onlineMrp: "",
  garmentingAt: "",
};

type SkuEntry = { colour: string; colour2?: string; colour3?: string; colour4?: string; skuCode: string };

const SECTIONS = ["productInfo", "fabric", "colours", "garmentingCosts", "pricing", "accessories", "phaseCosts", "phaseFabrics"] as const;
type SectionName = (typeof SECTIONS)[number];

type FabricData = { name: string; mrp: number | null };
type Phase = { id: string; name: string; number: number };
type ProductTypeWithCode = { name: string; code: string };
type ColourWithCode = { name: string; code: string };

type AccessoryOption = { id: string; label: string; unit: string };
type BomLine = { accessoryId: string; quantityPerPiece: string; applicableSizes: string[] };

const BOM_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

/**
 * Compact size picker for a BOM line. Empty array means "applies to all
 * sizes" — the row is shipped for every size produced. Selecting one or more
 * sizes restricts the line to just those.
 */
function BomSizeSelector({
  value,
  onChange,
  gender,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  gender?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Reposition relative to the trigger and re-render via portal so the
  // popover isn't clipped by the parent Sheet's overflow.
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 144;
    const popoverHeight = 200;
    const margin = 4;
    let top = rect.bottom + margin;
    if (top + popoverHeight > window.innerHeight) {
      top = Math.max(margin, rect.top - popoverHeight - margin);
    }
    const left = Math.min(
      Math.max(margin, rect.right - popoverWidth),
      window.innerWidth - popoverWidth - margin,
    );
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleResize() {
      updatePosition();
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleResize, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleResize, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updatePosition]);

  const label =
    value.length === 0
      ? "All sizes"
      : value.map((s) => sizeLabelForGender(gender, s)).join(", ");

  function toggle(size: string) {
    if (value.includes(size)) onChange(value.filter((s) => s !== size));
    else onChange([...BOM_SIZE_OPTIONS].filter((s) => s === size || value.includes(s)));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-7 min-w-[5.5rem] max-w-[8rem] shrink-0 truncate rounded border px-1.5 text-[10px]",
          value.length === 0 ? "text-muted-foreground" : "text-foreground",
        )}
        title={value.length === 0 ? "Applies to all sizes" : `Applies only to: ${value.map((s) => sizeLabelForGender(gender, s)).join(", ")}`}
      >
        {label}
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-[1000] w-36 rounded-md border bg-popover p-1 shadow-md"
          >
            {BOM_SIZE_OPTIONS.map((s) => {
              const checked = value.includes(s);
              return (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s)}
                    className="h-3 w-3"
                  />
                  <span>{sizeLabelForGender(gender, s)}</span>
                </label>
              );
            })}
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 w-full rounded px-2 py-1 text-left text-[10px] text-muted-foreground hover:bg-accent"
              >
                Clear (apply to all)
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

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
  accessories = [],
  garmentingLocations = [],
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
  accessories?: AccessoryOption[];
  garmentingLocations?: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<StyleFormData>({ ...emptyStyleForm });
  const [skuEntries, setSkuEntries] = useState<SkuEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [markingClean, setMarkingClean] = useState(false);
  const [cleanedAt, setCleanedAt] = useState<Date | string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  // Per-phase override for how many fabric slots to show in the editor. The
  // segments view computes a baseline (slots actually in use across master +
  // all changes); the user can bump this up via "+ Add fabric slot".
  const [extraFabricSlots, setExtraFabricSlots] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isEdit = editingRow !== null;

  // Wizard step: 1 = style info + fabric, 2 = colours + SKU preview, 3 = costs
  const [step, setStep] = useState(1);

  // Fabric colours from fabric master
  const [fabricColours, setFabricColours] = useState<string[]>([]);
  const [loadingFabricColours, setLoadingFabricColours] = useState(false);
  const [fabric2Colours, setFabric2Colours] = useState<string[]>([]);
  const [loadingFabric2Colours, setLoadingFabric2Colours] = useState(false);
  const [fabric3Colours, setFabric3Colours] = useState<string[]>([]);
  const [loadingFabric3Colours, setLoadingFabric3Colours] = useState(false);
  const [fabric4Colours, setFabric4Colours] = useState<string[]>([]);
  const [loadingFabric4Colours, setLoadingFabric4Colours] = useState(false);
  // How many fabric slots are visible in the form (1-4). Driven by "Add fabric" button.
  const [visibleFabricCount, setVisibleFabricCount] = useState<number>(1);
  // Per-fabric selected colours for the 3+ fabric flow. Source of truth for chip selection,
  // independent of skuEntries so partial selections can be reflected before all fabrics have picks.
  const [multiFabricSelections, setMultiFabricSelections] = useState<string[][]>([[], [], [], []]);

  // Cached sequence number for step 2 (pre-fetched on Next to avoid per-combo fetches)
  const [resolvedSeqNum, setResolvedSeqNum] = useState<number | null>(null);

  // SKU duplicate detection: keyed by skuCode string
  const [skuDupeStatus, setSkuDupeStatus] = useState<Record<string, "idle" | "checking" | "ok" | "duplicate">>({});
  const dupeCheckTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Phase cost overrides
  const [phaseCostOverrides, setPhaseCostOverrides] = useState<Record<string, Record<string, string>>>({});

  // Phase fabric overrides (per-phase fabric history; mirrors phase-cost pattern)
  const [phaseFabricOverrides, setPhaseFabricOverrides] = useState<Record<string, Record<string, string>>>({});

  // BOM lines (article-level — applied to every SKU on save)
  const [bomLines, setBomLines] = useState<BomLine[]>([]);

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
          fabric3Name: s(editingRow.fabric3Name),
          fabric4Name: s(editingRow.fabric4Name),
          type: s(editingRow.type),
          gender: s(editingRow.gender) || "MENS",
          productName: s(editingRow.productName),
          garmentsPerKg: s(editingRow.garmentsPerKg),
          garmentsPerKg2: s(editingRow.garmentsPerKg2),
          garmentsPerKg3: s(editingRow.garmentsPerKg3),
          garmentsPerKg4: s(editingRow.garmentsPerKg4),
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
          fabric3CostPerKg: s(editingRow.fabric3CostPerKg),
          fabric4CostPerKg: s(editingRow.fabric4CostPerKg),
          inwardShipping: s(editingRow.inwardShipping),
          proposedMrp: s(editingRow.proposedMrp),
          onlineMrp: s(editingRow.onlineMrp),
          garmentingAt: s(editingRow.garmentingAt),
        });
        setSkuEntries(
          editingRow.skus.map((sku) => ({
            colour: sku.colour,
            colour2: sku.colour2 || undefined,
            colour3: sku.colour3 || undefined,
            colour4: sku.colour4 || undefined,
            skuCode: sku.skuCode,
          }))
        );
        // Fetch fabric colours
        if (editingRow.fabricName) {
          getFabricMasterColours(editingRow.fabricName).then(setFabricColours).catch(() => {});
        }
        if (editingRow.fabric2Name) {
          getFabricMasterColours(editingRow.fabric2Name).then(setFabric2Colours).catch(() => {});
        }
        if (editingRow.fabric3Name) {
          getFabricMasterColours(editingRow.fabric3Name).then(setFabric3Colours).catch(() => {});
        }
        if (editingRow.fabric4Name) {
          getFabricMasterColours(editingRow.fabric4Name).then(setFabric4Colours).catch(() => {});
        }
        // Show as many slots as the article actually uses (min 2 to keep current UX)
        const slots = editingRow.fabric4Name ? 4 : editingRow.fabric3Name ? 3 : editingRow.fabric2Name ? 2 : 1;
        setVisibleFabricCount(slots);
        setCleanedAt(editingRow.manuallyCleanedAt ?? null);
        // Derive per-fabric selections from existing SKUs for the 3+ flow
        const derive = (i: number) =>
          Array.from(new Set(editingRow.skus.map((s) =>
            (i === 1 ? s.colour : i === 2 ? s.colour2 : i === 3 ? s.colour3 : s.colour4) || ""
          ).filter(Boolean)));
        setMultiFabricSelections([derive(1), derive(2), derive(3), derive(4)]);
      } else {
        setForm({ ...emptyStyleForm });
        setSkuEntries([]);
        setFabricColours([]);
        setFabric2Colours([]);
        setFabric3Colours([]);
        setFabric4Colours([]);
        setVisibleFabricCount(1);
        setMultiFabricSelections([[], [], [], []]);
        setCleanedAt(null);
      }
      setSkuDupeStatus({});
      setResolvedSeqNum(null);
      setPhaseCostOverrides({});
      setPhaseFabricOverrides({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRow]);

  // Load BOM lines for edit (article-level — fetched from ArticleAccessory by articleNumber).
  useEffect(() => {
    if (open && FEATURES.accessories && editingRow && editingRow.articleNumber) {
      getArticleBom(editingRow.articleNumber)
        .then((links) => {
          setBomLines(
            (links as Array<{ accessoryId: string; quantityPerPiece: unknown; applicableSizes?: string[] }>).map((l) => ({
              accessoryId: l.accessoryId,
              quantityPerPiece: String(l.quantityPerPiece ?? ""),
              applicableSizes: Array.isArray(l.applicableSizes) ? l.applicableSizes : [],
            }))
          );
        })
        .catch(() => setBomLines([]));
    } else if (open && !editingRow) {
      setBomLines([]);
    }
  }, [open, editingRow]);

  function addBomLine() {
    setBomLines((prev) => [...prev, { accessoryId: "", quantityPerPiece: "", applicableSizes: [] }]);
  }
  function updateBomLine(idx: number, patch: Partial<BomLine>) {
    setBomLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeBomLine(idx: number) {
    setBomLines((prev) => prev.filter((_, i) => i !== idx));
  }

  // Load phase costs for edit
  useEffect(() => {
    if (open && editingRow && editingRow.skus.length > 0) {
      getPhaseCosts("PRODUCT_MASTER", editingRow.skus[0].id).then((costs) => {
        const overrides: Record<string, Record<string, string>> = {};
        for (const c of costs) {
          const values: Record<string, string> = {};
          for (const f of PHASE_COST_FIELDS) {
            const val = (c as Record<string, unknown>)[f];
            if (val != null) values[f] = String(val);
          }
          overrides[c.phaseId] = values;
        }
        setPhaseCostOverrides(overrides);
      }).catch(() => {});
    }
  }, [open, editingRow]);

  // All cost fields tracked in the PhaseCost changelog.
  const PHASE_COST_FIELDS = [
    "fabricCostPerKg", "fabric2CostPerKg",
    "stitchingCost", "brandLogoCost", "neckTwillCost", "reflectorsCost",
    "fusingCost", "accessoriesCost", "brandTagCost", "sizeTagCost",
    "packagingCost", "inwardShipping",
  ] as const;

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
    // Persist every changelog field (null = "no change at this phase").
    for (const f of PHASE_COST_FIELDS) {
      const val = values[f] ?? "";
      data[f] = val.trim() === "" ? null : Number(val);
    }
    try {
      await upsertPhaseCost(phaseId, "PRODUCT_MASTER", editingRow.skus[0].id, data);
      toast.success("Cost change saved");
    } catch {
      toast.error("Failed to save cost change");
    }
  }

  async function removePhaseCost(phaseId: string) {
    if (!editingRow || editingRow.skus.length === 0) return;
    try {
      await deletePhaseCost(phaseId, "PRODUCT_MASTER", editingRow.skus[0].id);
      setPhaseCostOverrides((prev) => {
        const next = { ...prev };
        delete next[phaseId];
        return next;
      });
      toast.success("Cost change removed");
    } catch {
      toast.error("Failed to remove cost change");
    }
  }

  function addPhaseCostRow(phaseId: string) {
    setPhaseCostOverrides((prev) => ({ ...prev, [phaseId]: prev[phaseId] ?? {} }));
    setExpandedPhases((prev) => ({ ...prev, [`cost:${phaseId}`]: true }));
  }

  // PhaseFabric changelog rows loaded for the article. Keyed by phaseId.
  // Under changelog semantics each row is "as of this phase, these fields
  // changed" (non-null = change, null = no change in this slot).
  const PHASE_FABRIC_FIELDS = [
    "fabricName", "fabricVendorId", "fabricCostPerKg", "garmentsPerKg",
    "fabric2Name", "fabric2VendorId", "fabric2CostPerKg", "garmentsPerKg2",
    "fabric3Name", "fabric3VendorId", "fabric3CostPerKg", "garmentsPerKg3",
    "fabric4Name", "fabric4VendorId", "fabric4CostPerKg", "garmentsPerKg4",
  ] as const;

  useEffect(() => {
    if (open && editingRow && editingRow.skus.length > 0) {
      getPhaseFabrics(editingRow.skus[0].id).then((rows) => {
        const overrides: Record<string, Record<string, string>> = {};
        for (const r of rows) {
          const values: Record<string, string> = {};
          for (const f of PHASE_FABRIC_FIELDS) {
            const val = (r as Record<string, unknown>)[f];
            if (val != null) values[f] = String(val);
          }
          // Keep the row even if all values are null — represents an
          // explicitly-empty change entry the user just added.
          overrides[r.phaseId] = values;
        }
        setPhaseFabricOverrides(overrides);
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRow]);

  function updatePhaseFabricField(phaseId: string, field: string, value: string) {
    setPhaseFabricOverrides((prev) => ({
      ...prev,
      [phaseId]: { ...(prev[phaseId] || {}), [field]: value },
    }));
  }

  async function savePhaseFabric(phaseId: string, valuesOverride?: Record<string, string>) {
    if (!editingRow || editingRow.skus.length === 0) return;
    const values = valuesOverride ?? phaseFabricOverrides[phaseId] ?? {};
    const stringFields = new Set([
      "fabricName", "fabricVendorId", "fabric2Name", "fabric2VendorId",
      "fabric3Name", "fabric3VendorId", "fabric4Name", "fabric4VendorId",
    ]);
    const data: Record<string, string | number | null> = {};
    // Persist ALL changelog fields, including the ones the user blanked out —
    // null in the row means "no change at this phase, inherit from previous."
    for (const f of PHASE_FABRIC_FIELDS) {
      const val = values[f] ?? "";
      if (val.trim() === "") {
        data[f] = null;
      } else if (stringFields.has(f)) {
        data[f] = val;
      } else {
        data[f] = Number(val);
      }
    }
    try {
      await upsertPhaseFabric(phaseId, editingRow.skus[0].id, data);
      toast.success("Fabric change saved");
    } catch {
      toast.error("Failed to save fabric change");
    }
  }

  async function removePhaseFabric(phaseId: string) {
    if (!editingRow || editingRow.skus.length === 0) return;
    try {
      await deletePhaseFabric(phaseId, editingRow.skus[0].id);
      setPhaseFabricOverrides((prev) => {
        const next = { ...prev };
        delete next[phaseId];
        return next;
      });
      toast.success("Fabric change removed");
    } catch {
      toast.error("Failed to remove fabric change");
    }
  }

  function addPhaseFabricRow(phaseId: string) {
    setPhaseFabricOverrides((prev) => ({ ...prev, [phaseId]: prev[phaseId] ?? {} }));
    setExpandedPhases((prev) => ({ ...prev, [`fabric:${phaseId}`]: true }));
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
    if (value) {
      setLoadingFabric2Colours(true);
      getFabricMasterColours(value)
        .then(setFabric2Colours)
        .catch(() => setFabric2Colours([]))
        .finally(() => setLoadingFabric2Colours(false));
    } else {
      setFabric2Colours([]);
    }
    // Clear entries in create mode since the combo structure changes
    if (!isEdit) {
      setSkuEntries([]);
      setSkuDupeStatus({});
      setMultiFabricSelections([[], [], [], []]);
    }
  }

  function handleFabric3NameChange(value: string) {
    updateField("fabric3Name", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabric3CostPerKg", mrp != null ? String(mrp) : "");
    if (value) {
      setLoadingFabric3Colours(true);
      getFabricMasterColours(value)
        .then(setFabric3Colours)
        .catch(() => setFabric3Colours([]))
        .finally(() => setLoadingFabric3Colours(false));
    } else {
      setFabric3Colours([]);
    }
    if (!isEdit) {
      setSkuEntries([]);
      setSkuDupeStatus({});
      setMultiFabricSelections([[], [], [], []]);
    }
  }

  function handleFabric4NameChange(value: string) {
    updateField("fabric4Name", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabric4CostPerKg", mrp != null ? String(mrp) : "");
    if (value) {
      setLoadingFabric4Colours(true);
      getFabricMasterColours(value)
        .then(setFabric4Colours)
        .catch(() => setFabric4Colours([]))
        .finally(() => setLoadingFabric4Colours(false));
    } else {
      setFabric4Colours([]);
    }
    if (!isEdit) {
      setSkuEntries([]);
      setSkuDupeStatus({});
      setMultiFabricSelections([[], [], [], []]);
    }
  }

  // Generate SKU code for a colour (or multi-colour combo)
  function generateSkuCode(
    colour: string,
    seqNum: number,
    colour2?: string,
    colour3?: string,
    colour4?: string
  ): string {
    const genderP = GENDER_PREFIX[form.gender] || "M";
    const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
    const codeFor = (c?: string) => (c ? (colourCodeMap.get(c) || c.slice(0, 3).toUpperCase()) : "");
    const seq = String(seqNum).padStart(2, "0");
    const parts = [colour, colour2, colour3, colour4].filter(Boolean).map(codeFor);
    return `${genderP} ${typeCode}${seq} ${parts.join("-")}`;
  }

  function triggerDupeCheck(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    // In edit mode, codes that belong to this article's own SKUs (active or archived)
    // are not duplicates — they'll match themselves on update (and un-archive if needed).
    if (
      isEdit &&
      (editingRow?.skus.some((s) => s.skuCode === trimmed) ||
        editingRow?.archivedSkus?.some((s) => s.skuCode === trimmed))
    ) {
      setSkuDupeStatus((prev) => ({ ...prev, [code]: "ok" }));
      return;
    }
    if (dupeCheckTimers.current[code]) clearTimeout(dupeCheckTimers.current[code]);
    setSkuDupeStatus((prev) => ({ ...prev, [code]: "checking" }));
    dupeCheckTimers.current[code] = setTimeout(async () => {
      try {
        const exists = await checkSkuCodeExists(trimmed);
        setSkuDupeStatus((prev) => ({ ...prev, [code]: exists ? "duplicate" : "ok" }));
      } catch {
        setSkuDupeStatus((prev) => ({ ...prev, [code]: "idle" }));
      }
    }, 400);
  }

  // Add colours and auto-generate SKU codes (single-colour entries only — no colour2)
  async function handleColoursSelected(selectedColours: string[]) {
    const existingSingleColours = new Set(skuEntries.filter((e) => !e.colour2).map((e) => e.colour));
    const newColours = selectedColours.filter((c) => !existingSingleColours.has(c));
    const removedColours = new Set(Array.from(existingSingleColours).filter((c) => !selectedColours.includes(c)));

    // Keep combo entries untouched; only remove deselected single-colour entries
    let updated = skuEntries.filter((e) => e.colour2 || !removedColours.has(e.colour));

    if (newColours.length > 0) {
      let seqNum: number;
      if (updated.length > 0) {
        seqNum = parseInt(updated[0].skuCode.match(/\d+/)?.[0] || "1", 10);
      } else if (resolvedSeqNum !== null) {
        seqNum = resolvedSeqNum;
      } else {
        const genderP = GENDER_PREFIX[form.gender] || "M";
        const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
        try {
          seqNum = await getNextStyleSequence(genderP, typeCode);
        } catch {
          seqNum = 1;
        }
      }

      for (const colour of newColours) {
        const entry: SkuEntry = { colour, skuCode: generateSkuCode(colour, seqNum) };
        updated.push(entry);
        triggerDupeCheck(entry.skuCode);
      }
    }
    setSkuEntries(updated);
  }

  // Multi-fabric flow (3+ fabrics): toggle a colour in one fabric's selection list, then
  // regenerate the cross-product of combos if every visible fabric has at least one selection.
  // Per-fabric selection state is kept separately so partial selections show in the UI.
  async function handleMultiFabricToggle(fabricIdx: number, colour: string) {
    const idx = fabricIdx - 1;
    const nextSelections: string[][] = multiFabricSelections.map((arr) => [...arr]);
    if (nextSelections[idx].includes(colour)) {
      nextSelections[idx] = nextSelections[idx].filter((c) => c !== colour);
    } else {
      nextSelections[idx] = [...nextSelections[idx], colour];
    }
    setMultiFabricSelections(nextSelections);

    const active = nextSelections.slice(0, visibleFabricCount);
    if (active.some((a) => a.length === 0)) {
      setSkuEntries([]);
      return;
    }
    let seqNum: number;
    if (skuEntries.length > 0) {
      seqNum = parseInt(skuEntries[0].skuCode.match(/\d+/)?.[0] || "1", 10);
    } else if (resolvedSeqNum !== null) {
      seqNum = resolvedSeqNum;
    } else {
      const genderP = GENDER_PREFIX[form.gender] || "M";
      const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
      try {
        seqNum = await getNextStyleSequence(genderP, typeCode);
      } catch {
        seqNum = 1;
      }
    }
    const prevCodeByKey = new Map<string, string>();
    for (const e of skuEntries) {
      const key = [e.colour, e.colour2 || "", e.colour3 || "", e.colour4 || ""].join("|");
      prevCodeByKey.set(key, e.skuCode);
    }
    const cartesian = (arrs: string[][]): string[][] =>
      arrs.reduce<string[][]>((acc, arr) => acc.flatMap((p) => arr.map((v) => [...p, v])), [[]]);
    const newEntries: SkuEntry[] = cartesian(active).map((combo) => {
      const [c1, c2, c3, c4] = combo;
      const key = [c1, c2 || "", c3 || "", c4 || ""].join("|");
      const code = prevCodeByKey.get(key) || generateSkuCode(c1, seqNum, c2, c3, c4);
      return { colour: c1, colour2: c2, colour3: c3, colour4: c4, skuCode: code };
    });
    newEntries.forEach((e) => triggerDupeCheck(e.skuCode));
    setSkuEntries(newEntries);
  }

  // Toggle a 2-fabric colour combo on/off
  async function handleComboToggle(colour1: string, colour2: string) {
    const existingIdx = skuEntries.findIndex((e) => e.colour === colour1 && e.colour2 === colour2);
    if (existingIdx >= 0) {
      setSkuEntries((prev) => prev.filter((_, i) => i !== existingIdx));
      return;
    }
    let seqNum: number;
    if (skuEntries.length > 0) {
      seqNum = parseInt(skuEntries[0].skuCode.match(/\d+/)?.[0] || "1", 10);
    } else if (resolvedSeqNum !== null) {
      seqNum = resolvedSeqNum;
    } else {
      const genderP = GENDER_PREFIX[form.gender] || "M";
      const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
      try {
        seqNum = await getNextStyleSequence(genderP, typeCode);
      } catch {
        seqNum = 1;
      }
    }
    const entry: SkuEntry = { colour: colour1, colour2, skuCode: generateSkuCode(colour1, seqNum, colour2) };
    setSkuEntries((prev) => [...prev, entry]);
    triggerDupeCheck(entry.skuCode);
  }

  function updateSkuCode(index: number, newCode: string) {
    const upper = newCode.toUpperCase();
    setSkuEntries((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], skuCode: upper };
      return copy;
    });
    triggerDupeCheck(upper);
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
    if (!form.garmentingAt.trim()) {
      toast.error("Garmenting At is required");
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

    // Block submission if any SKU code is flagged as already existing.
    // In edit mode, skip codes that belong to this article's own existing SKUs
    // (since those were loaded from DB and will legitimately match themselves on update).
    const ownSkuCodes = new Set(
      isEdit
        ? [
            ...(editingRow?.skus.map((s) => s.skuCode) ?? []),
            ...(editingRow?.archivedSkus?.map((s) => s.skuCode) ?? []),
          ]
        : []
    );
    const duplicateEntry = skuEntries.find(
      (e) => skuDupeStatus[e.skuCode] === "duplicate" && !ownSkuCodes.has(e.skuCode)
    );
    if (duplicateEntry) {
      toast.error(`Article code "${duplicateEntry.skuCode}" already exists. Change it to a unique code before saving.`);
      return;
    }

    setSubmitting(true);
    try {
      // Build BOM payload (only valid lines with both fields). Replicated across all SKUs.
      const bomPayload = FEATURES.accessories
        ? bomLines
            .filter((l) => l.accessoryId && l.quantityPerPiece && Number(l.quantityPerPiece) > 0)
            .map((l) => ({
              accessoryId: l.accessoryId,
              quantityPerPiece: Number(l.quantityPerPiece),
              applicableSizes: l.applicableSizes,
            }))
        : undefined;

      const sharedPayload = {
        styleNumber: form.styleNumber || form.articleNumber || skuEntries[0]?.skuCode?.split(" ").slice(0, 2).join(" ") || "",
        articleNumber: form.articleNumber || null,
        fabricName: form.fabricName,
        fabric2Name: form.fabric2Name || null,
        fabric3Name: form.fabric3Name || null,
        fabric4Name: form.fabric4Name || null,
        type: form.type,
        gender: form.gender || "MENS",
        productName: form.productName || null,
        colours2Available: [] as string[], // overridden per-entry below
        colours3Available: [] as string[],
        colours4Available: [] as string[],
        garmentsPerKg: toNum(form.garmentsPerKg),
        garmentsPerKg2: toNum(form.garmentsPerKg2),
        garmentsPerKg3: toNum(form.garmentsPerKg3),
        garmentsPerKg4: toNum(form.garmentsPerKg4),
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
        fabric3CostPerKg: toNum(form.fabric3CostPerKg),
        fabric4CostPerKg: toNum(form.fabric4CostPerKg),
        inwardShipping: toNum(form.inwardShipping),
        proposedMrp: toNum(form.proposedMrp),
        onlineMrp: toNum(form.onlineMrp),
        garmentingAt: form.garmentingAt || null,
      };

      if (isEdit) {
        // Match by skuCode first, then by full colour tuple. Also look in archivedSkus so that
        // re-adding a previously-archived variant un-archives the existing row instead of
        // colliding on the unique skuCode constraint.
        const matchEntry = (
          s: { skuCode: string; colour: string; colour2: string; colour3?: string; colour4?: string },
          entry: SkuEntry
        ) => {
          if (s.skuCode === entry.skuCode) return true;
          return (
            s.colour === entry.colour &&
            (s.colour2 || "") === (entry.colour2 || "") &&
            (s.colour3 || "") === (entry.colour3 || "") &&
            (s.colour4 || "") === (entry.colour4 || "")
          );
        };

        let phaseHistoryWarning = false;
        for (const entry of skuEntries) {
          const active = editingRow.skus.find((s) => matchEntry(s, entry));
          const archived = !active ? editingRow.archivedSkus?.find((s) => matchEntry(s, entry)) : null;
          const existingSku = active || archived;
          const coloursPayload = {
            coloursAvailable: [entry.colour],
            colours2Available: entry.colour2 ? [entry.colour2] : [],
            colours3Available: entry.colour3 ? [entry.colour3] : [],
            colours4Available: entry.colour4 ? [entry.colour4] : [],
          };
          if (existingSku) {
            const res = await updateProductMaster(existingSku.id, {
              ...sharedPayload,
              skuCode: entry.skuCode,
              ...coloursPayload,
              // Un-archive if we're reviving a previously archived SKU
              ...(archived ? { isStrikedThrough: false } : {}),
              ...(bomPayload !== undefined ? { bomLines: bomPayload } : {}),
            });
            if (res && (res as { _phaseHistoryWarning?: boolean })._phaseHistoryWarning) {
              phaseHistoryWarning = true;
            }
          } else {
            await createProductMaster({
              ...sharedPayload,
              skuCode: entry.skuCode,
              ...coloursPayload,
              ...(bomPayload !== undefined ? { bomLines: bomPayload } : {}),
            });
          }
        }
        // Archive SKUs that were removed (keyed by skuCode to handle 2-fabric combos correctly)
        const keptSkuCodes = new Set(skuEntries.map((e) => e.skuCode));
        for (const sku of editingRow.skus) {
          if (!keptSkuCodes.has(sku.skuCode) && !sku.isStrikedThrough) {
            await updateProductMaster(sku.id, { isStrikedThrough: true });
          }
        }
        toast.success("Article updated");
        if (phaseHistoryWarning) {
          toast.warning(
            "Fabric / cost changes saved on master but NOT recorded to phase history — no phase is marked current.",
            { duration: 8000 },
          );
        }
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

  async function handleToggleCleaned() {
    if (!editingRow) return;
    const articleKey = editingRow.articleNumber || editingRow.styleNumber;
    if (!articleKey) {
      toast.error("Article number missing");
      return;
    }
    const nextState = !cleanedAt;
    setMarkingClean(true);
    try {
      const res = await setArticleCleaned(articleKey, nextState);
      setCleanedAt(res.manuallyCleanedAt);
      toast.success(nextState ? "Marked as manually cleaned" : "Unmarked as cleaned");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to update clean flag: ${msg}`);
    } finally {
      setMarkingClean(false);
    }
  }

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
  const selectedSingleColours = skuEntries.filter((e) => !e.colour2).map((e) => e.colour);

  // Lookup previousSkuCodes for the SKU rows (matches editingRow.skus by current skuCode).
  const previousSkuCodesByCurrent: Record<string, string[]> = {};
  if (editingRow?.skus) {
    for (const s of editingRow.skus) {
      if (s.previousSkuCodes && s.previousSkuCodes.length > 0) {
        previousSkuCodesByCurrent[s.skuCode] = s.previousSkuCodes;
      }
    }
  }
  const previousTypes = editingRow?.previousTypes ?? [];

  // For create mode: wizard steps
  // For edit mode: all sections visible (collapsible)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto border-t-4 border-t-amber-400">
        <SheetHeader className="pr-12 pb-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <AutoFitTitle
                text={(() => {
                  if (!isEdit && step === 1) return "New Article";
                  const parts = [
                    form.articleNumber,
                    form.type,
                    form.productName,
                    GENDER_LABELS[form.gender] || form.gender,
                  ].filter((p) => p && String(p).trim());
                  if (parts.length > 0) return parts.join(" - ");
                  return isEdit ? (editingRow.articleNumber || editingRow.styleNumber || "Article") : "New Article";
                })()}
              />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Master</span>
            {cleanedAt && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded inline-flex items-center gap-1 shrink-0"
                title={`Cleaned on ${new Date(cleanedAt).toLocaleString()}`}
              >
                <Lock className="h-2.5 w-2.5" />
                Cleaned
              </span>
            )}
          </div>
          <SheetDescription className="sr-only">
            {isEdit ? "Edit article master" : "Create article master"}
          </SheetDescription>
          {previousTypes.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              <span>previously: </span>
              <span>{previousTypes.join(", ")}</span>
            </div>
          )}
        </SheetHeader>
        <div className="flex items-center px-4 pb-1 -mt-1">
          {isEdit ? (
            <button
              type="button"
              onClick={() => setAllSections(allExpanded ? false : true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:bg-muted/50 shrink-0"
            >
              <ChevronsUpDown className="h-3 w-3" />
              {allExpanded ? "Collapse All" : allCollapsed ? "Expand All" : "Collapse All"}
            </button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={step >= 1 ? "text-amber-600 font-semibold" : ""}>Article</span>
              <span>→</span>
              <span className={step >= 2 ? "text-amber-600 font-semibold" : ""}>Colours</span>
              <span>→</span>
              <span className={step >= 3 ? "text-amber-600 font-semibold" : ""}>Costs</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-5 px-4 overflow-y-auto [&>div:nth-child(even)]:bg-muted/30">
          {/* ─── CREATE MODE: WIZARD ─── */}
          {!isEdit && step === 1 && (
            <>
              <CollapsibleSection title="Product Info" expanded onToggle={() => {}}>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Article # *</Label>
                    <Input className="h-8 text-xs" value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} autoFocus placeholder="e.g. 3115" />
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
                <div className="grid grid-cols-3 gap-2">
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
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garmenting At *</Label>
                    <Combobox
                      value={form.garmentingAt}
                      onValueChange={(v) => updateField("garmentingAt", v)}
                      options={garmentingLocations}
                      placeholder="Select location..."
                    />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="Fabric" expanded onToggle={() => {}}>
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
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
                  <div className="w-8" />
                </div>
                {visibleFabricCount >= 2 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
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
                    {visibleFabricCount === 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          handleFabric2NameChange("");
                          setVisibleFabricCount(1);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {visibleFabricCount >= 3 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">3rd Fabric Name</Label>
                      <Combobox
                        value={form.fabric3Name}
                        onValueChange={handleFabric3NameChange}
                        options={fabricNames}
                        placeholder="Select fabric..."
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Cost/kg (Rs)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric3CostPerKg} onChange={(e) => updateField("fabric3CostPerKg", e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Garments/kg</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg3} onChange={(e) => updateField("garmentsPerKg3", e.target.value)} />
                    </div>
                    {visibleFabricCount === 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          handleFabric3NameChange("");
                          setVisibleFabricCount(2);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {visibleFabricCount >= 4 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">4th Fabric Name</Label>
                      <Combobox
                        value={form.fabric4Name}
                        onValueChange={handleFabric4NameChange}
                        options={fabricNames}
                        placeholder="Select fabric..."
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Cost/kg (Rs)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric4CostPerKg} onChange={(e) => updateField("fabric4CostPerKg", e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Garments/kg</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg4} onChange={(e) => updateField("garmentsPerKg4", e.target.value)} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => {
                        handleFabric4NameChange("");
                        setVisibleFabricCount(3);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {visibleFabricCount < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setVisibleFabricCount(visibleFabricCount + 1)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Fabric
                  </Button>
                )}
              </CollapsibleSection>
            </>
          )}

          {!isEdit && step === 2 && (
            <div className="space-y-3">
              {form.fabric3Name ? (
                /* ── 3+ fabric: stacked chip selectors, cross-product forms combos ── */
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Pick colours for each fabric. Every SKU will include one colour from every fabric (cross-product of selections).
                  </p>
                  {[1, 2, 3, 4].slice(0, visibleFabricCount).map((fabricIdx) => {
                    const fabricName = fabricIdx === 1 ? form.fabricName : fabricIdx === 2 ? form.fabric2Name : fabricIdx === 3 ? form.fabric3Name : form.fabric4Name;
                    const colours = fabricIdx === 1 ? fabricColours : fabricIdx === 2 ? fabric2Colours : fabricIdx === 3 ? fabric3Colours : fabric4Colours;
                    const loading = fabricIdx === 1 ? loadingFabricColours : fabricIdx === 2 ? loadingFabric2Colours : fabricIdx === 3 ? loadingFabric3Colours : loadingFabric4Colours;
                    if (!fabricName) return null;
                    const selected = multiFabricSelections[fabricIdx - 1] || [];
                    return (
                      <div key={fabricIdx} className="space-y-1.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
                        <Label className="text-[11px] font-semibold">
                          Fabric {fabricIdx}: {fabricName}
                        </Label>
                        {loading ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                          </p>
                        ) : colours.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No colours defined on &quot;{fabricName}&quot;. Define them on the fabric master first.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {colours.map((c) => {
                              const isSelected = selected.includes(c);
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => handleMultiFabricToggle(fabricIdx, c)}
                                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                    isSelected
                                      ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                                      : "bg-white border-border text-gray-600 hover:bg-muted/50"
                                  }`}
                                >
                                  {c}
                                  {colourCodeMap.get(c) && <span className="ml-1 text-[10px] opacity-60">({colourCodeMap.get(c)})</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : form.fabric2Name ? (
                /* ── 2-fabric: single-colour section + cross-product grid ── */
                <div className="space-y-4">
                  {/* Section 1: outside fabric only */}
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[11px] font-semibold">Outside Fabric Only</Label>
                      <p className="text-xs text-muted-foreground">
                        Single-colour variants from {form.fabricName} — e.g. {GENDER_PREFIX[form.gender] || "M"} {typeCodeMap.get(form.type) || "??"}## BLK
                      </p>
                    </div>
                    {loadingFabricColours ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {fabricColours.map((colour) => {
                          const isSelected = selectedSingleColours.includes(colour);
                          return (
                            <button
                              key={colour}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  handleColoursSelected(selectedSingleColours.filter((c) => c !== colour));
                                } else {
                                  handleColoursSelected([...selectedSingleColours, colour]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                isSelected
                                  ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                                  : "bg-white border-border text-gray-600 hover:bg-muted/50"
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
                  </div>

                  {/* Section 2: cross-product combos */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div>
                      <Label className="text-[11px] font-semibold">Outside + Inside Combos</Label>
                      <p className="text-xs text-muted-foreground">
                        {form.fabricName} × {form.fabric2Name} — e.g. {GENDER_PREFIX[form.gender] || "M"} {typeCodeMap.get(form.type) || "??"}## BLK-NVY
                      </p>
                    </div>
                    {loadingFabricColours || loadingFabric2Colours ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading colours...
                      </p>
                    ) : fabricColours.length === 0 || fabric2Colours.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {fabricColours.length === 0
                          ? `No colours on "${form.fabricName}"`
                          : `No colours on "${form.fabric2Name}"`}. Define colours on the fabric master first.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="text-xs border-collapse w-full">
                          <thead>
                            <tr>
                              <th className="text-right pr-3 py-1 text-[10px] text-muted-foreground font-normal w-28">outside ↓ / inside →</th>
                              {fabric2Colours.map((c2) => (
                                <th key={c2} className="px-2 py-1 text-center font-medium min-w-[52px]">
                                  <span className="block">{c2}</span>
                                  {colourCodeMap.get(c2) && (
                                    <span className="text-[10px] text-muted-foreground font-normal">{colourCodeMap.get(c2)}</span>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fabricColours.map((c1) => (
                              <tr key={c1} className="border-t border-border/40">
                                <td className="text-right pr-3 py-1 font-medium whitespace-nowrap">
                                  {c1}
                                  {colourCodeMap.get(c1) && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">({colourCodeMap.get(c1)})</span>
                                  )}
                                </td>
                                {fabric2Colours.map((c2) => {
                                  const isSelected = skuEntries.some((e) => e.colour === c1 && e.colour2 === c2);
                                  return (
                                    <td key={c2} className="px-1 py-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleComboToggle(c1, c2)}
                                        className={`w-9 h-9 rounded border text-[11px] font-medium transition-colors ${
                                          isSelected
                                            ? "bg-amber-100 border-amber-400 text-amber-800"
                                            : "bg-white border-border text-gray-400 hover:bg-muted/50"
                                        }`}
                                      >
                                        {isSelected ? "✓" : "+"}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Single-fabric: current colour picker flow ── */
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
                                : "bg-white border-border text-gray-600 hover:bg-muted/50"
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
              )}

              {skuEntries.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold">Generated Article Codes</Label>
                  <p className="text-xs text-muted-foreground">
                    Format: {GENDER_PREFIX[form.gender] || "?"} {typeCodeMap.get(form.type) || "??"}##
                    {form.fabric2Name ? " {CLR1}-{CLR2}" : " {CLR}"} — edit as needed
                  </p>
                  <div className="border rounded-lg divide-y">
                    {skuEntries.map((entry, i) => {
                      const dupeStatus = skuDupeStatus[entry.skuCode];
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <span className="text-xs font-medium w-28 shrink-0">
                            {entry.colour}
                            {entry.colour2 && <span className="text-muted-foreground"> / {entry.colour2}</span>}
                            {entry.colour3 && <span className="text-muted-foreground"> / {entry.colour3}</span>}
                            {entry.colour4 && <span className="text-muted-foreground"> / {entry.colour4}</span>}
                          </span>
                          <Input
                            value={entry.skuCode}
                            onChange={(e) => updateSkuCode(i, e.target.value)}
                            className={`flex-1 font-mono text-xs h-8 ${dupeStatus === "duplicate" ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                          />
                          {dupeStatus === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                          {dupeStatus === "duplicate" && <span className="text-[10px] text-red-500 shrink-0 font-medium">Exists</span>}
                          {dupeStatus === "ok" && <span className="text-[10px] text-green-600 shrink-0">✓</span>}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => removeSkuEntry(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
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
              <div className="rounded-lg border border-border border-l-4 border-l-primary px-2 py-1.5 space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase text-primary tracking-wider">Summary</h4>
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
                <div className="grid grid-cols-3 gap-2">
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
                  <div className="space-y-0.5">
                    <Label className="text-[11px]">Garmenting At *</Label>
                    <Combobox
                      value={form.garmentingAt}
                      onValueChange={(v) => updateField("garmentingAt", v)}
                      options={garmentingLocations}
                      placeholder="Select location..."
                    />
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Fabric"
                expanded={expandedSections.fabric}
                onToggle={() => toggleSection("fabric")}
              >
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
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
                  <div className="w-8" />
                </div>
                {visibleFabricCount >= 2 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
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
                    {visibleFabricCount === 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          handleFabric2NameChange("");
                          setVisibleFabricCount(1);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {visibleFabricCount >= 3 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">3rd Fabric Name</Label>
                      <Combobox
                        value={form.fabric3Name}
                        onValueChange={handleFabric3NameChange}
                        options={fabricNames}
                        placeholder="Select fabric..."
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Cost/kg (Rs)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric3CostPerKg} onChange={(e) => updateField("fabric3CostPerKg", e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Garments/kg</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg3} onChange={(e) => updateField("garmentsPerKg3", e.target.value)} />
                    </div>
                    {visibleFabricCount === 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => {
                          handleFabric3NameChange("");
                          setVisibleFabricCount(2);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {visibleFabricCount >= 4 && (
                  <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">4th Fabric Name</Label>
                      <Combobox
                        value={form.fabric4Name}
                        onValueChange={handleFabric4NameChange}
                        options={fabricNames}
                        placeholder="Select fabric..."
                      />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Cost/kg (Rs)</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.fabric4CostPerKg} onChange={(e) => updateField("fabric4CostPerKg", e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[11px]">Garments/kg</Label>
                      <Input className="h-8 text-xs" type="number" step="0.01" value={form.garmentsPerKg4} onChange={(e) => updateField("garmentsPerKg4", e.target.value)} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => {
                        handleFabric4NameChange("");
                        setVisibleFabricCount(3);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {visibleFabricCount < 4 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setVisibleFabricCount(visibleFabricCount + 1)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Fabric
                  </Button>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title={`Colour Variants (${skuEntries.length})`}
                expanded={expandedSections.colours}
                onToggle={() => toggleSection("colours")}
              >
                <div className="space-y-3">
                  {/* Current variants — removable chips */}
                  {skuEntries.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skuEntries.map((entry, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-amber-50 border-amber-300 text-amber-800 font-medium"
                        >
                          {entry.colour}
                          {entry.colour2 && <span className="text-amber-600 font-normal"> / {entry.colour2}</span>}
                          {entry.colour3 && <span className="text-amber-600 font-normal"> / {entry.colour3}</span>}
                          {entry.colour4 && <span className="text-amber-600 font-normal"> / {entry.colour4}</span>}
                          <button
                            type="button"
                            onClick={() => removeSkuEntry(i)}
                            className="ml-0.5 hover:text-red-600 transition-colors leading-none"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* SKU codes — editable */}
                  {skuEntries.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {skuEntries.map((entry, i) => {
                        const dupeStatus = skuDupeStatus[entry.skuCode];
                        const prevSkus = previousSkuCodesByCurrent[entry.skuCode] ?? [];
                        return (
                          <div key={i} className="flex flex-col gap-1 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium w-28 shrink-0">
                                {entry.colour}
                                {entry.colour2 && <span className="text-muted-foreground"> / {entry.colour2}</span>}
                                {entry.colour3 && <span className="text-muted-foreground"> / {entry.colour3}</span>}
                                {entry.colour4 && <span className="text-muted-foreground"> / {entry.colour4}</span>}
                              </span>
                              <Input
                                value={entry.skuCode}
                                onChange={(e) => updateSkuCode(i, e.target.value)}
                                className={`flex-1 font-mono text-xs h-8 ${dupeStatus === "duplicate" ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                              />
                              {dupeStatus === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                              {dupeStatus === "duplicate" && <span className="text-[10px] text-red-500 shrink-0 font-medium">Exists</span>}
                              {dupeStatus === "ok" && <span className="text-[10px] text-green-600 shrink-0">✓</span>}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => removeSkuEntry(i)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {prevSkus.length > 0 && (
                              <div className="pl-30 text-[10px] text-muted-foreground">
                                <span>previously: </span>
                                <span className="font-mono">{prevSkus.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add variants */}
                  <div className="border-t border-border pt-2 space-y-3">
                    {form.fabric3Name ? (
                      /* 3+ fabric: stacked chip selectors per fabric, cross-product of selections */
                      <div className="space-y-3">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                          Add Combos — Pick Colours per Fabric
                        </p>
                        {[1, 2, 3, 4].slice(0, visibleFabricCount).map((fabricIdx) => {
                          const fabricName = fabricIdx === 1 ? form.fabricName : fabricIdx === 2 ? form.fabric2Name : fabricIdx === 3 ? form.fabric3Name : form.fabric4Name;
                          const colours = fabricIdx === 1 ? fabricColours : fabricIdx === 2 ? fabric2Colours : fabricIdx === 3 ? fabric3Colours : fabric4Colours;
                          if (!fabricName) return null;
                          const getAt = (e: SkuEntry, i: number) => (i === 1 ? e.colour : i === 2 ? e.colour2 : i === 3 ? e.colour3 : e.colour4) || "";
                          const selected = Array.from(new Set(skuEntries.map((e) => getAt(e, fabricIdx)).filter(Boolean)));
                          return (
                            <div key={fabricIdx} className="space-y-1.5">
                              <Label className="text-[11px]">Fabric {fabricIdx}: {fabricName}</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {colours.map((c) => {
                                  const isSelected = selected.includes(c);
                                  return (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => handleMultiFabricToggle(fabricIdx, c)}
                                      className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                                        isSelected
                                          ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                                          : "bg-white border-border text-gray-600 hover:bg-muted/50"
                                      }`}
                                    >
                                      {c}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                    <>
                    {/* Add single-colour */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                        Add Single-Colour
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {fabricColours.map((colour) => {
                          const alreadyAdded = selectedSingleColours.includes(colour);
                          return (
                            <button
                              key={colour}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleColoursSelected([...selectedSingleColours, colour])}
                              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                                alreadyAdded
                                  ? "opacity-35 cursor-not-allowed bg-muted border-border text-muted-foreground"
                                  : "bg-white border-border text-gray-600 hover:bg-muted/50"
                              }`}
                            >
                              {colour}
                            </button>
                          );
                        })}
                      </div>
                      <MultiCombobox
                        values={selectedSingleColours}
                        onValuesChange={handleColoursSelected}
                        options={colours}
                        placeholder="Search and add colour..."
                      />
                    </div>

                    {/* Add combo (only for 2-fabric articles) */}
                    {form.fabric2Name && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                          Add Combo ({form.fabricName} × {form.fabric2Name})
                        </p>
                        {loadingFabricColours || loadingFabric2Colours ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading colours...
                          </p>
                        ) : fabricColours.length === 0 || fabric2Colours.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {fabricColours.length === 0 ? `No colours on "${form.fabricName}"` : `No colours on "${form.fabric2Name}"`}.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="text-xs border-collapse w-full">
                              <thead>
                                <tr>
                                  <th className="text-right pr-3 py-1 text-[10px] text-muted-foreground font-normal w-28">outside ↓ / inside →</th>
                                  {fabric2Colours.map((c2) => (
                                    <th key={c2} className="px-2 py-1 text-center font-medium min-w-[52px]">
                                      <span className="block">{c2}</span>
                                      {colourCodeMap.get(c2) && (
                                        <span className="text-[10px] text-muted-foreground font-normal">{colourCodeMap.get(c2)}</span>
                                      )}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {fabricColours.map((c1) => (
                                  <tr key={c1} className="border-t border-border/40">
                                    <td className="text-right pr-3 py-1 font-medium whitespace-nowrap">
                                      {c1}
                                      {colourCodeMap.get(c1) && (
                                        <span className="ml-1 text-[10px] text-muted-foreground">({colourCodeMap.get(c1)})</span>
                                      )}
                                    </td>
                                    {fabric2Colours.map((c2) => {
                                      const isSelected = skuEntries.some((e) => e.colour === c1 && e.colour2 === c2);
                                      return (
                                        <td key={c2} className="px-1 py-1 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleComboToggle(c1, c2)}
                                            className={`w-9 h-9 rounded border text-[11px] font-medium transition-colors ${
                                              isSelected
                                                ? "bg-amber-100 border-amber-400 text-amber-800"
                                                : "bg-white border-border text-gray-400 hover:bg-muted/50"
                                            }`}
                                          >
                                            {isSelected ? "✓" : "+"}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                    </>
                    )}
                  </div>
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

              {/* Accessories (BOM) */}
              {FEATURES.accessories && (
                <CollapsibleSection
                  title="Accessories (BOM)"
                  expanded={expandedSections.accessories}
                  onToggle={() => toggleSection("accessories")}
                >
                  {bomLines.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      No accessories defined for this article.
                    </p>
                  )}
                  {bomLines.map((line, idx) => {
                    const acc = accessories.find((a) => a.id === line.accessoryId);
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <Combobox
                            value={line.accessoryId}
                            onValueChange={(v) => updateBomLine(idx, { accessoryId: v })}
                            options={accessories.map((a) => ({ value: a.id, label: a.label }))}
                            placeholder="Select accessory..."
                          />
                        </div>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="qty/pc"
                          value={line.quantityPerPiece}
                          onChange={(e) => updateBomLine(idx, { quantityPerPiece: e.target.value })}
                          className="h-7 text-xs w-20 shrink-0"
                        />
                        <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                          {acc?.unit || ""}
                        </span>
                        <BomSizeSelector
                          value={line.applicableSizes}
                          onChange={(next) => updateBomLine(idx, { applicableSizes: next })}
                          gender={form.gender}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBomLine(idx)}
                          className="h-6 w-6 p-0 shrink-0"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBomLine}
                    className="h-7 text-[11px] mt-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Accessory
                  </Button>
                </CollapsibleSection>
              )}

              {/* Phase Costs — changelog segments view */}
              {phases.length > 0 && (
                <CollapsibleSection
                  title="Phase Costs"
                  expanded={expandedSections.phaseCosts}
                  onToggle={() => toggleSection("phaseCosts")}
                >
                  <p className="text-xs text-muted-foreground mb-2">
                    Cost history as a changelog. The master cost applies until you record a change. Blank fields in a change row inherit the prior segment&apos;s value.
                  </p>
                  {(() => {
                    // Fabric cost/kg per slot lives on PhaseFabric (alongside
                    // fabric name and g/kg), not on PhaseCost. It's already
                    // editable from the Phase Fabrics section, so it's
                    // intentionally omitted here.
                    const costFieldDefs: Array<{ key: typeof PHASE_COST_FIELDS[number]; label: string }> = [
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
                    const masterCostDefaults: Record<string, string> = {};
                    for (const { key } of costFieldDefs) {
                      masterCostDefaults[key] = String((form as unknown as Record<string, unknown>)[key] ?? "");
                    }
                    // Convention: leading digit of articleNumber = the phase the
                    // article was introduced in. Clip the segments view to
                    // phases >= introduction so we never show history for phases
                    // that pre-date the article.
                    const introNum = articleIntroductionPhaseNumber(editingRow?.articleNumber ?? "");
                    const sortedPhases = [...phases]
                      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
                      .filter((p) => introNum == null ? true : (p.number ?? 0) >= introNum);
                    const changePhaseIds = Object.keys(phaseCostOverrides);
                    const changePhases = sortedPhases.filter((p) => changePhaseIds.includes(p.id));
                    // Walk changelog rows in phase order to compute resolved
                    // values at each change. Under option B every article has
                    // at least an introduction-phase row, so the cumulative
                    // walk starts EMPTY (no master-defaults fallback) — the
                    // changelog is authoritative.
                    const resolvedAt = new Map<string, Record<string, string>>();
                    let cumulative: Record<string, string> = {};
                    for (const cp of changePhases) {
                      const row = phaseCostOverrides[cp.id] || {};
                      for (const { key } of costFieldDefs) {
                        const v = row[key];
                        if (v != null && v !== "") cumulative[key] = v;
                      }
                      resolvedAt.set(cp.id, { ...cumulative });
                    }
                    type Segment = { kind: "change"; startPhase: typeof sortedPhases[number]; endPhase: typeof sortedPhases[number] | null; values: Record<string, string>; phaseId: string };
                    const segments: Segment[] = [];
                    for (let i = 0; i < changePhases.length; i++) {
                      const startP = changePhases[i];
                      const next = changePhases[i + 1];
                      const endP = next
                        ? sortedPhases[sortedPhases.findIndex((p) => p.id === next.id) - 1] ?? null
                        : null;
                      segments.push({
                        kind: "change",
                        startPhase: startP,
                        endPhase: endP,
                        values: resolvedAt.get(startP.id) || cumulative,
                        phaseId: startP.id,
                      });
                    }
                    const fmtNum = (n: number | null | undefined) => {
                      if (n == null) return "?";
                      return Number.isInteger(n) ? String(n) : String(n);
                    };
                    const rangeLabel = (start: typeof sortedPhases[number] | undefined, end: typeof sortedPhases[number] | null) => {
                      if (!start) start = sortedPhases[0];
                      const s = fmtNum(start.number);
                      if (!end) return `Phases ${s}+`;
                      if (end.id === start.id) return `Phase ${s}`;
                      return `Phases ${s} – ${fmtNum(end.number)}`;
                    };
                    // Resolve PhaseFabric-tracked fields (fabric cost/kg + g/kg
                    // per slot) up to each phase, so the cost segment's total
                    // and profit-margin badges include real fabric costs (not
                    // just generic costs from PhaseCost).
                    const fabricResolvedAtPhase = new Map<string, Record<string, string>>();
                    {
                      const fabricSorted = sortedPhases.filter((p) => phaseFabricOverrides[p.id]);
                      const fabFields = [
                        "fabricCostPerKg", "garmentsPerKg",
                        "fabric2CostPerKg", "garmentsPerKg2",
                      ];
                      const cumFabric: Record<string, string> = {};
                      for (const fp of fabricSorted) {
                        const row = phaseFabricOverrides[fp.id] || {};
                        for (const f of fabFields) {
                          const v = row[f];
                          if (v != null && v !== "") cumFabric[f] = v;
                        }
                        fabricResolvedAtPhase.set(fp.id, { ...cumFabric });
                      }
                    }
                    const fabricAtOrBefore = (phaseId: string): Record<string, string> => {
                      const target = sortedPhases.find((p) => p.id === phaseId);
                      if (!target) return {};
                      // Walk sortedPhases from start, accumulating fabric values until we pass the target.
                      let result: Record<string, string> = {};
                      for (const p of sortedPhases) {
                        const r = fabricResolvedAtPhase.get(p.id);
                        if (r) result = r;
                        if (p.id === phaseId) break;
                      }
                      return result;
                    };
                    // Total & profit margin for the segment using resolved cost values.
                    const segMetrics = (v: Record<string, string>, phaseId: string) => {
                      const fab = fabricAtOrBefore(phaseId);
                      const data = {
                        fabricCostPerKg: toNum(fab.fabricCostPerKg ?? v.fabricCostPerKg),
                        fabric2CostPerKg: toNum(fab.fabric2CostPerKg ?? v.fabric2CostPerKg),
                        assumedFabricGarmentsPerKg: toNum(fab.garmentsPerKg ?? form.garmentsPerKg),
                        assumedFabric2GarmentsPerKg: toNum(fab.garmentsPerKg2 ?? form.garmentsPerKg2),
                        stitchingCost: toNum(v.stitchingCost),
                        brandLogoCost: toNum(v.brandLogoCost),
                        neckTwillCost: toNum(v.neckTwillCost),
                        reflectorsCost: toNum(v.reflectorsCost),
                        fusingCost: toNum(v.fusingCost),
                        accessoriesCost: toNum(v.accessoriesCost),
                        brandTagCost: toNum(v.brandTagCost),
                        sizeTagCost: toNum(v.sizeTagCost),
                        packagingCost: toNum(v.packagingCost),
                        outwardShippingCost: toNum(v.inwardShipping),
                        proposedMrp: toNum(form.proposedMrp),
                      };
                      return {
                        total: computeTotalCost(data),
                        landed: computeTotalLandedCost(data),
                        pm: computeProfitMargin(data),
                      };
                    };
                    const usedPhaseIds = new Set(changePhaseIds);
                    const availablePhases = sortedPhases.filter((p) => !usedPhaseIds.has(p.id));
                    return (
                      <div className="space-y-2">
                        {segments.map((seg, i) => {
                          const m = segMetrics(seg.values, seg.phaseId);
                          const isExpanded = seg.phaseId ? (expandedPhases[`cost:${seg.phaseId}`] ?? false) : false;
                          return (
                            <div key={seg.phaseId} className="border rounded overflow-hidden">
                              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-[11px] font-semibold shrink-0">{rangeLabel(seg.startPhase, seg.endPhase)}</div>
                                  <div className="flex items-center gap-2 text-[10px] shrink-0">
                                    <span className="text-muted-foreground">Cost: <strong className="text-foreground">{formatCurrency(m.total)}</strong></span>
                                    <span className={`font-bold ${m.pm >= 0.2 ? "text-green-600" : m.pm >= 0.1 ? "text-amber-600" : "text-red-600"}`}>
                                      PM: {formatPercent(m.pm)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setExpandedPhases((prev) => ({ ...prev, [`cost:${seg.phaseId}`]: !prev[`cost:${seg.phaseId}`] }))}>
                                    {isExpanded ? "Close" : "Edit"}
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-destructive" onClick={() => removePhaseCost(seg.phaseId)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-2 py-2">
                                  <p className="text-[10px] text-muted-foreground mb-1.5">
                                    Cost change starting at <strong>Phase {fmtNum(seg.startPhase!.number)}</strong>. Blank fields inherit the prior segment&apos;s value.
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] mb-1.5">
                                    <span className="text-muted-foreground">Total: <strong>{formatCurrency(m.total)}</strong></span>
                                    <span className="text-muted-foreground">Landed: <strong>{formatCurrency(m.landed)}</strong></span>
                                    <span className="text-muted-foreground">Dealer: <strong>{formatCurrency(computeDealerPrice(toNum(form.proposedMrp)))}</strong></span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    {costFieldDefs.map(({ key, label }) => {
                                      const overrides = phaseCostOverrides[seg.phaseId!] || {};
                                      const idx = segments.findIndex((s) => s.phaseId === seg.phaseId);
                                      // Introduction segment (idx === 0) has no prior state under option B.
                                      const priorResolved = idx > 0 ? segments[idx - 1].values : ({} as Record<string, string>);
                                      return (
                                        <div key={key} className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">{label}</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            className="h-7 text-xs"
                                            value={overrides[key] ?? ""}
                                            placeholder={priorResolved[key] || ""}
                                            onChange={(e) => updatePhaseCostField(seg.phaseId!, key, e.target.value)}
                                            onBlur={() => savePhaseCost(seg.phaseId!)}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {availablePhases.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <Select onValueChange={(v) => { if (v) addPhaseCostRow(String(v)); }}>
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <span className="text-muted-foreground">+ Add cost change…</span>
                              </SelectTrigger>
                              <SelectContent>
                                {availablePhases.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">Phase {fmtNum(p.number)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CollapsibleSection>
              )}

              {/* Phase Fabrics — changelog segments view */}
              {phases.length > 0 && (
                <CollapsibleSection
                  title="Phase Fabrics"
                  expanded={expandedSections.phaseFabrics}
                  onToggle={() => toggleSection("phaseFabrics")}
                >
                  <p className="text-xs text-muted-foreground mb-2">
                    Fabric history as a changelog. The master fabric applies to every phase until you record a change. Each change carries forward to later phases.
                  </p>
                  {(() => {
                    const masterFabricDefaults: Record<string, string> = {
                      fabricName: String(form.fabricName ?? ""),
                      fabricVendorId: "",
                      fabricCostPerKg: String((form as unknown as Record<string, unknown>).fabricCostPerKg ?? ""),
                      garmentsPerKg: String((form as unknown as Record<string, unknown>).garmentsPerKg ?? ""),
                      fabric2Name: String(form.fabric2Name ?? ""),
                      fabric2VendorId: "",
                      fabric2CostPerKg: String((form as unknown as Record<string, unknown>).fabric2CostPerKg ?? ""),
                      garmentsPerKg2: String((form as unknown as Record<string, unknown>).garmentsPerKg2 ?? ""),
                      fabric3Name: String((form as unknown as Record<string, unknown>).fabric3Name ?? ""),
                      fabric3VendorId: "",
                      fabric3CostPerKg: String((form as unknown as Record<string, unknown>).fabric3CostPerKg ?? ""),
                      garmentsPerKg3: String((form as unknown as Record<string, unknown>).garmentsPerKg3 ?? ""),
                      fabric4Name: String((form as unknown as Record<string, unknown>).fabric4Name ?? ""),
                      fabric4VendorId: "",
                      fabric4CostPerKg: String((form as unknown as Record<string, unknown>).fabric4CostPerKg ?? ""),
                      garmentsPerKg4: String((form as unknown as Record<string, unknown>).garmentsPerKg4 ?? ""),
                    };
                    // Convention: leading digit of articleNumber = the phase the
                    // article was introduced in. Clip the segments view to
                    // phases >= introduction so we never show history for phases
                    // that pre-date the article.
                    const introNum = articleIntroductionPhaseNumber(editingRow?.articleNumber ?? "");
                    const sortedPhases = [...phases]
                      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
                      .filter((p) => introNum == null ? true : (p.number ?? 0) >= introNum);
                    const changePhaseIds = Object.keys(phaseFabricOverrides);
                    const changePhases = sortedPhases.filter((p) => changePhaseIds.includes(p.id));
                    // Walk changelog cumulatively to compute resolved values per segment.
                    const resolvedAt = new Map<string, Record<string, string>>();
                    // Under option B the introduction-phase changelog row carries the
                    // article's starting state; nothing exists before it. Walk starts empty.
                    let cumulative: Record<string, string> = {};
                    for (const cp of changePhases) {
                      const row = phaseFabricOverrides[cp.id] || {};
                      for (const f of PHASE_FABRIC_FIELDS) {
                        const v = row[f];
                        if (v != null && v !== "") cumulative[f] = v;
                      }
                      resolvedAt.set(cp.id, { ...cumulative });
                    }
                    type Segment = { kind: "change"; startPhase: typeof sortedPhases[number]; endPhase: typeof sortedPhases[number] | null; values: Record<string, string>; phaseId: string };
                    const segments: Segment[] = [];
                    for (let i = 0; i < changePhases.length; i++) {
                      const startP = changePhases[i];
                      const next = changePhases[i + 1];
                      const endP = next
                        ? sortedPhases[sortedPhases.findIndex((p) => p.id === next.id) - 1] ?? null
                        : null;
                      segments.push({
                        kind: "change",
                        startPhase: startP,
                        endPhase: endP,
                        values: resolvedAt.get(startP.id) || cumulative,
                        phaseId: startP.id,
                      });
                    }
                    const fmtNum = (n: number | null | undefined) => {
                      if (n == null) return "?";
                      return Number.isInteger(n) ? String(n) : String(n);
                    };
                    const rangeLabel = (start: typeof sortedPhases[number] | undefined, end: typeof sortedPhases[number] | null) => {
                      if (!start) start = sortedPhases[0];
                      const s = fmtNum(start.number);
                      if (!end) return `Phases ${s}+`;
                      if (end.id === start.id) return `Phase ${s}`;
                      return `Phases ${s} – ${fmtNum(end.number)}`;
                    };
                    const summary = (v: Record<string, string>) => {
                      const slots = [
                        v.fabricName, v.fabric2Name, v.fabric3Name, v.fabric4Name,
                      ].filter((x) => x && x.trim());
                      return slots.length ? slots.join(" + ") : "—";
                    };
                    const usedPhaseIds = new Set(changePhaseIds);
                    const availablePhases = sortedPhases.filter((p) => !usedPhaseIds.has(p.id));
                    return (
                      <div className="space-y-2">
                        {segments.map((seg) => {
                          const start = seg.startPhase;
                          const isExpanded = expandedPhases[`fabric:${seg.phaseId}`] ?? false;
                          return (
                            <div key={seg.phaseId} className="border rounded overflow-hidden">
                              <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="text-[11px] font-semibold shrink-0">{rangeLabel(seg.startPhase, seg.endPhase)}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {summary(seg.values)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setExpandedPhases((prev) => ({ ...prev, [`fabric:${seg.phaseId}`]: !prev[`fabric:${seg.phaseId}`] }))}>
                                    {isExpanded ? "Close" : "Edit"}
                                  </Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-destructive" onClick={() => removePhaseFabric(seg.phaseId)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                              {isExpanded && (() => {
                                // Compute "slots actually in use" across the master + every
                                // segment's resolved values + any override on this row.
                                const slotHasContent = (slot: number) => {
                                  const nk = slot === 1 ? "fabricName" : `fabric${slot}Name`;
                                  if ((masterFabricDefaults[nk] || "").trim()) return true;
                                  for (const s of segments) if ((s.values[nk] || "").trim()) return true;
                                  return false;
                                };
                                const baseSlots = [1, 2, 3, 4].filter(slotHasContent).length || 1;
                                const extra = extraFabricSlots[seg.phaseId!] ?? 0;
                                const slotsToRender = Math.min(4, Math.max(baseSlots, extra));
                                const overridesThisSeg = phaseFabricOverrides[seg.phaseId!] || {};
                                return (
                                <div className="px-2 py-2 space-y-2">
                                  <p className="text-[10px] text-muted-foreground">
                                    Fabric change starting at <strong>Phase {fmtNum(start.number)}</strong>. Blank slots inherit the prior segment&apos;s value.
                                  </p>
                                  {Array.from({ length: slotsToRender }, (_, i) => i + 1).map((slot) => {
                                    const nameKey = slot === 1 ? "fabricName" : `fabric${slot}Name`;
                                    const costKey = slot === 1 ? "fabricCostPerKg" : `fabric${slot}CostPerKg`;
                                    const gpkKey = slot === 1 ? "garmentsPerKg" : `garmentsPerKg${slot}`;
                                    const overrides = overridesThisSeg;
                                    // For placeholder/inherited display use the prior segment's resolved value
                                    const idx = segments.findIndex((s) => s.phaseId === seg.phaseId);
                                    // Introduction segment (idx === 0) has no prior state under option B.
                                    const priorResolved = idx > 0 ? segments[idx - 1].values : ({} as Record<string, string>);
                                    return (
                                      <div key={slot} className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 items-end">
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">Fabric {slot} name</Label>
                                          <Combobox
                                            value={overrides[nameKey] ?? ""}
                                            onValueChange={(v) => {
                                              updatePhaseFabricField(seg.phaseId!, nameKey, v);
                                              savePhaseFabric(seg.phaseId!, { ...overrides, [nameKey]: v });
                                            }}
                                            options={fabricNames}
                                            placeholder={priorResolved[nameKey] || "Inherit"}
                                          />
                                        </div>
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">Cost/kg</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            className="h-7 text-xs"
                                            value={overrides[costKey] ?? ""}
                                            placeholder={priorResolved[costKey] || ""}
                                            onChange={(e) => updatePhaseFabricField(seg.phaseId!, costKey, e.target.value)}
                                            onBlur={() => savePhaseFabric(seg.phaseId!)}
                                          />
                                        </div>
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] text-muted-foreground">Garments/kg</Label>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            className="h-7 text-xs"
                                            value={overrides[gpkKey] ?? ""}
                                            placeholder={priorResolved[gpkKey] || ""}
                                            onChange={(e) => updatePhaseFabricField(seg.phaseId!, gpkKey, e.target.value)}
                                            onBlur={() => savePhaseFabric(seg.phaseId!)}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {slotsToRender < 4 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-1.5 text-[10px] text-muted-foreground"
                                      onClick={() => setExtraFabricSlots((prev) => ({ ...prev, [seg.phaseId!]: slotsToRender + 1 }))}
                                    >
                                      + Add Fabric {slotsToRender + 1} slot
                                    </Button>
                                  )}
                                </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                        {availablePhases.length > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <Select onValueChange={(v) => { if (v) addPhaseFabricRow(String(v)); }}>
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <span className="text-muted-foreground">+ Add fabric change…</span>
                              </SelectTrigger>
                              <SelectContent>
                                {availablePhases.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">Phase {fmtNum(p.number)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CollapsibleSection>
              )}

              {/* Summary */}
              <div className="rounded-lg border border-border border-l-4 border-l-primary px-2 py-1.5 space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase text-primary tracking-wider">Summary</h4>
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
          <div className="flex flex-nowrap gap-1.5 w-full">
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
                onClick={async () => {
                  if (step === 1) {
                    if (!form.type.trim()) { toast.error("Type is required"); return; }
                    if (!form.gender) { toast.error("Gender is required"); return; }
                    if (!form.fabricName.trim()) { toast.error("Fabric is required"); return; }
                    // Pre-fetch sequence number so step 2 combo toggles don't each fetch separately
                    if (resolvedSeqNum === null) {
                      const genderP = GENDER_PREFIX[form.gender] || "M";
                      const typeCode = typeCodeMap.get(form.type) || form.type.slice(0, 2).toUpperCase();
                      try {
                        const seq = await getNextStyleSequence(genderP, typeCode);
                        setResolvedSeqNum(seq);
                      } catch {
                        setResolvedSeqNum(1);
                      }
                    }
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
                <Button size="sm" onClick={handleSubmit} disabled={submitting || archiving} className="flex-1 min-w-0 text-[11px] px-2">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Article"
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={submitting || archiving}
                  className="flex-1 min-w-0 text-[11px] px-2"
                >
                  {archiving ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {isArchived ? "Unarchiving..." : "Archiving..."}
                    </>
                  ) : (
                    <>
                      <Archive className="mr-1 h-3 w-3" />
                      {isArchived ? "Unarchive" : "Archive"}
                    </>
                  )}
                </Button>
                <Button
                  variant={cleanedAt ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleCleaned}
                  disabled={submitting || archiving || markingClean}
                  className={`flex-1 min-w-0 text-[11px] px-2 ${cleanedAt ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                  title={cleanedAt ? `Cleaned on ${new Date(cleanedAt).toLocaleString()}. Excel imports will skip this article.` : "Mark this article as manually cleaned so Excel imports won't overwrite it."}
                >
                  {markingClean ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : cleanedAt ? (
                    <>
                      <Unlock className="mr-1 h-3 w-3" />
                      Unmark Cleaned
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1 h-3 w-3" />
                      Mark Cleaned
                    </>
                  )}
                </Button>
              </>
            )}
            {isEdit && !showDeleteConfirm && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || archiving || deleting}
                className="flex-1 min-w-0 text-[11px] px-2"
              >
                <Trash2 className="mr-1 h-3 w-3" />
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
