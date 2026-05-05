"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { logFabricReceipt } from "@/actions/proto-custody";

type Row = {
  fabricOrder: { id: string; fabricName: string; colour: string; vendorName: string; orderedKg: number; garmentingAtName: string | null };
  displayNumber: string;
  custody: { receivedKg: number; onOrderKg: number; inOurHandsKg: number; atGarmenterKg: Record<string, number>; surplusKg: number };
};

type Branch = "alloc" | "dispatch";

export function ReceiveSheet({ row, open, onOpenChange }: { row: Row | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"form" | "branch">("form");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [lotRef, setLotRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setStep("form");
      setBranch(null);
      setQty(row ? String(Math.min(row.custody.onOrderKg || 50, 100).toFixed(1)) : "");
      setDate(new Date().toISOString().slice(0, 10));
      setLotRef("");
      setNotes("");
    }
  }, [open, row]);

  const handleSave = () => {
    if (!row) return;
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    startTransition(async () => {
      try {
        await logFabricReceipt({
          fabricOrderId: row.fabricOrder.id,
          qtyKg: qtyNum,
          receivedAt: date,
          lotRef: lotRef || undefined,
          notes: notes || undefined,
        });
        toast.success(`Receipt logged · ${qtyNum.toFixed(1)} kg`);
        setStep("branch");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to log receipt";
        toast.error(msg);
      }
    });
  };

  if (!row) return null;
  const fo = row.fabricOrder;
  const newQty = Number(qty) || 0;
  const previewReceived = row.custody.receivedKg + newQty;
  const previewOnOrder = Math.max(0, fo.orderedKg - previewReceived);
  const previewSurplus = Math.max(0, previewReceived - fo.orderedKg);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Fabric orders / {row.displayNumber} · {fo.fabricName} · {fo.colour}
          </div>
          <SheetTitle>Log a fabric receipt</SheetTitle>
          <SheetDescription>
            Records a <span className="font-mono text-[12px]">FabricReceipt</span> against this order. Multiple receipts allowed; sum may exceed ordered.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5 space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <StepNum n={1} active />
              <span className="font-semibold text-[15px]">Receipt details</span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label>Against order</Label>
                <Input value={`${row.displayNumber}  ·  ${fo.fabricName}  ·  ${fo.colour}`} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Receipt date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity received (kg)</Label>
                <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1.5">
                <Label>Lot ref <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={lotRef} onChange={(e) => setLotRef(e.target.value)} placeholder="vendor lot/roll number" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="anything to record about this shipment" />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">After this receipt</div>
              <div className="grid grid-cols-4 gap-2">
                <Stat label="received" value={previewReceived} />
                <Stat label="on order" value={previewOnOrder} />
                <Stat label="in our hands" value={row.custody.inOurHandsKg + newQty} />
                <Stat label="surplus" value={previewSurplus} accent={previewSurplus > 0} />
              </div>
            </div>
          </Card>

          {step === "branch" && (
            <Card className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <StepNum n={2} active />
                <span className="font-semibold text-[15px]">Receipt saved. What now?</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                The {qty} kg is now <Badge className="bg-[oklch(0.95_0.02_250)] text-[oklch(0.40_0.10_250)] border border-[oklch(0.85_0.05_250)]">in our hands</Badge>. Pick a next step or skip and leave it free.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <BranchCard active={branch === "alloc"} onClick={() => setBranch("alloc")} chip="allocate" chipTone="alloc" hint="stays in our hands"
                  title="Allocate to article orders"
                  body="Earmark some or all of the kg to article orders before dispatching." />
                <BranchCard active={branch === "dispatch"} onClick={() => setBranch("dispatch")} chip="dispatch" chipTone="garm" hint="leaves our hands"
                  title="Dispatch to a garmenter"
                  body="Send out as a GarmenterDispatch. Allocate at-garmenter next." />
              </div>

              {branch === "alloc" && (
                <div className="mt-5 border-t pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Branch · Allocate to articles</div>
                  <table className="w-full text-[12.5px]">
                    <thead className="text-muted-foreground"><tr>
                      <th className="text-left py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Article order</th>
                      <th className="text-left py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Demand</th>
                      <th className="text-right py-1.5 font-medium text-[10.5px] uppercase tracking-wider">Allocate</th>
                    </tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="py-2">[real article orders that use this fabric+colour would list here]</td><td></td><td className="text-right text-muted-foreground">—</td></tr>
                    </tbody>
                  </table>
                </div>
              )}

              {branch === "dispatch" && (
                <div className="mt-5 border-t pt-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Branch · Dispatch to a garmenter</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Garmenter</Label><Input defaultValue={fo.garmentingAtName ?? ""} placeholder="Pick garmenter" /></div>
                    <div className="space-y-1.5"><Label>Quantity dispatched (kg)</Label><Input defaultValue={qty} /></div>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-3">After saving, allocate at this garmenter.</p>
                </div>
              )}
            </Card>
          )}
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row justify-end gap-2 sm:flex-row">
          {step === "form" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={pending}>{pending ? "Saving…" : "Save receipt"}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
              {branch && <Button size="sm">Confirm {branch === "alloc" ? "allocations" : "dispatch"}</Button>}
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("font-mono tabular-nums text-[15px] font-medium mt-0.5", accent && value > 0 && "text-[oklch(0.55_0.16_45)]")}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
      </div>
    </div>
  );
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
