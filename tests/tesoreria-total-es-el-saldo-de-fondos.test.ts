import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FEAT-010` · `RN-04` — el total de la tesorería ES el saldo de fondos.
 *
 * Lo calcula `computeFundPosition` dentro de `saldosPorCuenta`, y la página no
 * lo recalcula: si sumara por su cuenta, el administrador vería dos cifras de
 * «cuánto dinero hay». Mide el código SIN comentarios, porque la explicación
 * nombra justo lo que se vigila.
 */

const raiz = path.resolve(__dirname, "..");
const sinComentarios = (f: string) =>
  f.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leer = (f: string) => sinComentarios(fs.readFileSync(path.join(raiz, f), "utf8"));

describe("`RN-04` · el total de la tesorería sale de computeFundPosition", () => {
  it("la función pura lo toma de computeFundPosition", () => {
    expect(leer("src/lib/finanzas/tesoreria.ts")).toMatch(/computeFundPosition\(/);
  });

  it("la página usa saldosPorCuenta y no calcula el fondo por su cuenta", () => {
    const pagina = leer("src/app/(admin)/admin/finanzas/tesoreria/page.tsx");
    expect(pagina).toMatch(/saldosPorCuenta\(/);
    expect(pagina).not.toMatch(/computeFundPosition\(/);
  });
});
