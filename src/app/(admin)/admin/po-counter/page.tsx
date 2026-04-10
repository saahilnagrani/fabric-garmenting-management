import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash } from "lucide-react";
import { requireAuth } from "@/lib/require-permission";
import { redirect } from "next/navigation";
import { getPoCounters, getCurrentFiscalYear } from "@/actions/po-counter";
import { PoCounterEditor } from "./po-counter-editor";

export default async function PoCounterPage() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [counters, currentFy] = await Promise.all([getPoCounters(), getCurrentFiscalYear()]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">PO Counter</h1>
        <p className="text-muted-foreground">
          Track and reset purchase order numbering per fiscal year. PO numbers follow the
          format <code className="text-xs bg-muted px-1 rounded">HYP/PO/YYYY-YY/0101</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-600" />
            Counter State
            <span className="text-sm font-normal text-muted-foreground">
              (current FY: {currentFy})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Numbers are allocated atomically at the moment a Purchase Order PDF is first
            generated for a vendor batch. Drafts that are never printed do not consume a
            number. Reprinting a previously-issued PO reuses its existing number.
          </p>

          <PoCounterEditor counters={counters} currentFy={currentFy} />

          <div>
            <h3 className="font-semibold mb-1 mt-4">Reset behaviour</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2 text-xs">
              <li>
                Reset clears <strong>all</strong> PO numbers on fabric orders for that fiscal
                year and deletes the counter row. The next allocation starts at 0101.
              </li>
              <li>
                Intended for go-live cleanup after testing. <strong>Do not</strong> use it on a
                live FY where real POs have already been sent to vendors.
              </li>
              <li>
                Underlying fabric orders are not deleted — only their PO number is unset, so
                they fall back to draft state for re-issuance.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
