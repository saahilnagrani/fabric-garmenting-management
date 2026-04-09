"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createVendor, updateVendor, deleteVendor } from "@/actions/vendors";
import { VENDOR_TYPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Pencil, Plus, Check, X, Trash2 } from "lucide-react";

type Vendor = {
  id: string;
  name: string;
  type: string;
  contactInfo: string | null;
  address: string | null;
};

export function VendorList({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ name: string; type: string; contactInfo: string; address: string }>({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" });
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newData, setNewData] = useState<{ name: string; type: string; contactInfo: string; address: string }>({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" });

  async function handleAdd() {
    if (!newData.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    try {
      await createVendor({
        name: newData.name,
        type: newData.type as never,
        contactInfo: newData.contactInfo || undefined,
        address: newData.address || undefined,
      });
      setNewData({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" });
      setAdding(false);
      toast.success("Vendor added");
      router.refresh();
    } catch {
      toast.error("Failed to add vendor. Name may already exist.");
    }
  }

  async function handleUpdate(id: string) {
    if (!editingData.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    try {
      await updateVendor(id, {
        name: editingData.name,
        type: editingData.type,
        contactInfo: editingData.contactInfo || null,
        address: editingData.address || null,
      });
      setEditingId(null);
      toast.success("Vendor updated");
      router.refresh();
    } catch {
      toast.error("Failed to update vendor.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteVendor(id);
      setDeletingId(null);
      toast.success("Vendor deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vendor.");
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
              placeholder="Vendor name..."
              autoFocus
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" }); }
              }}
            />
            <Select value={newData.type} onValueChange={(v) => setNewData((d) => ({ ...d, type: v || "FABRIC_SUPPLIER" }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newData.contactInfo}
              onChange={(e) => setNewData((d) => ({ ...d, contactInfo: e.target.value }))}
              placeholder="Contact info..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" }); }
              }}
            />
            <Textarea
              value={newData.address}
              onChange={(e) => setNewData((d) => ({ ...d, address: e.target.value }))}
              placeholder="Address..."
              className="flex-1 min-h-[60px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setAdding(false); setNewData({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" }); }
              }}
            />
            <Button size="sm" onClick={handleAdd}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewData({ name: "", type: "FABRIC_SUPPLIER", contactInfo: "", address: "" }); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Vendor
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[3fr_3fr_4fr_6fr_auto] gap-2 px-4 py-2.5 bg-muted/50 border-b text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          <span>Name</span>
          <span>Type</span>
          <span>Contact</span>
          <span>Address</span>
          <span />
        </div>

        {vendors.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            No vendors yet. Click &quot;Add Vendor&quot; to create one.
          </div>
        )}

        {vendors.map((v) => (
          <div
            key={v.id}
            className="group grid grid-cols-[3fr_3fr_4fr_6fr_auto] gap-2 items-center px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            {editingId === v.id ? (
              <>
                <Input
                  value={editingData.name}
                  onChange={(e) => setEditingData((d) => ({ ...d, name: e.target.value }))}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(v.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Select value={editingData.type} onValueChange={(val) => setEditingData((d) => ({ ...d, type: val || "FABRIC_SUPPLIER" }))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VENDOR_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={editingData.contactInfo}
                  onChange={(e) => setEditingData((d) => ({ ...d, contactInfo: e.target.value }))}
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdate(v.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <Textarea
                  value={editingData.address}
                  onChange={(e) => setEditingData((d) => ({ ...d, address: e.target.value }))}
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleUpdate(v.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">{v.name}</span>
                <span className="text-sm text-muted-foreground">{VENDOR_TYPE_LABELS[v.type] || v.type}</span>
                <span className="text-sm text-muted-foreground">{v.contactInfo || "-"}</span>
                <span className="text-sm text-muted-foreground whitespace-pre-line">{v.address || "-"}</span>
                <div className="flex items-center gap-1">
                  {deletingId === v.id ? (
                    <>
                      <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={() => handleDelete(v.id)}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDeletingId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => {
                          setEditingId(v.id);
                          setEditingData({ name: v.name, type: v.type, contactInfo: v.contactInfo || "", address: v.address || "" });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(v.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
