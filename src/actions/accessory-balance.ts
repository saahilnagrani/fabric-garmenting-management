"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";
import { accessoryDisplayName } from "@/lib/accessory-display";
import type { AccessoryUnit } from "@/generated/prisma";

export type AccessoryBalanceRow = {
  accessoryId: string;
  displayName: string;
  category: string;
  unit: AccessoryUnit;
  opening: number;
  purchasedInPhase: number;
  dispatchedInPhase: number;
  closing: number;
};

/**
 * Compute opening / purchased / dispatched / closing balance per accessory
 * for a given phase. "Earlier phases" = Phase.number < target.number.
 *
 * No snapshot table — purely derived from the ledger so flipping back to a
 * past phase always reflects current truth.
 */
export async function getAccessoryBalances(phaseId: string): Promise<AccessoryBalanceRow[]> {
  await requirePermission("inventory:accessories:view");

  const targetPhase = await db.phase.findUnique({ where: { id: phaseId } });
  if (!targetPhase) return [];
  const targetNumber = targetPhase.number;

  // Pull all non-archived accessories so SKUs with zero activity still show up.
  const accessories = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false },
    orderBy: [{ category: "asc" }, { baseName: "asc" }, { colour: "asc" }, { size: "asc" }],
  });

  // Pull all transactions in one shot, joined to phase so we can bucket by
  // earlier-vs-this. Volumes are expected to be small enough that in-memory
  // bucketing beats two groupBy queries on cost.
  const [purchases, dispatches] = await Promise.all([
    db.accessoryPurchase.findMany({
      where: { isStrikedThrough: false },
      include: { phase: { select: { number: true } } },
    }),
    db.accessoryDispatch.findMany({
      where: { isStrikedThrough: false },
      include: { phase: { select: { number: true } } },
    }),
  ]);

  type Buckets = { earlier: number; thisPhase: number };
  const purchaseByAccessory = new Map<string, Buckets>();
  const dispatchByAccessory = new Map<string, Buckets>();
  const ensure = (m: Map<string, Buckets>, k: string) => {
    let b = m.get(k);
    if (!b) {
      b = { earlier: 0, thisPhase: 0 };
      m.set(k, b);
    }
    return b;
  };

  for (const p of purchases) {
    const qty = Number(p.quantity);
    const b = ensure(purchaseByAccessory, p.accessoryId);
    if (p.phase.number < targetNumber) b.earlier += qty;
    else if (p.phase.number === targetNumber) b.thisPhase += qty;
  }
  for (const d of dispatches) {
    const qty = Number(d.quantity);
    const b = ensure(dispatchByAccessory, d.accessoryId);
    if (d.phase.number < targetNumber) b.earlier += qty;
    else if (d.phase.number === targetNumber) b.thisPhase += qty;
  }

  return accessories.map((a) => {
    const p = purchaseByAccessory.get(a.id) || { earlier: 0, thisPhase: 0 };
    const d = dispatchByAccessory.get(a.id) || { earlier: 0, thisPhase: 0 };
    const opening = p.earlier - d.earlier;
    const purchasedInPhase = p.thisPhase;
    const dispatchedInPhase = d.thisPhase;
    const closing = opening + purchasedInPhase - dispatchedInPhase;
    return {
      accessoryId: a.id,
      displayName: accessoryDisplayName(a),
      category: a.category,
      unit: a.unit,
      opening,
      purchasedInPhase,
      dispatchedInPhase,
      closing,
    };
  });
}
