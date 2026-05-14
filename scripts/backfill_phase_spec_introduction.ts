/**
 * One-time backfill to migrate per-article fabric/cost spec from option-A
 * semantics (master columns = STARTING values) to option-B semantics
 * (master columns = CURRENT/latest values).
 *
 * For each ProductMaster:
 *   1. Determine the introduction phase from the leading digit of articleNumber
 *      (matches `articleIntroductionPhaseNumber`). Pick the Phase row with that
 *      number; if not found, skip this master.
 *   2. Upsert a PhaseFabric row at the introduction phase that carries the
 *      master's current fabric values. For fields already set on an existing
 *      row at that phase, keep them — only fill blanks.
 *   3. Upsert a PhaseCost row at the introduction phase the same way.
 *   4. Walk the changelog (intro row + any later changes) to compute the
 *      latest-phase-resolved fabric + cost values.
 *   5. Overwrite the master columns with those latest-resolved values.
 *      AFTER this script, master columns are the article's CURRENT state.
 *
 * The script is idempotent: re-running it does nothing once the introduction
 * row exists and the master row reflects current values.
 *
 * Usage:
 *   env $(grep -v '^#' .env.local | xargs) npx tsx scripts/backfill_phase_spec_introduction.ts [--dry-run] [--article=<articleNumber>]
 */

import { db as prisma } from '../src/lib/db';
import { articleIntroductionPhaseNumber } from '../src/lib/article-history';

const FABRIC_FIELDS = [
  'fabricName', 'fabricVendorId', 'fabricCostPerKg', 'garmentsPerKg',
  'fabric2Name', 'fabric2VendorId', 'fabric2CostPerKg', 'garmentsPerKg2',
  'fabric3Name', 'fabric3VendorId', 'fabric3CostPerKg', 'garmentsPerKg3',
  'fabric4Name', 'fabric4VendorId', 'fabric4CostPerKg', 'garmentsPerKg4',
] as const;

const COST_FIELDS = [
  'fabricCostPerKg', 'fabric2CostPerKg',
  'stitchingCost', 'brandLogoCost', 'neckTwillCost', 'reflectorsCost',
  'fusingCost', 'accessoriesCost', 'brandTagCost', 'sizeTagCost',
  'packagingCost', 'inwardShipping',
] as const;

// Master columns we map onto the PhaseFabric row at the introduction phase.
const MASTER_TO_FABRIC: Array<[string, string]> = [
  ['fabricName', 'fabricName'],
  ['fabricCostPerKg', 'fabricCostPerKg'],
  ['garmentsPerKg', 'garmentsPerKg'],
  ['fabric2Name', 'fabric2Name'],
  ['fabric2CostPerKg', 'fabric2CostPerKg'],
  ['garmentsPerKg2', 'garmentsPerKg2'],
  ['fabric3Name', 'fabric3Name'],
  ['fabric3CostPerKg', 'fabric3CostPerKg'],
  ['garmentsPerKg3', 'garmentsPerKg3'],
  ['fabric4Name', 'fabric4Name'],
  ['fabric4CostPerKg', 'fabric4CostPerKg'],
  ['garmentsPerKg4', 'garmentsPerKg4'],
];

const MASTER_TO_COST: Array<[string, string]> = [
  ['fabricCostPerKg', 'fabricCostPerKg'],
  ['fabric2CostPerKg', 'fabric2CostPerKg'],
  ['stitchingCost', 'stitchingCost'],
  ['brandLogoCost', 'brandLogoCost'],
  ['neckTwillCost', 'neckTwillCost'],
  ['reflectorsCost', 'reflectorsCost'],
  ['fusingCost', 'fusingCost'],
  ['accessoriesCost', 'accessoriesCost'],
  ['brandTagCost', 'brandTagCost'],
  ['sizeTagCost', 'sizeTagCost'],
  ['packagingCost', 'packagingCost'],
  ['inwardShipping', 'inwardShipping'],
];

