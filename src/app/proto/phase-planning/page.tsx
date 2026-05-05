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

  const [productMasters, fabricOrders, fabricMasters, garmenters] = await Promise.all([
    db.productMaster.findMany({
      where: { isStrikedThrough: false },
      select: { id: true, styleNumber: true, productName: true, fabricName: true },
      orderBy: { styleNumber: "asc" },
    }),
    db.fabricOrder.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
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
    db.fabricMaster.findMany({
      where: { isStrikedThrough: false },
      select: { fabricName: true, vendorId: true, vendor: { select: { name: true } } },
    }),
    db.vendor.findMany({
      where: { type: "GARMENTING", isStrikedThrough: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // fabricName → fabricVendorId (first match wins; in practice fabricMasters are unique by name)
  const fabricNameToVendor = new Map<string, { vendorId: string; vendorName: string }>();
  for (const fm of fabricMasters) {
    if (fm.fabricName && fm.vendorId && !fabricNameToVendor.has(fm.fabricName)) {
      fabricNameToVendor.set(fm.fabricName, { vendorId: fm.vendorId, vendorName: fm.vendor?.name ?? "" });
    }
  }

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
        phaseId={phase.id}
        phaseNumber={phase.number}
        isTestPhase={phase.isTestPhase}
        productMasterOptions={productMasters
          .map((pm) => {
            const fv = pm.fabricName ? fabricNameToVendor.get(pm.fabricName) : null;
            return {
              id: pm.id,
              styleNumber: pm.styleNumber,
              productName: pm.productName ?? null,
              fabricName: pm.fabricName ?? null,
              fabricVendorId: fv?.vendorId ?? null,
              fabricVendorName: fv?.vendorName ?? null,
            };
          })
          // Drop rows with no usable label (e.g. styleNumber="-" and no name/fabric)
          .filter((pm) => {
            const sn = (pm.styleNumber ?? "").trim();
            const hasName = (pm.productName ?? "").trim().length > 0;
            const hasFabric = (pm.fabricName ?? "").trim().length > 0;
            return (sn !== "" && sn !== "-") || hasName || hasFabric;
          })}
        garmenters={garmenters}
        existingFabricOrders={fabricOrders.map((fo) => ({
          id: fo.id,
          fabricName: fo.fabricName,
          colour: fo.colour,
          vendorName: fo.fabricVendor?.name ?? "—",
          orderedKg: protoNumberFmt.toNum(fo.fabricOrderedQuantityKg),
          shippedKg: protoNumberFmt.toNum(fo.fabricShippedQuantityKg),
        }))}
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
