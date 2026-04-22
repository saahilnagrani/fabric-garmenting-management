import { getAccessoryPurchaseOrderData } from "@/actions/accessory-purchases";
import { ECOZEN_HEADER, ECOZEN_WAREHOUSE, PO_DEFAULTS, PO_SIGNATORY, PO_TERMS } from "@/lib/company";
import { accessoryDisplayName } from "@/lib/accessory-display";
import { PrintButton } from "./print-button";

type POData = Awaited<ReturnType<typeof getAccessoryPurchaseOrderData>>;
type PurchaseRow = POData["purchases"][number];

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatQty(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

function numberToIndianWords(num: number): string {
  if (num === 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (n: number): string => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? "-" + a[n % 10] : "");
  };
  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (h) parts.push(a[h] + " Hundred");
    if (rest) parts.push(twoDigits(rest));
    return parts.join(" ");
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeeWords = numberToIndianWords(rupees);
  if (paise === 0) return `Rupees ${rupeeWords} Only.`;
  return `Rupees ${rupeeWords} and ${numberToIndianWords(paise)} Paise Only.`;
}

export default async function AccessoryPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; poNumber?: string }>;
}) {
  const params = await searchParams;
  const poNumber = params.poNumber?.trim();
  const ids = (params.ids || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (!poNumber && ids.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          No accessory purchases selected. Go back to the Accessory Purchases page, tick some rows,
          and click &quot;Generate Purchase Orders&quot;.
        </p>
      </div>
    );
  }

  const { purchases, poNumbersByVendorId } = await getAccessoryPurchaseOrderData(
    poNumber ? { poNumber } : { ids },
  );

  if (purchases.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">
          No matching accessory purchases found with an assigned vendor. POs require a supplier,
          so rows without a vendor are skipped.
        </p>
      </div>
    );
  }

  const byVendor = new Map<string, PurchaseRow[]>();
  for (const p of purchases) {
    if (!p.vendorId) continue;
    if (!byVendor.has(p.vendorId)) byVendor.set(p.vendorId, []);
    byVendor.get(p.vendorId)!.push(p);
  }

  const today = new Date();
  const todayStr = formatDate(today);

  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .po-page { page-break-after: always; }
          .po-page:last-child { page-break-after: auto; }
          body { background: white; }
        }
        @page { size: A4; margin: 14mm; }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="text-sm text-muted-foreground">
          {byVendor.size} purchase order{byVendor.size === 1 ? "" : "s"} ready · {purchases.length} source line{purchases.length === 1 ? "" : "s"}
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[210mm] px-8 py-6 print:px-0 print:py-0">
        {Array.from(byVendor.entries()).map(([vendorId, vendorPurchases]) => {
          const vendor = vendorPurchases[0].vendor;
          const poNumber = poNumbersByVendorId[vendorId] ?? vendorPurchases[0].poNumber ?? "—";

          // Combine rows: sum qty for each (accessoryId) line. If the same accessory
          // appears twice with different rates, use a weighted-average rate.
          type Combined = {
            description: string;
            category: string;
            unit: string;
            qty: number;
            rate: number;
            amount: number;
          };
          const keyToCombined = new Map<string, Combined>();
          for (const p of vendorPurchases) {
            const qty = Number(p.quantity) || 0;
            const rate = Number(p.costPerUnit) || 0;
            const key = p.accessoryId;
            const existing = keyToCombined.get(key);
            if (existing) {
              const newQty = existing.qty + qty;
              const newAmount = existing.amount + qty * rate;
              existing.qty = newQty;
              existing.amount = newAmount;
              existing.rate = newQty > 0 ? newAmount / newQty : 0;
            } else {
              keyToCombined.set(key, {
                description: accessoryDisplayName(p.accessory),
                category: p.accessory.category,
                unit: p.accessory.unit,
                qty,
                rate,
                amount: qty * rate,
              });
            }
          }
          const lineItems = Array.from(keyToCombined.values());

          const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
          const cgst = subtotal * PO_DEFAULTS.cgstRate;
          const sgst = subtotal * PO_DEFAULTS.sgstRate;
          const grandTotal = subtotal + cgst + sgst;

          const isCancelled = vendorPurchases.every((p) => p.status === "CANCELLED");

          return (
            <section key={vendorId} className={`po-page mb-10 print:mb-0 relative ${isCancelled ? "opacity-75" : ""}`}>
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

              <div className="mt-3 border border-black">
                <div className="text-center text-base font-bold bg-blue-700 border-b border-black py-1 text-white print:[print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  ACCESSORY PURCHASE ORDER
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr>
                      <td className="border-r border-black px-2 py-1 font-semibold w-1/4">PO NUMBER</td>
                      <td className="border-r border-black px-2 py-1 w-1/4">{poNumber}</td>
                      <td className="border-r border-black px-2 py-1 font-semibold w-1/4">PO DATE</td>
                      <td className="px-2 py-1 w-1/4">{todayStr}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Supplier / Ship-to */}
              <div className="mt-3 grid grid-cols-2 gap-0 border border-black">
                <div className="border-r border-black p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 -m-2 mb-2 px-2 py-1 border-b border-black text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                    Supplier / Bill From
                  </div>
                  <div className="text-[11px] font-semibold">{vendor?.name ?? "—"}</div>
                  {vendor?.address && (
                    <div className="text-[11px] whitespace-pre-line leading-snug mt-0.5">{vendor.address}</div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 -m-2 mb-2 px-2 py-1 border-b border-black text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                    Ship To
                  </div>
                  {vendorPurchases[0].shipToVendor ? (
                    <>
                      <div className="text-[11px] font-semibold">{vendorPurchases[0].shipToVendor.name}</div>
                      {vendorPurchases[0].shipToVendor.address && (
                        <div className="text-[11px] whitespace-pre-line leading-snug mt-0.5">
                          {vendorPurchases[0].shipToVendor.address}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-[11px] font-semibold">{ECOZEN_WAREHOUSE.legalName}</div>
                      {ECOZEN_WAREHOUSE.addressLines.map((line, i) => (
                        <div key={i} className="text-[11px] leading-tight">{line}</div>
                      ))}
                      <div className="text-[11px] leading-tight">State : {ECOZEN_WAREHOUSE.state}</div>
                      <div className="text-[11px] leading-tight">GSTIN : {ECOZEN_WAREHOUSE.gstin}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 px-2 py-1 border border-black border-b-0 text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                  Order Details
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border border-black bg-gray-50">
                      <th className="border border-black px-1.5 py-1 text-left w-8">S.No</th>
                      <th className="border border-black px-1.5 py-1 text-left">Accessory</th>
                      <th className="border border-black px-1.5 py-1 text-left w-24">Category</th>
                      <th className="border border-black px-1.5 py-1 text-left w-16">Unit</th>
                      <th className="border border-black px-1.5 py-1 text-right w-16">Qty</th>
                      <th className="border border-black px-1.5 py-1 text-right w-20">Rate (INR)</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((l, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="border border-black px-1.5 py-1">{idx + 1}</td>
                        <td className="border border-black px-1.5 py-1">{l.description}</td>
                        <td className="border border-black px-1.5 py-1">{l.category}</td>
                        <td className="border border-black px-1.5 py-1">{l.unit}</td>
                        <td className="border border-black px-1.5 py-1 text-right">{formatQty(l.qty)}</td>
                        <td className="border border-black px-1.5 py-1 text-right">{formatINR(l.rate)}</td>
                        <td className="border border-black px-1.5 py-1 text-right">{formatINR(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="border border-black px-1.5 py-1 text-right font-semibold">Subtotal</td>
                      <td className="border border-black px-1.5 py-1 text-right">{formatINR(subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-1.5 py-1 text-right">
                        CGST @ {(PO_DEFAULTS.cgstRate * 100).toFixed(1)}%
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right">{formatINR(cgst)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-1.5 py-1 text-right">
                        SGST @ {(PO_DEFAULTS.sgstRate * 100).toFixed(1)}%
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right">{formatINR(sgst)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-1.5 py-1 text-right font-bold bg-gray-50">
                        Grand Total (INR)
                      </td>
                      <td className="border border-black px-1.5 py-1 text-right font-bold bg-gray-50">
                        {formatINR(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-2 border border-black px-2 py-1 text-[11px]">
                <span className="font-semibold">Amount in words:</span> {amountInWords(grandTotal)}
              </div>

              <div className="mt-3">
                <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 px-2 py-1 border border-black border-b-0 text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                  Terms &amp; Conditions
                </div>
                <ol className="border border-black px-5 py-2 text-[10px] leading-snug list-decimal space-y-0.5">
                  {PO_TERMS.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="text-[11px] text-right">
                  <div className="font-semibold">Authorised Signatory</div>
                  <div>For {ECOZEN_HEADER.legalName}</div>
                  <div className="mt-8 border-t border-black pt-0.5 min-w-[200px]">{PO_SIGNATORY.name}</div>
                  <div className="text-[10px] text-gray-600">{PO_SIGNATORY.title}</div>
                </div>
              </div>

              <div className="mt-3 text-center text-[9px] text-gray-500 italic">
                This is a computer-generated purchase order. For queries, contact {PO_SIGNATORY.queriesEmail}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