function applyChangelog(
  rows: Array<Record<string, unknown>>,
  fields: readonly string[],
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fallback };
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f];
      if (v !== null && v !== undefined) out[f] = v;
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const articleArg = args.find((a) => a.startsWith('--article='));
  const articleFilter = articleArg ? articleArg.split('=')[1] : null;

  const phases = await prisma.phase.findMany({ select: { id: true, number: true, name: true } });
  const phaseNumberById = new Map<string, number>(phases.map((p) => [p.id, p.number]));
  const phaseByNumber = new Map<number, { id: string; name: string; number: number }>();
  for (const p of phases) phaseByNumber.set(p.number, p);

  const masters = await prisma.productMaster.findMany({
    where: articleFilter ? { articleNumber: articleFilter } : {},
  });
  console.log(`Found ${masters.length} masters${articleFilter ? ` for article ${articleFilter}` : ''}.`);
  if (dryRun) console.log('[dry-run] no writes will be made.');

  let inserted = 0;
  let merged = 0;
  let updatedMasters = 0;
  let skippedNoPhase = 0;

  for (const m of masters) {
    const introNum = articleIntroductionPhaseNumber(m.articleNumber);
    if (introNum == null) {
      console.log(`  ${m.skuCode}: no leading digit on articleNumber, skipping`);
      skippedNoPhase++;
      continue;
    }
    const introPhase = phaseByNumber.get(introNum);
    if (!introPhase) {
      console.log(`  ${m.skuCode}: no Phase with number=${introNum}, skipping`);
      skippedNoPhase++;
      continue;
    }

    // STEP 1: upsert intro-phase PhaseFabric carrying current master fabric values.
    const fabricMasterValues: Record<string, unknown> = {};
    for (const [src, tgt] of MASTER_TO_FABRIC) {
      const v = (m as unknown as Record<string, unknown>)[src];
      if (v !== null && v !== undefined) fabricMasterValues[tgt] = v;
    }
    const existingFabricIntro = await prisma.phaseFabric.findUnique({
      where: { phaseId_productMasterId: { phaseId: introPhase.id, productMasterId: m.id } },
    });
    if (!existingFabricIntro) {
      if (!dryRun) {
        await prisma.phaseFabric.create({
          data: { phaseId: introPhase.id, productMasterId: m.id, ...fabricMasterValues },
        });
      }
      console.log(`  ${m.articleNumber}/${m.skuCode}: insert PhaseFabric@${introPhase.name} (${Object.keys(fabricMasterValues).length} fields)`);
      inserted++;
    } else {
      const merge: Record<string, unknown> = {};
      for (const k of Object.keys(fabricMasterValues)) {
        const cur = (existingFabricIntro as unknown as Record<string, unknown>)[k];
        if (cur === null || cur === undefined) merge[k] = fabricMasterValues[k];
      }
      if (Object.keys(merge).length > 0) {
        if (!dryRun) {
          await prisma.phaseFabric.update({
            where: { phaseId_productMasterId: { phaseId: introPhase.id, productMasterId: m.id } },
            data: merge,
          });
        }
        console.log(`  ${m.articleNumber}/${m.skuCode}: merge PhaseFabric@${introPhase.name} (${Object.keys(merge).length} fields)`);
        merged++;
      }
    }

    // STEP 2: upsert intro-phase PhaseCost carrying current master cost values.
    const costMasterValues: Record<string, unknown> = {};
    for (const [src, tgt] of MASTER_TO_COST) {
      const v = (m as unknown as Record<string, unknown>)[src];
      if (v !== null && v !== undefined) costMasterValues[tgt] = v;
    }
    const existingCostIntro = await prisma.phaseCost.findUnique({
      where: {
        phaseId_entityType_entityId: {
          phaseId: introPhase.id,
          entityType: 'PRODUCT_MASTER',
          entityId: m.id,
        },
      },
    });
    if (!existingCostIntro) {
      if (!dryRun) {
        await prisma.phaseCost.create({
          data: {
            phaseId: introPhase.id,
            entityType: 'PRODUCT_MASTER',
            entityId: m.id,
            ...costMasterValues,
          },
        });
      }
      console.log(`  ${m.articleNumber}/${m.skuCode}: insert PhaseCost@${introPhase.name} (${Object.keys(costMasterValues).length} fields)`);
      inserted++;
    } else {
      const merge: Record<string, unknown> = {};
      for (const k of Object.keys(costMasterValues)) {
        const cur = (existingCostIntro as unknown as Record<string, unknown>)[k];
        if (cur === null || cur === undefined) merge[k] = costMasterValues[k];
      }
      if (Object.keys(merge).length > 0) {
        if (!dryRun) {
          await prisma.phaseCost.update({
            where: {
              phaseId_entityType_entityId: {
                phaseId: introPhase.id,
                entityType: 'PRODUCT_MASTER',
                entityId: m.id,
              },
            },
            data: merge,
          });
        }
        console.log(`  ${m.articleNumber}/${m.skuCode}: merge PhaseCost@${introPhase.name} (${Object.keys(merge).length} fields)`);
        merged++;
      }
    }

    // STEP 3: walk the (now backfilled) changelog and compute latest-resolved.
    const [fabricRows, costRows] = await Promise.all([
      prisma.phaseFabric.findMany({ where: { productMasterId: m.id } }),
      prisma.phaseCost.findMany({
        where: { entityType: 'PRODUCT_MASTER', entityId: m.id },
      }),
    ]);
    const sortedFabric = (fabricRows as Array<Record<string, unknown>>).sort(
      (a, b) => (phaseNumberById.get(String(a.phaseId)) ?? 0) - (phaseNumberById.get(String(b.phaseId)) ?? 0),
    );
    const sortedCost = (costRows as Array<Record<string, unknown>>).sort(
      (a, b) => (phaseNumberById.get(String(a.phaseId)) ?? 0) - (phaseNumberById.get(String(b.phaseId)) ?? 0),
    );
    const resolvedFabric = applyChangelog(sortedFabric, FABRIC_FIELDS as readonly string[], {});
    const resolvedCost = applyChangelog(sortedCost, COST_FIELDS as readonly string[], {});

    // STEP 4: overwrite master fabric/cost columns with resolved-at-latest.
    const masterPatch: Record<string, unknown> = {};
    const writeIfDiff = (key: string, v: unknown) => {
      const cur = (m as unknown as Record<string, unknown>)[key];
      if (v !== undefined && v !== null && String(cur) !== String(v)) masterPatch[key] = v;
    };
    for (const f of [
      'fabricName', 'fabric2Name', 'fabric3Name', 'fabric4Name',
      'fabricCostPerKg', 'fabric2CostPerKg', 'fabric3CostPerKg', 'fabric4CostPerKg',
      'garmentsPerKg', 'garmentsPerKg2', 'garmentsPerKg3', 'garmentsPerKg4',
    ]) writeIfDiff(f, resolvedFabric[f]);
    for (const f of [
      'stitchingCost', 'brandLogoCost', 'neckTwillCost', 'reflectorsCost',
      'fusingCost', 'accessoriesCost', 'brandTagCost', 'sizeTagCost',
      'packagingCost', 'inwardShipping',
      // fabric*CostPerKg may be in PhaseCost too — prefer PhaseFabric over PhaseCost,
      // but here resolvedCost may have a more recent value.
      'fabricCostPerKg', 'fabric2CostPerKg',
    ]) writeIfDiff(f, resolvedCost[f]);

    if (Object.keys(masterPatch).length > 0) {
      if (!dryRun) {
        await prisma.productMaster.update({ where: { id: m.id }, data: masterPatch });
      }
      console.log(`  ${m.articleNumber}/${m.skuCode}: update master columns to current → ${JSON.stringify(masterPatch)}`);
      updatedMasters++;
    }
  }

  console.log('\nSummary:');
  console.log(`  inserts:         ${inserted}`);
  console.log(`  merges:          ${merged}`);
  console.log(`  master updates:  ${updatedMasters}`);
  console.log(`  skipped:         ${skippedNoPhase}`);
  if (dryRun) console.log('  (dry-run; no writes performed)');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
