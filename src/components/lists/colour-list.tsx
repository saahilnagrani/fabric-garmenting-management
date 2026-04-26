"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createColour,
  updateColour,
  deleteColour,
} from "@/actions/colours";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

type Colour = {
  id: string;
  name: string;
  code: string;
};

export function ColourList({ colours }: { colours: Colour[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error("Colour name is required");
      return;
    }
    if (!newCode.trim()) {
      toast.error("3-letter code is required (e.g. BLK, NVY)");
      return;
    }
    try {
      await createColour(newName, newCode);
      setNewName("");
      setNewCode("");
      setAdding(false);
      toast.success("Colour added");
      router.refresh();
    } catch {
      toast.error("Failed to add colour. It may already exist.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) {
      toast.error("Colour name is required");
      return;
    }
    try {
      await updateColour(id, editingName, editingCode);
      setEditingId(null);
      toast.success("Colour updated");
      router.refresh();
    } catch (err) {
      console.error("updateColour failed", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to update colour: ${msg}`);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteColour(id);
      toast.success("Colour deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete colour");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        {adding ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Colour name (e.g. Black)"
              autoFocus
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                  setNewCode("");
                }
              }}
            />
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase().slice(0, 3))}
              placeholder="Code (e.g. BLK)"
              className="w-24"
              maxLength={3}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                  setNewCode("");
                }
              }}
            />
            <Button size="sm" onClick={handleAdd}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setNewCode("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Colour
          </Button>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        {colours.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No colours yet. Click &quot;Add Colour&quot; to create one.
          </div>
        )}
        {colours.map((c) => (
          <div
            key={c.id}
            className="group flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {editingId === c.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Input
                  value={editingCode}
                  onChange={(e) => setEditingCode(e.target.value.toUpperCase().slice(0, 3))}
                  className="w-24 h-8"
                  maxLength={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(c.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => handleUpdate(c.id)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {c.code || "—"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditingName(c.name);
                    setEditingCode(c.code || "");
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => handleDelete(c.id, c.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
