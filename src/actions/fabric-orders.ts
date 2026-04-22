"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { syncExpenseForInvoice } from "./invoice-expense-sync";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import { autoAdvanceProductsForFabricOrder } from "@/lib/auto-transitions";
import { ensurePoNumberForGroup } from "@/lib/po-numbering";
import type { FabricOrderStatus } from "@/generated/prisma/client";
import type { FabricOrderAlertFilter } from "@/lib/alert-filters";
import { getAlertRulesMerged } from "./alert-rules";

const TERMINAL_FABRIC_ORDER_STATUSES: FabricOrderStatus[] = ["FULLY_SETTLED"];

/**
 * Rebuilds ProductFabricOrder join rows for a single fabric order.
 * Called after a fabric order is created or its articleNumbers/fabricName/colour changes.
 * Deletes all existing join rows for the order and recreates them from the current
 * articleNumbers string by looking up matching Products in the same phase.
 */
async function syncFabricOrderProductLinks(fabricOrderId: string) {
  const fo = await db.fabricOrder.findUnique({ where: { id: fabricOrderId } });
  if (!fo) return;

  // Clear existing links (cascade does nothing here because we're editing, not deleting)
  await db.productFabricOrder.deleteMany({ where: { fabricOrderId } });

  const articles = fo.articleNumbers.split(",").map((a) => a.trim()).filter(Boolean);
  if (articles.length === 0) return;

  const candidates = await db.product.findMany({
    where: { phaseId: fo.phaseId, articleNumber: { in: articles } },
    select: { id: true, colourOrdered: true, fabricName: true, fabric2Name: true },
  });

  const norm = (s: string | null | undefined) => (s || "").toLowerCase().trim();
  const links: Array<{ productId: string; fabricOrderId: string; fabricSlot: number }> = [];
  for (const p of candidates) {
    if (norm(p.colourOrdered) !== norm(fo.colour)) continue;
    const slot = p.fabricName === fo.fabricName ? 1 : p.fabric2Name === fo.fabricName ? 2 : null;
    if (slot === null) continue;
    links.push({ productId: p.id, fabricOrderId, fabricSlot: slot });
  }

  if (links.length > 0) {
    await db.productFabricOrder.createMany({ data: links, skipDuplicates: true });
  }
}

