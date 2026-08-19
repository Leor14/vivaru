import { describe, expect, it } from "vitest";

import { movimientoEntraAlFondo } from "@/features/finanzas/use-ledger";

/**
 * El signo del libro, que estuvo mal desde `72c3083`.
 *
 * Se pintaba a partir del **tipo** del asiento, y un reverso conserva el tipo
 * del que anula llevando **monto negativo**. Resultado: «+-$430.000» en verde,
 * los dos signos juntos y el color diciendo que entró dinero cuando salió.
 * Estuvo latente mientras solo se reversaban movimientos manuales; `FIN-001`
 * lo hizo visible al traer reversos de pago al libro.
 */
describe("signo de un movimiento del libro", () => {
  it("un ingreso normal entra", () => {
    expect(movimientoEntraAlFondo("ingreso", 430000)).toBe(true);
  });

  // El caso que se veía mal en pantalla.
  it("el reverso de un ingreso SALE, aunque su tipo siga siendo ingreso", () => {
    expect(movimientoEntraAlFondo("ingreso", -430000)).toBe(false);
  });

  it("un egreso normal sale", () => {
    expect(movimientoEntraAlFondo("egreso", 50000)).toBe(false);
  });

  // El simétrico, que es el menos evidente: anular un gasto DEVUELVE dinero.
  it("el reverso de un egreso ENTRA, porque anular un gasto devuelve el dinero", () => {
    expect(movimientoEntraAlFondo("egreso", -50000)).toBe(true);
  });

  // Un asiento en cero no debe pintarse como salida.
  it("un ingreso de cero cuenta como entrada, no como salida", () => {
    expect(movimientoEntraAlFondo("ingreso", 0)).toBe(true);
  });
});
