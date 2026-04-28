import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhasePlanningProto } from "./phase-planning-proto";
import { protoNumberFmt } from "@/lib/proto/synthesize";

export const dynamic = "force-dynamic";

/**
 * Proto: Phase planning · both modes preserved.
 *
 * The existing two-mode form (quantity-first / fabric-first) is kept exactly
 * as today; the *only* visible change is a "What this commits" panel below
 * each mode showing the new Allocation rows the click would write alongside
 * the existing Product + FabricOrder rows. The form here is illustrative —
 * real interactivity remains in /phase-planning. The point is to make the
 * model integration visible.
 */
export default async function ProtoPhasePlanningPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Phase Planning · proto</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  // Pull a few real article masters and a few existing FOs so the form panels
  // feel grounded rather than purely faked.
  const [productMasters, fabricOrders] = await Promise.all([
    db.productMaster.findMany({
      take: 8,
      where: { isStrikedThrough: false },
      select: {
        id: true,
        styleNumber: true,
        productName: true,
        fabricName: true,
      },
      orderBy: { styleNumber: "asc" },
    }),
    db.fabricOrder.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fabricName: true,
        colour: true,
        fabricVendor: { select: { name: true } },
        fabricOrderedQuantityKg: true,
        fabricShippedQuantityKg: true,
      },
    }),
  ]);

  // Sample articles to pre-populate the Quantity-mode "selected articles" list
  const sampleQuantityArticles = productMasters.slice(0, 2).map((pm, i) => ({
    pmId: pm.id,
    styleNumber: pm.styleNumber,
    productName: pm.productName ?? pm.styleNumber,
    fabricName: pm.fabricName ?? "—",
    colour: i === 0 ? "Lime" : "Indigo",
    qty: i === 0 ? 120 : 80,
    demandKg: i === 0 ? 60.0 : 48.0,
    garmenterName: "Mumtaz",
  }));

  // Pick one existing FO with the most plausible "available pool" feel for the
  // Fabric-mode panel.
  const sampleFo = fabricOrders[0]
    ? {
        id: fabricOrders[0].id,
        fabricName: fabricOrders[0].fabricName,
        colour: fabricOrders[0].colour,
        vendorName: fabricOrders[0].fabricVendor?.name ?? "—",
        orderedKg: protoNumberFmt.toNum(fabricOrders[0].fabricOrderedQuantityKg),
        shippedKg: protoNumberFmt.toNum(fabricOrders[0].fabricShippedQuantityKg),
      }
    : null;

  // Sample articles to allocate against that fabric in Fabric mode
  const sampleFabricAllocations = productMasters.slice(2, 4).map((pm, i) => ({
    pmId: pm.id,
    styleNumber: pm.styleNumber,
    productName: pm.productName ?? pm.styleNumber,
    qty: i === 0 ? 60 : 40,
    allocateKg: i === 0 ? 80.0 : 28.0,
    garmenterName: "Mumtaz",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phase Planning</h1>
          <p className="text-sm text-muted-foreground">
            Plan article and fabric orders for Phase {phase.number} · existing modes preserved · new commits panel below ·{" "}
            <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
          </p>
        </div>
      </div>

      <PhasePlanningProto
        phaseNumber={phase.number}
        productMasterOptions={productMasters.map((pm) => ({ id: pm.id, label: pm.styleNumber + (pm.productName ? ` · ${pm.productName}` : ""), fabricName: pm.fabricName ?? null }))}
        sampleQuantityArticles={sampleQuantityArticles}
        sampleFo={sampleFo}
        sampleFabricAllocations={sampleFabricAllocations}
      />

      <Card className="p-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Why both modes survive</div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          The two existing planning modes solve different real workflows: <span className="text-foreground font-medium">Quantity mode</span> for new phases where demand drives fabric procurement; <span className="text-foreground font-medium">Fabric mode</span> for allocating fabric that already exists (received, surplus, or carried over). The rework keeps both forms exactly as they are; under the hood, both write the same <span className="font-mono text-[12px]">Product + FabricOrder + Allocation</span> rows. The commits panel makes that visible.
        </p>
        <p className="text-[12px] text-muted-foreground mt-2">
          Real interactivity stays in <a href="/phase-planning" className="underline underline-offset-2">/phase-planning</a>. This proto is read-only by design.{" "}
          <Badge variant="outline" className="ml-1">no writes</Badge>
        </p>
      </Card>
    </div>
  );
}
