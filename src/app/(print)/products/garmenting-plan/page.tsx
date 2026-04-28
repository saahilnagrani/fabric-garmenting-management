import { getGarmentingPlanData } from "@/actions/products";
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

  // Within each garmenter, sort by article number then fabric slot so the
  // multi-fabric rows for an article stay contiguous and in slot order.
  for (const list of byVendor.values()) {
    list.sort((a, b) =>
      a.articleNumber.localeCompare(b.articleNumber, undefined, { numeric: true }) ||
      a.fabricSlot - b.fabricSlot
    );
  }

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .vendor-page { page-break-after: always; }
          .vendor-page:last-child { page-break-after: auto; }
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
          // Group rows by article order so we can rowSpan the article-level
          // cells (Article Number, Expected FG) across each article's fabric
          // rows. Vendor name is rowSpan across the whole table since this
          // section is a single garmenter.
          type ArticleGroup = { productId: string; articleNumber: string; expectedFG: number; rows: PlanRow[] };
          const groups: ArticleGroup[] = [];
          for (const r of vendorRows) {
            const last = groups[groups.length - 1];
            if (last && last.productId === r.productId) {
              last.rows.push(r);
            } else {
              groups.push({
                productId: r.productId,
                articleNumber: r.articleNumber,
                expectedFG: r.expectedFG,
                rows: [r],
              });
            }
          }

          const totalKg = vendorRows.reduce((s, r) => s + r.fabricQtyKg, 0);
          const totalFG = groups.reduce((s, g) => s + g.expectedFG, 0);
          const totalRows = vendorRows.length;

          return (
            <section key={vendorName} className="vendor-page mb-10 print:mb-0">
              <div className="border-2 border-black p-3 mb-3">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-base font-bold uppercase tracking-wide">Garmenting Plan</div>
                    <div className="text-[11px]">For: <span className="font-semibold">{vendorName}</span></div>
                  </div>
                  <div className="text-[11px] text-right">
                    <div>Date: {today}</div>
                    <div>{groups.length} article{groups.length === 1 ? "" : "s"} · {totalRows} fabric line{totalRows === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-2 py-1 text-left">Vendor name</th>
                    <th className="border border-black px-2 py-1 text-left">Article Number</th>
                    <th className="border border-black px-2 py-1 text-left">Fabric name</th>
                    <th className="border border-black px-2 py-1 text-left">Colour</th>
                    <th className="border border-black px-2 py-1 text-right">Fabric Qty</th>
                    <th className="border border-black px-2 py-1 text-right">No. of Garments per kg</th>
                    <th className="border border-black px-2 py-1 text-right">Expected FG</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group, gi) =>
                    group.rows.map((r, ri) => {
                      const isFirstRowOfGarmenter = gi === 0 && ri === 0;
                      const isFirstRowOfGroup = ri === 0;
                      return (
                        <tr key={`${group.productId}-${r.fabricSlot}`} className="align-middle">
                          {isFirstRowOfGarmenter && (
                            <td
                              rowSpan={totalRows}
                              className="border border-black px-2 py-1 align-middle text-center font-medium"
                            >
                              {vendorName}
                            </td>
                          )}
                          {isFirstRowOfGroup && (
                            <td
                              rowSpan={group.rows.length}
                              className="border border-black px-2 py-1 align-middle text-center"
                            >
                              {group.articleNumber || "—"}
                            </td>
                          )}
                          <td className="border border-black px-2 py-1">{r.fabricName || "—"}</td>
                          <td className="border border-black px-2 py-1">{r.colour || "—"}</td>
                          <td className="border border-black px-2 py-1 text-right">{formatKg(r.fabricQtyKg)}</td>
                          <td className="border border-black px-2 py-1 text-right">{r.garmentsPerKg || "—"}</td>
                          {isFirstRowOfGroup && (
                            <td
                              rowSpan={group.rows.length}
                              className="border border-black px-2 py-1 text-right align-middle"
                            >
                              {group.expectedFG}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
