import type { ProductStatus } from "@/generated/prisma/client";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";

/**
 * Ordered state sequence. Higher rank = further along the pipeline.
 * Shared with auto-transitions.
 *
 * Note: QC_FAILED is intentionally NOT in the linear sequence — it's a side-state
 * reachable from QC_IN_PROGRESS that doesn't progress past itself. The state UI
 * picker treats it as an explicit user choice rather than a "next" step.
 */
export const PRODUCT_STATUS_SEQUENCE: ProductStatus[] = [
  "PLANNED",
  "FABRIC_ORDERED",
  "FABRIC_RECEIVED",
  "CUTTING_IN_PROGRESS",
  "CUTTING_COMPLETED",
  "CUTTING_REPORT_RECEIVED",
  "STITCHING_IN_PROGRESS",
  "STITCHING_COMPLETED",
  "TRIMS_ACCESSORIES_ATTACHED",
  "QC_IN_PROGRESS",
  "QC_APPROVED",
  "PACKAGING_IN_PROGRESS",
  "PACKAGING_COMPLETED",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "RECEIVED_AT_WAREHOUSE",
  "SHIPPED",
  "DELIVERED",
];

export function statusRank(status: ProductStatus): number {
  // QC_FAILED treated as same rank as QC_IN_PROGRESS for ordering checks.
  if (status === "QC_FAILED") return PRODUCT_STATUS_SEQUENCE.indexOf("QC_IN_PROGRESS");
  return PRODUCT_STATUS_SEQUENCE.indexOf(status);
}

/**
 * All product statuses are valid for any product. (Repeat-vs-new no longer matters
 * since SAMPLING was removed — sampling is handled by a separate flow.)
 */
export function isStatusAllowedForProduct(
  _status: ProductStatus,
  _product: { isRepeat: boolean }
): boolean {
  return true;
}

/**
 * Validates a requested status change. Returns null if valid, or an error message string
 * if the transition should be rejected.
 *
 * Rules:
 *   1. Same status → no-op (allowed)
 *   2. Forward-only by default (cannot regress)
 *   3. QC_FAILED can be entered from QC_IN_PROGRESS, and from QC_FAILED you can re-enter
 *      STITCHING_IN_PROGRESS to rework (treated as a controlled regression).
 */
export function validateStatusTransition(
  product: { status: ProductStatus; isRepeat: boolean },
  newStatus: ProductStatus
): string | null {
  if (newStatus === product.status) return null;

  // Allow QC_FAILED → STITCHING_IN_PROGRESS (rework path)
  if (product.status === "QC_FAILED" && newStatus === "STITCHING_IN_PROGRESS") return null;

  if (statusRank(newStatus) < statusRank(product.status)) {
    return `Cannot regress from ${PRODUCT_STATUS_LABELS[product.status]} to ${PRODUCT_STATUS_LABELS[newStatus]}. Status changes must move forward through the pipeline.`;
  }

  return null;
}

/**
 * Returns the list of statuses a user may select for a given product.
 * Excludes statuses that would regress.
 */
export function allowedStatusesForProduct(product: {
  status: ProductStatus;
  isRepeat: boolean;
}): ProductStatus[] {
  const currentRank = statusRank(product.status);
  const linear = PRODUCT_STATUS_SEQUENCE.filter((s) => statusRank(s) >= currentRank);

  // QC_FAILED is reachable from any QC stage forward; the rework regression to
  // STITCHING_IN_PROGRESS is allowed only when currently in QC_FAILED.
  const extras: ProductStatus[] = [];
  if (
    product.status === "QC_IN_PROGRESS" ||
    product.status === "QC_APPROVED" ||
    product.status === "TRIMS_ACCESSORIES_ATTACHED"
  ) {
    extras.push("QC_FAILED");
  }
  if (product.status === "QC_FAILED") {
    extras.push("STITCHING_IN_PROGRESS");
  }

  return [...linear, ...extras];
}
