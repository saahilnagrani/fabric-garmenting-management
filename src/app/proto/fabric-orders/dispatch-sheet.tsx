"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { logGarmenterDispatch } from "@/actions/proto-custody";

type Garmenter = { id: string; name: string };

type Allocation = {
  id: string;
  productLabel: string;
  garmenterName: string;
  qtyKg: number;
  isReservation: boolean;
  reservationPurpose?: string;
  dispatchedKg?: number;
  stage?: "AT_VENDOR" | "PARTIALLY_AT_GARMENTER" | "AT_GARMENTER";
};

type Row = {
  fabricOrder: { id: string; fabricName: string; colour: string; vendorName: string; orderedKg: number; garmentingAtName: string | null };
  displayNumber: string;
  allocations: Allocation[];
  custody: { receivedKg: number; onOrderKg: number; inOurHandsKg: number; atGarmenterKg: Record<string, number>; surplusKg: number };
};

export function DispatchSheet({ row, open, onOpenChange, garmenters }: { row: Row | null; open: boolean; onOpenChange: (v: boolean) => void; garmenters: Garmenter[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [garmenterId, setGarmenterId] = useState("");
  const [vehicleRef, setVehicleRef] = useState("");
  const [notes, setNotes] = useState("");
  // allocId → kg string in inputs
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  // Allocations eligible to receive this dispatch: not yet fully dispatched.
  const eligibleAllocs = useMemo<Allocation[]>(() => {
    if (!row) return [];
    return row.allocations.filter((a) => {
      const sent = a.dispatchedKg ?? 0;
      return sent < a.qtyKg - 1e-6;
    });
  }, [row]);

  // FIFO pre-fill: greedy consume of dispatch qty across eligible allocations.
  const prefillFifo = (dispatchQty: number) => {
    let remaining = dispatchQty;
    const next: Record<string, string> = {};
    for (const a of eligibleAllocs) {
      const unfulfilled = a.qtyKg - (a.dispatchedKg ?? 0);
      const take = Math.min(remaining, unfulfilled);
      next[a.id] = take > 0 ? round1(take).toString() : "0";
      remaining -= Math.max(0, take);
    }
    setAssigned(next);
  };

  useEffect(() => {
    if (open && row) {
      const initialQty = Number(Math.min(row.custody.inOurHandsKg, 100).toFixed(1));
      setQty(String(initialQty));
      setDate(new Date().toISOString().slice(0, 10));
      const matched = row.fabricOrder.garmentingAtName
        ? garmenters.find((g) => g.name === row.fabricOrder.garmentingAtName)
        : null;
      setGarmenterId(matched?.id ?? garmenters[0]?.id ?? "");
      setVehicleRef("");
      setNotes("");
      // pre-fill FIFO
      let remaining = initialQty;
      const next: Record<string, string> = {};
      for (const a of eligibleAllocs) {
        const unfulfilled = a.qtyKg - (a.dispatchedKg ?? 0);
        const take = Math.min(remaining, unfulfilled);
        next[a.id] = take > 0 ? round1(take).toString() : "0";
        remaining -= Math.max(0, take);
      }
      setAssigned(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row?.fabricOrder.id]);

  if (!row) return null;
  const fo = row.fabricOrder;
  const newQty = Number(qty) || 0;
  const inHands = row.custody.inOurHandsKg;

  // Use raw values for math + comparisons; only round for display so we
  // don't fail comparisons because of round-then-compare drift.
  const totalAssignedRaw = eligibleAllocs.reduce((s, a) => s + (Number(assigned[a.id] || 0) || 0), 0);
  const totalAssigned = round1(totalAssignedRaw);
  const looseKg = round1(Math.max(0, newQty - totalAssignedRaw));
  const overAssigned = totalAssignedRaw > newQty + 1e-6;
  const overInHands = newQty > inHands + 1e-6;

  const previewInHands = Math.max(0, inHands - newQty);
  const previewAtGarm = newQty;

  const handleSave = () => {
    if (!garmenterId) {
      toast.error("Pick a garmenter");
      return;
    }
    if (!newQty || newQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (overInHands) {
      toast.error(`Only ${inHands.toFixed(1)} kg in our hands; can't dispatch ${newQty.toFixed(1)} kg.`);
      return;
    }
    if (overAssigned) {
      toast.error(`Assignments (${totalAssigned} kg) exceed dispatch qty (${newQty} kg).`);
      return;
    }
    const assignments = eligibleAllocs
      .map((a) => ({ allocationId: a.id, qtyKg: Number(assigned[a.id] || 0) }))
      .filter((a) => a.qtyKg > 0);
    startTransition(async () => {
      try {
        await logGarmenterDispatch({
          fabricOrderId: fo.id,
          garmenterId,
          qtyKg: newQty,
          dispatchedAt: date,
          vehicleRef: vehicleRef || undefined,
          notes: notes || undefined,
          assignments,
        });
        toast.success(`Dispatched ${newQty.toFixed(1)} kg · ${totalAssigned.toFixed(1)} assigned · ${looseKg.toFixed(1)} loose`);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to dispatch";
        toast.error(msg);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[760px] sm:max-w-[760px] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Fabric orders / {row.displayNumber} · {fo.fabricName} · {fo.colour}
          </div>
          <SheetTitle>Dispatch fabric to a garmenter</SheetTitle>
          <SheetDescription>
            Records a <span className="font-mono text-[12px]">GarmenterDispatch</span> and splits the qty across article orders. Anything left unassigned is <span className="font-mono">loose stock at garmenter</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <Card className="p-5">
            <div className="font-semibold text-[15px] mb-4">1. Dispatch details</div>

            {inHands === 0 && (
              <div className="rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)] mb-4">
                Nothing in our hands for this order. Log a receipt first.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label>From order</Label>
                <Input value={`${row.displayNumber}  ·  ${fo.fabricName}  ·  ${fo.colour}`} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Dispatch date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>To garmenter</Label>
                <select className="w-full border rounded-md px-3 py-2 text-[14px] bg-background h-9" value={garmenterId} onChange={(e) => setGarmenterId(e.target.value)}>
                  <option value="">Pick garmenter…</option>
                  {garmenters.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (kg) <span className="text-muted-foreground font-normal">· max {inHands.toFixed(1)} in hand</span></Label>
                <div className="flex gap-2">
                  <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className={overInHands ? "border-[oklch(0.65_0.16_45)]" : undefined} />
                  <Button type="button" variant="outline" size="sm" onClick={() => prefillFifo(Number(qty) || 0)}>FIFO refill</Button>
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Vehicle / docket no <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} placeholder="e.g. MH-04-AB-2231 / docket #4421" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="anything to record about this dispatch" />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">After dispatch</div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="text-[11.5px] text-muted-foreground mb-1">Before</div>
                  <div className="font-mono text-[12.5px]">{inHands.toFixed(1)} kg in our hands</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-muted-foreground mb-1">After</div>
                  <div className="font-mono text-[12.5px]">{previewInHands.toFixed(1)} kg in our hands · +{previewAtGarm.toFixed(1)} kg at garmenter</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-[15px]">2. Assign to article orders</div>
              <span className="text-[11.5px] text-muted-foreground">FIFO pre-fill · edit any row to override</span>
            </div>
            {eligibleAllocs.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No open allocations on this fabric order. The full dispatch will land as <span className="font-mono">loose stock</span>.
              </p>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Article order</th>
                    <th className="text-left py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Planned garmenter</th>
                    <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Planned</th>
                    <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Already</th>
                    <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Send now</th>
                    <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">After</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleAllocs.map((a) => {
                    const already = a.dispatchedKg ?? 0;
                    const unfulfilled = round1(a.qtyKg - already);
                    const v = Number(assigned[a.id] || 0) || 0;
                    const after = round1(already + v);
                    const overrun = v > unfulfilled + 1e-6;
                    return (
                      <tr key={a.id} className="border-t">
                        <td className="py-2">
                          {a.isReservation ? <span className="text-muted-foreground">— {a.reservationPurpose} reservation</span> : a.productLabel}
                        </td>
                        <td className="py-2 text-muted-foreground">{a.garmenterName}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{a.qtyKg.toFixed(1)}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{already.toFixed(1)}</td>
                        <td className="py-2 text-right">
                          <Input
                            className={cn("h-8 text-right font-mono tabular-nums w-[88px] inline-flex", overrun && "border-[oklch(0.65_0.16_45)]")}
                            value={assigned[a.id] ?? ""}
                            onChange={(e) => setAssigned((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            inputMode="decimal"
                          />
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {after.toFixed(1)} <span className="text-muted-foreground">/ {a.qtyKg.toFixed(1)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={4} className="py-2 text-right text-muted-foreground text-[11.5px] uppercase tracking-wider">Assigned</td>
                    <td className="py-2 text-right font-mono tabular-nums font-semibold">{totalAssigned.toFixed(1)}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">/ {newQty.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="py-1 text-right text-muted-foreground text-[11.5px] uppercase tracking-wider">Loose stock at garmenter</td>
                    <td className="py-1 text-right font-mono tabular-nums">
                      <Badge className={cn("font-mono", looseKg > 0 ? "bg-[oklch(0.97_0.025_75)] text-[oklch(0.45_0.10_75)] border-[oklch(0.85_0.06_75)]" : "bg-muted text-muted-foreground")}>
                        {looseKg.toFixed(1)} kg
                      </Badge>
                    </td>
                    <td></td>
                  </tr>
                  {overAssigned && (
                    <tr>
                      <td colSpan={6} className="pt-2 text-[12px] text-[oklch(0.55_0.16_45)]">
                        Total assigned exceeds dispatch qty. Reduce one of the rows or increase the dispatch qty.
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            )}
          </Card>
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={pending || overAssigned || overInHands || newQty <= 0 || !garmenterId || inHands === 0}>
            {pending ? "Saving…" : `Save · ${totalAssigned.toFixed(1)} assigned + ${looseKg.toFixed(1)} loose`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
