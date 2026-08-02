/**
 * Moneda del conjunto según su país.
 *
 * Antes se resolvía con `pais === "CO" ? "COP" : "MXN"`, que funcionaba mientras
 * el registro solo ofrecía tres países — y aun así **Ecuador acababa con pesos
 * mexicanos**, cuando su moneda es el dólar. Al abrir el selector a todos los
 * países ese atajo pasaba de inexacto a claramente roto: un conjunto en Chile
 * habría emitido cobros en MXN.
 *
 * El producto solo formatea COP, MXN y USD (ver `src/lib/currency.ts` y la
 * trampa de CLAUDE.md: todo tenant necesita una moneda válida). Así que los
 * países fuera de los mercados actuales caen en USD, que es la opción neutral
 * y la que de hecho usan varios de ellos. Cuando Vivaru abra un mercado nuevo,
 * se añade su moneda a `AppCurrency` y su país aquí.
 */

export type TenantCurrency = "COP" | "MXN" | "USD";

const BY_COUNTRY: Record<string, TenantCurrency> = {
  CO: "COP",
  MX: "MXN",
  // Ecuador, Panamá y El Salvador están dolarizados: USD no es un supuesto.
  EC: "USD",
  PA: "USD",
  SV: "USD",
  US: "USD",
};

export function currencyForCountry(country: string | undefined): TenantCurrency {
  if (!country) return "MXN";
  return BY_COUNTRY[country.toUpperCase()] ?? "USD";
}
