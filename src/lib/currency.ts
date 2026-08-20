export type AppCurrency = "COP" | "MXN" | "USD";

/**
 * Moneda del conjunto según su país.
 *
 * **Gemelo de `functions/src/country-currency.ts`.** No se importa de allí porque
 * `src/` no puede importar `functions/` (rompe el build de App Hosting, ver
 * CLAUDE.md). Si los dos divergen, un conjunto creado por la consola y uno
 * creado por el trial dejarían de parecerse — que es justo el defecto que esto
 * cierra.
 *
 * Los países fuera de los mercados actuales caen en USD, que es la opción
 * neutral y la que varios de ellos usan de hecho.
 */
const MONEDA_POR_PAIS: Record<string, AppCurrency> = {
  CO: "COP",
  MX: "MXN",
  // Dolarizados: USD no es un supuesto.
  EC: "USD",
  PA: "USD",
  SV: "USD",
  US: "USD",
};

export function currencyForCountry(country: string | undefined): AppCurrency {
  if (!country) return "MXN";
  return MONEDA_POR_PAIS[country.toUpperCase()] ?? "USD";
}

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
