// tests/finanzas-payments.test.ts
// F1 · C3 — saldo y estado tras un cobro.
//
// La construcción del recibo ya NO se prueba aquí: se mudó al servidor el 20 de
// agosto de 2026, al meter la emisión dentro de la transacción del pago. Sus
// pruebas viven ahora en `functions/tests/comprobante.test.ts`. `src/` no puede
// importar de `functions/`, así que el módulo se mudó entero en vez de
// duplicarse — ver CLAUDE.md.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import { computeBalanceStatus, watchPaymentVouchers } from "@/features/finanzas/use-payments";

/**
 * **H.31 (ensayo de Lomas, 13 sep 2026): «Recibos emitidos» se caía con dos recibos del mismo día.**
 * El desempate comparaba `createdAt` con `localeCompare`, y la suscripción lo entrega como
 * `Timestamp` de Firestore. Solo corre cuando dos recibos comparten `issueDate`: en producción, con
 * cuatro recibos, no había saltado; en el ensayo, con 40 días así, tumbaba la lista del residente y
 * la del administrador.
 *
 * Se prueba por `watchPaymentVouchers` y no por un comparador suelto: el orden vive dentro de la
 * suscripción, y es ahí donde reventaba.
 */
describe("watchPaymentVouchers con dos recibos del mismo día (H.31)", () => {
  // La forma en que llega de Firestore: un objeto con `toDate`, no un texto.
  const marca = (iso: string) => ({ toDate: () => new Date(iso), seconds: Date.parse(iso) / 1000 });

  function ordenar(recibos: object[]) {
    vi.mocked(subscribeTenantCollection).mockImplementationOnce((_coleccion, _conjunto, onData) => {
      onData(recibos as never);
      return () => {};
    });
    const onData = vi.fn();
    watchPaymentVouchers("t", onData, vi.fn());
    return (onData.mock.calls[0][0] as { id: string }[]).map((r) => r.id);
  }

  it("no revienta con `createdAt` como Timestamp, y pone primero el más reciente", () => {
    expect(
      ordenar([
        { id: "manana", issueDate: "2026-09-13", createdAt: marca("2026-09-13T15:00:00Z") },
        { id: "ayer", issueDate: "2026-09-12", createdAt: marca("2026-09-12T18:00:00Z") },
        { id: "tarde", issueDate: "2026-09-13", createdAt: marca("2026-09-13T21:00:00Z") },
      ]),
    ).toEqual(["tarde", "manana", "ayer"]);
  });

  /**
   * **En los dos órdenes de llegada, y no es redundante.** El orden viejo solo reventaba cuando el
   * `Timestamp` caía como `b` del comparador: con un solo orden, esta prueba pasó en verde sobre el
   * código roto, y lo destapó falsarla.
   */
  it("y un recibo sin `createdAt` tampoco la tumba, llegue en el orden que llegue", () => {
    const sinMarca = { id: "sin-marca", issueDate: "2026-09-13" };
    const conMarca = { id: "con-marca", issueDate: "2026-09-13", createdAt: marca("2026-09-13T21:00:00Z") };
    expect(ordenar([sinMarca, conMarca])).toEqual(["con-marca", "sin-marca"]);
    expect(ordenar([conMarca, sinMarca])).toEqual(["con-marca", "sin-marca"]);
  });
});

describe("computeBalanceStatus", () => {
  it("queda al día (paid) cuando el pago cubre el cargo", () => {
    expect(computeBalanceStatus(100, 100, 0)).toEqual({ balance: 0, status: "paid" });
    expect(computeBalanceStatus(100, 120, 0)).toEqual({ balance: 0, status: "paid" });
  });

  it("queda pendiente con saldo si el pago es parcial y no está vencido", () => {
    expect(computeBalanceStatus(100, 60, 0, "2999-01-01")).toEqual({ balance: 40, status: "pending" });
  });

  it("queda en mora (overdue) si hay saldo y la fecha límite pasó", () => {
    expect(computeBalanceStatus(100, 60, 0, "2000-01-01")).toEqual({ balance: 40, status: "overdue" });
  });

  /**
   * `FLOW-002` R4. Mismo comportamiento que su espejo del servidor: el anticipo
   * cruzado salda la cuota **sin pasar por `paymentAmount`**, porque
   * `cuotaIncome` es exactamente la suma de esos `paymentAmount` y sumarlo ahí
   * contaría el anticipo dos veces.
   */
  it("el anticipo cruzado salda la cuota, igual que en el servidor", () => {
    expect(computeBalanceStatus(140, 0, 140)).toEqual({ balance: 0, status: "paid" });
    expect(computeBalanceStatus(140, 80, 60)).toEqual({ balance: 0, status: "paid" });
    expect(computeBalanceStatus(140, 0, 60, "2999-01-01")).toEqual({ balance: 80, status: "pending" });
  });
});
