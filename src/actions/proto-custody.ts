"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createPlanOrders, type PlannedArticleOrder, type PlannedFabricOrder } from "@/actions/phase-planning";

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

  // Receipt is just "fabric arrived". No per-allocation decision made here.
  // Allocation to AOs happens at dispatch time via AllocationDispatch.
  await db.fabricReceipt.create({
    data: {
      fabricOrderId: fo.id,
      qtyKg: dec(input.qtyKg),
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      lotRef: input.lotRef ?? null,
      notes: input.notes ?? null,
    },
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
  // Per-allocation breakdown of the dispatch. Sum may be ≤ qtyKg; the
  // leftover is "loose stock at garmenter" (no AO attached).
  assignments?: { allocationId: string; qtyKg: number }[];
}) {
  if (input.qtyKg <= 0) throw new Error("Quantity must be > 0");

  const fo = await db.fabricOrder.findUnique({
    where: { id: input.fabricOrderId },
    select: {
      id: true,
      phaseId: true,
      fabricOrderedQuantityKg: true,
      receipts: { select: { qtyKg: true } },
      dispatches: { select: { qtyKg: true } },
    },
  });
  if (!fo) throw new Error("Fabric order not found");
  await requireAuthAndTestPhase(fo.phaseId);

  const garm = await db.vendor.findUnique({ where: { id: input.garmenterId }, select: { id: true, type: true } });
  if (!garm) throw new Error("Garmenter not found");
  if (garm.type !== "GARMENTING") throw new Error("Selected vendor is not a garmenter");

  // Pool guard: can't dispatch more than is currently in our hands.
  const totalReceived = fo.receipts.reduce((s, r) => s + Number(r.qtyKg), 0);
  const totalDispatched = fo.dispatches.reduce((s, d) => s + Number(d.qtyKg), 0);
  const inOurHands = totalReceived - totalDispatched;
  if (input.qtyKg > inOurHands + 1e-6) {
    throw new Error(`Only ${inOurHands.toFixed(2)} kg in our hands for this fabric order; cannot dispatch ${input.qtyKg.toFixed(2)} kg.`);
  }

  const assignments = (input.assignments ?? []).filter((a) => a.qtyKg > 0);
  const assignedSum = assignments.reduce((s, a) => s + a.qtyKg, 0);
  if (assignedSum > input.qtyKg + 1e-6) {
    throw new Error(`Assignments sum (${assignedSum.toFixed(2)}) exceeds dispatch qty (${input.qtyKg.toFixed(2)}).`);
  }

  // Validate each assigned allocation belongs to this FO and that we're not
  // dispatching more than its remaining unfulfilled qty.
  const allocIds = assignments.map((a) => a.allocationId);
  const allocs = allocIds.length > 0
    ? await db.allocation.findMany({
        where: { id: { in: allocIds }, fabricOrderId: fo.id },
        include: { dispatches: { select: { qtyKg: true } } },
      })
    : [];
  const allocById = new Map(allocs.map((a) => [a.id, a]));
  for (const a of assignments) {
    const al = allocById.get(a.allocationId);
    if (!al) throw new Error(`Allocation ${a.allocationId} is not on this fabric order`);
    const alreadyDispatched = al.dispatches.reduce((s, d) => s + Number(d.qtyKg), 0);
    const remaining = Number(al.qtyKg) - alreadyDispatched;
    if (a.qtyKg > remaining + 1e-6) {
      throw new Error(`Cannot dispatch ${a.qtyKg.toFixed(2)} kg to allocation ${al.id}; only ${remaining.toFixed(2)} kg unfulfilled.`);
    }
  }

  await db.$transaction(async (tx) => {
    const dispatch = await tx.garmenterDispatch.create({
      data: {
        fabricOrderId: fo.id,
        garmenterId: garm.id,
        qtyKg: dec(input.qtyKg),
        dispatchedAt: input.dispatchedAt ? new Date(input.dispatchedAt) : new Date(),
        vehicleRef: input.vehicleRef ?? null,
        notes: input.notes ?? null,
      },
    });

    for (const a of assignments) {
      await tx.allocationDispatch.create({
        data: {
          allocationId: a.allocationId,
          garmenterDispatchId: dispatch.id,
          qtyKg: dec(a.qtyKg),
        },
      });
    }

    // Recompute Allocation.stage for every touched allocation.
    const touchedIds = Array.from(new Set(assignments.map((a) => a.allocationId)));
    if (touchedIds.length > 0) {
      const refreshed = await tx.allocation.findMany({
        where: { id: { in: touchedIds } },
        include: { dispatches: { select: { qtyKg: true } } },
      });
      for (const al of refreshed) {
        const sum = al.dispatches.reduce((s, d) => s + Number(d.qtyKg), 0);
        const planned = Number(al.qtyKg);
        const nextStage = sum <= 0
          ? "AT_VENDOR"
          : sum >= planned - 1e-6
            ? "AT_GARMENTER"
            : "PARTIALLY_AT_GARMENTER";
        const nextGarmenterId = sum > 0 ? garm.id : al.garmenterId;
        if (al.stage !== nextStage || al.garmenterId !== nextGarmenterId) {
          await tx.allocation.update({
            where: { id: al.id },
            data: { stage: nextStage, garmenterId: nextGarmenterId },
          });
        }
      }
    }
  });

  revalidatePath("/proto");
  return { ok: true };
}

