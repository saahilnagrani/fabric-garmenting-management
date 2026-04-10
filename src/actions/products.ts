"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Gender, ProductStatus } from "@/generated/prisma/client";
import { syncExpenseForInvoice } from "./invoice-expense-sync";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import { autoAdvanceProduct } from "@/lib/auto-transitions";
import { validateStatusTransition } from "@/lib/state-machine";
import { autoCreateDispatchesForProduct, type AutoDispatchResult } from "./accessory-dispatches";

/**
 * Rebuilds ProductFabricOrder join rows for a single product.
 * Called after a Product is created or its articleNumber/fabricName/fabric2Name/colourOrdered changes.
 * Deletes all existing join rows for this product, then looks up FabricOrders in the same phase
 * whose articleNumbers string contains this product's articleNumber AND whose fabricName matches
 * either the product's fabric1 (slot 1) or fabric2 (slot 2) AND whose colour matches.
 */
async function syncProductFabricOrderLinks(productId: string) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product || !product.articleNumber) {
    // No article number → nothing to match on
    await db.productFabricOrder.deleteMany({ where: { productId } });
    return;
  }

  await db.productFabricOrder.deleteMany({ where: { productId } });

  // Find all fabric orders in the same phase whose articleNumbers string contains this article #
  const candidates = await db.fabricOrder.findMany({
    where: {
      phaseId: product.phaseId,
      articleNumbers: { contains: product.articleNumber },
    },
    select: { id: true, fabricName: true, colour: true, articleNumbers: true },
  });

  const norm = (s: string | null | undefined) => (s || "").toLowerCase().trim();
  const links: Array<{ productId: string; fabricOrderId: string; fabricSlot: number }> = [];

  for (const fo of candidates) {
    // Verify exact article # match (contains could match "21" inside "210")
    const articleMatch = fo.articleNumbers
      .split(",")
      .map((a) => a.trim())
      .includes(product.articleNumber);
    if (!articleMatch) continue;

    if (norm(fo.colour) !== norm(product.colourOrdered)) continue;

    const slot = fo.fabricName === product.fabricName ? 1 : fo.fabricName === product.fabric2Name ? 2 : null;
    if (slot === null) continue;

    links.push({ productId, fabricOrderId: fo.id, fabricSlot: slot });
  }

  if (links.length > 0) {
    await db.productFabricOrder.createMany({ data: links, skipDuplicates: true });
  }
}

export type ProductFilters = {
  isRepeat?: boolean;
  gender?: Gender;
  status?: ProductStatus;
  fabricVendorId?: string;
  search?: string;
};

