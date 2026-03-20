import { getCurrentPhase } from "@/actions/phases";
import { getProducts } from "@/actions/products";
import { getVendors } from "@/actions/vendors";
import { getProductMasters } from "@/actions/product-masters";
import { getSizeDistributions } from "@/actions/size-distributions";
import { db } from "@/lib/db";
import { ProductGrid } from "@/components/products/product-grid";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; search?: string; vendor?: string; status?: string; gender?: string }>;
}) {
  const params = await searchParams;
  const phase = await getCurrentPhase();
  if (!phase) {
    return <p className="text-muted-foreground">No active phase selected.</p>;
  }

  const tab = params.tab || "all";
  const isRepeat = tab === "new" ? false : tab === "repeat" ? true : undefined;

  // Seed size distributions if table is empty
  const sdCount = await db.sizeDistribution.count();
  if (sdCount === 0) {
    await db.sizeDistribution.createMany({
      data: [
        { size: "XS", percentage: 8, sortOrder: 1 },
        { size: "S", percentage: 13, sortOrder: 2 },
        { size: "M", percentage: 22, sortOrder: 3 },
        { size: "L", percentage: 27, sortOrder: 4 },
        { size: "XL", percentage: 20, sortOrder: 5 },
        { size: "XXL", percentage: 10, sortOrder: 6 },
      ],
      skipDuplicates: true,
    });
  }
  const [products, vendors, productMasters, sizeDistributions] = await Promise.all([
    getProducts(phase.id, {
      isRepeat,
      search: params.search || undefined,
      fabricVendorId: params.vendor || undefined,
      status: params.status as never,
      gender: params.gender as never,
    }),
    getVendors(),
    getProductMasters(),
    getSizeDistributions(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">SKU/Style Orders</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} products in Phase {phase.number} - {phase.name}
        </p>
      </div>
      <ProductGrid
        products={JSON.parse(JSON.stringify(products))}
        vendors={vendors}
        currentTab={tab}
        phaseId={phase.id}
        productMasters={JSON.parse(JSON.stringify(productMasters))}
        sizeDistributions={sizeDistributions.map((d) => ({ size: d.size, percentage: d.percentage }))}
      />
    </div>
  );
}
