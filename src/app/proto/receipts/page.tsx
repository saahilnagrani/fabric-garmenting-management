import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { Card } from "@/components/ui/card";
import { protoNumberFmt, assignFoDisplayNumbers } from "@/lib/proto/synthesize";

export const dynamic = "force-dynamic";

/**
 * Proto: phase-wide list of FabricReceipts. Each row shows the receipt
 * with its assigned-vs-free split. Useful as an audit trail across all FOs.
 */
export default async function ProtoReceiptsPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  const [orders, receipts] = await Promise.all([
    db.fabricOrder.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
      select: { id: true },
    }),
    db.fabricReceipt.findMany({
      where: { fabricOrder: { phaseId: phase.id, isStrikedThrough: false } },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        receivedAt: true,
        qtyKg: true,
        lotRef: true,
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
      },
    }),
  ]);

  // Canonical FO display numbers (shared with other proto screens).
  const foDisplayNumber = assignFoDisplayNumbers(orders, new Map());

  const totalReceived = receipts.reduce((s, r) => s + protoNumberFmt.toNum(r.qtyKg), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-sm text-muted-foreground">
          {receipts.length} receipt{receipts.length === 1 ? "" : "s"} in Phase {phase.number} ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      <Card className="grid grid-cols-1 p-0 overflow-hidden">
        <Kpi label="total received" value={totalReceived} sub={`across ${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`} tone="ok" />
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Fabric order</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Fabric · Colour · Vendor</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Received</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Lot · Notes</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">No receipts logged in this phase yet.</td>
              </tr>
            )}
            {receipts.map((r) => {
              const qty = protoNumberFmt.toNum(r.qtyKg);
              const foDisp = foDisplayNumber.get(r.fabricOrderId) ?? r.fabricOrderId.slice(-4);
              const dateStr = new Date(r.receivedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
              return (
                <tr key={r.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-3 align-top whitespace-nowrap">{dateStr}</td>
                  <td className="px-3 py-3 align-top font-mono text-[12.5px] whitespace-nowrap">{foDisp}</td>
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium">{r.fabricOrder.fabricName} <span className="text-muted-foreground font-normal">· {r.fabricOrder.colour}</span></div>
                    <div className="text-[12px] text-muted-foreground">{r.fabricOrder.fabricVendor?.name ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap">{kg(qty)}</td>
                  <td className="px-3 py-3 align-top text-[12px] text-muted-foreground">
                    {r.lotRef && <div className="font-mono text-[11.5px]">{r.lotRef}</div>}
                    {r.notes && <div className="leading-snug">{r.notes}</div>}
                    {!r.lotRef && !r.notes && <span>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11.5px] text-muted-foreground">
        Receipts go straight into the FO's in-our-hands pool. Allocation to AOs happens at dispatch time on <a href="/proto/fabric-orders" className="underline">/proto/fabric-orders</a>.
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

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "ok" | "ochre" }) {
  const color =
    tone === "ok" ? "text-[oklch(0.50_0.10_140)]" :
    tone === "ochre" ? "text-[oklch(0.55_0.12_75)]" : "";
  return (
    <div className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-[22px] font-semibold mt-1 font-mono tabular-nums ${color}`}>{kgN(value)} <span className="text-[13px] text-muted-foreground">kg</span></div>
      <div className="text-[11.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
