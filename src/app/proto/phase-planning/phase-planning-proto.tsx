"use client";

import { useState, useTransition, useMemo } from "react";
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

type PMOption = {
  id: string;
  articleNumber: string | null;
  styleNumber: string;
  productName: string | null;
  fabricName: string | null;
  fabricVendorId: string | null;
  fabricVendorName: string | null;
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

type PlanRow = {
  rowKey: string;
  pmId: string;
  articleNumber: string | null;
  styleNumber: string;
  productName: string | null;
  fabricName: string;
  fabricVendorId: string | null;
  colour: string;
  qty: number;
  demandKg: number;
  garmenterId: string;
};

type FabricRow = {
  rowKey: string;
  pmId: string;
  articleNumber: string | null;
  styleNumber: string;
  productName: string | null;
  qty: number;
  allocateKg: number;
  garmenterId: string;
};

let _seq = 0;
const nextKey = () => `r${++_seq}`;

function pmLabel(pm: PMOption): string {
  // Format: articleNumber · productName · fabricName
  // Each part is omitted if empty/dash; we join the rest gracefully.
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

export function PhasePlanningProto({
  phaseId,
  phaseNumber,
  isTestPhase,
  productMasterOptions,
  garmenters,
  existingFabricOrders,
}: {
  phaseId: string;
  phaseNumber: number;
  isTestPhase: boolean;
  productMasterOptions: PMOption[];
  garmenters: Garmenter[];
  existingFabricOrders: ExistingFo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("quantity");

  // Quantity-mode state
  const [defaultGarmenterId, setDefaultGarmenterId] = useState(garmenters[0]?.id ?? "");
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [pickPmId, setPickPmId] = useState("");

  // Fabric-mode state
  const [foId, setFoId] = useState("");
  const [fabricRows, setFabricRows] = useState<FabricRow[]>([]);
  const [pickPmIdFab, setPickPmIdFab] = useState("");
  const [reservationKg, setReservationKg] = useState(0);
  const [reservationPurpose, setReservationPurpose] = useState("sampling");

  const selectedFo = useMemo(() => existingFabricOrders.find((f) => f.id === foId) ?? null, [foId, existingFabricOrders]);

  // ── PM combobox options ─────────────────────────────────────────
  const pmComboOptions = useMemo(() => {
    return productMasterOptions.map((pm) => ({
      label: pmLabel(pm),
      value: pm.id,
      searchText: [pm.articleNumber, pm.styleNumber, pm.productName, pm.fabricName, pm.fabricVendorName].filter(Boolean).join(" "),
    }));
  }, [productMasterOptions]);

  const foComboOptions = useMemo(() => {
    return existingFabricOrders.map((fo) => ({
      label: `${fo.fabricName} · ${fo.colour} · ${fo.vendorName} · ${fo.orderedKg.toFixed(0)}kg`,
      value: fo.id,
      searchText: `${fo.fabricName} ${fo.colour} ${fo.vendorName}`,
    }));
  }, [existingFabricOrders]);

  // ── Quantity-mode actions ───────────────────────────────────────
  const addArticle = (pmId: string) => {
    const pm = productMasterOptions.find((p) => p.id === pmId);
    if (!pm) return;
    setPlanRows((rows) => [
      ...rows,
      {
        rowKey: nextKey(),
        pmId: pm.id,
        articleNumber: pm.articleNumber,
        styleNumber: pm.styleNumber,
        productName: pm.productName,
        fabricName: pm.fabricName ?? "—",
        fabricVendorId: pm.fabricVendorId,
        colour: "",
        qty: 100,
        demandKg: 50,
        garmenterId: defaultGarmenterId,
      },
    ]);
    setPickPmId("");
  };

  const updateRow = (rowKey: string, patch: Partial<PlanRow>) =>
    setPlanRows((rows) => rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  const removeRow = (rowKey: string) => setPlanRows((rows) => rows.filter((r) => r.rowKey !== rowKey));

  const handleCreate = () => {
    if (!isTestPhase) { toast.error(`Phase ${phaseNumber} is not a test phase`); return; }
    if (planRows.length === 0) { toast.error("Add at least one article"); return; }
    const missingVendor = planRows.find((r) => !r.fabricVendorId);
    if (missingVendor) { toast.error(`No fabric vendor mapped for "${missingVendor.fabricName}". Add it via Fabrics Master DB first.`); return; }
    const missingColour = planRows.find((r) => !r.colour.trim());
    if (missingColour) { toast.error(`Pick a colour for ${missingColour.styleNumber || missingColour.productName}`); return; }
    startTransition(async () => {
      try {
        const res = await createPlannedOrders({
          phaseId,
          articles: planRows.map((r) => ({
            productMasterId: r.pmId,
            styleNumber: r.styleNumber,
            productName: r.productName,
            fabricVendorId: r.fabricVendorId!,
            fabricName: r.fabricName,
            colour: r.colour,
            qtyPcs: r.qty,
            demandKg: r.demandKg,
            garmenterId: r.garmenterId || null,
          })),
        });
        toast.success(`Created ${res.productIds.length} article order${res.productIds.length === 1 ? "" : "s"}, ${res.fabricOrderIds.length} fabric order${res.fabricOrderIds.length === 1 ? "" : "s"}, ${res.allocationIds.length} allocation${res.allocationIds.length === 1 ? "" : "s"}`);
        setPlanRows([]);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  // ── Fabric-mode actions ─────────────────────────────────────────
  const addFabricArticle = (pmId: string) => {
    const pm = productMasterOptions.find((p) => p.id === pmId);
    if (!pm) return;
    setFabricRows((rows) => [
      ...rows,
      {
        rowKey: nextKey(),
        pmId: pm.id,
        articleNumber: pm.articleNumber,
        styleNumber: pm.styleNumber,
        productName: pm.productName,
        qty: 50,
        allocateKg: 25,
        garmenterId: defaultGarmenterId,
      },
    ]);
    setPickPmIdFab("");
  };
  const updateFabricRow = (rowKey: string, patch: Partial<FabricRow>) =>
    setFabricRows((rows) => rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)));
  const removeFabricRow = (rowKey: string) => setFabricRows((rows) => rows.filter((r) => r.rowKey !== rowKey));

  const totalAllocated = fabricRows.reduce((s, r) => s + r.allocateKg, 0) + reservationKg;
  const fabricPool = selectedFo?.orderedKg ?? 0;

  const handleAllocate = () => {
    if (!isTestPhase) { toast.error(`Phase ${phaseNumber} is not a test phase`); return; }
    if (!selectedFo) { toast.error("Pick a source fabric order"); return; }
    if (fabricRows.length === 0 && reservationKg <= 0) { toast.error("Add at least one article or a reservation"); return; }
    const pm0 = productMasterOptions.find((p) => fabricRows[0] && p.id === fabricRows[0].pmId);
    // Use the FO's own vendor as fabricVendorId for products created here
    // (the proto creates a Product per row; vendor comes from the FO).
    const foVendorId = productMasterOptions.find((p) => p.fabricName === selectedFo.fabricName)?.fabricVendorId;
    if (!foVendorId && fabricRows.length > 0) {
      toast.error(`No FabricMaster row maps "${selectedFo.fabricName}" to a vendor. Add it first.`);
      return;
    }
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
          <button onClick={() => setMode("quantity")} className={cn("px-3 py-1.5 text-[13px] font-medium rounded-sm", mode === "quantity" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>Quantity (demand-first)</button>
          <button onClick={() => setMode("fabric")} className={cn("px-3 py-1.5 text-[13px] font-medium rounded-sm", mode === "fabric" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>Fabric (allocate-fabric-to-articles)</button>
        </div>
        <div className="text-[12px] text-muted-foreground ml-auto">Both modes write to the new <span className="font-mono text-[11.5px]">Allocation</span> table.</div>
      </Card>

      {mode === "quantity" ? (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-7 p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quantity mode</div>
            <h2 className="text-base font-semibold mt-1">Pick articles, set quantities. Fabric demand is derived. New FabricOrders are created per (fabric, colour).</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="space-y-1.5"><Label>Phase</Label><Input value={`Phase ${phaseNumber}`} disabled /></div>
              <div className="space-y-1.5">
                <Label>Default garmenter</Label>
                <select className="w-full border rounded-md px-3 py-2 text-[14px] bg-background h-9" value={defaultGarmenterId} onChange={(e) => setDefaultGarmenterId(e.target.value)}>
                  <option value="">—</option>
                  {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Add article from master</Label>
                <Combobox value={pickPmId} onValueChange={(v) => { setPickPmId(v); if (v) addArticle(v); }} options={pmComboOptions} placeholder="Search article master… (style, name, fabric)" />
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Selected articles</div>
              <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr_1.2fr_0.7fr_24px] gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium pb-2 border-b">
                <div>Article · Fabric</div><div>Colour</div><div>Qty (pcs)</div><div>Garmenter</div><div className="text-right">Demand (kg)</div><div></div>
              </div>
              {planRows.length === 0 ? (
                <div className="py-4 text-[12.5px] text-muted-foreground">Pick an article from the dropdown above to start.</div>
              ) : (
                planRows.map((r) => (
                  <div key={r.rowKey} className="grid grid-cols-[1.4fr_0.7fr_0.6fr_1.2fr_0.7fr_24px] gap-2 items-center py-2.5 border-b last:border-b-0 text-[13px]">
                    <div className="min-w-0">
                      <div className="font-medium leading-tight truncate font-mono">{r.articleNumber ?? r.styleNumber ?? "—"}</div>
                      <div className="text-[11.5px] text-muted-foreground truncate">{r.productName ?? r.styleNumber} · {r.fabricName}{!r.fabricVendorId && <span className="text-[oklch(0.55_0.16_45)]"> · no vendor!</span>}</div>
                    </div>
                    <div><Input className="h-8" placeholder="Lime" value={r.colour} onChange={(e) => updateRow(r.rowKey, { colour: e.target.value })} /></div>
                    <div><Input className="h-8 font-mono" inputMode="numeric" value={r.qty} onChange={(e) => updateRow(r.rowKey, { qty: Number(e.target.value) || 0 })} /></div>
                    <div>
                      <select className="w-full border rounded-md px-2 h-8 text-[13px] bg-background" value={r.garmenterId} onChange={(e) => updateRow(r.rowKey, { garmenterId: e.target.value })}>
                        <option value="">—</option>
                        {garmenters.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div><Input className="h-8 font-mono text-right" inputMode="decimal" value={r.demandKg} onChange={(e) => updateRow(r.rowKey, { demandKg: Number(e.target.value) || 0 })} /></div>
                    <button onClick={() => removeRow(r.rowKey)} className="text-muted-foreground hover:text-foreground text-center" aria-label="Remove">×</button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2 pt-4 border-t">
              <div className="text-[12px] text-muted-foreground">{planRows.length > 0 && <>Total demand: <span className="font-mono tabular-nums">{planRows.reduce((s, r) => s + r.demandKg, 0).toFixed(1)} kg</span></>}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPlanRows([])} disabled={pending || planRows.length === 0}>Clear</Button>
                <Button size="sm" onClick={handleCreate} disabled={pending || planRows.length === 0 || !isTestPhase}>{pending ? "Creating…" : "Create orders"}</Button>
              </div>
            </div>
            {!isTestPhase && (
              <div className="mt-3 rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)]">
                Phase {phaseNumber} is not flagged as a test phase. Toggle isTestPhase on <a href="/proto" className="underline">/proto</a> to enable proto writes.
              </div>
            )}
          </Card>

          <CommitsPanel
            mode="quantity"
            productRows={planRows.map((r, i) => ({ tempId: `AO-?·${i + 1}`, label: `${r.productName ?? r.styleNumber} · ${r.colour || "(no colour)"} · ${r.qty} pcs · ${garmenters.find((g) => g.id === r.garmenterId)?.name ?? "—"}` }))}
            fabricOrderRows={Array.from(planRows.reduce((m, r) => { const k = `${r.fabricVendorId}|${r.fabricName}|${r.colour}`; m.set(k, (m.get(k) ?? 0) + r.demandKg); return m; }, new Map<string, number>())).map(([k, kg], i) => { const [, fabricName, colour] = k.split("|"); return { tempId: `FO-?·${i + 1}`, label: `${fabricName} · ${colour || "(no colour)"} · ${kg.toFixed(1)} kg` }; })}
            allocationRows={planRows.map((r, i) => ({ tempId: `ALC-?·${i + 1}`, label: `AO·${i + 1} → FO  ${r.demandKg.toFixed(1)} kg`, stage: "at vendor" as const }))}
            footnote={planRows.length === 0 ? "Pick an article above to see what would be written." : "All allocations start at 'at vendor' stage. They become 'in our hands' when receipts are logged, then 'at garmenter' after dispatch."}
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-7 p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fabric mode</div>
            <h2 className="text-base font-semibold mt-1">Pick an existing fabric order, allocate its kg across articles. No new FabricOrder is created.</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Source fabric order</Label>
                {existingFabricOrders.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">No fabric orders in this phase yet. Use Quantity mode first to create some, or use the existing /fabric-orders page.</div>
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
                <Label>Add article from master</Label>
                <Combobox value={pickPmIdFab} onValueChange={(v) => { setPickPmIdFab(v); if (v) addFabricArticle(v); }} options={pmComboOptions} placeholder="Search article master…" />
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Articles using this fabric</div>
                <div className="text-[11px] text-muted-foreground font-mono">{selectedFo ? `pool: ${fabricPool.toFixed(1)} kg ordered` : "no fabric picked"}</div>
              </div>
              <div className="grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium pb-2 border-b">
                <div>Article</div><div>Qty (pcs)</div><div>Garmenter</div><div className="text-right">Allocate (kg)</div><div></div>
              </div>
              {fabricRows.length === 0 ? (
                <div className="py-4 text-[12.5px] text-muted-foreground">Pick an article above to allocate against {selectedFo ? `${selectedFo.fabricName} · ${selectedFo.colour}` : "the chosen fabric"}.</div>
              ) : (
                fabricRows.map((r) => (
                  <div key={r.rowKey} className="grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 items-center py-2.5 border-b last:border-b-0 text-[13px]">
                    <div className="min-w-0">
                      <div className="font-medium leading-tight truncate font-mono">{r.articleNumber ?? r.styleNumber ?? "—"}</div>
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
                    <button onClick={() => removeFabricRow(r.rowKey)} className="text-muted-foreground hover:text-foreground text-center" aria-label="Remove">×</button>
                  </div>
                ))
              )}

              <div className="mt-4 grid grid-cols-[1.4fr_0.6fr_1.2fr_0.7fr_24px] gap-2 items-center text-[13px] italic text-muted-foreground">
                <div>— sampling reservation</div>
                <div></div>
                <div>
                  <Input className="h-8" placeholder="purpose" value={reservationPurpose} onChange={(e) => setReservationPurpose(e.target.value)} />
                </div>
                <div><Input className="h-8 font-mono text-right" inputMode="decimal" value={reservationKg} onChange={(e) => setReservationKg(Number(e.target.value) || 0)} /></div>
                <div></div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[12.5px]">
                <div className="text-muted-foreground">total used: <span className="font-mono">{totalAllocated.toFixed(1)} / {fabricPool.toFixed(1)} kg</span></div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => { setFabricRows([]); setReservationKg(0); }} disabled={pending || (fabricRows.length === 0 && reservationKg === 0)}>Clear</Button>
              <Button size="sm" onClick={handleAllocate} disabled={pending || !isTestPhase || !selectedFo || (fabricRows.length === 0 && reservationKg <= 0)}>{pending ? "Allocating…" : "Allocate"}</Button>
            </div>
            {!isTestPhase && (
              <div className="mt-3 rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)]">
                Phase {phaseNumber} is not a test phase. Toggle on <a href="/proto" className="underline">/proto</a> to enable.
              </div>
            )}
          </Card>

          <CommitsPanel
            mode="fabric"
            productRows={fabricRows.map((r, i) => ({ tempId: `AO-?·${i + 1}`, label: `${r.productName ?? r.styleNumber} · ${selectedFo?.colour ?? "—"} · ${r.qty} pcs · ${garmenters.find((g) => g.id === r.garmenterId)?.name ?? "—"}` }))}
            fabricOrderRows={selectedFo ? [{ tempId: selectedFo.id.slice(-6), label: `${selectedFo.fabricName} · ${selectedFo.colour} · existing pool · ${selectedFo.vendorName}`, note: "no new FO created — pool reused" }] : []}
            allocationRows={[
              ...fabricRows.map((r, i) => ({ tempId: `ALC-?·${i + 1}`, label: `AO·${i + 1} → existing FO  ${r.allocateKg.toFixed(1)} kg`, stage: "in our hands" as const })),
              ...(reservationKg > 0 ? [{ tempId: "RSV-?", label: `Reservation · ${reservationPurpose}  ${reservationKg.toFixed(1)} kg`, stage: "in our hands" as const, isReservation: true }] : []),
            ]}
            footnote={!selectedFo ? "Pick a source fabric order to see what would be written." : "Allocations stage = 'in our hands' if the FO has any receipts, else 'at vendor'. They move to 'at garmenter' when dispatched."}
          />
        </div>
      )}
    </div>
  );
}

function CommitsPanel({
  mode,
  productRows,
  fabricOrderRows,
  allocationRows,
  footnote,
}: {
  mode: Mode;
  productRows: { tempId: string; label: string }[];
  fabricOrderRows: { tempId: string; label: string; note?: string }[];
  allocationRows: { tempId: string; label: string; stage: "expected" | "at vendor" | "in our hands" | "at garmenter"; isReservation?: boolean }[];
  footnote: string;
}) {
  return (
    <div className="col-span-5">
      <div className="rounded-lg border bg-muted/30 sticky top-[68px]">
        <header className="px-4 py-2.5 border-b flex items-center justify-between">
          <span className="font-semibold text-[13px]">What this commits</span>
          <Badge className="bg-[oklch(0.95_0.04_45)] text-[oklch(0.45_0.16_45)] border border-[oklch(0.85_0.06_45)]">new</Badge>
        </header>
        <div className="p-4 text-[12.5px] text-muted-foreground">Clicking <em>{mode === "quantity" ? "Create orders" : "Allocate"}</em> writes the following rows in one transaction:</div>
        <Section title="Product · article orders" count={productRows.length}>{productRows.map((r) => <Row key={r.tempId} id={r.tempId} content={r.label} />)}</Section>
        <Section title="FabricOrder" count={fabricOrderRows.length} muted={mode === "fabric"}>{fabricOrderRows.map((r) => <Row key={r.tempId} id={r.tempId} content={<>{r.label}{r.note && <span className="text-muted-foreground"> ({r.note})</span>}</>} />)}</Section>
        <Section title="Allocation · pre-wired" count={allocationRows.length} accent>{allocationRows.map((r) => <Row key={r.tempId} id={r.tempId} content={<><span className="font-mono">{r.label}</span><Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5">{r.stage}</Badge>{r.isReservation && <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1.5">reservation</Badge>}</>} />)}</Section>
        <div className="p-4 text-[11.5px] text-muted-foreground leading-relaxed border-t">{footnote}</div>
      </div>
    </div>
  );
}

function Section({ title, count, accent, muted, children }: { title: string; count: number; accent?: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        <span className="ml-auto font-mono">{muted ? "existing" : count}</span>
        {accent && <Badge className="bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border border-[oklch(0.85_0.06_75)]">new</Badge>}
      </div>
      <table className="w-full"><tbody>{children}</tbody></table>
    </div>
  );
}

function Row({ id, content }: { id: string; content: React.ReactNode }) {
  return (
    <tr className="border-t first:border-t-0">
      <td className="px-4 py-1.5 font-mono text-[11.5px] text-muted-foreground w-[100px] align-top">{id}</td>
      <td className="px-4 py-1.5 text-[12.5px]">{content}</td>
    </tr>
  );
}
