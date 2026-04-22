type NumberLike = number | string | boolean | null | undefined | { toNumber?: () => number };

function toNum(val: NumberLike): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object" && val.toNumber) return val.toNumber();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function computeTotalGarmenting(product: {
  stitchingCost?: NumberLike;
  brandLogoCost?: NumberLike;
  neckTwillCost?: NumberLike;
  reflectorsCost?: NumberLike;
  fusingCost?: NumberLike;
  accessoriesCost?: NumberLike;
  brandTagCost?: NumberLike;
  sizeTagCost?: NumberLike;
  packagingCost?: NumberLike;
}): number {
  return [
    product.stitchingCost,
    product.brandLogoCost,
    product.neckTwillCost,
    product.reflectorsCost,
    product.fusingCost,
    product.accessoriesCost,
    product.brandTagCost,
    product.sizeTagCost,
    product.packagingCost,
  ].reduce((sum: number, cost) => sum + toNum(cost), 0);
}

export function computeFabricCostPerPiece(product: {
  fabricCostPerKg?: NumberLike;
  assumedFabricGarmentsPerKg?: NumberLike;
  fabric2CostPerKg?: NumberLike;
  assumedFabric2GarmentsPerKg?: NumberLike;
  fabric3CostPerKg?: NumberLike;
  assumedFabric3GarmentsPerKg?: NumberLike;
  fabric4CostPerKg?: NumberLike;
  assumedFabric4GarmentsPerKg?: NumberLike;
}): number {
  const perFabric = (cost?: NumberLike, gPerKg?: NumberLike) => {
    const g = toNum(gPerKg);
    return g > 0 ? toNum(cost) / g : 0;
  };
  return (
    perFabric(product.fabricCostPerKg, product.assumedFabricGarmentsPerKg) +
    perFabric(product.fabric2CostPerKg, product.assumedFabric2GarmentsPerKg) +
    perFabric(product.fabric3CostPerKg, product.assumedFabric3GarmentsPerKg) +
    perFabric(product.fabric4CostPerKg, product.assumedFabric4GarmentsPerKg)
  );
}

export function computeTotalCost(product: Parameters<typeof computeTotalGarmenting>[0] & Parameters<typeof computeFabricCostPerPiece>[0]): number {
  return computeTotalGarmenting(product) + computeFabricCostPerPiece(product);
}

export function computeTotalLandedCost(product: Parameters<typeof computeTotalCost>[0] & {
  outwardShippingCost?: NumberLike;
}): number {
  return computeTotalCost(product) + toNum(product.outwardShippingCost);
}

export function computeDealerPrice(proposedMrp: NumberLike): number {
  return (toNum(proposedMrp) + 1) / 2;
}

export function computeProfitMargin(product: Parameters<typeof computeTotalLandedCost>[0] & {
  proposedMrp?: NumberLike;
}): number {
  const dp = computeDealerPrice(product.proposedMrp);
  const landed = computeTotalLandedCost(product);
  return landed > 0 ? (dp - landed) / dp : 0;
}

export function computeTotalSizeCount(product: {
  actualStitchedXS?: NumberLike;
  actualStitchedS?: NumberLike;
  actualStitchedM?: NumberLike;
  actualStitchedL?: NumberLike;
  actualStitchedXL?: NumberLike;
  actualStitchedXXL?: NumberLike;
}): number {
  return [
    product.actualStitchedXS,
    product.actualStitchedS,
    product.actualStitchedM,
    product.actualStitchedL,
    product.actualStitchedXL,
    product.actualStitchedXXL,
  ].reduce((sum: number, s) => sum + toNum(s), 0);
}
