import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { getArticlesInPreviousPhases } from "@/actions/phase-planning";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhasePlanningProto } from "./phase-planning-proto";
import { protoNumberFmt } from "@/lib/proto/synthesize";

export const dynamic = "force-dynamic";

/**
 * Proto: Phase planning · porting the existing app form to write the new
 * Allocation rows alongside the existing Product + FabricOrder rows.
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

  const [productMasters, fabricOrders, fabricMasters, garmenters, sizeDistributions, previousArticles] = await Promise.all([
    db.productMaster.findMany({
      where: { isStrikedThrough: false },
      orderBy: { articleNumber: "asc" },
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
      select: { fabricName: true, vendorId: true, mrp: true, vendor: { select: { name: true } } },
    }),
    db.vendor.findMany({
      where: { type: "GARMENTING", isStrikedThrough: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.sizeDistribution.findMany(),
    getArticlesInPreviousPhases(phase.id),
  ]);

  // fabricName → vendor info (first match wins; FabricMaster.fabricName is unique-ish)
  const fabricNameToVendor = new Map<string, { vendorId: string; vendorName: string; mrp: number | null }>();
  for (const fm of fabricMasters) {
    if (fm.fabricName && fm.vendorId && !fabricNameToVendor.has(fm.fabricName)) {
      fabricNameToVendor.set(fm.fabricName, {
        vendorId: fm.vendorId,
        vendorName: fm.vendor?.name ?? "",
        mrp: fm.mrp ? Number(fm.mrp.toString()) : null,
      });
    }
  }

  const productMasterOptions = productMasters
    .map((pm) => {
      const fv = pm.fabricName ? fabricNameToVendor.get(pm.fabricName) : null;
      const fv2 = pm.fabric2Name ? fabricNameToVendor.get(pm.fabric2Name) : null;
      const fv3 = pm.fabric3Name ? fabricNameToVendor.get(pm.fabric3Name) : null;
      const fv4 = pm.fabric4Name ? fabricNameToVendor.get(pm.fabric4Name) : null;
      return {
        id: pm.id,
        articleNumber: pm.articleNumber ?? null,
        styleNumber: pm.styleNumber,
        skuCode: pm.skuCode,
        productName: pm.productName ?? null,
        type: pm.type,
        gender: String(pm.gender),
        // Fabric 1 (always present)
        fabricName: pm.fabricName ?? null,
        fabricVendorId: fv?.vendorId ?? null,
        fabricVendorName: fv?.vendorName ?? null,
        fabricCostPerKg: fv?.mrp ?? null,
        garmentsPerKg: pm.garmentsPerKg ? Number(pm.garmentsPerKg.toString()) : null,
        coloursAvailable: pm.coloursAvailable ?? [],
        // Fabric 2
        fabric2Name: pm.fabric2Name ?? null,
        fabric2VendorId: fv2?.vendorId ?? null,
        fabric2VendorName: fv2?.vendorName ?? null,
        fabric2CostPerKg: fv2?.mrp ?? null,
        garmentsPerKg2: pm.garmentsPerKg2 ? Number(pm.garmentsPerKg2.toString()) : null,
        colours2Available: pm.colours2Available ?? [],
        // Fabric 3
        fabric3Name: pm.fabric3Name ?? null,
        fabric3VendorId: fv3?.vendorId ?? null,
        fabric3VendorName: fv3?.vendorName ?? null,
        garmentsPerKg3: pm.garmentsPerKg3 ? Number(pm.garmentsPerKg3.toString()) : null,
        colours3Available: pm.colours3Available ?? [],
        // Fabric 4
        fabric4Name: pm.fabric4Name ?? null,
        fabric4VendorId: fv4?.vendorId ?? null,
        fabric4VendorName: fv4?.vendorName ?? null,
        garmentsPerKg4: pm.garmentsPerKg4 ? Number(pm.garmentsPerKg4.toString()) : null,
        colours4Available: pm.colours4Available ?? [],
      };
    })
    .filter((pm) => {
      const an = (pm.articleNumber ?? "").trim();
      const sn = (pm.styleNumber ?? "").trim();
      return (an !== "" && an !== "-") || (sn !== "" && sn !== "-") || (pm.productName ?? "").trim().length > 0;
    });

  const sizeDistMap: Record<string, number> = {};
  for (const sd of sizeDistributions) sizeDistMap[sd.size] = sd.percentage;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Phase Planning</h1>
          <p className="text-sm text-muted-foreground">
            Plan article and fabric orders for Phase {phase.number} ·{" "}
            <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
          </p>
        </div>
      </div>

      <PhasePlanningProto
        phaseId={phase.id}
        phaseNumber={phase.number}
        isTestPhase={phase.isTestPhase}
        productMasterOptions={productMasterOptions}
        garmenters={garmenters}
        sizeDistMap={sizeDistMap}
        previousArticleNumbers={[...previousArticles]}
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
          <span className="text-foreground font-medium">Quantity mode</span> for new phases where demand drives fabric procurement; <span className="text-foreground font-medium">Fabric mode</span> for allocating fabric that already exists. Both write the same <span className="font-mono text-[12px]">Product + FabricOrder + Allocation</span> rows under the hood.
        </p>
        <p className="text-[12px] text-muted-foreground mt-2">
          The existing form at <a href="/phase-planning" className="underline underline-offset-2">/phase-planning</a> stays the production planning surface.{" "}
          <Badge variant="outline" className="ml-1">proto writes when test phase is on</Badge>
        </p>
      </Card>
    </div>
  );
}
