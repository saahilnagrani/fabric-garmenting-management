/**
 * PROTOTYPE-ONLY synthesis layer.
 *
 * The fabric custody rework introduces tables that don't exist yet:
 * FabricReceipt, GarmenterDispatch, Allocation, Reservation. Until the schema
 * lands, these helpers derive deterministic synthetic events from the real
 * FabricOrder + Product rows already in the DB, so the proto screens can
 * display the new model without touching production data.
 *
 * Everything in here is pure: same input → same output. No side effects.
 * Safe to delete when the real tables exist.
 */

// Structural — matches Prisma Decimal without importing it. Anything with
// toString() works (Decimal, BigInt, string).
type DecimalLike = { toString(): string };
type Num = DecimalLike | number | null | undefined;

const toNum = (v: Num): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v.toString());
};

export type SynthFabricOrder = {
  id: string;
  fabricName: string;
  colour: string;
  vendorName: string;
  orderedKg: number;
  shippedKg: number;
  orderDate: Date | null;
  garmentingAtName: string | null;
};

export type SynthReceipt = {
  id: string;
  fabricOrderId: string;
  date: Date;
  qtyKg: number;
  lotRef: string;
};

export type SynthDispatch = {
  id: string;
  fabricOrderId: string;
  garmenterName: string;
  date: Date;
  qtyKg: number;
};

export type SynthAllocation = {
  id: string;
  fabricOrderId: string;
  productId: string | null; // null when this is a Reservation
  productLabel: string;
  garmenterName: string;
  qtyKg: number;
  consumedKg: number;
  isReservation: boolean;
  reservationPurpose?: string;
};

export type SynthCustody = {
  fabricOrderId: string;
  orderedKg: number;
  receivedKg: number;
  onOrderKg: number;
  inOurHandsKg: number;
  atGarmenterKg: Record<string, number>; // garmenter name → kg
  surplusKg: number; // received − ordered, clamped at 0
  isOverReceived: boolean;
};

const DEMO_OVERRECEIPT_FRACTION = 0.25;

/**
 * Hash a string into a stable integer in [0, mod). Used to make synthesis
 * deterministic (same FO id always produces the same synthetic dates / lots).
 */
function stableHash(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % mod) + mod) % mod;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Synthesize FabricReceipt events for a FabricOrder.
 *
 * Rules:
 * - 0 received → no receipts (purely on-order at vendor)
 * - shipped >= ordered → 1–2 receipts summing to shipped (full receipt)
 * - shipped < ordered → 1–2 receipts summing to shipped (partial receipt)
 * - If `forceOverReceipt` is true, append an extra receipt that pushes total
 *   to ~125% of ordered. Used to demo the surplus flow on one selected FO.
 */
export function synthesizeReceipts(
  fo: SynthFabricOrder,
  opts?: { forceOverReceipt?: boolean }
): SynthReceipt[] {
  const ordered = fo.orderedKg;
  let shipped = fo.shippedKg;
  if (shipped <= 0) return [];

  if (opts?.forceOverReceipt && shipped <= ordered) {
    shipped = Math.round(ordered * (1 + DEMO_OVERRECEIPT_FRACTION) * 10) / 10;
  }

  const baseDate = fo.orderDate ?? new Date();
  const offset = stableHash(fo.id, 14) + 14; // 14–28 days after order
  const splitFraction = (stableHash(fo.id, 60) + 30) / 100; // 0.30–0.90
  const shouldSplit = shipped > 40;

  if (!shouldSplit) {
    return [
      {
        id: `R-${stableHash(fo.id + "1", 9000) + 1000}`,
        fabricOrderId: fo.id,
        date: addDays(baseDate, offset),
        qtyKg: round1(shipped),
        lotRef: `${fo.vendorName.slice(0, 2).toUpperCase()}-${stableHash(fo.id, 99)}`,
      },
    ];
  }

  const first = round1(shipped * splitFraction);
  const second = round1(shipped - first);
  return [
    {
      id: `R-${stableHash(fo.id + "1", 9000) + 1000}`,
      fabricOrderId: fo.id,
      date: addDays(baseDate, offset),
      qtyKg: first,
      lotRef: `${fo.vendorName.slice(0, 2).toUpperCase()}-${stableHash(fo.id, 99)}A`,
    },
    {
      id: `R-${stableHash(fo.id + "2", 9000) + 1000}`,
      fabricOrderId: fo.id,
      date: addDays(baseDate, offset + 14),
      qtyKg: second,
      lotRef: `${fo.vendorName.slice(0, 2).toUpperCase()}-${stableHash(fo.id, 99)}B`,
    },
  ];
}

