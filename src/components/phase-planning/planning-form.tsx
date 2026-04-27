"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { createPlanOrders, type PlannedSKUOrder, type PlannedFabricOrder } from "@/actions/phase-planning";
import { saveDraft, loadDraft, deleteDraft } from "@/actions/phase-planning-draft";
import { toast } from "sonner";
import { X, ArrowLeft, Loader2, ChevronDown, ChevronRight, Package, Layers } from "lucide-react";

type ProductMaster = Record<string, unknown>;
type FabricMaster = Record<string, unknown>;
type Vendor = { id: string; name: string };

type ColourQty = { colour: string; colour2?: string; colour3?: string; colour4?: string; qty: number };

type SelectedArticle = {
  articleNumber: string;
  styleName: string;
  fabricName: string;
  fabric2Name: string | null;
  fabric3Name: string | null;
  fabric4Name: string | null;
  garmentsPerKg: number | null;
  garmentsPerKg2: number | null;
  garmentsPerKg3: number | null;
  garmentsPerKg4: number | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  fabric3CostPerKg: number | null;
  fabric4CostPerKg: number | null;
  fabricVendorId: string;
  fabricVendorName: string;
  fabric2VendorId: string | null;
  fabric2VendorName: string | null;
  fabric3VendorId: string | null;
  fabric3VendorName: string | null;
  fabric4VendorId: string | null;
  fabric4VendorName: string | null;
  type: string;
  gender: string;
  productName: string;
  garmentingAt: string | null;
  availableColours: string[];
  colourQtys: ColourQty[];
  isRepeat: boolean;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  outwardShippingCost: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
};

type FabricAllocationRow = {
  articleNumber: string;
  styleName: string;
  colour: string;
  colour2?: string;
  colour3?: string;
  colour4?: string;
  slot: 1 | 2 | 3 | 4;
  gpkForSlot: number | null;
  kg: number;
  skuCode: string;
};

type FabricSectionData = {
  fabricName: string;
  vendorId: string;
  vendorName: string;
  sectionColour: string;
  costPerKg: number | null;
  rows: FabricAllocationRow[];
};

type PlanMode = "quantity" | "fabric";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function ownershipKey(articleNumber: string, c1: string, c2?: string, c3?: string, c4?: string) {
  return `${articleNumber}||${c1}|${c2 || ""}|${c3 || ""}|${c4 || ""}`;
}

function fabricKey(fabricName: string, vendorId: string) {
  return `${fabricName}||${vendorId}`;
}

function sectionKey(fabricName: string, vendorId: string, colour: string) {
  return `${fabricName}||${vendorId}||${colour.toLowerCase()}`;
}

type SizeDistItem = { size: string; percentage: number };

