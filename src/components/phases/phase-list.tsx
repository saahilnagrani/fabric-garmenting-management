"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPhase, updatePhase, setCurrentPhase } from "@/actions/phases";
import { dispatchPhaseChanged } from "@/components/layout/phase-selector";
import { toast } from "sonner";
import { Pencil, Plus, Check, X } from "lucide-react";

type Phase = {
  id: string;
  name: string;
  number: number;
  startDate: string | Date | null;
  isCurrent: boolean;
};

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function displayDate(d: string | Date | null): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-IN");
  } catch {
    return "-";
  }
}

export function PhaseList({ phases }: { phases: Phase[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ name: string; number: string; startDate: string }>({ name: "", number: "", startDate: "" });
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<{ name: string; number: string; startDate: string }>({ name: "", number: "", startDate: "" });

  async function handleAdd() {
    if (!newData.name.trim()) {
      toast.error("Phase name is required");
      return;
    }
    if (!newData.number.trim() || isNaN(Number(newData.number))) {
      toast.error("Phase number is required");
      return;
    }
    try {
      await createPhase({
        name: newData.name,
        number: Number(newData.number),
        startDate: newData.startDate || undefined,
      });
      setNewData({ name: "", number: "", startDate: "" });
      setAdding(false);
      toast.success("Phase added");
      router.refresh();
    } catch {
      toast.error("Failed to add phase. Number may already exist.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editingData.name.trim()) {
      toast.error("Phase name is required");
      return;
    }
    try {
      await updatePhase(id, {
        name: editingData.name,
        number: Number(editingData.number) || undefined,
        startDate: editingData.startDate ? new Date(editingData.startDate) : null,
      });
      setEditingId(null);
      toast.success("Phase updated");
      router.refresh();
    } catch {
      toast.error("Failed to update phase.");
    }
  }

  async function handleSetCurrent(id: string) {
    try {
      await setCurrentPhase(id);
      dispatchPhaseChanged(id);
      toast.success("Current phase updated");
      router.refresh();
    } catch {
      toast.error("Failed to set current phase");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        {adding ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={newData.name}
              onChange={(e) => setNewData((d) => ({ ...d, name: e.target.value }))}
              placeholder="Phase name..."
              autoFocus
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", number: "", startDate: "" }); }
              }}
            />
            <Input
              value={newData.number}
              onChange={(e) => setNewData((d) => ({ ...d, number: e.target.value }))}
              placeholder="#"
              type="number"
              className="w-20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", number: "", startDate: "" }); }
              }}
            />
            <Input
              value={newData.startDate}
              onChange={(e) => setNewData((d) => ({ ...d, startDate: e.target.value }))}
              type="date"
              className="w-40"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", number: "", startDate: "" }); }
              }}
            />
            <Button size="sm" onClick={handleAdd}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewData({ name: "", number: "", startDate: "" }); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Phase
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_120px_130px_80px] gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          <span>Phase Name</span>
          <span>#</span>
          <span>Start Date</span>
          <span>Status</span>
          <span />
        </div>

        {phases.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No phases yet. Click &quot;Add Phase&quot; to create one.
          </div>
        )}

        {phases.map((p) => (
          <div
            key={p.id}
            className="group grid grid-cols-[1fr_60px_120px_130px_80px] gap-2 items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {editingId === p.id ? (
              <>
                <Input
                  value={editingData.name}
                  onChange={(e) => setEditingData((d) => ({ ...d, name: e.target.value }))}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Input
                  value={editingData.number}
                  onChange={(e) => setEditingData((d) => ({ ...d, number: e.target.value }))}
                  type="number"
                  className="h-8 w-16"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Input
                  value={editingData.startDate}
                  onChange={(e) => setEditingData((d) => ({ ...d, startDate: e.target.value }))}
                  type="date"
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(p.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleUpdate(p.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-sm text-muted-foreground">{p.number}</span>
                <span className="text-sm text-muted-foreground">{displayDate(p.startDate)}</span>
                <span>
                  {p.isCurrent ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs opacity-0 group-hover:opacity-100"
                      onClick={() => handleSetCurrent(p.id)}
                    >
                      Set Current
                    </Button>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditingData({
                        name: p.name,
                        number: String(p.number),
                        startDate: formatDate(p.startDate),
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
