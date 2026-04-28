"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-1.5 text-[12px] border border-black bg-white hover:bg-gray-50"
    >
      Print / Save as PDF
    </button>
  );
}
