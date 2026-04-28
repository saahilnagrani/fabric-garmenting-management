import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import {
  adaptFabricOrder,
  pickOverReceiptDemoId,
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
              styleNumber: true,
              productName: true,
              fabricOrderedQuantityKg: true,
            },
          },
        },
      },
    },
  });

  const adapted = orders.map(adaptFabricOrder);
  const overReceiptId = pickOverReceiptDemoId(adapted);

  const synthesized = orders.map((row) => {
    const fo = adaptFabricOrder(row);
    const linkedProducts = row.productLinks.map((link) => ({
      productId: link.product.id,
      styleNumber: link.product.styleNumber,
      productName: link.product.productName,
      demandKg: protoNumberFmt.toNum(link.product.fabricOrderedQuantityKg),
    }));
    return synthesizeFabricOrder(fo, linkedProducts, {
      forceOverReceipt: fo.id === overReceiptId,
    });
  });

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

  // Strip Decimal/Date types for the client component boundary.
  const serialized = synthesized.map((s) => ({
    fabricOrder: s.fabricOrder,
    receipts: s.receipts.map((r) => ({ ...r, date: r.date.toISOString() })),
    dispatches: s.dispatches.map((d) => ({ ...d, date: d.date.toISOString() })),
    allocations: s.allocations,
    custody: s.custody,
    orderDateIso: s.fabricOrder.orderDate?.toISOString() ?? null,
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

      <FabricOrdersProtoGrid rows={serialized} totals={totals} overReceiptId={overReceiptId} />
    </div>
  );
}
