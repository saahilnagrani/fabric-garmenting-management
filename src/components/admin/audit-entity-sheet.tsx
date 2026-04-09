"use client";

import { useState, useEffect } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { getEntityById } from "@/actions/audit-log";

type AuditEntitySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  changes: string | null;
  action: string;
  timestamp: string;
};

// Fields to exclude from display (internal/meta fields)
const HIDDEN_FIELDS = new Set(["id", "createdAt", "updatedAt", "isStrikedThrough"]);

// Entity type display name overrides
const ENTITY_DISPLAY_NAMES: Record<string, string> = {
  Product: "ProductOrder",
};

type FieldConfig = { key: string; label?: string };

// Ordered field configs per entity type. Only listed fields are shown, in this order.
const ENTITY_FIELD_ORDER: Record<string, FieldConfig[]> = {
  ProductMaster: [
    { key: "articleNumber", label: "Article Number" },
    { key: "productName", label: "Product Name" },
    { key: "type", label: "Product Type" },
    { key: "skuCode", label: "Article Code" },
    { key: "gender" },
    { key: "styleNumber", label: "Style Number (legacy)" },
    { key: "fabricName", label: "Fabric Name" },
    { key: "fabric2Name", label: "Fabric 2 Name" },
    { key: "coloursAvailable", label: "Colours Available" },
    { key: "colours2Available", label: "Colours 2 Available" },
    { key: "garmentsPerKg", label: "Garments Per Kg" },
    { key: "garmentsPerKg2", label: "Garments Per Kg 2" },
    { key: "stitchingCost" }, { key: "brandLogoCost" }, { key: "neckTwillCost" },
    { key: "reflectorsCost" }, { key: "fusingCost" }, { key: "accessoriesCost" },
    { key: "brandTagCost" }, { key: "sizeTagCost" }, { key: "packagingCost" },
    { key: "fabricCostPerKg" }, { key: "fabric2CostPerKg" },
    { key: "inwardShipping" }, { key: "proposedMrp" }, { key: "onlineMrp" },
  ],
  FabricOrder: [
    { key: "fabricName", label: "Fabric Name" },
    { key: "fabricVendorId", label: "Fabric Vendor" },
    { key: "colour" },
    { key: "costPerUnit", label: "Cost Per Unit" },
    { key: "phaseId", label: "Phase" },
    { key: "fabricOrderedQuantityKg", label: "Ordered Qty (kg)" },
    { key: "fabricShippedQuantityKg", label: "Shipped Qty (kg)" },
    { key: "orderStatus", label: "Order Status" },
    { key: "orderDate", label: "Order Date" },
    { key: "garmentingAt", label: "Garmenting At" },
    { key: "invoiceNumber", label: "Invoice Number" },
    { key: "receivedAt", label: "Received At" },
    { key: "articleNumbers", label: "Article Numbers" },
    { key: "gender" },
    { key: "isRepeat", label: "Repeat Order" },
    { key: "expenseId", label: "Expense" },
  ],
  Product: [
    { key: "articleNumber" }, { key: "productName" }, { key: "type", label: "Product Type" },
    { key: "skuCode", label: "Article Code" }, { key: "gender" },
    { key: "phaseId", label: "Phase" }, { key: "status" }, { key: "orderDate" },
    { key: "colourOrdered" }, { key: "isRepeat" },
    { key: "fabricVendorId", label: "Fabric Vendor" }, { key: "fabricName" },
    { key: "fabricGsm" }, { key: "fabricCostPerKg" },
    { key: "assumedFabricGarmentsPerKg" },
    { key: "fabric2Name" }, { key: "fabric2CostPerKg" },
    { key: "assumedFabric2GarmentsPerKg" },
    { key: "fabric2VendorId", label: "Fabric 2 Vendor" },
    { key: "fabricOrderedQuantityKg" }, { key: "fabricShippedQuantityKg" },
    { key: "fabric2OrderedQuantityKg" }, { key: "fabric2ShippedQuantityKg" },
    { key: "garmentNumber" },
    { key: "actualStitchedXS" }, { key: "actualStitchedS" }, { key: "actualStitchedM" },
    { key: "actualStitchedL" }, { key: "actualStitchedXL" }, { key: "actualStitchedXXL" },
    { key: "actualInwardXS" }, { key: "actualInwardS" }, { key: "actualInwardM" },
    { key: "actualInwardL" }, { key: "actualInwardXL" }, { key: "actualInwardXXL" },
    { key: "actualInwardTotal" },
    { key: "stitchingCost" }, { key: "brandLogoCost" }, { key: "neckTwillCost" },
    { key: "reflectorsCost" }, { key: "fusingCost" }, { key: "accessoriesCost" },
    { key: "brandTagCost" }, { key: "sizeTagCost" }, { key: "packagingCost" },
    { key: "outwardShippingCost" }, { key: "proposedMrp" }, { key: "onlineMrp" },
    { key: "garmentingAt" }, { key: "invoiceNumber" }, { key: "expenseId", label: "Expense" },
  ],
  FabricMaster: [
    { key: "fabricName", label: "Fabric Name" },
    { key: "vendorId", label: "Fabric Vendor" },
    { key: "coloursAvailable", label: "Colours" },
    { key: "mrp", label: "Cost per Unit" },
    { key: "genders" },
    { key: "articleNumbers", label: "Article Numbers" },
    { key: "comments" },
  ],
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (value instanceof Date) return value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Id$/, "")
    .trim();
}

