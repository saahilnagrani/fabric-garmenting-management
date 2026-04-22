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
        <h1 className="text-2xl font-bold">Document Counters</h1>
        <p className="text-muted-foreground">
          Track and reset document numbering per fiscal year for fabric POs, accessory POs,
          and accessory dispatch notes. Each document type uses its own sequence and prefix.
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
            Numbers are allocated atomically when a document is first generated for a
            vendor/garmenter group. Drafts that are never issued do not consume a number.
            Reprinting a previously-issued document reuses its existing number.
          </p>

          <PoCounterEditor counters={counters} currentFy={currentFy} />

          <div>
            <h3 className="font-semibold mb-1 mt-4">Reset behaviour</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2 text-xs">
              <li>
                Reset clears <strong>all</strong> numbers of that type on source rows for the
                fiscal year and deletes the counter row. The next allocation starts at 0101.
              </li>
              <li>
                Intended for go-live cleanup after testing. <strong>Do not</strong> use it on a
                live FY where real documents have already been sent out.
              </li>
              <li>
                Underlying records (fabric orders, accessory purchases, dispatches) are not
                deleted — only their PO/DN number is unset, so they revert to draft state.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
