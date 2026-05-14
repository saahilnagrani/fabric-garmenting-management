# Handoff: Apply PhaseCost when creating a new article order

## Goal

When the order sheet creates a new `Product` (article order) and copies
costs from the chosen `ProductMaster`, also consult `PhaseCost` for the
order's phase. PhaseCost should override master defaults per cost field.

## Problem today

`selectProductMaster` in
`src/components/products/product-order-sheet.tsx` (around line 429)
copies cost fields straight from the master:

```ts
fabricCostPerKg: s(master.fabricCostPerKg) || prev.fabricCostPerKg,
stitchingCost: s(master.stitchingCost) || prev.stitchingCost,
brandLogoCost: s(master.brandLogoCost) || prev.brandLogoCost,
// ... etc
```

`PhaseCost` (per-phase, per-master cost overrides — see
`prisma/schema.prisma` lines 561-585) is **not consulted**. So if the
client team has set per-phase cost overrides on the master sheet, those
overrides are silently ignored when a new order is created in that
phase.

## What "phase-aware cost resolution" looks like

For each cost field, the order should inherit from:

```
PhaseCost(order.phaseId, productMaster.id).<field>  →  fall back to  ProductMaster.<field>
```

Mirrors the per-field-fallback pattern used in the per-article cost
backfill script (see `scripts/backfill_article_order_costs.ts`).

## Affected fields

The same set used by the existing backfill script. Per-field mapping
between PhaseCost source field and Product target field:

```ts
const COST_FIELD_MAP: Array<[string, string]> = [
  ['stitchingCost', 'stitchingCost'],
  ['brandLogoCost', 'brandLogoCost'],
  ['neckTwillCost', 'neckTwillCost'],
  ['reflectorsCost', 'reflectorsCost'],
  ['fusingCost', 'fusingCost'],
  ['accessoriesCost', 'accessoriesCost'],
  ['brandTagCost', 'brandTagCost'],
  ['sizeTagCost', 'sizeTagCost'],
  ['packagingCost', 'packagingCost'],
  ['fabricCostPerKg', 'fabricCostPerKg'],
  ['fabric2CostPerKg', 'fabric2CostPerKg'],
  ['inwardShipping', 'outwardShippingCost'], // legacy: master's "inwardShipping" maps to order's "outwardShippingCost"
  ['proposedMrp', 'proposedMrp'],
];
```

## Where to read

- `src/actions/phase-costs.ts` — existing `getPhaseCosts` /
  `upsertPhaseCost` server actions. Already loads PhaseCost for editing
  in the master sheet.
- `prisma/schema.prisma` — `PhaseCost` model.
- `scripts/backfill_article_order_costs.ts` — has the precedence logic
  already written. Re-use the field map and the "phaseVal ?? masterVal"
  pattern.
- `src/components/products/product-order-sheet.tsx` — `selectProductMaster`
  is the one that needs updating. Today it's a synchronous client-side
  copy; PhaseCost lookup needs to be async (server action call) before
  the form is hydrated.

## Suggested approach

1. Add `getPhaseCostForOrder(masterId, phaseId)` to
   `src/actions/phase-costs.ts` — returns the PhaseCost row or null.
2. In the order sheet, when the user picks a SKU AND a phase is known
   (`phaseId` is a prop on the sheet), call the new action and resolve
   each cost field as `phaseCost?.<field> ?? master.<field>` before
   setting form state.
3. Test: create an order in a phase that has PhaseCost overrides; the
   form should pre-fill with the override values, not the master
   defaults.

## Connection to PhaseFabric handoff

There's a sibling handoff (`docs/handoff-phase-fabric.md`) to add
per-phase fabric tracking. That work also needs to plumb through
`selectProductMaster`. Best to do both in one PR — the resolver that
fetches "what should this order inherit for this phase" can return
PhaseCost AND PhaseFabric in one call.

## Edge cases

- Order is being created without a known phase (rare — phase is a
  required scope on the order sheet). In that case fall back to master
  defaults only.
- PhaseCost row exists but a specific field is null. Treat null as "no
  override" — fall back to master. Don't treat null as "explicitly zero".
- 0 in PhaseCost is a real value (overrides null on master). Keep it.

## Out of scope

- Backfilling existing orders for missed phase costs — the per-article
  backfill script (`scripts/backfill_article_order_costs.ts`) already
  handles this and was used during reconciliation. Use it again per
  article if needed; this handoff is only about new-order inheritance.
