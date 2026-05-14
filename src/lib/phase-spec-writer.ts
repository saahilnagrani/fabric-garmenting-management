import type { PrismaClient } from "@/generated/prisma/client";
import { articleIntroductionPhaseNumber } from "@/lib/article-history";

/**
 * Helpers that write to the PhaseFabric / PhaseCost changelog. Used by
 * product-master create/update actions to keep history in sync whenever a
 * user edits fabric or cost fields on the master sheet.
 *
 * Under option-B semantics:
 *  - On create, a row is written at the article's INTRODUCTION phase
 *    (derived from articleNumber leading digit). This locks in the
 *    article's starting state.
 *  - On update, a row is written at the CURRENT phase (the Phase row
 *    with `isCurrent = true`). Any subsequent edit at the same phase
 *    upserts the same row.
 */

type Tx = Pick<PrismaClient, "phaseFabric" | "phaseCost" | "phase">;

const FABRIC_FIELDS = [
  "fabricName", "fabricVendorId", "fabricCostPerKg", "garmentsPerKg",
  "fabric2Name", "fabric2VendorId", "fabric2CostPerKg", "garmentsPerKg2",
  "fabric3Name", "fabric3VendorId", "fabric3CostPerKg", "garmentsPerKg3",
  "fabric4Name", "fabric4VendorId", "fabric4CostPerKg", "garmentsPerKg4",
] as const;

const COST_FIELDS_ONLY = [
  // PhaseCost-tracked fields. fabric*CostPerKg lives on both PhaseFabric and
  // PhaseCost; we prefer PhaseFabric (it's the changelog of "fabric facts")
  // so cost-only writes skip fabric*CostPerKg.
  "stitchingCost", "brandLogoCost", "neckTwillCost", "reflectorsCost",
  "fusingCost", "accessoriesCost", "brandTagCost", "sizeTagCost",
  "packagingCost", "inwardShipping",
] as const;

export type SpecFields = Record<string, unknown>;

function pickPresent(src: SpecFields, fields: readonly string[]): SpecFields {
  const out: SpecFields = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(src, f)) {
      const v = src[f];
      // null/empty string means "no change"; only persist explicit values.
      if (v !== undefined && v !== null && v !== "") out[f] = v;
    }
  }
  return out;
}

async function findCurrentPhaseId(tx: Tx): Promise<string | null> {
  const p = await tx.phase.findFirst({ where: { isCurrent: true }, select: { id: true } });
  return p?.id ?? null;
}

async function findIntroductionPhaseId(tx: Tx, articleNumber: string | null | undefined): Promise<string | null> {
  const n = articleIntroductionPhaseNumber(articleNumber);
  if (n == null) return null;
  const p = await tx.phase.findFirst({ where: { number: n }, select: { id: true } });
  return p?.id ?? null;
}

/**
 * Write fabric + cost fields onto the changelog at a specific phase. Fabric
 * fields go on PhaseFabric; non-fabric cost fields go on PhaseCost. The two
 * rows are upserted independently and either is skipped if no relevant
 * fields were supplied.
 */
export async function writePhaseSpec(
  tx: Tx,
  productMasterId: string,
  phaseId: string,
  fields: SpecFields,
): Promise<void> {
  const fabricData = pickPresent(fields, FABRIC_FIELDS as readonly string[]);
  const costData = pickPresent(fields, COST_FIELDS_ONLY as readonly string[]);

  if (Object.keys(fabricData).length > 0) {
    await tx.phaseFabric.upsert({
      where: { phaseId_productMasterId: { phaseId, productMasterId } },
      update: fabricData,
      create: { phaseId, productMasterId, ...fabricData },
    });
  }

  if (Object.keys(costData).length > 0) {
    await tx.phaseCost.upsert({
      where: {
        phaseId_entityType_entityId: {
          phaseId,
          entityType: "PRODUCT_MASTER",
          entityId: productMasterId,
        },
      },
      update: costData,
      create: {
        phaseId,
        entityType: "PRODUCT_MASTER",
        entityId: productMasterId,
        ...costData,
      },
    });
  }
}

/**
 * Write changelog rows for a newly created article master at its
 * introduction phase. Captures the article's starting state.
 */
export async function writePhaseSpecAtIntroduction(
  tx: Tx,
  productMasterId: string,
  articleNumber: string | null | undefined,
  fields: SpecFields,
): Promise<void> {
  const introPhaseId = await findIntroductionPhaseId(tx, articleNumber);
  if (!introPhaseId) return;
  await writePhaseSpec(tx, productMasterId, introPhaseId, fields);
}

/**
 * Write changelog rows for an edit at the system's current phase. Used by
 * `updateProductMaster` to record edits made through the regular Fabric /
 * Garmenting Costs sections. No-op if no current phase is set.
 */
export async function writePhaseSpecAtCurrentPhase(
  tx: Tx,
  productMasterId: string,
  fields: SpecFields,
): Promise<void> {
  const currentPhaseId = await findCurrentPhaseId(tx);
  if (!currentPhaseId) return;
  await writePhaseSpec(tx, productMasterId, currentPhaseId, fields);
}

/**
 * Subset of fields on the master row that, when changed, should be recorded
 * to the changelog. Returns the fields where `prev` and `next` differ.
 */
export function diffSpecFields(prev: SpecFields, next: SpecFields): SpecFields {
  const out: SpecFields = {};
  const allFields = [...FABRIC_FIELDS, ...COST_FIELDS_ONLY];
  for (const f of allFields) {
    const a = prev[f];
    const b = next[f];
    if (b === undefined) continue; // not part of this update
    if (String(a ?? "") !== String(b ?? "")) out[f] = b;
  }
  return out;
}
