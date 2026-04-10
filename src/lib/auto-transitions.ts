import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import type { ProductStatus, FabricOrderStatus } from "@/generated/prisma/client";
import { PRODUCT_STATUS_SEQUENCE, statusRank } from "@/lib/state-machine";

/**
 * Treat these fabric order statuses as "PO has been issued and committed" —
 * i.e. the fabric has been ordered and the article should advance past PLANNED
 * to FABRIC_ORDERED.
 */
const FABRIC_ORDER_COMMITTED: FabricOrderStatus[] = [
  "PO_SENT",
  "PI_RECEIVED",
  "ADVANCE_PAID",
  "PARTIALLY_SHIPPED",
  "DISPATCHED",
  "RECEIVED",
  "FULLY_SETTLED",
];

const FABRIC_ORDER_RECEIVED: FabricOrderStatus[] = ["RECEIVED", "FULLY_SETTLED"];

/**
 * Infers the product's status from hard evidence on the database:
 * - If cutting report yield is entered → at least CUTTING_REPORT_RECEIVED
 * - If all linked fabric orders are RECEIVED/FULLY_SETTLED → at least FABRIC_RECEIVED
 * - If any linked fabric order has had its PO issued → at least FABRIC_ORDERED
 * Returns the highest-evidence status. Caller compares against current and decides
 * whether to advance (never regress).
 */
export async function inferProductStatus(productId: string): Promise<ProductStatus> {
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      fabricOrderLinks: { include: { fabricOrder: { select: { orderStatus: true } } } },
    },
  });
  if (!product) return "PLANNED";

  // Evidence: cutting report yield entered
  const hasCuttingReport =
    product.cuttingReportGarmentsPerKg !== null || product.cuttingReportGarmentsPerKg2 !== null;
  if (hasCuttingReport) return "CUTTING_REPORT_RECEIVED";

  // No fabric orders linked → no automatic advancement beyond PLANNED
  const links = product.fabricOrderLinks;
  if (links.length === 0) return "PLANNED";

  // All linked fabric orders received → FABRIC_RECEIVED
  const allReceived = links.every((l) => FABRIC_ORDER_RECEIVED.includes(l.fabricOrder.orderStatus));
  if (allReceived) return "FABRIC_RECEIVED";

  // Any linked fabric order in committed state → FABRIC_ORDERED
  const anyCommitted = links.some((l) =>
    FABRIC_ORDER_COMMITTED.includes(l.fabricOrder.orderStatus)
  );
  if (anyCommitted) return "FABRIC_ORDERED";

  return "PLANNED";
}

/**
 * Rich result describing an auto-advance event, intended for use in toast notifications.
 */
export type AutoAdvanceResult = {
  productId: string;
  articleNumber: string | null;
  colourOrdered: string;
  oldStatus: ProductStatus;
  newStatus: ProductStatus;
};

/**
 * Compares a product's current status against the inferred status and advances
 * forward if warranted. Never regresses. Returns rich info if changed, else null.
 *
 * @param productId - the product to evaluate
 * @param actor - user id + name (for audit log). Pass null to skip audit logging.
 * @param reason - short string describing why (e.g. "fabric order received")
 */
export async function autoAdvanceProduct(
  productId: string,
  actor: { id: string; name: string } | null,
  reason: string
): Promise<AutoAdvanceResult | null> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { status: true, articleNumber: true, colourOrdered: true },
  });
  if (!product) return null;

  const inferred = await inferProductStatus(productId);
  if (statusRank(inferred) <= statusRank(product.status)) return null;

  await db.product.update({
    where: { id: productId },
    data: { status: inferred, statusChangedAt: new Date() },
  });

  if (actor) {
    logAction(actor.id, actor.name, "UPDATE", "Product", productId, {
      status: { old: product.status, new: `${inferred} (auto: ${reason})` },
    });
  }

  return {
    productId,
    articleNumber: product.articleNumber,
    colourOrdered: product.colourOrdered,
    oldStatus: product.status,
    newStatus: inferred,
  };
}

/**
 * Fetches all products linked to a fabric order and advances each one
 * if the fabric order's new state implies forward movement.
 * Returns rich results for every product that was actually advanced.
 */
export async function autoAdvanceProductsForFabricOrder(
  fabricOrderId: string,
  actor: { id: string; name: string } | null,
  reason: string
): Promise<AutoAdvanceResult[]> {
  const links = await db.productFabricOrder.findMany({
    where: { fabricOrderId },
    select: { productId: true },
  });

  const results: AutoAdvanceResult[] = [];
  for (const link of links) {
    const result = await autoAdvanceProduct(link.productId, actor, reason);
    if (result) results.push(result);
  }
  return results;
}

// Re-export for callers that imported from this module historically.
export { PRODUCT_STATUS_SEQUENCE };
