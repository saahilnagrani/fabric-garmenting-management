# Fabric Custody Prototypes

Throwaway visualizations of the proposed fabric custody data-model rework for `fabric-garmenting-management`. **Not a starting point for implementation** — concept-clarification only.

## How to view

Open `index.html` in a browser. Everything is static HTML + Tailwind CDN; no build step, no server, no backend.

## Pages

| # | File | Shows |
|---|---|---|
| 01 | `fabric-orders.html` | Orders grid with expandable receipts timeline. Adds On-order / In-our-hands / At-garmenter columns. One row over-receives 250/200kg with a surplus banner. |
| 02 | `receive-fabric.html` | Sheet for logging a `FabricReceipt`, then post-save branch to allocate or dispatch. |
| 03 | `dispatch-to-garmenter.html` | Form for `GarmenterDispatch`; post-save prompt to allocate at the garmenter. |
| 04 | `garmenter-view.html` | **Headline screen.** Per-garmenter view with every fabric in their custody, allocations, reservations, remaining. Replaces the existing Garmenting Plan PDF. |
| 05 | `article-order-allocation.html` | Article orders grid with stacked allocation cell (from-received + from-expected + shortfall). |
| 06 | `phase-planning.html` | Existing Quantity and Fabric modes, with a "What this commits" panel showing the new `Allocation` rows each click writes. |

## Design

Mirrors the live app at `localhost:3002`:

- **Tokens:** OKLCH variables copied from `globals.css` (light theme).
- **Accent:** terracotta `oklch(0.65 0.16 45)`. Surplus and over-receipt cues reuse it intentionally.
- **Type:** Inter (sans), Roboto Mono (numbers).
- **Layout:** left sidebar + sticky topbar + `main p-6 space-y-4`. Page header is `<h1 class="text-2xl font-bold">` + `<p class="text-sm text-muted-foreground">`.
- **Components:** shadcn-flavoured Button (rounded-lg, 6 variants), Badge (rounded-4xl pill), Card, Sheet, Tabs.
- **Tables:** plain HTML styled to read like AG Grid Quartz.

The thread-bar (horizontal stacked custody bar) and the stacked allocation cell are new visual primitives this rework introduces.

## What's not in here

- Hover states, keyboard nav, live data, accessibility.
- Mobile / responsive (desktop ops tool).
- Actual schema files. The model proposed in chat is `FabricOrder + FabricReceipt + GarmenterDispatch + Allocation (+ Reservation)`. Q1 (lot identity) and Q4 (vendor-direct shipping) still open with the client.

## Replace, don't extend

Once schema decisions land, throw these away. Build against the real components in `src/components/ui/` so the production version inherits theming, AG Grid styling, and shadcn primitive behaviour for free.
