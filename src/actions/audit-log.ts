"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/require-permission";

interface AuditLogFilters {
  entityType?: string;
  action?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }

  const { entityType, action, userId, startDate, endDate, page = 1, pageSize = 50 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize };
}

export async function getEntityById(entityType: string, entityId: string) {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }

  try {
    let entity;
    switch (entityType) {
      case "FabricOrder":
        entity = await db.fabricOrder.findUnique({ where: { id: entityId } });
        break;
      case "FabricMaster":
        entity = await db.fabricMaster.findUnique({ where: { id: entityId } });
        break;
      case "ProductMaster":
        entity = await db.productMaster.findUnique({ where: { id: entityId } });
        break;
      case "Product":
        entity = await db.product.findUnique({ where: { id: entityId } });
        break;
      case "Vendor":
        entity = await db.vendor.findUnique({ where: { id: entityId } });
        break;
      case "Colour":
        entity = await db.colour.findUnique({ where: { id: entityId } });
        break;
      default:
        return null;
    }
    // Serialize to plain object (handles Decimal, Date, etc.)
    return entity ? JSON.parse(JSON.stringify(entity)) : null;
  } catch {
    return null;
  }
}
