// tests/facturado-una-sola-formula.test.ts
// Chip cerrado el 2 sep 2026. `statementChargedAmount` (collection.ts) es LA fórmula
// del facturado y ya incluye `advanceAppliedAmount` (FLOW-002 R4). La página de
// Cartera tenía un gemelo escrito a mano —`balance + paymentAmount`— que olvidaba
// el anticipo: un cargo legado sin `amount` cubierto con un anticipo salía facturado
// de menos. Medido el 2 sep en producción: 221 cobros, 1 sin `amount` numérico, 0
// con anticipo — latente, no roto. Este guardián evita que vuelva a nacer un gemelo.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { statementChargedAmount } from "../src/features/billing/collection";

const RAIZ = path.resolve(__dirname, "../src");
const FORMULA_CANONICA = path.resolve(RAIZ, "features/billing/collection.ts");

function ficherosDeFuente(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosDeFuente(ruta));
    else if (/\.(ts|tsx)$/.test(entrada.name) && !/\.test\./.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

/** `balance` y `paymentAmount` SUMADOS en la misma expresión: la reconstrucción a mano. */
const RECONSTRUCCION_A_MANO = /balance[^;\n]{0,40}\+[^;\n]{0,24}paymentAmount|paymentAmount[^;\n]{0,40}\+[^;\n]{0,24}balance/;

describe("el facturado tiene UNA fórmula, y vive en collection.ts", () => {
  it("ningún fichero de src reconstruye `balance + paymentAmount` por su cuenta", () => {
    const culpables = ficherosDeFuente(RAIZ)
      .filter((f) => f !== FORMULA_CANONICA)
      .filter((f) => RECONSTRUCCION_A_MANO.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });

  it("el patrón sí caza la fórmula canónica: el guardián no vigila un conjunto vacío", () => {
    expect(RECONSTRUCCION_A_MANO.test(fs.readFileSync(FORMULA_CANONICA, "utf8"))).toBe(true);
  });

  it("la fórmula canónica cuenta el anticipo en el fallback — lo que el gemelo olvidaba", () => {
    const legadoConAnticipo = { amount: null, balance: 100_000, paymentAmount: 50_000, advanceAppliedAmount: 150_000 };
    expect(statementChargedAmount(legadoConAnticipo)).toBe(300_000);
    // El gemelo habría dado 150.000: el facturado de menos y el % de recaudo por encima del 100.
    expect((legadoConAnticipo.balance ?? 0) + (legadoConAnticipo.paymentAmount ?? 0)).toBe(150_000);
  });
});
