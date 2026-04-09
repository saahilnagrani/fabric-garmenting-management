"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/require-permission";

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Prisma.Decimal) return val.toNumber();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Syncs an auto-created Expense row for a given invoice number.
 * Called after create/update/delete of FabricOrder or Product.
 */
export async function syncExpenseForInvoice({
  invoiceNumber,
  previousInvoiceNumber,
  sourceType,
  phaseId,
  vendorId,
}: {
  invoiceNumber: string | null | undefined;
  previousInvoiceNumber: string | null | undefined;
  sourceType: "FABRIC_ORDER" | "PRODUCT_ORDER";
  phaseId: string;
  vendorId?: string;
}) {
  try {
    await requirePermission("inventory:expenses:create");
    // Sync new invoice number
    if (invoiceNumber && invoiceNumber.trim()) {
      await syncSingleInvoice(invoiceNumber.trim(), sourceType, phaseId, vendorId);
    }

    // Sync previous invoice number if it changed
    if (
      previousInvoiceNumber &&
      previousInvoiceNumber.trim() &&
      previousInvoiceNumber.trim() !== (invoiceNumber?.trim() || "")
    ) {
      await syncSingleInvoice(previousInvoiceNumber.trim(), sourceType, phaseId, vendorId);
    }

    revalidatePath("/expenses");
  } catch (error) {
    console.error("[syncExpenseForInvoice] failed:", error);
  }
}