export async function getFabricOrders(
  phaseId: string,
  filters?: {
    fabricVendorId?: string;
    isRepeat?: boolean;
    /** Alert-driven filter; see src/lib/alert-filters.ts */
    alertFilter?: FabricOrderAlertFilter;
  }
) {
  await requirePermission("inventory:fabric_orders:view");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };
  if (filters?.fabricVendorId) where.fabricVendorId = filters.fabricVendorId;
  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;

  if (filters?.alertFilter === "stale") {
    const rules = await getAlertRulesMerged();
    const staleRule = rules.find((r) => r.id === "stale-state");
    const thresholdDays = staleRule?.thresholdDays ?? 7;
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    where.orderStatus = { notIn: TERMINAL_FABRIC_ORDER_STATUSES };
    where.statusChangedAt = { lt: cutoff };
  } else if (filters?.alertFilter === "unlinked") {
    where.productLinks = { none: {} };
  }

  return db.fabricOrder.findMany({
    where,
    include: { fabricVendor: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getFabricOrdersCountForPhase(phaseId: string): Promise<number> {
  await requirePermission("inventory:fabric_orders:view");
  return db.fabricOrder.count({ where: { phaseId } });
}

export async function getFabricOrder(id: string) {
  await requirePermission("inventory:fabric_orders:view");
  return db.fabricOrder.findUnique({
    where: { id },
    include: { fabricVendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricOrder(data: any) {
  const session = await requirePermission("inventory:fabric_orders:create");
  const order = await db.fabricOrder.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "FabricOrder", order.id);
  await syncFabricOrderProductLinks(order.id);
  const linkedCount = await db.productFabricOrder.count({ where: { fabricOrderId: order.id } });

  // Auto-advance any newly-linked products (e.g. if the new order is already ORDERED/RECEIVED)
  let autoAdvanced: Awaited<ReturnType<typeof autoAdvanceProductsForFabricOrder>> = [];
  if (linkedCount > 0) {
    autoAdvanced = await autoAdvanceProductsForFabricOrder(
      order.id,
      { id: session.user!.id!, name: session.user!.name! },
      `new fabric order ${order.id.slice(-6)} created with status ${order.orderStatus}`
    );
  }

  revalidatePath("/fabric-orders");
  revalidatePath("/products");

  if (order.invoiceNumber) {
    void syncExpenseForInvoice({
      invoiceNumber: order.invoiceNumber,
      previousInvoiceNumber: null,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }

  return { order, linkedCount, autoAdvanced };
}

/**
 * Derives a prefill object for the Product Order sheet from a fabric order.
 * Used when the user clicks "Create matching article order" after saving a fabric order
 * that had no existing links.
 */
export async function getProductPrefillFromFabricOrder(fabricOrderId: string) {
  await requirePermission("inventory:products:create");
  const fo = await db.fabricOrder.findUnique({
    where: { id: fabricOrderId },
    include: { fabricVendor: { select: { id: true, name: true } } },
  });
  if (!fo) return null;

  const firstArticle = fo.articleNumbers.split(",").map((a) => a.trim()).filter(Boolean)[0] || "";
  return {
    phaseId: fo.phaseId,
    articleNumber: firstArticle,
    colourOrdered: fo.colour,
    fabricName: fo.fabricName,
    fabricVendorId: fo.fabricVendorId,
    fabricCostPerKg: fo.costPerUnit ? Number(fo.costPerUnit) : null,
    gender: fo.gender || "MENS",
    isRepeat: fo.isRepeat,
    orderDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    status: "PLANNED",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricOrder(id: string, data: any) {
  const session = await requirePermission("inventory:fabric_orders:edit");
  // Fetch previous state to detect invoice number changes
  const previousOrder = await db.fabricOrder.findUnique({ where: { id } });

  // Stamp statusChangedAt whenever the orderStatus actually moves.
  if (
    previousOrder &&
    data.orderStatus !== undefined &&
    data.orderStatus !== previousOrder.orderStatus
  ) {
    data.statusChangedAt = new Date();
    // Also stamp piReceivedAt and advancePaidAt the first time those states are entered.
    if (data.orderStatus === "PI_RECEIVED" && !previousOrder.piReceivedAt) {
      data.piReceivedAt = new Date();
    }
    if (data.orderStatus === "ADVANCE_PAID" && !previousOrder.advancePaidAt) {
      data.advancePaidAt = new Date();
    }
  }

  const order = await db.fabricOrder.update({ where: { id }, data });
  const changes = previousOrder ? computeDiff(previousOrder as unknown as Record<string, unknown>, order as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "FabricOrder", id, changes);

  // Re-sync product links if articleNumbers / fabricName / colour changed
  const linkFieldsChanged =
    previousOrder?.articleNumbers !== order.articleNumbers ||
    previousOrder?.fabricName !== order.fabricName ||
    previousOrder?.colour !== order.colour;
  if (linkFieldsChanged) {
    await syncFabricOrderProductLinks(order.id);
    revalidatePath("/products");
  }

  // Auto-advance linked products if order status progressed forward
  let autoAdvanced: Awaited<ReturnType<typeof autoAdvanceProductsForFabricOrder>> = [];
  const statusChanged = previousOrder?.orderStatus !== order.orderStatus;
  if (statusChanged) {
    autoAdvanced = await autoAdvanceProductsForFabricOrder(
      order.id,
      { id: session.user!.id!, name: session.user!.name! },
      `fabric order ${order.id.slice(-6)} → ${order.orderStatus}`
    );
    if (autoAdvanced.length > 0) revalidatePath("/products");
  }

  revalidatePath("/fabric-orders");

  // Sync expense if invoice number exists or changed
  const hasInvoice = !!order.invoiceNumber;
  const hadInvoice = !!previousOrder?.invoiceNumber;
  const invoiceChanged = previousOrder?.invoiceNumber !== order.invoiceNumber;
  // Also re-sync if cost/qty fields may have changed (order already has an invoice)
  if (hasInvoice || hadInvoice || invoiceChanged) {
    void syncExpenseForInvoice({
      invoiceNumber: order.invoiceNumber,
      previousInvoiceNumber: invoiceChanged ? previousOrder?.invoiceNumber : null,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }

  return { order, autoAdvanced };
}

export async function deleteFabricOrder(id: string) {
  const session = await requirePermission("inventory:fabric_orders:delete");
  const order = await db.fabricOrder.findUnique({ where: { id } });
  await db.fabricOrder.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "FabricOrder", id);
  revalidatePath("/fabric-orders");

  if (order?.invoiceNumber) {
    void syncExpenseForInvoice({
      invoiceNumber: null,
      previousInvoiceNumber: order.invoiceNumber,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }
}

export async function getFabricOrderLinkedProducts(fabricOrderId: string) {
  await requirePermission("inventory:fabric_orders:view");
  const links = await db.productFabricOrder.findMany({
    where: { fabricOrderId },
    include: {
      product: {
        select: {
          id: true,
          articleNumber: true,
          colourOrdered: true,
          productName: true,
          status: true,
          garmentNumber: true,
        },
      },
    },
  });
  return links.map((l) => ({
    id: l.product.id,
    articleNumber: l.product.articleNumber,
    colourOrdered: l.product.colourOrdered,
    productName: l.product.productName,
    status: l.product.status,
    garmentNumber: l.product.garmentNumber,
    fabricSlot: l.fabricSlot,
  }));
}

export async function findExistingOrdersForFabricColour(
  phaseId: string,
  fabricName: string,
  colour: string,
) {
  await requirePermission("inventory:fabric_orders:view");
  return db.fabricOrder.findMany({
    where: {
      phaseId,
      fabricName,
      colour,
      isStrikedThrough: false,
    },
    select: {
      id: true,
      articleNumbers: true,
      fabricOrderedQuantityKg: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFabricOrdersByIds(ids: string[]) {
  await requirePermission("inventory:fabric_orders:view");
  if (!ids.length) return [];
  return db.fabricOrder.findMany({
    where: { id: { in: ids } },
    include: { fabricVendor: true, phase: true },
    orderBy: [{ fabricVendorId: "asc" }, { fabricName: "asc" }, { colour: "asc" }],
  });
}

/**
 * Fetches fabric orders plus related data needed to render a purchase order:
 * - fabric masters (for HSN codes), keyed by fabricName
 * - garmenter vendors (for shipping addresses), keyed by vendor name
 *   (resolved from FabricOrder.garmentingAt, which stores a location name
 *   that should match a Vendor record of type GARMENTING)
 */
export async function getPurchaseOrderData(ids: string[]) {
  // Allocates new PO numbers for any vendor groups that don't have one yet,
  // so requires :edit, not just :view.
  await requirePermission("inventory:fabric_orders:edit");
  if (!ids.length) return { orders: [], fabricMastersByName: {}, garmentersByName: {}, poNumbersByVendorId: {} as Record<string, string> };

  const orders = await db.fabricOrder.findMany({
    where: { id: { in: ids } },
    include: { fabricVendor: true, phase: true },
    orderBy: [{ fabricVendorId: "asc" }, { fabricName: "asc" }, { colour: "asc" }],
  });

  const fabricNames = [...new Set(orders.map((o) => o.fabricName).filter(Boolean))];
  const garmenterNames = [...new Set(orders.map((o) => o.garmentingAt).filter((n): n is string => !!n))];

  const [fabricMasters, garmenters] = await Promise.all([
    fabricNames.length
      ? db.fabricMaster.findMany({
          where: { fabricName: { in: fabricNames } },
          select: { fabricName: true, hsnCode: true },
        })
      : Promise.resolve([]),
    garmenterNames.length
      ? db.vendor.findMany({
          where: { name: { in: garmenterNames }, type: "GARMENTING" },
          select: { name: true, address: true, contactInfo: true },
        })
      : Promise.resolve([]),
  ]);

  const fabricMastersByName: Record<string, { hsnCode: string | null }> = {};
  for (const fm of fabricMasters) {
    fabricMastersByName[fm.fabricName] = { hsnCode: fm.hsnCode };
  }

  const garmentersByName: Record<string, { name: string; address: string | null; contactInfo: string | null }> = {};
  for (const g of garmenters) {
    garmentersByName[g.name] = { name: g.name, address: g.address, contactInfo: g.contactInfo };
  }

  // Allocate / reuse a PO number per vendor group. Each vendor's bundle of fabric
  // orders becomes a single PO and shares one number; reprints find the existing
  // numbers and don't burn new ones.
  const ordersByVendor = new Map<string, typeof orders>();
  for (const o of orders) {
    const list = ordersByVendor.get(o.fabricVendorId) ?? [];
    list.push(o);
    ordersByVendor.set(o.fabricVendorId, list);
  }

  const poNumbersByVendorId: Record<string, string> = {};
  for (const [vendorId, vendorOrders] of ordersByVendor.entries()) {
    const poNumber = await ensurePoNumberForGroup(vendorOrders.map((o) => o.id));
    poNumbersByVendorId[vendorId] = poNumber;
    // Reflect the freshly-stamped poNumber on the in-memory orders we'll return,
    // so the print page sees the up-to-date value without an extra fetch.
    for (const o of vendorOrders) o.poNumber = poNumber;
  }

  return { orders, fabricMastersByName, garmentersByName, poNumbersByVendorId };
}

export async function mergeOrder(
  existingOrderId: string,
  additionalQty: number,
  additionalStyleNumbers: string[]
) {
  const session = await requirePermission("inventory:fabric_orders:edit");
  const existing = await db.fabricOrder.findUniqueOrThrow({
    where: { id: existingOrderId },
  });

  const currentStyles = (existing.articleNumbers || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mergedStyles = [...new Set([...currentStyles, ...additionalStyleNumbers])];

  const oldQty = Number(existing.fabricOrderedQuantityKg) || 0;
  const newQty = oldQty + additionalQty;

  const updated = await db.fabricOrder.update({
    where: { id: existingOrderId },
    data: {
      fabricOrderedQuantityKg: newQty,
      articleNumbers: mergedStyles.join(", "),
    },
  });

  logAction(session.user!.id!, session.user!.name!, "MERGE", "FabricOrder", existingOrderId, {
    fabricOrderedQuantityKg: { old: oldQty, new: newQty },
    articleNumbers: { old: existing.articleNumbers, new: updated.articleNumbers },
  });

  // Rebuild product links since articleNumbers changed
  await syncFabricOrderProductLinks(existingOrderId);

  revalidatePath("/fabric-orders");
  revalidatePath("/products");
  return updated;
}
