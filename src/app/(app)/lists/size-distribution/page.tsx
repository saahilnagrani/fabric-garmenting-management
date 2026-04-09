import { getSizeDistributions, seedSizeDistributions } from "@/actions/size-distributions";
import { SizeDistributionList } from "@/components/lists/size-distribution-list";

export default async function SizeDistributionPage() {
  // Seed default size distributions if table is empty
  await seedSizeDistributions();
  const distributions = await getSizeDistributions();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Size Distribution</h1>
      <p className="text-sm text-muted-foreground">
        Set the percentage distribution for each size. These percentages are used
        to calculate expected quantities per size from the total expected quantity
        in Article Orders. Percentages must add up to 100%.
      </p>
      <SizeDistributionList distributions={distributions} />
    </div>
  );
}
