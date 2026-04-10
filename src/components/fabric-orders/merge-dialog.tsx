"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type MergeableOrder = {
  id: string;
  fabricName: string;
  colour: string;
  articleNumbers: string;
  fabricOrderedQuantityKg: number | null;
  orderStatus: string;
  phase: { name: string } | null;
  fabricVendor: { name: string } | null;
};

interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
  mergeableOrders: MergeableOrder[];
  newQty: number;
  newStyleNumbers: string[];
  onMerge: (existingOrderId: string) => Promise<void>;
  onCreateSeparate: () => Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT_ORDER: "Draft",
  PO_SENT: "PO Sent",
};

export function MergeDialog({
  open,
  onClose,
  mergeableOrders,
  newQty,
  newStyleNumbers,
  onMerge,
  onCreateSeparate,
}: MergeDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleMerge() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await onMerge(selectedId);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSeparate() {
    setLoading(true);
    try {
      await onCreateSeparate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Existing Orders Found</h3>
          <p className="text-sm text-muted-foreground">
            There are open orders for the same fabric and colour. You can merge your {newQty}kg into an existing order or create a separate one.
          </p>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {mergeableOrders.map((order) => (
            <label
              key={order.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedId === order.id
                  ? "border-blue-500 bg-blue-50"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="merge-target"
                value={order.id}
                checked={selectedId === order.id}
                onChange={() => setSelectedId(order.id)}
                className="mt-1"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium">
                  {order.fabricName} - {order.colour}
                </div>
                <div className="text-muted-foreground text-xs space-y-0.5">
                  <div>
                    Phase: {order.phase?.name || "N/A"} | Status: {STATUS_LABELS[order.orderStatus] || order.orderStatus}
                  </div>
                  <div>
                    Current: {Number(order.fabricOrderedQuantityKg) || 0}kg {"->"} After merge: {(Number(order.fabricOrderedQuantityKg) || 0) + newQty}kg
                  </div>
                  {order.articleNumbers && (
                    <div>Articles: {order.articleNumbers}</div>
                  )}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleMerge}
            disabled={!selectedId || loading}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Merge into Selected
          </Button>
          <Button
            variant="outline"
            onClick={handleCreateSeparate}
            disabled={loading}
            className="flex-1"
          >
            Create Separate
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
