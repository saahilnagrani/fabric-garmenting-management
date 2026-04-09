import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasPermission, type Permission, type PermissionContext } from "@/lib/permissions";

export async function requirePermission(permission: Permission) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Fetch fresh user data from DB (session may be stale)
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      inventoryRole: true,
      sourcingRole: true,
      permissionOverrides: true,
    },
  });

  // User was deleted or session is stale - treat as unauthenticated
  if (!user) throw new Error("Not authenticated");

  const ctx: PermissionContext = {
    role: user.role,
    inventoryRole: user.inventoryRole,
    sourcingRole: user.sourcingRole,
    permissionOverrides: user.permissionOverrides,
  };

  if (!hasPermission(ctx, permission)) {
    throw new Error("You do not have permission to perform this action");
  }

  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session;
}
