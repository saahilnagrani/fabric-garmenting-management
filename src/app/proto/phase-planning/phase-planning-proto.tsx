"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "quantity" | "fabric";

type PMOption = { id: string; label: string; fabricName: string | null };
type SampleQuantityArticle = {
  pmId: string;
  styleNumber: string;
  productName: string;
  fabricName: string;
  colour: string;
  qty: number;
  demandKg: number;
  garmenterName: string;
};
type SampleFo = {
  id: string;
  fabricName: string;
  colour: string;
  vendorName: string;
  orderedKg: number;
  shippedKg: number;
} | null;
type SampleFabricAllocation = {
  pmId: string;
  styleNumber: string;
  productName: string;
  qty: number;
  allocateKg: number;
  garmenterName: string;
};

export function PhasePlanningProto({
  phaseNumber,
  productMasterOptions,
  sampleQuantityArticles,
  sampleFo,
  sampleFabricAllocations,
}: {
  phaseNumber: number;
  productMasterOptions: PMOption[];
  sampleQuantityArticles: SampleQuantityArticle[];
  sampleFo: SampleFo;
  sampleFabricAllocations: SampleFabricAllocation[];
}) {
  const [mode, setMode] = useState<Mode>("quantity");

  const totalAllocated = sampleFabricAllocations.reduce((s, a) => s + a.allocateKg, 0);
  const reservationKg = 20.0;
  const fabricPoolAvailable = sampleFo
    ? Math.max(0, sampleFo.orderedKg - 0) // pretend pool = ordered for the demo
    : 0;
  const totalUsed = totalAllocated + reservationKg;
  const free = Math.max(0, fabricPoolAvailable - totalUsed);

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <Card className="p-4 flex items-center gap-4 flex-wrap">
        <div className="text-[12.5px] font-medium">Mode</div>
        <div className="inline-flex items-center bg-muted border rounded-md p-0.5">
          <button
            onClick={() => setMode("quantity")}
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-sm",
              mode === "quantity" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Quantity (demand-first)
          </button>
          <button
            onClick={() => setMode("fabric")}
            className={cn(
              "px-3 py-1.5 text-[13px] font-medium rounded-sm",
              mode === "fabric" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Fabric (allocate-fabric-to-articles)
          </button>
        </div>
        <div className="text-[12px] text-muted-foreground ml-auto">
          Both modes write to the new <span className="font-mono text-[11.5px]">Allocation</span> table under the hood.
        </div>
      </Card>

      {mode === "quantity" ? (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-7 p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Quantity mode</div>
            <h2 className="text-base font-semibold mt-1">Pick articles, set quantities. Fabric demand is derived.</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="space-y-1.5">
                <Label>Phase</Label>
                <Input value={`Phase ${phaseNumber}`} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Default garmenter</Label>
                <Input defaultValue="Mumtaz" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Add article from master</Label>
                <select className="w-full border rounded-md px-3 py-2 text-[14px] bg-background">
                  <option>Search article master…</option>
                  {productMasterOptions.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Selected articles</div>
              <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.6fr_24px] gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium pb-2 border-b">
                <div>Article</div><div>Colour</div><div>Quantity</div><div>Garmenter</div><div className="text-right">Demand</div><div></div>
              </div>
              {sampleQuantityArticles.length === 0 ? (
                <div className="py-4 text-[12.5px] text-muted-foreground">No article masters in DB to populate sample form.</div>
              ) : (
                sampleQuantityArticles.map((a, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.6fr_24px] gap-2 items-center py-2.5 border-b last:border-b-0 text-[13px]">
                    <div>
                      <div className="font-medium leading-tight">{a.productName}</div>
                      <div className="text-[11.5px] text-muted-foreground font-mono">{a.styleNumber}</div>
                    </div>
                    <div>{a.colour}</div>
                    <div><Input className="h-8" defaultValue={String(a.qty)} /></div>
                    <div><Input className="h-8" defaultValue={a.garmenterName} /></div>
                    <div className="text-right font-mono tabular-nums">{a.demandKg.toFixed(1)} kg</div>
                    <div className="text-muted-foreground text-center cursor-pointer">×</div>
                  </div>
                ))
              )}
              <Button variant="outline" size="xs" className="mt-3">+ Add another article</Button>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" size="sm">Save draft</Button>
              <Button size="sm">Create orders</Button>
            </div>
          </Card>

          <CommitsPanel
            mode="quantity"
            productRows={sampleQuantityArticles.map((a, i) => ({
              tempId: `AO-?·${i + 1}`,
              label: `${a.productName} · ${a.colour} · ${a.qty} pcs · ${a.garmenterName}`,
            }))}
            fabricOrderRows={sampleQuantityArticles.map((a, i) => ({
              tempId: `FO-?·${i + 1}`,
              label: `${a.fabricName} · ${a.colour} · ${a.demandKg.toFixed(0)} kg`,
              note: "rounded up to procurement minimum",
            }))}
            allocationRows={sampleQuantityArticles.map((a, i) => ({
              tempId: `ALC-?·${i + 1}`,
              label: `AO·${i + 1} → FO·${i + 1}  ${a.demandKg.toFixed(1)} kg`,
              stage: "expected",
            }))}
            footnote="All allocations start at 'at vendor' stage. They become 'in our hands' when receipts are logged, then 'at garmenter' after dispatch."
          />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-7 p-5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fabric mode</div>
            <h2 className="text-base font-semibold mt-1">Pick a fabric pool, allocate kg across articles.</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="space-y-1.5">
                <Label>Fabric · colour</Label>
                <Input value={sampleFo ? `${sampleFo.fabricName} · ${sampleFo.colour}` : "—"} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Source pool</Label>
                <Input value={sampleFo ? `FO · ${sampleFo.orderedKg.toFixed(0)} kg available · ${sampleFo.vendorName}` : "—"} disabled />
              </div>
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Articles using this fabric</div>
                <div className="text-[11px] text-muted-foreground font-mono">pool: {fabricPoolAvailable.toFixed(1)} kg available</div>
              </div>
              <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.7fr_24px] gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium pb-2 border-b">
                <div>Article</div><div>Colour</div><div>Quantity</div><div>Garmenter</div><div className="text-right">Allocate (kg)</div><div></div>
              </div>
              {sampleFabricAllocations.length === 0 ? (
                <div className="py-4 text-[12.5px] text-muted-foreground">No article masters in DB to populate sample form.</div>
              ) : (
                <>
                  {sampleFabricAllocations.map((a, i) => (
                    <div key={i} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.7fr_24px] gap-2 items-center py-2.5 border-b text-[13px]">
                      <div>
                        <div className="font-medium leading-tight">{a.productName}</div>
                        <div className="text-[11.5px] text-muted-foreground font-mono">{a.styleNumber}</div>
                      </div>
                      <div>{sampleFo?.colour ?? "—"}</div>
                      <div><Input className="h-8" defaultValue={String(a.qty)} /></div>
                      <div><Input className="h-8" defaultValue={a.garmenterName} /></div>
                      <div><Input className="h-8 font-mono text-right" defaultValue={a.allocateKg.toFixed(1)} /></div>
                      <div className="text-muted-foreground text-center cursor-pointer">×</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_1fr_0.7fr_24px] gap-2 items-center py-2.5 border-b text-[13px] text-muted-foreground italic">
                    <div>— sampling reservation</div>
                    <div></div>
                    <div></div>
                    <div><Input className="h-8" defaultValue="Mumtaz" /></div>
                    <div><Input className="h-8 font-mono text-right" defaultValue={reservationKg.toFixed(1)} /></div>
                    <div className="text-muted-foreground text-center cursor-pointer">×</div>
                  </div>
                </>
              )}
              <div className="mt-3 flex items-center justify-between text-[12.5px]">
                <Button variant="outline" size="xs">+ Add another article</Button>
                <div className="font-mono">
                  <span className="text-muted-foreground">total used </span>
                  {totalUsed.toFixed(1)} / {fabricPoolAvailable.toFixed(1)} kg{" "}
                  <span className="text-muted-foreground">· {free.toFixed(1)} kg free</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" size="sm">Save draft</Button>
              <Button size="sm">Create orders</Button>
            </div>
          </Card>

          <CommitsPanel
            mode="fabric"
            productRows={sampleFabricAllocations.map((a, i) => ({
              tempId: `AO-?·${i + 1}`,
              label: `${a.productName} · ${sampleFo?.colour ?? "—"} · ${a.qty} pcs · ${a.garmenterName}`,
            }))}
            fabricOrderRows={
              sampleFo
                ? [{ tempId: sampleFo.id.slice(-6), label: `${sampleFo.fabricName} · ${sampleFo.colour} · existing pool · ${sampleFo.vendorName}`, note: "no new FO created — pool reused" }]
                : []
            }
            allocationRows={[
              ...sampleFabricAllocations.map((a, i) => ({
                tempId: `ALC-?·${i + 1}`,
                label: `AO·${i + 1} → ${sampleFo ? "existing FO" : "FO·?"}  ${a.allocateKg.toFixed(1)} kg`,
                stage: "in our hands" as const,
              })),
              { tempId: "RSV-?", label: `Reservation · sampling  ${reservationKg.toFixed(1)} kg`, stage: "in our hands" as const, isReservation: true },
            ]}
            footnote={
              "Allocations start at 'in our hands' because the fabric is already received. They move to 'at garmenter' when dispatched."
            }
          />
        </div>
      )}
    </div>
  );
}

