"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { getExpenseWithOrders } from "@/actions/expenses";
import { formatCurrency, formatNumber, formatDecimal } from "@/lib/formatters";
import { EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { computeTotalGarmenting, computeTotalSizeCount } from "@/lib/computations";

type ExpenseWithOrders = NonNullable<Awaited<ReturnType<typeof getExpenseWithOrders>>>;

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && v !== null && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function ExpenseDetailSheet({
  expenseId,
  open,
  onOpenChange,
}: {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [expense, setExpense] = useState<ExpenseWithOrders | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !expenseId) {
      setExpense(null);
      return;
    }
    setLoading(true);
    getExpenseWithOrders(expenseId)
      .then((data) => setExpense(data))
      .finally(() => setLoading(false));
  }, [open, expenseId]);

  const isFabric = expense?.sourceType === "FABRIC_ORDER";
  const isSku = expense?.sourceType === "PRODUCT_ORDER";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[700px] overflow-y-auto border-t-4 border-t-green-500">
        <SheetHeader className="pr-12">
          <div className="flex items-center gap-2">
            <SheetTitle>Expense Details</SheetTitle>
            {expense?.sourceType && expense.sourceType !== "MANUAL" && (
              <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Auto: {isFabric ? "Fabric" : "SKU"}
              </span>
            )}
          </div>
          {expense && (
            <SheetDescription>
              Invoice #{expense.invoiceNumber || "N/A"} &middot; {EXPENSE_TYPE_LABELS[expense.specification] || expense.specification}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && expense && (
          <div className="px-4 pb-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <SummaryBox label="Total Amount" value={formatCurrency(toNum(expense.amount))} highlight />
              <SummaryBox label="Vendor" value={expense.vendor?.name || "-"} />
              <SummaryBox label="Date" value={expense.date ? new Date(expense.date).toLocaleDateString("en-IN") : "-"} />
            </div>
            {expense.description && (
              <p className="text-sm text-muted-foreground">{expense.description}</p>
            )}

            {/* Fabric Orders Table */}
            {isFabric && expense.fabricOrders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Fabric Orders ({expense.fabricOrders.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium">Fabric</th>
                        <th className="px-3 py-2 font-medium">Style #</th>
                        <th className="px-3 py-2 font-medium">Colour</th>
                        <th className="px-3 py-2 font-medium text-right">Cost/kg</th>
                        <th className="px-3 py-2 font-medium text-right">Shipped (kg)</th>
                        <th className="px-3 py-2 font-medium text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {expense.fabricOrders.map((fo) => {
                        const cost = toNum(fo.costPerUnit);
                        const shipped = toNum(fo.fabricShippedQuantityKg);
                        const lineTotal = cost * shipped;
                        return (
                          <tr key={fo.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2">{fo.fabricName}</td>
                            <td className="px-3 py-2">{fo.styleNumbers}</td>
                            <td className="px-3 py-2">{fo.colour}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(cost)}</td>
                            <td className="px-3 py-2 text-right">{formatDecimal(shipped)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-semibold">
                        <td className="px-3 py-2" colSpan={5}>Total</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(
                            expense.fabricOrders.reduce((sum, fo) => sum + toNum(fo.costPerUnit) * toNum(fo.fabricShippedQuantityKg), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formula: Line Total = Cost/kg x Shipped Qty (kg)
                </p>
              </div>
            )}

            {/* SKU Orders Table */}
            {isSku && expense.products.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  SKU/Style Orders ({expense.products.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium">Style #</th>
                        <th className="px-3 py-2 font-medium">Colour</th>
                        <th className="px-3 py-2 font-medium text-right">Garmenting Cost</th>
                        <th className="px-3 py-2 font-medium text-right">Qty Stitched</th>
                        <th className="px-3 py-2 font-medium text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {expense.products.map((p) => {
                        const garmentingCost = computeTotalGarmenting(p);
                        const qtyStitched = computeTotalSizeCount(p);
                        const lineTotal = garmentingCost * qtyStitched;
                        return (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2">{p.styleNumber}</td>
                            <td className="px-3 py-2">{p.colourOrdered}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(garmentingCost)}</td>
                            <td className="px-3 py-2 text-right">{formatNumber(qtyStitched)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-semibold">
                        <td className="px-3 py-2" colSpan={4}>Total</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(
                            expense.products.reduce((sum, p) => {
                              return sum + computeTotalGarmenting(p) * computeTotalSizeCount(p);
                            }, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Formula: Line Total = Total Garmenting Cost x Actual Qty Stitched
                </p>

                {/* Garmenting cost breakdown for each SKU */}
                <details className="mt-2">
                  <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                    View garmenting cost breakdown
                  </summary>
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="px-2 py-1.5 font-medium">Style #</th>
                          <th className="px-2 py-1.5 font-medium">Colour</th>
                          <th className="px-2 py-1.5 font-medium text-right">Stitch</th>
                          <th className="px-2 py-1.5 font-medium text-right">Logo</th>
                          <th className="px-2 py-1.5 font-medium text-right">Twill</th>
                          <th className="px-2 py-1.5 font-medium text-right">Reflect</th>
                          <th className="px-2 py-1.5 font-medium text-right">Fusing</th>
                          <th className="px-2 py-1.5 font-medium text-right">Accs</th>
                          <th className="px-2 py-1.5 font-medium text-right">Tag</th>
                          <th className="px-2 py-1.5 font-medium text-right">Size</th>
                          <th className="px-2 py-1.5 font-medium text-right">Pack</th>
                          <th className="px-2 py-1.5 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {expense.products.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1.5">{p.styleNumber}</td>
                            <td className="px-2 py-1.5">{p.colourOrdered}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.stitchingCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.brandLogoCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.neckTwillCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.reflectorsCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.fusingCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.accessoriesCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.brandTagCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.sizeTagCost))}</td>
                            <td className="px-2 py-1.5 text-right">{formatDecimal(toNum(p.packagingCost))}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{formatDecimal(computeTotalGarmenting(p))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            {/* Manual expense - no linked orders */}
            {expense.sourceType === "MANUAL" && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                This is a manually created expense with no linked orders.
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-green-50 border-green-200" : "bg-muted/30"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}
