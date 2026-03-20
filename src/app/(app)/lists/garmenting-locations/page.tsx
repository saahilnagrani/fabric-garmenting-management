import { getGarmentingLocations } from "@/actions/garmenting-locations";
import { db } from "@/lib/db";
import { GarmentingLocationList } from "@/components/lists/garmenting-location-list";

const INITIAL_LOCATIONS = ["Garsem", "Mumtaz"];

export default async function GarmentingLocationsPage() {
  // Seed initial locations if table is empty (direct db call, no revalidatePath during render)
  const count = await db.garmentingLocation.count();
  if (count === 0) {
    await db.garmentingLocation.createMany({
      data: INITIAL_LOCATIONS.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
  const locations = await getGarmentingLocations();

  return (
    <div className="space-y-4 max-w-xs">
      <h1 className="text-2xl font-bold">Garmenting Locations</h1>
      <p className="text-sm text-muted-foreground">
        {locations.length} locations. These appear as options in garmenting location dropdowns.
      </p>
      <GarmentingLocationList locations={locations} />
    </div>
  );
}
