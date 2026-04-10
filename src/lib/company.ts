// Buyer (Ecozen Comforts) header block that appears at the top of every
// purchase order. Ecozen is the parent company; Hyperballik is a brand.
// TODO: move to a DB-backed settings table if this ever needs to be editable.
export const ECOZEN_HEADER = {
  legalName: "ECOZEN COMFORTS PRIVATE LIMITED",
  addressLines: [
    "A101, TOWER J,",
    "PLOT A, LODHA EATON SQUARE,",
    "Kolshet Road, Sandoz Baug, Thane - 400607",
  ],
  state: "MAHARASHTRA",
  pan: "AAHCE9300P",
  gstin: "27AAHCE9300P1Z7",
  contactNumber: "9702390879",
} as const;

// PO defaults — hardcoded for v1.
export const PO_DEFAULTS = {
  deliveryDays: 30, // default delivery = PO date + 30 days
  paymentTerms: "30 days from GRN",
  cgstRate: 0.025,
  sgstRate: 0.025,
  poNumberPrefix: "FFA/PO",
} as const;

export const PO_SIGNATORY = {
  name: "Shruti Kriti",
  title: "Head of Sourcing",
  queriesEmail: "sourcing@flexformactive.in",
} as const;

// Terms & conditions printed on every PO, verbatim from the Ecozen template.
export const PO_TERMS: string[] = [
  "Delivery: Goods to be delivered to the buyer's designated warehouse on or before the committed delivery date. Partial deliveries are not accepted without prior written approval.",
  "Packaging: Each roll shall be individually wrapped in LDPE, labelled with fabric code, lot number, GSM, width, and meterage. Maximum 30 kg per roll.",
  "Quality: All fabric must conform to the approved lab-dip and strike-off. Shrinkage within 4%, colour fastness Grade 4 minimum (ISO 105). A pre-shipment inspection by our QA team will be scheduled.",
  "Testing: Supplier shall provide a mill test report for GSM, width, composition, and shrinkage with every lot. Non-conforming lots will be rejected at supplier's cost.",
  "Pricing: Rates are firm and inclusive of dyeing, finishing, and inspection. Taxes extra as applicable.",
  "Payment: 30 days credit from the date of Goods Receipt Note (GRN) and satisfactory QA clearance. Payment via RTGS / NEFT only.",
  "Invoicing: GST invoice shall quote this PO number. E-way bill mandatory for all dispatches.",
  "Penalty: A penalty of 1% per week (max 5%) shall apply for delays beyond the committed delivery date.",
  "Cancellation: Buyer reserves the right to cancel this order in case of material breach, quality failure, or delay beyond 15 days.",
  "Jurisdiction: This order shall be governed by Indian law and subject to the exclusive jurisdiction of courts at Thane, Maharashtra.",
];

// Legacy export kept for backwards compatibility with any other importer.
export const COMPANY_INFO = {
  name: ECOZEN_HEADER.legalName,
  address: ECOZEN_HEADER.addressLines.join(", "),
  contactInfo: `Contact: ${ECOZEN_HEADER.contactNumber}`,
  gstin: ECOZEN_HEADER.gstin,
};
