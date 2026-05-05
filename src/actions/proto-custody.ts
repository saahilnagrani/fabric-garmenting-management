"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Proto-custody server actions: writes to the new fabric custody tables.
 *
 * Every write that creates DB rows is gated by Phase.isTestPhase. If the
 * current phase is not flagged as a test phase, the action throws. This is
 * the safety mechanism that keeps live phases (Phase 4) untouchable while
 * the proto is being validated.
 *
 * Stage transitions on Allocation are FIFO and non-splitting: a receipt of
 * 30kg promotes the first 30kg-worth of AT_VENDOR allocations to
 * IN_OUR_HANDS, in createdAt order. Same for dispatches IN_OUR_HANDS →
 * AT_GARMENTER. This is a deliberate v0 simplification — splitting
 * allocations across receipts is the correct long-term behaviour but isn't
 * required for the test loop to tell a coherent story.
 */

type PhaseGuardResult = { phaseId: string; isTestPhase: boolean; phaseNumber: number };

async function requireAuthAndTestPhase(phaseId: string): Promise<PhaseGuardResult> {
  const session = await auth();
  if (!session) throw new Error("Not authenticated");
  const phase = await db.phase.findUnique({
    where: { id: phaseId },
    select: { id: true, number: true, isTestPhase: true },
  });
  if (!phase) throw new Error("Phase not found");
  if (!phase.isTestPhase) {
    throw new Error(
      `Phase ${phase.number} is not marked as a test phase. Proto writes are blocked. Toggle isTestPhase from /phases to enable.`
    );
  }
  return { phaseId: phase.id, isTestPhase: phase.isTestPhase, phaseNumber: phase.number };
}

const dec = (n: number) => Number(n.toFixed(2));

// ─── Receipts ────────────────────────────────────────────────────

export async function logFabricReceipt(input: {
  fabricOrderId: string;
  qtyKg: number;
  receivedAt?: string; // ISO date
  lotRef?: string;
  notes?: string;
}) {
  if (input.qtyKg <= 0) throw new Error("Quantity must be > 0");

  const fo = await db.fabricOrder.findUnique({
    where: { id: input.fabricOrderId },
    select: { id: true, phaseId: true },
  });
  if (!fo) throw new Error("Fabric order not found");
  await requireAuthAndTestPhase(fo.phaseId);

  await db.$transaction(async (tx) => {
    await tx.fabricReceipt.create({
      data: {
        fabricOrderId: fo.id,
        qtyKg: dec(input.qtyKg),
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        lotRef: input.lotRef ?? null,
        notes: input.notes ?? null,
      },
    });

    // FIFO-promote AT_VENDOR allocations to IN_OUR_HANDS up to receipt qty.
    let remaining = input.qtyKg;
    const atVendor = await tx.allocation.findMany({
      where: { fabricOrderId: fo.id, stage: "AT_VENDOR" },
      orderBy: { createdAt: "asc" },
    });
    for (const a of atVendor) {
      if (remaining <= 0) break;
      const aQty = Number(a.qtyKg);
      if (remaining >= aQty) {
        await tx.allocation.update({ where: { id: a.id }, data: { stage: "IN_OUR_HANDS" } });
        remaining -= aQty;
      } else {
        // Split: would require row split — defer for v0. Skip promoting this one
        // and stop (next receipts will promote it once cumulative covers it).
        break;
      }
    }
  });

  revalidatePath("/proto");
  return { ok: true };
}

// ─── Dispatches ──────────────────────────────────────────────────

export async function logGarmenterDispatch(input: {
  fabricOrderId: string;
  garmenterId: string; // Vendor.id, type=GARMENTING
  qtyKg: number;
  dispatchedAt?: string;
  vehicleRef?: string;
  notes?: string;
}) {
  if (input.qtyKg <= 0) throw new Error("Quantity must be > 0");

  const fo = await db.fabricOrder.findUnique({
    where: { id: input.fabricOrderId },
    select: { id: true, phaseId: true },
  });
  if (!fo) throw new Error("Fabric order not found");
  await requireAuthAndTestPhase(fo.phaseId);

  const garm = await db.vendor.findUnique({ where: { id: input.garmenterId }, select: { id: true, type: true } });
  if (!garm) throw new Error("Garmenter not found");
  if (garm.type !== "GARMENTING") throw new Error("Selected vendor is not a garmenter");

  await db.$transaction(async (tx) => {
    await tx.garmenterDispatch.create({
      data: {
        fabricOrderId: fo.id,
        garmenterId: garm.id,
        qtyKg: dec(input.qtyKg),
        dispatchedAt: input.dispatchedAt ? new Date(input.dispatchedAt) : new Date(),
        vehicleRef: input.vehicleRef ?? null,
        notes: input.notes ?? null,
      },
    });

    // FIFO-promote IN_OUR_HANDS allocations whose intended garmenter matches
    // (or is null) to AT_GARMENTER, recording the actual garmenter.
    let remaining = input.qtyKg;
    const inHands = await tx.allocation.findMany({
      where: {
        fabricOrderId: fo.id,
        stage: "IN_OUR_HANDS",
        OR: [{ garmenterId: garm.id }, { garmenterId: null }],
      },
      orderBy: { createdAt: "asc" },
    });
    for (const a of inHands) {
      if (remaining <= 0) break;
      const aQty = Number(a.qtyKg);
      if (remaining >= aQty) {
        await tx.allocation.update({
          where: { id: a.id },
          data: { stage: "AT_GARMENTER", garmenterId: garm.id },
        });
        remaining -= aQty;
      } else {
        break;
      }
    }
  });

  revalidatePath("/proto");
  return { ok: true };
}

