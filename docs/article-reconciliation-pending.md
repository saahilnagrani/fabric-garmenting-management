# Pending tasks from the article-master reconciliation session

A running list of follow-ups discovered while reconciling article master rows
against the source-of-truth spreadsheet. These are deferred — not blocking the
per-article reconciliation work — and should be picked up afterward.

## 2107: info icon missing on Phase 3 orders for 2 renamed colours

For article 2107, the article codes for 2 colours were changed at some
point but the existing Phase 3 orders for those colours don't show the
"info icon + tooltip" indicator (Now: <new code>) in the orders grid /
order sheet.

To investigate:
- Confirm which 2 colours and what their old vs new SKU codes are.
- Check whether the master row's `previousSkuCodes` includes the
  historical code that the orders are stored under. If not, seed it.
- Check whether the order's `skuCode` actually differs from the master's
  current `skuCode` after resolving via `previousSkuCodes`. The info-icon
  cell renderer only triggers when `liveSkuCode !== order.skuCode`; if
  they're already equal (or both null), no icon shows.

If `previousSkuCodes` is the gap, seeding it will make the icon appear
without any code change.

## Article master grid + sheet: per-colour archive UX bugs

When some (but not all) colours of an article are archived, the grid and
sheet behave inconsistently:

1. **Grid row stays muted after "Hide Archived"**. With "Show Archived" on,
   the row dims and the archived colours appear in the colours column. After
   toggling to "Hide Archived", the archived colours correctly disappear
   from the column but the row text remains the lighter/dimmed style. Fix:
   row text should be normal weight when at least one active colour
   remains. The "fully archived" case (all colours struck through) is the
   only one that should render dim.

2. **No indication for partially-archived articles**. Need a distinct
   visual cue (badge, icon, or column flag) for rows where some colours
   are archived but the article still has active SKUs — separate from the
   "fully archived" treatment.

3. **Sheet does not strike through archived colours**. When "Show Archived"
   is on and the sheet is opened, the archived colours render normally in
   the colour-variant section. They should show with strikethrough so the
   user can tell at a glance which colours are inactive.

4. **Fabric details should always reflect the latest**. Currently the
   fabric section in the master can shift when archived colours are
   visible. Fabric (and other article-level details) should always show
   the current/latest values regardless of archived visibility — only the
   per-colour rows should change.

## Confirm with client: 3004 reconciliation (multi-fabric phase change)

Article 3004 (Duoflex, Shorts, Garsem) is multi-fabric and the slot
ordering changed across phases:

- **Old setup:** slot 1 = `Imported Lycra` (Global House), slot 2 = `NS Poly`
  (Pugazh)
- **New setup (current master):** slot 1 = `NS Poly` (Pugazh, cost 55,
  g/kg 1.5), slot 2 = `Poly Spandex 75/25` (Swarangi, cost 590, g/kg 5)

Existing 3 FABRIC_RECEIVED orders in Phase 3:
- `M SH03 BLK` Black — old setup (Lycra + NS Poly)
- `M SH03 NVY` Navy — old setup (Lycra + NS Poly)
- `M SH03 GRY` Dark Grey — new setup (NS Poly + Poly Spandex 75/25)

The source-of-truth row for 3004 lists Lycra slot 1 + NS Poly slot 2 with
its own costs (stitch=104, refl=7, fuse=7, st=0, pkg=8.5, MRP=849), which
matches the old setup. Master's current costs differ (refl=4, fuse=0,
st=1.6, pkg=8) and have null MRP.

Open questions for the client:

1. Confirm the new setup is what 3004 should look like going forward (NS
   Poly slot 1 + Poly Spandex 75/25 slot 2) and that the slot 1/2 swap
   is intentional.
2. Per-row costs/g/kg under the new setup — provide the canonical numbers.
3. Should we create historical struck-through rows for the old
   Lycra+NS Poly setup (mirroring 2007-1 / 2104 pattern), or skip
   historical rows for 3004?
4. MRP=849, inwardShipping=10, styleNumber="" — apply now or wait for
   the full picture?

3004 added to the pre-Phase-4 fabric history list below.

## Confirm with client: 2103 colour & fabric reconciliation

Article 2103 (Lumo) has a tangled state that needs client clarification
before reconciling:

- DB master rows: `M TM01 BLK` (Black), `M TM01 BLU` (Blue), `M TM01 PCH`
  (Peach) — all under fabric `Inner Nylon`, type `Mens Round Neck`,
  styleNumber `"-"`, no costs.
- Test Phase orders mirror the master (Black, Blue, Peach + a Yellow
  FABRIC_ORDERED row with sku=null), all on Inner Nylon, type
  `Mens Round Neck`.
- Phase 3 orders are on a different fabric (`Nylon Feel Lycra`) and a
  different type (`Mesh at Back`): `M TM01 BLK` Black, `M TM01 BLU` Sky
  Blue, `M TM01 PIS` Pista.
- Client's source-of-truth row (per spreadsheet) lists 3 colours under
  the new naming: Dark grey (`M RN05 GRY`), Sky Blue (`M RN05 BLU`),
  Pista (`M RN05 PIS`), all under `Nylon Feel Lycra`.

Open questions for the client:

1. Are the original 3 colours (Black / Blue / Peach under Inner Nylon)
   discontinued? If yes, strike them through and create the 3 new
   colours as active under Nylon Feel Lycra.
