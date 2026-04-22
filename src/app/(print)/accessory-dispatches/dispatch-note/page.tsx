import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";
import { ECOZEN_HEADER } from "@/lib/company";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { PrintButton } from "../../fabric-orders/purchase-order/print-button";

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
          articleNumber: true,
          colourOrdered: true,
          productName: true,
          garmentNumber: true,
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
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border border-black bg-gray-50">
                      <th className="border border-black px-1.5 py-1 text-left w-8">S.No</th>
                      <th className="border border-black px-1.5 py-1 text-left w-20">Image</th>
                      <th className="border border-black px-1.5 py-1 text-left">Accessory</th>
                      <th className="border border-black px-1.5 py-1 text-left w-16">Category</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Quantity</th>
                      <th className="border border-black px-1.5 py-1 text-left w-32">For Article</th>
                      <th className="border border-black px-1.5 py-1 text-right w-16">Pieces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const display = accessoryDisplayName(r.accessory);
                      const imageUrl = (r.accessory as Record<string, unknown>).imageUrl as string | null;
                      return (
                        <tr key={r.id} className="align-top">
                          <td className="border border-black px-1.5 py-1">{idx + 1}</td>
                          <td className="border border-black px-1 py-1">
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl}
                                alt={display}
                                className="w-20 h-20 object-contain"
                                style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
                              />
                            ) : (
                              <div className="w-20 h-20 border border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400">
                                No img
                              </div>
                            )}
                          </td>
                          <td className="border border-black px-1.5 py-1">{display}</td>
                          <td className="border border-black px-1.5 py-1">{r.accessory.category}</td>
                          <td className="border border-black px-1.5 py-1 text-right">
                            {formatQty(Number(r.quantity), r.accessory.unit.toLowerCase())}
                          </td>
                          <td className="border border-black px-1.5 py-1">
                            {r.product
                              ? `${r.product.articleNumber || "—"} / ${r.product.colourOrdered || ""}`.trim()
                              : "—"}
                          </td>
                          <td className="border border-black px-1.5 py-1 text-right">
                            {r.product?.garmentNumber ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="border border-black px-1.5 py-1 text-right font-semibold bg-gray-50">
                        {totalLines} line{totalLines === 1 ? "" : "s"} total
                      </td>
                    </tr>
                  </tfoot>
                </table>
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
