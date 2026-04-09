import type { InventoryRole, SourcingRole } from "@/generated/prisma/client";

// ─── Permission Definitions ─────────────────────────────────────

export const INVENTORY_PERMISSIONS = [
  "inventory:dashboard:view",
  "inventory:products:view",
  "inventory:products:create",
  "inventory:products:edit",
  "inventory:products:edit_status",
  "inventory:products:delete",
  "inventory:fabric_orders:view",
  "inventory:fabric_orders:create",
  "inventory:fabric_orders:edit",
  "inventory:fabric_orders:edit_status",
  "inventory:fabric_orders:delete",
  "inventory:expenses:view",
  "inventory:expenses:create",
  "inventory:expenses:edit",
  "inventory:expenses:delete",
  "inventory:vendors:view",
  "inventory:vendors:create",
  "inventory:vendors:edit",
  "inventory:vendors:delete",
  "inventory:phases:view",
  "inventory:phases:create",
  "inventory:phases:edit",
  "inventory:masters:view",
  "inventory:masters:edit",
  "inventory:lists:view",
  "inventory:lists:edit",
] as const;

export const SOURCING_PERMISSIONS = [
  "sourcing:dashboard:view",
  "sourcing:suppliers:view",
  "sourcing:suppliers:create",
  "sourcing:suppliers:edit",
  "sourcing:suppliers:delete",
  "sourcing:materials:view",
  "sourcing:materials:create",
  "sourcing:materials:edit",
  "sourcing:materials:delete",
  "sourcing:discover:run",
  "sourcing:outreach:view",
  "sourcing:outreach:compose",
  "sourcing:outreach:send",
  "sourcing:settings:view",
  "sourcing:settings:edit",
] as const;

export type Permission =
  | (typeof INVENTORY_PERMISSIONS)[number]
  | (typeof SOURCING_PERMISSIONS)[number];

// ─── Role → Permission Mapping ──────────────────────────────────

const INVENTORY_VIEWER_PERMS: Permission[] = [
  "inventory:dashboard:view",
  "inventory:products:view",
  "inventory:fabric_orders:view",
  "inventory:expenses:view",
  "inventory:vendors:view",
  "inventory:phases:view",
  "inventory:masters:view",
  "inventory:lists:view",
];

const INVENTORY_EDITOR_PERMS: Permission[] = [
  ...INVENTORY_VIEWER_PERMS,
  "inventory:products:create",
  "inventory:products:edit",
  "inventory:fabric_orders:create",
  "inventory:fabric_orders:edit",
  "inventory:expenses:create",
  "inventory:expenses:edit",
  "inventory:vendors:create",
  "inventory:vendors:edit",
  "inventory:masters:edit",
  "inventory:lists:edit",
];

const INVENTORY_MANAGER_PERMS: Permission[] = [
  ...INVENTORY_EDITOR_PERMS,
  "inventory:products:edit_status",
  "inventory:products:delete",
  "inventory:fabric_orders:edit_status",
  "inventory:fabric_orders:delete",
  "inventory:expenses:delete",
  "inventory:vendors:delete",
  "inventory:phases:create",
  "inventory:phases:edit",
];

const SOURCING_VIEWER_PERMS: Permission[] = [
  "sourcing:dashboard:view",
  "sourcing:suppliers:view",
  "sourcing:materials:view",
  "sourcing:outreach:view",
  "sourcing:settings:view",
];

const SOURCING_EDITOR_PERMS: Permission[] = [
  ...SOURCING_VIEWER_PERMS,
  "sourcing:suppliers:create",
  "sourcing:suppliers:edit",
  "sourcing:materials:create",
  "sourcing:materials:edit",
  "sourcing:outreach:compose",
  "sourcing:settings:edit",
];

const SOURCING_MANAGER_PERMS: Permission[] = [
  ...SOURCING_EDITOR_PERMS,
  "sourcing:suppliers:delete",
  "sourcing:materials:delete",
  "sourcing:discover:run",
  "sourcing:outreach:send",
];

export const INVENTORY_ROLE_PERMISSIONS: Record<InventoryRole, Permission[]> = {
  VIEWER: INVENTORY_VIEWER_PERMS,
  EDITOR: INVENTORY_EDITOR_PERMS,
  MANAGER: INVENTORY_MANAGER_PERMS,
};

