# Handoff: Per-phase fabric tracking + display in article orders

## Goal

Record an article's fabric history per phase on the article master, and
make article orders display the correct fabric for the order's phase
(rather than the master's "current" fabric).

## Why this is needed

Today every `Product` (article order) row stores its own
`fabricName` / `fabric2Name` snapshot at order creation. When a master's
fabric is later changed (e.g. Phase 1: Spectra → Phase 3: Inner Nylon →
Phase 4: Poly Spandex 75/25), the order keeps its stored snapshot, which
is correct. But the article master only has ONE fabric value, so it can
only describe one phase. That breaks two things:

1. **Article master view doesn't communicate fabric history.** The grid
   and sheet show the latest fabric only — there's no UI surface for the
   sequence of fabrics this article has used.
2. **Order display divergence.** When the order sheet shows the order
   alongside live master values (productName, type, etc.), the fabric
   snapshot on the order may differ from the master's current fabric and
   the user can't tell why.

A worked example is article 1005 (Athena, Tank Bra Combo), which used
Spectra+Mirror in phases 1-2, Inner Nylon+Poly Spandex (Mumtaz) in
phase 3, and Inner Nylon+Poly Spandex 75/25 in phase 4. Today the master
shows only the Phase 4 fabric, and orders from phases 1-3 silently
mismatch.

## Affected articles already identified

These articles need their fabric history retroactively populated once the
schema + UI exist (full list in `docs/article-reconciliation-pending.md`
under "Articles with pre-Phase-4 fabric history to reconcile"):

- 1005, 1007-1, 1007-2, 1007-3, 1008-1, 1008-2, 1008-3, 1009-1, 1009-2,
  2005, 2007-1, 2104, 3004, 3111

Each entry has notes on which fabric belonged to which phase.

## Existing data model (read first)

Look in `prisma/schema.prisma`:

- `ProductMaster` — one row per (article, colour) variant. Holds the
  master fabric: `fabricName`, `fabricVendorId` (string FK is via lookup
  helpers in `src/lib/lookups.ts`), `fabricCostPerKg`, `garmentsPerKg`,
  and slot 2/3/4 equivalents. There's no per-phase fabric concept.
- `Product` — one row per (article order). Holds `phaseId`,
  `articleNumber`, `skuCode`, plus its own snapshot of `fabricName` /
  `fabricVendorId` / `fabricCostPerKg` / `assumedFabricGarmentsPerKg`
  (and slot 2 equivalents). The snapshot is set at order creation by
  `selectProductMaster` in `src/components/products/product-order-sheet.tsx`
  — that helper currently copies from the master.
- `PhaseCost` — already exists as a per-(phase, master) override for
  cost fields. Same shape we want for fabric. See lines 561-585 of
  `prisma/schema.prisma`. The existing per-master cost editor lives in
  `src/components/masters/product-master-sheet.tsx` (search for
  `getPhaseCosts`, `upsertPhaseCost`, and the phase-cost section in the
  master sheet UI).

## Reference patterns from this codebase

This project recently shipped two analogous "history-aware" features —
study them before designing PhaseFabric:

1. **`ProductMaster.previousSkuCodes` + `ArticleHistory.previousTypes`**
   for SKU/type renames. The lookup pattern is in
   `src/lib/article-history.ts` (`findProductMasterBySkuCode` etc.) and
   it's wired into order grids and the order sheet to show
   "now: <new value>" tooltips. The order-side display logic is in
   `src/components/products/product-grid.tsx` (cell renderer for
   `type` and `skuCode` columns) and
   `src/components/products/product-order-sheet.tsx` (`liveMaster` block
   near the SheetHeader).
2. **`PhaseCost`** for per-phase cost overrides. See
   `src/actions/phase-costs.ts` and the master sheet's phase-cost
   section.

Mirror these patterns so the new fabric history slots into existing UX
naturally.

## Proposed schema

New table `PhaseFabric`, mirroring `PhaseCost`:

```prisma
model PhaseFabric {
  id              String  @id @default(cuid())
  phaseId         String
  productMasterId String

  fabricName        String?
  fabricVendorId    String?
  fabricCostPerKg   Decimal? @db.Decimal(10, 2)
  garmentsPerKg     Decimal? @db.Decimal(10, 2)

  fabric2Name       String?
  fabric2VendorId   String?
  fabric2CostPerKg  Decimal? @db.Decimal(10, 2)
  garmentsPerKg2    Decimal? @db.Decimal(10, 2)

  // (extend with slot 3/4 if needed)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([phaseId, productMasterId])
  @@index([productMasterId])
}
```

`ProductMaster.fabricName` etc. continues to be the "default" / current
fabric. `PhaseFabric` overrides per phase when set.

## Lookup precedence (the rule for any consumer)

For an order's resolved fabric:

```
PhaseFabric(order.phaseId, productMaster.id) → ProductMaster default
```

Mirrors how `PhaseCost` already overrides the master-level costs. Add a
small helper, e.g. `resolvePhaseFabric(masterId, phaseId)` in
`src/lib/article-history.ts` (or a new file), and use it everywhere
fabric is currently resolved: `selectProductMaster` in the order sheet,
the order grid display, and any reports / exports that show fabric.

## UI surfaces

1. **Master sheet** — add a "Phase-wise fabric" section parallel to
   "Phase-wise costs". Per-phase rows let the user override fabric 1 /
   fabric 2 / cost / g/kg. Empty fields fall back to the master default.
2. **Master grid** — optional indicator (small fabric-history icon) when
   any `PhaseFabric` row exists for an article. Mirror the
   `History` icon already used for SKU/type history (see
   `src/components/masters/product-master-grid.tsx`,
   `articleNumber` column cellRenderer).
3. **Order grid** — `fabricName` / `fabric2Name` column. Today the
   stored order fabric is what's shown. With PhaseFabric, a tooltip can
   confirm "matches phase X fabric" and show "now: <master default>" if
   they differ. Same UX as the existing `type` / `skuCode` info icon.
4. **Order sheet** — when displaying the master's resolved values
   (live), fabric 1/2 should resolve via PhaseFabric for the order's
   phase, then fall back to master default. Update the `liveMaster`
   block accordingly.

## Backfill workflow

Once schema + UI exist:

1. For each article in the pending list, look at the orders' frozen
   fabric snapshots grouped by phase.
2. For each (master, phase) pair where the snapshot fabric differs from
   the master's current default, create a PhaseFabric row capturing the
   historical fabric setup (including vendor, cost, and g/kg for both
   slots).
3. Verify the order sheet now displays the historical fabric for old
   orders and the current fabric for current/future orders.

A backfill script could probably do most of this automatically by
inspecting each article's orders and grouping by phaseId — but client
confirmation per article is likely needed before writing PhaseFabric
rows, since the orders' snapshot might itself be wrong in some cases.

## Order creation flow updates

`selectProductMaster` in `src/components/products/product-order-sheet.tsx`
currently does:

```ts
fabricName: s(master.fabricName),
fabricVendorId: ...,
fabricCostPerKg: ...,
assumedFabricGarmentsPerKg: ...,
```

Update this to consult `PhaseFabric` for the order's phase first:

```ts
const phaseFabric = await getPhaseFabric(masterId, phaseId);
fabricName: phaseFabric?.fabricName ?? master.fabricName,
fabricVendorId: phaseFabric?.fabricVendorId ?? resolvedFabricVendor,
fabricCostPerKg: phaseFabric?.fabricCostPerKg ?? master.fabricCostPerKg,
assumedFabricGarmentsPerKg: phaseFabric?.garmentsPerKg ?? master.garmentsPerKg,
// same for slot 2
```

This ties into the same fix needed for `PhaseCost` (see separate
handoff): both should be resolved together at order creation.

## Connection to PhaseCost handoff

There's a closely related pending task (`docs/handoff-phase-cost-on-order.md`)
to make `selectProductMaster` consult `PhaseCost` for the order's phase.
Both PhaseCost and the new PhaseFabric should be plumbed through the
same code path. Consider doing them in one PR — the helper that resolves
master values for an order's phase can return both phase-cost overrides
and phase-fabric overrides in one call.

## Out of scope for this work

- Migrating fabric data on existing orders. Orders keep their stored
  snapshot — we're just adding the master-side history record and using
  it for display/inheritance, not rewriting orders.
- Fabric change auditing (who changed which fabric when). Schema can
  optionally include `changedBy`/`changedAt` per PhaseFabric row.
