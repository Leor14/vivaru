// R8 — el aviso de «cayó en Otros ingresos» tiene que llegar hasta la pantalla.
//
// El servidor lo devuelve desde la entrega 1b-ii, y hasta el 23 de agosto de
// 2026 **ni siquiera estaba declarado** en el tipo de respuesta de
// `applyPaymentCallable`: el dato viajaba por la red y moría en el borde de
// TypeScript. Nadie lo enseñaba, y una prueba del resolvedor no lo habría
// cazado nunca — el resolvedor estaba bien; lo que faltaba era el cable.
//
// Por eso estas pruebas son de PROPAGACIÓN y no de resolución.

import { describe, expect, it, vi, beforeEach } from "vitest";

// `vi.mock` se iza al principio del fichero, asi que su fabrica no puede leer
// una variable declarada arriba. `vi.hoisted` sube tambien la declaracion.
const { applyPaymentCallable } = vi.hoisted(() => ({ applyPaymentCallable: vi.fn() }));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({ subscribeTenantCollection: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));
vi.mock("@/lib/firebase/callables", () => ({ applyPaymentCallable }));

import { recordPayment } from "@/features/finanzas/use-payments";

const CUOTA = {
  id: "cuota-1",
  tenantId: "t",
  unitId: "u1",
  unitLabel: "T2-203",
  period: "2026-06",
  balance: 500,
  status: "pending" as const,
};

const RESPUESTA_OK = {
  ok: true as const,
  applied: true,
  ledgerEntryId: "led-1",
  paymentAmount: 500,
  balance: 0,
  status: "paid" as const,
  voucherId: "v-1",
  voucherCode: "R-0001",
};

function cobrar() {
  return recordPayment("t", "uid-1", {
    statement: CUOTA,
    amount: 500,
    date: "2026-08-23",
    operationKey: "op-1",
  } as Parameters<typeof recordPayment>[2]);
}

describe("el aviso de R8 sobrevive al viaje de vuelta", () => {
  beforeEach(() => applyPaymentCallable.mockReset());

  it("cuando el servidor avisa, el llamante se entera", async () => {
    applyPaymentCallable.mockResolvedValue({ ...RESPUESTA_OK, cayoEnOtrosIngresos: true });
    const r = await cobrar();
    expect(r.cayoEnOtrosIngresos).toBe(true);
  });

  // El caso normal, que es la inmensa mayoría: los siete conceptos conocidos
  // resuelven a su cuenta propia, así que el aviso NO debe salir. Un aviso que
  // aparece siempre se deja de leer, y este dice que algo quedó sin clasificar.
  it("cuando no avisa, no se inventa el aviso", async () => {
    applyPaymentCallable.mockResolvedValue(RESPUESTA_OK);
    expect((await cobrar()).cayoEnOtrosIngresos).toBe(false);
  });

  /**
   * El servidor **omite** el campo cuando es falso —`...(cayoEnOtrosIngresos ?
   * { cayoEnOtrosIngresos: true } : {})`—, así que por el cable llega
   * `undefined`, no `false`. Un `!!` mal puesto o un `?? true` lo convertiría en
   * un aviso permanente.
   */
  it("un campo ausente es «no avisó», no un valor raro que se cuele", async () => {
    applyPaymentCallable.mockResolvedValue({ ...RESPUESTA_OK, cayoEnOtrosIngresos: undefined });
    const r = await cobrar();
    expect(r.cayoEnOtrosIngresos).toBe(false);
    expect(typeof r.cayoEnOtrosIngresos).toBe("boolean");
  });

  it("el cobro sigue devolviendo su recibo: el aviso no desplaza a lo demás", async () => {
    applyPaymentCallable.mockResolvedValue({ ...RESPUESTA_OK, cayoEnOtrosIngresos: true });
    const r = await cobrar();
    expect(r).toMatchObject({ voucherId: "v-1", voucherCode: "R-0001", ledgerEntryId: "led-1" });
  });
});
