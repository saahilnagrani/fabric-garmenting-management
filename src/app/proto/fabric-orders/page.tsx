import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import {
  adaptFabricOrder,
  applyDemoState,
  pickDemoStates,
  protoNumberFmt,
  synthesizeFabricOrder,
} from "@/lib/proto/synthesize";
import { FabricOrdersProtoGrid } from "./fabric-orders-grid";

export const dynamic = "force-dynamic";

/**
 * Proto: Fabric orders with custody columns and expandable receipts timeline.
 *
 * Reads real FabricOrder + Vendor + GarmentingLocation + ProductFabricOrder
 * + Product rows from the DB. Synthesizes FabricReceipt / GarmenterDispatch /
 * Allocation events at request time using lib/proto/synthesize.ts. No writes.
 */
export default async function ProtoFabricOrdersPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Fabric orders · proto</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  const orders = await db.fabricOrder.findMany({
    where: { phaseId: phase.id, isStrikedThrough: false },
    orderBy: { createdAt: "desc" },
    include: {
      fabricVendor: { select: { name: true } },
      garmentingAtRef: { select: { name: true } },
      productLinks: {
        include: {
          product: {
            select: {
              id: true,
              articleNumber: true,
              styleNumber: true,
              productName: true,
              fabricOrderedQuantityKg: true,
              garmentingAt: true,
              garmentingAtRef: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const adapted = orders.map(adaptFabricOrder);
  const demoStates = pickDemoStates(adapted);
  const overReceiptId = [...demoStates.entries()].find(([, s]) => s === "over")?.[0] ?? null;

  const synthesized = orders.map((row) => {
    const baseFo = adaptFabricOrder(row);
    const inferredGarm = baseFo.garmentingAtName ?? inferGarmenterFromProducts(row.productLinks);
    const foWithGarm = inferredGarm ? { ...baseFo, garmentingAtName: inferredGarm } : baseFo;
    const fo = applyDemoState(foWithGarm, demoStates.get(baseFo.id));
    const linkedProducts = row.productLinks.map((link) => ({
      productId: link.product.id,
      articleNumber: link.product.articleNumber,
      styleNumber: link.product.styleNumber,
      productName: link.product.productName,
      demandKg: protoNumberFmt.toNum(link.product.fabricOrderedQuantityKg),
    }));
    return synthesizeFabricOrder(fo, linkedProducts, {
      forceOverReceipt: fo.id === overReceiptId,
    });
  });

  function inferGarmenterFromProducts(
    links: { product: { garmentingAt: string | null; garmentingAtRef: { name: string } | null } }[]
  ): string | null {
    const counts = new Map<string, number>();
    for (const link of links) {
      const name = link.product.garmentingAtRef?.name ?? link.product.garmentingAt;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  // Headline KPIs across the phase
  const totals = synthesized.reduce(
    (acc, s) => {
      acc.onOrder += s.custody.onOrderKg;
      acc.inOurHands += s.custody.inOurHandsKg;
      acc.atGarmenter += Object.values(s.custody.atGarmenterKg).reduce((a, b) => a + b, 0);
      acc.surplus += s.custody.surplusKg;
      return acc;
    },
    { onOrder: 0, inOurHands: 0, atGarmenter: 0, surplus: 0 }
  );

  // Sort: demo orders first (so the screen tells its story without scrolling),
  // then the rest. Strip Decimal/Date types for the client boundary. Assign
  // FO-0001..FO-NNNN display numbers AFTER sort so demo rows are first.
  const demoOrder: Record<string, number> = { over: 0, partial: 1, full: 2, vendor: 3 };
  const sortedSynth = [...synthesized].sort((a, b) => {
    const aState = demoStates.get(a.fabricOrder.id);
    const bState = demoStates.get(b.fabricOrder.id);
    const ai = aState ? demoOrder[aState] : 99;
    const bi = bState ? demoOrder[bState] : 99;
    return ai - bi;
  });
  const serialized = sortedSynth.map((s, idx) => ({
    fabricOrder: s.fabricOrder,
    displayNumber: `FO-${String(idx + 1).padStart(4, "0")}`,
    receipts: s.receipts.map((r) => ({ ...r, date: r.date.toISOString() })),
    dispatches: s.dispatches.map((d) => ({ ...d, date: d.date.toISOString() })),
    allocations: s.allocations,
    custody: s.custody,
    orderDateIso: s.fabricOrder.orderDate?.toISOString() ?? null,
    demoState: demoStates.get(s.fabricOrder.id) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabric Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} orders in Phase {phase.number} · custody view ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      {demoStates.size > 0 && (
        <div className="text-[12.5px] rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[oklch(0.40_0.16_45)]">
          Phase {phase.number} has no live shipping data, so the top {demoStates.size} orders are seeded with demo states (full · partial · over · vendor) so the screen reads as a worked example.
          Real orders below behave normally.
        </div>
      )}

      <FabricOrdersProtoGrid rows={serialized} totals={totals} overReceiptId={overReceiptId} demoIds={new Set(demoStates.keys())} />
    </div>
  );
}
