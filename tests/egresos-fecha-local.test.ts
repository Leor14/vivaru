// tests/egresos-fecha-local.test.ts
// El «hoy» del egreso es el del calendario de quien registra, no el de UTC.
//
// A las 19:00 de Ciudad de México ya es el día siguiente en UTC. Con
// `toISOString().slice(0, 10)` un egreso registrado esa tarde nacía —con su
// asiento— fechado mañana, y el último día del mes caía en el mes siguiente.
// Visto en staging: el egreso `n7aHPvUksBG3oa3HFrNz` de Las Playas quedó el 11
// de septiembre registrándose la tarde del 10.
//
// La zona se fija AQUÍ y no se hereda de la máquina: en una en UTC —la de CI—
// el día local y el UTC coinciden y esta prueba no distinguiría nada.
process.env.TZ = "America/Mexico_City";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  deleteDoc: vi.fn(),
  updateDoc,
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));
vi.mock("@/lib/firebase/callables", () => ({ releaseReconciliationCallable: vi.fn(async () => undefined) }));

import { createExpense, updateExpense } from "@/features/finanzas/use-expenses";
import type { ExpenseFormValues } from "@/features/finanzas/schemas";
import { reverseLedgerEntry } from "@/features/finanzas/use-ledger";
import type { Expense, LedgerEntry } from "@/types/domain";

/** 19:00 del 10 de septiembre en Ciudad de México = 01:00 del 11 en UTC. */
const TARDE_DEL_10 = new Date("2026-09-11T01:00:00Z");
/** 19:00 del 30 de septiembre en Ciudad de México = 01:00 del 1 de octubre en UTC. */
const TARDE_DEL_30 = new Date("2026-10-01T01:00:00Z");

const formulario = (status: ExpenseFormValues["status"]): ExpenseFormValues => ({
  category: "proveedores",
  description: "Jardinería de septiembre",
  amount: 4200,
  issueDate: "2026-09-10",
  status,
});

/** Lo que se escribió en una colección: `createTenantDocument(coleccion, tenant, uid, datos)`. */
const creadoEn = (coleccion: string) =>
  createTenantDocument.mock.calls.find((c) => c[0] === coleccion)?.[3] as Record<string, unknown> | undefined;
/** Lo que se actualizó en un documento: `updateDoc("coleccion/id", datos)`. */
const actualizadoEn = (ruta: string) =>
  updateDoc.mock.calls.find((c) => c[0] === ruta)?.[1] as Record<string, unknown> | undefined;

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

describe("pagar un egreso por la tarde lo fecha HOY, no mañana", () => {
  it("al crearlo pagado: `paidAt` y la fecha del asiento son el 10", async () => {
    await createExpense("t1", "u1", formulario("pagado"));
    expect(creadoEn("expenses")?.paidAt).toBe("2026-09-10");
    expect(creadoEn("ledgerEntries")?.date).toBe("2026-09-10");
  });

  it("el último día del mes el gasto se queda en ese mes", async () => {
    vi.setSystemTime(TARDE_DEL_30);
    await createExpense("t1", "u1", { ...formulario("pagado"), issueDate: "2026-09-30" });
    expect(creadoEn("expenses")?.paidAt).toBe("2026-09-30");
    expect(creadoEn("ledgerEntries")?.date).toBe("2026-09-30");
  });

  it("al pasarlo de registrado a pagado: `paidAt` y el asiento nuevo son el 10", async () => {
    const prev = { id: "e1", tenantId: "t1", status: "registrado", issueDate: "2026-09-01" } as Expense;
    await updateExpense(prev, "u1", formulario("pagado"));
    expect(actualizadoEn("expenses/e1")?.paidAt).toBe("2026-09-10");
    expect(creadoEn("ledgerEntries")?.date).toBe("2026-09-10");
  });
});

describe("editar un egreso YA pagado no cambia cuándo se pagó", () => {
  const pagadoEnAgosto = {
    id: "e2",
    tenantId: "t1",
    status: "pagado",
    issueDate: "2026-08-12",
    paidAt: "2026-08-15",
    ledgerEntryId: "asiento-e2",
  } as Expense;

  it("corregir la descripción conserva `paidAt` y la fecha del asiento en agosto", async () => {
    await updateExpense(pagadoEnAgosto, "u1", {
      ...formulario("pagado"),
      issueDate: "2026-08-12",
      description: "Jardinería de agosto (corregida)",
    });
    expect(actualizadoEn("expenses/e2")?.paidAt).toBe("2026-08-15");
    expect(actualizadoEn("ledgerEntries/asiento-e2")?.date).toBe("2026-08-15");
  });

  it("devolverlo a registrado sigue quitando `paidAt`", async () => {
    await updateExpense(pagadoEnAgosto, "u1", { ...formulario("registrado"), issueDate: "2026-08-12" });
    expect(actualizadoEn("expenses/e2")?.paidAt).toBeNull();
  });
});

describe("anular un asiento por la tarde fecha el reverso HOY", () => {
  it("el reverso nace el 10", async () => {
    const asiento = {
      id: "a1",
      tenantId: "t1",
      type: "egreso",
      date: "2026-09-01",
      amount: 4200,
      concept: "Jardinería",
      reconciled: false,
    } as LedgerEntry;
    await reverseLedgerEntry("t1", "u1", asiento);
    expect(creadoEn("ledgerEntries")?.date).toBe("2026-09-10");
  });
});

describe("guardián · ningún «hoy» del flujo de egresos sale de UTC", () => {
  // Cubre también la página y el panel de cuotas, que son componentes y no se
  // montan aquí. `PlanDeCuotasField` queda fuera a propósito: suma meses a una
  // fecha dada con aritmética UTC de ida y vuelta, y eso es correcto.
  const FLUJO = [
    "src/app/(admin)/admin/finanzas/egresos/page.tsx",
    "src/features/finanzas/use-expenses.ts",
    "src/features/finanzas/use-ledger.ts",
    "src/components/features/finanzas/CuotasDelEgresoPanel.tsx",
    "src/components/features/finanzas/RepartirEgresoModal.tsx",
  ];
  // Sin comentarios: el que explica el defecto no puede ponerlo en rojo.
  const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it.each(FLUJO)("%s no calcula «hoy» con `new Date().toISOString()`", (fichero) => {
    const codigo = sinComentarios(readFileSync(resolve(process.cwd(), fichero), "utf8"));
    expect(codigo).not.toMatch(/new Date\(\)\.toISOString\(\)/);
  });
});
