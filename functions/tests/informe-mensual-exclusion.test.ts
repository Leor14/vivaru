import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { esRecaudoDeCartera } from "../src/payments";

/**
 * El informe automático mensual contaba el recaudo DOS VECES.
 *
 * `monthlyFinancialArchive` suma `recaudado` (de Cartera) más `ingresosOtros`
 * (del libro), y para no duplicar tiene que descontar del libro lo que Cartera
 * ya trae. Hasta el 23 de agosto de 2026 ese descuento preguntaba
 * `category !== "alicuota"`: acertaba solo mientras `aplicarPago` escribía
 * `alicuota` para todo. En cuanto un asiento lleva su categoría real —una
 * extraordinaria, una multa—, entra en `ingresosOtros` **y** sigue dentro del
 * recaudo.
 *
 * R12 se arregló en `src/` ese mismo día y **no llegó hasta aquí**. Medido sobre
 * datos reales en los DOS ambientes: Las Playas daba 129.000 en el informe
 * automático contra 127.500 en pantalla.
 *
 * Y no era latente: los asientos sembrados llevan su categoría real sin pasar
 * por `aplicarPago`, así que ocurría con la bandera apagada.
 */
describe("esRecaudoDeCartera — el descuento del informe mensual", () => {
  it("excluye el cobro de un cargo por su ORIGEN, sea cual sea la categoría", () => {
    // El caso que rompía: una extraordinaria cobrada. Con la regla vieja
    // (`category !== "alicuota"`) esto entraba en ingresosOtros y se duplicaba.
    expect(esRecaudoDeCartera({ sourceType: "billingStatement", category: "extraordinaria" })).toBe(true);
    expect(esRecaudoDeCartera({ sourceType: "billingStatement", category: "multa" })).toBe(true);
  });

  it("excluye el REVERSO de un cobro, que perdió su origen al nacer", () => {
    // R13. Sin esto, el monto NEGATIVO del reverso entraría en el ingreso del
    // libro mientras Cartera ya lo descontó del cargo: baja dos veces.
    expect(
      esRecaudoDeCartera({ sourceType: "reversal", reversedSourceType: "billingStatement", category: "multa" }),
    ).toBe(true);
  });

  it("conserva la rama de convivencia para lo escrito con la bandera apagada", () => {
    expect(esRecaudoDeCartera({ category: "alicuota" })).toBe(true);
  });

  it("NO excluye un ingreso propio del libro, que Cartera no conoce", () => {
    // Un movimiento manual o un reverso de gasto sí deben sumar.
    expect(esRecaudoDeCartera({ sourceType: "manual", category: "otros_ingresos" })).toBe(false);
    expect(esRecaudoDeCartera({ sourceType: "reversal", reversedSourceType: "expense", category: "servicios_publicos" })).toBe(false);
    expect(esRecaudoDeCartera({})).toBe(false);
  });

  /**
   * El guardián que importa: esta función es un ESPEJO de la de `src/`, y los
   * espejos se separan en silencio. No se puede importar `src/` desde aquí
   * —rompería el build de App Hosting—, así que se compara como texto.
   *
   * Justamente lo que falló: la de `src/` se corrigió y esta no existía.
   */
  it("mantiene las mismas tres ramas que su espejo de src/", () => {
    const espejo = fs.readFileSync(
      path.resolve(__dirname, "../../src/features/finanzas/financial-statement.ts"),
      "utf8",
    );
    const cuerpo = espejo.slice(espejo.indexOf("export function esRecaudoDeCartera"));
    const ramas = cuerpo.slice(0, cuerpo.indexOf("}"));

    expect(ramas).toContain('entry.sourceType === "billingStatement"');
    expect(ramas).toContain('entry.reversedSourceType === "billingStatement"');
    expect(ramas).toContain('entry.category === "alicuota"');
  });
});
