import { db } from "@/lib/db";
import { getCurrentPhase } from "@/actions/phases";
import {
  adaptFabricOrder,
  applyDemoState,
  pickDemoStates,
  protoNumberFmt,
  synthesizeFabricOrder,
  type SynthAllocation,
} from "@/lib/proto/synthesize";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ g?: string }>;

/**
 * Print-optimized per-garmenter custody sheet.
 *
 * Renders the same data as /proto/garmenters but stripped to print chrome
 * (no sidebar, no topbar, light theme via the (print) group layout). User
 * triggers Cmd/Ctrl-P from this page to save as PDF.
 */
export default async function ProtoGarmenterPrintPage({ searchParams }: { searchParams: SearchParams }) {
  const phase = await getCurrentPhase();
  if (!phase) return <p className="p-8 text-sm">No active phase.</p>;

  const { g } = await searchParams;
  if (!g) return <p className="p-8 text-sm">Missing ?g=garmenter-name.</p>;

  const orders = await db.fabricOrder.findMany({
    where: { phaseId: phase.id, isStrikedThrough: false },
    include: {
      fabricVendor: { select: { name: true } },
      garmentingAtRef: { select: { name: true } },
      productLinks: {
        include: {
          product: {
            select: {
              id: true,
              articleNumber: true,
              styleNumber: true,
              productName: true,
              fabricOrderedQuantityKg: true,
              garmentingAt: true,
              garmentingAtRef: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const adapted = orders.map(adaptFabricOrder);
  const demoStates = pickDemoStates(adapted);
  const overReceiptId = [...demoStates.entries()].find(([, s]) => s === "over")?.[0] ?? null;

  const synthesized = orders.map((row) => {
    const baseFo = adaptFabricOrder(row);
    const inferredGarm = baseFo.garmentingAtName ?? inferGarmenterFromProducts(row.productLinks);
    const foWithGarm = inferredGarm ? { ...baseFo, garmentingAtName: inferredGarm } : baseFo;
    const fo = applyDemoState(foWithGarm, demoStates.get(baseFo.id));
    const linkedProducts = row.productLinks.map((link) => ({
      productId: link.product.id,
      articleNumber: link.product.articleNumber,
      styleNumber: link.product.styleNumber,
      productName: link.product.productName,
      demandKg: protoNumberFmt.toNum(link.product.fabricOrderedQuantityKg),
    }));
    return synthesizeFabricOrder(fo, linkedProducts, { forceOverReceipt: fo.id === overReceiptId });
  });

  // Stable display numbers (same algorithm as the live screen)
  const sortedSynth = [...synthesized].sort((a, b) => {
    const order: Record<string, number> = { over: 0, partial: 1, full: 2, vendor: 3 };
    const ai = demoStates.get(a.fabricOrder.id);
    const bi = demoStates.get(b.fabricOrder.id);
    return (ai ? order[ai] : 99) - (bi ? order[bi] : 99);
  });
  const foDisplayNumber = new Map<string, string>();
  sortedSynth.forEach((s, i) => foDisplayNumber.set(s.fabricOrder.id, `FO-${String(i + 1).padStart(4, "0")}`));

  // Aggregate this garmenter's fabric blocks
  type Block = {
    fabricName: string;
    colour: string;
    vendorName: string;
    dispatchedKg: number;
    allocations: (SynthAllocation & { fabricOrderDisplay: string })[];
  };
  const blocksMap = new Map<string, Block>();
  for (const s of synthesized) {
    for (const d of s.dispatches) {
      if (d.garmenterName !== g) continue;
      const key = `${s.fabricOrder.fabricName}|||${s.fabricOrder.colour}`;
      const block = blocksMap.get(key) ?? {
        fabricName: s.fabricOrder.fabricName,
        colour: s.fabricOrder.colour,
        vendorName: s.fabricOrder.vendorName,
        dispatchedKg: 0,
        allocations: [],
      };
      block.dispatchedKg += d.qtyKg;
      for (const a of s.allocations) {
        if (a.garmenterName === g) {
          block.allocations.push({ ...a, fabricOrderDisplay: foDisplayNumber.get(s.fabricOrder.id) ?? "" });
        }
      }
      blocksMap.set(key, block);
    }
  }
  const blocks = [...blocksMap.values()];

  // Look up garmenter info (vendor or location)
  const vendor = await db.vendor.findFirst({ where: { name: g, type: "GARMENTING" }, select: { contactInfo: true, address: true } });

  const totalDispatched = blocks.reduce((s, b) => s + b.dispatchedKg, 0);
  const totalAllocated = blocks.reduce((s, b) => s + b.allocations.filter((a) => !a.isReservation).reduce((sa, a) => sa + a.qtyKg, 0), 0);
  const totalReserved = blocks.reduce((s, b) => s + b.allocations.filter((a) => a.isReservation).reduce((sa, a) => sa + a.qtyKg, 0), 0);
  const totalFree = Math.max(0, totalDispatched - totalAllocated - totalReserved);
  const printedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="font-sans text-[12px] text-black p-10 max-w-[800px] mx-auto">
      {/* print stylesheet — hides nothing else (the (print) layout already strips chrome), just sets page size */}
      <style>{`@page { size: A4 portrait; margin: 14mm; } @media print { .no-print { display: none !important; } }`}</style>

      {/* Header */}
      <header className="border-b border-black pb-3 mb-5 flex justify-between items-end">
        <div>
          <div className="text-[18px] font-bold tracking-tight">Hyperballik · Fabric & Garmenting</div>
          <div className="text-[11px] text-gray-600 mt-0.5">Garmenter custody sheet · Phase {phase.number}</div>
        </div>
        <div className="text-right text-[10.5px] text-gray-600">
          Printed {printedAt}
          <br />
          <span className="text-gray-400">prototype data — synthesized from real DB rows</span>
        </div>
      </header>

      {/* Garmenter block */}
      <section className="mb-6">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">Garmenter</div>
        <div className="text-[20px] font-bold mt-0.5">{g}</div>
        {vendor?.address && <div className="text-[11px] text-gray-700 mt-1">{vendor.address}</div>}
        {vendor?.contactInfo && <div className="text-[11px] text-gray-700">Contact · {vendor.contactInfo}</div>}
      </section>

      {/* Totals strip */}
      <section className="grid grid-cols-4 border-y border-black mb-6">
        <Cell label="Total at garmenter" value={totalDispatched} />
        <Cell label="Allocated" value={totalAllocated} />
        <Cell label="Reserved" value={totalReserved} />
        <Cell label="Free / unallocated" value={totalFree} />
      </section>

      {/* Per-fabric blocks */}
      {blocks.length === 0 ? (
        <p className="text-[12px] text-gray-600">No fabric currently in {g}'s custody for Phase {phase.number}.</p>
      ) : (
        <div className="space-y-5">
          {blocks.map((b, i) => (
            <FabricBlockPrint key={i} block={b} />
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-10 pt-4 border-t border-gray-400 text-[10.5px] text-gray-600 grid grid-cols-3 gap-6">
        <div>
          <div className="font-semibold text-black mb-1">Issued by</div>
          <div className="border-b border-gray-400 h-6"></div>
          <div className="mt-1">Hyperballik representative</div>
        </div>
        <div>
          <div className="font-semibold text-black mb-1">Acknowledged by</div>
          <div className="border-b border-gray-400 h-6"></div>
          <div className="mt-1">{g} representative</div>
        </div>
        <div>
          <div className="font-semibold text-black mb-1">Date received</div>
          <div className="border-b border-gray-400 h-6"></div>
        </div>
      </footer>

      {/* Print button (screen only) */}
      <div className="no-print mt-6 flex gap-2 justify-end print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}

function FabricBlockPrint({
  block,
}: {
  block: {
    fabricName: string;
    colour: string;
    vendorName: string;
    dispatchedKg: number;
    allocations: (SynthAllocation & { fabricOrderDisplay: string })[];
  };
}) {
  const allocated = block.allocations.filter((a) => !a.isReservation).reduce((s, a) => s + a.qtyKg, 0);
  const reserved = block.allocations.filter((a) => a.isReservation).reduce((s, a) => s + a.qtyKg, 0);
  const free = Math.max(0, block.dispatchedKg - allocated - reserved);

  return (
    <div className="border border-black break-inside-avoid">
      <header className="grid grid-cols-12 gap-3 items-end px-3 py-2 border-b border-black bg-gray-100">
        <div className="col-span-6">
          <div className="text-[14px] font-bold leading-tight">{block.fabricName} · {block.colour}</div>
          <div className="text-[10.5px] text-gray-600">{block.vendorName}</div>
        </div>
        <Sub label="Dispatched" value={block.dispatchedKg} />
        <Sub label="Allocated" value={allocated} />
        <Sub label="Reserved" value={reserved} />
        <Sub label="Free" value={free} bold />
      </header>
      <table className="w-full text-[11px]">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-3 py-1.5 font-semibold w-[80px]">Type</th>
            <th className="text-left px-3 py-1.5 font-semibold">Article / purpose</th>
            <th className="text-left px-3 py-1.5 font-semibold w-[90px]">Source FO</th>
            <th className="text-right px-3 py-1.5 font-semibold w-[80px]">Qty</th>
            <th className="text-right px-3 py-1.5 font-semibold w-[80px]">Consumed</th>
            <th className="text-right px-3 py-1.5 font-semibold w-[90px]">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {block.allocations.map((a) => (
            <tr key={a.id} className="border-t border-gray-300">
              <td className="px-3 py-1.5">{a.isReservation ? "Reservation" : "Allocation"}</td>
              <td className="px-3 py-1.5">{a.isReservation ? a.reservationPurpose ?? "—" : a.productLabel}</td>
              <td className="px-3 py-1.5 font-mono text-[10.5px] text-gray-600">{a.fabricOrderDisplay}</td>
              <td className="px-3 py-1.5 text-right font-mono">{kg(a.qtyKg)}</td>
              <td className="px-3 py-1.5 text-right font-mono text-gray-600">{a.consumedKg > 0 ? kg(a.consumedKg) : "—"}</td>
              <td className="px-3 py-1.5 text-right font-mono">{kg(Math.max(0, a.qtyKg - a.consumedKg))}</td>
            </tr>
          ))}
          {free > 0 && (
            <tr className="border-t border-gray-300">
              <td className="px-3 py-1.5 italic">Free</td>
              <td className="px-3 py-1.5 italic">unallocated · awaiting plan</td>
              <td></td>
              <td className="px-3 py-1.5 text-right font-mono">{kg(free)}</td>
              <td></td>
              <td className="px-3 py-1.5 text-right font-mono">{kg(free)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l border-black first:border-l-0 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">{label}</div>
      <div className="text-[16px] font-bold font-mono mt-0.5">{kgN(value)} <span className="text-[10px] font-normal text-gray-600">kg</span></div>
    </div>
  );
}

function Sub({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="col-span-1 md:col-span-1 lg:col-span-1">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">{label}</div>
      <div className={`text-[12px] ${bold ? "font-bold" : "font-medium"} font-mono mt-0.5`}>{kgN(value)} kg</div>
    </div>
  );
}

function inferGarmenterFromProducts(
  links: { product: { garmentingAt: string | null; garmentingAtRef: { name: string } | null } }[]
): string | null {
  const counts = new Map<string, number>();
  for (const link of links) {
    const name = link.product.garmentingAtRef?.name ?? link.product.garmentingAt;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function kg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " kg";
}
function kgN(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