async function syncSingleInvoice(
  invoiceNumber: string,
  sourceType: "FABRIC_ORDER" | "PRODUCT_ORDER",
  phaseId: string,
  vendorId?: string,
) {
  await db.$transaction(async (tx) => {
    if (sourceType === "FABRIC_ORDER") {
      await syncFabricOrderExpense(tx, invoiceNumber, phaseId, vendorId);
    } else {
      await syncProductOrderExpense(tx, invoiceNumber, phaseId, vendorId);
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncFabricOrderExpense(tx: any, invoiceNumber: string, phaseId: string, vendorId?: string) {
  // Find all active fabric orders with this invoice number
  const orders = await tx.fabricOrder.findMany({
    where: {
      invoiceNumber,
      isStrikedThrough: false,
    },
  });

  // Find existing auto-created expense for this invoice
  const existingExpense = await tx.expense.findFirst({
    where: {
      invoiceNumber,
      sourceType: "FABRIC_ORDER",
    },
  });

  if (orders.length === 0) {
    // No orders with this invoice - delete the auto expense if it exists
    if (existingExpense) {
      // Clear expenseId on any orders that pointed to this expense
      await tx.fabricOrder.updateMany({
        where: { expenseId: existingExpense.id },
        data: { expenseId: null },
      });
      await tx.expense.delete({ where: { id: existingExpense.id } });
    }
    return;
  }

  // Calculate total: sum(costPerUnit * fabricShippedQuantityKg)
  let totalAmount = 0;
  const articleNumbers: string[] = [];

  for (const order of orders) {
    const cost = toNum(order.costPerUnit);
    const shipped = toNum(order.fabricShippedQuantityKg);
    totalAmount += cost * shipped;
    if (order.articleNumbers && !articleNumbers.includes(order.articleNumbers)) {
      articleNumbers.push(order.articleNumbers);
    }
  }

  // Use vendorId from first order if not provided
  const resolvedVendorId = vendorId || orders[0].fabricVendorId;
  // Use phaseId from first order
  const resolvedPhaseId = orders[0].phaseId || phaseId;

  const description = `Auto: Fabric invoice for ${articleNumbers.join(", ")} (${orders.length} order${orders.length > 1 ? "s" : ""})`;

  if (existingExpense) {
    // Update existing expense
    await tx.expense.update({
      where: { id: existingExpense.id },
      data: {
        amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        description,
        vendorId: resolvedVendorId,
        quantity: `${orders.length} fabric order(s)`,
      },
    });

    // Link all orders to this expense
    await tx.fabricOrder.updateMany({
      where: { invoiceNumber, isStrikedThrough: false },
      data: { expenseId: existingExpense.id },
    });
  } else {
    // Create new expense
    const expense = await tx.expense.create({
      data: {
        phaseId: resolvedPhaseId,
        vendorId: resolvedVendorId,
        invoiceNumber,
        specification: "FABRIC_VENDOR",
        sourceType: "FABRIC_ORDER",
        amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        description,
        quantity: `${orders.length} fabric order(s)`,
        date: new Date(),
      },
    });

    // Link all orders to this expense
    await tx.fabricOrder.updateMany({
      where: { invoiceNumber, isStrikedThrough: false },
      data: { expenseId: expense.id },
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncProductOrderExpense(tx: any, invoiceNumber: string, phaseId: string, vendorId?: string) {
  // Find all active products with this invoice number
  const orders = await tx.product.findMany({
    where: {
      invoiceNumber,
      isStrikedThrough: false,
    },
  });

  // Find existing auto-created expense for this invoice
  const existingExpense = await tx.expense.findFirst({
    where: {
      invoiceNumber,
      sourceType: "PRODUCT_ORDER",
    },
  });

  if (orders.length === 0) {
    // No orders with this invoice - delete the auto expense if it exists
    if (existingExpense) {
      await tx.product.updateMany({
        where: { expenseId: existingExpense.id },
        data: { expenseId: null },
      });
      await tx.expense.delete({ where: { id: existingExpense.id } });
    }
    return;
  }

  // Calculate total: sum(totalGarmentingCost * actualQuantityStitched)
  let totalAmount = 0;
  const styleNumbers: string[] = [];

  for (const order of orders) {
    const garmentingCost =
      toNum(order.stitchingCost) +
      toNum(order.brandLogoCost) +
      toNum(order.neckTwillCost) +
      toNum(order.reflectorsCost) +
      toNum(order.fusingCost) +
      toNum(order.accessoriesCost) +
      toNum(order.brandTagCost) +
      toNum(order.sizeTagCost) +
      toNum(order.packagingCost);

    const actualStitched =
      toNum(order.actualStitchedXS) +
      toNum(order.actualStitchedS) +
      toNum(order.actualStitchedM) +
      toNum(order.actualStitchedL) +
      toNum(order.actualStitchedXL) +
      toNum(order.actualStitchedXXL);

    totalAmount += garmentingCost * actualStitched;

    if (order.styleNumber && !styleNumbers.includes(order.styleNumber)) {
      styleNumbers.push(order.styleNumber);
    }
  }

  // Use phaseId from first order
  const resolvedPhaseId = orders[0].phaseId || phaseId;

  const description = `Auto: Garmenting invoice for ${styleNumbers.join(", ")} (${orders.length} SKU${orders.length > 1 ? "s" : ""})`;

  if (existingExpense) {
    // Update existing expense
    await tx.expense.update({
      where: { id: existingExpense.id },
      data: {
        amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        description,
        vendorId: vendorId || existingExpense.vendorId,
        quantity: `${orders.length} SKU order(s)`,
      },
    });

    // Link all orders to this expense
    await tx.product.updateMany({
      where: { invoiceNumber, isStrikedThrough: false },
      data: { expenseId: existingExpense.id },
    });
  } else {
    // Create new expense
    const expense = await tx.expense.create({
      data: {
        phaseId: resolvedPhaseId,
        vendorId: vendorId || null,
        invoiceNumber,
        specification: "GARMENTING",
        sourceType: "PRODUCT_ORDER",
        amount: new Prisma.Decimal(totalAmount.toFixed(2)),
        description,
        quantity: `${orders.length} SKU order(s)`,
        date: new Date(),
      },
    });

    // Link all orders to this expense
    await tx.product.updateMany({
      where: { invoiceNumber, isStrikedThrough: false },
      data: { expenseId: expense.id },
    });
  }
}
