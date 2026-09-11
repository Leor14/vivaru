// tests/hoy-local.test.ts
// «Hoy» es el día del calendario de quien usa la app, no el de UTC — en todo el front.
//
// `new Date().toISOString().slice(0, 10)` da el día UTC: desde las 18:00 de México
// (19:00 en Colombia y Ecuador) ya es mañana. Se arregló primero en egresos
// (`tests/egresos-fecha-local.test.ts`) y aquí en el resto: la fecha contable del
// cobro, del recibo y del cruce de un anticipo, el período de Cartera, los
// tableros, comunicados, acuerdos y el panel.
//
// La zona se fija AQUÍ y no se hereda de la máquina: en una en UTC —la de CI— el
// día local y el UTC coinciden y esta prueba no distinguiría nada.
process.env.TZ = "America/Mexico_City";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTenantDocument, updateDoc } = vi.hoisted(() => ({
  createTenantDocument: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "nuevo" })),
  updateDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument,
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, coleccion: string, id: string) => `${coleccion}/${id}`),
  increment: vi.fn(),
  updateDoc,
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import { createBillingStatement, updateBillingStatement } from "@/features/billing/use-billing-statements";
import { toDateStr } from "@/features/reports/use-committee-report";

/** 19:00 del 10 de septiembre en Ciudad de México = 01:00 del 11 en UTC. */
const TARDE_DEL_10 = new Date("2026-09-11T01:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TARDE_DEL_10);
  createTenantDocument.mockClear();
  updateDoc.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("el reloj de esta prueba distingue el día local del UTC", () => {
  it("a esa hora UTC ya dice 11 y el calendario de México sigue en 10", () => {
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(new Date().getDate()).toBe(10);
  });
});

describe("un cargo que vence HOY no está vencido por la tarde", () => {
  const cargo = {
    unitLabel: "T1-101",
    period: "2026-09",
    amount: 1_200,
    paymentAmount: 200,
    balance: 1_000,
    dueDate: "2026-09-10",
  };

  it("al crearlo: `pending` y el último pago fechado el 10", async () => {
    await createBillingStatement({ ...cargo, tenantId: "t1", userId: "u1", unitId: "unidad-1" });
    const escrito = createTenantDocument.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(escrito.status).toBe("pending");
    expect(escrito.lastPaymentAt).toBe("2026-09-10");
  });

  it("al editarlo: `pending` y el último pago fechado el 10", async () => {
    await updateBillingStatement("c1", { ...cargo, userId: "u1" });
    const escrito = updateDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(escrito.status).toBe("pending");
    expect(escrito.lastPaymentAt).toBe("2026-09-10");
  });

  it("uno que venció AYER sí está vencido", async () => {
    await updateBillingStatement("c1", { ...cargo, dueDate: "2026-09-09", userId: "u1" });
    expect((updateDoc.mock.calls[0]?.[1] as Record<string, unknown>).status).toBe("overdue");
  });
});

describe("el reporte de comité agrupa un momento por su día local", () => {
  it("un paquete que llegó a las 19:00 del 10 cuenta el 10", () => {
    expect(toDateStr({ toDate: () => new Date(TARDE_DEL_10) })).toBe("2026-09-10");
  });

  it("una fecha de texto —la del asiento— pasa tal cual", () => {
    expect(toDateStr("2026-09-01")).toBe("2026-09-01");
  });
});

describe("guardián · ningún «hoy» del front sale de UTC", () => {
  /**
   * Las dos que quedan, cada una con su motivo. Si alguna se arregla, esta prueba
   * pide sacarla de aquí: una excepción que ya no hace falta es una puerta abierta.
   */
  const EXCEPCIONES: Record<string, string> = {
    // Espejo declarado de `calcularSaldo` (`tests/flow-002-espejos.test.ts`): su
    // «vencido» sigue al del servidor, que corre en UTC. Se mueven juntos o ninguno.
    "src/features/finanzas/use-payments.ts": "espejo del servidor",
    // Filtra a la vez visitas y reservas, y las visitas creadas por invitación
    // guardan el día UTC (`invitations.ts`). Arreglar solo la comparación rompería
    // la mitad que hoy casa por casualidad: es un flujo aparte, con datos guardados.
    "src/components/securityGuard/GuardDashboard.tsx": "visitantes, flujo aparte",
  };
  const PATRON = /new Date\(\)\.toISOString\(\)\.(slice\(0, ?(10|7)\)|split\("T"\)\[0\])/;
  // Sin comentarios: el que explica el defecto no puede ponerlo en rojo.
  const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  function ficheros(dir: string): string[] {
    return readdirSync(dir).flatMap((nombre) => {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) return ficheros(ruta);
      return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
    });
  }
  const raiz = process.cwd();
  const conElPatron = ficheros(resolve(raiz, "src"))
    .filter((f) => PATRON.test(sinComentarios(readFileSync(f, "utf8"))))
    .map((f) => relative(raiz, f))
    .sort();

  it("solo lo calculan las excepciones declaradas", () => {
    expect(conElPatron).toEqual(Object.keys(EXCEPCIONES).sort());
  });

  it("recorre de verdad `src/` (no aprueba sobre un conjunto vacío)", () => {
    expect(ficheros(resolve(raiz, "src")).length).toBeGreaterThan(300);
  });
});
