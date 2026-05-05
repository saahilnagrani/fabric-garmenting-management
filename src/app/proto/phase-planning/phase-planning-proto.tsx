"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { createPlannedOrders, allocateAgainstFabricOrder } from "@/actions/proto-custody";

type Mode = "quantity" | "fabric";

export type PMOption = {
  id: string;
  articleNumber: string | null;
  styleNumber: string;
  skuCode: string;
  productName: string | null;
  type: string;
  gender: string;
  garmenterName: string | null;
  garmenterId: string | null;
  // Fabric 1
  fabricName: string | null;
  fabricVendorId: string | null;
  fabricVendorName: string | null;
  fabricCostPerKg: number | null;
  garmentsPerKg: number | null;
  coloursAvailable: string[];
  // Fabric 2
  fabric2Name: string | null;
  fabric2VendorId: string | null;
  fabric2VendorName: string | null;
  fabric2CostPerKg: number | null;
  garmentsPerKg2: number | null;
  colours2Available: string[];
  // Fabric 3
  fabric3Name: string | null;
  fabric3VendorId: string | null;
  fabric3VendorName: string | null;
  garmentsPerKg3: number | null;
  colours3Available: string[];
  // Fabric 4
  fabric4Name: string | null;
  fabric4VendorId: string | null;
  fabric4VendorName: string | null;
  garmentsPerKg4: number | null;
  colours4Available: string[];
};

