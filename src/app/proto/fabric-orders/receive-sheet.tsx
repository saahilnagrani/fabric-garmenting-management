"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { logFabricReceipt } from "@/actions/proto-custody";

type Row = {
  fabricOrder: { id: string; fabricName: string; colour: string; vendorName: string; orderedKg: number };
  displayNumber: string;
  custody: { receivedKg: number; onOrderKg: number; inOurHandsKg: number; surplusKg: number };
};

export function ReceiveSheet({ row, open, onOpenChange }: { row: Row | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [lotRef, setLotRef] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && row) {
      setQty(String(Math.min(row.custody.onOrderKg || 50, 100).toFixed(1)));
      setDate(new Date().toISOString().slice(0, 10));
      setLotRef("");
      setNotes("");
    }
  }, [open, row]);

  if (!row) return null;
  const fo = row.fabricOrder;
  const newQty = Number(qty) || 0;
  const previewReceived = row.custody.receivedKg + newQty;
  const previewOnOrder = Math.max(0, fo.orderedKg - previewReceived);
  const previewInHands = row.custody.inOurHandsKg + newQty;
  const previewSurplus = Math.max(0, previewReceived - fo.orderedKg);

  const handleSave = () => {
    if (!newQty || newQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    startTransition(async () => {
      try {
        await logFabricReceipt({
          fabricOrderId: fo.id,
          qtyKg: newQty,
          receivedAt: date,
          lotRef: lotRef || undefined,
          notes: notes || undefined,
        });
        toast.success(`Receipt logged · ${newQty.toFixed(1)} kg in our hands`);
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to log receipt";
        toast.error(msg);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Fabric orders / {row.displayNumber} · {fo.fabricName} · {fo.colour}
          </div>
          <SheetTitle>Log a fabric receipt</SheetTitle>
          <SheetDescription>
            Records that <span className="font-mono text-[12px]">qty</span> arrived at our warehouse. Allocation to article orders happens at dispatch time.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-5">
          <Card className="p-5">
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
                <Stat label="in our hands" value={previewInHands} />
                <Stat label="surplus" value={previewSurplus} accent={previewSurplus > 0} />
              </div>
            </div>
          </Card>
        </div>

        <SheetFooter className="px-6 py-4 border-t flex-row justify-end gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={pending || newQty <= 0}>
            {pending ? "Saving…" : "Save receipt"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
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
