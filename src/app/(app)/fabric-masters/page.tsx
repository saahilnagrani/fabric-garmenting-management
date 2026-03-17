import { getFabricMasters } from "@/actions/fabric-masters";
import { getVendors } from "@/actions/vendors";
import { FabricMasterGrid } from "@/components/masters/fabric-master-grid";

export default async function FabricMastersPage() {
  const [masters, vendors] = await Promise.all([getFabricMasters(), getVendors()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabrics Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {masters.length} fabrics. These defaults auto-populate when adding fabric orders.
        </p>
      </div>
      <FabricMasterGrid masters={JSON.parse(JSON.stringify(masters))} vendors={vendors} />
    </div>
  );
}
