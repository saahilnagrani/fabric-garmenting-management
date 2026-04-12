Most D2C apparel teams track fabric orders in spreadsheets, juggle WhatsApp threads for garmenter updates, and lose visibility into accessory stock across production phases. This project replaces all of that with one opinionated system built for the Indian garment supply chain.

- **Phase-based planning**: every order, expense, and fabric shipment is tagged to a production phase. Switch phases with one click; the entire app scopes to that window.
- **Fabric-to-garment traceability**: article orders auto-link to fabric orders by article number, colour, and fabric name. Linked orders are cross-navigable.
- **Accessory ledger with carry-forward**: purchases and dispatches are logged per phase. Closing balance of phase N = opening balance of phase N+1, computed on the fly.
- **BOM on article masters**: declare per-piece accessory needs once on a master; dispatches auto-suggest quantities from the BOM.
- **Purchase order generation**: select fabric orders, click "Generate PO", get a print-ready document matching the Ecozen template (Indian GST, amount in words, signatory block).
- **Role-based access with per-permission overrides**: Viewer / Editor / Manager roles plus a matrix of 30+ granular permissions that admins can toggle per user.
- **Feature-flagged modules**: the accessories module is gated behind `NEXT_PUBLIC_FEATURE_ACCESSORIES` so you can demo with or without it.
- **Multiple dark themes**: Classic dark, Dim (reduced contrast), and Cool dark (blue-tinted IDE style), selectable from the avatar menu.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions) |
| Database | PostgreSQL via [Prisma 7](https://prisma.io) |
| Auth | [NextAuth v5](https://authjs.dev) (credentials provider) |
| UI | [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [Base UI](https://base-ui.com) |
| Data Grids | [AG Grid Community v35](https://ag-grid.com) with custom column persistence |
| Fonts | 11 Google Fonts, user-selectable |
| Deployment | Node.js (self-hosted or Vercel) |

---

## Features

### Core Modules

| Module | Description |
|---|---|
| **Dashboard** | Phase overview with alert cards, garment progress, fabric stats, expense breakdown |
| **Article Orders** | Per-SKU production orders with status pipeline, size breakdowns, garmenting cost roll-up |
| **Fabric Orders** | Vendor-scoped fabric procurement with aggregated grid, PO generation, status tracking |
| **Expenses** | Invoice-linked expense ledger with auto-sync from fabric and article orders |
| **Vendors** | Supplier, garmenter, accessories, brand tag vendor registry |
| **Phase Planning** | Phase-level fabric requirement estimation from article master BOM data |

### Accessory Management (feature-flagged)

| Module | Description |
|---|---|
| **Accessories Master DB** | Bulk-create variants (colour x size Cartesian product) in one save |
| **Accessory Purchases** | Phase-tagged purchase ledger |
| **Accessory Dispatches** | Dispatch to garmenter with optional article attribution and BOM-based quantity suggestion |
| **Accessory Balance** | Opening / purchased / dispatched / closing per phase, with carry-forward |

### Masters & Lists

| Module | Description |
|---|---|
| **Fabrics Master DB** | Canonical fabric catalogue with vendor, HSN, MRP, colours, linked articles |
| **Article Master DB** | Style-level catalogue with multi-colour SKU generation, cost breakdown, phase cost overrides |
| **Product Types / Colours / Garmenting Locations / Size Distribution** | Reference data lists used across the app |

### Admin

| Module | Description |
|---|---|
| **Alert Rules** | Editable dashboard alert thresholds (enable/disable, tune days, reset to defaults) |
| **User Management** | Create/edit users with role assignment and per-permission matrix overrides |
| **Audit Log** | Timestamped action log for every create, update, delete, and archive |
| **PO Counter** | Purchase order sequence management |

---

## Architecture

```
src/
  app/
    (app)/            # Main app routes (dashboard, orders, masters, etc.)
    (admin)/          # Admin routes (users, alert rules, audit log)
    (print)/          # Print-optimised routes (purchase orders)
  actions/            # Server actions (one file per domain)
  components/
    layout/           # Sidebar, top bar, alert bell, phase selector
    dashboard/        # Dashboard cards and alerts panel
    products/         # Article order grid + sheet
    fabric-orders/    # Fabric order grid + sheet + merge dialog
    accessories/      # Purchase, dispatch, balance grids + sheets
    masters/          # Fabric master, article master, accessory master
    ag-grid/          # Shared DataGrid wrapper, column management
    theme/            # Appearance provider, controls, popover
    ui/               # shadcn/ui primitives
  lib/
    permissions.ts    # 30+ granular permissions with role mapping
    feature-flags.ts  # Module-level feature gates
    alert-rules-catalog.ts  # Dashboard alert rule definitions
    computations.ts   # Cost roll-up formulas
    audit.ts          # Audit logging helpers
  generated/prisma/   # Prisma client (auto-generated)
prisma/
  schema.prisma       # Database schema
  migrations/         # SQL migration files
```

---

## License

Private. All rights reserved.
