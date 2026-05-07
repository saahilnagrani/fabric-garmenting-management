import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { Card } from "@/components/ui/card";
import { protoNumberFmt, assignFoDisplayNumbers } from "@/lib/proto/synthesize";

export const dynamic = "force-dynamic";

/**
 * Proto: phase-wide list of GarmenterDispatches. Audit trail across every
 * fabric order in the phase.
 */
export default async function ProtoDispatchesPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Dispatches</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  const [orders, dispatches] = await Promise.all([
    db.fabricOrder.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
      select: { id: true },
    }),
    db.garmenterDispatch.findMany({
      where: { fabricOrder: { phaseId: phase.id, isStrikedThrough: false } },
      orderBy: { dispatchedAt: "desc" },
      select: {
        id: true,
        dispatchedAt: true,
        qtyKg: true,
        vehicleRef: true,
        notes: true,
        fabricOrderId: true,
        fabricOrder: {
          select: {
            id: true,
            fabricName: true,
            colour: true,
            fabricVendor: { select: { name: true } },
          },
        },
        garmenter: { select: { id: true, name: true } },
      },
    }),
  ]);

  const foDisplayNumber = assignFoDisplayNumbers(orders, new Map());

  // Aggregate per garmenter
  type Agg = { name: string; kg: number; count: number };
  const byGarmenter = new Map<string, Agg>();
  for (const d of dispatches) {
    const key = d.garmenter.id;
    const a = byGarmenter.get(key) ?? { name: d.garmenter.name, kg: 0, count: 0 };
    a.kg += protoNumberFmt.toNum(d.qtyKg);
    a.count += 1;
    byGarmenter.set(key, a);
  }
  const totalKg = dispatches.reduce((s, d) => s + protoNumberFmt.toNum(d.qtyKg), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dispatches</h1>
        <p className="text-sm text-muted-foreground">
          {dispatches.length} dispatch{dispatches.length === 1 ? "" : "es"} in Phase {phase.number} ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">By garmenter</div>
          <div className="text-[12.5px] text-muted-foreground">
            Total dispatched: <span className="font-mono tabular-nums font-medium text-foreground">{kgN(totalKg)} kg</span>
          </div>
        </div>
        {byGarmenter.size === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">No dispatches yet in this phase.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[...byGarmenter.values()].sort((a, b) => b.kg - a.kg).map((g) => (
              <div key={g.name} className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="font-medium text-[13px] truncate">{g.name}</div>
                <div className="font-mono tabular-nums text-[15px] mt-0.5">{kgN(g.kg)} <span className="text-[11px] text-muted-foreground">kg</span></div>
                <div className="text-[10.5px] text-muted-foreground">{g.count} dispatch{g.count === 1 ? "" : "es"}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">To</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Source FO</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Fabric · Colour · Vendor</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicle · Notes</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">No dispatches logged in this phase yet.</td>
              </tr>
            )}
            {dispatches.map((d) => {
              const dateStr = new Date(d.dispatchedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
              const foDisp = foDisplayNumber.get(d.fabricOrderId) ?? d.fabricOrderId.slice(-4);
              return (
                <tr key={d.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-3 align-top whitespace-nowrap">{dateStr}</td>
                  <td className="px-3 py-3 align-top font-medium">{d.garmenter.name}</td>
                  <td className="px-3 py-3 align-top font-mono text-[12.5px] whitespace-nowrap">{foDisp}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">{d.fabricOrder.fabricName} <span className="text-muted-foreground font-normal">· {d.fabricOrder.colour}</span></div>
                    <div className="text-[12px] text-muted-foreground">{d.fabricOrder.fabricVendor?.name ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap">{kg(protoNumberFmt.toNum(d.qtyKg))}</td>
                  <td className="px-3 py-3 align-top text-[12px] text-muted-foreground">
                    {d.vehicleRef && <div className="font-mono text-[11.5px]">{d.vehicleRef}</div>}
                    {d.notes && <div className="leading-snug">{d.notes}</div>}
                    {!d.vehicleRef && !d.notes && <span>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11.5px] text-muted-foreground">
        Dispatches are logged via the <span className="font-mono">Dispatch</span> sheet on <a href="/proto/fabric-orders" className="underline">/proto/fabric-orders</a>.
      </p>
    </div>
  );
}

function kg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
function kgN(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
