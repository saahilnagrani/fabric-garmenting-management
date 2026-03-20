export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Processing",
  SAMPLE_WITH_ST: "Sample with ST",
  SAMPLE_READY: "Sample Ready",
  READY_AT_GARSEM: "Ready at Garsem",
  READY_AT_MUMTAZ: "Ready at Mumtaz",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",
  SHIPPED: "Shipped",
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  PROCESSING: "bg-yellow-100 text-yellow-800",
  SAMPLE_WITH_ST: "bg-blue-100 text-blue-800",
  SAMPLE_READY: "bg-indigo-100 text-indigo-800",
  READY_AT_GARSEM: "bg-purple-100 text-purple-800",
  READY_AT_MUMTAZ: "bg-purple-100 text-purple-800",
  RECEIVED_AT_WAREHOUSE: "bg-green-100 text-green-800",
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
  FULLY_CONSUMED: "bg-green-100 text-green-800",
  TO_BE_CONSUMED: "bg-yellow-100 text-yellow-800",
  FULLY_INWARDED: "bg-blue-100 text-blue-800",
  PARTIALLY_INWARDED: "bg-orange-100 text-orange-800",
};

export const FABRIC_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT_ORDER: "Draft Order",
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