/**
 * Synthesize GarmenterDispatch events for a FabricOrder.
 *
 * Treats the FO's garmentingAt as a single dispatch destination. If receipts
 * total > 0 and a garmenter is set, mint one dispatch that absorbs all
 * received qty up to (but not exceeding) the originally ordered amount —
 * surplus stays "in our hands". Real model would split across multiple
 * dispatches; this is enough to demo the screens.
 */
export function synthesizeDispatches(
  fo: SynthFabricOrder,
  receipts: SynthReceipt[]
): SynthDispatch[] {
  if (!fo.garmentingAtName || receipts.length === 0) return [];
  const totalReceived = receipts.reduce((s, r) => s + r.qtyKg, 0);
  const dispatchable = Math.min(totalReceived, fo.orderedKg);
  if (dispatchable <= 0) return [];
  const dispatchDate = addDays(receipts[receipts.length - 1].date, 3);
  return [
    {
      id: `D-${stableHash(fo.id, 9000) + 1000}`,
      fabricOrderId: fo.id,
      garmenterName: fo.garmentingAtName,
      date: dispatchDate,
      qtyKg: round1(dispatchable),
    },
  ];
}

/**
 * Synthesize Allocation rows for a FabricOrder.
 *
 * Pulls real Product↔FabricOrder links and treats each as an allocation of
 * the article's `fabricOrderedQuantityKg` against the FO. Uses the real
 * articleNumber from Product when present (falls back to styleNumber).
 * Adds a synthetic Reservation for one out of every ~5 FOs to demo that case.
 */
export function synthesizeAllocations(
  fo: SynthFabricOrder,
  linkedProducts: {
    productId: string;
    articleNumber: string | null;
    styleNumber: string;
    productName: string | null;
    demandKg: number;
  }[],
  dispatches: SynthDispatch[]
): SynthAllocation[] {
  const garmenter = dispatches[0]?.garmenterName ?? fo.garmentingAtName ?? "—";
  const allocations: SynthAllocation[] = linkedProducts.map((p) => {
    const ref = p.articleNumber ?? p.styleNumber;
    const productLabel = p.productName ? `${ref} · ${p.productName}` : ref;
    return {
      id: `ALC-${stableHash(fo.id + p.productId, 90000) + 10000}`,
      fabricOrderId: fo.id,
      productId: p.productId,
      productLabel,
      garmenterName: garmenter,
      qtyKg: round1(p.demandKg),
      consumedKg: round1(p.demandKg * ((stableHash(p.productId, 70) + 10) / 100)), // 10–80% consumed
      isReservation: false,
    };
  });

  if (stableHash(fo.id, 5) === 0 && dispatches.length > 0) {
    const reserveQty = round1(Math.min(20, dispatches[0].qtyKg * 0.1));
    if (reserveQty >= 1) {
      allocations.push({
        id: `RSV-${stableHash(fo.id, 90000) + 10000}`,
        fabricOrderId: fo.id,
        productId: null,
        productLabel: "Sampling reservation",
        garmenterName: garmenter,
        qtyKg: reserveQty,
        consumedKg: 0,
        isReservation: true,
        reservationPurpose: "sampling",
      });
    }
  }

  return allocations;
}

/**
 * Compute the custody breakdown for a FabricOrder, given its receipts,
 * dispatches and allocations. This is the data the new Custody column on
 * the fabric-orders grid renders.
 */
export function computeCustody(
  fo: SynthFabricOrder,
  receipts: SynthReceipt[],
  dispatches: SynthDispatch[]
): SynthCustody {
  const ordered = fo.orderedKg;
  const received = round1(receipts.reduce((s, r) => s + r.qtyKg, 0));

  const atGarmenterKg: Record<string, number> = {};
  let totalDispatched = 0;
  for (const d of dispatches) {
    atGarmenterKg[d.garmenterName] = (atGarmenterKg[d.garmenterName] ?? 0) + d.qtyKg;
    totalDispatched += d.qtyKg;
  }

  const inOurHandsKg = round1(Math.max(0, received - totalDispatched));
  const onOrderKg = round1(Math.max(0, ordered - received));
  const surplusKg = round1(Math.max(0, received - ordered));

  return {
    fabricOrderId: fo.id,
    orderedKg: ordered,
    receivedKg: received,
    onOrderKg,
    inOurHandsKg,
    atGarmenterKg,
    surplusKg,
    isOverReceived: surplusKg > 0,
  };
}

