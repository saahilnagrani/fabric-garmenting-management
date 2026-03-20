import { getProductMasters } from "@/actions/product-masters";
import { getProductTypes } from "@/actions/product-types";
import { getFabricNamesMrp } from "@/actions/fabric-masters";
import { ProductMasterGrid } from "@/components/masters/product-master-grid";

export default async function ProductMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.showArchived === "true";
  const [masters, types, fabricData] = await Promise.all([
    getProductMasters(showArchived),
    getProductTypes(),
    getFabricNamesMrp(),
  ]);

  const activeCount = showArchived
    ? masters.filter((m) => !m.isStrikedThrough).length
    : masters.length;
  const archivedCount = showArchived
    ? masters.filter((m) => m.isStrikedThrough).length
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">SKU Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} SKU templates{archivedCount > 0 ? ` + ${archivedCount} archived` : ""}. These defaults auto-populate when creating SKU/Style orders.
        </p>
      </div>
      <ProductMasterGrid
        masters={JSON.parse(JSON.stringify(masters))}
        productTypes={types.map((t) => t.name)}
        fabricData={fabricData}
        showArchived={showArchived}
      />
    </div>
  );
}
