"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createProductType,
  updateProductType,
  deleteProductType,
} from "@/actions/product-types";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

type ProductType = {
  id: string;
  name: string;
  code: string;
  articleMasterCount: number;
  articleOrderCount: number;
};

export function ProductTypeList({ types }: { types: ProductType[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error("Type name is required");
      return;
    }
    if (!newCode.trim()) {
      toast.error("2-3 letter code is required (e.g. RN, SH, LO)");
      return;
    }
    try {
      await createProductType(newName, newCode);
      setNewName("");
      setNewCode("");
      setAdding(false);
      toast.success("Type added");
      router.refresh();
    } catch {
      toast.error("Failed to add type. It may already exist.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editingName.trim()) {
      toast.error("Type name is required");
      return;
    }
    try {
      await updateProductType(id, editingName, editingCode);
      setEditingId(null);
      toast.success("Type updated");
      router.refresh();
    } catch {
      toast.error("Failed to update type. Name may already exist.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProductType(id);
      toast.success("Type deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete type");
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
              placeholder="Type name (e.g. Roundneck)"
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
              placeholder="Code (e.g. RN)"
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
            <Plus className="h-4 w-4 mr-1" /> Add Type
          </Button>
        )}
      </div>

      <div className="border rounded-lg divide-y">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span className="flex-1">Name</span>
          <span className="w-[3.25rem] text-center">Code</span>
          <span className="w-20 text-right" title="Number of Article Master rows (SKUs) using this type">Art. Masters</span>
          <span className="w-20 text-right" title="Number of Article Orders (Products with an article number) using this type">Art. Orders</span>
          <span className="w-8" aria-hidden />
          <span className="w-8" aria-hidden />
        </div>
        {types.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No product types yet. Click &quot;Add Type&quot; to create one.
          </div>
        )}
        {types.map((t) => (
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
                <Input
                  value={editingCode}
                  onChange={(e) => setEditingCode(e.target.value.toUpperCase().slice(0, 3))}
                  className="w-24 h-8"
                  maxLength={3}
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
                <span className="w-[3.25rem] flex justify-center">
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {t.code || "—"}
                  </span>
                </span>
                <span
                  className={`text-xs tabular-nums w-20 text-right ${t.articleMasterCount === 0 ? "text-muted-foreground/40" : "text-muted-foreground"}`}
                  title={`${t.articleMasterCount} Article Master row${t.articleMasterCount === 1 ? "" : "s"} (SKUs) use this type`}
                >
                  {t.articleMasterCount}
                </span>
                <span
                  className={`text-xs tabular-nums w-20 text-right ${t.articleOrderCount === 0 ? "text-muted-foreground/40" : "text-muted-foreground"}`}
                  title={`${t.articleOrderCount} Article Order${t.articleOrderCount === 1 ? "" : "s"} (Product rows with an article number) use this type`}
                >
                  {t.articleOrderCount}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditingName(t.name);
                    setEditingCode(t.code || "");
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
