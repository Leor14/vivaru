import { describe, expect, it } from "vitest";

import { calcularSaldo } from "../src/payments";

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
    expect(calcularSaldo(100, 40, "2026-08-31", HOY)).toEqual({ balance: 60, status: "pending" });
  });

  it("pagar el total deja saldo cero y la cuota pagada", () => {
    expect(calcularSaldo(100, 100, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  // Un sobrepago no puede dejar el saldo en negativo: la cartera mostraría que
  // el conjunto le debe dinero al residente, que no es lo que significa.
  it("pagar de más deja saldo CERO, nunca negativo", () => {
    expect(calcularSaldo(100, 130, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  it("con la fecha vencida y saldo pendiente, la cuota queda vencida", () => {
    expect(calcularSaldo(100, 40, "2026-08-01", HOY)).toEqual({ balance: 60, status: "overdue" });
  });

  // El orden de las condiciones importa: primero se mira si está saldada. Una
  // cuota pagada tarde está PAGADA, no vencida.
  it("una cuota pagada después del vencimiento queda pagada, no vencida", () => {
    expect(calcularSaldo(100, 100, "2026-08-01", HOY).status).toBe("paid");
  });

  it("sin fecha de vencimiento nunca es vencida", () => {
    expect(calcularSaldo(100, 40, undefined, HOY).status).toBe("pending");
  });

  // El día del vencimiento todavía no se ha vencido: la comparación es estricta.
  it("el mismo día del vencimiento aún no está vencida", () => {
    expect(calcularSaldo(100, 40, HOY, HOY).status).toBe("pending");
  });

  it("una cuota de importe cero nace pagada", () => {
    expect(calcularSaldo(0, 0, "2026-08-31", HOY)).toEqual({ balance: 0, status: "paid" });
  });

  // Los céntimos son la trampa clásica del dinero en coma flotante. No se
  // corrige aquí —eso sería cambiar el modelo a enteros, que es otra ficha—
  // pero se deja fijado el comportamiento real para que un cambio se note.
  it("con decimales, el saldo se cierra cuando se paga el total exacto", () => {
    const r = calcularSaldo(100.1, 100.1, "2026-08-31", HOY);
    expect(r.status).toBe("paid");
    expect(r.balance).toBe(0);
  });
});
