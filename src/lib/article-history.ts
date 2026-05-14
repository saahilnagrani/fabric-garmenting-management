import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Convention: the leading digit of an article number indicates the phase
 * the article was introduced in. "2222" → Phase 2, "1007-3" → Phase 1,
 * "3111" → Phase 3. Returns null when the article number doesn't start
 * with a digit (no convention to infer from).
 */
export function articleIntroductionPhaseNumber(articleNumber: string | null | undefined): number | null {
  if (!articleNumber) return null;
  const m = articleNumber.match(/^(\d)/);
  return m ? Number(m[1]) : null;
}

type Tx = Pick<PrismaClient, "productMaster" | "articleHistory">;

/**
 * Find a ProductMaster by skuCode, falling back to previousSkuCodes.
 * Use when resolving an order's stored skuCode that may predate a master rename.
 * Caller passes the same `select` shape they'd pass to Prisma.
 */
export async function findProductMasterBySkuCode(
  tx: Pick<PrismaClient, "productMaster">,
  skuCode: string,
  select?: Record<string, boolean>,
) {
  const current = await tx.productMaster.findUnique({
    where: { skuCode },
    ...(select ? { select } : {}),
  });
  if (current) return current;
  return tx.productMaster.findFirst({
    where: { previousSkuCodes: { has: skuCode } },
    ...(select ? { select } : {}),
  });
}

export async function renameProductMasterSkuCode(
  tx: Tx,
  productMasterId: string,
  newSkuCode: string,
): Promise<void> {
  const row = await tx.productMaster.findUnique({
    where: { id: productMasterId },
    select: { skuCode: true, previousSkuCodes: true },
  });
  if (!row) throw new Error(`ProductMaster ${productMasterId} not found`);
  if (row.skuCode === newSkuCode) return;

  const previous = row.previousSkuCodes.includes(row.skuCode)
    ? row.previousSkuCodes
    : [...row.previousSkuCodes, row.skuCode];

  await tx.productMaster.update({
    where: { id: productMasterId },
    data: { skuCode: newSkuCode, previousSkuCodes: previous },
  });
}

export async function changeArticleType(
  tx: Tx,
  articleNumber: string,
  newType: string,
  newTypeRefId?: string | null,
): Promise<void> {
  const rows = await tx.productMaster.findMany({
    where: { articleNumber },
    select: { id: true, type: true },
  });
  if (rows.length === 0) throw new Error(`No ProductMaster rows for articleNumber=${articleNumber}`);

  const oldTypes = Array.from(
    new Set(rows.map((r: { type: string }) => r.type).filter((t: string) => t && t !== newType)),
  );

  if (oldTypes.length > 0) {
    const history = await tx.articleHistory.findUnique({ where: { articleNumber } });
    const merged = Array.from(new Set([...(history?.previousTypes ?? []), ...oldTypes]));
    await tx.articleHistory.upsert({
      where: { articleNumber },
      create: { articleNumber, previousTypes: merged },
      update: { previousTypes: merged },
    });
  }

  await tx.productMaster.updateMany({
    where: { articleNumber },
    data: newTypeRefId !== undefined ? { type: newType, typeRefId: newTypeRefId } : { type: newType },
  });
}
