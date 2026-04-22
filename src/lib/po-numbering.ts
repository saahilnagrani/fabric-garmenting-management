import { db } from "@/lib/db";

/**
 * Indian fiscal year (April–March), formatted as e.g. "2026-27".
 *
 * April 2026 → March 2027 → "2026-27"
 * March 2026 → "2025-26"
 */
export function currentFiscalYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan, 3 = Apr
  const year = date.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

/**
 * Extract the fiscal year segment ("YYYY-YY") from any PO/DN number shaped
 * like `HYP/<PREFIX>/<FY>/<NUM>`. Returns null if the string doesn't match.
 */
export function fiscalYearFromNumber(num: string): string | null {
  const m = num.match(/\/(\d{4}-\d{2})\//);
  return m ? m[1] : null;
}

/**
 * Width-4 zero-padded by default. If the counter ever exceeds 9999, the
 * number is rendered without padding (HYP/PO/2026-27/10001) — no migration
 * needed and no truncation.
 */
export function formatPoNumber(fiscalYear: string, num: number): string {
  const padded = num < 10000 ? String(num).padStart(4, "0") : String(num);
  return `HYP/FPO/${fiscalYear}/${padded}`;
}

/**
 * Allocate the next PO number for the current fiscal year. Atomic at the
 * counter row level — Prisma's `increment` translates to a SQL UPDATE, so
 * concurrent calls cannot collide.
 *
 * The first allocation in a fresh FY returns 0101.
 */
export async function allocatePoNumber(date: Date = new Date()): Promise<string> {
  const fy = currentFiscalYear(date);
  const counter = await db.poCounter.upsert({
    where: { fiscalYear: fy },
    create: { fiscalYear: fy, lastNumber: 101 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatPoNumber(fy, counter.lastNumber);
}

/**
 * Accessory PO numbering lives on a separate sequence from fabric POs. We
 * reuse the PoCounter table by prefixing the fiscal-year key with "ACC-",
 * and render numbers with the "HYP/APO/" prefix so they're trivially
 * distinguishable from fabric POs in filing and search.
 */
export function formatAccessoryPoNumber(fiscalYear: string, num: number): string {
  const padded = num < 10000 ? String(num).padStart(4, "0") : String(num);
  return `HYP/APO/${fiscalYear}/${padded}`;
}

export async function allocateAccessoryPoNumber(date: Date = new Date()): Promise<string> {
  const fy = currentFiscalYear(date);
  const counterKey = `ACC-${fy}`;
  const counter = await db.poCounter.upsert({
    where: { fiscalYear: counterKey },
    create: { fiscalYear: counterKey, lastNumber: 101 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatAccessoryPoNumber(fy, counter.lastNumber);
}

/**
 * Same semantics as ensurePoNumberForGroup but for AccessoryPurchase rows.
 * Allocates or reuses a single number for the vendor bundle and stamps it
 * onto every row so reprints don't burn a fresh number.
 */
export async function ensurePoNumberForAccessoryGroup(purchaseIds: string[]): Promise<string> {
  if (purchaseIds.length === 0) throw new Error("Cannot allocate PO number for empty group");

  const rows = await db.accessoryPurchase.findMany({
    where: { id: { in: purchaseIds } },
    select: { id: true, poNumber: true },
  });

  const existing = [...new Set(rows.map((r) => r.poNumber).filter((n): n is string => !!n))];

  if (existing.length > 1) {
    throw new Error(
      `These accessory purchases already belong to different POs (${existing.join(", ")}) and cannot be combined into one. Print them separately.`
    );
  }
  if (existing.length === 1) {
    // All rows in this selection must already carry the same PO — otherwise the
    // user is mixing PO'd rows with blank rows, which would silently merge the
    // blanks into the existing PO. Block and ask them to deselect or reprint.
    const withoutPo = rows.filter((r) => !r.poNumber);
    if (withoutPo.length > 0) {
      throw new Error(
        `${withoutPo.length} of the selected row(s) are not part of PO ${existing[0]}. Deselect them, or reprint PO ${existing[0]} on its own.`
      );
    }
    return existing[0];
  }

  const newNumber = await allocateAccessoryPoNumber();
  await db.accessoryPurchase.updateMany({
    where: { id: { in: purchaseIds } },
    data: { poNumber: newNumber },
  });
  return newNumber;
}

/**
 * Dispatch note numbering mirrors accessory POs: separate counter key (DN-{fy})
 * in the shared PoCounter table, and an "HYP/DN/" prefix so the document type
 * is obvious in filing and search.
 */
export function formatDispatchNoteNumber(fiscalYear: string, num: number): string {
  const padded = num < 10000 ? String(num).padStart(4, "0") : String(num);
  return `HYP/ADN/${fiscalYear}/${padded}`;
}

export async function allocateDispatchNoteNumber(date: Date = new Date()): Promise<string> {
  const fy = currentFiscalYear(date);
  const counterKey = `DN-${fy}`;
  const counter = await db.poCounter.upsert({
    where: { fiscalYear: counterKey },
    create: { fiscalYear: counterKey, lastNumber: 101 },
    update: { lastNumber: { increment: 1 } },
  });
  return formatDispatchNoteNumber(fy, counter.lastNumber);
}

/**
 * Same semantics as ensurePoNumberForAccessoryGroup but for AccessoryDispatch
 * rows. Allocates or reuses a single DN number for a dispatch bundle (one
 * destinationGarmenter group). Blocks mixed selections where some rows already
 * carry the DN and others don't.
 */
export async function ensureDnNumberForDispatchGroup(dispatchIds: string[]): Promise<string> {
  if (dispatchIds.length === 0) throw new Error("Cannot allocate DN number for empty group");

  const rows = await db.accessoryDispatch.findMany({
    where: { id: { in: dispatchIds } },
    select: { id: true, dnNumber: true },
  });

  const existing = [...new Set(rows.map((r) => r.dnNumber).filter((n): n is string => !!n))];

  if (existing.length > 1) {
    throw new Error(
      `These dispatches already belong to different DNs (${existing.join(", ")}) and cannot be combined into one. Print them separately.`
    );
  }
  if (existing.length === 1) {
    const withoutDn = rows.filter((r) => !r.dnNumber);
    if (withoutDn.length > 0) {
      throw new Error(
        `${withoutDn.length} of the selected row(s) are not part of DN ${existing[0]}. Deselect them, or reprint DN ${existing[0]} on its own.`
      );
    }
    return existing[0];
  }

  const newNumber = await allocateDispatchNoteNumber();
  await db.accessoryDispatch.updateMany({
    where: { id: { in: dispatchIds } },
    data: { dnNumber: newNumber },
  });
  return newNumber;
}

/**
 * For a batch of fabric orders that will be printed together as a single PO
 * (one vendor group), ensure they all share a single PO number.
 *
 * Behaviour:
 * - If none of the orders have a poNumber yet → allocate a fresh one and stamp
 *   it on every order in the group.
 * - If exactly one distinct poNumber already exists across the group → reuse it.
 * - If multiple distinct poNumbers exist → throw, because the user is trying to
 *   bundle previously-issued POs together, which would collapse two POs into one.
 */
export async function ensurePoNumberForGroup(orderIds: string[]): Promise<string> {
  if (orderIds.length === 0) throw new Error("Cannot allocate PO number for empty group");

  const orders = await db.fabricOrder.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, poNumber: true },
  });

  const existing = [...new Set(orders.map((o) => o.poNumber).filter((n): n is string => !!n))];

  if (existing.length > 1) {
    throw new Error(
      `These fabric orders already belong to different POs (${existing.join(", ")}) and cannot be combined into one. Print them separately.`
    );
  }
  if (existing.length === 1) return existing[0];

  const newNumber = await allocatePoNumber();
  await db.fabricOrder.updateMany({
    where: { id: { in: orderIds } },
    data: { poNumber: newNumber },
  });
  return newNumber;
}
