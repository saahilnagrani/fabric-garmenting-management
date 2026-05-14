import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";
import { ECOZEN_HEADER } from "@/lib/company";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { PrintButton } from "../../fabric-orders/purchase-order/print-button";

type SizeBreakdown = {
  garmentNumber: number | null;
  actualInwardTotal: number;
  actualInwardXS: number;
  actualInwardS: number;
  actualInwardM: number;
  actualInwardL: number;
  actualInwardXL: number;
  actualInwardXXL: number;
  actualStitchedXS: number;
  actualStitchedS: number;
  actualStitchedM: number;
  actualStitchedL: number;
  actualStitchedXL: number;
  actualStitchedXXL: number;
};

function piecesForBomLine(p: SizeBreakdown, applicableSizes: string[]): number {
  const totalInward = p.actualInwardTotal;
  if (applicableSizes.length === 0) {
    return totalInward > 0 ? totalInward : p.garmentNumber || 0;
  }
  const useInward = totalInward > 0;
  const get = (size: string): number => {
    const key = size.toUpperCase();
    if (useInward) {
      switch (key) {
        case "XS": return p.actualInwardXS;
        case "S": return p.actualInwardS;
        case "M": return p.actualInwardM;
        case "L": return p.actualInwardL;
        case "XL": return p.actualInwardXL;
        case "XXL": return p.actualInwardXXL;
        default: return 0;
      }
    }
    switch (key) {
      case "XS": return p.actualStitchedXS;
      case "S": return p.actualStitchedS;
      case "M": return p.actualStitchedM;
      case "L": return p.actualStitchedL;
      case "XL": return p.actualStitchedXL;
      case "XXL": return p.actualStitchedXXL;
      default: return 0;
    }
  };
  return applicableSizes.reduce((sum, s) => sum + get(s), 0);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatQty(n: number, unit: string) {
  const formatted = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  return `${formatted} ${unit}`;
}

/**
 * Warehouse-facing accessory dispatch note. Selected dispatches are grouped by
 * (destinationGarmenter || "Unassigned"), one A4 page per garmenter, listing
 * every accessory + qty + linked article so the warehouse team can pull stock
 * and load the truck.
 *
 * Reached from /accessory-dispatches by ticking rows and clicking
 * "Generate dispatch note". Single-shot view; no DB writes (unlike the PO
 * page, the warehouse note doesn't allocate any kind of running number).
 */
export default async function DispatchNotePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; dnNumber?: string }>;
}) {
  await requirePermission("inventory:accessories:view");

  const params = await searchParams;
  const dnNumber = params.dnNumber?.trim();
  const ids = (params.ids || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!dnNumber && ids.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          No dispatches selected. Go back to the Accessory Dispatches page, tick some rows, and
          click &quot;Generate Dispatch Note&quot;.
        </p>
      </div>
    );
  }

  const dispatches = await db.accessoryDispatch.findMany({
    where: dnNumber ? { dnNumber } : { id: { in: ids } },
    include: {
      accessory: true,
      product: {
        select: {
          id: true,
          skuCode: true,
          styleNumber: true,
          articleNumber: true,
          colourOrdered: true,
          productName: true,
          garmentNumber: true,
          actualInwardTotal: true,
          actualInwardXS: true,
          actualInwardS: true,
          actualInwardM: true,
          actualInwardL: true,
          actualInwardXL: true,
          actualInwardXXL: true,
          actualStitchedXS: true,
          actualStitchedS: true,
          actualStitchedM: true,
          actualStitchedL: true,
          actualStitchedXL: true,
          actualStitchedXXL: true,
        },
      },
      phase: { select: { name: true, number: true } },
    },
    orderBy: [{ destinationGarmenter: "asc" }, { createdAt: "asc" }],
  });

  if (dispatches.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No matching dispatches found.</p>
      </div>
    );
  }

  // For each (product, accessory) pair, resolve the BOM line by article
  // number. Drives both the displayed size note and the piece count shown
  // in the "For Article" / "Total Article Pieces" columns. Falls back to
  // all sizes (empty applicableSizes) when no BOM line is found.
  const articleNumbers = [
    ...new Set(
      dispatches
        .map((d) => d.product?.articleNumber)
        .filter((x): x is string => !!x),
    ),
  ];
  const accessoryIds = [...new Set(dispatches.map((d) => d.accessoryId))];
  const bomLines = articleNumbers.length
    ? await db.articleAccessory.findMany({
        where: {
          articleNumber: { in: articleNumbers },
          accessoryId: { in: accessoryIds },
        },
        select: { articleNumber: true, accessoryId: true, applicableSizes: true },
      })
    : [];
  const bomKey = (articleNumber: string, accessoryId: string) =>
    `${articleNumber}::${accessoryId}`;
  const bomMap = new Map(
    bomLines.map((b) => [bomKey(b.articleNumber, b.accessoryId), b.applicableSizes]),
  );
  // Per-dispatch resolved info: applicable sizes (empty = no restriction) and
  // the piece count contributing to totals.
  const dispatchInfo = new Map<string, { applicableSizes: string[]; pieces: number }>();
  for (const d of dispatches) {
    const p = d.product;
    if (!p) {
      dispatchInfo.set(d.id, { applicableSizes: [], pieces: 0 });
      continue;
    }
    const applicableSizes = p.articleNumber
      ? bomMap.get(bomKey(p.articleNumber, d.accessoryId)) ?? []
      : [];
    const pieces = piecesForBomLine(p, applicableSizes);
    dispatchInfo.set(d.id, { applicableSizes, pieces });
  }

  // Group by destination garmenter
  const byGarmenter = new Map<string, typeof dispatches>();
  for (const d of dispatches) {
    const key = d.destinationGarmenter || "Unassigned";
    if (!byGarmenter.has(key)) byGarmenter.set(key, []);
    byGarmenter.get(key)!.push(d);
  }

  // Look up addresses for garmenting vendors by name
  const garmenterNames = [...byGarmenter.keys()].filter((k) => k !== "Unassigned");
  const garmenterVendors = await db.vendor.findMany({
    where: { name: { in: garmenterNames }, type: "GARMENTING" },
    select: { name: true, address: true, contactInfo: true },
  });
  const vendorAddressMap = new Map(garmenterVendors.map((v) => [v.name, { address: v.address, contactInfo: v.contactInfo }]));

  const today = new Date();
  const todayStr = formatDate(today);

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .dn-page { page-break-after: always; }
          .dn-page:last-child { page-break-after: auto; }
          body { background: white; }
        }
        @page { size: A4; margin: 14mm; }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="text-sm text-muted-foreground">
          {byGarmenter.size} dispatch note{byGarmenter.size === 1 ? "" : "s"} ready ·{" "}
          {dispatches.length} accessory line{dispatches.length === 1 ? "" : "s"}
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[210mm] px-8 py-6 print:px-0 print:py-0">
        {Array.from(byGarmenter.entries()).map(([garmenter, rows]) => {
          const totalLines = rows.length;
          const phaseLabels = [
            ...new Set(rows.map((r) => `Phase ${r.phase.number} — ${r.phase.name}`)),
          ];

          const vendorInfo = vendorAddressMap.get(garmenter);
          const dnNumberOnRows = rows.find((r) => r.dnNumber)?.dnNumber ?? "—";
          const isCancelled = rows.every((r) => r.status === "CANCELLED");

          return (
            <section key={garmenter} className={`dn-page mb-10 print:mb-0 relative ${isCancelled ? "opacity-75" : ""}`}>
              {isCancelled && (
                <>
                  <div className="mb-2 rounded border-2 border-red-600 bg-red-50 px-3 py-2 text-center text-sm font-bold uppercase tracking-widest text-red-700 [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                    Cancelled
                  </div>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-10 select-none"
                  >
                    <span className="rotate-[-18deg] text-[9rem] font-black tracking-widest text-red-500/15 print:text-red-500/25 [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                      CANCELLED
                    </span>
                  </div>
                </>
              )}
              {/* Header */}
              <div className="border-2 border-black p-3">
                <div className="text-left">
                  <div className="text-lg font-bold tracking-wide text-blue-700">
                    {ECOZEN_HEADER.legalName}
                  </div>
                  {ECOZEN_HEADER.addressLines.map((line, i) => (
                    <div key={i} className="text-[11px] leading-tight">
                      {line}
                    </div>
                  ))}
                  <div className="text-[11px] leading-tight">
                    GSTIN: {ECOZEN_HEADER.gstin}
                  </div>
                </div>
              </div>

              <div className="mt-3 border border-black">
                <div className="text-center text-base font-bold bg-blue-700 border-b border-black py-1 text-white print:[print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  ACCESSORY DISPATCH NOTE
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr>
                      <td className="border-r border-b border-black px-2 py-1 font-semibold w-[15%]">DN NUMBER</td>
                      <td className="border-r border-b border-black px-2 py-1 w-[35%] font-mono">{dnNumberOnRows}</td>
                      <td rowSpan={3} className="border-r border-black px-2 py-1 font-semibold w-[15%] align-top">
                        DESTINATION
                      </td>
                      <td rowSpan={3} className="px-2 py-1 w-[35%] align-top">
                        <div className="font-semibold">{garmenter}</div>
                        {vendorInfo?.address && (
                          <div className="text-[10px] text-gray-600 mt-0.5 whitespace-pre-line">{vendorInfo.address}</div>
                        )}
                        {vendorInfo?.contactInfo && (
                          <div className="text-[10px] text-gray-600 mt-0.5">{vendorInfo.contactInfo}</div>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="border-r border-b border-black px-2 py-1 font-semibold">DATE</td>
                      <td className="border-r border-b border-black px-2 py-1">{todayStr}</td>
                    </tr>
                    <tr>
                      <td className="border-r border-black px-2 py-1 font-semibold">PHASE(S)</td>
                      <td className="border-r border-black px-2 py-1">{phaseLabels.join(", ")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Line items */}
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 px-2 py-1 border border-black border-b-0 text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                  Items to Dispatch
                </div>
                {(() => {
                  // Combine rows with the same accessory: sum accessory qty, list each
                  // article with its piece count in brackets, total pieces in last col.
                  type Row = (typeof rows)[number];
                  const grouped = new Map<string, { rows: Row[]; totalQty: number; totalPieces: number }>();
                  for (const r of rows) {
                    const key = r.accessoryId;
                    if (!grouped.has(key)) grouped.set(key, { rows: [], totalQty: 0, totalPieces: 0 });
                    const g = grouped.get(key)!;
                    g.rows.push(r);
                    g.totalQty += Number(r.quantity);
                    g.totalPieces += dispatchInfo.get(r.id)?.pieces ?? 0;
                  }
                  const groupedList = Array.from(grouped.values()).sort((a, b) => {
                    const ac = a.rows[0].accessory.category || "";
                    const bc = b.rows[0].accessory.category || "";
                    if (ac !== bc) return ac.localeCompare(bc);
                    return accessoryDisplayName(a.rows[0].accessory).localeCompare(
                      accessoryDisplayName(b.rows[0].accessory),
                    );
                  });
                  return (
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border border-black bg-gray-50">
                          <th className="border border-black px-1.5 py-1 text-left w-8">S.No</th>
                          <th className="border border-black px-1.5 py-1 text-left w-32">Image</th>
                          <th className="border border-black px-1.5 py-1 text-left">Accessory</th>
                          <th className="border border-black px-1.5 py-1 text-left w-16">Category</th>
                          <th className="border border-black px-1.5 py-1 text-right w-24">Quantity</th>
                          <th className="border border-black px-1.5 py-1 text-left w-48">For Article</th>
                          <th className="border border-black px-1.5 py-1 text-right w-20">Total Article Pieces</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedList.map((g, idx) => {
                          const first = g.rows[0];
                          const display = accessoryDisplayName(first.accessory);
                          const imageUrl = (first.accessory as Record<string, unknown>).imageUrl as string | null;
                          return (
                            <tr key={first.accessoryId} className="align-top">
                              <td className="border border-black px-1.5 py-1">{idx + 1}</td>
                              <td className="border border-black px-1 py-1">
                                {imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={imageUrl}
                                    alt={display}
                                    className="w-32 h-32 object-contain"
                                    style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                                  />
                                ) : (
                                  <div className="w-32 h-32 border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400">
                                    No img
                                  </div>
                                )}
                              </td>
                              <td className="border border-black px-1.5 py-1">{display}</td>
                              <td className="border border-black px-1.5 py-1">{first.accessory.category}</td>
                              <td className="border border-black px-1.5 py-1 text-right">
                                {formatQty(g.totalQty, first.accessory.unit.toLowerCase())}
                              </td>
                              <td className="border border-black px-1.5 py-1">
                                {g.rows.length === 0
                                  ? "—"
                                  : g.rows.map((r, i) => {
                                      const label = r.product
                                        ? `${r.product.articleNumber || "—"} / ${r.product.colourOrdered || ""}`.trim()
                                        : "—";
                                      const info = dispatchInfo.get(r.id);
                                      const sizes = info?.applicableSizes ?? [];
                                      const pcs = info?.pieces ?? 0;
                                      const sizeNote = sizes.length ? ` [${sizes.join("/")}]` : "";
                                      return (
                                        <div key={r.id} className={`flex gap-1 ${i > 0 ? "mt-0.5" : ""}`}>
                                          <span aria-hidden>•</span>
                                          <span>{label}{sizeNote} ({pcs})</span>
                                        </div>
                                      );
                                    })}
                              </td>
                              <td className="border border-black px-1.5 py-1 text-right">
                                {g.totalPieces}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} className="border border-black px-1.5 py-1 text-right font-semibold bg-gray-50">
                            {groupedList.length} line{groupedList.length === 1 ? "" : "s"} total ({totalLines} dispatch{totalLines === 1 ? "" : "es"})
                          </td>
                          <td className="border border-black px-1.5 py-1 text-right font-semibold bg-gray-50">
                            {groupedList.reduce((s, g) => s + g.totalPieces, 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                })()}
              </div>

              {/* Sign-off */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="text-[11px]">
                  <div className="font-semibold">Prepared by</div>
                  <div className="mt-8 border-t border-black pt-0.5">Warehouse Team</div>
                  <div className="text-[10px] text-gray-600">Name &amp; Signature</div>
                </div>
                <div className="text-[11px]">
                  <div className="font-semibold">Received by</div>
                  <div className="mt-8 border-t border-black pt-0.5">Garmenter</div>
                  <div className="text-[10px] text-gray-600">Name &amp; Signature</div>
                </div>
              </div>

              <div className="mt-3 text-center text-[9px] text-gray-500 italic">
                This is a computer-generated dispatch note.
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