// ─── Plan a phase (proto route): translates proto state → live createPlanOrders ───
// This is THE canonical save path for proto phase planning. It delegates
// Product + FabricOrder creation to the live createPlanOrders action so both
// paths share exactly the same DB writes. Proto then appends Allocation rows
// (which the live form does not write).

export type ProtoPlannedFabricSlot = {
  slot: 1 | 2 | 3 | 4;
  fabricName: string;
  fabricVendorId: string;
  fabricCostPerKg: number | null;
  garmentsPerKg: number | null;
  colour: string;
  derivedKg: number;
};

export type ProtoPlannedColourCombo = {
  colourLabel: string;
  skuCode: string | null;
  qty: number;
  fabrics: ProtoPlannedFabricSlot[];
};

export type ProtoPlannedArticle = {
  articleNumber: string;
  styleNumber: string;
  productName: string | null;
  type: string;
  gender: "MENS" | "WOMENS" | "KIDS";
  isRepeat: boolean;
  garmenterId: string | null;
  combos: ProtoPlannedColourCombo[];
};

export async function createPlannedOrdersProto(input: {
  phaseId: string;
  articles: ProtoPlannedArticle[];
}): Promise<{ ok: boolean; productIds: string[]; fabricOrderIds: string[]; allocationIds: string[] }> {
  if (input.articles.length === 0) throw new Error("No articles to plan");
  await requireAuthAndTestPhase(input.phaseId);

  // ── Fetch ProductMasters for cost + MRP field resolution ──────────
  const articleNums = Array.from(new Set(input.articles.map((a) => a.articleNumber).filter(Boolean)));
  const pms = articleNums.length > 0
    ? await db.productMaster.findMany({ where: { articleNumber: { in: articleNums } } })
    : [];
  const pmsByArticle = new Map<string, typeof pms>();
  for (const p of pms) {
    if (!p.articleNumber) continue;
    const arr = pmsByArticle.get(p.articleNumber) ?? [];
    arr.push(p);
    pmsByArticle.set(p.articleNumber, arr);
  }

  // Pick the PM variant that best matches this combo's colour + gender.
  function pickPM(articleNumber: string, primaryColour: string, gender: string) {
    const candidates = pmsByArticle.get(articleNumber) ?? [];
    if (candidates.length === 0) return null;
    const exact = candidates.find(
      (p) => String(p.gender) === gender && (p.coloursAvailable ?? []).includes(primaryColour)
    );
    if (exact) return exact;
    const sameGender = candidates.find((p) => String(p.gender) === gender);
    if (sameGender) return sameGender;
    const colourMatch = candidates.find((p) => (p.coloursAvailable ?? []).includes(primaryColour));
    if (colourMatch) return colourMatch;
    return candidates[0];
  }

  // ── Resolve garmenter Vendor.id → name ───────────────────────────
  const vendorIds = Array.from(
    new Set(input.articles.map((a) => a.garmenterId).filter((v): v is string => !!v))
  );
  const garmenterNameByVendorId = new Map<string, string>();
  if (vendorIds.length > 0) {
    const vendors = await db.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true },
    });
    for (const v of vendors) garmenterNameByVendorId.set(v.id, v.name);
  }

  const toNum = (d: { toString(): string } | null | undefined): number | null =>
    d != null ? Number(d.toString()) : null;

  // ── Build the live-format arrays ──────────────────────────────────
  const articleOrdersForLive: PlannedArticleOrder[] = [];
  const fabricOrdersForLive: PlannedFabricOrder[] = [];

  // Parallel plan: for each FO we'll create, record qtyKg + garmenterId so
  // we can write the Allocation rows after createPlanOrders returns IDs.
  const allocationPlan: {
    articleOrderIndex: number;
    slot: number;
    qtyKg: number;
    garmenterId: string | null;
  }[] = [];

  for (const article of input.articles) {
    for (const combo of article.combos) {
      if (combo.qty <= 0) continue;

      const primaryColour = (combo.fabrics[0]?.colour ?? combo.colourLabel.split("/")[0] ?? "").trim();
      const pm = pickPM(article.articleNumber, primaryColour, article.gender);
      const articleOrderIndex = articleOrdersForLive.length;

      // Prefer user-selected garmenter name; fall back to PM's default.
      const garmenterName = article.garmenterId
        ? (garmenterNameByVendorId.get(article.garmenterId) ?? null)
        : (pm?.garmentingAt ?? null);

      articleOrdersForLive.push({
        styleNumber: article.styleNumber,
        articleNumber: article.articleNumber,
        skuCode: pm?.skuCode ?? combo.skuCode ?? "",
        colourOrdered: combo.colourLabel,
        garmentNumber: combo.qty,
        isRepeat: article.isRepeat,
        type: article.type || "—",
        gender: article.gender,
        productName: article.productName ?? "",
        // Fabric slot 1 + 2 names/vendors (slots 3/4 go via fabric3/4Name fields)
        fabricVendorId: combo.fabrics[0]?.fabricVendorId ?? "",
        fabricName: combo.fabrics[0]?.fabricName ?? "",
        fabric2Name: combo.fabrics[1]?.fabricName ?? null,
        fabric2VendorId: combo.fabrics[1]?.fabricVendorId ?? null,
        fabric3Name: combo.fabrics[2]?.fabricName ?? null,
        fabric3VendorId: combo.fabrics[2]?.fabricVendorId ?? null,
        fabric4Name: combo.fabrics[3]?.fabricName ?? null,
        fabric4VendorId: combo.fabrics[3]?.fabricVendorId ?? null,
        // Cost fields resolved from the colour-matched PM (mirrors live form)
        fabricCostPerKg: toNum(pm?.fabricCostPerKg) ?? (combo.fabrics[0]?.fabricCostPerKg ?? null),
        fabric2CostPerKg: toNum(pm?.fabric2CostPerKg) ?? (combo.fabrics[1]?.fabricCostPerKg ?? null),
        assumedFabricGarmentsPerKg: toNum(pm?.garmentsPerKg),
        assumedFabric2GarmentsPerKg: toNum(pm?.garmentsPerKg2),
        stitchingCost: toNum(pm?.stitchingCost),
        brandLogoCost: toNum(pm?.brandLogoCost),
        neckTwillCost: toNum(pm?.neckTwillCost),
        reflectorsCost: toNum(pm?.reflectorsCost),
        fusingCost: toNum(pm?.fusingCost),
        accessoriesCost: toNum(pm?.accessoriesCost),
        brandTagCost: toNum(pm?.brandTagCost),
        sizeTagCost: toNum(pm?.sizeTagCost),
        packagingCost: toNum(pm?.packagingCost),
        // PM.inwardShipping maps to Product.outwardShippingCost (same as live)
        outwardShippingCost: toNum(pm?.inwardShipping),
        proposedMrp: toNum(pm?.proposedMrp),
        onlineMrp: toNum(pm?.onlineMrp),
        garmentingAt: garmenterName,
      });

      for (const slot of combo.fabrics) {
        if (slot.derivedKg <= 0) continue;
        fabricOrdersForLive.push({
          fabricName: slot.fabricName,
          fabricVendorId: slot.fabricVendorId,
          articleNumbers: article.articleNumber,
          colour: slot.colour,
          fabricOrderedQuantityKg: Math.round(slot.derivedKg * 100) / 100,
          costPerUnit: slot.fabricCostPerKg,
          isRepeat: article.isRepeat,
          gender: article.gender,
          orderStatus: "DRAFT_ORDER",
          garmentingAt: null,
          articleOrderIndex,
        });
        allocationPlan.push({
          articleOrderIndex,
          slot: slot.slot,
          qtyKg: slot.derivedKg,
          garmenterId: article.garmenterId || null,
        });
      }
    }
  }

  // ── Create Products + FabricOrders via the live action ────────────
  // This guarantees proto and live write identical Product/FO rows.
  const { created } = await createPlanOrders(input.phaseId, articleOrdersForLive, fabricOrdersForLive);

  // ── Write Allocations (proto-only) ────────────────────────────────
  const allocationIds: string[] = [];
  if (allocationPlan.length > 0) {
    await db.$transaction(async (tx) => {
      for (const plan of allocationPlan) {
        const p = created[plan.articleOrderIndex];
        if (!p) continue;
        const link = p.fabricLinks.find((l) => l.slot === plan.slot);
        if (!link) continue;
        const alloc = await tx.allocation.create({
          data: {
            productId: p.productId,
            fabricOrderId: link.fabricOrderId,
            garmenterId: plan.garmenterId || null,
            qtyKg: dec(plan.qtyKg),
            stage: "AT_VENDOR",
          },
        });
        allocationIds.push(alloc.id);
      }
    });
  }

  revalidatePath("/proto");
  return {
    ok: true,
    productIds: created.map((c) => c.productId),
    fabricOrderIds: [...new Set(created.flatMap((c) => c.fabricLinks.map((l) => l.fabricOrderId)))],
    allocationIds,
  };
}

