"use client";

import { useState } from "react";
import { ChevronRight, Plus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = {
  fabricOrder: {
    id: string;
    fabricName: string;
    colour: string;
    vendorName: string;
    orderedKg: number;
    shippedKg: number;
    garmentingAtName: string | null;
  };
  orderDateIso: string | null;
  receipts: { id: string; date: string; qtyKg: number; lotRef: string }[];
  dispatches: { id: string; date: string; qtyKg: number; garmenterName: string }[];
  allocations: {
    id: string;
    productLabel: string;
    garmenterName: string;
    qtyKg: number;
    consumedKg: number;
    isReservation: boolean;
    reservationPurpose?: string;
  }[];
  custody: {
    orderedKg: number;
    receivedKg: number;
    onOrderKg: number;
    inOurHandsKg: number;
    atGarmenterKg: Record<string, number>;
    surplusKg: number;
    isOverReceived: boolean;
  };
};

export function FabricOrdersProtoGrid({
  rows,
  totals,
  overReceiptId,
}: {
  rows: Row[];
  totals: { onOrder: number; inOurHands: number; atGarmenter: number; surplus: number };
  overReceiptId: string | null;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    return new Set(overReceiptId ? [overReceiptId] : []);
  });

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <Card className="grid grid-cols-4 divide-x divide-border p-0 overflow-hidden">
        <Kpi label="on order (vendor)" value={totals.onOrder} sub={`across ${rows.filter((r) => r.custody.onOrderKg > 0).length} orders`} />
        <Kpi label="in our hands" value={totals.inOurHands} sub="free, not yet dispatched" />
        <Kpi label="at garmenters" value={totals.atGarmenter} sub="across active garmenters" />
        <Kpi
          label="surplus"
          value={totals.surplus}
          sub={overReceiptId ? "demo over-receipt forced on 1 order" : "no over-receipts in this phase"}
          accent={totals.surplus > 0}
        />
      </Card>

      {/* Grid */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 240 }} />
          </colgroup>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Order</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Fabric · Vendor</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Colour</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Ordered</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Received</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">On order</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Free</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Custody</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No fabric orders in this phase.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isOpen = openIds.has(row.fabricOrder.id);
              const isOver = row.custody.isOverReceived;
              return (
                <RowGroup key={row.fabricOrder.id} row={row} isOpen={isOpen} isOver={isOver} onToggle={() => toggle(row.fabricOrder.id)} />
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11.5px] text-muted-foreground">
        Click ▸ on a row to expand. Numbers come from the live DB; receipts, dispatches, allocations and reservations are synthesized from existing fields (see <code className="text-[11px] bg-muted px-1 py-0.5 rounded">src/lib/proto/synthesize.ts</code>).
      </p>
    </div>
  );
}

