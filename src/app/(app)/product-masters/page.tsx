import { getProductMastersGrouped } from "@/actions/product-masters";
import { getProductTypes } from "@/actions/product-types";
import { getFabricNamesMrp } from "@/actions/fabric-masters";
import { getColours } from "@/actions/colours";
import { getPhases } from "@/actions/phases";
import { getAccessoryMasters } from "@/actions/accessories";
import { getGarmentingLocations } from "@/actions/garmenting-locations";
import { ProductMasterGrid } from "@/components/masters/product-master-grid";
import { FEATURES } from "@/lib/feature-flags";
import { accessoryDisplayName } from "@/lib/accessory-display";

export default async function ProductMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.showArchived === "true";
  const [groupedMasters, types, fabricData, colourRecords, phases, accessoryRows, garmentingLocationRecords] = await Promise.all([
    getProductMastersGrouped(showArchived),
    getProductTypes(),
    getFabricNamesMrp(),
    getColours(),
    getPhases(),
    FEATURES.accessories ? getAccessoryMasters() : Promise.resolve([]),
    getGarmentingLocations(),
  ]);
  const garmentingLocations = garmentingLocationRecords.map((l) => l.name);
  const accessoryOptions = accessoryRows.map((a) => ({
    id: a.id,
    label: accessoryDisplayName(a),
    unit: a.unit,
  }));
  const colourNames = colourRecords.map((c) => c.name);
  const coloursWithCode = colourRecords.map((c) => ({ name: c.name, code: c.code }));
  const productTypesWithCode = types.map((t) => ({ name: t.name, code: t.code }));

  const activeCount = groupedMasters.filter((m) => !m.isStrikedThrough).length;
  const totalSkus = groupedMasters.reduce((sum, m) => sum + m.skuCount, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Article Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} articles, {totalSkus} total variants. Grouped by article #.
        </p>
      </div>
      <ProductMasterGrid
        groupedMasters={groupedMasters}
        productTypes={types.map((t) => t.name)}
        productTypesWithCode={productTypesWithCode}
        fabricData={fabricData}
        colours={colourNames}
        coloursWithCode={coloursWithCode}
        phases={phases.map((p) => ({ id: p.id, name: p.name, number: p.number }))}
        accessories={accessoryOptions}
        garmentingLocations={garmentingLocations}
        showArchived={showArchived}
      />
    </div>
  );
}