// ─── Plan a phase: create products, fabric orders, allocations ───
// LEGACY: kept for reference but no longer called by the proto form.
// createPlannedOrdersProto above is the correct entry point.

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
    garmenterIds: Set<string>; // distinct garmenter Vendor.ids feeding this bucket
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
          garmenterIds: new Set<string>(),
        };
        b.totalKg += slot.derivedKg;
        b.articleNumbers.add(article.articleNumber);
        if (article.garmenterId) b.garmenterIds.add(article.garmenterId);
        buckets.set(key, b);
      }
    }
  }

  // Look up every ProductMaster touching these articles. A single article
  // number can have multiple PMs (one per gender × colour combo). At the
  // Product create site we pick the variant whose coloursAvailable best
  // matches the combo's primary colour — that gives the right skuCode + the
  // right per-PM cost / MRP fields.
  const articleNums = Array.from(new Set(input.articles.map((a) => a.articleNumber).filter(Boolean)));
  const pmsByArticle = articleNums.length > 0
    ? await db.productMaster.findMany({ where: { articleNumber: { in: articleNums } } })
    : [];
  const pmsByArticleMap = new Map<string, typeof pmsByArticle>();
  for (const p of pmsByArticle) {
    if (!p.articleNumber) continue;
    const arr = pmsByArticleMap.get(p.articleNumber) ?? [];
    arr.push(p);
    pmsByArticleMap.set(p.articleNumber, arr);
  }
  function pickPM(articleNumber: string, primaryColour: string, gender: string) {
    const candidates = pmsByArticleMap.get(articleNumber) ?? [];
    if (candidates.length === 0) return null;
    // 1. Same gender + colour appears in coloursAvailable
    const exact = candidates.find((p) =>
      String(p.gender) === gender && (p.coloursAvailable ?? []).includes(primaryColour)
    );
    if (exact) return exact;
    // 2. Same gender, any colour
    const sameGender = candidates.find((p) => String(p.gender) === gender);
    if (sameGender) return sameGender;
    // 3. Any PM whose colour set includes this primary colour
    const colourMatch = candidates.find((p) => (p.coloursAvailable ?? []).includes(primaryColour));
    if (colourMatch) return colourMatch;
    // 4. Fallback: first
    return candidates[0];
  }

  const { createLookupResolver } = await import("@/lib/lookups");
  const resolver = createLookupResolver();

  // Translate garmenter Vendor.id → GarmentingLocation.id (by name).
  // Product.garmentingAtId references GarmentingLocation, NOT Vendor —
  // the two parallel records are kept in sync by name. Also stash the
  // garmenter name so we can populate the legacy Product.garmentingAt /
  // FabricOrder.garmentingAt string fields the live UI reads.
  const vendorIds = Array.from(new Set(input.articles.map((a) => a.garmenterId).filter((v): v is string => !!v)));
  const garmentingLocationIdByVendorId = new Map<string, string>();
  const garmenterNameByVendorId = new Map<string, string>();
  if (vendorIds.length > 0) {
    const vendors = await db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } });
    const locs = await db.garmentingLocation.findMany({ where: { name: { in: vendors.map((v) => v.name) } }, select: { id: true, name: true } });
    const locByName = new Map(locs.map((l) => [l.name, l.id]));
    for (const v of vendors) {
      garmenterNameByVendorId.set(v.id, v.name);
      const locId = locByName.get(v.name);
      if (locId) garmentingLocationIdByVendorId.set(v.id, locId);
    }
  }

  const result = await db.$transaction(async (tx) => {
    const productIds: string[] = [];
    const fabricOrderIdByKey = new Map<string, string>();
    const allocationIds: string[] = [];

    // Create FabricOrders. If every article in this bucket goes to the same
    // garmenter, tag the FO with that GarmentingLocation; otherwise leave
    // null (mixed garmenters → ambiguous at the FO level).
    for (const [key, b] of buckets) {
      const bucketGarmIds = [...b.garmenterIds];
      const sharedGarmenterVendorId = bucketGarmIds.length === 1 ? bucketGarmIds[0] : null;
      const sharedGarmentingAtId = sharedGarmenterVendorId
        ? garmentingLocationIdByVendorId.get(sharedGarmenterVendorId) ?? null
        : null;
      const sharedGarmenterName = sharedGarmenterVendorId
        ? garmenterNameByVendorId.get(sharedGarmenterVendorId) ?? null
        : null;
      const colourId = await resolver.colourId(b.colour);
      // Bucket-level isRepeat / gender: true / single value if every article
      // feeding this bucket agrees, else null.
      const articleIsRepeats = new Set<boolean>();
      const articleGenders = new Set<string>();
      for (const a of input.articles) {
        for (const c of a.combos) {
          if (c.qty <= 0) continue;
          for (const s of c.fabrics) {
            if (bucketKey(s) === key) {
              articleIsRepeats.add(a.isRepeat);
              articleGenders.add(a.gender);
            }
          }
        }
      }
      const bucketIsRepeat = articleIsRepeats.size === 1 ? [...articleIsRepeats][0] : false;
      const bucketGender = articleGenders.size === 1
        ? ([...articleGenders][0] as "MENS" | "WOMENS" | "KIDS")
        : null;
      const fo = await tx.fabricOrder.create({
        data: {
          phaseId: input.phaseId,
          orderDate: new Date(),
          fabricVendorId: b.fabricVendorId,
          fabricName: b.fabricName,
          colour: b.colour,
          colourId,
          articleNumbers: [...b.articleNumbers].join(", "),
          costPerUnit: b.fabricCostPerKg ?? null,
          fabricOrderedQuantityKg: dec(Math.round(b.totalKg * 100) / 100),
          orderStatus: "DRAFT_ORDER",
          isRepeat: bucketIsRepeat,
          gender: bucketGender,
          garmentingAtId: sharedGarmentingAtId,
          garmentingAt: sharedGarmenterName,
        },
      });
      fabricOrderIdByKey.set(key, fo.id);
    }

    // Create Products + links + Allocations per (article, combo)
    for (const article of input.articles) {
      for (const combo of article.combos) {
        if (combo.qty <= 0) continue;
        // Pick the PM that matches this combo's primary colour + gender —
        // gives us the right skuCode, cost, and MRP fields. Live form does
        // the same when you choose a colour for an article.
        const primaryColour = (combo.fabrics[0]?.colour ?? combo.colourLabel.split("/")[0] ?? "").trim();
        const pm = pickPM(article.articleNumber, primaryColour, article.gender);
        const colourOrderedId = await resolver.colourId(combo.colourLabel);
        const typeRefId = pm?.typeRefId ?? (await resolver.productTypeId(article.type));
        const product = await tx.product.create({
          data: {
            phaseId: input.phaseId,
            orderDate: new Date().toISOString().slice(0, 10),
            styleNumber: article.styleNumber,
            articleNumber: article.articleNumber,
            // Prefer the colour-matched PM's skuCode so the live sheet's
            // article picker can pre-select the right variant.
            skuCode: pm?.skuCode ?? combo.skuCode ?? null,
            colourOrdered: combo.colourLabel,
            colourOrderedId,
            type: article.type || "—",
            typeRefId,
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
            fabric2OrderedQuantityKg: combo.fabrics[1]?.derivedKg ? dec(combo.fabrics[1].derivedKg) : null,
            // Cost / pricing copied from ProductMaster (matches live form)
            assumedFabricGarmentsPerKg: pm?.garmentsPerKg ?? null,
            assumedFabric2GarmentsPerKg: pm?.garmentsPerKg2 ?? null,
            stitchingCost: pm?.stitchingCost ?? null,
            brandLogoCost: pm?.brandLogoCost ?? null,
            neckTwillCost: pm?.neckTwillCost ?? null,
            reflectorsCost: pm?.reflectorsCost ?? null,
            fusingCost: pm?.fusingCost ?? null,
            accessoriesCost: pm?.accessoriesCost ?? null,
            brandTagCost: pm?.brandTagCost ?? null,
            sizeTagCost: pm?.sizeTagCost ?? null,
            packagingCost: pm?.packagingCost ?? null,
            proposedMrp: pm?.proposedMrp ?? null,
            onlineMrp: pm?.onlineMrp ?? null,
            garmentNumber: combo.qty,
            actualStitchedXS: 0, actualStitchedS: 0, actualStitchedM: 0,
            actualStitchedL: 0, actualStitchedXL: 0, actualStitchedXXL: 0,
            actualInwardXS: 0, actualInwardS: 0, actualInwardM: 0,
            actualInwardL: 0, actualInwardXL: 0, actualInwardXXL: 0,
            actualInwardTotal: 0,
            isRepeat: article.isRepeat,
            garmentingAtId: article.garmenterId ? (garmentingLocationIdByVendorId.get(article.garmenterId) ?? null) : null,
            garmentingAt: article.garmenterId ? (garmenterNameByVendorId.get(article.garmenterId) ?? null) : null,
          },
        });
        productIds.push(product.id);

        // Per-slot ProductColour rows from the slash-separated colourOrdered
        // string (matches the live PlanningForm).
        const parts = combo.colourLabel.split("/").map((s) => s.trim()).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          const cid = await resolver.colourId(parts[i]);
          if (cid) {
            await tx.productColour.create({ data: { productId: product.id, colourId: cid, slot: i + 1 } });
          }
        }

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
              garmenterId: article.garmenterId || null,
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

  // Vendor.id → GarmentingLocation.id translation (same reason as above).
  const fabVendorIds = Array.from(new Set([
    ...input.articles.map((a) => a.garmenterId),
    input.reservation?.garmenterId,
  ].filter((v): v is string => !!v)));
  const fabGarmentingLocationByVendorId = new Map<string, string>();
  const fabGarmenterNameByVendorId = new Map<string, string>();
  if (fabVendorIds.length > 0) {
    const vendors = await db.vendor.findMany({ where: { id: { in: fabVendorIds } }, select: { id: true, name: true } });
    const locs = await db.garmentingLocation.findMany({ where: { name: { in: vendors.map((v) => v.name) } }, select: { id: true, name: true } });
    const locByName = new Map(locs.map((l) => [l.name, l.id]));
    for (const v of vendors) {
      fabGarmenterNameByVendorId.set(v.id, v.name);
      const locId = locByName.get(v.name);
      if (locId) fabGarmentingLocationByVendorId.set(v.id, locId);
    }
  }

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
          garmentingAtId: a.garmenterId ? (fabGarmentingLocationByVendorId.get(a.garmenterId) ?? null) : null,
          garmentingAt: a.garmenterId ? (fabGarmenterNameByVendorId.get(a.garmenterId) ?? null) : null,
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
          garmenterId: a.garmenterId || null,
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
