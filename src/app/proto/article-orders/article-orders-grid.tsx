"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ArticleRow = {
  id: string;
  displayNumber: string;
  articleNumber: string | null;
  styleNumber: string;
  productName: string | null;
  colour: string;
  fabricName: string;
  garmenterName: string | null;
  status: string;
  isRepeat: boolean;
  demandKg: number;
  fromReceivedKg: number;
  fromExpectedKg: number;
  shortfallKg: number;
  overKg: number;
  coveragePct: number;
  sources: { foDisplay: string; receivedKg: number; expectedKg: number }[];
};

type GroupBy = "none" | "garmenter" | "fabric" | "status";

export function ArticleOrdersProtoGrid({
  rows,
  totals,
}: {
  rows: ArticleRow[];
  totals: { demand: number; received: number; expected: number; shortfall: number };
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "__all", label: "", rows }];
    const map = new Map<string, ArticleRow[]>();
    for (const r of rows) {
      const key = groupKey(r, groupBy);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, rows]) => ({ key, label: key, rows })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, groupBy]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <Card className="grid grid-cols-4 divide-x divide-border p-0 overflow-hidden">
        <Kpi label="total demand" value={totals.demand} sub={`across ${rows.length} article order${rows.length === 1 ? "" : "s"}`} />
        <Kpi label="from received" value={totals.received} sub="cutting can start now" tone="ok" />
        <Kpi label="from expected" value={totals.expected} sub="awaiting fabric arrival" tone="ochre" />
        <Kpi label="shortfall" value={totals.shortfall} sub={totals.shortfall > 0 ? "needs more fabric ordered" : "fully covered"} tone={totals.shortfall > 0 ? "warn" : undefined} />
      </Card>

      {/* legend + group control */}
      <div className="flex items-center gap-6 text-[12px] flex-wrap">
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm border border-border bg-[oklch(0.55_0.12_140)]" /> from received</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm border border-border bg-[oklch(0.65_0.12_75)]" /> from expected</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm border border-border" style={{ background: "repeating-linear-gradient(45deg,oklch(0.92 0.04 45) 0 4px,oklch(0.86 0.06 45) 4px 8px)" }} /> shortfall</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-2.5 h-2.5 rounded-sm border border-border bg-[oklch(0.65_0.16_45)]" /> over-allocated</span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground">Group by</span>
          <div className="inline-flex items-center bg-muted border rounded-md p-0.5">
            {(["none", "garmenter", "fabric", "status"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setGroupBy(opt)}
                className={cn(
                  "px-2.5 py-1 text-[12.5px] rounded-sm transition-colors",
                  groupBy === opt ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {opt === "none" ? "None" : opt === "garmenter" ? "Garmenter" : opt === "fabric" ? "Fabric" : "Status"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <colgroup>
            <col style={{ width: 56 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 320 }} />
            <col style={{ width: 80 }} />
          </colgroup>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Order</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Article · Fabric</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Colour</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Garmenter</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Demand</th>
              <th className="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Allocation against demand</th>
              <th className="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-muted-foreground">No article orders in this phase.</td>
              </tr>
            )}
            {groups.map((g, gi) => {
              const collapsed = collapsedGroups.has(g.key);
              const isGrouped = groupBy !== "none";
              const groupTotals = g.rows.reduce(
                (acc, r) => {
                  acc.demand += r.demandKg;
                  acc.received += r.fromReceivedKg;
                  return acc;
                },
                { demand: 0, received: 0 }
              );
              return (
                <Fragment key={g.key}>
                  {isGrouped && (
                    <>
                      {gi > 0 && (
                        <tr aria-hidden="true">
                          <td colSpan={8} className="h-3 bg-background border-0" />
                        </tr>
                      )}
                      <tr className="bg-muted/70 border-y border-border cursor-pointer hover:bg-muted" onClick={() => toggleGroup(g.key)}>
                        <td className="px-3 py-2.5">
                          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
                        </td>
                        <td colSpan={4} className="px-3 py-2.5 font-semibold text-[13px]">
                          {g.label}
                          <span className="ml-2 text-[11.5px] text-muted-foreground font-normal">{g.rows.length} order{g.rows.length === 1 ? "" : "s"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[12.5px] font-semibold whitespace-nowrap">{kg(groupTotals.demand)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </>
                  )}
                  {!collapsed && g.rows.map((row, ri) => {
                    const isOpen = openIds.has(row.id);
                    const isLast = isGrouped && ri === g.rows.length - 1;
                    return <RowGroup key={row.id} row={row} isOpen={isOpen} isGrouped={isGrouped} isLast={isLast} onToggle={() => toggle(row.id)} />;
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-[11.5px] text-muted-foreground">
        Allocation cell reads left → right as a stack against demand. Click a row to see which fabric orders back it. Coverage % is allocated/demand.
      </p>
    </div>
  );
}

function RowGroup({ row, isOpen, isGrouped, isLast, onToggle }: { row: ArticleRow; isOpen: boolean; isGrouped: boolean; isLast: boolean; onToggle: () => void }) {
  const indent = isGrouped ? "pl-8" : "px-3";
  const rail = isGrouped ? "border-l-2 border-l-muted" : "";
  const lastBorder = isLast ? "border-b-2 border-b-border" : "border-b";

  // Build the stacked allocation bar
  const total = Math.max(row.demandKg, row.fromReceivedKg + row.fromExpectedKg) || 1;
  const recPct = (row.fromReceivedKg / total) * 100;
  const expPct = (row.fromExpectedKg / total) * 100;
  const shortPct = (row.shortfallKg / total) * 100;
  const overPct = (row.overKg / total) * 100;

  const coverageColor =
    row.coveragePct >= 100 && row.overKg === 0
      ? "text-[oklch(0.50_0.10_140)]"
      : row.overKg > 0
        ? "text-[oklch(0.55_0.16_45)]"
        : "text-[oklch(0.55_0.12_75)]";

  return (
    <>
      <tr className={cn(lastBorder, "hover:bg-muted/40 cursor-pointer", isOpen && "bg-muted/20")} onClick={onToggle}>
        <td className={cn("py-3 align-top", indent, rail)}>
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
        </td>
        <td className="px-3 py-3 align-top whitespace-nowrap">
          <div className="font-mono text-[12.5px] font-medium flex items-center gap-1.5">
            {row.displayNumber}
            {row.isRepeat && (
              <span className="inline-flex items-center px-1 h-3.5 rounded-full text-[8.5px] font-medium uppercase tracking-wider bg-muted border border-border text-muted-foreground">repeat</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.articleNumber ?? row.styleNumber}</div>
        </td>
        <td className="px-3 py-3 align-top">
          <div className="font-medium leading-tight">{row.productName ?? row.styleNumber}</div>
          <div className="text-[12px] text-muted-foreground">{row.fabricName}</div>
        </td>
        <td className="px-3 py-3 align-top">{row.colour}</td>
        <td className="px-3 py-3 align-top">{row.garmenterName ?? <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap">{kg(row.demandKg)}</td>
        <td className="px-3 py-3 align-top">
          <div className="flex h-2.5 w-full overflow-hidden rounded-sm border border-border">
            {recPct > 0 && <span className="bg-[oklch(0.55_0.12_140)]" style={{ width: `${recPct}%` }} />}
            {expPct > 0 && <span className="bg-[oklch(0.65_0.12_75)]" style={{ width: `${expPct}%` }} />}
            {shortPct > 0 && (
              <span style={{ width: `${shortPct}%`, background: "repeating-linear-gradient(45deg,oklch(0.92 0.04 45) 0 4px,oklch(0.86 0.06 45) 4px 8px)" }} />
            )}
            {overPct > 0 && <span className="bg-[oklch(0.65_0.16_45)]" style={{ width: `${overPct}%` }} />}
          </div>
          <div className="flex justify-between text-[10.5px] text-muted-foreground mt-1 font-mono">
            <span>
              {row.fromReceivedKg > 0 && <span>{kgN(row.fromReceivedKg)} received</span>}
              {row.fromReceivedKg > 0 && row.fromExpectedKg > 0 && <span> + </span>}
              {row.fromExpectedKg > 0 && <span>{kgN(row.fromExpectedKg)} expected</span>}
              {row.shortfallKg > 0 && <span> · {kgN(row.shortfallKg)} short</span>}
              {row.overKg > 0 && <span> · +{kgN(row.overKg)} over</span>}
            </span>
            <span className="text-muted-foreground/70">{row.sources.length > 0 ? `${row.sources.length} source FO${row.sources.length === 1 ? "" : "s"}` : "no fabric order yet"}</span>
          </div>
        </td>
        <td className={cn("px-3 py-3 align-top text-right font-mono tabular-nums whitespace-nowrap font-semibold", coverageColor)}>{row.coveragePct}%</td>
      </tr>
      {isOpen && (
        <tr className="border-b bg-muted/20">
          <td></td>
          <td colSpan={7} className="px-3 py-4">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-7">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Backing fabric orders</div>
                {row.sources.length === 0 ? (
                  <div className="text-[12.5px] text-muted-foreground">No fabric order linked yet. Demand is uncovered.</div>
                ) : (
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Source FO</th>
                        <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">From received</th>
                        <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">From expected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.sources.map((s, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1.5 font-mono">{s.foDisplay}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums">{s.receivedKg > 0 ? kg(s.receivedKg) : "—"}</td>
                          <td className="py-1.5 text-right font-mono tabular-nums">{s.expectedKg > 0 ? kg(s.expectedKg) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="col-span-5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Status & action</div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{row.status}</Badge>
                  {row.isRepeat && <Badge variant="outline">repeat order</Badge>}
                </div>
                {row.shortfallKg > 0 && (
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    <span className="text-[oklch(0.55_0.16_45)] font-medium">{kg(row.shortfallKg)} short.</span>{" "}
                    Either bump an existing fabric order, place a new one, or pull from another fabric's surplus (if colours allow).
                  </p>
                )}
                {row.overKg > 0 && (
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                    <span className="text-[oklch(0.55_0.16_45)] font-medium">{kg(row.overKg)} over-allocated.</span>{" "}
                    Surplus is absorbed by this article. Reduce the allocation if it should stay free at the garmenter instead.
                  </p>
                )}
                {row.shortfallKg === 0 && row.overKg === 0 && (
                  <p className="text-[12.5px] text-muted-foreground">Demand fully covered. {row.fromReceivedKg >= row.demandKg ? "Cutting can start." : "Awaiting fabric arrival."}</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "ok" | "ochre" | "warn" }) {
  const color =
    tone === "ok" ? "text-[oklch(0.50_0.10_140)]" :
    tone === "ochre" ? "text-[oklch(0.55_0.12_75)]" :
    tone === "warn" && value > 0 ? "text-[oklch(0.55_0.16_45)]" :
    "";
  return (
    <div className="p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-[22px] font-semibold mt-1 font-mono tabular-nums", color)}>{kgN(value)} <span className="text-[13px] text-muted-foreground">kg</span></div>
      <div className="text-[11.5px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

function groupKey(r: ArticleRow, by: GroupBy): string {
  switch (by) {
    case "garmenter": return r.garmenterName ?? "— no garmenter assigned";
    case "fabric": return `${r.fabricName} · ${r.colour}`;
    case "status": return r.status;
    default: return "__all";
  }
}

function kg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
function kgN(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
