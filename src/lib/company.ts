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

// Ship-to address used on accessory POs. Accessories are bulk-purchased and
// stocked at Ecozen's warehouse before being dispatched to garment factories
// when a cutting report comes in. For now the warehouse mirrors the HQ address;
// update this constant when the physical warehouse location differs.
// TODO: replace with real warehouse address.
export const ECOZEN_WAREHOUSE = {
  legalName: "ECOZEN COMFORTS PRIVATE LIMITED",
  addressLines: [
    "A101, TOWER J,",
    "PLOT A, LODHA EATON SQUARE,",
    "Kolshet Road, Sandoz Baug, Thane - 400607",
  ],
  state: "MAHARASHTRA",
  gstin: "27AAHCE9300P1Z7",
  contactNumber: "9702390879",
} as const;

// PO defaults, hardcoded for v1.
export const PO_DEFAULTS = {
  cgstRate: 0.025,
  sgstRate: 0.025,
  poNumberPrefix: "HYP/PO",
  accessoryPoNumberPrefix: "HYP/APO",
} as const;

export const PO_SIGNATORY = {
  name: "Dhara Somaiya",
  title: "Head of Sourcing",
  queriesEmail: "contact@ecozencomforts.com",
} as const;

// Terms & conditions printed on every PO. v2: client requested only the
// jurisdiction clause for now.
export const PO_TERMS: string[] = [
  "Jurisdiction: This order shall be governed by Indian law and subject to the exclusive jurisdiction of courts at Thane, Maharashtra.",
];

// Legacy export kept for backwards compatibility with any other importer.
export const COMPANY_INFO = {
  name: ECOZEN_HEADER.legalName,
  address: ECOZEN_HEADER.addressLines.join(", "),
  contactInfo: `Contact: ${ECOZEN_HEADER.contactNumber}`,
  gstin: ECOZEN_HEADER.gstin,
};
