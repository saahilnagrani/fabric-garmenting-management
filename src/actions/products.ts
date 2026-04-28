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
import type { ProductAlertFilter } from "@/lib/alert-filters";
import { getAlertRulesMerged } from "./alert-rules";
import { createLookupResolver } from "@/lib/lookups";

/**
 * Bundle 1 dual-write: derive Product FK columns from string fields in `data`.
 * Mutates and returns `data`. Skipped lookups (null FK) leave the column null.
 * Only sets a key if the corresponding string was provided in this update.
 */
async function attachProductLookupIds<T extends Record<string, unknown>>(data: T): Promise<T> {
  const resolver = createLookupResolver();
  if ("colourOrdered" in data) {
    // Single FK only resolves when colourOrdered is a single-colour name in the master.
    // Multi-colour combos like "A/B/C" don't match any single Colour row; the per-slot
    // representation lives in ProductColour, synced by syncProductColourLinks below.
    (data as Record<string, unknown>).colourOrderedId = await resolver.colourId(
      data.colourOrdered as string | null | undefined,
    );
  }
  if ("type" in data) {
    (data as Record<string, unknown>).typeRefId = await resolver.productTypeId(
      data.type as string | null | undefined,
    );
  }
  if ("garmentingAt" in data) {
    (data as Record<string, unknown>).garmentingAtId = await resolver.garmentingLocationId(
      data.garmentingAt as string | null | undefined,
    );
  }
  return data;
}

/**
 * Sync ProductColour rows for a product from `data.colourOrdered`. Splits on "/"
 * and inserts one row per slot (1-based). Names that don't match a Colour master
 * are skipped. Existing rows are deleted first so edits stay consistent.
 */
async function syncProductColourLinks(productId: string, data: Record<string, unknown>) {
  if (!("colourOrdered" in data)) return;
  const raw = data.colourOrdered as string | null | undefined;
  await db.productColour.deleteMany({ where: { productId } });
  if (!raw || !raw.trim()) return;
  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return;
  const resolver = createLookupResolver();
  const rows: Array<{ productId: string; colourId: string; slot: number }> = [];
  for (let i = 0; i < parts.length; i++) {
    const colourId = await resolver.colourId(parts[i]);
    if (colourId) rows.push({ productId, colourId, slot: i + 1 });
  }
  if (rows.length > 0) {
    await db.productColour.createMany({ data: rows, skipDuplicates: true });
  }
}

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
  /**
   * Alert-driven filter. When set, the page was reached by clicking a
   * dashboard alert and only rows matching that alert's predicate are
   * returned. Thresholds are re-read from AlertRule so behaviour stays
   * consistent with the admin-edited values.
   */
  alertFilter?: ProductAlertFilter;
};

const TERMINAL_PRODUCT_STATUSES: ProductStatus[] = ["SHIPPED", "DELIVERED"];

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

  // Alert-driven predicates. Applied as additional WHERE clauses so they
  // stack with existing user filters (e.g. alert + search).
  if (filters?.alertFilter === "unshipped") {
    // Phase-deadline alert: non-terminal articles in the current phase.
    where.status = { notIn: TERMINAL_PRODUCT_STATUSES };
  } else if (filters?.alertFilter === "stale") {
    // Stale-state alert: non-terminal articles untouched for > N days.
    const rules = await getAlertRulesMerged();
    const staleRule = rules.find((r) => r.id === "stale-state");
    const thresholdDays = staleRule?.thresholdDays ?? 7;
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    where.status = { notIn: TERMINAL_PRODUCT_STATUSES };
    where.statusChangedAt = { lt: cutoff };
  } else if (filters?.alertFilter === "unlinked-planned") {
    // Unlinked-products alert: status=PLANNED with zero fabricOrderLinks.
    where.status = "PLANNED";
    where.fabricOrderLinks = { none: {} };
  }

  return db.product.findMany({
    where,
    include: { fabricVendor: true, fabric2Vendor: true },
    orderBy: [{ styleNumber: "asc" }, { colourOrdered: "asc" }],
  });
}

/**
 * Returns the total product count for the current phase, ignoring any
 * alert-driven filter. Used by the filter banner to show "N of M rows".
 */
