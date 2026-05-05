"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { setTestPhase } from "@/actions/proto-custody";

type Phase = { id: string; number: number; name: string; isCurrent: boolean; isTestPhase: boolean };

export function TestPhaseToggleList({ phases }: { phases: Phase[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onToggle = (phase: Phase, next: boolean) => {
    setPendingId(phase.id);
    startTransition(async () => {
      try {
        await setTestPhase(phase.id, next);
        toast.success(`Phase ${phase.number} ${next ? "marked as test phase" : "unmarked"}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Test phases</div>
          <h2 className="font-semibold mt-0.5">Toggle which phases accept proto writes</h2>
        </div>
        <div className="text-[12px] text-muted-foreground">Live phases (Phase 4) should stay off.</div>
      </div>
      <div className="divide-y border rounded-md">
        {phases.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[14px] flex items-center gap-2">
                Phase {p.number} <span className="text-muted-foreground font-normal">· {p.name}</span>
                {p.isCurrent && <Badge variant="secondary" className="text-[10px]">current</Badge>}
                {p.isTestPhase && <Badge className="bg-[oklch(0.95_0.04_140)] text-[oklch(0.40_0.10_140)] border border-[oklch(0.85_0.06_140)] text-[10px]">test</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className={p.isTestPhase ? "" : "font-medium text-foreground"}>off</span>
              <Switch
                checked={p.isTestPhase}
                disabled={pending && pendingId === p.id}
                onCheckedChange={(v) => onToggle(p, v)}
              />
              <span className={p.isTestPhase ? "font-medium text-foreground" : ""}>on</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-muted-foreground mt-3 leading-relaxed">
        Proto writes (creating planned orders, logging receipts, dispatching) are blocked unless the current phase has this flag on. Switch the current phase via the topbar selector, then turn on its test flag here.
      </p>
    </Card>
  );
}
