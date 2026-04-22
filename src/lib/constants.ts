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

// Each entry pairs a light-mode bg+text with a dark-mode override so status
// chips stay legible in both themes. Dark variants use the 900/30 + 200 pattern
// for subtle fill with readable text on a dark canvas.
export const PRODUCT_STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200",
  FABRIC_ORDERED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  FABRIC_RECEIVED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  CUTTING_IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  CUTTING_COMPLETED: "bg-orange-200 text-orange-900 dark:bg-orange-800/50 dark:text-orange-100",
  CUTTING_REPORT_RECEIVED: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  STITCHING_IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  STITCHING_COMPLETED: "bg-sky-200 text-sky-900 dark:bg-sky-800/50 dark:text-sky-100",
  TRIMS_ACCESSORIES_ATTACHED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  QC_IN_PROGRESS: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
  QC_APPROVED: "bg-violet-200 text-violet-900 dark:bg-violet-800/50 dark:text-violet-100",
  QC_FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  PACKAGING_IN_PROGRESS: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  PACKAGING_COMPLETED: "bg-fuchsia-200 text-fuchsia-900 dark:bg-fuchsia-800/50 dark:text-fuchsia-100",
  READY_FOR_DISPATCH: "bg-stone-200 text-stone-800 dark:bg-stone-700/60 dark:text-stone-200",
  DISPATCHED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  RECEIVED_AT_WAREHOUSE: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  SHIPPED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  DELIVERED: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-100",
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
  PACKAGING: "Packaging",
  INLAY_PRINTING: "Inlay Printing",
  REFLECTORS: "Reflectors",
  OFFICE: "Office",
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
  FULLY_CONSUMED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  TO_BE_CONSUMED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  FULLY_INWARDED: "bg-stone-200 text-stone-800 dark:bg-stone-700/60 dark:text-stone-200",
  PARTIALLY_INWARDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
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
  DRAFT_ORDER: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200",
  PO_SENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  PI_RECEIVED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  ADVANCE_PAID: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  PARTIALLY_SHIPPED: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  DISPATCHED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  RECEIVED: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-200",
  FULLY_SETTLED: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-100",
};

export const DELIVERY_LOCATIONS = [
  "Garsem",
  "Mumtaz",
  "Delhi",
  "Hyperballik Office",
] as const;
