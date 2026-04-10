export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  FABRIC_ORDERED: "Fabric Ordered",
  FABRIC_RECEIVED: "Fabric Received",
  CUTTING_IN_PROGRESS: "Cutting in Progress",
  CUTTING_COMPLETED: "Cutting Completed",
  CUTTING_REPORT_RECEIVED: "Cutting Report Received",
  STITCHING_IN_PROGRESS: "Stitching in Progress",
  STITCHING_COMPLETED: "Stitching Completed",
  TRIMS_ACCESSORIES_ATTACHED: "Trims & Accessories Attached",
  QC_IN_PROGRESS: "Quality Check in Progress",
  QC_APPROVED: "Quality Approved",
  QC_FAILED: "QC Failed / Rework",
  PACKAGING_IN_PROGRESS: "Packaging in Progress",
  PACKAGING_COMPLETED: "Packaging Completed",
  READY_FOR_DISPATCH: "Ready for Dispatch",
  DISPATCHED: "Dispatched",
  RECEIVED_AT_WAREHOUSE: "Received at Warehouse",
  SHIPPED: "Shipped to Customer",
  DELIVERED: "Delivered",
};

export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-800",
  FABRIC_ORDERED: "bg-amber-100 text-amber-800",
  FABRIC_RECEIVED: "bg-yellow-100 text-yellow-800",
  CUTTING_IN_PROGRESS: "bg-orange-100 text-orange-800",
  CUTTING_COMPLETED: "bg-orange-200 text-orange-900",
  CUTTING_REPORT_RECEIVED: "bg-rose-100 text-rose-800",
  STITCHING_IN_PROGRESS: "bg-sky-100 text-sky-800",
  STITCHING_COMPLETED: "bg-sky-200 text-sky-900",
  TRIMS_ACCESSORIES_ATTACHED: "bg-cyan-100 text-cyan-800",
  QC_IN_PROGRESS: "bg-purple-100 text-purple-800",
  QC_APPROVED: "bg-violet-200 text-violet-900",
  QC_FAILED: "bg-red-100 text-red-800",
  PACKAGING_IN_PROGRESS: "bg-fuchsia-100 text-fuchsia-800",
  PACKAGING_COMPLETED: "bg-fuchsia-200 text-fuchsia-900",
  READY_FOR_DISPATCH: "bg-stone-200 text-stone-800",
  DISPATCHED: "bg-indigo-100 text-indigo-800",
  RECEIVED_AT_WAREHOUSE: "bg-lime-100 text-lime-800",
  SHIPPED: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-emerald-200 text-emerald-900",
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
  DRAFT_ORDER: "Draft",
  PO_SENT: "PO Sent",
  PI_RECEIVED: "PI Received",
  ADVANCE_PAID: "Advance Paid",
  PARTIALLY_SHIPPED: "Partially Shipped",
  DISPATCHED: "Dispatched",
  RECEIVED: "Received",
  FULLY_SETTLED: "Fully Settled",
};

export const FABRIC_ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT_ORDER: "bg-slate-100 text-slate-800",
  PO_SENT: "bg-amber-100 text-amber-800",
  PI_RECEIVED: "bg-yellow-100 text-yellow-800",
  ADVANCE_PAID: "bg-orange-100 text-orange-800",
  PARTIALLY_SHIPPED: "bg-sky-100 text-sky-800",
  DISPATCHED: "bg-indigo-100 text-indigo-800",
  RECEIVED: "bg-lime-100 text-lime-800",
  FULLY_SETTLED: "bg-emerald-200 text-emerald-900",
};

export const DELIVERY_LOCATIONS = [
  "Garsem",
  "Mumtaz",
  "Delhi",
  "Hyperballik Office",
] as const;
