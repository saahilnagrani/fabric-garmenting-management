import { notFound } from "next/navigation";
import { getProduct } from "@/actions/products";
import { getVendors } from "@/actions/vendors";
import { ProductForm } from "@/components/products/product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const vendors = await getVendors();

  // Convert Decimal fields to numbers for the form
  const formProduct = {
    ...product,
    fabricGsm: product.fabricGsm ? Number(product.fabricGsm) : null,
    fabricCostPerKg: product.fabricCostPerKg ? Number(product.fabricCostPerKg) : null,
    assumedFabricGarmentsPerKg: product.assumedFabricGarmentsPerKg ? Number(product.assumedFabricGarmentsPerKg) : null,
    fabric2CostPerKg: product.fabric2CostPerKg ? Number(product.fabric2CostPerKg) : null,
    assumedFabric2GarmentsPerKg: product.assumedFabric2GarmentsPerKg ? Number(product.assumedFabric2GarmentsPerKg) : null,
    fabricOrderedQuantityKg: product.fabricOrderedQuantityKg ? Number(product.fabricOrderedQuantityKg) : null,
    fabricShippedQuantityKg: product.fabricShippedQuantityKg ? Number(product.fabricShippedQuantityKg) : null,
    stitchingCost: product.stitchingCost ? Number(product.stitchingCost) : null,
    brandLogoCost: product.brandLogoCost ? Number(product.brandLogoCost) : null,
    neckTwillCost: product.neckTwillCost ? Number(product.neckTwillCost) : null,
    reflectorsCost: product.reflectorsCost ? Number(product.reflectorsCost) : null,
    fusingCost: product.fusingCost ? Number(product.fusingCost) : null,
    accessoriesCost: product.accessoriesCost ? Number(product.accessoriesCost) : null,
    brandTagCost: product.brandTagCost ? Number(product.brandTagCost) : null,
    sizeTagCost: product.sizeTagCost ? Number(product.sizeTagCost) : null,
    packagingCost: product.packagingCost ? Number(product.packagingCost) : null,
    outwardShippingCost: product.outwardShippingCost ? Number(product.outwardShippingCost) : null,
    proposedMrp: product.proposedMrp ? Number(product.proposedMrp) : null,
    onlineMrp: product.onlineMrp ? Number(product.onlineMrp) : null,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Edit Product - {product.articleNumber} ({product.colourOrdered})</h1>
      <ProductForm
        vendors={vendors}
        phaseId={product.phaseId}
        product={formProduct as never}
      />
    </div>
  );
}
