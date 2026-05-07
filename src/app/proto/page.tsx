import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { TestPhaseToggleList } from "./test-phase-toggle";

export const dynamic = "force-dynamic";

const screens = [
  {
    href: "/proto/fabric-orders",
    title: "Fabric orders",
    n: "01",
    status: "live · real DB data",
    blurb:
      "Orders grid with expandable receipts timeline. Adds On-order / In-our-hands / At-garmenter columns. One row force-demos an over-receipt with the surplus banner.",
  },
  {
    href: "/proto/receipts",
    title: "Receipts",
    n: "02",
    status: "live · real DB data",
    blurb:
      "Phase-wide list of every FabricReceipt with its assigned-vs-free split. Audit trail across all FOs. Log new receipts from /proto/fabric-orders.",
  },
  {
    href: "/proto/dispatches",
    title: "Dispatches",
    n: "03",
    status: "live · real DB data",
    blurb:
      "Phase-wide list of every GarmenterDispatch grouped by garmenter. Log new dispatches from /proto/fabric-orders.",
  },
  {
    href: "/proto/garmenters",
    title: "Garmenters",
    n: "04",
    status: "live · real DB data",
    blurb:
      "Per-garmenter view with every fabric in their custody, allocations, reservations, remaining. Replaces the existing Garmenting Plan PDF.",
  },
  {
    href: "/proto/article-orders",
    title: "Article orders & allocation",
    n: "05",
    status: "live · real DB data",
    blurb:
      "Article orders grid with stacked allocation cell (from-received + from-expected + shortfall).",
  },
  {
    href: "/proto/phase-planning",
    title: "Phase planning · both modes",
    n: "06",
    status: "live · real DB data",
    blurb:
      "Existing modes preserved; commits panel shows the new Allocation rows each click writes.",
  },
];

export default async function ProtoIndexPage() {
  const phases = await db.phase.findMany({
    where: { isStrikedThrough: false },
    select: { id: true, number: true, name: true, isCurrent: true, isTestPhase: true },
    orderBy: { number: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fabric custody prototypes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All 6 screens live with real DB reads, plus write-enabled flows for <em>test phases only</em>. Toggle a phase as a test phase below to enable proto writes.
        </p>
      </div>

      <TestPhaseToggleList phases={phases} />

      <div className="grid grid-cols-2 gap-3">
        {screens.map((s) => (
          <Link key={s.href} href={s.status.startsWith("live") ? s.href : `/fabric-prototypes/${slug(s.href)}.html`}>
            <Card className="p-5 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[11.5px] text-muted-foreground">{s.n}</span>
                {s.status.startsWith("live") ? (
                  <Badge className="bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border border-[oklch(0.85_0.06_140)]">
                    {s.status}
                  </Badge>
                ) : s.status.startsWith("static") ? (
                  <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                )}
              </div>
              <div className="font-semibold">{s.title}</div>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{s.blurb}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-[12px] text-muted-foreground border-t pt-4">
        Synthesis logic lives in <code className="text-[11.5px] bg-muted px-1 py-0.5 rounded">src/lib/proto/synthesize.ts</code>. Pure functions; deletes cleanly when the real <code className="text-[11.5px] bg-muted px-1 py-0.5 rounded">FabricReceipt</code> / <code className="text-[11.5px] bg-muted px-1 py-0.5 rounded">GarmenterDispatch</code> / <code className="text-[11.5px] bg-muted px-1 py-0.5 rounded">Allocation</code> tables exist.
      </div>
    </div>
  );
}

function slug(href: string): string {
  // /proto/article-orders → article-order-allocation (the static html naming)
  const map: Record<string, string> = {
    "/proto/fabric-orders": "fabric-orders",
    "/proto/receive-fabric": "receive-fabric",
    "/proto/dispatch": "dispatch-to-garmenter",
    "/proto/garmenters": "garmenter-view",
    "/proto/article-orders": "article-order-allocation",
    "/proto/phase-planning": "phase-planning",
  };
  return map[href] ?? href.replace("/proto/", "");
}