function CommitsPanel({
  mode,
  productRows,
  fabricOrderRows,
  allocationRows,
  footnote,
}: {
  mode: Mode;
  productRows: { tempId: string; label: string }[];
  fabricOrderRows: { tempId: string; label: string; note?: string }[];
  allocationRows: { tempId: string; label: string; stage: "expected" | "in our hands" | "at garmenter"; isReservation?: boolean }[];
  footnote: string;
}) {
  return (
    <div className="col-span-5">
      <div className="rounded-lg border bg-muted/30 sticky top-[68px]">
        <header className="px-4 py-2.5 border-b flex items-center justify-between">
          <span className="font-semibold text-[13px]">What this commits</span>
          <Badge className="bg-[oklch(0.95_0.04_45)] text-[oklch(0.45_0.16_45)] border border-[oklch(0.85_0.06_45)]">new</Badge>
        </header>
        <div className="p-4 text-[12.5px] text-muted-foreground">
          Clicking <em>Create orders</em> writes the following rows in one transaction:
        </div>

        <Section title="Product · article orders" count={productRows.length}>
          {productRows.map((r) => (
            <Row key={r.tempId} id={r.tempId} content={r.label} />
          ))}
        </Section>

        <Section title="FabricOrder" count={fabricOrderRows.length} muted={mode === "fabric"}>
          {fabricOrderRows.map((r) => (
            <Row key={r.tempId} id={r.tempId} content={<>
              {r.label}
              {r.note && <span className="text-muted-foreground"> ({r.note})</span>}
            </>} />
          ))}
        </Section>

        <Section title="Allocation · pre-wired" count={allocationRows.length} accent>
          {allocationRows.map((r) => (
            <Row key={r.tempId} id={r.tempId} content={<>
              <span className="font-mono">{r.label}</span>
              <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1.5">{r.stage}</Badge>
              {r.isReservation && <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1.5">reservation</Badge>}
            </>} />
          ))}
        </Section>

        <div className="p-4 text-[11.5px] text-muted-foreground leading-relaxed border-t">{footnote}</div>
      </div>
    </div>
  );
}

function Section({ title, count, accent, muted, children }: { title: string; count: number; accent?: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className="border-t">
      <div className="px-4 py-2 bg-muted/40 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{title}</span>
        <span className="ml-auto font-mono">{muted ? "existing" : count}</span>
        {accent && (
          <Badge className="bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border border-[oklch(0.85_0.06_75)]">new</Badge>
        )}
      </div>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ id, content }: { id: string; content: React.ReactNode }) {
  return (
    <tr className="border-t first:border-t-0">
      <td className="px-4 py-1.5 font-mono text-[11.5px] text-muted-foreground w-[100px] align-top">{id}</td>
      <td className="px-4 py-1.5 text-[12.5px]">{content}</td>
    </tr>
  );
}
