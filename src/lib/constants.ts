export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  FABRIC_ORDERED: "Fabric Ordered",
  FABRIC_RECEIVED: "Fabric Received",
  SAMPLING: "Sampling",
  CUTTING_REPORT: "Cutting Report",
  IN_PRODUCTION: "In Production",
  READY_AT_GARMENTER: "Ready at Garmenter",
  SHIPPED_TO_WAREHOUSE: "Shipped to Warehouse",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",
  SHIPPED: "Shipped to Customer",
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-800",
  FABRIC_ORDERED: "bg-amber-100 text-amber-800",
  FABRIC_RECEIVED: "bg-yellow-100 text-yellow-800",
  SAMPLING: "bg-orange-100 text-orange-800",
  CUTTING_REPORT: "bg-rose-100 text-rose-800",
  IN_PRODUCTION: "bg-sky-100 text-sky-800",
  READY_AT_GARMENTER: "bg-stone-200 text-stone-800",
  SHIPPED_TO_WAREHOUSE: "bg-indigo-100 text-indigo-800",
  RECEIVED_AT_WAREHOUSE: "bg-lime-100 text-lime-800",
  SHIPPED: "bg-emerald-100 text-emerald-800",
};

export const GENDER_LABELS: Record<string, string> = {
  MENS: "Mens",
  WOMENS: "Womens",
  KIDS: "Kids",
};

export const VENDOR_TYPE_LABELS: Record<string, string> = {
  FABRIC_SUPPLIER: "Fabric Supplier",
  GARMENTING: "Garmenting",
  ACCESSORIES: "Accessories",
  BRAND_TAG: "Brand Tag",
  OTHER: "Other",
};

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  FABRIC_VENDOR: "Fabric Vendor",
  GARMENTING: "Garmenting",
  BRAND_TAG: "Brand Tag",
  ACCESSORIES: "Accessories",
  SHIPPING: "Shipping",
  PACKAGING: "Packaging",
  OTHER: "Other",
};

export const FABRIC_STATUS_LABELS: Record<string, string> = {
  FULLY_CONSUMED: "Fully Consumed",
  TO_BE_CONSUMED: "To Be Consumed",
  FULLY_INWARDED: "Fully Inwarded",
  PARTIALLY_INWARDED: "Partially Inwarded",
};

export const FABRIC_STATUS_COLORS: Record<string, string> = {
  FULLY_CONSUMED: "bg-emerald-100 text-emerald-800",
  TO_BE_CONSUMED: "bg-amber-100 text-amber-800",
  FULLY_INWARDED: "bg-stone-200 text-stone-800",
  PARTIALLY_INWARDED: "bg-orange-100 text-orange-800",
};

export const FABRIC_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT_ORDER: "Draft Order",
  DISCUSSED_WITH_VENDOR: "Discussed with Vendor",
  ORDERED: "Ordered",
  PARTIALLY_SHIPPED: "Partially Shipped",
  SHIPPED: "Shipped",
  RECEIVED: "Received",
};

export const DELIVERY_LOCATIONS = [
  "Garsem",
  "Mumtaz",
  "Delhi",
  "Hyperballik Office",
] as const;
