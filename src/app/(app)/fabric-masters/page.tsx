import { getFabricMasters } from "@/actions/fabric-masters";
import { getVendors } from "@/actions/vendors";
import { getColours } from "@/actions/colours";
import { getPhases } from "@/actions/phases";
import { FabricMasterGrid } from "@/components/masters/fabric-master-grid";

export default async function FabricMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.showArchived === "true";
  const [masters, vendors, colourRecords, phases] = await Promise.all([
    getFabricMasters(showArchived),
    getVendors(),
    getColours(),
    getPhases(),
  ]);
  const colourNames = colourRecords.map((c) => c.name);

  const activeCount = showArchived
    ? masters.filter((m) => !m.isStrikedThrough).length
    : masters.length;
  const archivedCount = showArchived
    ? masters.filter((m) => m.isStrikedThrough).length
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabrics Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} fabrics{archivedCount > 0 ? ` + ${archivedCount} archived` : ""}. These defaults auto-populate when adding fabric orders.
        </p>
      </div>
      <FabricMasterGrid
        masters={JSON.parse(JSON.stringify(masters))}
        vendors={vendors}
        colours={colourNames}
        phases={phases.map((p) => ({ id: p.id, name: p.name, number: p.number }))}
        showArchived={showArchived}
      />
    </div>
  );
}