// ─── Plan a phase: create products, fabric orders, allocations ───

type PlannedFabricSlot = {
  slot: 1 | 2 | 3 | 4;
  fabricName: string;
  fabricVendorId: string;
  fabricCostPerKg: number | null;
  garmentsPerKg: number | null;
  colour: string; // colour for this slot (may differ across slots for multi-colour combos)
  derivedKg: number; // qty / garmentsPerKg
};

type PlannedColourCombo = {
  colourLabel: string; // concatenated colour label for Product.colourOrdered
  skuCode: string | null; // resolved at the form layer if a matching PM variant exists
  qty: number; // total pieces for this combo
  sizes: { XS: number; S: number; M: number; L: number; XL: number; XXL: number };
  fabrics: PlannedFabricSlot[];
};

type PlannedArticle = {
  articleNumber: string;
  styleNumber: string;
  productName: string | null;
  type: string;
  gender: "MENS" | "WOMENS" | "KIDS";
  isRepeat: boolean;
  garmenterId: string | null;
  combos: PlannedColourCombo[];
};

export async function createPlannedOrders(input: { phaseId: string; articles: PlannedArticle[] }) {
  if (input.articles.length === 0) throw new Error("No articles to plan");
  await requireAuthAndTestPhase(input.phaseId);

  // First pass: collect unique (fabric, colour, vendor) buckets across every
  // article × combo × slot, summing kg. One FabricOrder per bucket.
  type Bucket = {
    fabricName: string;
    fabricVendorId: string;
    fabricCostPerKg: number | null;
    colour: string;
    totalKg: number;
    articleNumbers: Set<string>;
  };
  const bucketKey = (s: PlannedFabricSlot) => `${s.fabricVendorId}|${s.fabricName}|${s.colour}`;
  const buckets = new Map<string, Bucket>();
  for (const article of input.articles) {
    for (const combo of article.combos) {
      if (combo.qty <= 0) continue;
      for (const slot of combo.fabrics) {
        if (slot.derivedKg <= 0) continue;
        const key = bucketKey(slot);
        const b = buckets.get(key) ?? {
          fabricName: slot.fabricName,
          fabricVendorId: slot.fabricVendorId,
          fabricCostPerKg: slot.fabricCostPerKg,
          colour: slot.colour,
          totalKg: 0,
          articleNumbers: new Set<string>(),
        };
        b.totalKg += slot.derivedKg;
        b.articleNumbers.add(article.articleNumber);
        buckets.set(key, b);
      }
    }
  }

  const result = await db.$transaction(async (tx) => {
    const productIds: string[] = [];
    const fabricOrderIdByKey = new Map<string, string>();
    const allocationIds: string[] = [];

    // Create FabricOrders
    for (const [key, b] of buckets) {
      const fo = await tx.fabricOrder.create({
        data: {
          phaseId: input.phaseId,
          fabricVendorId: b.fabricVendorId,
          fabricName: b.fabricName,
          colour: b.colour,
          articleNumbers: [...b.articleNumbers].join(", "),
          costPerUnit: b.fabricCostPerKg ?? null,
          fabricOrderedQuantityKg: dec(Math.round(b.totalKg * 100) / 100),
          orderStatus: "DRAFT_ORDER",
        },
      });
      fabricOrderIdByKey.set(key, fo.id);
    }

    // Create Products + links + Allocations per (article, combo)
    for (const article of input.articles) {
      for (const combo of article.combos) {
        if (combo.qty <= 0) continue;
        const product = await tx.product.create({
          data: {
            phaseId: input.phaseId,
            orderDate: new Date().toISOString().slice(0, 10),
            styleNumber: article.styleNumber,
            articleNumber: article.articleNumber,
            skuCode: combo.skuCode ?? null,
            colourOrdered: combo.colourLabel,
            type: article.type || "—",
            gender: article.gender,
            productName: article.productName ?? null,
            status: "PLANNED",
            fabricVendorId: combo.fabrics[0]?.fabricVendorId ?? "",
            fabricName: combo.fabrics[0]?.fabricName ?? "",
            fabricGsm: null,
            fabricCostPerKg: combo.fabrics[0]?.fabricCostPerKg ?? null,
            fabricOrderedQuantityKg: dec(combo.fabrics[0]?.derivedKg ?? 0),
            fabric2Name: combo.fabrics[1]?.fabricName ?? null,
            fabric2VendorId: combo.fabrics[1]?.fabricVendorId ?? null,
            fabric2CostPerKg: combo.fabrics[1]?.fabricCostPerKg ?? null,
            garmentNumber: combo.qty,
            actualStitchedXS: 0, actualStitchedS: 0, actualStitchedM: 0,
            actualStitchedL: 0, actualStitchedXL: 0, actualStitchedXXL: 0,
            actualInwardXS: 0, actualInwardS: 0, actualInwardM: 0,
            actualInwardL: 0, actualInwardXL: 0, actualInwardXXL: 0,
            actualInwardTotal: 0,
            isRepeat: article.isRepeat,
            garmentingAtId: article.garmenterId,
          },
        });
        productIds.push(product.id);

        // Per slot: link + allocation
        for (const slot of combo.fabrics) {
          if (slot.derivedKg <= 0) continue;
          const foId = fabricOrderIdByKey.get(bucketKey(slot));
          if (!foId) continue;

          await tx.productFabricOrder.create({
            data: { productId: product.id, fabricOrderId: foId, fabricSlot: slot.slot },
          });

          const alloc = await tx.allocation.create({
            data: {
              productId: product.id,
              fabricOrderId: foId,
              garmenterId: article.garmenterId,
              qtyKg: dec(slot.derivedKg),
              stage: "AT_VENDOR",
            },
          });
          allocationIds.push(alloc.id);
        }
      }
    }

    return { productIds, fabricOrderIds: [...fabricOrderIdByKey.values()], allocationIds };
  });

  revalidatePath("/proto");
  return { ok: true, ...result };
}