type Garmenter = { id: string; name: string };
type ExistingFo = {
  id: string;
  fabricName: string;
  colour: string;
  vendorName: string;
  orderedKg: number;
  shippedKg: number;
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
type Size = (typeof SIZES)[number];

type ColourCombo = {
  comboKey: string;
  colour: string;
  colour2: string | null;
  colour3: string | null;
  colour4: string | null;
  qty: number;
};

type SelectedArticle = {
  rowKey: string;
  pm: PMOption;
  garmenterId: string;
  isRepeat: boolean;
  combos: ColourCombo[];
};

let _seq = 0;
const nextKey = () => `r${++_seq}`;

function pmLabel(pm: PMOption): string {
  const clean = (s: string | null | undefined) => {
    const t = (s ?? "").trim();
    return t && t !== "-" ? t : "";
  };
  const article = clean(pm.articleNumber) || clean(pm.styleNumber);
  const name = clean(pm.productName);
  const fabric = clean(pm.fabricName);
  const parts = [article, name, fabric].filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(" · ") : "(unnamed)";
}

function fabricSlots(pm: PMOption): { slot: 1 | 2 | 3 | 4; name: string; vendorId: string | null; vendorName: string | null; gpk: number | null; cost: number | null; colours: string[] }[] {
  const slots: ReturnType<typeof fabricSlots> = [];
  if (pm.fabricName) slots.push({ slot: 1, name: pm.fabricName, vendorId: pm.fabricVendorId, vendorName: pm.fabricVendorName, gpk: pm.garmentsPerKg, cost: pm.fabricCostPerKg, colours: pm.coloursAvailable });
  if (pm.fabric2Name) slots.push({ slot: 2, name: pm.fabric2Name, vendorId: pm.fabric2VendorId, vendorName: pm.fabric2VendorName, gpk: pm.garmentsPerKg2, cost: pm.fabric2CostPerKg, colours: pm.colours2Available });
  if (pm.fabric3Name) slots.push({ slot: 3, name: pm.fabric3Name, vendorId: pm.fabric3VendorId, vendorName: pm.fabric3VendorName, gpk: pm.garmentsPerKg3, cost: null, colours: pm.colours3Available });
  if (pm.fabric4Name) slots.push({ slot: 4, name: pm.fabric4Name, vendorId: pm.fabric4VendorId, vendorName: pm.fabric4VendorName, gpk: pm.garmentsPerKg4, cost: null, colours: pm.colours4Available });
  return slots;
}

/**
 * Build combos from a *group* of ProductMaster rows that share an
 * articleNumber. Each PM contributes its own colour variants; combos are
 * deduped across PMs by their concatenated colour signature.
 *
 * Single-fabric article: one combo per colour string in coloursAvailable
 *   across all variants.
 * Multi-fabric article: one combo per positional colour set
 *   (coloursAvailable[i], colours2Available[i], ...) across all variants.
 */
function buildInitialCombos(pms: PMOption[]): ColourCombo[] {
  const combos: ColourCombo[] = [];
  const seen = new Set<string>();

  for (const pm of pms) {
    const c1 = pm.coloursAvailable;
    const c2 = pm.colours2Available;
    const c3 = pm.colours3Available;
    const c4 = pm.colours4Available;
    const isMulti = (pm.fabric2Name || pm.fabric3Name || pm.fabric4Name) ? true : false;

    if (isMulti) {
      const max = Math.max(c1.length, c2.length, c3.length, c4.length, 1);
      for (let i = 0; i < max; i++) {
        const a = c1[i] ?? c1[0] ?? "—";
        const b = c2[i] ?? c2[0] ?? null;
        const c = c3[i] ?? c3[0] ?? null;
        const d = c4[i] ?? c4[0] ?? null;
        const sig = `${a}|${b ?? ""}|${c ?? ""}|${d ?? ""}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        combos.push({ comboKey: sig, colour: a, colour2: b, colour3: c, colour4: d, qty: 0 });
      }
    } else {
      const cols = c1.length > 0 ? c1 : ["(no colour set)"];
      for (const c of cols) {
        if (seen.has(c)) continue;
        seen.add(c);
        combos.push({ comboKey: c, colour: c, colour2: null, colour3: null, colour4: null, qty: 0 });
      }
    }
  }
  return combos;
}

function colourLabel(c: ColourCombo): string {
  return [c.colour, c.colour2, c.colour3, c.colour4].filter(Boolean).join(" / ");
}

const isRepeatArticle = (articleNumber: string, previous: Set<string>, currentPhase: number): boolean => {
  if (previous.has(articleNumber)) return true;
  const base = articleNumber.split("-")[0];
  if (previous.has(base)) return true;
  // Heuristic: pre-current-phase-numbered articles are likely repeats
  const baseNum = Number(base);
  if (!Number.isNaN(baseNum) && baseNum > 0 && baseNum < currentPhase * 1000) return true;
  return false;
};

export function PhasePlanningProto({
  phaseId,
  phaseNumber,
  isTestPhase,
  productMasterOptions,
  garmenters,
  sizeDistMap,
  previousArticleNumbers,
  existingFabricOrders,
}: {
  phaseId: string;
  phaseNumber: number;
  isTestPhase: boolean;
  productMasterOptions: PMOption[];
  garmenters: Garmenter[];
  sizeDistMap: Record<string, number>;
  previousArticleNumbers: string[];
  existingFabricOrders: ExistingFo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("quantity");
  const [step, setStep] = useState<"select" | "review">("select");

  const previousSet = useMemo(() => new Set(previousArticleNumbers), [previousArticleNumbers]);

  // Group ProductMasters by articleNumber so the picker shows one entry per
  // article (the live form does the same). Each group's first PM is the
  // canonical metadata; combos are aggregated across all variants.
  const articleGroups = useMemo(() => {
    const m = new Map<string, PMOption[]>();
    for (const pm of productMasterOptions) {
      const an = (pm.articleNumber ?? pm.styleNumber ?? "").trim();
      if (!an || an === "-") continue;
      if (!m.has(an)) m.set(an, []);
      m.get(an)!.push(pm);
    }
    return m;
  }, [productMasterOptions]);

  // Quantity-mode state
  const [defaultGarmenterId, setDefaultGarmenterId] = useState(garmenters[0]?.id ?? "");
  const [selected, setSelected] = useState<SelectedArticle[]>([]);
  const [pickArticle, setPickArticle] = useState("");
  const scrollTargetRef = useRef<string | null>(null);

  // Fabric-mode state (kept simple from previous version)
  const [foId, setFoId] = useState("");
  const [fabricRows, setFabricRows] = useState<{ rowKey: string; pmId: string; articleNumber: string | null; styleNumber: string; productName: string | null; qty: number; allocateKg: number; garmenterId: string }[]>([]);
  const [pickPmIdFab, setPickPmIdFab] = useState("");
  const [reservationKg, setReservationKg] = useState(0);
  const [reservationPurpose, setReservationPurpose] = useState("sampling");
  const selectedFo = useMemo(() => existingFabricOrders.find((f) => f.id === foId) ?? null, [foId, existingFabricOrders]);

  // ── Combobox options ────────────────────────────────────────────
  // One option per articleNumber. Label includes the article's product name
  // and the unique set of fabrics across its variants.
  const articleComboOptions = useMemo(() => {
    const opts: { label: string; value: string; searchText: string }[] = [];
    for (const [articleNumber, pms] of articleGroups) {
      const first = pms[0];
      const fabrics = new Set<string>();
      for (const pm of pms) {
        if (pm.fabricName) fabrics.add(pm.fabricName);
        if (pm.fabric2Name) fabrics.add(pm.fabric2Name);
        if (pm.fabric3Name) fabrics.add(pm.fabric3Name);
        if (pm.fabric4Name) fabrics.add(pm.fabric4Name);
      }
      const fabricPart = [...fabrics].join(", ");
      const parts = [articleNumber, first.productName, fabricPart].filter((p) => (p ?? "").toString().trim().length > 0);
      const label = parts.join(" · ");
      const searchText = [articleNumber, first.productName, first.styleNumber, first.fabricVendorName, fabricPart].filter(Boolean).join(" ");
      opts.push({ label, value: articleNumber, searchText });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [articleGroups]);
  // Kept for fabric-mode picker (still per-PM)
  const pmComboOptions = useMemo(
    () => productMasterOptions.map((pm) => ({
      label: pmLabel(pm),
      value: pm.id,
      searchText: [pm.articleNumber, pm.styleNumber, pm.productName, pm.fabricName, pm.fabric2Name, pm.fabricVendorName].filter(Boolean).join(" "),
    })),
    [productMasterOptions]
  );
  const foComboOptions = useMemo(
    () => existingFabricOrders.map((fo) => ({
      label: `${fo.fabricName} · ${fo.colour} · ${fo.vendorName} · ${fo.orderedKg.toFixed(0)}kg`,
      value: fo.id,
      searchText: `${fo.fabricName} ${fo.colour} ${fo.vendorName}`,
    })),
    [existingFabricOrders]
  );

  // ── Scroll newly added card into view ───────────────────────────
  useEffect(() => {
    if (!scrollTargetRef.current) return;
    const el = document.getElementById(scrollTargetRef.current);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    scrollTargetRef.current = null;
  }, [selected]);

  // ── Article actions ─────────────────────────────────────────────
  const addArticle = (articleNumber: string) => {
    const pms = articleGroups.get(articleNumber);
    if (!pms || pms.length === 0) return;
    const canonical = pms[0];
    // Prefer the article master's own garmentingAt (resolved to a Vendor.id
    // on the server). Fall back to the form's default garmenter only when
    // the master has no preferred garmenter set.
    const garmenterId = canonical.garmenterId ?? defaultGarmenterId;
    const rowKey = nextKey();
    setSelected((rows) => [...rows, {
      rowKey,
      pm: canonical,
      garmenterId,
      isRepeat: isRepeatArticle(articleNumber, previousSet, phaseNumber),
      combos: buildInitialCombos(pms),
    }]);
    scrollTargetRef.current = `art-${rowKey}`;
    setPickArticle("");
  };
  const updateCombo = (rowKey: string, comboKey: string, qty: number) =>
    setSelected((rows) => rows.map((r) => r.rowKey === rowKey ? { ...r, combos: r.combos.map((c) => c.comboKey === comboKey ? { ...c, qty } : c) } : r));
  const updateGarmenter = (rowKey: string, garmenterId: string) =>
    setSelected((rows) => rows.map((r) => r.rowKey === rowKey ? { ...r, garmenterId } : r));
  const removeArticle = (rowKey: string) => setSelected((rows) => rows.filter((r) => r.rowKey !== rowKey));

  // ── Computed: articleOrders + fabricOrders preview ──────────────
  const planSummary = useMemo(() => {
    type ArticleRow = { rowKey: string; articleNumber: string; productName: string; colour: string; qty: number; sizes: Record<Size, number>; fabricKgs: { slot: number; fabricName: string; kg: number; colour: string }[] };
    type FabricBucket = { fabricVendorId: string; fabricName: string; colour: string; totalKg: number; vendorName: string };
    const articles: ArticleRow[] = [];
    const buckets = new Map<string, FabricBucket>();

    for (const a of selected) {
      const slots = fabricSlots(a.pm);
      for (const c of a.combos) {
        if (c.qty <= 0) continue;
        const sizes: Record<Size, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
        for (const s of SIZES) sizes[s] = Math.round((c.qty * (sizeDistMap[s] ?? 0)) / 100);
        const fabricKgs: ArticleRow["fabricKgs"] = [];
        for (const sl of slots) {
          const colourForSlot = sl.slot === 1 ? c.colour : sl.slot === 2 ? c.colour2 : sl.slot === 3 ? c.colour3 : c.colour4;
          if (!colourForSlot || !sl.gpk || sl.gpk <= 0 || !sl.vendorId) continue;
          const kg = Math.round((c.qty / sl.gpk) * 100) / 100;
          fabricKgs.push({ slot: sl.slot, fabricName: sl.name, colour: colourForSlot, kg });
          const key = `${sl.vendorId}|${sl.name}|${colourForSlot}`;
          const b = buckets.get(key) ?? { fabricVendorId: sl.vendorId, fabricName: sl.name, colour: colourForSlot, totalKg: 0, vendorName: sl.vendorName ?? "—" };
          b.totalKg += kg;
          buckets.set(key, b);
        }
        articles.push({
          rowKey: a.rowKey,
          articleNumber: (a.pm.articleNumber ?? a.pm.styleNumber ?? "").trim() || "—",
          productName: a.pm.productName ?? a.pm.styleNumber,
          colour: colourLabel(c),
          qty: c.qty,
          sizes,
          fabricKgs,
        });
      }
    }
    return { articles, fabricBuckets: [...buckets.values()] };
  }, [selected, sizeDistMap]);

  // ── Submit ──────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!isTestPhase) { toast.error(`Phase ${phaseNumber} is not a test phase`); return; }
    if (planSummary.articles.length === 0) { toast.error("No articles with quantity > 0"); return; }
    startTransition(async () => {
      try {
        const articles = selected
          .filter((a) => a.combos.some((c) => c.qty > 0))
          .map((a) => {
            const slots = fabricSlots(a.pm);
            return {
              articleNumber: (a.pm.articleNumber ?? a.pm.styleNumber ?? "").trim() || "—",
              styleNumber: a.pm.styleNumber,
              productName: a.pm.productName,
              type: a.pm.type || "—",
              gender: (a.pm.gender as "MENS" | "WOMENS" | "KIDS") ?? "MENS",
              isRepeat: a.isRepeat,
              garmenterId: a.garmenterId || null,
              combos: a.combos.filter((c) => c.qty > 0).map((c) => {
                const sizes: Record<Size, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
                for (const s of SIZES) sizes[s] = Math.round((c.qty * (sizeDistMap[s] ?? 0)) / 100);
                const fabrics = slots
                  .map((sl) => {
                    const col = sl.slot === 1 ? c.colour : sl.slot === 2 ? c.colour2 : sl.slot === 3 ? c.colour3 : c.colour4;
                    if (!col || !sl.vendorId || !sl.gpk || sl.gpk <= 0) return null;
                    const kg = Math.round((c.qty / sl.gpk) * 100) / 100;
                    return {
                      slot: sl.slot,
                      fabricName: sl.name,
                      fabricVendorId: sl.vendorId,
                      fabricCostPerKg: sl.cost,
                      garmentsPerKg: sl.gpk,
                      colour: col,
                      derivedKg: kg,
                    };
                  })
                  .filter(Boolean) as NonNullable<ReturnType<typeof slots[number] extends never ? never : (sl: typeof slots[number]) => unknown>>[];
                return {
                  colourLabel: colourLabel(c),
                  skuCode: a.pm.skuCode,
                  qty: c.qty,
                  sizes,
                  fabrics: fabrics as Parameters<typeof createPlannedOrders>[0]["articles"][number]["combos"][number]["fabrics"],
                };
              }),
            };
          });
        const res = await createPlannedOrders({ phaseId, articles });
        toast.success(`Created ${res.productIds.length} article order${res.productIds.length === 1 ? "" : "s"} · ${res.fabricOrderIds.length} fabric order${res.fabricOrderIds.length === 1 ? "" : "s"} · ${res.allocationIds.length} allocation${res.allocationIds.length === 1 ? "" : "s"}`);
        setSelected([]);
        setStep("select");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  // ── Fabric mode handlers (unchanged from prior version) ─────────
  const addFabricArticle = (pmId: string) => {
    const pm = productMasterOptions.find((p) => p.id === pmId);
    if (!pm) return;
    setFabricRows((rows) => [...rows, { rowKey: nextKey(), pmId: pm.id, articleNumber: pm.articleNumber, styleNumber: pm.styleNumber, productName: pm.productName, qty: 50, allocateKg: 25, garmenterId: defaultGarmenterId }]);
    setPickPmIdFab("");
  };
  const updateFabricRow = (rowKey: string, patch: Partial<typeof fabricRows[number]>) =>
    setFabricRows((rows) => rows.map((r) => r.rowKey === rowKey ? { ...r, ...patch } : r));
  const removeFabricRow = (rowKey: string) => setFabricRows((rows) => rows.filter((r) => r.rowKey !== rowKey));
  const totalAllocated = fabricRows.reduce((s, r) => s + r.allocateKg, 0) + reservationKg;
  const handleAllocate = () => {
    if (!isTestPhase) { toast.error(`Phase ${phaseNumber} is not a test phase`); return; }
    if (!selectedFo) { toast.error("Pick a source fabric order"); return; }
    if (fabricRows.length === 0 && reservationKg <= 0) { toast.error("Add at least one article or a reservation"); return; }
    const foVendorId = productMasterOptions.find((p) => p.fabricName === selectedFo.fabricName)?.fabricVendorId;
    if (!foVendorId && fabricRows.length > 0) { toast.error(`No FabricMaster row maps "${selectedFo.fabricName}" to a vendor.`); return; }
    startTransition(async () => {
      try {
        const res = await allocateAgainstFabricOrder({
          phaseId,
          fabricOrderId: selectedFo.id,
          articles: fabricRows.map((r) => ({
            productMasterId: r.pmId,
            styleNumber: r.styleNumber,
            productName: r.productName,
            fabricVendorId: foVendorId!,
            fabricName: selectedFo.fabricName,
            colour: selectedFo.colour,
            qtyPcs: r.qty,
            allocateKg: r.allocateKg,
            garmenterId: r.garmenterId || null,
          })),
          reservation: reservationKg > 0 ? { qtyKg: reservationKg, purpose: reservationPurpose, garmenterId: defaultGarmenterId || null } : undefined,
        });
        toast.success(`Allocated ${res.allocationIds.length} row${res.allocationIds.length === 1 ? "" : "s"} (stage: ${res.stage.toLowerCase().replace(/_/g, " ")})`);
        setFabricRows([]);
        setReservationKg(0);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <Card className="p-4 flex items-center gap-4 flex-wrap">
        <div className="text-[12.5px] font-medium">Mode</div>
        <div className="inline-flex items-center bg-muted border rounded-md p-0.5">
          <button onClick={() => { setMode("quantity"); setStep("select"); }} className={cn("px-3 py-1.5 text-[13px] font-medium rounded-sm", mode === "quantity" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>By target quantity</button>
          <button onClick={() => { setMode("fabric"); setStep("select"); }} className={cn("px-3 py-1.5 text-[13px] font-medium rounded-sm", mode === "fabric" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>By fabric availability</button>
        </div>
        <div className="text-[12px] text-muted-foreground ml-auto">Both modes write <span className="font-mono text-[11.5px]">Product + FabricOrder + Allocation</span>.</div>
      </Card>

      {mode === "quantity" ? (
        step === "select" ? (
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 space-y-4">
              {/* Sticky picker + default garmenter */}
              <Card className="p-4 sticky top-[68px] z-10">
                <div className="grid grid-cols-[1fr_220px] gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label>Add article from master</Label>
                    <Combobox value={pickArticle} onValueChange={(v) => { setPickArticle(v); if (v) addArticle(v); }} options={articleComboOptions} placeholder="Search by article #, name, fabric, vendor…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Default garmenter</Label>
                    <select className="w-full border rounded-md px-3 py-2 text-[14px] bg-background h-9" value={defaultGarmenterId} onChange={(e) => setDefaultGarmenterId(e.target.value)}>
                      <option value="">—</option>
                      {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
              </Card>

              {selected.length === 0 ? (
                <Card className="p-10 text-center text-sm text-muted-foreground">Pick an article from the dropdown above to start planning.</Card>
              ) : (
                selected.map((a) => <ArticleCard key={a.rowKey} a={a} sizeDistMap={sizeDistMap} garmenters={garmenters} onCombo={updateCombo} onGarmenter={updateGarmenter} onRemove={removeArticle} />)
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="text-[12.5px] text-muted-foreground">{planSummary.articles.length > 0 && <>Will create <span className="font-mono">{planSummary.articles.length}</span> article order{planSummary.articles.length === 1 ? "" : "s"} · <span className="font-mono">{planSummary.fabricBuckets.length}</span> fabric order{planSummary.fabricBuckets.length === 1 ? "" : "s"}</>}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelected([])} disabled={selected.length === 0 || pending}>Clear</Button>
                  <Button size="sm" disabled={pending || planSummary.articles.length === 0} onClick={() => setStep("review")}>Review {planSummary.articles.length} article + {planSummary.fabricBuckets.length} fabric →</Button>
                </div>
              </div>
              {!isTestPhase && (
                <div className="rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)]">Phase {phaseNumber} is not a test phase. Toggle on <a href="/proto" className="underline">/proto</a> to enable proto writes.</div>
              )}
            </div>

            {/* Commits panel — what would be written */}
            <CommitsPanel articles={planSummary.articles} buckets={planSummary.fabricBuckets} mode="quantity" />
          </div>
        ) : (
          <ReviewStep articles={planSummary.articles} buckets={planSummary.fabricBuckets} pending={pending} isTestPhase={isTestPhase} phaseNumber={phaseNumber} onBack={() => setStep("select")} onConfirm={handleCreate} />
        )
      ) : (
        // Fabric mode kept simple — flat row + reservation
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-8 p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fabric mode</div>
            <h2 className="text-base font-semibold mt-1">Pick an existing fabric order, allocate kg across articles. No new FabricOrder.</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Source fabric order</Label>
                {existingFabricOrders.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">No fabric orders in this phase. Use Quantity mode first.</div>
                ) : (
                  <Combobox value={foId} onValueChange={setFoId} options={foComboOptions} placeholder="Search by fabric, colour, or vendor…" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Default garmenter</Label>
                <select className="w-full border rounded-md px-3 py-2 text-[14px] bg-background h-9" value={defaultGarmenterId} onChange={(e) => setDefaultGarmenterId(e.target.value)}>
                  <option value="">—</option>
                  {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Add article</Label>
                <Combobox value={pickPmIdFab} onValueChange={(v) => { setPickPmIdFab(v); if (v) addFabricArticle(v); }} options={pmComboOptions} placeholder="Search article master…" />
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium pb-2 border-b">
                <div>Article</div><div>Qty (pcs)</div><div>Garmenter</div><div className="text-right">Allocate (kg)</div><div></div>
              </div>
              {fabricRows.length === 0 ? (
                <div className="py-4 text-[12.5px] text-muted-foreground">Pick an article above.</div>
              ) : fabricRows.map((r) => (
                <div key={r.rowKey} className="grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 items-center py-2.5 border-b last:border-b-0 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium truncate font-mono">{r.articleNumber ?? r.styleNumber ?? "—"}</div>
                    <div className="text-[11.5px] text-muted-foreground truncate">{r.productName ?? r.styleNumber}</div>
                  </div>
                  <div><Input className="h-8 font-mono" inputMode="numeric" value={r.qty} onChange={(e) => updateFabricRow(r.rowKey, { qty: Number(e.target.value) || 0 })} /></div>
                  <div>
                    <select className="w-full border rounded-md px-2 h-8 text-[13px] bg-background" value={r.garmenterId} onChange={(e) => updateFabricRow(r.rowKey, { garmenterId: e.target.value })}>
                      <option value="">—</option>
                      {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div><Input className="h-8 font-mono text-right" inputMode="decimal" value={r.allocateKg} onChange={(e) => updateFabricRow(r.rowKey, { allocateKg: Number(e.target.value) || 0 })} /></div>
                  <button onClick={() => removeFabricRow(r.rowKey)} className="text-muted-foreground hover:text-foreground" aria-label="Remove">×</button>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 items-center text-[13px] italic text-muted-foreground">
                <div>— sampling reservation</div>
                <div></div>
                <div><Input className="h-8" placeholder="purpose" value={reservationPurpose} onChange={(e) => setReservationPurpose(e.target.value)} /></div>
                <div><Input className="h-8 font-mono text-right" inputMode="decimal" value={reservationKg} onChange={(e) => setReservationKg(Number(e.target.value) || 0)} /></div>
                <div></div>
              </div>
              <div className="mt-3 flex justify-between text-[12.5px]">
                <div className="text-muted-foreground">total used: <span className="font-mono">{totalAllocated.toFixed(1)} kg</span></div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => { setFabricRows([]); setReservationKg(0); }} disabled={pending || (fabricRows.length === 0 && reservationKg === 0)}>Clear</Button>
              <Button size="sm" onClick={handleAllocate} disabled={pending || !isTestPhase || !selectedFo || (fabricRows.length === 0 && reservationKg <= 0)}>{pending ? "Allocating…" : "Allocate"}</Button>
            </div>
          </Card>

          <CommitsPanel
            articles={fabricRows.filter((r) => r.allocateKg > 0).map((r, i) => ({ rowKey: r.rowKey, articleNumber: r.articleNumber ?? r.styleNumber ?? "—", productName: r.productName ?? r.styleNumber, colour: selectedFo?.colour ?? "—", qty: r.qty, sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }, fabricKgs: [{ slot: 1, fabricName: selectedFo?.fabricName ?? "—", colour: selectedFo?.colour ?? "—", kg: r.allocateKg }] }))}
            buckets={selectedFo ? [{ fabricVendorId: "", fabricName: selectedFo.fabricName, colour: selectedFo.colour, totalKg: 0, vendorName: selectedFo.vendorName }] : []}
            mode="fabric"
          />
        </div>
      )}
    </div>
  );
}

// ─── Article card (Quantity mode) ──────────────────────────────────

function ArticleCard({ a, sizeDistMap, garmenters, onCombo, onGarmenter, onRemove }: {
  a: SelectedArticle;
  sizeDistMap: Record<string, number>;
  garmenters: Garmenter[];
  onCombo: (rowKey: string, comboKey: string, qty: number) => void;
  onGarmenter: (rowKey: string, garmenterId: string) => void;
  onRemove: (rowKey: string) => void;
}) {
  const slots = fabricSlots(a.pm);
  const articleNumber = (a.pm.articleNumber ?? a.pm.styleNumber ?? "").trim() || "—";

  return (
    <Card id={`art-${a.rowKey}`} className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold font-mono">{articleNumber}</h3>
            <span className="text-muted-foreground">·</span>
            <span className="text-[14px] font-medium">{a.pm.productName ?? a.pm.styleNumber}</span>
            <span className="text-muted-foreground text-[13px]">· {a.pm.gender.toLowerCase()}</span>
            {a.isRepeat && <Badge className="bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border border-[oklch(0.85_0.06_75)] text-[10px]">Repeat</Badge>}
          </div>
          <div className="mt-1.5 space-y-0.5 text-[12.5px] text-muted-foreground">
            {slots.map((sl) => (
              <div key={sl.slot}><span className="font-medium text-foreground">Fabric {sl.slot}:</span> {sl.name}{sl.vendorName ? ` (${sl.vendorName})` : ""}{sl.gpk ? ` · ${sl.gpk}/kg` : <span className="text-[oklch(0.55_0.16_45)]"> · no garmentsPerKg!</span>}{!sl.vendorId ? <span className="text-[oklch(0.55_0.16_45)]"> · no vendor!</span> : null}</div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select className="border rounded-md px-2 h-8 text-[13px] bg-background" value={a.garmenterId} onChange={(e) => onGarmenter(a.rowKey, e.target.value)}>
            <option value="">— garmenter —</option>
            {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button onClick={() => onRemove(a.rowKey)} className="text-muted-foreground hover:text-foreground p-1" aria-label="Remove">×</button>
        </div>
      </div>

      {/* Colour grid */}
      <div className="mt-4 -mx-2 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
              <th className="text-left py-1.5 px-2 min-w-[180px]">Colour</th>
              <th className="text-right py-1.5 px-2 w-[90px]">Target Qty</th>
              {SIZES.map((s) => <th key={s} className="text-right py-1.5 px-2 w-[56px]">{s}</th>)}
              {slots.map((sl) => <th key={sl.slot} className="text-right py-1.5 px-2 w-[80px]">F{sl.slot} (kg)</th>)}
            </tr>
          </thead>
          <tbody>
            {a.combos.map((c) => {
              const sizeQty = (s: Size) => c.qty > 0 ? Math.round((c.qty * (sizeDistMap[s] ?? 0)) / 100) : 0;
              return (
                <tr key={c.comboKey} className="border-t">
                  <td className="py-2 px-2">{colourLabel(c)}</td>
                  <td className="py-2 px-2"><Input className="h-8 font-mono text-right" inputMode="numeric" value={c.qty || ""} placeholder="0" onChange={(e) => onCombo(a.rowKey, c.comboKey, Number(e.target.value) || 0)} /></td>
                  {SIZES.map((s) => <td key={s} className="py-2 px-2 text-right font-mono tabular-nums text-muted-foreground">{c.qty > 0 ? sizeQty(s) : ""}</td>)}
                  {slots.map((sl) => {
                    const col = sl.slot === 1 ? c.colour : sl.slot === 2 ? c.colour2 : sl.slot === 3 ? c.colour3 : c.colour4;
                    const kg = col && sl.gpk && c.qty > 0 ? (c.qty / sl.gpk).toFixed(1) : "—";
                    return <td key={sl.slot} className="py-2 px-2 text-right font-mono tabular-nums">{kg}{kg !== "—" ? <span className="text-muted-foreground"> kg</span> : null}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Review step ───────────────────────────────────────────────────

function ReviewStep({ articles, buckets, pending, isTestPhase, phaseNumber, onBack, onConfirm }: {
  articles: { rowKey: string; articleNumber: string; productName: string; colour: string; qty: number; sizes: Record<Size, number>; fabricKgs: { slot: number; fabricName: string; kg: number; colour: string }[] }[];
  buckets: { fabricVendorId: string; fabricName: string; colour: string; totalKg: number; vendorName: string }[];
  pending: boolean;
  isTestPhase: boolean;
  phaseNumber: number;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Review</div>
          <h2 className="text-lg font-semibold mt-1">{articles.length} article order{articles.length === 1 ? "" : "s"} · {buckets.length} fabric order{buckets.length === 1 ? "" : "s"}</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>← Back to plan</Button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Article orders</div>
          <table className="w-full text-[12.5px]">
            <thead className="text-muted-foreground"><tr><th className="text-left py-1.5 font-medium">Article</th><th className="text-left py-1.5 font-medium">Colour</th><th className="text-right py-1.5 font-medium">Qty</th></tr></thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.rowKey + a.colour} className="border-t">
                  <td className="py-2 font-mono">{a.articleNumber}<div className="text-[11px] text-muted-foreground font-sans truncate">{a.productName}</div></td>
                  <td className="py-2">{a.colour}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{a.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Fabric orders (deduped)</div>
          <table className="w-full text-[12.5px]">
            <thead className="text-muted-foreground"><tr><th className="text-left py-1.5 font-medium">Fabric · Colour</th><th className="text-left py-1.5 font-medium">Vendor</th><th className="text-right py-1.5 font-medium">Total kg</th></tr></thead>
            <tbody>
              {buckets.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{b.fabricName} · <span className="text-muted-foreground">{b.colour}</span></td>
                  <td className="py-2 text-muted-foreground">{b.vendorName}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{b.totalKg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t flex items-center justify-between">
        <div className="text-[12px] text-muted-foreground">Each article order also writes one Allocation per fabric slot (stage = AT_VENDOR). Sizes are derived from SizeDistribution.</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
          <Button size="sm" onClick={onConfirm} disabled={pending || !isTestPhase}>{pending ? "Creating…" : `Create ${articles.length} + ${buckets.length}`}</Button>
        </div>
      </div>
      {!isTestPhase && (
        <div className="mt-3 rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)]">Phase {phaseNumber} is not a test phase.</div>
      )}
    </Card>
  );
}

// ─── Commits panel ─────────────────────────────────────────────────

function CommitsPanel({ articles, buckets, mode }: {
  articles: { rowKey: string; articleNumber: string; productName: string; colour: string; qty: number; fabricKgs: { slot: number; fabricName: string; kg: number; colour: string }[] }[];
  buckets: { fabricVendorId: string; fabricName: string; colour: string; totalKg: number; vendorName: string }[];
  mode: Mode;
}) {
  const allocCount = articles.reduce((s, a) => s + a.fabricKgs.length, 0);
  // Map (fabricName|colour) → 1-based bucket index so allocations can
  // reference FO·N correctly.
  const bucketIndexByKey = new Map<string, number>();
  buckets.forEach((b, i) => bucketIndexByKey.set(`${b.fabricName}|${b.colour}`, i + 1));
  return (
    <div className="col-span-4">
      <div className="rounded-lg border bg-muted/30 sticky top-[68px]">
        <header className="px-4 py-2.5 border-b flex items-center justify-between">
          <span className="font-semibold text-[13px]">What this commits</span>
          <Badge className="bg-[oklch(0.95_0.04_45)] text-[oklch(0.45_0.16_45)] border border-[oklch(0.85_0.06_45)]">new</Badge>
        </header>
        <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-t">
          <span>Product · article orders</span>
          <span className="ml-auto font-mono">{articles.length}</span>
        </div>
        <table className="w-full">
          <tbody>
            {articles.map((a, i) => (
              <tr key={a.rowKey + a.colour + i} className="border-t first:border-t-0">
                <td className="px-4 py-1.5 font-mono text-[11.5px] text-muted-foreground w-[70px] align-top">AO·{i + 1}</td>
                <td className="px-4 py-1.5 text-[12.5px]">{a.articleNumber} · {a.colour} · <span className="font-mono">{a.qty} pcs</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-t">
          <span>FabricOrder</span>
          <span className="ml-auto font-mono">{mode === "fabric" ? "existing" : buckets.length}</span>
        </div>
        <table className="w-full">
          <tbody>
            {buckets.map((b, i) => (
              <tr key={i} className="border-t first:border-t-0">
                <td className="px-4 py-1.5 font-mono text-[11.5px] text-muted-foreground w-[70px] align-top">FO·{i + 1}</td>
                <td className="px-4 py-1.5 text-[12.5px]">{b.fabricName} · {b.colour} · <span className="font-mono">{b.totalKg.toFixed(1)} kg</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-t">
          <span>Allocation · pre-wired</span>
          <span className="ml-auto font-mono">{allocCount}</span>
          <Badge className="bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border border-[oklch(0.85_0.06_75)]">new</Badge>
        </div>
        <table className="w-full">
          <tbody>
            {articles.flatMap((a, ai) => a.fabricKgs.map((fk, fi) => {
              const foIdx = bucketIndexByKey.get(`${fk.fabricName}|${fk.colour}`);
              const aoNum = ai + 1;
              // ALC id encodes the (FO, AO) pair: ALC·m-n where m = FO index,
              // n = AO index. Reads as "fabric order m allocated to article order n".
              const allocId = foIdx ? `ALC·${foIdx}-${aoNum}` : `ALC·?-${aoNum}`;
              const foRef = foIdx ? `FO·${foIdx}` : "FO";
              return (
                <tr key={`${a.rowKey}-${ai}-${fi}`} className="border-t first:border-t-0">
                  <td className="px-4 py-1.5 font-mono text-[11.5px] text-muted-foreground w-[80px] align-top">{allocId}</td>
                  <td className="px-4 py-1.5 text-[12.5px]">
                    <span className="font-mono">AO·{aoNum} → {foRef}  {fk.kg.toFixed(1)} kg</span>
                    <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5">at vendor</Badge>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
        <div className="p-4 text-[11.5px] text-muted-foreground leading-relaxed border-t">All allocations start at 'at vendor'. They become 'in our hands' on receipt, then 'at garmenter' on dispatch.</div>
      </div>
    </div>
  );
}