export function AuditEntitySheet({
  open,
  onOpenChange,
  entityType,
  entityId,
  changes,
  action,
  timestamp,
}: AuditEntitySheetProps) {
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  // Parse changes to find which fields were modified
  const changedFields = (() => {
    if (!changes) return new Map<string, { old: unknown; new: unknown }>();
    try {
      const parsed = JSON.parse(changes);
      return new Map<string, { old: unknown; new: unknown }>(Object.entries(parsed));
    } catch {
      return new Map<string, { old: unknown; new: unknown }>();
    }
  })();

  useEffect(() => {
    if (open && entityId && entityType) {
      setLoading(true);
      getEntityById(entityType, entityId)
        .then((data) => setEntity(data as Record<string, unknown> | null))
        .catch(() => setEntity(null))
        .finally(() => setLoading(false));
    }
  }, [open, entityId, entityType]);

  const formattedTime = (() => {
    try {
      return new Date(timestamp).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-[520px] w-full overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-sm">{ENTITY_DISPLAY_NAMES[entityType] || entityType}</SheetTitle>
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              action === "CREATE" ? "bg-green-100 text-green-700" :
              action === "DELETE" ? "bg-red-100 text-red-700" :
              action === "ARCHIVE" ? "bg-yellow-100 text-yellow-700" :
              "bg-blue-100 text-blue-700"
            }`}>{action}</span>
          </div>
          <SheetDescription className="text-[11px]">
            {formattedTime} &middot; {changedFields.size > 0 ? `${changedFields.size} field${changedFields.size > 1 ? "s" : ""} changed` : "No field changes recorded"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 px-4 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          )}

          {!loading && !entity && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-muted-foreground">Entity not found (may have been deleted)</span>
            </div>
          )}

          {!loading && entity && (
            <>
              {/* Changed fields first */}
              {changedFields.size > 0 && (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Changes</h4>
                  <div className="space-y-1">
                    {Array.from(changedFields.entries()).map(([field, { old: oldVal, new: newVal }]) => (
                      <div key={field} className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                        <div className="text-[10px] font-medium text-amber-800">{formatFieldName(field)}</div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-red-500 line-through">{formatValue(oldVal)}</span>
                          <span className="text-muted-foreground">&rarr;</span>
                          <span className="text-green-600 font-medium">{formatValue(newVal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All fields */}
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Current State</h4>
                <div className="border rounded divide-y">
                  {(() => {
                    const fieldOrder = ENTITY_FIELD_ORDER[entityType];
                    const entries = fieldOrder
                      ? fieldOrder
                          .filter((f) => f.key in entity)
                          .map((f) => ({ key: f.key, label: f.label || formatFieldName(f.key), value: entity[f.key] }))
                      : Object.entries(entity)
                          .filter(([key]) => !HIDDEN_FIELDS.has(key))
                          .map(([key, value]) => ({ key, label: formatFieldName(key), value }));

                    return entries.map(({ key, label, value }) => {
                      const isChanged = changedFields.has(key);
                      return (
                        <div
                          key={key}
                          className={`flex items-start justify-between px-2 py-1.5 ${isChanged ? "bg-amber-50" : ""}`}
                        >
                          <span className="text-[11px] text-muted-foreground shrink-0 w-[40%]">{label}</span>
                          <span className={`text-[11px] text-right ${isChanged ? "font-medium text-amber-800" : "text-foreground"}`}>
                            {formatValue(value)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
