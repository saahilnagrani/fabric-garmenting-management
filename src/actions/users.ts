"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { UserRole, InventoryRole, SourcingRole } from "@/generated/prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") throw new Error("Admin access required");
  return session;
}

export async function getUsers() {
  await requireAdmin();
  return db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      inventoryRole: true,
      sourcingRole: true,
      permissionOverrides: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  inventoryRole: InventoryRole | null;
  sourcingRole: SourcingRole | null;
  permissionOverrides: string[];
}) {
  await requireAdmin();

  const existing = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const passwordHash = await hash(data.password, 12);

  await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      inventoryRole: data.inventoryRole,
      sourcingRole: data.sourcingRole,
      permissionOverrides: data.permissionOverrides,
    },
  });

  revalidatePath("/admin/users");
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: UserRole;
    inventoryRole?: InventoryRole | null;
    sourcingRole?: SourcingRole | null;
    permissionOverrides?: string[];
    password?: string;
  }
) {
  await requireAdmin();

  const updateData: Record<string, unknown> = {};

  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (data.inventoryRole !== undefined) updateData.inventoryRole = data.inventoryRole;
  if (data.sourcingRole !== undefined) updateData.sourcingRole = data.sourcingRole;
  if (data.permissionOverrides !== undefined) updateData.permissionOverrides = data.permissionOverrides;
  if (data.password) updateData.passwordHash = await hash(data.password, 12);

  await db.user.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/admin/users");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();

  if (session.user?.id === id) {
    throw new Error("You cannot delete your own account");
  }

  await db.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
