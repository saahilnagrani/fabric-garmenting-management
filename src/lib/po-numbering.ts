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
 * Width-4 zero-padded by default. If the counter ever exceeds 9999, the
 * number is rendered without padding (HYP/PO/2026-27/10001) — no migration
 * needed and no truncation.
 */
export function formatPoNumber(fiscalYear: string, num: number): string {
  const padded = num < 10000 ? String(num).padStart(4, "0") : String(num);
  return `HYP/PO/${fiscalYear}/${padded}`;
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