/**
 * Top-level convenience: takes a FabricOrder + its linked products and
 * returns everything the proto screens need for that order.
 *
 * If `real.receipts/dispatches/allocations` arrays are provided and
 * non-empty, those win over synthesis (per-event-type independently).
 * This is how the proto transitions from "all synthesized" to "real where
 * available, synthesized where not."
 */
export function synthesizeFabricOrder(
  fo: SynthFabricOrder,
  linkedProducts: {
    productId: string;
    articleNumber: string | null;
    styleNumber: string;
    productName: string | null;
    demandKg: number;
  }[],
  opts?: {
    forceOverReceipt?: boolean;
    real?: {
      receipts?: SynthReceipt[];
      dispatches?: SynthDispatch[];
      allocations?: SynthAllocation[];
    };
  }
) {
  const receipts = opts?.real?.receipts && opts.real.receipts.length > 0
    ? opts.real.receipts
    : synthesizeReceipts(fo, opts);
  const dispatches = opts?.real?.dispatches && opts.real.dispatches.length > 0
    ? opts.real.dispatches
    : synthesizeDispatches(fo, receipts);
  const allocations = opts?.real?.allocations && opts.real.allocations.length > 0
    ? opts.real.allocations
    : synthesizeAllocations(fo, linkedProducts, dispatches);
  const custody = computeCustody(fo, receipts, dispatches);
  return { fabricOrder: fo, receipts, dispatches, allocations, custody };
}

/**
 * Adapter: turn raw Prisma rows (with receipts, dispatches, allocations
 * relations included) into the SynthReceipt/Dispatch/Allocation shapes.
 */
export function adaptRealCustody(row: {
  id: string;
  receipts: { id: string; qtyKg: DecimalLike; receivedAt: Date; lotRef: string | null }[];
  dispatches: { id: string; qtyKg: DecimalLike; dispatchedAt: Date; garmenter: { name: string } }[];
  allocations: {
    id: string;
    qtyKg: DecimalLike;
    consumedKg: DecimalLike;
    stage: string;
    isReservation: boolean;
    reservationPurpose: string | null;
    productId: string | null;
    product: { articleNumber: string | null; styleNumber: string; productName: string | null } | null;
    garmenter: { name: string } | null;
  }[];
}, fallbackGarmenterName: string | null): { receipts: SynthReceipt[]; dispatches: SynthDispatch[]; allocations: SynthAllocation[] } {
  return {
    receipts: row.receipts.map((r) => ({
      id: r.id,
      fabricOrderId: row.id,
      date: r.receivedAt,
      qtyKg: toNum(r.qtyKg),
      lotRef: r.lotRef ?? "—",
    })),
    dispatches: row.dispatches.map((d) => ({
      id: d.id,
      fabricOrderId: row.id,
      garmenterName: d.garmenter.name,
      date: d.dispatchedAt,
      qtyKg: toNum(d.qtyKg),
    })),
    allocations: row.allocations.map((a) => ({
      id: a.id,
      fabricOrderId: row.id,
      productId: a.productId,
      productLabel: a.isReservation
        ? `Reservation${a.reservationPurpose ? ` · ${a.reservationPurpose}` : ""}`
        : a.product
          ? `${a.product.articleNumber ?? a.product.styleNumber}${a.product.productName ? ` · ${a.product.productName}` : ""}`
          : "—",
      garmenterName: a.garmenter?.name ?? fallbackGarmenterName ?? "—",
      qtyKg: toNum(a.qtyKg),
      consumedKg: toNum(a.consumedKg),
      isReservation: a.isReservation,
      reservationPurpose: a.reservationPurpose ?? undefined,
    })),
  };
}

/**
 * Pick exactly one FabricOrder from a list to be the over-receipt demo.
 * Stable across renders.
 */
export function pickOverReceiptDemoId(orders: { id: string; shippedKg: number; orderedKg: number }[]): string | null {
  // Prefer one that's already partially received and has a vendor; if none
  // qualify, pick the first one with shipped > 0.
  const candidates = orders.filter((o) => o.shippedKg > 0 && o.shippedKg <= o.orderedKg);
  if (candidates.length === 0) return null;
  return candidates[stableHash("over", candidates.length)].id;
}

