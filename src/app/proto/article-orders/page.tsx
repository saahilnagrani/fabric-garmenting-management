import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import {
  adaptFabricOrder,
  applyDemoState,
  assignFoDisplayNumbers,
  pickDemoStates,
  protoNumberFmt,
  synthesizeFabricOrder,
} from "@/lib/proto/synthesize";
import { ArticleOrdersProtoGrid, type ArticleRow } from "./article-orders-grid";

export const dynamic = "force-dynamic";

/**
 * Proto: Article orders with the stacked allocation cell.
 *
 * Shows real Product rows. For each product, looks up its linked FabricOrders
 * and computes a coverage breakdown:
 *   from-received  = sum of allocated qty backed by FOs that have receipts
 *   from-expected  = sum of allocated qty backed by FOs not yet received
 *   shortfall      = max(0, demand − allocated)
 *   over           = max(0, allocated − demand)
 *
 * The synthesizer's demo overrides apply: a few FOs are seeded with shipped
 * data so coverage tells the full story even when the live DB has none.
 */
export default async function ProtoArticleOrdersPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Article Orders · proto</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  // Pull both products (the demand side) AND their linked fabric orders (with
  // shipping data, so we can split allocation between received and expected).
  const [products, fabricOrders] = await Promise.all([
    db.product.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        articleNumber: true,
        styleNumber: true,
        productName: true,
        colourOrdered: true,
        fabricName: true,
        fabricOrderedQuantityKg: true,
        garmentingAt: true,
        garmentingAtRef: { select: { name: true } },
        status: true,
        isRepeat: true,
        fabricOrderLinks: { select: { fabricOrderId: true } },
      },
    }),
    db.fabricOrder.findMany({
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
    }),
  ]);

  const adapted = fabricOrders.map(adaptFabricOrder);
  const demoStates = pickDemoStates(adapted);
  const overReceiptId = [...demoStates.entries()].find(([, s]) => s === "over")?.[0] ?? null;

  // Synthesize each FO so we know its received/ordered ratio, dispatches etc.
  const synthByFoId = new Map<string, ReturnType<typeof synthesizeFabricOrder>>();
  const sortedSynth: ReturnType<typeof synthesizeFabricOrder>[] = [];
  for (const row of fabricOrders) {
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
    const synth = synthesizeFabricOrder(fo, linkedProducts, { forceOverReceipt: fo.id === overReceiptId });
    synthByFoId.set(row.id, synth);
    sortedSynth.push(synth);
  }

  // Canonical FO display numbers (shared across all proto screens).
  const foDisplayNumber = assignFoDisplayNumbers(sortedSynth.map((s) => s.fabricOrder), demoStates);

  // Build per-article coverage rows
  const rows: ArticleRow[] = products.map((p, idx) => {
    const demand = protoNumberFmt.toNum(p.fabricOrderedQuantityKg);
    let fromReceived = 0;
    let fromExpected = 0;
    const sources: ArticleRow["sources"] = [];

    for (const link of p.fabricOrderLinks) {
      const synth = synthByFoId.get(link.fabricOrderId);
      if (!synth) continue;
      // Allocation qty against this FO from this product (synthesizer set it
      // = demandKg per link; we divide by number of links for this product so
      // we don't double-count when a product spans 2 FOs).
      const linkCount = p.fabricOrderLinks.length || 1;
      const allocatedQty = round1(demand / linkCount);
      const ratioReceived = synth.custody.orderedKg > 0
        ? Math.min(1, synth.custody.receivedKg / synth.custody.orderedKg)
        : 0;
      const recPart = round1(allocatedQty * ratioReceived);
      const expPart = round1(allocatedQty - recPart);
      fromReceived += recPart;
      fromExpected += expPart;
      sources.push({
        foDisplay: foDisplayNumber.get(link.fabricOrderId) ?? link.fabricOrderId.slice(-4),
        receivedKg: recPart,
        expectedKg: expPart,
      });
    }

    const allocated = round1(fromReceived + fromExpected);
    const shortfallKg = round1(Math.max(0, demand - allocated));
    const overKg = round1(Math.max(0, allocated - demand));
    const coveragePct = demand > 0 ? Math.round((allocated / demand) * 100) : 0;

    return {
      id: p.id,
      displayNumber: `AO-${String(idx + 1).padStart(4, "0")}`,
      articleNumber: p.articleNumber,
      styleNumber: p.styleNumber,
      productName: p.productName,
      colour: p.colourOrdered,
      fabricName: p.fabricName,
      garmenterName: p.garmentingAtRef?.name ?? p.garmentingAt ?? null,
      status: p.status,
      isRepeat: p.isRepeat,
      demandKg: round1(demand),
      fromReceivedKg: round1(fromReceived),
      fromExpectedKg: round1(fromExpected),
      shortfallKg,
      overKg,
      coveragePct,
      sources,
    };
  });

  // Top-of-page totals
  const totals = rows.reduce(
    (acc, r) => {
      acc.demand += r.demandKg;
      acc.received += r.fromReceivedKg;
      acc.expected += r.fromExpectedKg;
      acc.shortfall += r.shortfallKg;
      return acc;
    },
    { demand: 0, received: 0, expected: 0, shortfall: 0 }
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Article Orders</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} products in Phase {phase.number} · allocation view ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      <ArticleOrdersProtoGrid rows={rows} totals={totals} />
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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
