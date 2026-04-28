"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Row = {
  fabricOrder: { id: string; fabricName: string; colour: string; vendorName: string; orderedKg: number; garmentingAtName: string | null };
  displayNumber: string;
  custody: { receivedKg: number; onOrderKg: number; inOurHandsKg: number; atGarmenterKg: Record<string, number>; surplusKg: number };
};

export function DispatchSheet({ row, open, onOpenChange }: { row: Row | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<"form" | "branch">("form");
  const [allocateNow, setAllocateNow] = useState<boolean>(true);
  const [qty, setQty] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setAllocateNow(true);
      setQty(row ? String(Math.min(row.custody.inOurHandsKg + row.custody.surplusKg, 100).toFixed(1)) : "");
    }
  }, [open, row]);

  if (!row) return null;
  const fo = row.fabricOrder;
  const available = row.custody.inOurHandsKg + row.custody.surplusKg;
  const newQty = Number(qty) || 0;
  const previewInHands = Math.max(0, row.custody.inOurHandsKg + row.custody.surplusKg - newQty);
  const previewAtGarm = newQty;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Fabric orders / {row.displayNumber} · {fo.fabricName} · {fo.colour}
          </div>
          <SheetTitle>Dispatch fabric to a garmenter</SheetTitle>
          <SheetDescription>
            Records a <span className="font-mono text-[12px]">GarmenterDispatch</span>. Fabric leaves <Badge className="bg-[oklch(0.95_0.02_250)] text-[oklch(0.40_0.10_250)] border border-[oklch(0.85_0.05_250)]">in our hands</Badge> and arrives <Badge className="bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border border-[oklch(0.85_0.06_140)]">at garmenter</Badge>.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <StepNum n={1} active />
              <span className="font-semibold text-[15px]">Dispatch details</span>
            </div>

            {available === 0 && (
              <div className="rounded-md border border-[oklch(0.85_0.06_45)] bg-[oklch(0.98_0.025_45)] px-3 py-2 text-[12.5px] text-[oklch(0.40_0.16_45)] mb-4">
                Nothing in our hands for this order yet. Log a receipt first.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label>From fabric balance</Label>
                <Input value={`${row.displayNumber}  ·  ${fo.fabricName}  ·  ${fo.colour}`} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Dispatch date</Label>
                <Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-1.5">
                <Label>To garmenter</Label>
                <Input defaultValue={fo.garmentingAtName ?? ""} placeholder="Pick garmenter" />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (kg)</Label>
                <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Vehicle / docket no <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. MH-04-AB-2231 / docket #4421" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} placeholder="anything to record about this dispatch" />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">After dispatch · custody movement</div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="text-[11.5px] text-muted-foreground mb-1">Before</div>
                  <div className="font-mono text-[12.5px]">{available.toFixed(1)} kg in our hands</div>
                </div>
                <div>
                  <div className="text-[11.5px] text-muted-foreground mb-1">After</div>
                  <div className="font-mono text-[12.5px]">{previewInHands.toFixed(1)} kg in our hands · +{previewAtGarm.toFixed(1)} kg at {fo.garmentingAtName ?? "garmenter"}</div>
                </div>
              </div>
            </div>
          </Card>

          {step === "branch" && (
            <Card className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <StepNum n={2} active />
                <span className="font-semibold text-[15px]">Dispatch saved. Allocate now?</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {newQty.toFixed(1)} kg of {fo.fabricName} {fo.colour} is now <Badge className="bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border border-[oklch(0.85_0.06_140)]">at {fo.garmentingAtName ?? "garmenter"}</Badge> and unallocated.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <BranchCard active={allocateNow} onClick={() => setAllocateNow(true)} chip="allocate now" chipTone="alloc" hint="recommended"
                  title="Allocate to article orders at this garmenter"
                  body="Pick article orders that use this fabric+colour and earmark kg from the pool." />
                <BranchCard active={!allocateNow} onClick={() => setAllocateNow(false)} chip="leave free" chipTone="garm" hint="do later"
                  title="Leave as free balance"
                  body="Will appear as unallocated free balance in the garmenter view." />
              </div>

              {allocateNow && (
                <div className="mt-5 border-t pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">At {fo.garmentingAtName ?? "garmenter"} · article orders that use this fabric+colour</div>
                  <p className="text-[12.5px] text-muted-foreground">[real article orders that use {fo.fabricName} · {fo.colour} would list here, with kg input per row]</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row justify-end gap-2 sm:flex-row">
          {step === "form" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" disabled={available === 0 || newQty <= 0} onClick={() => setStep("branch")}>Save dispatch</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
              {allocateNow && <Button size="sm">Confirm allocations</Button>}
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function StepNum({ n, active }: { n: number; active?: boolean }) {
  return <span className={cn("inline-flex items-center justify-center w-[22px] h-[22px] rounded-full text-[11.5px] font-semibold", active ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{n}</span>;
}

function BranchCard({ active, onClick, chip, chipTone, hint, title, body }: { active: boolean; onClick: () => void; chip: string; chipTone: "alloc" | "garm"; hint: string; title: string; body: string }) {
  const chipCls = chipTone === "alloc"
    ? "bg-[oklch(0.96_0.04_75)] text-[oklch(0.45_0.10_75)] border-[oklch(0.85_0.06_75)]"
    : "bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border-[oklch(0.85_0.06_140)]";
  return (
    <button type="button" onClick={onClick} className={cn("text-left rounded-lg border p-4 transition-colors", active ? "border-foreground bg-muted/40" : "hover:bg-muted/40")}>
      <div className="flex items-center justify-between mb-2">
        <Badge className={cn("border", chipCls)}>{chip}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="font-semibold text-[14.5px]">{title}</div>
      <p className="text-[12.5px] text-muted-foreground mt-1.5">{body}</p>
    </button>
  );
}