2. The Phase 3 Black order (`M TM01 BLK`, fabric Nylon Feel Lycra) has
   no current-fabric master row in the client's spreadsheet — was a
   Black colour ever produced under Nylon Feel Lycra, and if so should
   it become an active master row too (or stay as an order pointing to
   the now-struck Black master)?
3. The Yellow Test Phase order (sku=null, fabric Inner Nylon) — is this
   a real production line item we need to reconcile, or test-only?
4. Confirm fabric naming standardization: source-of-truth had
   `Nylon feel Lycra` (lowercase 'feel'); DB has `Nylon Feel Lycra`. Use
   `Nylon Feel Lycra` everywhere?

Once the client clarifies, this is the same pattern as 2005 / 2007-1
(some colours discontinue under old fabric, new active set under new
fabric). Add to the pre-Phase-4 fabric history list when the
PhaseFabric work picks it up.

## Articles with pre-Phase-4 fabric history to reconcile

These articles match the source-of-truth spreadsheet for the current (Phase 4)
fabric setup, but were produced with different fabrics in earlier phases.
They should be revisited once the per-phase fabric tracking work
(`PhaseFabric`, see handoff doc below) is in place:

- 1005 (Spectra+Mirror in phases 1-2, Inner Nylon+Poly Spandex (Mumtaz) in phase 3, Inner Nylon+Poly Spandex 75/25 in phase 4; Wine SKU `W TB01 WIN` already created striked-through with Spectra+Mirror)
- 1007-1, 1007-2, 1007-3
- 1008-1, 1008-2, 1008-3
- 1009-1, 1009-2
- 2005 (Dryfit in earlier phases for Coffee/Kofee, Petrol Blue, Wine; only Kofee continues with Poly Spandex 75/25; Petrol Blue and Wine now striked-through with Dryfit)
- 2007-1 (Dryfit in earlier phases for Light Grey, Dark Grey, Petrol Blue, Wine, Cofee; only Cofee continues with Poly Spandex 75/25; the other 4 now striked-through with Dryfit)
- 2104 (Bubblegum Dot in earlier phases for Navy, Olive, Grey, Light Blue; now on D.Naylon Mesh 1430 with Navy/Olive/Grey continuing, Light Blue newly added under D.Naylon Mesh, Black struck-through)
- 3004 (earlier phases on Lycra/Imported Lycra slot 1 + NS Poly slot 2; now on NS Poly slot 1 + Poly Spandex 75/25 slot 2 — slot ordering also flipped; existing FABRIC_RECEIVED orders for BLK/NVY are on old setup, GRY is on new setup)
- 3111 (Bubblegum Diamond in earlier phases; now on D.Naylon Mesh 1430; existing PLANNED orders snapshot Bubblegum Diamond fabric, master is D.Naylon Mesh)

### The core question to discuss with the client

Across every article in this list, the same problem repeats: a Product
order's `fabricName` is a frozen snapshot taken at order time. When the
master subsequently moves to a different fabric in a later phase, the
order's stored fabric becomes invisible from the article master view —
you can only see the new fabric. But because the order's stored fabric
points to the OLD value, and right now the article master grid + order
sheet only know about the master's CURRENT fabric, the UI ends up showing
the new fabric on the old order. That misrepresents what was actually
ordered.

The right fix is the `PhaseFabric` work (see
`docs/handoff-phase-fabric.md`) — per-phase fabric tracking on the
master. Once that's in place, the master sheet can show "Phase 1
fabric: X, Phase 2 fabric: Y, current: Z" and the order sheet can
correctly resolve the fabric for the order's phase from the master's
phase-keyed history rather than the master's single current value.

For each article in the list above, after `PhaseFabric` is implemented:
- Set the per-phase fabric overrides for past phases (matching what the
  orders' frozen snapshots show).
- Keep the master's "default" / current-phase fabric as-is.
- Verify the order sheet now displays the correct fabric per order.

## Handoff: Per-phase fabric tracking (PhaseFabric)

See `docs/handoff-phase-fabric.md` for the full handoff text — schema
sketch, lookup precedence, UI surfaces, and backfill workflow.

## Handoff: Apply PhaseCost when creating a new order

See `docs/handoff-phase-cost-on-order.md` for the full handoff text —
the helper plumbing, the field map, and the connection to PhaseFabric.

## styleNumber deprecation

`ProductMaster.styleNumber` and `Product.styleNumber` are required `String`
columns. The reconciliation policy is to drop styleNumber from masters going
forward (we've been setting it to `""` on touched rows). Once all articles
are reconciled, plan a migration: make the column optional, then remove it
entirely once no read paths rely on it.

## Schema drift to clean up

When generating the `add_article_history` migration, Prisma diff surfaced
several drops that exist in the live DB but not in `schema.prisma`:

- `ALTER TABLE "Phase" DROP COLUMN "isTestPhase";`
- `DROP TABLE "Allocation";`
- `DROP TABLE "AllocationDispatch";`
- `DROP TABLE "FabricReceipt";`
- `DROP TABLE "GarmenterDispatch";`
- `DROP TYPE "AllocationStage";`

We hand-wrote a clean additive migration to ship the article-history change
without dropping these. Decide whether the DB tables/columns are dead and
should be dropped, or whether `schema.prisma` should be updated to reflect
their existence.