export async function getProductsCountForPhase(phaseId: string): Promise<number> {
  await requirePermission("inventory:products:view");
  return db.product.count({ where: { phaseId } });
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
  await attachProductLookupIds(data);
  const product = await db.product.create({ data });
  await syncProductColourLinks(product.id, data);
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

  await attachProductLookupIds(data);
  const product = await db.product.update({ where: { id }, data });
  await syncProductColourLinks(id, data);
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

/**
 * Fetch the data needed to render a per-garmenter garmenting plan PDF for a
 * set of article orders. Returns one row per (article order, fabric slot) so
 * the print view can render multiple fabric rows per article and merge cells
 * (article number, expected FG) across them.
 */
export async function getGarmentingPlanData(productIds: string[]) {
  await requirePermission("inventory:products:view");
  if (!productIds.length) return [];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    include: {
      fabricOrderLinks: {
        include: { fabricOrder: { select: { colour: true, fabricOrderedQuantityKg: true, fabricName: true } } },
      },
    },
  });
  type Row = {
    productId: string;
    garmentingAt: string;
    articleNumber: string;
    productName: string;
    type: string;
    fabricSlot: number;
    fabricName: string;
    colour: string;
    fabricQtyKg: number;
    garmentsPerKg: number;
    expectedFG: number;
  };
  const rows: Row[] = [];
  for (const p of products) {
    const target = Number(p.garmentNumber ?? 0);
    const slot1Link = p.fabricOrderLinks.find((l) => l.fabricSlot === 1);
    const slot1Qty = slot1Link?.fabricOrder?.fabricOrderedQuantityKg
      ? Number(slot1Link.fabricOrder.fabricOrderedQuantityKg)
      : Number(p.fabricOrderedQuantityKg ?? 0);
    const slot1Gpk = Number(p.assumedFabricGarmentsPerKg ?? 0);
    const expectedFG = target > 0 ? target : Math.round(slot1Qty * slot1Gpk);

    type Slot = { fabricName: string; colour: string; qtyKg: number; gpk: number };
    const slots = new Map<number, Slot>();
    for (const link of p.fabricOrderLinks) {
      slots.set(link.fabricSlot, {
        fabricName: link.fabricOrder.fabricName || "",
        colour: link.fabricOrder.colour || "",
        qtyKg: Number(link.fabricOrder.fabricOrderedQuantityKg ?? 0),
        gpk:
          link.fabricSlot === 1 ? Number(p.assumedFabricGarmentsPerKg ?? 0) :
          link.fabricSlot === 2 ? Number(p.assumedFabric2GarmentsPerKg ?? 0) :
          0,
      });
    }
    // Fall back to article order's own fabric fields when a slot has no
    // linked fabric order (e.g. older orders or planning-time gaps).
    const colourTokens = (p.colourOrdered || "").split("/").map((c) => c.trim());
    if (!slots.has(1) && p.fabricName) {
      slots.set(1, {
        fabricName: p.fabricName,
        colour: colourTokens[0] || p.colourOrdered || "",
        qtyKg: Number(p.fabricOrderedQuantityKg ?? 0),
        gpk: Number(p.assumedFabricGarmentsPerKg ?? 0),
      });
    }
    if (!slots.has(2) && p.fabric2Name) {
      slots.set(2, {
        fabricName: p.fabric2Name,
        colour: colourTokens[1] || "",
        qtyKg: Number(p.fabric2OrderedQuantityKg ?? 0),
        gpk: Number(p.assumedFabric2GarmentsPerKg ?? 0),
      });
    }

    const sortedSlots = Array.from(slots.entries()).sort(([a], [b]) => a - b);
    for (const [slotNum, slot] of sortedSlots) {
      rows.push({
        productId: p.id,
        garmentingAt: p.garmentingAt || "",
        articleNumber: p.articleNumber || "",
        productName: p.productName || "",
        type: p.type || "",
        fabricSlot: slotNum,
        fabricName: slot.fabricName,
        colour: slot.colour,
        fabricQtyKg: slot.qtyKg,
        garmentsPerKg: slot.gpk,
        expectedFG,
      });
    }
  }
  return rows;
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
