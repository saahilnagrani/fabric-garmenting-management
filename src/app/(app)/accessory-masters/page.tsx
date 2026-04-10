import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/feature-flags";
import { getAccessoryMasters, getAccessoryCategories } from "@/actions/accessories";
import { getVendors } from "@/actions/vendors";
import { AccessoryMasterGrid } from "@/components/masters/accessory-master-grid";

export default async function AccessoryMastersPage({
  searchParams,
}: {
  searchParams: Promise<{ showArchived?: string }>;
}) {
  if (!FEATURES.accessories) notFound();

  const params = await searchParams;
  const showArchived = params.showArchived === "true";

  const [masters, vendors, categories] = await Promise.all([
    getAccessoryMasters(showArchived),
    getVendors(),
    getAccessoryCategories(),
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
        <h1 className="text-2xl font-bold">Accessories Master DB</h1>
        <p className="text-sm text-muted-foreground">
          {activeCount} accessories
          {archivedCount > 0 ? ` + ${archivedCount} archived` : ""}. Bulk-create variants by colour and size in one go.
        </p>
      </div>
      <AccessoryMasterGrid
        masters={JSON.parse(JSON.stringify(masters))}
        vendors={vendors}
        categories={categories}
        showArchived={showArchived}
      />
    </div>
  );
}
