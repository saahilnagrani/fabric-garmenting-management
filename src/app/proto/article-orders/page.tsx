import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { getVendors } from "@/actions/vendors";
import { getFabricMasters } from "@/actions/fabric-masters";
import { getProductMasters } from "@/actions/product-masters";
import {
  adaptFabricOrder,
  adaptRealCustody,
  assignFoDisplayNumbers,
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
        type: true,
        colourOrdered: true,
        fabricName: true,
        fabricOrderedQuantityKg: true,
        garmentNumber: true,
        garmentingAt: true,
        garmentingAtRef: { select: { name: true } },
        status: true,
        isRepeat: true,
        fabricOrderLinks: { select: { fabricOrderId: true, fabricSlot: true } },
        allocations: {
          select: {
            id: true,
            fabricOrderId: true,
            qtyKg: true,
            stage: true,
            fabricOrder: { select: { fabricName: true, colour: true } },
            dispatches: { select: { qtyKg: true } },
          },
        },
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
        receipts: { orderBy: { receivedAt: "asc" } },
        dispatches: { orderBy: { dispatchedAt: "asc" }, include: { garmenter: { select: { name: true } } } },
        allocations: {
          include: {
            product: { select: { articleNumber: true, styleNumber: true, productName: true } },
            garmenter: { select: { name: true } },
            dispatches: { select: { qtyKg: true } },
          },
        },
      },
    }),
  ]);

  // Synthesize each FO so we know its received/ordered ratio, dispatches etc.
  const synthByFoId = new Map<string, ReturnType<typeof synthesizeFabricOrder>>();
  const sortedSynth: ReturnType<typeof synthesizeFabricOrder>[] = [];
  for (const row of fabricOrders) {
    const baseFo = adaptFabricOrder(row);
    const inferredGarm = baseFo.garmentingAtName ?? inferGarmenterFromProducts(row.productLinks);
    const fo = inferredGarm ? { ...baseFo, garmentingAtName: inferredGarm } : baseFo;
    const linkedProducts = row.productLinks.map((link) => ({
      productId: link.product.id,
      articleNumber: link.product.articleNumber,
      styleNumber: link.product.styleNumber,
      productName: link.product.productName,
      demandKg: protoNumberFmt.toNum(link.product.fabricOrderedQuantityKg),
    }));
    const real = adaptRealCustody(row, fo.garmentingAtName);
    const synth = synthesizeFabricOrder(fo, linkedProducts, { real });
    synthByFoId.set(row.id, synth);
    sortedSynth.push(synth);
  }

  // Canonical FO display numbers (shared across all proto screens).
  const foDisplayNumber = assignFoDisplayNumbers(sortedSynth.map((s) => s.fabricOrder), new Map());

  // Precompute, per FO:
  //   pendingKg          = vendor still owes us (orderedKg − Σ receipts)
  //   freeKg             = received but not yet dispatched
  //   totalUnfulfilledKg = sum of (planned − dispatched) across all allocs
  // Used to prorate "expected" (pending pool) and "in-pool" (free pool)
  // shares across the FO's open allocations.
  type FoAgg = { pendingKg: number; freeKg: number; totalUnfulfilledKg: number };
  const foAggById = new Map<string, FoAgg>();
  // FO statuses that mean "vendor will not ship anything more" — pendingKg
  // collapses to 0 even if received < ordered. The shortfall flips to
  // hard-short on every AO that was relying on this FO.
  const VENDOR_DONE_STATUSES = new Set(["RECEIVED", "FULLY_SETTLED"]);
  for (const fo of fabricOrders) {
    const ordered = protoNumberFmt.toNum(fo.fabricOrderedQuantityKg);
    const receivedSum = fo.receipts.reduce((s, r) => s + protoNumberFmt.toNum(r.qtyKg), 0);
    const dispatchedSum = fo.dispatches.reduce((s, d) => s + protoNumberFmt.toNum(d.qtyKg), 0);
    const vendorDone = VENDOR_DONE_STATUSES.has(String(fo.orderStatus));
    const pendingKg = vendorDone ? 0 : Math.max(0, ordered - receivedSum);
    const freeKg = Math.max(0, receivedSum - dispatchedSum);
    let totalUnfulfilledKg = 0;
    for (const a of fo.allocations) {
      const planned = protoNumberFmt.toNum(a.qtyKg);
      const allocDispatched = (a.dispatches ?? []).reduce((s, d) => s + protoNumberFmt.toNum(d.qtyKg), 0);
      totalUnfulfilledKg += Math.max(0, planned - allocDispatched);
    }
    foAggById.set(fo.id, { pendingKg, freeKg, totalUnfulfilledKg });
  }

  // Build per-article coverage rows. Demand is computed from Allocations
  // (sum of qtyKg per fabricName) so multi-fabric articles report total
  // correctly. Each fabric becomes its own bar in the row.
  const rows: ArticleRow[] = products.map((p, idx) => {
    type FabricGroup = {
      fabricName: string;
      colour: string;
      demandKg: number;
      dispatchedKg: number;     // already at garmenter (green)
      inPoolKg: number;         // in our warehouse, eligible (blue)
      fromExpectedKg: number;   // vendor still owes (ochre)
      shortfallKg: number;      // hatched
      sources: ArticleRow["fabrics"][number]["sources"];
    };
    const groups = new Map<string, FabricGroup>();

    for (const a of p.allocations) {
      const fabricName = a.fabricOrder?.fabricName ?? "—";
      const colour = a.fabricOrder?.colour ?? "—";
      const key = `${fabricName}|${colour}`;
      const planned = protoNumberFmt.toNum(a.qtyKg);
      const dispatched = (a.dispatches ?? []).reduce((s, d) => s + protoNumberFmt.toNum(d.qtyKg), 0);
      const unfulfilled = Math.max(0, planned - dispatched);

      // Pro-rate the FO's free pool and pending-from-vendor across all
      // unfulfilled allocations on this FO. Free is consumed first
      // (since it's already in our hands); whatever the AO can still
      // expect from the vendor comes after.
      const foAgg = foAggById.get(a.fabricOrderId) ?? { pendingKg: 0, freeKg: 0, totalUnfulfilledKg: 0 };
      const share = foAgg.totalUnfulfilledKg > 0 ? (unfulfilled / foAgg.totalUnfulfilledKg) : 0;
      const inPoolPart = round1(share * Math.min(foAgg.freeKg, foAgg.totalUnfulfilledKg));
      // The free pool fills first, so the "expected from vendor" share is
      // calculated against the unfulfilled remaining after pool coverage.
      const stillUnfulfilledAfterPool = Math.max(0, foAgg.totalUnfulfilledKg - foAgg.freeKg);
      const shareForVendor = stillUnfulfilledAfterPool > 0
        ? Math.max(0, unfulfilled - inPoolPart) / stillUnfulfilledAfterPool
        : 0;
      const expPart = round1(shareForVendor * Math.min(foAgg.pendingKg, stillUnfulfilledAfterPool));
      const shortPart = round1(Math.max(0, unfulfilled - inPoolPart - expPart));

      const g = groups.get(key) ?? {
        fabricName,
        colour,
        demandKg: 0,
        dispatchedKg: 0,
        inPoolKg: 0,
        fromExpectedKg: 0,
        shortfallKg: 0,
        sources: [],
      };
      g.demandKg += planned;
      g.dispatchedKg += dispatched;
      g.inPoolKg += inPoolPart;
      g.fromExpectedKg += expPart;
      g.shortfallKg += shortPart;
      g.sources.push({
        foDisplay: foDisplayNumber.get(a.fabricOrderId) ?? a.fabricOrderId.slice(-4),
        dispatchedKg: round1(dispatched),
        inPoolKg: inPoolPart,
        expectedKg: expPart,
      });
      groups.set(key, g);
    }

    const fabrics = [...groups.values()].map((g) => ({
      fabricName: g.fabricName,
      colour: g.colour,
      demandKg: round1(g.demandKg),
      dispatchedKg: round1(g.dispatchedKg),
      inPoolKg: round1(g.inPoolKg),
      fromExpectedKg: round1(g.fromExpectedKg),
      shortfallKg: round1(g.shortfallKg),
      sources: g.sources,
    }));

    // Aggregates across all fabrics (for KPI strip + coverage %)
    const demand = round1(fabrics.reduce((s, f) => s + f.demandKg, 0));
    const dispatched = round1(fabrics.reduce((s, f) => s + f.dispatchedKg, 0));
    const inPool = round1(fabrics.reduce((s, f) => s + f.inPoolKg, 0));
    const fromExpected = round1(fabrics.reduce((s, f) => s + f.fromExpectedKg, 0));
    const covered = round1(dispatched + inPool + fromExpected);
    const shortfallKg = round1(Math.max(0, demand - covered));
    const coveragePct = demand > 0 ? Math.round((covered / demand) * 100) : 0;

    return {
      id: p.id,
      displayNumber: `AO-${String(idx + 1).padStart(4, "0")}`,
      articleNumber: p.articleNumber,
      styleNumber: p.styleNumber,
      productName: p.productName,
      type: p.type ?? null,
      colour: p.colourOrdered,
      fabricName: p.fabricName,
      garmenterName: p.garmentingAtRef?.name ?? p.garmentingAt ?? null,
      status: p.status,
      isRepeat: p.isRepeat,
      targetQty: p.garmentNumber ?? 0,
      demandKg: demand,
      dispatchedKg: dispatched,
      inPoolKg: inPool,
      fromExpectedKg: fromExpected,
      shortfallKg,
      coveragePct,
      fabrics,
    };
  });

  // Top-of-page totals
  const totals = rows.reduce(
    (acc, r) => {
      acc.demand += r.demandKg;
      acc.dispatched += r.dispatchedKg;
      acc.inPool += r.inPoolKg;
      acc.expected += r.fromExpectedKg;
      acc.shortfall += r.shortfallKg;
      return acc;
    },
    { demand: 0, dispatched: 0, inPool: 0, expected: 0, shortfall: 0 }
  );

  // Masters needed by the live ProductOrderSheet (for the pencil edit
  // button on the proto AO row).
  const [vendors, fabricMastersData, productMastersData, sizeDistData] = await Promise.all([
    getVendors(),
    getFabricMasters(),
    getProductMasters(),
    db.sizeDistribution.findMany(),
  ]);
  const rawProducts = JSON.parse(JSON.stringify(products));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Article Orders</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} products in Phase {phase.number} · allocation view ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      <ArticleOrdersProtoGrid
        rows={rows}
        totals={totals}
        rawProducts={rawProducts}
        vendors={JSON.parse(JSON.stringify(vendors))}
        fabricMasters={JSON.parse(JSON.stringify(fabricMastersData))}
        productMasters={JSON.parse(JSON.stringify(productMastersData))}
        sizeDistributions={JSON.parse(JSON.stringify(sizeDistData))}
        phaseId={phase.id}
      />
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
