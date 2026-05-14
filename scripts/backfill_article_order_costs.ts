/**
 * Per-article backfill of order costs/MRP from ProductMaster (with PhaseCost override).
 *
 * Usage:
 *   env $(grep -v '^#' .env.local | xargs) npx tsx scripts/backfill_article_order_costs.ts <articleNumber> [statuses]
 *
 * Examples:
 *   ... 1003                              # PLANNED only (default)
 *   ... 1003 PLANNED,IN_PROGRESS          # comma-separated statuses
 *   ... 1003 ALL                          # any status
 *
 * Behavior:
 *  - For each Product order matching articleNumber + status filter:
 *    - Resolve its ProductMaster by skuCode (incl. previousSkuCodes).
 *    - For each cost field, fill the order's column ONLY IF it is currently null.
 *    - Precedence per field: PhaseCost(phaseId, master.id) → ProductMaster default.
 *    - `0` is treated as a real value (overwrites null).
 *  - Prints a per-order diff before applying.
 */
import { db as prisma } from '../src/lib/db';
import { findProductMasterBySkuCode } from '../src/lib/article-history';

/**
 * Each entry: [sourceField on master/PhaseCost, targetField on Product].
 * Most are 1:1; `inwardShipping` on the master maps to `outwardShippingCost`
 * on the order (legacy naming, consistent with `selectProductMaster` in
 * product-order-sheet.tsx).
 */
const COST_FIELD_MAP: Array<[string, string]> = [
  ['stitchingCost', 'stitchingCost'],
  ['brandLogoCost', 'brandLogoCost'],
  ['neckTwillCost', 'neckTwillCost'],
  ['reflectorsCost', 'reflectorsCost'],
  ['fusingCost', 'fusingCost'],
  ['accessoriesCost', 'accessoriesCost'],
  ['brandTagCost', 'brandTagCost'],
  ['sizeTagCost', 'sizeTagCost'],
  ['packagingCost', 'packagingCost'],
  ['fabricCostPerKg', 'fabricCostPerKg'],
  ['fabric2CostPerKg', 'fabric2CostPerKg'],
  ['inwardShipping', 'outwardShippingCost'],
  ['proposedMrp', 'proposedMrp'],
];

const articleNumber = process.argv[2];
const statusArg = (process.argv[3] || 'PLANNED').toUpperCase();
if (!articleNumber) {
  console.error('Usage: ... <articleNumber> [statuses|ALL]');
  process.exit(1);
}

const statusFilter = statusArg === 'ALL' ? undefined : statusArg.split(',').map((s) => s.trim());

(async () => {
  const orders = await prisma.product.findMany({
    where: {
      articleNumber,
      ...(statusFilter ? { status: { in: statusFilter as never[] } } : {}),
    },
    orderBy: { skuCode: 'asc' },
  });
  console.log(`Found ${orders.length} order(s) for article ${articleNumber}` +
    (statusFilter ? ` with status in [${statusFilter.join(', ')}]` : ' (any status)'));

  let updatedOrders = 0;
  for (const order of orders) {
    const master = order.skuCode
      ? ((await findProductMasterBySkuCode(prisma, order.skuCode)) as Record<string, unknown> | null)
      : null;
    if (!master) {
      console.log(`  SKIP order ${order.id} (sku=${order.skuCode}): no master`);
      continue;
    }

    const phaseCost = await prisma.phaseCost.findUnique({
      where: {
        phaseId_entityType_entityId: {
          phaseId: order.phaseId,
          entityType: 'PRODUCT_MASTER',
          entityId: master.id as string,
        },
      },
    });

    const updates: Record<string, unknown> = {};
    const diffLines: string[] = [];
    for (const [src, dst] of COST_FIELD_MAP) {
      const current = (order as unknown as Record<string, unknown>)[dst];
      if (current !== null && current !== undefined) continue; // don't overwrite

      const phaseVal = phaseCost ? (phaseCost as unknown as Record<string, unknown>)[src] : null;
      const masterVal = (master as Record<string, unknown>)[src];
      const chosen = phaseVal ?? masterVal;
      if (chosen === null || chosen === undefined) continue;

      updates[dst] = chosen;
      const srcName = phaseVal != null ? 'PhaseCost' : 'master';
      const fieldLabel = src === dst ? src : `${src}→${dst}`;
      diffLines.push(`    ${fieldLabel}: null -> ${chosen} (from ${srcName})`);
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  ok order ${order.id} (sku=${order.skuCode}): nothing to fill`);
      continue;
    }

    console.log(`  update order ${order.id} (sku=${order.skuCode}, phase=${order.phaseId}):`);
    for (const line of diffLines) console.log(line);
    await prisma.product.update({ where: { id: order.id }, data: updates as never });
    updatedOrders++;
  }

  console.log(`\nDone. Updated ${updatedOrders} order row(s).`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