export const SOURCING_ROLE_PERMISSIONS: Record<SourcingRole, Permission[]> = {
  VIEWER: SOURCING_VIEWER_PERMS,
  EDITOR: SOURCING_EDITOR_PERMS,
  MANAGER: SOURCING_MANAGER_PERMS,
};

// ─── Permission Labels (for admin UI) ───────────────────────────

export const PERMISSION_LABELS: Record<string, string> = {
  "inventory:dashboard:view": "View Dashboard",
  "inventory:products:view": "View Products",
  "inventory:products:create": "Create Products",
  "inventory:products:edit": "Edit Products",
  "inventory:products:edit_status": "Change Product Status",
  "inventory:products:delete": "Delete Products",
  "inventory:fabric_orders:view": "View Fabric Orders",
  "inventory:fabric_orders:create": "Create Fabric Orders",
  "inventory:fabric_orders:edit": "Edit Fabric Orders",
  "inventory:fabric_orders:edit_status": "Change Fabric Order Status",
  "inventory:fabric_orders:delete": "Delete Fabric Orders",
  "inventory:expenses:view": "View Expenses",
  "inventory:expenses:create": "Create Expenses",
  "inventory:expenses:edit": "Edit Expenses",
  "inventory:expenses:delete": "Delete Expenses",
  "inventory:vendors:view": "View Vendors",
  "inventory:vendors:create": "Create Vendors",
  "inventory:vendors:edit": "Edit Vendors",
  "inventory:vendors:delete": "Delete Vendors",
  "inventory:phases:view": "View Phases",
  "inventory:phases:create": "Create Phases",
  "inventory:phases:edit": "Edit Phases",
  "inventory:masters:view": "View Masters",
  "inventory:masters:edit": "Edit Masters",
  "inventory:lists:view": "View Lists",
  "inventory:lists:edit": "Edit Lists",
  "sourcing:dashboard:view": "View Dashboard",
  "sourcing:suppliers:view": "View Suppliers",
  "sourcing:suppliers:create": "Create Suppliers",
  "sourcing:suppliers:edit": "Edit Suppliers",
  "sourcing:suppliers:delete": "Delete Suppliers",
  "sourcing:materials:view": "View Materials",
  "sourcing:materials:create": "Create Materials",
  "sourcing:materials:edit": "Edit Materials",
  "sourcing:materials:delete": "Delete Materials",
  "sourcing:discover:run": "Run Discovery",
  "sourcing:outreach:view": "View Outreach",
  "sourcing:outreach:compose": "Compose Emails",
  "sourcing:outreach:send": "Send Emails",
  "sourcing:settings:view": "View Settings",
  "sourcing:settings:edit": "Edit Settings",
};

// ─── Permission Resolution ──────────────────────────────────────

export interface PermissionContext {
  role: string;
  inventoryRole?: InventoryRole | null;
  sourcingRole?: SourcingRole | null;
  permissionOverrides?: string[];
}

export function getEffectivePermissions(ctx: PermissionContext): Set<Permission> {
  // ADMIN gets everything
  if (ctx.role === "ADMIN") {
    return new Set([...INVENTORY_PERMISSIONS, ...SOURCING_PERMISSIONS]);
  }

  const perms = new Set<Permission>();

  // Add role-based permissions
  if (ctx.inventoryRole) {
    for (const p of INVENTORY_ROLE_PERMISSIONS[ctx.inventoryRole]) {
      perms.add(p);
    }
  }
  if (ctx.sourcingRole) {
    for (const p of SOURCING_ROLE_PERMISSIONS[ctx.sourcingRole]) {
      perms.add(p);
    }
  }

  // Apply overrides
  if (ctx.permissionOverrides) {
    for (const override of ctx.permissionOverrides) {
      if (override.startsWith("+")) {
        perms.add(override.slice(1) as Permission);
      } else if (override.startsWith("-")) {
        perms.delete(override.slice(1) as Permission);
      }
    }
  }

  return perms;
}

export function hasPermission(ctx: PermissionContext, permission: Permission): boolean {
  return getEffectivePermissions(ctx).has(permission);
}

export function hasAnyPermission(ctx: PermissionContext, permissions: Permission[]): boolean {
  const effective = getEffectivePermissions(ctx);
  return permissions.some((p) => effective.has(p));
}

export function hasInventoryAccess(ctx: PermissionContext): boolean {
  return ctx.role === "ADMIN" || ctx.inventoryRole != null;
}

export function hasSourcingAccess(ctx: PermissionContext): boolean {
  return ctx.role === "ADMIN" || ctx.sourcingRole != null;
}
