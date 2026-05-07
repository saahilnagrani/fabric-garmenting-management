import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import {
  adaptFabricOrder,
  adaptRealCustody,
  assignFoDisplayNumbers,
  protoNumberFmt,
  synthesizeFabricOrder,
  type SynthAllocation,
} from "@/lib/proto/synthesize";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ g?: string }>;

/**
 * Proto: Garmenters view. For a given garmenter, shows every fabric currently
 * in their custody — dispatched, allocated (per article order), reserved,
 * remaining. Replaces the existing Garmenting Plan PDF with a live, per-
 * garmenter sheet.
 *
 * Garmenters are unioned from two sources to honour the dual-master state
 * the brief flagged: Vendor (type=GARMENTING) + GarmentingLocation. Keyed
 * by name, since the planned merge will resolve identity.
 */
export default async function ProtoGarmentersPage({ searchParams }: { searchParams: SearchParams }) {
  const phase = await getCurrentPhase();
  if (!phase) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Garmenters · proto</h1>
        <p className="text-sm text-muted-foreground">No active phase.</p>
      </div>
    );
  }

  const { g } = await searchParams;

  // 1. Enumerate garmenters from both sources, union by name
  const [vendors, locations, orders] = await Promise.all([
    db.vendor.findMany({
      where: { type: "GARMENTING", isStrikedThrough: false },
      select: { id: true, name: true, contactInfo: true, address: true },
      orderBy: { name: "asc" },
    }),
    db.garmentingLocation.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.fabricOrder.findMany({
      where: { phaseId: phase.id, isStrikedThrough: false },
      orderBy: { createdAt: "desc" },
      include: {
        fabricVendor: { select: { name: true } },
        garmentingAtRef: { select: { name: true } },
        productLinks: {
          include: {
            product: {
              select: {
                id: true,
                articleNumber: true,
                styleNumber: true,
                productName: true,
                fabricOrderedQuantityKg: true,
                garmentingAt: true,
                garmentingAtRef: { select: { name: true } },
              },
            },
          },
        },
        receipts: { orderBy: { receivedAt: "asc" } },
        dispatches: { orderBy: { dispatchedAt: "asc" }, include: { garmenter: { select: { name: true } } } },
        allocations: {
          include: {
            product: { select: { articleNumber: true, styleNumber: true, productName: true } },
            garmenter: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const garmentersByName = new Map<string, { name: string; contactInfo: string | null; address: string | null }>();
  for (const v of vendors) garmentersByName.set(v.name, { name: v.name, contactInfo: v.contactInfo, address: v.address });
  for (const l of locations) {
    if (!garmentersByName.has(l.name)) garmentersByName.set(l.name, { name: l.name, contactInfo: null, address: null });
  }

  // 2. Synthesize all FOs from real data only (no demo overrides).
  // Resolve each FO's garmenter from the FO field first, then fall back to the
  // most-frequent garmenter among its linked Products.
  const synthesized = orders.map((row) => {
    const baseFo = adaptFabricOrder(row);
    const inferredGarm = baseFo.garmentingAtName ?? inferGarmenterFromProducts(row.productLinks);
    const fo = inferredGarm ? { ...baseFo, garmentingAtName: inferredGarm } : baseFo;
    const linkedProducts = row.productLinks.map((link) => ({
      productId: link.product.id,
      articleNumber: link.product.articleNumber,
      styleNumber: link.product.styleNumber,
      productName: link.product.productName,
      demandKg: protoNumberFmt.toNum(link.product.fabricOrderedQuantityKg),
    }));
    const real = adaptRealCustody(row, fo.garmentingAtName);
    return synthesizeFabricOrder(fo, linkedProducts, { real });
  });

  // 3. Aggregate dispatches per garmenter, broken down by (fabric, colour)
  type FabricBlock = {
    fabricName: string;
    colour: string;
    vendorName: string;
    dispatchedKg: number;
    allocations: (SynthAllocation & { fabricOrderId: string; fabricOrderDisplay: string })[];
  };
  type GarmenterAgg = {
    name: string;
    contactInfo: string | null;
    address: string | null;
    blocks: FabricBlock[];
    totalDispatched: number;
    totalAllocated: number;
    totalReserved: number;
    totalFree: number;
    fabricCount: number;
    articleCount: number;
  };

  // Canonical FO display numbers (shared across all proto screens).
  const foDisplayNumber = assignFoDisplayNumbers(synthesized.map((s) => s.fabricOrder), new Map());

  // Group dispatches and allocations by garmenter → fabric+colour
  const byGarmenter = new Map<string, Map<string, FabricBlock>>();

  for (const s of synthesized) {
    for (const d of s.dispatches) {
      // Ensure the garmenter exists in the map even if not in vendors list
      if (!garmentersByName.has(d.garmenterName)) {
        garmentersByName.set(d.garmenterName, { name: d.garmenterName, contactInfo: null, address: null });
      }
      const key = `${s.fabricOrder.fabricName}|||${s.fabricOrder.colour}`;
      const blocks = byGarmenter.get(d.garmenterName) ?? new Map();
      const block: FabricBlock = blocks.get(key) ?? {
        fabricName: s.fabricOrder.fabricName,
        colour: s.fabricOrder.colour,
        vendorName: s.fabricOrder.vendorName,
        dispatchedKg: 0,
        allocations: [],
      };
      block.dispatchedKg += d.qtyKg;
      // attach the order's allocations that landed at THIS garmenter (i.e. all of them — synthesizer puts all at the dispatched garmenter)
      for (const a of s.allocations) {
        if (a.garmenterName === d.garmenterName) {
          block.allocations.push({ ...a, fabricOrderId: s.fabricOrder.id, fabricOrderDisplay: foDisplayNumber.get(s.fabricOrder.id) ?? "" });
        }
      }
      blocks.set(key, block);
      byGarmenter.set(d.garmenterName, blocks);
    }
  }

  // Build the final aggregate per garmenter
  const aggregates: GarmenterAgg[] = [];
  for (const [name, info] of garmentersByName) {
    const blocksMap = byGarmenter.get(name);
    const blocks: FabricBlock[] = blocksMap ? [...blocksMap.values()] : [];
    let totalDispatched = 0;
    let totalAllocated = 0;
    let totalReserved = 0;
    const articleSet = new Set<string>();
    for (const b of blocks) {
      totalDispatched += b.dispatchedKg;
      for (const a of b.allocations) {
        if (a.isReservation) totalReserved += a.qtyKg;
        else {
          totalAllocated += a.qtyKg;
          if (a.productId) articleSet.add(a.productId);
        }
      }
    }
    const totalFree = round1(Math.max(0, totalDispatched - totalAllocated - totalReserved));
    aggregates.push({
      name,
      contactInfo: info.contactInfo,
      address: info.address,
      blocks,
      totalDispatched: round1(totalDispatched),
      totalAllocated: round1(totalAllocated),
      totalReserved: round1(totalReserved),
      totalFree,
      fabricCount: blocks.length,
      articleCount: articleSet.size,
    });
  }

  // Sort: garmenters with custody first (by total dispatched desc), then empty ones alphabetical
  aggregates.sort((a, b) => {
    if (a.totalDispatched > 0 && b.totalDispatched === 0) return -1;
    if (b.totalDispatched > 0 && a.totalDispatched === 0) return 1;
    if (a.totalDispatched !== b.totalDispatched) return b.totalDispatched - a.totalDispatched;
    return a.name.localeCompare(b.name);
  });

  const selectedName = g ?? aggregates[0]?.name ?? null;
  const selected = aggregates.find((a) => a.name === selectedName) ?? aggregates[0];

  if (!selected) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Garmenters</h1>
          <p className="text-sm text-muted-foreground">No garmenters in the system yet. Add a vendor of type GARMENTING.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Garmenters</h1>
          <p className="text-sm text-muted-foreground">
            {aggregates.filter((a) => a.totalDispatched > 0).length} of {aggregates.length} garmenters currently hold fabric · Phase {phase.number} ·{" "}
            <span className="text-[oklch(0.55_0.16_45)] font-medium">prototype</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">Filter ▾</Button>
          <Link href={`/proto/garmenter-sheet?g=${encodeURIComponent(selected.name)}`} target="_blank" rel="noopener">
            <Button size="sm">Print sheet for {selected.name} ↗</Button>
          </Link>
        </div>
      </div>

      {/* Garmenter selector tabs */}
      <div className="flex flex-row items-center gap-1 p-1 rounded-lg border bg-card overflow-x-auto">
        <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap shrink-0">Garmenter</div>
        {aggregates.map((a) => (
          <Link
            key={a.name}
            href={`/proto/garmenters?g=${encodeURIComponent(a.name)}`}
            scroll={false}
            className={cn(
              "px-3 py-1.5 rounded-md text-[13.5px] whitespace-nowrap transition-colors flex items-center gap-2 shrink-0",
              a.name === selected.name ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {a.name}
            <span className={cn("font-mono text-[11px]", a.name === selected.name ? "text-background/70" : "text-muted-foreground")}>{kg(a.totalDispatched)}</span>
          </Link>
        ))}
      </div>

      {/* Garmenter header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Garmenter</div>
            <div className="text-2xl font-bold mt-1">{selected.name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {selected.articleCount} active article order{selected.articleCount === 1 ? "" : "s"} · Phase {phase.number}
            </div>
            {selected.address && (
              <div className="text-[12.5px] text-muted-foreground mt-2 max-w-3xl line-clamp-2">{selected.address}</div>
            )}
            {selected.contactInfo && (
              <div className="text-[12.5px] text-muted-foreground mt-1">contact · <span className="text-foreground">{selected.contactInfo}</span></div>
            )}
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <Card className="grid grid-cols-4 divide-x divide-border p-0 overflow-hidden">
        <Kpi label="total at garmenter" value={selected.totalDispatched} sub={`across ${selected.fabricCount} fabric${selected.fabricCount === 1 ? "" : "s"}`} />
        <Kpi label="allocated" value={selected.totalAllocated} sub={`to ${selected.articleCount} article order${selected.articleCount === 1 ? "" : "s"}`} />
        <Kpi label="reserved" value={selected.totalReserved} sub={selected.totalReserved > 0 ? "sampling, next-phase" : "none"} />
        <Kpi label="free" value={selected.totalFree} sub="unallocated, awaiting plan" />
      </Card>

      {/* Per-fabric blocks */}
      {selected.blocks.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No fabric currently in {selected.name}'s custody. (None of the synthesized dispatches landed here in Phase {phase.number}.)
        </Card>
      ) : (
        <div className="space-y-4">
          {selected.blocks.map((b, i) => (
            <FabricBlockCard key={`${b.fabricName}|${b.colour}|${i}`} block={b} />
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-muted-foreground">
        Garmenters union Vendor (type=GARMENTING) + GarmentingLocation. Custody numbers come from the synthesized dispatches against real FabricOrder rows; allocations use real article numbers from Product.
      </p>
    </div>
  );
}

function FabricBlockCard({
  block,
}: {
  block: {
    fabricName: string;
    colour: string;
    vendorName: string;
    dispatchedKg: number;
    allocations: (SynthAllocation & { fabricOrderDisplay: string })[];
  };
}) {
  const allocated = block.allocations.filter((a) => !a.isReservation).reduce((s, a) => s + a.qtyKg, 0);
  const reserved = block.allocations.filter((a) => a.isReservation).reduce((s, a) => s + a.qtyKg, 0);
  const free = round1(Math.max(0, block.dispatchedKg - allocated - reserved));
  const total = block.dispatchedKg || 1;
  return (
    <Card className="overflow-hidden p-0">
      <header className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b">
        <div className="col-span-5">
          <div className="text-base font-semibold">
            {block.fabricName} · <span className="font-normal">{block.colour}</span>
          </div>
          <div className="text-[12px] text-muted-foreground">{block.vendorName}</div>
        </div>
        <div className="col-span-2"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">dispatched</div><div className="font-mono tabular-nums text-[16px] font-medium">{kg(block.dispatchedKg)}</div></div>
        <div className="col-span-2"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">allocated</div><div className="font-mono tabular-nums text-[16px] font-medium">{kg(allocated)}</div></div>
        <div className="col-span-1"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">reserved</div><div className="font-mono tabular-nums text-[16px] font-medium">{kg(reserved)}</div></div>
        <div className="col-span-2"><div className="text-[11px] text-muted-foreground uppercase tracking-wider">free</div><div className="font-mono tabular-nums text-[16px] font-medium" style={{ color: "oklch(0.50 0.10 140)" }}>{kg(free)}</div></div>
      </header>
      <div className="px-5 pt-4">
        <div className="flex h-2 w-full overflow-hidden rounded-sm border border-border">
          {allocated > 0 && <span className="bg-[oklch(0.65_0.12_75)]" style={{ width: `${(allocated / total) * 100}%` }} />}
          {reserved > 0 && <span className="bg-[oklch(0.55_0.13_310)]" style={{ width: `${(reserved / total) * 100}%` }} />}
          {free > 0 && <span className="bg-[oklch(0.55_0.12_140)]" style={{ width: `${(free / total) * 100}%` }} />}
        </div>
        <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1">
          <span>allocated {kgN(allocated)} kg</span>
          {reserved > 0 && <span>reserved {kgN(reserved)} kg</span>}
          {free > 0 && <span>free {kgN(free)} kg</span>}
        </div>
      </div>
      <div className="p-5">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-left py-2 px-2">Article / purpose</th>
              <th className="text-left py-2 px-2">Source FO</th>
              <th className="text-right py-2 px-2">Qty</th>
              <th className="text-right py-2 px-2">Consumed</th>
              <th className="text-right py-2 px-2">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {block.allocations.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-1.5 px-2">
                  {a.isReservation ? (
                    <Badge className="bg-[oklch(0.95_0.04_310)] text-[oklch(0.40_0.10_310)] border border-[oklch(0.85_0.06_310)]">reservation</Badge>
                  ) : (
                    <Badge className="bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border border-[oklch(0.85_0.06_75)]">allocation</Badge>
                  )}
                </td>
                <td className="py-1.5 px-2">{a.isReservation ? <span className="text-muted-foreground">{a.reservationPurpose ?? "reservation"}</span> : a.productLabel}</td>
                <td className="py-1.5 px-2 text-muted-foreground font-mono text-[12px]">{a.fabricOrderDisplay}</td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums">{kg(a.qtyKg)}</td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted-foreground">{a.consumedKg > 0 ? kg(a.consumedKg) : "—"}</td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums">{kg(Math.max(0, a.qtyKg - a.consumedKg))}</td>
              </tr>
            ))}
            {free > 0 && (
              <tr className="border-t" style={{ color: "oklch(0.50 0.10 140)" }}>
                <td className="py-1.5 px-2"><Badge className="bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border border-[oklch(0.85_0.06_140)]">free</Badge></td>
                <td className="py-1.5 px-2">unallocated · awaiting plan</td>
                <td></td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums">{kg(free)}</td>
                <td></td>
                <td className="py-1.5 px-2 text-right font-mono tabular-nums">{kg(free)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[22px] font-semibold mt-1 font-mono tabular-nums">
        {kgN(value)} <span className="text-[13px] text-muted-foreground">kg</span>
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function kg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
function kgN(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pick the most-frequent garmenter name across a FabricOrder's linked products. */
function inferGarmenterFromProducts(
  links: { product: { garmentingAt: string | null; garmentingAtRef: { name: string } | null } }[]
): string | null {
  const counts = new Map<string, number>();
  for (const link of links) {
    const name = link.product.garmentingAtRef?.name ?? link.product.garmentingAt;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