function RowGroup({ row, isOpen, isOver, onToggle }: { row: Row; isOpen: boolean; isOver: boolean; onToggle: () => void }) {
  const fo = row.fabricOrder;
  const dispatchedTotal = Object.values(row.custody.atGarmenterKg).reduce((a, b) => a + b, 0);

  // Custody bar: in-our-hands (blue) + at-garmenter (green) + on-order (vendor hatched) + surplus (terracotta)
  const total = Math.max(row.custody.orderedKg, row.custody.receivedKg) || 1;
  const segs = [
    { cls: "bg-[oklch(0.55_0.10_250)]", w: row.custody.inOurHandsKg / total },
    { cls: "bg-[oklch(0.55_0.12_140)]", w: dispatchedTotal / total },
    { cls: "bg-[repeating-linear-gradient(45deg,oklch(0.92_0.012_80)_0_3px,oklch(0.86_0.012_80)_3px_6px)]", w: row.custody.onOrderKg / total },
    { cls: "bg-[oklch(0.65_0.16_45)]", w: row.custody.surplusKg / total },
  ];

  return (
    <>
      <tr className={cn("border-b hover:bg-muted/40 cursor-pointer", isOpen && "bg-muted/20")} onClick={onToggle}>
        <td className="px-3 py-3 align-top">
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
        </td>
        <td className="px-3 py-3 align-top">
          <div className="font-mono text-[12.5px] font-medium">{shortFoId(fo.id)}</div>
          <div className="text-[11px] text-muted-foreground">{fmtDate(row.orderDateIso)}</div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="font-medium">{fo.fabricName}</div>
          <div className="text-[12px] text-muted-foreground">{fo.vendorName}</div>
        </td>
        <td className="px-3 py-3 align-top">{fo.colour}</td>
        <td className="px-3 py-3 align-top text-right font-mono tabular-nums">{kg(row.custody.orderedKg)}</td>
        <td className="px-3 py-3 align-top text-right font-mono tabular-nums">
          <span className={cn(isOver && "text-[oklch(0.55_0.16_45)]")}>{kg(row.custody.receivedKg)}</span>
          {isOver && (
            <Badge className="ml-1.5 h-4 px-1.5 text-[9.5px] bg-[oklch(0.95_0.04_45)] text-[oklch(0.45_0.16_45)] border border-[oklch(0.85_0.06_45)]">
              +{kgN(row.custody.surplusKg)}
            </Badge>
          )}
        </td>
        <td className="px-3 py-3 align-top text-right font-mono tabular-nums text-muted-foreground">{row.custody.onOrderKg > 0 ? kg(row.custody.onOrderKg) : "—"}</td>
        <td className="px-3 py-3 align-top text-right font-mono tabular-nums">{row.custody.inOurHandsKg > 0 ? kg(row.custody.inOurHandsKg) : "—"}</td>
        <td className="px-3 py-3 align-top">
          <div className="flex h-1.5 w-full overflow-hidden rounded-sm border border-border">
            {segs.map((s, i) => s.w > 0 && <span key={i} className={s.cls} style={{ width: `${s.w * 100}%` }} />)}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{Math.round((row.custody.receivedKg / (row.custody.orderedKg || 1)) * 100)}% received</span>
            <span>{summariseAt(row.custody.atGarmenterKg, row.custody.surplusKg)}</span>
          </div>
        </td>
      </tr>

      {isOver && isOpen && (
        <tr className="border-b bg-[oklch(0.98_0.025_45)]">
          <td colSpan={9} className="px-6 py-2 border-t border-[oklch(0.85_0.06_45)]">
            <div className="flex items-center gap-3 text-[12.5px] text-[oklch(0.40_0.16_45)]">
              <Badge className="bg-[oklch(0.95_0.04_45)] text-[oklch(0.45_0.16_45)] border border-[oklch(0.85_0.06_45)]">surplus</Badge>
              <span>
                <span className="font-mono font-medium">+{kgN(row.custody.surplusKg)} kg</span> over order on {shortFoId(fo.id)} — keep, allocate, or reserve.
              </span>
              <div className="ml-auto flex gap-2">
                <Button size="xs" variant="outline">Allocate surplus</Button>
                <Button size="xs" variant="outline">Reserve for next phase</Button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {isOpen && (
        <tr className="border-b bg-muted/20">
          <td></td>
          <td colSpan={8} className="px-3 py-5">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Receipts timeline</div>
                {row.receipts.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground">No receipts yet. Awaiting first shipment from vendor.</div>
                ) : (
                  <ul className="relative pl-5 space-y-1.5">
                    <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-border" />
                    {row.receipts.map((r) => (
                      <li key={r.id} className="relative flex items-baseline gap-3 text-[13px]">
                        <span className="absolute -left-[15px] top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />
                        <span className="font-mono text-muted-foreground w-16">{fmtDate(r.date)}</span>
                        <span className="flex-1">{r.id} <span className="text-muted-foreground">· lot {r.lotRef}</span></span>
                        <span className="font-mono tabular-nums">+{kg(r.qtyKg)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 mt-3">
                  <Button size="xs" variant="outline"><Plus className="h-3 w-3" /> Log receipt</Button>
                  <Button size="xs" variant="outline"><ArrowRight className="h-3 w-3" /> Dispatch</Button>
                </div>
              </div>

              <div className="col-span-7">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Where the fabric is</div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
                  {row.custody.onOrderKg > 0 && <CustodyRow label="at vendor" tone="vendor" qty={row.custody.onOrderKg} />}
                  {row.custody.inOurHandsKg > 0 && <CustodyRow label="in our hands" tone="custody" qty={row.custody.inOurHandsKg} />}
                  {Object.entries(row.custody.atGarmenterKg).map(([name, qty]) => (
                    <CustodyRow key={name} label={`at ${name}`} tone="garm" qty={qty} />
                  ))}
                </div>

                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mt-4 mb-2">Allocations</div>
                {row.allocations.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground">No allocations yet.</div>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <tbody>
                      {row.allocations.map((a) => (
                        <tr key={a.id} className="border-t border-border">
                          <td className="py-1.5">
                            {a.isReservation ? <span className="text-muted-foreground">— {a.reservationPurpose} reservation</span> : a.productLabel}
                          </td>
                          <td className="text-muted-foreground">{a.garmenterName}</td>
                          <td className="text-right font-mono tabular-nums">{kg(a.qtyKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CustodyRow({ label, tone, qty }: { label: string; tone: "vendor" | "custody" | "garm"; qty: number }) {
  const cls =
    tone === "vendor"
      ? "bg-[oklch(0.96_0.012_80)] text-[oklch(0.40_0.04_80)] border-[oklch(0.88_0.02_80)]"
      : tone === "custody"
        ? "bg-[oklch(0.95_0.02_250)] text-[oklch(0.40_0.10_250)] border-[oklch(0.85_0.05_250)]"
        : "bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border-[oklch(0.85_0.06_140)]";
  return (
    <div className="flex items-center gap-2">
      <Badge className={cn("border", cls)}>{label}</Badge>
      <span className="ml-auto font-mono tabular-nums">{kg(qty)}</span>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-[22px] font-semibold mt-1 font-mono tabular-nums", accent && value > 0 && "text-[oklch(0.55_0.16_45)]")}>
        {accent && value > 0 ? "+" : ""}
        {kgN(value)} <span className="text-[13px] text-muted-foreground">kg</span>
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function kg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
function kgN(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function shortFoId(id: string): string {
  return "FO-" + id.slice(-4).toUpperCase();
}
function summariseAt(map: Record<string, number>, surplus: number): string {
  const parts = Object.entries(map).map(([name, qty]) => `${shortName(name)} ${kgN(qty)}kg`);
  if (surplus > 0) parts.push(`surplus ${kgN(surplus)}kg`);
  return parts.length ? parts.slice(0, 2).join(" · ") : "—";
}
function shortName(name: string): string {
  return name.length > 12 ? name.slice(0, 10) + "…" : name;
}