// ─── Fabric mode: allocate against an existing FabricOrder ───────

export async function allocateAgainstFabricOrder(input: {
  phaseId: string;
  fabricOrderId: string;
  articles: {
    productMasterId: string;
    styleNumber: string;
    productName: string | null;
    fabricVendorId: string;
    fabricName: string;
    colour: string;
    qtyPcs: number;
    allocateKg: number;
    garmenterId: string | null;
  }[];
  reservation?: { qtyKg: number; purpose: string; garmenterId: string | null };
}) {
  if (input.articles.length === 0 && !input.reservation) {
    throw new Error("No articles or reservation to allocate");
  }
  await requireAuthAndTestPhase(input.phaseId);

  // Determine the stage of new allocations: if the FO has any receipts,
  // assume IN_OUR_HANDS; otherwise AT_VENDOR. (Real-world would be more
  // nuanced; this is a reasonable v0.)
  const fo = await db.fabricOrder.findUnique({
    where: { id: input.fabricOrderId },
    select: { id: true, phaseId: true, _count: { select: { receipts: true } } },
  });
  if (!fo) throw new Error("Fabric order not found");
  if (fo.phaseId !== input.phaseId) throw new Error("Fabric order is not in this phase");

  const stage = fo._count.receipts > 0 ? "IN_OUR_HANDS" : "AT_VENDOR";

  const result = await db.$transaction(async (tx) => {
    const productIds: string[] = [];
    const allocationIds: string[] = [];

    for (const a of input.articles) {
      const product = await tx.product.create({
        data: {
          phaseId: input.phaseId,
          orderDate: new Date().toISOString().slice(0, 10),
          styleNumber: a.styleNumber,
          colourOrdered: a.colour,
          type: "—",
          gender: "MENS",
          productName: a.productName ?? null,
          status: "PLANNED",
          fabricVendorId: a.fabricVendorId,
          fabricName: a.fabricName,
          fabricOrderedQuantityKg: dec(a.allocateKg),
          garmentingAtId: a.garmenterId,
        },
      });
      productIds.push(product.id);

      await tx.productFabricOrder.create({
        data: { productId: product.id, fabricOrderId: input.fabricOrderId, fabricSlot: 1 },
      });

      const alloc = await tx.allocation.create({
        data: {
          productId: product.id,
          fabricOrderId: input.fabricOrderId,
          garmenterId: a.garmenterId,
          qtyKg: dec(a.allocateKg),
          stage,
        },
      });
      allocationIds.push(alloc.id);
    }

    if (input.reservation && input.reservation.qtyKg > 0) {
      const r = await tx.allocation.create({
        data: {
          productId: null,
          fabricOrderId: input.fabricOrderId,
          garmenterId: input.reservation.garmenterId,
          qtyKg: dec(input.reservation.qtyKg),
          stage,
          isReservation: true,
          reservationPurpose: input.reservation.purpose || "reservation",
        },
      });
      allocationIds.push(r.id);
    }

    return { productIds, allocationIds, stage };
  });

  revalidatePath("/proto");
  return { ok: true, ...result };
}

// ─── Test phase toggle ───────────────────────────────────────────

export async function setTestPhase(phaseId: string, isTestPhase: boolean) {
  const session = await auth();
  if (!session) throw new Error("Not authenticated");
  await db.phase.update({ where: { id: phaseId }, data: { isTestPhase } });
  revalidatePath("/proto");
  revalidatePath("/phases");
  return { ok: true };
}
