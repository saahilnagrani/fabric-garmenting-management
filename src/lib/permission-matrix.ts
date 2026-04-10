import type { Permission } from "./permissions";

// Standard CRUD columns shown for every entity row. Cells where the action
// doesn't exist for that entity render as "—" (disabled).
export const STANDARD_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type StandardAction = (typeof STANDARD_ACTIONS)[number];

export type PermissionMatrixEntity = {
  /** Used as React key. */
  key: string;
  /** Human-readable row label, e.g. "Article Orders". */
  label: string;
  /** Maps standard actions to their permission strings. Missing keys render "—". */
  actions: Partial<Record<StandardAction, Permission>>;
  /** Non-standard actions (change status, run, compose, send, etc.). Shown as inline chips in the "Other" column. */
  extras?: { label: string; permission: Permission }[];
};

// ─── Fabric & Garmenting (inventory) matrix ──────────────────────
export const INVENTORY_MATRIX: PermissionMatrixEntity[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: { view: "inventory:dashboard:view" },
  },
  {
    key: "products",
    label: "Article Orders",
    actions: {
      view: "inventory:products:view",
      create: "inventory:products:create",
      edit: "inventory:products:edit",
      delete: "inventory:products:delete",
    },
    extras: [{ label: "Change Status", permission: "inventory:products:edit_status" }],
  },
  {
    key: "fabric_orders",
    label: "Fabric Orders",
    actions: {
      view: "inventory:fabric_orders:view",
      create: "inventory:fabric_orders:create",
      edit: "inventory:fabric_orders:edit",
      delete: "inventory:fabric_orders:delete",
    },
    extras: [{ label: "Change Status", permission: "inventory:fabric_orders:edit_status" }],
  },
  {
    key: "accessories",
    label: "Accessories",
    actions: {
      view: "inventory:accessories:view",
      create: "inventory:accessories:create",
      edit: "inventory:accessories:edit",
      delete: "inventory:accessories:delete",
    },
  },
  {
    key: "expenses",
    label: "Expenses",
    actions: {
      view: "inventory:expenses:view",
      create: "inventory:expenses:create",
      edit: "inventory:expenses:edit",
      delete: "inventory:expenses:delete",
    },
  },
  {
    key: "vendors",
    label: "Vendors",
    actions: {
      view: "inventory:vendors:view",
      create: "inventory:vendors:create",
      edit: "inventory:vendors:edit",
      delete: "inventory:vendors:delete",
    },
  },
  {
    key: "phases",
    label: "Phases",
    actions: {
      view: "inventory:phases:view",
      create: "inventory:phases:create",
      edit: "inventory:phases:edit",
    },
  },
  {
    key: "masters",
    label: "Masters (Fabric / Article)",
    actions: {
      view: "inventory:masters:view",
      edit: "inventory:masters:edit",
    },
  },
  {
    key: "lists",
    label: "Lists (Types / Colours / etc.)",
    actions: {
      view: "inventory:lists:view",
      edit: "inventory:lists:edit",
    },
  },
];

// ─── Sourcing matrix ─────────────────────────────────────────────
export const SOURCING_MATRIX: PermissionMatrixEntity[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: { view: "sourcing:dashboard:view" },
  },
  {
    key: "suppliers",
    label: "Suppliers",
    actions: {
      view: "sourcing:suppliers:view",
      create: "sourcing:suppliers:create",
      edit: "sourcing:suppliers:edit",
      delete: "sourcing:suppliers:delete",
    },
  },
  {
    key: "materials",
    label: "Materials",
    actions: {
      view: "sourcing:materials:view",
      create: "sourcing:materials:create",
      edit: "sourcing:materials:edit",
      delete: "sourcing:materials:delete",
    },
  },
  {
    key: "outreach",
    label: "Outreach",
    actions: {
      view: "sourcing:outreach:view",
    },
    extras: [
      { label: "Compose Emails", permission: "sourcing:outreach:compose" },
      { label: "Send Emails", permission: "sourcing:outreach:send" },
    ],
  },
  {
    key: "discover",
    label: "Discovery",
    actions: {},
    extras: [{ label: "Run Discovery", permission: "sourcing:discover:run" }],
  },
  {
    key: "settings",
    label: "Settings",
    actions: {
      view: "sourcing:settings:view",
      edit: "sourcing:settings:edit",
    },
  },
];
