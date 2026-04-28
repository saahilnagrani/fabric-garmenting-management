import { getCurrentPhase } from "@/actions/phases";
import { getProducts, getProductsCountForPhase, getPreviousPhaseProfitMarginsByArticle } from "@/actions/products";
import { getVendors } from "@/actions/vendors";
import { getProductMasters } from "@/actions/product-masters";
import { getFabricMasters } from "@/actions/fabric-masters";
import { getSizeDistributions } from "@/actions/size-distributions";
import { ProductGrid } from "@/components/products/product-grid";
import { AlertFilterBanner } from "@/components/dashboard/alert-filter-banner";
import {
  isProductAlertFilter,
  PRODUCT_ALERT_FILTERS,
} from "@/lib/alert-filters";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    vendor?: string;
    status?: string;
    gender?: string;
    alertFilter?: string;
  }>;
}) {
  const params = await searchParams;
  const phase = await getCurrentPhase();
  if (!phase) {
    return <p className="text-muted-foreground">No active phase selected.</p>;
  }

  const tab = params.tab || "all";
  const isRepeat = tab === "new" ? false : tab === "repeat" ? true : undefined;

  const alertFilter = isProductAlertFilter(params.alertFilter) ? params.alertFilter : undefined;

  const [products, vendors, productMasters, fabricMasters, sizeDistributions, totalCount, lastPhaseMargins] = await Promise.all([
    getProducts(phase.id, {
      isRepeat,
      search: params.search || undefined,
      fabricVendorId: params.vendor || undefined,
      status: params.status as never,
      gender: params.gender as never,
      alertFilter,
    }),
    getVendors(),
    getProductMasters(),
    getFabricMasters(),
    getSizeDistributions(),
    alertFilter ? getProductsCountForPhase(phase.id) : Promise.resolve(0),
    getPreviousPhaseProfitMarginsByArticle(phase.id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Article Orders</h1>
        <p className="text-sm text-muted-foreground">
          {products.length} products in Phase {phase.number} - {phase.name}
        </p>
      </div>
      {alertFilter && (
        <AlertFilterBanner
          label={PRODUCT_ALERT_FILTERS[alertFilter].label}
          filteredCount={products.length}
          totalCount={totalCount}
        />
      )}
      <ProductGrid
        products={JSON.parse(JSON.stringify(products))}
        vendors={vendors}
        currentTab={tab}
        phaseId={phase.id}
        productMasters={JSON.parse(JSON.stringify(productMasters))}
        fabricMasters={JSON.parse(JSON.stringify(fabricMasters))}
        sizeDistributions={sizeDistributions.map((d) => ({ size: d.size, percentage: d.percentage }))}
        lastPhaseMargins={lastPhaseMargins}
      />
    </div>
  );
}
