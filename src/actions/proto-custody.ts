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

export async function createPlannedOrders(input: {
  phaseId: string;
  articles: {
    productMasterId: string;
    styleNumber: string;
    productName: string | null;
    fabricVendorId: string;
    fabricName: string;
    colour: string;
    qtyPcs: number;
    demandKg: number;
    garmenterId: string | null; // Vendor.id, optional
  }[];
}) {
  if (input.articles.length === 0) throw new Error("No articles to plan");
  await requireAuthAndTestPhase(input.phaseId);

  // Group articles by (fabric, colour, vendor) so we create one FabricOrder
  // per unique demand bucket. Sum demand across articles in the same bucket.
  type Bucket = {
    fabricVendorId: string;
    fabricName: string;
    colour: string;
    totalDemandKg: number;
    articles: typeof input.articles;
  };
  const buckets = new Map<string, Bucket>();
  for (const a of input.articles) {
    const key = `${a.fabricVendorId}|${a.fabricName}|${a.colour}`;
    const b = buckets.get(key) ?? {
      fabricVendorId: a.fabricVendorId,
      fabricName: a.fabricName,
      colour: a.colour,
      totalDemandKg: 0,
      articles: [],
    };
    b.totalDemandKg += a.demandKg;
    b.articles.push(a);
    buckets.set(key, b);
  }

  const result = await db.$transaction(async (tx) => {
    const productIds: string[] = [];
    const fabricOrderIds: string[] = [];
    const allocationIds: string[] = [];

    for (const b of buckets.values()) {
      // 1. Create the fabric order for this bucket
      const fo = await tx.fabricOrder.create({
        data: {
          phaseId: input.phaseId,
          fabricVendorId: b.fabricVendorId,
          fabricName: b.fabricName,
          colour: b.colour,
          articleNumbers: b.articles.map((a) => a.styleNumber).join(", "),
          fabricOrderedQuantityKg: dec(b.totalDemandKg),
          orderStatus: "DRAFT_ORDER",
        },
      });
      fabricOrderIds.push(fo.id);

      // 2. For each article in this bucket, create the Product + link + Allocation
      for (const a of b.articles) {
        const product = await tx.product.create({
          data: {
            phaseId: input.phaseId,
            orderDate: new Date().toISOString().slice(0, 10),
            styleNumber: a.styleNumber,
            colourOrdered: a.colour,
            type: "—",
            gender: "MENS", // placeholder — real form would capture
            productName: a.productName ?? null,
            status: "PLANNED",
            fabricVendorId: a.fabricVendorId,
            fabricName: a.fabricName,
            fabricOrderedQuantityKg: dec(a.demandKg),
            garmentingAtId: a.garmenterId,
          },
        });
        productIds.push(product.id);

        await tx.productFabricOrder.create({
          data: { productId: product.id, fabricOrderId: fo.id, fabricSlot: 1 },
        });

        const alloc = await tx.allocation.create({
          data: {
            productId: product.id,
            fabricOrderId: fo.id,
            garmenterId: a.garmenterId,
            qtyKg: dec(a.demandKg),
            stage: "AT_VENDOR",
          },
        });
        allocationIds.push(alloc.id);
      }
    }

    return { productIds, fabricOrderIds, allocationIds };
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
