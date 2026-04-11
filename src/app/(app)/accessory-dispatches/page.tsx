import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/feature-flags";
import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import { getAccessoryDispatches } from "@/actions/accessory-dispatches";
import { getAccessoryMasters } from "@/actions/accessories";
import { getProducts } from "@/actions/products";
import { getGarmentingLocations } from "@/actions/garmenting-locations";
import { getVendors } from "@/actions/vendors";
import { AccessoryDispatchGrid } from "@/components/accessories/accessory-dispatch-grid";

export default async function AccessoryDispatchesPage() {
  if (!FEATURES.accessories) notFound();

  const phase = await getCurrentPhase();
  if (!phase) return <p className="text-muted-foreground">No active phase selected.</p>;

  const [dispatches, accessories, products, garmenterLocations, vendors] = await Promise.all([
    getAccessoryDispatches(phase.id),
    getAccessoryMasters(),
    getProducts(phase.id),
    getGarmentingLocations(),
    getVendors(),
  ]);

  const accessoryOptions = accessories.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    category: a.category,
    unit: a.unit,
  }));

  // Garmenter list = GarmentingLocation names ∪ Vendor names of type GARMENTING.
  const garmenterSet = new Set<string>();
  for (const g of garmenterLocations) garmenterSet.add(g.name);
  for (const v of vendors) {
    if (v.type === "GARMENTING") garmenterSet.add(v.name);
  }
  const garmenters = Array.from(garmenterSet).sort();

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.articleNumber || p.styleNumber} / ${p.colourOrdered}${
      p.productName ? ` — ${p.productName}` : ""
    }`,
  }));

  // Build a map { accessoryId → productId[] } so the dispatch sheet can
  // filter the Linked Product dropdown to only products whose ProductMaster
  // actually has a BOM line for the selected accessory.
  //
  // Product → ProductMaster matching: prefer skuCode, fall back to
  // (styleNumber, articleNumber). A Product has no direct FK to
  // ProductMaster, so we resolve it by business key.
  const allMastersWithBom = await db.productMaster.findMany({
    where: { isStrikedThrough: false },
    select: {
      id: true,
      skuCode: true,
      styleNumber: true,
      articleNumber: true,
      accessoryLinks: { select: { accessoryId: true } },
    },
  });
  const masterBySkuCode = new Map<string, { id: string; accessoryIds: Set<string> }>();
  const masterByStyleArticle = new Map<string, { id: string; accessoryIds: Set<string> }>();
  for (const m of allMastersWithBom) {
    const accessoryIds = new Set(m.accessoryLinks.map((l) => l.accessoryId));
    const info = { id: m.id, accessoryIds };
    if (m.skuCode) masterBySkuCode.set(m.skuCode, info);
    const styleKey = `${m.styleNumber}::${m.articleNumber || ""}`;
    masterByStyleArticle.set(styleKey, info);
  }
  const productsByAccessory: Record<string, string[]> = {};
  for (const p of products) {
    const master =
      (p.skuCode ? masterBySkuCode.get(p.skuCode) : undefined) ||
      masterByStyleArticle.get(`${p.styleNumber}::${p.articleNumber || ""}`);
    if (!master) continue;
    for (const accessoryId of master.accessoryIds) {
      if (!productsByAccessory[accessoryId]) productsByAccessory[accessoryId] = [];
      productsByAccessory[accessoryId].push(p.id);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Accessory Dispatches</h1>
        <p className="text-sm text-muted-foreground">
          {dispatches.length} dispatches in Phase {phase.number} - {phase.name}
        </p>
      </div>
      <AccessoryDispatchGrid
        dispatches={JSON.parse(JSON.stringify(dispatches))}
        phaseId={phase.id}
        accessories={accessoryOptions}
        garmenters={garmenters}
        products={productOptions}
        productsByAccessory={productsByAccessory}
      />
    </div>
  );
}