export function PlanningForm({
  phaseId,
  phaseNumber,
  phaseName,
  productMasters,
  fabricMasters,
  vendors,
  previousArticles,
  sizeDistributions = [],
}: {
  phaseId: string;
  phaseNumber: number;
  phaseName: string;
  productMasters: ProductMaster[];
  fabricMasters: FabricMaster[];
  vendors: Vendor[];
  previousArticles: string[];
  sizeDistributions?: SizeDistItem[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "review">("select");
  const [mode, setMode] = useState<PlanMode | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<SelectedArticle[]>([]);
  const [fabricSections, setFabricSections] = useState<FabricSectionData[]>([]);
  const [ownership, setOwnership] = useState<Record<string, string>>({});
  const [pickFabricKey, setPickFabricKey] = useState("");
  const [pickColour, setPickColour] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scrollTargetKey, setScrollTargetKey] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollTargetKey) return;
    const el = document.querySelector<HTMLElement>(`[data-scroll-key="${CSS.escape(scrollTargetKey)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTargetKey(null);
  }, [scrollTargetKey]);

  const [fabricSummaryOpen, setFabricSummaryOpen] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [hydratedQuantity, setHydratedQuantity] = useState(false);
  const [hydratedFabric, setHydratedFabric] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<Date | null>(null);
  const [quantityBannerDismissed, setQuantityBannerDismissed] = useState(false);
  const [fabricBannerDismissed, setFabricBannerDismissed] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [quantitySavedAt, setQuantitySavedAt] = useState<Date | null>(null);
  const [fabricSavedAt, setFabricSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(false);
  const lastSavedQuantityJson = useRef<string | null>(null);
  const lastSavedFabricJson = useRef<string | null>(null);
  const quantitySavedAtRef = useRef<Date | null>(null);
  const fabricSavedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDraft(phaseId)
      .then((d) => {
        if (cancelled || !d) return;
        const p = d.payload as {
          // new shape
          quantity?: { selectedArticles?: unknown[] };
          fabric?: { fabricSections?: unknown[]; ownership?: Record<string, string> };
          quantitySavedAt?: string;
          fabricSavedAt?: string;
          // back-compat: old flat shape
          mode?: PlanMode;
          selectedArticles?: unknown[];
          fabricSections?: unknown[];
          ownership?: Record<string, string>;
        };
        // Resolve quantity slice from new shape, falling back to old shape
        const quantityArticles = Array.isArray(p.quantity?.selectedArticles)
          ? p.quantity!.selectedArticles
          : (p.mode === "quantity" || (p.mode === undefined && Array.isArray(p.selectedArticles)))
            ? p.selectedArticles
            : undefined;
        // Resolve fabric slice from new shape, falling back to old shape
        const fabricSecs = Array.isArray(p.fabric?.fabricSections)
          ? p.fabric!.fabricSections
          : p.mode === "fabric"
            ? p.fabricSections
            : undefined;
        const fabricOwn = p.fabric?.ownership || (p.mode === "fabric" ? p.ownership : undefined);

        let any = false;
        if (Array.isArray(quantityArticles) && quantityArticles.length > 0) {
          skipNextSave.current = true;
          const articles = quantityArticles as SelectedArticle[];
          setSelectedArticles(articles);
          setHydratedQuantity(true);
          lastSavedQuantityJson.current = JSON.stringify(articles);
          const qSaved = p.quantitySavedAt ? new Date(p.quantitySavedAt) : new Date(d.updatedAt);
          setQuantitySavedAt(qSaved);
          quantitySavedAtRef.current = qSaved;
          any = true;
        }
        if (Array.isArray(fabricSecs) && fabricSecs.length > 0) {
          skipNextSave.current = true;
          const secs = fabricSecs as FabricSectionData[];
          const own = fabricOwn || {};
          setFabricSections(secs);
          setOwnership(own);
          setHydratedFabric(true);
          lastSavedFabricJson.current = JSON.stringify({ fabricSections: secs, ownership: own });
          const fSaved = p.fabricSavedAt ? new Date(p.fabricSavedAt) : new Date(d.updatedAt);
          setFabricSavedAt(fSaved);
          fabricSavedAtRef.current = fSaved;
          any = true;
        }
        if (any) setDraftRestoredAt(new Date(d.updatedAt));

        // Heal legacy drafts that lack per-slice timestamps: re-persist with the
        // current shape so subsequent loads get accurate per-slice "saved at" times.
        const needsHeal = (Array.isArray(quantityArticles) && quantityArticles.length > 0 && !p.quantitySavedAt)
          || (Array.isArray(fabricSecs) && fabricSecs.length > 0 && !p.fabricSavedAt);
        if (needsHeal) {
          const healPayload: Record<string, unknown> = {};
          if (quantitySavedAtRef.current) {
            healPayload.quantity = { selectedArticles: quantityArticles };
            healPayload.quantitySavedAt = quantitySavedAtRef.current.toISOString();
          }
          if (fabricSavedAtRef.current) {
            healPayload.fabric = { fabricSections: fabricSecs, ownership: fabricOwn || {} };
            healPayload.fabricSavedAt = fabricSavedAtRef.current.toISOString();
          }
          saveDraft(phaseId, healPayload).catch(() => { /* ignore */ });
        }
      })
      .catch(() => { /* no draft or not permitted */ })
      .finally(() => { if (!cancelled) setDraftHydrated(true); });
    return () => { cancelled = true; };
  }, [phaseId]);

  useEffect(() => {
    if (!draftHydrated) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const quantityEmpty = selectedArticles.length === 0;
    const fabricEmpty = fabricSections.length === 0;
    const quantityJson = quantityEmpty ? null : JSON.stringify(selectedArticles);
    const fabricJson = fabricEmpty ? null : JSON.stringify({ fabricSections, ownership });
    if (quantityJson === lastSavedQuantityJson.current && fabricJson === lastSavedFabricJson.current) {
      return;
    }
    if (quantityEmpty && fabricEmpty) {
      setSaveStatus("saving");
      saveTimer.current = setTimeout(() => {
        deleteDraft(phaseId)
          .then(() => {
            setSaveStatus("idle");
            setSavedAt(null);
            setQuantitySavedAt(null);
            setFabricSavedAt(null);
            quantitySavedAtRef.current = null;
            fabricSavedAtRef.current = null;
            lastSavedQuantityJson.current = null;
            lastSavedFabricJson.current = null;
          })
          .catch((err) => { console.error("[draft-delete] failed", err); setSaveStatus("error"); });
      }, 1500);
      return;
    }
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      const now = new Date();
      const quantityChanged = quantityJson !== lastSavedQuantityJson.current;
      const fabricChanged = fabricJson !== lastSavedFabricJson.current;
      // If we don't have a prior timestamp for a non-empty slice (e.g. legacy draft missing the field), fall back to now.
      const nextQuantitySavedAt = quantityEmpty ? null : (quantityChanged || !quantitySavedAtRef.current ? now : quantitySavedAtRef.current);
      const nextFabricSavedAt = fabricEmpty ? null : (fabricChanged || !fabricSavedAtRef.current ? now : fabricSavedAtRef.current);
      const payload: Record<string, unknown> = {};
      if (!quantityEmpty) payload.quantity = { selectedArticles };
      if (!fabricEmpty) payload.fabric = { fabricSections, ownership };
      if (nextQuantitySavedAt) payload.quantitySavedAt = nextQuantitySavedAt.toISOString();
      if (nextFabricSavedAt) payload.fabricSavedAt = nextFabricSavedAt.toISOString();
      saveDraft(phaseId, payload)
        .then(() => {
          setSaveStatus("saved");
          setSavedAt(now);
          setQuantitySavedAt(nextQuantitySavedAt);
          setFabricSavedAt(nextFabricSavedAt);
          quantitySavedAtRef.current = nextQuantitySavedAt;
          fabricSavedAtRef.current = nextFabricSavedAt;
          lastSavedQuantityJson.current = quantityJson;
          lastSavedFabricJson.current = fabricJson;
        })
        .catch((err) => { console.error("[draft-save] failed", err); setSaveStatus("error"); });
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedArticles, fabricSections, ownership, draftHydrated, phaseId]);

  async function discardCurrentMode() {
    if (mode === "quantity") {
      setSelectedArticles([]);
      setHydratedQuantity(false);
    } else if (mode === "fabric") {
      setFabricSections([]);
      setOwnership({});
      setHydratedFabric(false);
    }
  }

  const previousArticleSet = useMemo(() => new Set(previousArticles), [previousArticles]);

  const sizeDistMap = useMemo(
    () => new Map(sizeDistributions.map((d) => [d.size, d.percentage])),
    [sizeDistributions]
  );
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const fabricVendorMap = useMemo(() => {
    const map = new Map<string, { vendorId: string; vendorName: string; mrp: number | null }>();
    for (const fm of fabricMasters) {
      const name = String(fm.fabricName || "");
      if (!map.has(name)) {
        const vendor = fm.vendor as { id: string; name: string } | undefined;
        map.set(name, {
          vendorId: vendor?.id || String(fm.vendorId || ""),
          vendorName: vendor?.name || "",
          mrp: toNum(fm.mrp),
        });
      }
    }
    return map;
  }, [fabricMasters]);

  const articleGroups = useMemo(() => {
    const groups = new Map<string, ProductMaster[]>();
    for (const pm of productMasters) {
      const article = String(pm.articleNumber || "");
      if (!article) continue;
      if (!groups.has(article)) groups.set(article, []);
      groups.get(article)!.push(pm);
    }
    return groups;
  }, [productMasters]);

  const articleOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    for (const [article, masters] of articleGroups) {
      const productName = String(masters[0].productName || masters[0].styleNumber || "");
      options.push({ label: productName ? `${article} - ${productName}` : article, value: article });
    }
    return options.sort((a, b) => {
      const na = Number(a.value);
      const nb = Number(b.value);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.value.localeCompare(a.value);
    });
  }, [articleGroups]);

  // Fabric options for fabric-mode: only fabrics actually used by ProductMasters
  const usedFabrics = useMemo(() => {
    type FabInfo = { fabricName: string; vendorId: string; vendorName: string; costPerKg: number | null };
    const seen = new Map<string, FabInfo>();
    for (const pm of productMasters) {
      for (const slot of [
        { name: "fabricName", vKey: "fabricVendorId", cKey: "fabricCostPerKg" },
        { name: "fabric2Name", vKey: "fabric2VendorId", cKey: "fabric2CostPerKg" },
        { name: "fabric3Name", vKey: "fabric3VendorId", cKey: "fabric3CostPerKg" },
        { name: "fabric4Name", vKey: "fabric4VendorId", cKey: "fabric4CostPerKg" },
      ]) {
        const fabricName = pm[slot.name] ? String(pm[slot.name]) : "";
        if (!fabricName) continue;
        const info = fabricVendorMap.get(fabricName);
        const vendorId = info?.vendorId || String(pm[slot.vKey] || "");
        if (!vendorId) continue;
        const key = fabricKey(fabricName, vendorId);
        if (!seen.has(key)) {
          seen.set(key, {
            fabricName,
            vendorId,
            vendorName: info?.vendorName || "",
            costPerKg: toNum(pm[slot.cKey]) ?? info?.mrp ?? null,
          });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.fabricName.localeCompare(b.fabricName));
  }, [productMasters, fabricVendorMap]);

  const fabricOptions = useMemo(() =>
    usedFabrics.map((f) => ({
      label: f.vendorName ? `${f.fabricName} (${f.vendorName})` : f.fabricName,
      value: fabricKey(f.fabricName, f.vendorId),
    })),
  [usedFabrics]);

  // Colours available for the currently-picked fabric across all slots in ProductMaster
  const colourOptionsForPickedFabric = useMemo(() => {
    if (!pickFabricKey) return [];
    const picked = usedFabrics.find((f) => fabricKey(f.fabricName, f.vendorId) === pickFabricKey);
    if (!picked) return [];
    const colours = new Set<string>();
    for (const pm of productMasters) {
      const slots: { name: string; vKey: string; cKey: string }[] = [
        { name: "fabricName", vKey: "fabricVendorId", cKey: "coloursAvailable" },
        { name: "fabric2Name", vKey: "fabric2VendorId", cKey: "colours2Available" },
        { name: "fabric3Name", vKey: "fabric3VendorId", cKey: "colours3Available" },
        { name: "fabric4Name", vKey: "fabric4VendorId", cKey: "colours4Available" },
      ];
      for (const s of slots) {
        const fname = pm[s.name] ? String(pm[s.name]) : "";
        if (fname !== picked.fabricName) continue;
        const info = fabricVendorMap.get(fname);
        const vId = info?.vendorId || String(pm[s.vKey] || "");
        if (vId !== picked.vendorId) continue;
        const arr = pm[s.cKey] as string[] | undefined;
        if (Array.isArray(arr)) arr.forEach((c) => c && colours.add(c));
      }
    }
    // Exclude already-picked (fabric, colour) sections
    const pickedSectionKeys = new Set(fabricSections.map((sec) => sectionKey(sec.fabricName, sec.vendorId, sec.sectionColour)));
    return Array.from(colours)
      .filter((c) => !pickedSectionKeys.has(sectionKey(picked.fabricName, picked.vendorId, c)))
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ label: c, value: c }));
  }, [pickFabricKey, usedFabrics, productMasters, fabricVendorMap, fabricSections]);

  function isRepeatArticle(articleNumber: string): boolean {
    if (previousArticleSet.has(articleNumber)) return true;
    const num = Number(articleNumber);
    if (!isNaN(num) && num < phaseNumber * 1000) return true;
    return false;
  }

  const handleAddArticle = useCallback((articleNumber: string) => {
    if (!articleNumber) return;
    const masters = articleGroups.get(articleNumber);
    if (!masters || masters.length === 0) return;

    const first = masters[0];
    const styleName = String(first.productName || first.styleNumber || articleNumber);
    const fabricName = String(first.fabricName || "");
    const fabric2Name = first.fabric2Name ? String(first.fabric2Name) : null;
    const fabric3Name = first.fabric3Name ? String(first.fabric3Name) : null;
    const fabric4Name = first.fabric4Name ? String(first.fabric4Name) : null;

    type ColourEntry = { colour: string; colour2?: string; colour3?: string; colour4?: string };
    const colourEntries: ColourEntry[] = [];
    const colourKeys = new Set<string>();
    for (const m of masters) {
      const c1 = (m.coloursAvailable as string[] | undefined)?.[0];
      const c2 = (m.colours2Available as string[] | undefined)?.[0] || undefined;
      const c3 = (m.colours3Available as string[] | undefined)?.[0] || undefined;
      const c4 = (m.colours4Available as string[] | undefined)?.[0] || undefined;
      if (!c1) continue;
      const key = [c1, c2 || "", c3 || "", c4 || ""].join("|");
      if (!colourKeys.has(key)) {
        colourKeys.add(key);
        colourEntries.push({ colour: c1, colour2: c2, colour3: c3, colour4: c4 });
      }
    }

    const fabricInfo = fabricVendorMap.get(fabricName);
    const fabric2Info = fabric2Name ? fabricVendorMap.get(fabric2Name) : null;
    const fabric3Info = fabric3Name ? fabricVendorMap.get(fabric3Name) : null;
    const fabric4Info = fabric4Name ? fabricVendorMap.get(fabric4Name) : null;

    const article: SelectedArticle = {
      articleNumber,
      styleName,
      fabricName,
      fabric2Name,
      fabric3Name,
      fabric4Name,
      garmentsPerKg: toNum(first.garmentsPerKg),
      garmentsPerKg2: toNum(first.garmentsPerKg2),
      garmentsPerKg3: toNum(first.garmentsPerKg3),
      garmentsPerKg4: toNum(first.garmentsPerKg4),
      fabricCostPerKg: toNum(first.fabricCostPerKg) ?? fabricInfo?.mrp ?? null,
      fabric2CostPerKg: toNum(first.fabric2CostPerKg) ?? fabric2Info?.mrp ?? null,
      fabric3CostPerKg: toNum(first.fabric3CostPerKg) ?? fabric3Info?.mrp ?? null,
      fabric4CostPerKg: toNum(first.fabric4CostPerKg) ?? fabric4Info?.mrp ?? null,
      fabricVendorId: fabricInfo?.vendorId || "",
      fabricVendorName: fabricInfo?.vendorName || "",
      fabric2VendorId: fabric2Info?.vendorId || null,
      fabric2VendorName: fabric2Info?.vendorName || null,
      fabric3VendorId: fabric3Info?.vendorId || null,
      fabric3VendorName: fabric3Info?.vendorName || null,
      fabric4VendorId: fabric4Info?.vendorId || null,
      fabric4VendorName: fabric4Info?.vendorName || null,
      type: String(first.type || ""),
      gender: String(first.gender || "MENS"),
      productName: String(first.productName || ""),
      garmentingAt: first.garmentingAt ? String(first.garmentingAt) : null,
      availableColours: colourEntries.map((e) => [e.colour, e.colour2, e.colour3, e.colour4].filter(Boolean).join("/")),
      colourQtys: colourEntries.map((e) => ({ colour: e.colour, colour2: e.colour2, colour3: e.colour3, colour4: e.colour4, qty: 0 })),
      isRepeat: isRepeatArticle(articleNumber),
      stitchingCost: toNum(first.stitchingCost),
      brandLogoCost: toNum(first.brandLogoCost),
      neckTwillCost: toNum(first.neckTwillCost),
      reflectorsCost: toNum(first.reflectorsCost),
      fusingCost: toNum(first.fusingCost),
      accessoriesCost: toNum(first.accessoriesCost),
      brandTagCost: toNum(first.brandTagCost),
      sizeTagCost: toNum(first.sizeTagCost),
      packagingCost: toNum(first.packagingCost),
      outwardShippingCost: toNum(first.inwardShipping),
      proposedMrp: toNum(first.proposedMrp),
      onlineMrp: toNum(first.onlineMrp),
    };

    setSelectedArticles((prev) => {
      const next = [...prev, article];
      setScrollTargetKey(`article-${article.articleNumber}-${next.length - 1}`);
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleGroups, fabricVendorMap, previousArticleSet, phaseNumber]);

  function removeArticle(index: number) {
    setSelectedArticles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateColourQty(articleIndex: number, colourIndex: number, qty: number) {
    setSelectedArticles((prev) =>
      prev.map((a, i) =>
        i === articleIndex
          ? {
              ...a,
              colourQtys: a.colourQtys.map((cq, j) =>
                j === colourIndex ? { ...cq, qty } : cq
              ),
            }
          : a
      )
    );
  }

  // FABRIC MODE: add a (fabric, colour) section; populate rows from ProductMasters
  // where this fabric appears in some slot AND the colour for that slot matches.
  const handleAddFabric = useCallback(() => {
    if (!pickFabricKey || !pickColour) return;
    const fab = usedFabrics.find((f) => fabricKey(f.fabricName, f.vendorId) === pickFabricKey);
    if (!fab) return;
    const newSecKey = sectionKey(fab.fabricName, fab.vendorId, pickColour);
    if (fabricSections.some((s) => sectionKey(s.fabricName, s.vendorId, s.sectionColour) === newSecKey)) return;

    const rows: FabricAllocationRow[] = [];
    const seenRowKeys = new Set<string>();

    const slots: { slot: 1 | 2 | 3 | 4; fName: string; vName: string; gpkName: string; coloursName: string }[] = [
      { slot: 1, fName: "fabricName", vName: "fabricVendorId", gpkName: "garmentsPerKg", coloursName: "coloursAvailable" },
      { slot: 2, fName: "fabric2Name", vName: "fabric2VendorId", gpkName: "garmentsPerKg2", coloursName: "colours2Available" },
      { slot: 3, fName: "fabric3Name", vName: "fabric3VendorId", gpkName: "garmentsPerKg3", coloursName: "colours3Available" },
      { slot: 4, fName: "fabric4Name", vName: "fabric4VendorId", gpkName: "garmentsPerKg4", coloursName: "colours4Available" },
    ];

    for (const pm of productMasters) {
      const articleNumber = String(pm.articleNumber || "");
      if (!articleNumber) continue;

      let matched: typeof slots[number] | null = null;
      for (const s of slots) {
        const fname = pm[s.fName] ? String(pm[s.fName]) : "";
        if (fname !== fab.fabricName) continue;
        const info = fabricVendorMap.get(fname);
        const vId = info?.vendorId || String(pm[s.vName] || "");
        if (vId !== fab.vendorId) continue;
        const colours = pm[s.coloursName] as string[] | undefined;
        if (!Array.isArray(colours) || !colours.includes(pickColour)) continue;
        matched = s;
        break;
      }
      if (!matched) continue;

      const c1 = matched.slot === 1 ? pickColour : (pm.coloursAvailable as string[] | undefined)?.[0];
      const c2 = matched.slot === 2 ? pickColour : (pm.colours2Available as string[] | undefined)?.[0] || undefined;
      const c3 = matched.slot === 3 ? pickColour : (pm.colours3Available as string[] | undefined)?.[0] || undefined;
      const c4 = matched.slot === 4 ? pickColour : (pm.colours4Available as string[] | undefined)?.[0] || undefined;
      if (!c1) continue;

      const rowKey = `${articleNumber}||${c1}|${c2 || ""}|${c3 || ""}|${c4 || ""}`;
      if (seenRowKeys.has(rowKey)) continue;
      seenRowKeys.add(rowKey);

      rows.push({
        articleNumber,
        styleName: String(pm.productName || pm.styleNumber || articleNumber),
        colour: c1,
        colour2: c2,
        colour3: c3,
        colour4: c4,
        slot: matched.slot,
        gpkForSlot: toNum(pm[matched.gpkName]),
        kg: 0,
        skuCode: String(pm.skuCode || ""),
      });
    }

    rows.sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));

    const section: FabricSectionData = {
      fabricName: fab.fabricName,
      vendorId: fab.vendorId,
      vendorName: fab.vendorName,
      sectionColour: pickColour,
      costPerKg: fab.costPerKg,
      rows,
    };
    setFabricSections((prev) => [...prev, section]);
    setScrollTargetKey(newSecKey);
    setPickFabricKey("");
    setPickColour("");
  }, [pickFabricKey, pickColour, usedFabrics, fabricSections, productMasters, fabricVendorMap]);

  function removeFabricSection(index: number) {
    const removed = fabricSections[index];
    if (!removed) return;
    const removedKey = sectionKey(removed.fabricName, removed.vendorId, removed.sectionColour);
    setOwnership((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v !== removedKey) next[k] = v;
      }
      return next;
    });
    setFabricSections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFabricKg(sectionIndex: number, rowIndex: number, kg: number) {
    const section = fabricSections[sectionIndex];
    if (!section) return;
    const row = section.rows[rowIndex];
    if (!row) return;
    const ownerKey = sectionKey(section.fabricName, section.vendorId, section.sectionColour);
    const oKey = ownershipKey(row.articleNumber, row.colour, row.colour2, row.colour3, row.colour4);
    const currentOwner = ownership[oKey];

    if (currentOwner && currentOwner !== ownerKey) return;

    setFabricSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex
          ? { ...s, rows: s.rows.map((r, j) => (j === rowIndex ? { ...r, kg } : r)) }
          : s
      )
    );

    setOwnership((prev) => {
      const next = { ...prev };
      if (kg > 0) {
        next[oKey] = ownerKey;
      } else if (next[oKey] === ownerKey) {
        delete next[oKey];
      }
      return next;
    });
  }

  function findSkuCode(articleNumber: string, colour: string, colour2?: string, colour3?: string, colour4?: string): string {
    const masters = articleGroups.get(articleNumber) || [];
    const matchAt = (arr: string[] | undefined, val: string | undefined) => {
      if (val) return arr?.includes(val) === true;
      return !arr || arr.length === 0;
    };
    for (const m of masters) {
      const c1s = m.coloursAvailable as string[] | undefined;
      const c2s = m.colours2Available as string[] | undefined;
      const c3s = m.colours3Available as string[] | undefined;
      const c4s = m.colours4Available as string[] | undefined;
      if (!c1s?.includes(colour)) continue;
      if (matchAt(c2s, colour2) && matchAt(c3s, colour3) && matchAt(c4s, colour4) && m.skuCode) {
        return String(m.skuCode);
      }
    }
    return "";
  }

  // Build orders from quantity-mode selectedArticles
  const quantityOrders = useMemo(() => {
    const skus: PlannedSKUOrder[] = [];
    const fabrics: PlannedFabricOrder[] = [];

    for (const article of selectedArticles) {
      for (const cq of article.colourQtys) {
        if (cq.qty <= 0) continue;

        const colourLabel = [cq.colour, cq.colour2, cq.colour3, cq.colour4].filter(Boolean).join("/");
        skus.push({
          styleNumber: article.styleName,
          articleNumber: article.articleNumber,
          skuCode: findSkuCode(article.articleNumber, cq.colour, cq.colour2, cq.colour3, cq.colour4),
          colourOrdered: colourLabel,
          garmentNumber: cq.qty,
          isRepeat: article.isRepeat,
          type: article.type,
          gender: article.gender,
          productName: article.productName,
          fabricVendorId: article.fabricVendorId,
          fabricName: article.fabricName,
          fabric2Name: article.fabric2Name,
          fabric2VendorId: article.fabric2VendorId,
          fabricCostPerKg: article.fabricCostPerKg,
          fabric2CostPerKg: article.fabric2CostPerKg,
          assumedFabricGarmentsPerKg: article.garmentsPerKg,
          assumedFabric2GarmentsPerKg: article.garmentsPerKg2,
          stitchingCost: article.stitchingCost,
          brandLogoCost: article.brandLogoCost,
          neckTwillCost: article.neckTwillCost,
          reflectorsCost: article.reflectorsCost,
          fusingCost: article.fusingCost,
          accessoriesCost: article.accessoriesCost,
          brandTagCost: article.brandTagCost,
          sizeTagCost: article.sizeTagCost,
          packagingCost: article.packagingCost,
          outwardShippingCost: article.outwardShippingCost,
          proposedMrp: article.proposedMrp,
          onlineMrp: article.onlineMrp,
          garmentingAt: article.garmentingAt,
        });

        if (article.fabricVendorId) {
          const fabricQty = article.garmentsPerKg ? cq.qty / article.garmentsPerKg : 0;
          fabrics.push({
            fabricName: article.fabricName,
            fabricVendorId: article.fabricVendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour,
            fabricOrderedQuantityKg: Math.round(fabricQty * 100) / 100,
            costPerUnit: article.fabricCostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }
        if (article.fabric2Name && article.fabric2VendorId && cq.colour2) {
          const q = article.garmentsPerKg2 ? cq.qty / article.garmentsPerKg2 : 0;
          fabrics.push({
            fabricName: article.fabric2Name,
            fabricVendorId: article.fabric2VendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour2,
            fabricOrderedQuantityKg: Math.round(q * 100) / 100,
            costPerUnit: article.fabric2CostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }
        if (article.fabric3Name && article.fabric3VendorId && cq.colour3) {
          const q = article.garmentsPerKg3 ? cq.qty / article.garmentsPerKg3 : 0;
          fabrics.push({
            fabricName: article.fabric3Name,
            fabricVendorId: article.fabric3VendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour3,
            fabricOrderedQuantityKg: Math.round(q * 100) / 100,
            costPerUnit: article.fabric3CostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }
        if (article.fabric4Name && article.fabric4VendorId && cq.colour4) {
          const q = article.garmentsPerKg4 ? cq.qty / article.garmentsPerKg4 : 0;
          fabrics.push({
            fabricName: article.fabric4Name,
            fabricVendorId: article.fabric4VendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour4,
            fabricOrderedQuantityKg: Math.round(q * 100) / 100,
            costPerUnit: article.fabric4CostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }
      }
    }
    return { skuOrders: skus, fabricOrders: fabrics };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArticles]);

  // Build orders from fabric-mode sections + ownership
  const fabricModeOrders = useMemo(() => {
    const skus: PlannedSKUOrder[] = [];
    const fabrics: PlannedFabricOrder[] = [];

    // For each (article, colour) that has an owner, compute qty from owner's kg × gpkForSlot
    // Then emit SKU + fabric orders for all fabrics this article uses.
    type Resolved = {
      row: FabricAllocationRow;
      master: ProductMaster;
      owningSection: FabricSectionData;
      qty: number;
    };
    const resolved: Resolved[] = [];

    for (const section of fabricSections) {
      const sKey = sectionKey(section.fabricName, section.vendorId, section.sectionColour);
      for (const row of section.rows) {
        const oKey = ownershipKey(row.articleNumber, row.colour, row.colour2, row.colour3, row.colour4);
        if (ownership[oKey] !== sKey) continue;
        if (!row.gpkForSlot || row.kg <= 0) continue;
        const qty = Math.round(row.kg * row.gpkForSlot);
        if (qty <= 0) continue;
        // Find master for full article metadata
        const masters = articleGroups.get(row.articleNumber) || [];
        const master = masters.find((m) => {
          const c1s = m.coloursAvailable as string[] | undefined;
          return c1s?.includes(row.colour);
        }) || masters[0];
        if (!master) continue;
        resolved.push({ row, master, owningSection: section, qty });
      }
    }

    for (const { row, master, qty } of resolved) {
      const articleNumber = row.articleNumber;
      const styleName = String(master.productName || master.styleNumber || articleNumber);
      const fabricName = String(master.fabricName || "");
      const fabric2Name = master.fabric2Name ? String(master.fabric2Name) : null;
      const fabric3Name = master.fabric3Name ? String(master.fabric3Name) : null;
      const fabric4Name = master.fabric4Name ? String(master.fabric4Name) : null;

      const fabricInfo = fabricVendorMap.get(fabricName);
      const fabric2Info = fabric2Name ? fabricVendorMap.get(fabric2Name) : null;
      const fabric3Info = fabric3Name ? fabricVendorMap.get(fabric3Name) : null;
      const fabric4Info = fabric4Name ? fabricVendorMap.get(fabric4Name) : null;

      const isRepeat = isRepeatArticle(articleNumber);
      const gender = String(master.gender || "MENS");
      const type = String(master.type || "");
      const colourLabel = [row.colour, row.colour2, row.colour3, row.colour4].filter(Boolean).join("/");

      skus.push({
        styleNumber: styleName,
        articleNumber,
        skuCode: row.skuCode || findSkuCode(articleNumber, row.colour, row.colour2, row.colour3, row.colour4),
        colourOrdered: colourLabel,
        garmentNumber: qty,
        isRepeat,
        type,
        gender,
        productName: String(master.productName || ""),
        fabricVendorId: fabricInfo?.vendorId || "",
        fabricName,
        fabric2Name,
        fabric2VendorId: fabric2Info?.vendorId || null,
        fabricCostPerKg: toNum(master.fabricCostPerKg) ?? fabricInfo?.mrp ?? null,
        fabric2CostPerKg: toNum(master.fabric2CostPerKg) ?? fabric2Info?.mrp ?? null,
        assumedFabricGarmentsPerKg: toNum(master.garmentsPerKg),
        assumedFabric2GarmentsPerKg: toNum(master.garmentsPerKg2),
        stitchingCost: toNum(master.stitchingCost),
        brandLogoCost: toNum(master.brandLogoCost),
        neckTwillCost: toNum(master.neckTwillCost),
        reflectorsCost: toNum(master.reflectorsCost),
        fusingCost: toNum(master.fusingCost),
        accessoriesCost: toNum(master.accessoriesCost),
        brandTagCost: toNum(master.brandTagCost),
        sizeTagCost: toNum(master.sizeTagCost),
        packagingCost: toNum(master.packagingCost),
        outwardShippingCost: toNum(master.inwardShipping),
        proposedMrp: toNum(master.proposedMrp),
        onlineMrp: toNum(master.onlineMrp),
        garmentingAt: master.garmentingAt ? String(master.garmentingAt) : null,
      });

      // Fabric orders for each slot the article has
      const emit = (name: string | null, vId: string | null | undefined, cost: number | null, gpk: number | null, colour: string | undefined) => {
        if (!name || !vId || !colour) return;
        const q = gpk ? qty / gpk : 0;
        fabrics.push({
          fabricName: name,
          fabricVendorId: vId,
          articleNumbers: articleNumber,
          colour,
          fabricOrderedQuantityKg: Math.round(q * 100) / 100,
          costPerUnit: cost,
          isRepeat,
          gender,
          orderStatus: "DRAFT_ORDER",
          garmentingAt: null,
        });
      };
      emit(fabricName, fabricInfo?.vendorId, toNum(master.fabricCostPerKg) ?? fabricInfo?.mrp ?? null, toNum(master.garmentsPerKg), row.colour);
      emit(fabric2Name, fabric2Info?.vendorId || null, toNum(master.fabric2CostPerKg) ?? fabric2Info?.mrp ?? null, toNum(master.garmentsPerKg2), row.colour2);
      emit(fabric3Name, fabric3Info?.vendorId || null, toNum(master.fabric3CostPerKg) ?? fabric3Info?.mrp ?? null, toNum(master.garmentsPerKg3), row.colour3);
      emit(fabric4Name, fabric4Info?.vendorId || null, toNum(master.fabric4CostPerKg) ?? fabric4Info?.mrp ?? null, toNum(master.garmentsPerKg4), row.colour4);
    }

    return { skuOrders: skus, fabricOrders: fabrics };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricSections, ownership, articleGroups, fabricVendorMap]);

  const { skuOrders, fabricOrders } = mode === "fabric" ? fabricModeOrders : quantityOrders;

  // Grouped fabric summary
  const fabricSummary = useMemo(() => {
    type Row = { fabricName: string; vendorId: string; vendorName: string; colour: string; qtyKg: number; costPerUnit: number | null };
    const byKey = new Map<string, Row>();
    for (const fo of fabricOrders) {
      const key = `${fo.fabricName}||${fo.fabricVendorId}||${fo.colour.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.qtyKg += fo.fabricOrderedQuantityKg;
      } else {
        const vendor = vendors.find((v) => v.id === fo.fabricVendorId);
        byKey.set(key, {
          fabricName: fo.fabricName,
          vendorId: fo.fabricVendorId,
          vendorName: vendor?.name || "—",
          colour: fo.colour,
          qtyKg: fo.fabricOrderedQuantityKg,
          costPerUnit: fo.costPerUnit,
        });
      }
    }
    const rows = Array.from(byKey.values())
      .map((r) => ({ ...r, qtyKg: Math.round(r.qtyKg * 100) / 100 }))
      .sort((a, b) => a.fabricName.localeCompare(b.fabricName) || a.colour.localeCompare(b.colour));
    const totalKg = Math.round(rows.reduce((s, r) => s + r.qtyKg, 0) * 100) / 100;
    return { rows, totalKg };
  }, [fabricOrders, vendors]);

  async function handleCreate() {
    if (skuOrders.length === 0) {
      toast.error("No orders to create.");
      return;
    }
    setSubmitting(true);
    try {
      await createPlanOrders(phaseId, skuOrders, fabricOrders);
      // Clear only the just-submitted mode's slice; the other mode's draft (if any) is preserved.
      try {
        const otherHasContent = mode === "quantity" ? fabricSections.length > 0 : selectedArticles.length > 0;
        if (!otherHasContent) {
          await deleteDraft(phaseId);
        } else {
          const payload: Record<string, unknown> = {};
          if (mode === "quantity") payload.fabric = { fabricSections, ownership };
          else payload.quantity = { selectedArticles };
          await saveDraft(phaseId, payload);
        }
      } catch { /* ignore */ }
      toast.success(`Created ${skuOrders.length} article orders and ${fabricOrders.length} fabric orders`);
      router.push("/products");
      router.refresh();
    } catch {
      toast.error("Failed to create orders");
    } finally {
      setSubmitting(false);
    }
  }

  const formatLocal = (d: Date) =>
    d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  // ─── REVIEW STEP ────────────────────────────────────────────────

  if (step === "review") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to Planning
        </Button>

        <div>
          <h2 className="text-lg font-semibold mb-3">Article Orders ({skuOrders.length})</h2>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-[16%]">Product</th>
                  <th className="px-3 py-2 text-left font-medium w-[9%]">Article #</th>
                  <th className="px-3 py-2 text-left font-medium w-[10%]">Type</th>
                  <th className="px-3 py-2 text-left font-medium w-[15%]">Article Code</th>
                  <th className="px-3 py-2 text-left font-medium w-[15%]">Colour</th>
                  <th className="px-3 py-2 text-right font-medium w-[10%]">Target Qty</th>
                  <th className="px-3 py-2 text-left font-medium w-[12%]">Fabric</th>
                  <th className="px-3 py-2 text-left font-medium w-[7%]">Repeat?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {skuOrders.map((sku, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{sku.productName || sku.styleNumber}</td>
                    <td className="px-3 py-2">{sku.articleNumber}</td>
                    <td className="px-3 py-2">{sku.type || "—"}</td>
                    <td className="px-3 py-2">{sku.skuCode || "—"}</td>
                    <td className="px-3 py-2">{sku.colourOrdered}</td>
                    <td className="px-3 py-2 text-right">{sku.garmentNumber}</td>
                    <td className="px-3 py-2">{sku.fabricName}</td>
                    <td className="px-3 py-2">{sku.isRepeat ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Fabric Orders ({fabricOrders.length})</h2>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Fabric</th>
                  <th className="px-3 py-2 text-left font-medium w-[14%]">Vendor</th>
                  <th className="px-3 py-2 text-left font-medium w-[10%]">For Article</th>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Colour</th>
                  <th className="px-3 py-2 text-right font-medium w-[14%]">Ordered Qty (kg)</th>
                  <th className="px-3 py-2 text-right font-medium w-[14%]">Cost/Unit</th>
                  <th className="px-3 py-2 text-left font-medium w-[8%]">Repeat?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fabricOrders.map((fo, i) => {
                  const vendor = vendors.find((v) => v.id === fo.fabricVendorId);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2">{fo.fabricName}</td>
                      <td className="px-3 py-2">{vendor?.name || "—"}</td>
                      <td className="px-3 py-2">{fo.articleNumbers}</td>
                      <td className="px-3 py-2">{fo.colour}</td>
                      <td className="px-3 py-2 text-right">{fo.fabricOrderedQuantityKg}</td>
                      <td className="px-3 py-2 text-right">{fo.costPerUnit ? `Rs ${fo.costPerUnit}` : "—"}</td>
                      <td className="px-3 py-2">{fo.isRepeat ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleCreate} disabled={submitting || skuOrders.length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create {skuOrders.length} Article Orders + {fabricOrders.length} Fabric Orders
          </Button>
        </div>
      </div>
    );
  }

  // ─── SELECT STEP ────────────────────────────────────────────────

  // Shared top banners + dialogs
  const restoredBannerSavedAt =
    mode === "quantity" && hydratedQuantity && !quantityBannerDismissed
      ? quantitySavedAt
      : mode === "fabric" && hydratedFabric && !fabricBannerDismissed
        ? fabricSavedAt
        : null;
  const showRestoredBanner = restoredBannerSavedAt !== null;
  const topBanners = (
    <>
      {showRestoredBanner && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm">
          <span className="text-amber-900 dark:text-amber-200 truncate">
            <span className="font-medium">Restored your in-progress {mode === "quantity" ? "quantity" : "fabric"} plan</span> saved at {formatLocal(restoredBannerSavedAt!)}.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDiscardConfirmOpen(true)}
              className="inline-flex items-center rounded border border-amber-400 dark:border-amber-700 px-2 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
            >
              Discard this mode&apos;s draft
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === "quantity") setQuantityBannerDismissed(true);
                else if (mode === "fabric") setFabricBannerDismissed(true);
              }}
              aria-label="Dismiss"
              className="inline-flex items-center rounded border border-amber-400 dark:border-amber-700 p-1 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Phase Planning</h1>
          <p className="text-sm text-muted-foreground">
            Plan Article and Fabric orders for {phaseName}
          </p>
        </div>
        {mode !== null && saveStatus !== "idle" && (
          <div className="text-xs text-muted-foreground shrink-0 pb-1">
            {saveStatus === "saving" && "Saving draft…"}
            {saveStatus === "saved" && savedAt && `Draft saved at ${formatLocal(savedAt)}`}
            {saveStatus === "error" && <span className="text-red-600">Draft save failed</span>}
          </div>
        )}
      </div>
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this mode&apos;s draft?</DialogTitle>
            <DialogDescription>
              This will permanently delete your in-progress {mode === "quantity" ? "quantity" : "fabric"} plan for this phase. The other mode&apos;s draft (if any) is unaffected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={async () => { setDiscardConfirmOpen(false); await discardCurrentMode(); }}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  // ─── MODE PICKER ────────────────────────────────────────────────
  if (mode === null) {
    const quantityTotalUnits = selectedArticles.reduce(
      (s, a) => s + a.colourQtys.reduce((s2, cq) => s2 + (cq.qty || 0), 0),
      0,
    );
    const fabricTotalKg = Math.round(
      fabricSections.reduce((s, sec) => s + sec.rows.reduce((s2, r) => s2 + (r.kg || 0), 0), 0) * 100,
    ) / 100;
    const quantityHasDraft = selectedArticles.length > 0;
    const fabricHasDraft = fabricSections.length > 0;
    return (
      <div className="space-y-6">
        {topBanners}
        <div>
          <h2 className="text-base font-semibold mb-1">How do you want to plan this session?</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Pick a path. You can run multiple sessions per phase mixing both paths.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMode("quantity")}
              className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4" />
                <span className="font-medium">Plan by target quantity</span>
              </div>
              <p className="text-sm text-muted-foreground">
                I know how many pieces I want per article. Calculate fabric needed.
              </p>
              {quantityHasDraft && (
                <div className="mt-3 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-medium">Draft:</span> {selectedArticles.length} article{selectedArticles.length === 1 ? "" : "s"}, {quantityTotalUnits} unit{quantityTotalUnits === 1 ? "" : "s"}
                  {quantitySavedAt && (
                    <span className="text-amber-800/70 dark:text-amber-300/70"> · saved {formatLocal(quantitySavedAt)}</span>
                  )}
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode("fabric")}
              className="text-left border rounded-lg p-4 hover:border-primary hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4" />
                <span className="font-medium">Plan by fabric availability</span>
              </div>
              <p className="text-sm text-muted-foreground">
                I have fabric on hand. Allocate kg to articles; calculate producible quantity.
              </p>
              {fabricHasDraft && (
                <div className="mt-3 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-medium">Draft:</span> {fabricSections.length} section{fabricSections.length === 1 ? "" : "s"}, {fabricTotalKg} kg
                  {fabricSavedAt && (
                    <span className="text-amber-800/70 dark:text-amber-300/70"> · saved {formatLocal(fabricSavedAt)}</span>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── QUANTITY MODE ─────────────────────────────────────────────
  if (mode === "quantity") {
    return (
      <div className="space-y-6">
        {topBanners}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Planning mode: <span className="font-medium text-foreground">By target quantity</span></span>
          <button
            type="button"
            onClick={() => setMode(null)}
            className="text-xs underline hover:text-foreground"
          >
            Switch Mode
          </button>
        </div>

        {fabricSummary.rows.length > 0 && (
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setFabricSummaryOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40"
            >
              <span className="flex items-center gap-2 font-medium">
                {fabricSummaryOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Fabric to be ordered
              </span>
              <span className="text-muted-foreground">
                {fabricSummary.rows.length} line{fabricSummary.rows.length === 1 ? "" : "s"} · {fabricSummary.totalKg} kg total
              </span>
            </button>
            {fabricSummaryOpen && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fabric</th>
                      <th className="px-3 py-2 text-left font-medium">Vendor</th>
                      <th className="px-3 py-2 text-left font-medium">Colour</th>
                      <th className="px-3 py-2 text-right font-medium">Qty (kg)</th>
                      <th className="px-3 py-2 text-right font-medium">Cost/kg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fabricSummary.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{r.fabricName}</td>
                        <td className="px-3 py-1.5">{r.vendorName}</td>
                        <td className="px-3 py-1.5">{r.colour}</td>
                        <td className="px-3 py-1.5 text-right">{r.qtyKg}</td>
                        <td className="px-3 py-1.5 text-right">{r.costPerUnit ? `Rs ${r.costPerUnit}` : "—"}</td>
                      </tr>
                    ))}
                    <tr className="font-medium bg-muted/30">
                      <td className="px-3 py-1.5" colSpan={3}>Total</td>
                      <td className="px-3 py-1.5 text-right">{fabricSummary.totalKg}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="sticky top-14 z-20 bg-background pt-2 pb-3 -mx-6 px-6 border-b">
          <div className="flex items-end gap-3">
            <div className="w-80">
              <label className="text-sm font-medium mb-1 block">Add Article</label>
              <Combobox
                value=""
                onValueChange={handleAddArticle}
                options={articleOptions}
                placeholder="Search by article # or product name..."
              />
            </div>
          </div>
        </div>

        {selectedArticles.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Select articles above to start planning production quantities.
          </p>
        )}

        {selectedArticles.map((article, articleIdx) => (
          <div key={`${article.articleNumber}-${articleIdx}`} data-scroll-key={`article-${article.articleNumber}-${articleIdx}`} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {article.articleNumber} - {article.styleName}
                  </h3>
                  {article.isRepeat && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                      Repeat
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5 space-x-4">
                  <span>Fabric: {article.fabricName} ({article.fabricVendorName || "No vendor"})</span>
                  {article.fabric2Name && <span>| 2nd: {article.fabric2Name} ({article.fabric2VendorName || "No vendor"})</span>}
                  {article.fabric3Name && <span>| 3rd: {article.fabric3Name} ({article.fabric3VendorName || "No vendor"})</span>}
                  {article.fabric4Name && <span>| 4th: {article.fabric4Name} ({article.fabric4VendorName || "No vendor"})</span>}
                </div>
                <div className="text-sm text-muted-foreground space-x-4">
                  <span>Garments/kg: {article.garmentsPerKg ?? "—"}</span>
                  {article.garmentsPerKg2 && <span>| 2nd: {article.garmentsPerKg2}</span>}
                  {article.garmentsPerKg3 && <span>| 3rd: {article.garmentsPerKg3}</span>}
                  {article.garmentsPerKg4 && <span>| 4th: {article.garmentsPerKg4}</span>}
                  <span>| Type: {article.type}</span>
                  <span>| Gender: {article.gender}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeArticle(articleIdx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {(() => {
              const fabricFlags = [true, !!article.fabric2Name, !!article.fabric3Name, !!article.fabric4Name];
              const fabricCount = fabricFlags.filter(Boolean).length;
              const colTemplates: Record<number, string> = {
                1: "grid-cols-[1fr_80px_repeat(6,_48px)_80px]",
                2: "grid-cols-[1fr_80px_repeat(6,_48px)_64px_64px]",
                3: "grid-cols-[1fr_80px_repeat(6,_48px)_56px_56px_56px]",
                4: "grid-cols-[1fr_80px_repeat(6,_48px)_48px_48px_48px_48px]",
              };
              const colTemplate = colTemplates[fabricCount] || colTemplates[1];
              return (
                <div className="grid gap-2">
                  <div className={`grid ${colTemplate} gap-1.5 text-[10px] font-medium text-muted-foreground px-1`}>
                    <span>Colour</span>
                    <span className="text-right">Target Qty</span>
                    {sizes.map((s) => <span key={s} className="text-center">{s}</span>)}
                    {fabricFlags[0] && <span className="text-right">F1 (kg)</span>}
                    {fabricFlags[1] && <span className="text-right">F2 (kg)</span>}
                    {fabricFlags[2] && <span className="text-right">F3 (kg)</span>}
                    {fabricFlags[3] && <span className="text-right">F4 (kg)</span>}
                  </div>
                  {article.colourQtys.map((cq, colourIdx) => {
                    const kgOf = (qty: number, gpk: number | null, hasColour: boolean) =>
                      hasColour && qty > 0 && gpk ? (qty / gpk).toFixed(1) : "—";
                    const f1Kg = kgOf(cq.qty, article.garmentsPerKg, true);
                    const f2Kg = kgOf(cq.qty, article.garmentsPerKg2, !!cq.colour2);
                    const f3Kg = kgOf(cq.qty, article.garmentsPerKg3, !!cq.colour3);
                    const f4Kg = kgOf(cq.qty, article.garmentsPerKg4, !!cq.colour4);
                    const colourKey = [cq.colour, cq.colour2 || "", cq.colour3 || "", cq.colour4 || ""].join("|");
                    return (
                      <div key={colourKey} className={`grid ${colTemplate} gap-1.5 items-center`}>
                        <span className="text-sm px-1">
                          {cq.colour}
                          {cq.colour2 && <span className="text-muted-foreground"> / {cq.colour2}</span>}
                          {cq.colour3 && <span className="text-muted-foreground"> / {cq.colour3}</span>}
                          {cq.colour4 && <span className="text-muted-foreground"> / {cq.colour4}</span>}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={cq.qty || ""}
                          onChange={(e) => updateColourQty(articleIdx, colourIdx, Number(e.target.value) || 0)}
                          className="h-8 text-right"
                          placeholder="0"
                        />
                        {sizes.map((size) => {
                          const pct = sizeDistMap.get(size) || 0;
                          const sizeQty = cq.qty > 0 ? Math.round((cq.qty * pct) / 100) : 0;
                          return (
                            <span key={size} className="text-xs text-center text-blue-600 bg-blue-50 rounded py-1">
                              {sizeQty || "-"}
                            </span>
                          );
                        })}
                        {fabricFlags[0] && <span className="text-sm text-muted-foreground text-right px-1">{f1Kg}</span>}
                        {fabricFlags[1] && <span className="text-sm text-muted-foreground text-right px-1">{f2Kg}</span>}
                        {fabricFlags[2] && <span className="text-sm text-muted-foreground text-right px-1">{f3Kg}</span>}
                        {fabricFlags[3] && <span className="text-sm text-muted-foreground text-right px-1">{f4Kg}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ))}

        {selectedArticles.length > 0 && (
          <div className="flex gap-3">
            <Button onClick={() => {
              const hasQty = selectedArticles.some((a) => a.colourQtys.some((cq) => cq.qty > 0));
              if (!hasQty) { toast.error("Enter quantities for at least one colour"); return; }
              setStep("review");
            }}>
              Review Orders ({skuOrders.length} Article + {fabricOrders.length} Fabric)
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── FABRIC MODE ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {topBanners}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Planning mode: <span className="font-medium text-foreground">By fabric availability</span></span>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="text-xs underline hover:text-foreground"
        >
          Switch Mode
        </button>
      </div>

      <div className="sticky top-0 z-20 bg-background pt-2 pb-3 -mx-1 px-1 border-b">
        <div className="flex items-end gap-3">
          <div className="w-64">
            <label className="text-sm font-medium mb-1 block">Fabric</label>
            <Combobox
              value={pickFabricKey}
              onValueChange={(v) => { setPickFabricKey(v); setPickColour(""); }}
              options={fabricOptions}
              placeholder="Search fabrics..."
            />
          </div>
          <div className="w-48">
            <label className="text-sm font-medium mb-1 block">Colour</label>
            <Combobox
              value={pickColour}
              onValueChange={setPickColour}
              options={colourOptionsForPickedFabric}
              placeholder={pickFabricKey ? "Pick colour..." : "Pick fabric first"}
            />
          </div>
          <Button onClick={handleAddFabric} disabled={!pickFabricKey || !pickColour}>
            Add Section
          </Button>
        </div>
      </div>

      {fabricSections.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Select a fabric and colour above to start allocating to articles.
        </p>
      )}

      {fabricSections.map((section, sIdx) => {
        const sKey = sectionKey(section.fabricName, section.vendorId, section.sectionColour);

        // Per-row pre-compute: kg (owned or derived), qty
        type RowCalc = { row: FabricAllocationRow; rIdx: number; isOwnedHere: boolean; isLockedByOther: boolean; lockedBy: FabricSectionData | null; derivedKg: number | null; effectiveKg: number; qty: number };
        const rowCalcs: RowCalc[] = section.rows.map((row, rIdx) => {
          const oKey = ownershipKey(row.articleNumber, row.colour, row.colour2, row.colour3, row.colour4);
          const owner = ownership[oKey];
          const isOwnedHere = owner === sKey;
          const isLockedByOther = !!owner && owner !== sKey;
          const lockedBy = isLockedByOther ? (fabricSections.find((s) => sectionKey(s.fabricName, s.vendorId, s.sectionColour) === owner) || null) : null;

          let derivedKg: number | null = null;
          if (isLockedByOther && lockedBy) {
            const ownerRow = lockedBy.rows.find((r) => r.articleNumber === row.articleNumber && r.colour === row.colour && r.colour2 === row.colour2 && r.colour3 === row.colour3 && r.colour4 === row.colour4);
            if (ownerRow?.gpkForSlot && ownerRow.kg > 0 && row.gpkForSlot) {
              const qty = ownerRow.kg * ownerRow.gpkForSlot;
              derivedKg = Math.round((qty / row.gpkForSlot) * 100) / 100;
            }
          }
          const effectiveKg = isOwnedHere ? row.kg : (derivedKg ?? 0);
          const qty = row.gpkForSlot ? Math.round(effectiveKg * row.gpkForSlot) : 0;
          return { row, rIdx, isOwnedHere, isLockedByOther, lockedBy, derivedKg, effectiveKg, qty };
        });

        const ownedKg = Math.round(rowCalcs.filter((c) => c.isOwnedHere).reduce((s, c) => s + c.row.kg, 0) * 100) / 100;
        const derivedKg = Math.round(rowCalcs.filter((c) => c.isLockedByOther).reduce((s, c) => s + (c.derivedKg ?? 0), 0) * 100) / 100;
        const totalKg = Math.round((ownedKg + derivedKg) * 100) / 100;

        const colTemplate = "grid-cols-[220px_minmax(120px,1fr)_68px_80px_48px_repeat(6,40px)_repeat(4,48px)]";
        return (
          <div key={sKey} data-scroll-key={sKey} className="border rounded-lg p-4 space-y-3 relative">
            <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-2 right-2 z-10" onClick={() => removeFabricSection(sIdx)}>
              <X className="h-4 w-4" />
            </Button>

            {(() => {
              return (
                <div className="grid gap-1.5 overflow-x-auto">
                  <div className={`grid ${colTemplate} gap-1.5 items-center px-1 min-w-max`}>
                    <div className="col-span-3 flex items-center gap-2 flex-wrap min-w-0 pr-10">
                      <h3 className="font-semibold">{section.fabricName}</h3>
                      <span className="text-xs rounded bg-muted px-1.5 py-0.5 font-medium">{section.sectionColour}</span>
                      <span className="text-xs text-muted-foreground">({section.vendorName || "No vendor"})</span>
                    </div>
                    <div className="text-base font-semibold tabular-nums text-right">
                      {totalKg} kg
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground px-1">
                    {section.rows.length} article{section.rows.length === 1 ? "" : "s"}
                    {section.costPerKg ? ` · Rs ${section.costPerKg}/kg` : ""}
                    {derivedKg > 0 ? ` · ${ownedKg} allocated + ${derivedKg} derived` : ""}
                  </div>
                  <div className={`grid ${colTemplate} gap-1.5 text-[10px] font-medium text-muted-foreground px-1 min-w-max`}>
                    <span>Article · Product</span>
                    <span>Colour</span>
                    <span className="text-right">Slot</span>
                    <span className="text-right">Allocated</span>
                    <span className="text-right">Qty</span>
                    {sizes.map((s) => <span key={s} className="text-center">{s}</span>)}
                    <span className="text-right">F1 (kg)</span>
                    <span className="text-right">F2 (kg)</span>
                    <span className="text-right">F3 (kg)</span>
                    <span className="text-right">F4 (kg)</span>
                  </div>
                  {rowCalcs.map(({ row, rIdx, isLockedByOther, lockedBy, derivedKg: dKg, qty }) => {
                    const oKey = ownershipKey(row.articleNumber, row.colour, row.colour2, row.colour3, row.colour4);
                    // Article master lookup for full fabric slot info (gpk of all slots)
                    const masters = articleGroups.get(row.articleNumber) || [];
                    const master = masters[0];
                    const productType = master ? String(master.type || "") : "";
                    const gpk1 = master ? toNum(master.garmentsPerKg) : null;
                    const gpk2 = master ? toNum(master.garmentsPerKg2) : null;
                    const gpk3 = master ? toNum(master.garmentsPerKg3) : null;
                    const gpk4 = master ? toNum(master.garmentsPerKg4) : null;
                    const kgOf = (gpk: number | null, present: boolean) => present && qty > 0 && gpk ? (qty / gpk).toFixed(1) : "—";
                    const f1Kg = kgOf(gpk1, !!row.colour);
                    const f2Kg = kgOf(gpk2, !!row.colour2);
                    const f3Kg = kgOf(gpk3, !!row.colour3);
                    const f4Kg = kgOf(gpk4, !!row.colour4);
                    return (
                      <div key={oKey} className={`grid ${colTemplate} gap-1.5 items-center min-w-max`}>
                        <span className="text-sm truncate">
                          <span className="font-medium">{row.articleNumber}</span>
                          {productType && <span className="text-muted-foreground"> · {productType}</span>}
                          <span className="text-muted-foreground"> · {row.styleName}</span>
                        </span>
                        <span className="text-sm truncate">
                          {row.colour}
                          {row.colour2 && <span className="text-muted-foreground"> / {row.colour2}</span>}
                          {row.colour3 && <span className="text-muted-foreground"> / {row.colour3}</span>}
                          {row.colour4 && <span className="text-muted-foreground"> / {row.colour4}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground text-right">
                          F{row.slot}
                          {row.gpkForSlot ? ` · ${row.gpkForSlot}/kg` : ""}
                        </span>
                        {isLockedByOther ? (
                          <span
                            className="text-sm text-muted-foreground text-right px-2 h-8 flex items-center justify-end"
                            title={`Derived from ${lockedBy?.fabricName} · ${lockedBy?.sectionColour}`}
                          >
                            {dKg !== null ? `${dKg}*` : "—"}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.kg || ""}
                            onChange={(e) => updateFabricKg(sIdx, rIdx, Number(e.target.value) || 0)}
                            className="h-8 text-right"
                            placeholder="0"
                            disabled={!row.gpkForSlot}
                          />
                        )}
                        <span className="text-sm text-right">{qty > 0 ? qty : "—"}</span>
                        {sizes.map((size) => {
                          const pct = sizeDistMap.get(size) || 0;
                          const sizeQty = qty > 0 ? Math.round((qty * pct) / 100) : 0;
                          return (
                            <span key={size} className="text-xs text-center text-blue-600 bg-blue-50 rounded py-1">
                              {sizeQty || "-"}
                            </span>
                          );
                        })}
                        <span className="text-sm text-muted-foreground text-right px-1">{f1Kg}</span>
                        <span className="text-sm text-muted-foreground text-right px-1">{f2Kg}</span>
                        <span className="text-sm text-muted-foreground text-right px-1">{f3Kg}</span>
                        <span className="text-sm text-muted-foreground text-right px-1">{f4Kg}</span>
                      </div>
                    );
                  })}
                  {rowCalcs.some((c) => c.isLockedByOther) && (
                    <p className="text-[11px] text-muted-foreground px-1 pt-1">* derived from another fabric section&apos;s allocation</p>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

      {fabricSections.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={() => {
            if (skuOrders.length === 0) { toast.error("Allocate some fabric to articles first"); return; }
            setStep("review");
          }}>
            Review Orders ({skuOrders.length} Article + {fabricOrders.length} Fabric)
          </Button>
        </div>
      )}
    </div>
  );
}
