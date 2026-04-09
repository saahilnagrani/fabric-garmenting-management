import { getCurrentPhase } from "@/actions/phases";
import { getProductMasters } from "@/actions/product-masters";
import { getFabricMasters } from "@/actions/fabric-masters";
import { getVendors } from "@/actions/vendors";
import { getArticlesInPreviousPhases } from "@/actions/phase-planning";
import { getSizeDistributions } from "@/actions/size-distributions";
import { PlanningForm } from "@/components/phase-planning/planning-form";

export default async function PhasePlanningPage() {
  const phase = await getCurrentPhase();
  if (!phase) {
    return <p className="text-muted-foreground">No active phase selected.</p>;
  }

  const [productMasters, fabricMasters, vendors, previousArticles, sizeDistributions] = await Promise.all([
    getProductMasters(),
    getFabricMasters(),
    getVendors(),
    getArticlesInPreviousPhases(phase.id),
    getSizeDistributions(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Phase Planning</h1>
        <p className="text-sm text-muted-foreground">
          Plan Article and Fabric orders for {phase.name}
        </p>
      </div>
      <PlanningForm
        phaseId={phase.id}
        phaseNumber={phase.number}
        productMasters={JSON.parse(JSON.stringify(productMasters))}
        fabricMasters={JSON.parse(JSON.stringify(fabricMasters))}
        vendors={vendors}
        previousArticles={Array.from(previousArticles)}
        sizeDistributions={sizeDistributions.map((d) => ({ size: d.size, percentage: d.percentage }))}
      />
    </div>
  );
}
