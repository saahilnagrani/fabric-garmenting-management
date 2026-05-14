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
  articleCount: number;
  productCount: number;
  productMasterCount: number;
  fabricMasterCount: number;
  productLinkCount: number;
  fabricOrderColourCount: number;
  fabricOrderAvailableCount: number;
  fabricBalanceCount: number;
  accessoryMasterCount: number;
};

const COUNT_COLUMNS: Array<{ key: keyof Colour; label: string; title: string }> = [
  { key: "articleCount", label: "Articles", title: "Article numbers (Product.articleNumber, name match incl. slash combos)" },
  { key: "productCount", label: "Products", title: "Product.colourOrderedId" },
  { key: "productLinkCount", label: "Prod Links", title: "ProductColour join (multi-colour products)" },
  { key: "productMasterCount", label: "Prod Masters", title: "ProductMasterColour (available colours on a Product Master)" },
  { key: "fabricMasterCount", label: "Fab Masters", title: "FabricMasterColour (available colours on a Fabric Master)" },
  { key: "fabricOrderColourCount", label: "FO Ordered", title: "FabricOrder.colourId (colour ordered)" },
  { key: "fabricOrderAvailableCount", label: "FO Avail", title: "FabricOrder.availableColourId (colour actually available)" },
  { key: "fabricBalanceCount", label: "Fab Bal", title: "FabricBalance.colourId" },
  { key: "accessoryMasterCount", label: "Acc Masters", title: "AccessoryMaster.colourId" },
];

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
              className="flex-1 max-w-xs"
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

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium text-center">Code</th>
              {COUNT_COLUMNS.map((col) => (
                <th
                  key={col.key as string}
                  className="px-2 py-2 font-medium text-right whitespace-nowrap"
                  title={col.title}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-8" aria-hidden />
              <th className="w-8" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y">
            {colours.length === 0 && (
              <tr>
                <td colSpan={COUNT_COLUMNS.length + 4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No colours yet. Click &quot;Add Colour&quot; to create one.
                </td>
              </tr>
            )}
            {colours.map((c) => (
              <tr key={c.id} className="group hover:bg-muted/50 transition-colors">
                {editingId === c.id ? (
                  <>
                    <td className="px-4 py-2">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={editingCode}
                        onChange={(e) => setEditingCode(e.target.value.toUpperCase().slice(0, 3))}
                        className="w-20 h-8"
                        maxLength={3}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    </td>
                    <td colSpan={COUNT_COLUMNS.length} aria-hidden />
                    <td className="px-1 py-2">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleUpdate(c.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="px-1 py-2">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-sm">{c.name}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {c.code || "—"}
                      </span>
                    </td>
                    {COUNT_COLUMNS.map((col) => {
                      const v = c[col.key] as number;
                      return (
                        <td
                          key={col.key as string}
                          className={`px-2 py-2.5 text-right tabular-nums text-xs ${v === 0 ? "text-muted-foreground/40" : "text-muted-foreground"}`}
                        >
                          {v}
                        </td>
                      );
                    })}
                    <td className="px-1 py-2.5">
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
                    </td>
                    <td className="px-1 py-2.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100 hover:opacity-100"
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
