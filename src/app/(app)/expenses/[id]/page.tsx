import { notFound } from "next/navigation";
import { getExpense } from "@/actions/expenses";
import { formatCurrency } from "@/lib/formatters";
import { EXPENSE_TYPE_LABELS, FABRIC_STATUS_LABELS, FABRIC_STATUS_COLORS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft } from "lucide-react";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await getExpense(id);
  if (!expense) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <LinkButton href="/expenses" variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </LinkButton>
        <h1 className="text-2xl font-bold">
          Expense - {expense.invoiceNumber || "No Invoice #"}
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Invoice #</p><p className="font-medium">{expense.invoiceNumber || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{expense.vendor?.name || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{EXPENSE_TYPE_LABELS[expense.specification]}</p></div>
            <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{expense.date ? new Date(expense.date).toLocaleDateString("en-IN") : "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-medium">{expense.quantity || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Amount</p><p className="text-xl font-bold">{formatCurrency(Number(expense.amount))}</p></div>
            <div><p className="text-xs text-muted-foreground">Delivered At</p><p className="font-medium">{expense.deliveredAt || "-"}</p></div>
            <div>
              <p className="text-xs text-muted-foreground">Fabric Status</p>
              {expense.fabricStatus ? (
                <Badge variant="secondary" className={FABRIC_STATUS_COLORS[expense.fabricStatus]}>
                  {FABRIC_STATUS_LABELS[expense.fabricStatus]}
                </Badge>
              ) : <p>-</p>}
            </div>
            <div><p className="text-xs text-muted-foreground">Total Garments</p><p className="font-medium">{expense.totalGarments || "-"}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-xs text-muted-foreground">Description</p><p className="whitespace-pre-wrap text-sm">{expense.description || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Product Note</p><p className="whitespace-pre-wrap text-sm">{expense.productNote || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Note</p><p className="whitespace-pre-wrap text-sm">{expense.note || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Garment Bifurcation</p><p className="whitespace-pre-wrap text-sm font-mono">{expense.garmentBifurcation || "-"}</p></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
