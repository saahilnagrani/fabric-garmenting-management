import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { getVendors } from "@/actions/vendors";
import { getFabricMasters } from "@/actions/fabric-masters";
import { getProductMasters } from "@/actions/product-masters";
import { getGarmentingLocations } from "@/actions/garmenting-locations";
import {
  adaptFabricOrder,
  adaptRealCustody,
  assignFoDisplayNumbers,
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

  const garmenters = await db.vendor.findMany({
    where: { type: "GARMENTING", isStrikedThrough: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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
  });

  const synthesized = orders.map((row) => {
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
    return synthesizeFabricOrder(fo, linkedProducts, { real });
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

  // Canonical FO display numbers (shared across all proto screens).
  const displayNumbers = assignFoDisplayNumbers(synthesized.map((s) => s.fabricOrder), new Map());

  const sortedSynth = [...synthesized].sort((a, b) => a.fabricOrder.id.localeCompare(b.fabricOrder.id));
  const serialized = sortedSynth.map((s) => {
    // freeKg = total received − total dispatched. Everything received that
    // hasn't been dispatched is "in our hands, available for any AO".
    const totalReceived = s.receipts.reduce((sum, r) => sum + r.qtyKg, 0);
    const totalDispatched = s.dispatches.reduce((sum, d) => sum + d.qtyKg, 0);
    const freeKg = Math.max(0, totalReceived - totalDispatched);
    return {
      fabricOrder: s.fabricOrder,
      displayNumber: displayNumbers.get(s.fabricOrder.id) ?? "FO-????",
      receipts: s.receipts.map((r) => ({ ...r, date: r.date.toISOString() })),
      dispatches: s.dispatches.map((d) => ({ ...d, date: d.date.toISOString() })),
      allocations: s.allocations,
      freeKg: Math.round(freeKg * 10) / 10,
      custody: s.custody,
      orderDateIso: s.fabricOrder.orderDate?.toISOString() ?? null,
      demoState: null,
    };
  });

  // Pull masters needed by the live FabricOrderSheet (for the pencil edit
  // button on the proto FO row).
  const [vendors, fabricMasters, productMasters, garmentingLocationRecords] = await Promise.all([
    getVendors(),
    getFabricMasters(),
    getProductMasters(),
    getGarmentingLocations(),
  ]);
  const garmentingLocations = garmentingLocationRecords.map((l) => l.name);

  // Raw FO rows (decimals stringified) so the live sheet can pre-fill its form.
  const rawOrders = JSON.parse(JSON.stringify(orders));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabric Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} orders in Phase {phase.number} · custody view ·{" "}
          <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
        </p>
      </div>

      <FabricOrdersProtoGrid
        rows={serialized}
        totals={totals}
        overReceiptId={null}
        demoIds={new Set()}
        garmenters={garmenters}
        isTestPhase={phase.isTestPhase}
        phaseNumber={phase.number}
        rawOrders={rawOrders}
        vendors={JSON.parse(JSON.stringify(vendors))}
        fabricMasters={JSON.parse(JSON.stringify(fabricMasters))}
        productMasters={JSON.parse(JSON.stringify(productMasters))}
        garmentingLocations={garmentingLocations}
        phaseId={phase.id}
      />
    </div>
  );
}