export async function getProducts(phaseId: string, filters?: ProductFilters) {
  await requirePermission("inventory:products:view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };

  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;
  if (filters?.gender) where.gender = filters.gender;
  if (filters?.status) where.status = filters.status;
  if (filters?.fabricVendorId) where.fabricVendorId = filters.fabricVendorId;
  if (filters?.search) {
    where.OR = [
      { styleNumber: { contains: filters.search, mode: "insensitive" } },
      { skuCode: { contains: filters.search, mode: "insensitive" } },
      { productName: { contains: filters.search, mode: "insensitive" } },
      { colourOrdered: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.product.findMany({
    where,
    include: { fabricVendor: true, fabric2Vendor: true },
    orderBy: [{ styleNumber: "asc" }, { colourOrdered: "asc" }],
  });
}

export async function getProduct(id: string) {
  await requirePermission("inventory:products:view");
  return db.product.findUnique({
    where: { id },
    include: { fabricVendor: true, fabric2Vendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProduct(data: any) {
  const session = await requirePermission("inventory:products:create");
  const product = await db.product.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "Product", product.id);
  await syncProductFabricOrderLinks(product.id);
  const linkedCount = await db.productFabricOrder.count({ where: { productId: product.id } });
  revalidatePath("/products");
  revalidatePath("/fabric-orders");

  if (product.invoiceNumber) {
    void syncExpenseForInvoice({
      invoiceNumber: product.invoiceNumber,
      previousInvoiceNumber: null,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }

  return { product, linkedCount };
}

/**
 * Derives a prefill object for the Fabric Order sheet from a product.
 * Used when the user clicks "Create matching fabric order" after saving a product
 * that had no existing links. Prefers primary fabric (slot 1).
 */
export async function getFabricOrderPrefillFromProduct(productId: string, slot: 1 | 2 = 1) {
  await requirePermission("inventory:fabric_orders:create");
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return null;

  const fabricName = slot === 1 ? product.fabricName : product.fabric2Name;
  const fabricVendorId = slot === 1 ? product.fabricVendorId : product.fabric2VendorId;
  const costPerUnit = slot === 1 ? product.fabricCostPerKg : product.fabric2CostPerKg;
  const orderedQty = slot === 1 ? product.fabricOrderedQuantityKg : product.fabric2OrderedQuantityKg;

  if (!fabricName || !fabricVendorId) return null;

  return {
    phaseId: product.phaseId,
    fabricName,
    fabricVendorId,
    colour: product.colourOrdered,
    articleNumbers: product.articleNumber || "",
    costPerUnit: costPerUnit ? Number(costPerUnit) : null,
    fabricOrderedQuantityKg: orderedQty ? Number(orderedQty) : null,
    gender: product.gender,
    isRepeat: product.isRepeat,
    orderStatus: "DRAFT_ORDER",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProduct(id: string, data: any) {
  const session = await requirePermission("inventory:products:edit");
  // Fetch previous state to detect invoice number changes
  const previousProduct = await db.product.findUnique({ where: { id } });

  // State machine enforcement: reject invalid manual status transitions
  const statusChanging =
    previousProduct && data.status !== undefined && data.status !== previousProduct.status;
  if (statusChanging) {
    // isRepeat in the new payload takes precedence if included (e.g. user flips both at once)
    const effectiveIsRepeat = data.isRepeat ?? previousProduct.isRepeat;
    const error = validateStatusTransition(
      { status: previousProduct.status, isRepeat: effectiveIsRepeat },
      data.status as ProductStatus
    );
    if (error) {
      throw new Error(error);
    }
    // Stamp statusChangedAt whenever the status actually moves.
    data.statusChangedAt = new Date();
  }

  const product = await db.product.update({ where: { id }, data });
  const changes = previousProduct ? computeDiff(previousProduct as unknown as Record<string, unknown>, product as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Product", id, changes);

  // Re-sync fabric order links if any link-determining field changed
  const linkFieldsChanged =
    previousProduct?.articleNumber !== product.articleNumber ||
    previousProduct?.fabricName !== product.fabricName ||
    previousProduct?.fabric2Name !== product.fabric2Name ||
    previousProduct?.colourOrdered !== product.colourOrdered;
  if (linkFieldsChanged) {
    await syncProductFabricOrderLinks(product.id);
    revalidatePath("/fabric-orders");
  }
  revalidatePath("/products");

  // Sync cutting report values back to ProductMaster (by articleNumber).
  // A cutting report is a per-article measurement, so all SKUs sharing an
  // articleNumber receive the same update so future orders pick it up.
  const crChanged =
    previousProduct?.cuttingReportGarmentsPerKg?.toString() !== product.cuttingReportGarmentsPerKg?.toString() ||
    previousProduct?.cuttingReportGarmentsPerKg2?.toString() !== product.cuttingReportGarmentsPerKg2?.toString();
  if (crChanged && product.articleNumber) {
    const masterData: Record<string, unknown> = {};
    if (product.cuttingReportGarmentsPerKg !== null) {
      masterData.cuttingReportGarmentsPerKg = product.cuttingReportGarmentsPerKg;
    }
    if (product.cuttingReportGarmentsPerKg2 !== null) {
      masterData.cuttingReportGarmentsPerKg2 = product.cuttingReportGarmentsPerKg2;
    }
    if (Object.keys(masterData).length > 0) {
      await db.productMaster.updateMany({
        where: { articleNumber: product.articleNumber },
        data: masterData,
      });
      revalidatePath("/product-masters");
    }
  }

  // Auto-advance product status if evidence has changed (cutting report entered, etc.)
  let autoAdvanced: Awaited<ReturnType<typeof autoAdvanceProduct>> = null;
  if (crChanged) {
    autoAdvanced = await autoAdvanceProduct(
      product.id,
      { id: session.user!.id!, name: session.user!.name! },
      "cutting report entered"
    );
  }

  // Auto-create draft accessory dispatches the first time an article enters
  // CUTTING_REPORT_RECEIVED. Idempotent — safe to fire multiple times. Surfaces
  // a result the caller can render as a toast.
  let dispatchResult: AutoDispatchResult | null = null;
  const enteredCuttingReportReceived =
    (statusChanging && product.status === "CUTTING_REPORT_RECEIVED") ||
    autoAdvanced?.newStatus === "CUTTING_REPORT_RECEIVED";
  if (enteredCuttingReportReceived) {
    dispatchResult = await autoCreateDispatchesForProduct(product.id, {
      id: session.user!.id!,
      name: session.user!.name!,
    });
  }

  // Sync expense if invoice number exists or changed
  const hasInvoice = !!product.invoiceNumber;
  const hadInvoice = !!previousProduct?.invoiceNumber;
  const invoiceChanged = previousProduct?.invoiceNumber !== product.invoiceNumber;
  // Also re-sync if cost/qty fields may have changed (product already has an invoice)
  if (hasInvoice || hadInvoice || invoiceChanged) {
    void syncExpenseForInvoice({
      invoiceNumber: product.invoiceNumber,
      previousInvoiceNumber: invoiceChanged ? previousProduct?.invoiceNumber : null,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }

  return { product, autoAdvanced, dispatchResult };
}

export async function deleteProduct(id: string) {
  const session = await requirePermission("inventory:products:delete");
  const product = await db.product.findUnique({ where: { id } });
  await db.product.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "Product", id);
  revalidatePath("/products");

  if (product?.invoiceNumber) {
    void syncExpenseForInvoice({
      invoiceNumber: null,
      previousInvoiceNumber: product.invoiceNumber,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }
}

export async function getProductLinkedFabricOrders(productId: string) {
  await requirePermission("inventory:products:view");
  const links = await db.productFabricOrder.findMany({
    where: { productId },
    include: {
      fabricOrder: {
        select: {
          id: true,
          fabricName: true,
          colour: true,
          orderStatus: true,
          fabricOrderedQuantityKg: true,
          fabricShippedQuantityKg: true,
          fabricVendor: { select: { name: true } },
        },
      },
    },
    orderBy: { fabricSlot: "asc" },
  });
  return links.map((l) => ({
    id: l.fabricOrder.id,
    fabricName: l.fabricOrder.fabricName,
    colour: l.fabricOrder.colour,
    orderStatus: l.fabricOrder.orderStatus,
    orderedKg: l.fabricOrder.fabricOrderedQuantityKg ? Number(l.fabricOrder.fabricOrderedQuantityKg) : null,
    shippedKg: l.fabricOrder.fabricShippedQuantityKg ? Number(l.fabricOrder.fabricShippedQuantityKg) : null,
    vendorName: l.fabricOrder.fabricVendor?.name || "",
    fabricSlot: l.fabricSlot,
  }));
}

export async function bulkUpdateProductStatus(
  ids: string[],
  status: ProductStatus
) {
  const session = await requirePermission("inventory:products:edit_status");
  await db.product.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  for (const id of ids) {
    logAction(session.user!.id!, session.user!.name!, "UPDATE", "Product", id);
  }
  revalidatePath("/products");
}
