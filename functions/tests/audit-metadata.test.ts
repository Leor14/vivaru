import { describe, expect, it } from "vitest";

import { limpiarMetadata } from "../src/audit";

/**
 * **El defecto que estas pruebas cierran costó dos diagnósticos y un pago mal
 * reportado** (24 de agosto de 2026).
 *
 * `writeAuditLog` audita **fuera** de la transacción y escribía el metadata tal
 * cual. `initializeApp()` corre sin `ignoreUndefinedProperties`, así que un
 * campo opcional ausente hacía que Firestore rechazara la escritura y la
 * callable reventara **con la operación de dinero ya confirmada**.
 */
describe("limpiarMetadata — la auditoría no puede tumbar lo que audita", () => {
  /**
   * **El caso que mordió primero, y que se diagnosticó mal.**
   * `undoAdvanceApplication` declara `reason` opcional y el botón «Deshacer» no
   * lo manda. El cruce se deshacía y la pantalla decía «error inesperado». Se
   * atribuyó a un doble clic; lo desmintió medir que **faltaba la fila de
   * auditoría** — una auditoría que no se escribió es invisible.
   */
  it("un campo opcional ausente no aparece, en vez de reventar la escritura", () => {
    const limpio = limpiarMetadata({ applicationId: "app-1", reason: undefined, remaining: 300 });
    expect(limpio).toEqual({ applicationId: "app-1", remaining: 300 });
    expect("reason" in limpio).toBe(false);
  });

  /**
   * El caso que mordió después: un reparto no manda `statementId`.
   *
   * **La aserción va con `in` y no solo con `toEqual`, y eso lo enseñó falsar
   * esta prueba:** `toEqual` considera `{a: undefined}` igual a `{}`, así que
   * con la versión rota —la que escribe el metadata tal cual— pasaba en verde.
   * Lo que hay que comprobar es que la CLAVE no está, porque es la clave lo que
   * Firestore rechaza.
   */
  it("lo mismo con el `statementId` que un reparto no manda", () => {
    const limpio = limpiarMetadata({ statementId: undefined, amount: 400, source: "manual" });
    expect(limpio).toEqual({ amount: 400, source: "manual" });
    expect("statementId" in limpio).toBe(false);
    expect(Object.keys(limpio).sort()).toEqual(["amount", "source"]);
  });

  /**
   * **`null` NO es `undefined`, y la diferencia es información.** Ahí alguien
   * decidió decir «vacío» —`voucherAnuladoId: null` significa «no había recibo
   * que anular»—, y eso es un dato distinto de no haberlo dicho. Firestore
   * acepta `null` sin problema, así que no hay motivo para quitarlo.
   */
  it("un `null` explícito se conserva", () => {
    expect(limpiarMetadata({ voucherAnuladoId: null, reason: "devuelto" })).toEqual({
      voucherAnuladoId: null,
      reason: "devuelto",
    });
  });

  it("el cero, la cadena vacía y `false` se conservan: son valores, no ausencias", () => {
    expect(limpiarMetadata({ appliedAmount: 0, reason: "", reversed: false })).toEqual({
      appliedAmount: 0,
      reason: "",
      reversed: false,
    });
  });

  it("un metadata entero de `undefined` queda vacío, y eso se puede escribir", () => {
    expect(Object.keys(limpiarMetadata({ a: undefined, b: undefined }))).toEqual([]);
  });

  it("no muta lo que recibe", () => {
    const entrada = { a: 1, b: undefined };
    limpiarMetadata(entrada);
    expect("b" in entrada).toBe(true);
  });
});
