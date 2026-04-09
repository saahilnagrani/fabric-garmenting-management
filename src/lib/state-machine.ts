import type { ProductStatus } from "@/generated/prisma/client";
import { PRODUCT_STATUS_LABELS } from "@/lib/constants";

/**
 * Ordered state sequence. Higher rank = further along the pipeline.
 * Shared with auto-transitions.
 */
export const PRODUCT_STATUS_SEQUENCE: ProductStatus[] = [
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

export function statusRank(status: ProductStatus): number {
  return PRODUCT_STATUS_SEQUENCE.indexOf(status);
}

/**
 * Returns true if the status is valid for the given product, considering repeat flag.
 * Repeat articles skip the SAMPLING stage entirely (no sample is requested since the
 * pattern is already proven from a prior phase).
 */
export function isStatusAllowedForProduct(
  status: ProductStatus,
  product: { isRepeat: boolean }
): boolean {
  if (product.isRepeat && status === "SAMPLING") return false;
  return true;
}

/**
 * Validates a requested status change. Returns null if valid, or an error message string
 * if the transition should be rejected.
 *
 * Rules:
 *   1. Same status → no-op (allowed)
 *   2. Repeat article cannot be in SAMPLING status
 *   3. Forward-only by default (cannot regress)
 */
export function validateStatusTransition(
  product: { status: ProductStatus; isRepeat: boolean },
  newStatus: ProductStatus
): string | null {
  if (newStatus === product.status) return null;

  if (!isStatusAllowedForProduct(newStatus, product)) {
    return `Repeat articles skip the ${PRODUCT_STATUS_LABELS[newStatus]} stage. Move directly to the next stage.`;
  }

  if (statusRank(newStatus) < statusRank(product.status)) {
    return `Cannot regress from ${PRODUCT_STATUS_LABELS[product.status]} to ${PRODUCT_STATUS_LABELS[newStatus]}. Status changes must move forward through the pipeline.`;
  }

  return null;
}

/**
 * Returns the list of statuses a user may select for a given product.
 * Excludes statuses that would regress AND statuses disallowed by business rules
 * (e.g. SAMPLING for repeat articles).
 */
export function allowedStatusesForProduct(product: {
  status: ProductStatus;
  isRepeat: boolean;
}): ProductStatus[] {
  const currentRank = statusRank(product.status);
  return PRODUCT_STATUS_SEQUENCE.filter((s) => {
    if (statusRank(s) < currentRank) return false;
    if (!isStatusAllowedForProduct(s, product)) return false;
    return true;
  });
}
