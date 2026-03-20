"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createGarmentingLocation,
  updateGarmentingLocation,
  deleteGarmentingLocation,
} from "@/actions/garmenting-locations";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

type GarmentingLocation = {
  id: string;
  name: string;
};

export function GarmentingLocationList({ locations }: { locations: GarmentingLocation[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error("Location name is required");
      return;
    }
    try {
      await createGarmentingLocation(newName);
      setNewName("");
      setAdding(false);
      toast.success("Location added");
      router.refresh();
    } catch {
      toast.error("Failed to add location. It may already exist.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) {
      toast.error("Location name is required");
      return;
    }
    try {
      await updateGarmentingLocation(id, editingName);
      setEditingId(null);
      toast.success("Location updated");
      router.refresh();
    } catch {
      toast.error("Failed to update location. Name may already exist.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteGarmentingLocation(id);
      toast.success("Location deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete location");
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
              placeholder="New location name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
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
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Location
          </Button>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        {locations.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No garmenting locations yet. Click &quot;Add Location&quot; to create one.
          </div>
        )}
        {locations.map((t) => (
          <div
            key={t.id}
            className="group flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {editingId === t.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(t.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => handleUpdate(t.id)}
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
                <span className="flex-1 text-sm">{t.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditingName(t.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => handleDelete(t.id, t.name)}
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
