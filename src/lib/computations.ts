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
  garmentsPerKg?: NumberLike;
  fabric2CostPerKg?: NumberLike;
  fabric2GarmentsPerKg?: NumberLike;
}): number {
  const gPerKg = toNum(product.garmentsPerKg);
  const fabricCost = gPerKg > 0 ? toNum(product.fabricCostPerKg) / gPerKg : 0;

  const g2PerKg = toNum(product.fabric2GarmentsPerKg);
  const fabric2Cost =
    g2PerKg > 0 ? toNum(product.fabric2CostPerKg) / g2PerKg : 0;

  return fabricCost + fabric2Cost;
}

export function computeTotalCost(product: Parameters<typeof computeTotalGarmenting>[0] & Parameters<typeof computeFabricCostPerPiece>[0]): number {
  return computeTotalGarmenting(product) + computeFabricCostPerPiece(product);
}

export function computeTotalLandedCost(product: Parameters<typeof computeTotalCost>[0] & {
  inwardShipping?: NumberLike;
}): number {
  return computeTotalCost(product) + toNum(product.inwardShipping);
}

export function computeDealerPrice(mrp: NumberLike): number {
  return toNum(mrp) * 0.5;
}

export function computeProfitMargin(product: Parameters<typeof computeTotalLandedCost>[0] & {
  mrp?: NumberLike;
}): number {
  const dp = computeDealerPrice(product.mrp);
  const landed = computeTotalLandedCost(product);
  return landed > 0 ? (dp - landed) / dp : 0;
}

export function computeTotalSizeCount(product: {
  sizeXS?: NumberLike;
  sizeS?: NumberLike;
  sizeM?: NumberLike;
  sizeL?: NumberLike;
  sizeXL?: NumberLike;
  sizeXXL?: NumberLike;
}): number {
  return [
    product.sizeXS,
    product.sizeS,
    product.sizeM,
    product.sizeL,
    product.sizeXL,
    product.sizeXXL,
  ].reduce((sum: number, s) => sum + toNum(s), 0);
}
