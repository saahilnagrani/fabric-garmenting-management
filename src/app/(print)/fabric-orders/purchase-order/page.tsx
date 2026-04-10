import { getPurchaseOrderData } from "@/actions/fabric-orders";
import { ECOZEN_HEADER, PO_DEFAULTS, PO_SIGNATORY, PO_TERMS } from "@/lib/company";
import { PrintButton } from "./print-button";

type POData = Awaited<ReturnType<typeof getPurchaseOrderData>>;
type FabricOrderRow = POData["orders"][number];

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatKg(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

/**
 * Convert an integer to Indian-English words (Lakh/Crore system).
 * Handles up to 99,99,99,999.
 */
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

export default async function PurchaseOrderPage({
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
          No fabric orders selected. Go back to the Fabric Orders page, tick some rows, and click
          &quot;Generate Purchase Orders&quot;.
        </p>
      </div>
    );
  }

  const { orders, fabricMastersByName, garmentersByName, poNumbersByVendorId } =
    await getPurchaseOrderData(ids);

  if (orders.length === 0) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">No matching fabric orders found.</p>
      </div>
    );
  }

  // Group by vendor
  const byVendor = new Map<string, FabricOrderRow[]>();
  for (const o of orders) {
    const key = o.fabricVendorId;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(o);
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
          {byVendor.size} purchase order{byVendor.size === 1 ? "" : "s"} ready · {orders.length} source line{orders.length === 1 ? "" : "s"}
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[210mm] px-8 py-6 print:px-0 print:py-0">
        {Array.from(byVendor.entries()).map(([vendorId, vendorOrders]) => {
          const vendor = vendorOrders[0].fabricVendor;
          const poNumber = poNumbersByVendorId[vendorId] ?? vendorOrders[0].poNumber ?? "—";

          // Combine rows: sum qty for each (fabricName, colour) pair.
          // Rate is weighted-average when orders have different rates; we round to 2dp.
          type Combined = {
            fabricName: string;
            colour: string;
            hsnCode: string;
            qty: number;
            rate: number;
            amount: number;
          };
          const keyToCombined = new Map<string, Combined>();
          for (const o of vendorOrders) {
            const qty = Number(o.fabricOrderedQuantityKg) || 0;
            const rate = Number(o.costPerUnit) || 0;
            const key = `${o.fabricName}::${o.colour}`;
            const existing = keyToCombined.get(key);
            if (existing) {
              const newQty = existing.qty + qty;
              const newAmount = existing.amount + qty * rate;
              existing.qty = newQty;
              existing.amount = newAmount;
              existing.rate = newQty > 0 ? newAmount / newQty : 0;
            } else {
              keyToCombined.set(key, {
                fabricName: o.fabricName,
                colour: o.colour,
                hsnCode: fabricMastersByName[o.fabricName]?.hsnCode || "",
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

          // Resolve shipping location — look up garmenter vendor by name.
          // We take the first order's garmentingAt; if selected orders span
          // multiple garmenters, we list them all as a fallback.
          const garmenterNames = [...new Set(vendorOrders.map((o) => o.garmentingAt).filter(Boolean))] as string[];
          const primaryGarmenterName = garmenterNames[0] || null;
          const primaryGarmenter = primaryGarmenterName ? garmentersByName[primaryGarmenterName] : null;

          return (
            <section key={vendorId} className="po-page mb-10 print:mb-0">
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

              {/* PO title + meta row */}
              <div className="mt-3 border border-black">
                <div className="text-center text-base font-bold bg-blue-700 border-b border-black py-1 text-white print:[print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
                  PURCHASE ORDER
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
                  <div className="text-[11px] font-semibold">{vendor.name}</div>
                  {vendor.address && (
                    <div className="text-[11px] whitespace-pre-line leading-snug mt-0.5">{vendor.address}</div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-700 -m-2 mb-2 px-2 py-1 border-b border-black text-white [-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
                    Buyer / Ship To
                  </div>
                  {primaryGarmenter?.address ? (
                    <div className="text-[11px] whitespace-pre-line leading-snug">
                      {primaryGarmenter.address}
                    </div>
                  ) : primaryGarmenter ? (
                    <div className="text-[11px] leading-snug">{primaryGarmenter.name}</div>
                  ) : primaryGarmenterName ? (
                    <div className="text-[11px] leading-snug">{primaryGarmenterName}</div>
                  ) : (
                    <div className="text-[11px] italic text-gray-500">No shipping location on order</div>
                  )}
                  {garmenterNames.length > 1 && (
                    <div className="text-[10px] italic text-gray-600 mt-1">
                      + {garmenterNames.length - 1} other location{garmenterNames.length - 1 === 1 ? "" : "s"}
                    </div>
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
                      <th className="border border-black px-1.5 py-1 text-left">Fabric Description</th>
                      <th className="border border-black px-1.5 py-1 text-left w-16">HSN Code</th>
                      <th className="border border-black px-1.5 py-1 text-left w-24">Colour</th>
                      <th className="border border-black px-1.5 py-1 text-right w-16">Qty (kgs)</th>
                      <th className="border border-black px-1.5 py-1 text-right w-20">Rate (INR/kg)</th>
                      <th className="border border-black px-1.5 py-1 text-right w-24">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((l, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="border border-black px-1.5 py-1">{idx + 1}</td>
                        <td className="border border-black px-1.5 py-1">{l.fabricName}</td>
                        <td className="border border-black px-1.5 py-1">{l.hsnCode || "—"}</td>
                        <td className="border border-black px-1.5 py-1">{l.colour}</td>
                        <td className="border border-black px-1.5 py-1 text-right">{formatKg(l.qty)}</td>
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

              {/* Amount in words */}
              <div className="mt-2 border border-black px-2 py-1 text-[11px]">
                <span className="font-semibold">Amount in words:</span> {amountInWords(grandTotal)}
              </div>

              {/* Terms */}
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
                This is a computer-generated purchase order. For queries, contact {PO_SIGNATORY.queriesEmail}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
