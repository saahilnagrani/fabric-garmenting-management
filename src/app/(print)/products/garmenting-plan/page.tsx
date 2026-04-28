import { getGarmentingPlanData } from "@/actions/products";
import { ECOZEN_HEADER, PO_SIGNATORY } from "@/lib/company";
import { PrintButton } from "./print-button";

type PlanRow = Awaited<ReturnType<typeof getGarmentingPlanData>>[number];

function formatKg(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

export default async function GarmentingPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const ids = (params.ids || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          No article orders selected. Go back to the Article Orders page, tick some rows, and click
          &quot;Generate Garmenting Plan&quot;.
        </p>
      </div>
    );
  }

  const rows = await getGarmentingPlanData(ids);

  if (rows.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No matching article orders found.</p>
      </div>
    );
  }

  // Group by garmenter (one section/page per garmenter).
  const byVendor = new Map<string, PlanRow[]>();
  for (const r of rows) {
    const key = r.garmentingAt || "(Unassigned)";
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(r);
  }

  // Within each garmenter, sort by article → productId → fabric slot so each
  // article order's colour combo stays cohesive (its 2 fabric-slot rows are
  // adjacent and ordered slot-1 then slot-2). Article Number still rowSpans
  // across every row of an article, and fabric name merges only when the
  // same fabric repeats consecutively (e.g. when both slots of one product
  // use the same fabric). Expected FG, which is a per-product number, gets
  // a clean 2-row span per multi-slot order.
  for (const list of byVendor.values()) {
    list.sort((a, b) =>
      a.articleNumber.localeCompare(b.articleNumber, undefined, { numeric: true }) ||
      a.productId.localeCompare(b.productId) ||
      a.fabricSlot - b.fabricSlot
    );
  }

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .gp-page { page-break-after: always; }
          .gp-page:last-child { page-break-after: auto; }
          body { background: white; }
        }
        @page { size: A4; margin: 14mm; }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="text-sm text-muted-foreground">
          {byVendor.size} garmenting plan{byVendor.size === 1 ? "" : "s"} ready · {rows.length} fabric line{rows.length === 1 ? "" : "s"}
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[210mm] px-8 py-6 print:px-0 print:py-0">
        {Array.from(byVendor.entries()).map(([vendorName, vendorRows]) => {
          // Compute three independent rowSpan groupings over the (already
          // article→fabric→colour-sorted) vendorRows:
          //   articleRowSpan – span across all rows sharing an articleNumber
          //   fabricRowSpan  – span across rows sharing (article, fabric)
          //   productRowSpan – span across consecutive rows of the same
          //                    productId, used for Expected FG (which is a
          //                    per-product number)
          // Each row stores 0 when it isn't the first row of its group, or
          // the span count when it is; the renderer emits the cell only when
          // the count is non-zero.
          type Annotated = PlanRow & {
            articleRowSpan: number;
            fabricRowSpan: number;
            productRowSpan: number;
          };
          const annotated: Annotated[] = vendorRows.map((r) => ({
            ...r,
            articleRowSpan: 0,
            fabricRowSpan: 0,
            productRowSpan: 0,
          }));
          {
            let i = 0;
            while (i < annotated.length) {
              let j = i;
              while (j < annotated.length && annotated[j].articleNumber === annotated[i].articleNumber) j++;
              annotated[i].articleRowSpan = j - i;
              // fabric groups within this article
              let k = i;
              while (k < j) {
                let l = k;
                while (l < j && annotated[l].fabricName === annotated[k].fabricName) l++;
                annotated[k].fabricRowSpan = l - k;
                k = l;
              }
              // product groups (consecutive same productId) within this article
              let m = i;
              while (m < j) {
                let n = m;
                while (n < j && annotated[n].productId === annotated[m].productId) n++;
                annotated[m].productRowSpan = n - m;
                m = n;
              }
              i = j;
            }
          }

          const totalKg = vendorRows.reduce((s, r) => s + r.fabricQtyKg, 0);
          const seenProducts = new Set<string>();
          let totalFG = 0;
          for (const r of vendorRows) {
            if (!seenProducts.has(r.productId)) {
              seenProducts.add(r.productId);
              totalFG += r.expectedFG;
            }
          }
          const totalRows = vendorRows.length;
          const articleCount = new Set(vendorRows.map((r) => r.articleNumber)).size;

          return (
            <section key={vendorName} className="gp-page mb-10 print:mb-0">
              {/* Ecozen header */}
              <div className="border-2 border-black p-3">
                <div className="text-left">
                  <div className="text-lg font-bold tracking-wide text-blue-700">{ECOZEN_HEADER.legalName}</div>
                  {ECOZEN_HEADER.addressLines.map((line, i) => (
                    <div key={i} className="text-[11px] leading-tight">{line}</div>
                  ))}
                  <div className="text-[11px] leading-tight">State : {ECOZEN_HEADER.state}</div>
                  <div className="text-[11px] leading-tight">
                    PAN No : {ECOZEN_HEADER.pan} &nbsp;&nbsp; GSTIN No.: {ECOZEN_HEADER.gstin}
                  </div>
                  <div className="text-[11px] leading-tight">CONTACT NO.: {ECOZEN_HEADER.contactNumber}</div>
                </div>
              </div>

              {/* Title + meta row */}
              <div className="mt-3 border border-black">
                <div className="text-center text-base font-bold bg-blue-700 border-b border-black py-1 text-white print:[print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  GARMENTING PLAN
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr>
                      <td className="border-r border-black px-2 py-1 font-semibold w-1/4">PLAN DATE</td>
                      <td className="border-r border-black px-2 py-1 w-1/4">{today}</td>
                      <td className="border-r border-black px-2 py-1 font-semibold w-1/4">SCOPE</td>
                      <td className="px-2 py-1 w-1/4">
                        {articleCount} article{articleCount === 1 ? "" : "s"} · {totalRows} fabric line{totalRows === 1 ? "" : "s"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Garmenter block */}
              <div className="mt-3 border border-black">
                <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 px-2 py-1 border-b border-black text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                  Garmenter
                </div>
                <div className="p-2">
                  <div className="text-[11px] font-semibold">{vendorName}</div>
                </div>
              </div>

              {/* Plan details */}
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 px-2 py-1 border border-black border-b-0 text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                  Plan Details
                </div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-black px-2 py-1 text-left">Article Number</th>
                    <th className="border border-black px-2 py-1 text-left">Product Type</th>
                    <th className="border border-black px-2 py-1 text-left whitespace-nowrap">Fabric name</th>
                    <th className="border border-black px-2 py-1 text-left">Colour</th>
                    <th className="border border-black px-2 py-1 text-right">Fabric Qty</th>
                    <th className="border border-black px-2 py-1 text-right" style={{ width: "90px" }}>No. of Garments per kg</th>
                    <th className="border border-black px-2 py-1 text-right">Expected FG</th>
                  </tr>
                </thead>
                <tbody>
                  {annotated.map((r, idx) => (
                    <tr key={`${r.productId}-${r.fabricSlot}-${idx}`} className="align-middle">
                      {r.articleRowSpan > 0 && (
                        <td
                          rowSpan={r.articleRowSpan}
                          className="border border-black px-2 py-1 align-middle text-center"
                        >
                          {r.articleNumber || "—"}
                        </td>
                      )}
                      {r.articleRowSpan > 0 && (
                        <td
                          rowSpan={r.articleRowSpan}
                          className="border border-black px-2 py-1 align-middle"
                        >
                          {r.type || "—"}
                        </td>
                      )}
                      {r.fabricRowSpan > 0 && (
                        <td
                          rowSpan={r.fabricRowSpan}
                          className="border border-black px-2 py-1 align-middle whitespace-nowrap"
                        >
                          {r.fabricName || "—"}
                        </td>
                      )}
                      <td className="border border-black px-2 py-1">{r.colour || "—"}</td>
                      <td className="border border-black px-2 py-1 text-right">{formatKg(r.fabricQtyKg)}</td>
                      <td className="border border-black px-2 py-1 text-right">{r.garmentsPerKg || "—"}</td>
                      {r.productRowSpan > 0 && (
                        <td
                          rowSpan={r.productRowSpan}
                          className="border border-black px-2 py-1 text-right align-middle"
                        >
                          {r.expectedFG}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={4} className="border border-black px-2 py-1 text-right">Totals</td>
                    <td className="border border-black px-2 py-1 text-right">{formatKg(totalKg)}</td>
                    <td className="border border-black px-2 py-1"></td>
                    <td className="border border-black px-2 py-1 text-right">{totalFG}</td>
                  </tr>
                </tfoot>
              </table>
              </div>

              {/* Signatory */}
              <div className="mt-6 flex justify-end">
                <div className="text-[11px] text-right">
                  <div className="font-semibold">Authorised Signatory</div>
                  <div>For {ECOZEN_HEADER.legalName}</div>
                  <div className="mt-8 border-t border-black pt-0.5 min-w-[200px]">{PO_SIGNATORY.name}</div>
                  <div className="text-[10px] text-gray-600">{PO_SIGNATORY.title}</div>
                </div>
              </div>

              <div className="mt-3 text-center text-[9px] text-gray-500 italic">
                This is a computer-generated garmenting plan. For queries, contact {PO_SIGNATORY.queriesEmail}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
