import { db } from "@/lib/db";
import { logAction } from "@/lib/audit";
import type { ProductStatus, FabricOrderStatus } from "@/generated/prisma/client";

/**
 * Ordered state machine. Higher index = further along.
 * Auto-transitions only move FORWARD — never regress.
 */
const PRODUCT_STATUS_ORDER: ProductStatus[] = [
  "PLANNED",
  "FABRIC_ORDERED",
  "FABRIC_RECEIVED",
  "SAMPLING",
  "CUTTING_REPORT",
  "IN_PRODUCTION",
  "READY_AT_GARMENTER",
  "SHIPPED_TO_WAREHOUSE",
  "RECEIVED_AT_WAREHOUSE",
  "SHIPPED",
];

function rank(status: ProductStatus): number {
  return PRODUCT_STATUS_ORDER.indexOf(status);
}

/**
 * Treat these fabric order statuses as "past the vendor discussion stage" —
 * i.e. the fabric has been committed/ordered and the article should advance past PLANNED.
 */
const FABRIC_ORDER_COMMITTED: FabricOrderStatus[] = [
  "ORDERED",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "RECEIVED",
];

/**
 * Infers the product's status from hard evidence on the database:
 * - If cutting report yield is entered → at least CUTTING_REPORT
 * - If all linked fabric orders are RECEIVED → at least FABRIC_RECEIVED
 * - If any linked fabric order is in a committed status → at least FABRIC_ORDERED
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
  if (hasCuttingReport) return "CUTTING_REPORT";

  // No fabric orders linked → no automatic advancement beyond PLANNED
  const links = product.fabricOrderLinks;
  if (links.length === 0) return "PLANNED";

  // All linked fabric orders received → FABRIC_RECEIVED
  const allReceived = links.every((l) => l.fabricOrder.orderStatus === "RECEIVED");
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
  if (rank(inferred) <= rank(product.status)) return null;

  await db.product.update({
    where: { id: productId },
    data: { status: inferred },
  });

  if (actor) {
    logAction(actor.id, actor.name, "UPDATE", "Product", productId, {
      status: { old: product.status, new: inferred, autoAdvanceReason: reason },
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
