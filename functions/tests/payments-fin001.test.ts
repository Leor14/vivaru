import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { calcularSaldo, saldoTrasRevertir } from "../src/payments";

/**
 * `FIN-001` — la aritmética del dinero, ahora del lado del servidor.
 *
 * Se prueba aquí y no en `src/` porque **este es el cálculo que escribe**. El
 * gemelo de `src/features/finanzas/use-payments.ts` solo pinta; si los dos
 * divergen, el que manda es este, y estas pruebas son las que lo fijan.
 */

const HOY = "2026-08-18";

describe("FIN-001 · saldo y estado", () => {
  it("un pago parcial deja saldo y la cuota pendiente", () => {
    expect(calcularSaldo(100, 40, 0, "2026-08-31", HOY)).toEqual({ balance: 60, status: "pending" });
  });

  it("pagar el total deja saldo cero y la cuota pagada", () => {
    expect(calcularSaldo(100, 100, 0, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  // Un sobrepago no puede dejar el saldo en negativo: la cartera mostraría que
  // el conjunto le debe dinero al residente, que no es lo que significa.
  it("pagar de más deja saldo CERO, nunca negativo", () => {
    expect(calcularSaldo(100, 130, 0, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  it("con la fecha vencida y saldo pendiente, la cuota queda vencida", () => {
    expect(calcularSaldo(100, 40, 0, "2026-08-01", HOY)).toEqual({ balance: 60, status: "overdue" });
  });

  // El orden de las condiciones importa: primero se mira si está saldada. Una
  // cuota pagada tarde está PAGADA, no vencida.
  it("una cuota pagada después del vencimiento queda pagada, no vencida", () => {
    expect(calcularSaldo(100, 100, 0, "2026-08-01", HOY).status).toBe("paid");
  });

  it("sin fecha de vencimiento nunca es vencida", () => {
    expect(calcularSaldo(100, 40, 0, undefined, HOY).status).toBe("pending");
  });

  // El día del vencimiento todavía no se ha vencido: la comparación es estricta.
  it("el mismo día del vencimiento aún no está vencida", () => {
    expect(calcularSaldo(100, 40, 0, HOY, HOY).status).toBe("pending");
  });

  it("una cuota de importe cero nace pagada", () => {
    expect(calcularSaldo(0, 0, 0, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  // Los céntimos son la trampa clásica del dinero en coma flotante. No se
  // corrige aquí —eso sería cambiar el modelo a enteros, que es otra ficha—
  // pero se deja fijado el comportamiento real para que un cambio se note.
  it("con decimales, el saldo se cierra cuando se paga el total exacto", () => {
    const r = calcularSaldo(100.1, 100.1, 0, "2026-08-31", HOY);
    expect(r.status).toBe("paid");
    expect(r.balance).toBe(0);
  });
});

describe("FIN-001 · reversión de un pago", () => {
  // El caso corriente: se cobró de más o al residente equivocado y se deshace.
  it("revertir el pago completo devuelve la cuota a pendiente con todo el saldo", () => {
    expect(saldoTrasRevertir(100, 100, 100, 0, "2026-08-31", HOY)).toEqual({
      paymentAmount: 0,
      balance: 100,
      status: "pending",
    });
  });

  it("revertir uno de dos pagos deja el otro en pie", () => {
    expect(saldoTrasRevertir(100, 100, 40, 0, "2026-08-31", HOY)).toEqual({
      paymentAmount: 60,
      balance: 40,
      status: "pending",
    });
  });

  // Revertir NO es «volver a pendiente»: el estado se recalcula, y una cuota
  // cuya fecha ya pasó vuelve VENCIDA, que es la verdad.
  it("si la fecha ya venció, revertir devuelve la cuota a vencida y no a pendiente", () => {
    expect(saldoTrasRevertir(100, 100, 100, 0, "2026-08-01", HOY).status).toBe("overdue");
  });

  // La razón de ser del Math.max: un pagado negativo se leería en cartera como
  // que el conjunto le debe dinero al residente.
  it("si la cuota ya fue tocada por otra vía, el pagado se queda en CERO y no en negativo", () => {
    expect(saldoTrasRevertir(100, 30, 100, 0, "2026-08-31", HOY)).toEqual({
      paymentAmount: 0,
      balance: 100,
      status: "pending",
    });
  });

  it("revertir un pago parcial de una cuota sobrepagada puede dejarla pagada aún", () => {
    expect(saldoTrasRevertir(100, 130, 20, 0, "2026-08-31", HOY)).toEqual({
      paymentAmount: 110,
      balance: 0,
      status: "paid",
    });
  });

  // Aplicar y revertir el mismo monto tiene que devolver el punto de partida,
  // o la reversión no sería tal.
  it("aplicar y revertir el mismo monto devuelve exactamente el estado inicial", () => {
    const inicial = calcularSaldo(100, 0, 0, "2026-08-31", HOY);
    const trasPagar = calcularSaldo(100, 60, 0, "2026-08-31", HOY);
    const trasRevertir = saldoTrasRevertir(100, 60, 60, 0, "2026-08-31", HOY);
    expect(trasPagar).not.toEqual(inicial);
    expect({ balance: trasRevertir.balance, status: trasRevertir.status }).toEqual(inicial);
    expect(trasRevertir.paymentAmount).toBe(0);
  });

  it("revertir cero no cambia nada", () => {
    expect(saldoTrasRevertir(100, 60, 0, 0, "2026-08-31", HOY)).toEqual({
      paymentAmount: 60,
      balance: 40,
      status: "pending",
    });
  });
});

/**
 * `FLOW-002` R4 — el anticipo cruzado cuenta para saldar la cuota, pero **no
 * vive en `paymentAmount`**.
 *
 * Es el parámetro nuevo, y es OBLIGATORIO a propósito: olvidarlo no compila.
 * Fue lo que obligó a revisar las quince llamadas de este fichero una a una en
 * vez de dejar que un valor por defecto las tragara en silencio.
 */
describe("FLOW-002 · el anticipo cruzado salda la cuota sin pasar por `paymentAmount`", () => {
  it("una cuota cubierta ENTERA con anticipo queda pagada, con `paymentAmount` en cero", () => {
    expect(calcularSaldo(140, 0, 140, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  it("cubierta a medias con anticipo, el saldo es lo que falta", () => {
    expect(calcularSaldo(140, 0, 60, "2026-08-31", HOY)).toEqual({ balance: 80, status: "pending" });
  });

  it("pago y anticipo se suman para saldar", () => {
    expect(calcularSaldo(140, 80, 60, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  // El mismo `max(…, 0)` de siempre: cruzar de más no deja saldo negativo.
  it("cruzar de más no deja el saldo en negativo", () => {
    expect(calcularSaldo(140, 0, 200, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  /**
   * **La que importa de verdad**: revertir un pago NO devuelve el anticipo.
   * Son dos operaciones distintas y se deshacen por separado. Si
   * `saldoTrasRevertir` no recibiera el anticipo, revertir un pago sobre un
   * cargo cubierto en parte con anticipo dejaría **el saldo inflado por ese
   * importe** — y la cuota volvería a aparecer como deuda que ya está cubierta.
   */
  it("revertir el pago deja el anticipo donde estaba", () => {
    expect(saldoTrasRevertir(140, 80, 80, 60, "2026-08-31", HOY)).toEqual({
      paymentAmount: 0,
      balance: 80,
      status: "pending",
    });
  });

  // Sin anticipo el comportamiento es exactamente el de siempre: el parámetro
  // es aditivo y con cero no cambia un solo resultado.
  it("con anticipo en cero se comporta igual que antes de FLOW-002", () => {
    expect(calcularSaldo(100, 40, 0, "2026-08-31", HOY)).toEqual({ balance: 60, status: "pending" });
  });
});

/**
 * El guardián del par de espejos.
 *
 * `calcularSaldo` (aquí) y `computeBalanceStatus` (en `src/`) están duplicados
 * porque `src/` no puede importar de `functions/` sin romper el build de App
 * Hosting. **Los espejos se separan en silencio**: R12 se aplicó en `src/` el 22
 * de agosto y no llegó a `functions/` hasta el 23, y entre medias el informe
 * mensual contó el recaudo dos veces durante un día entero.
 *
 * No se puede importar, así que se compara como TEXTO. Es el mismo guardián que
 * ya tiene `esRecaudoDeCartera`.
 */
describe("el espejo de `src/` no se puede separar de este en silencio", () => {
  const espejo = fs.readFileSync(
    path.resolve(__dirname, "../../src/features/finanzas/use-payments.ts"),
    "utf8",
  );
  const cuerpo = espejo.slice(espejo.indexOf("export function computeBalanceStatus"));
  const hasta = cuerpo.slice(0, cuerpo.indexOf("\n}"));

  it("recibe el anticipo aplicado", () => {
    expect(hasta).toContain("advanceApplied: number");
  });

  it("y lo RESTA, que es lo que de verdad importa", () => {
    expect(hasta).toContain("totalCharged - paidAmount - advanceApplied");
  });

  // Si alguien lo hace opcional, `FLOW-002` vuelve a poder olvidarse en una
  // llamada nueva sin que nada lo note. Obligatorio o no sirve.
  it("y el parámetro NO es opcional", () => {
    expect(hasta).not.toContain("advanceApplied?:");
  });
});
