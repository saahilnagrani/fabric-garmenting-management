// Alert → destination filter registry.
//
// When a dashboard alert fires, it links to a destination page with an
// `alertFilter` query param. The destination page re-evaluates the same
// predicate server-side so the list always reflects *current* state (not a
// stale snapshot from when the alert was computed).
//
// Adding a new filter:
//  1. Add an entry below with a unique filterId, destination path, and label
//  2. Teach the destination action (getProducts / getFabricOrders / etc.)
//     to honour the filterId
//  3. Reference the filterId in getDashboardAlerts() via buildAlertUrl()

export type ProductAlertFilter =
  | "unshipped"
  | "stale"
  | "unlinked-planned";

export type FabricOrderAlertFilter =
  | "stale"
  | "unlinked";

export type AlertFilterId = ProductAlertFilter | FabricOrderAlertFilter;

export type AlertFilterMeta = {
  /** Short label shown in the filter banner at the top of the page. */
  label: string;
  /** Destination pathname (no query string). */
  destination: "/products" | "/fabric-orders";
};

/**
 * Single source of truth for filter metadata. Keys are scoped to their
 * destination to avoid collisions (products/stale ≠ fabric-orders/stale).
 */
export const PRODUCT_ALERT_FILTERS: Record<ProductAlertFilter, AlertFilterMeta> = {
  unshipped: {
    label: "Unshipped articles in current phase",
    destination: "/products",
  },
  stale: {
    label: "Stale article orders",
    destination: "/products",
  },
  "unlinked-planned": {
    label: "Planned articles with no fabric orders linked",
    destination: "/products",
  },
};

export const FABRIC_ORDER_ALERT_FILTERS: Record<FabricOrderAlertFilter, AlertFilterMeta> = {
  stale: {
    label: "Stale fabric orders",
    destination: "/fabric-orders",
  },
  unlinked: {
    label: "Fabric orders not linked to any article",
    destination: "/fabric-orders",
  },
};

/**
 * Build a URL for an alert to link to. The filter param is scoped by the
 * destination, so the same key ("stale") can mean different things on
 * different pages — each page only parses its own param namespace.
 */
export function buildProductAlertUrl(
  filter: ProductAlertFilter,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams({ alertFilter: filter, ...extra });
  return `/products?${params.toString()}`;
}

export function buildFabricOrderAlertUrl(
  filter: FabricOrderAlertFilter,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams({ alertFilter: filter, ...extra });
  return `/fabric-orders?${params.toString()}`;
}

/**
 * Type guards so page components can validate incoming searchParam strings
 * without crashing on garbage input.
 */
export function isProductAlertFilter(v: unknown): v is ProductAlertFilter {
  return typeof v === "string" && v in PRODUCT_ALERT_FILTERS;
}

export function isFabricOrderAlertFilter(v: unknown): v is FabricOrderAlertFilter {
  return typeof v === "string" && v in FABRIC_ORDER_ALERT_FILTERS;
}
