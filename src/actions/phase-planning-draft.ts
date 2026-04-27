"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";

export type DraftPayload = Record<string, unknown>;

export async function saveDraft(phaseId: string, payload: DraftPayload) {
  const session = await requirePermission("inventory:phases:edit");
  const userId = session.user!.id!;
  await db.phasePlanDraft.upsert({
    where: { phaseId_userId: { phaseId, userId } },
    create: { phaseId, userId, payload: payload as object },
    update: { payload: payload as object },
  });
}

export async function loadDraft(
  phaseId: string
): Promise<{ payload: DraftPayload; updatedAt: Date } | null> {
  const session = await requirePermission("inventory:phases:edit");
  const userId = session.user!.id!;
  const draft = await db.phasePlanDraft.findUnique({
    where: { phaseId_userId: { phaseId, userId } },
    select: { payload: true, updatedAt: true },
  });
  if (!draft) return null;
  return { payload: draft.payload as unknown as DraftPayload, updatedAt: draft.updatedAt };
}

export async function deleteDraft(phaseId: string) {
  const session = await requirePermission("inventory:phases:edit");
  const userId = session.user!.id!;
  await db.phasePlanDraft.deleteMany({ where: { phaseId, userId } });
}
