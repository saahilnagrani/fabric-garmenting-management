const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return currencyFormatter.format(num);
}

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return numberFormatter.format(num);
}

export function formatPercent(value: number | string | null | undefined): string {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return `${(num * 100).toFixed(1)}%`;
}

export function formatDecimal(value: number | string | null | undefined, digits = 2): string {
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toFixed(digits);
}
