"use server";

import { db } from "@/lib/db";
import { hash, compare } from "bcryptjs";
import { requireAuth } from "@/lib/require-permission";

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.user!.id },
  });

  if (!user) throw new Error("User not found");

  const isValid = await compare(data.currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");

  if (data.newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  const passwordHash = await hash(data.newPassword, 12);

  await db.user.update({
    where: { id: session.user!.id },
    data: { passwordHash },
  });

  return { success: true };
}
