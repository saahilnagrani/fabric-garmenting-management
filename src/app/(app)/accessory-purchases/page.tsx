import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/feature-flags";
import { getCurrentPhase } from "@/actions/phases";
import { getAccessoryPurchases } from "@/actions/accessory-purchases";
import { getAccessoryMasters } from "@/actions/accessories";
import { getVendors } from "@/actions/vendors";
import { AccessoryPurchaseGrid } from "@/components/accessories/accessory-purchase-grid";

export default async function AccessoryPurchasesPage() {
  if (!FEATURES.accessories) notFound();

  const phase = await getCurrentPhase();
  if (!phase) return <p className="text-muted-foreground">No active phase selected.</p>;

  const [purchases, accessories, vendors] = await Promise.all([
    getAccessoryPurchases(phase.id),
    getAccessoryMasters(),
    getVendors(),
  ]);

  const accessoryOptions = accessories.map((a) => ({
    id: a.id,
    baseName: a.baseName,
    colour: a.colour,
    size: a.size,
    unit: a.unit,
    defaultCostPerUnit: a.defaultCostPerUnit ? Number(a.defaultCostPerUnit) : null,
    vendorId: a.vendorId,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Accessory Purchases</h1>
        <p className="text-sm text-muted-foreground">
          {purchases.length} purchases in Phase {phase.number} - {phase.name}
        </p>
      </div>
      <AccessoryPurchaseGrid
        purchases={JSON.parse(JSON.stringify(purchases))}
        phaseId={phase.id}
        accessories={accessoryOptions}
        vendors={vendors}
      />
    </div>
  );
}
