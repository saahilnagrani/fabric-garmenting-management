import { getProductMasters } from "@/actions/product-masters";
import { getProductTypes } from "@/actions/product-types";
import { getFabricNamesMrp } from "@/actions/fabric-masters";
import { ProductMasterGrid } from "@/components/masters/product-master-grid";

export default async function ProductMastersPage() {
  const [masters, types, fabricData] = await Promise.all([
    getProductMasters(),
    getProductTypes(),
    getFabricNamesMrp(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Products Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {masters.length} product templates. These defaults auto-populate when adding products.
        </p>
      </div>
      <ProductMasterGrid
        masters={JSON.parse(JSON.stringify(masters))}
        productTypes={types.map((t) => t.name)}
        fabricData={fabricData}
      />
    </div>
  );
}