export type DemoState = "vendor" | "partial" | "full" | "over";

/**
 * Distribute a small number of FabricOrders across the four demo states so
 * the proto screen reads as a worked example even when the live DB has no
 * shipping data yet.
 *
 * Returns a Map keyed by FO id. Orders not in the map should be left at
 * their natural state (whatever shippedKg already says).
 *
 * Sorts input by id internally so the SAME 4 FOs are always picked
 * regardless of how the caller ordered the query. This is critical for
 * cross-screen consistency (a row that's "demo over-receipt" on the fabric
 * orders page is also the over-receipt on garmenters and article orders).
 */
export function pickDemoStates(
  orders: { id: string; orderedKg: number; shippedKg: number }[]
): Map<string, DemoState> {
  const states: DemoState[] = ["full", "partial", "over", "vendor"];
  const candidates = orders
    .filter((o) => o.orderedKg > 0)
    .slice() // don't mutate caller
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, states.length);
  const out = new Map<string, DemoState>();
  candidates.forEach((o, i) => out.set(o.id, states[i]));
  return out;
}

/**
 * Assign FO-NNNN display numbers deterministically across all proto screens.
 *
 * Demo orders come first in fixed state order (over, partial, full, vendor)
 * so FO-0001..FO-0004 are always the demo set. Everything else is then
 * sorted by id ascending so the mapping is identical on every page.
 */
export function assignFoDisplayNumbers(
  orders: { id: string }[],
  demoStates: Map<string, DemoState>
): Map<string, string> {
  const demoOrder: Record<DemoState, number> = { over: 0, partial: 1, full: 2, vendor: 3 };
  const sorted = orders
    .slice()
    .sort((a, b) => {
      const ad = demoStates.get(a.id);
      const bd = demoStates.get(b.id);
      const ai = ad ? demoOrder[ad] : 999;
      const bi = bd ? demoOrder[bd] : 999;
      if (ai !== bi) return ai - bi;
      return a.id.localeCompare(b.id);
    });
  const out = new Map<string, string>();
  sorted.forEach((o, i) => out.set(o.id, `FO-${String(i + 1).padStart(4, "0")}`));
  return out;
}

/**
 * Apply a demo state override to a FabricOrder before synthesizing — the
 * synthesizer is then driven by the overridden shippedKg.
 *   full    → shippedKg = orderedKg
 *   partial → shippedKg = orderedKg * 0.6
 *   over    → shippedKg = orderedKg (then synth adds the +25% as surplus)
 *   vendor  → shippedKg = 0
 */
export function applyDemoState(fo: SynthFabricOrder, state: DemoState | undefined): SynthFabricOrder {
  if (!state) return fo;
  switch (state) {
    case "full":
      return { ...fo, shippedKg: round1(fo.orderedKg) };
    case "partial":
      return { ...fo, shippedKg: round1(fo.orderedKg * 0.6) };
    case "over":
      return { ...fo, shippedKg: round1(fo.orderedKg) };
    case "vendor":
      return { ...fo, shippedKg: 0 };
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const shortId = (id: string) => `AO-${stableHash(id, 9000) + 1000}`;

export const protoNumberFmt = {
  toNum,
  round1,
  shortId,
};

/**
 * Adapter: turn a raw Prisma FabricOrder + relations into the SynthFabricOrder
 * shape used by all the helpers above. Centralizes Decimal conversion.
 */
export function adaptFabricOrder(row: {
  id: string;
  fabricName: string;
  colour: string;
  fabricOrderedQuantityKg: Num;
  fabricShippedQuantityKg: Num;
  orderDate: Date | null;
  fabricVendor: { name: string } | null;
  garmentingAtRef: { name: string } | null;
  garmentingAt: string | null;
}): SynthFabricOrder {
  return {
    id: row.id,
    fabricName: row.fabricName,
    colour: row.colour,
    vendorName: row.fabricVendor?.name ?? "—",
    orderedKg: toNum(row.fabricOrderedQuantityKg),
    shippedKg: toNum(row.fabricShippedQuantityKg),
    orderDate: row.orderDate,
    garmentingAtName: row.garmentingAtRef?.name ?? row.garmentingAt ?? null,
  };
}
