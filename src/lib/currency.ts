export type AppCurrency = "COP" | "MXN" | "USD";

const LOCALE_MAP: Record<AppCurrency, string> = {
  COP: "es-CO",
  MXN: "es-MX",
  USD: "en-US",
};

export function formatAmount(value: number, currency: AppCurrency = "COP"): string {
  return new Intl.NumberFormat(LOCALE_MAP[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatAmountCompact(value: number, currency: AppCurrency = "COP"): string {
  return new Intl.NumberFormat(LOCALE_MAP[currency], {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export const CURRENCY_OPTIONS: { value: AppCurrency; label: string }[] = [
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "USD", label: "USD — Dólar estadounidense" },
];
