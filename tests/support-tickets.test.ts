// tests/support-tickets.test.ts
// Contrato de los tickets de soporte (PRD-V-FEAT-001). Lógica pura.

import { describe, expect, it } from "vitest";

import {
  CLIENT_WRITABLE_STATUSES,
  PENDING_SUPPORT_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_LIMITS,
  SUPPORT_STATUSES,
  canReopen,
  daysSinceActivity,
  isSupportPending,
} from "@/features/support/types";

const DIA = 86_400_000;
const haceDias = (n: number) => new Date(Date.now() - n * DIA).toISOString();

describe("estados", () => {
  it("son los cinco de la PRD", () => {
    expect(Object.keys(SUPPORT_STATUSES)).toEqual([
      "abierto",
      "en_proceso",
      "esperando_respuesta",
      "resuelto",
      "cerrado",
    ]);
  });

  it("pendiente de Vivaru NO incluye lo que espera al cliente", () => {
    // Es la regla que hace que la cola sea un número accionable: si
    // `esperando_respuesta` contara, creceria con tickets que no podemos
    // avanzar y dejaría de servir para priorizar.
    expect(PENDING_SUPPORT_STATUSES).toEqual(["abierto", "en_proceso"]);
    expect(isSupportPending("abierto")).toBe(true);
    expect(isSupportPending("en_proceso")).toBe(true);
    expect(isSupportPending("esperando_respuesta")).toBe(false);
    expect(isSupportPending("resuelto")).toBe(false);
    expect(isSupportPending("cerrado")).toBe(false);
  });

  it("el cliente no puede escribir en un ticket resuelto ni cerrado", () => {
    expect(CLIENT_WRITABLE_STATUSES).not.toContain("cerrado");
    expect(CLIENT_WRITABLE_STATUSES).not.toContain("resuelto");
  });

  it("tolera un estado desconocido sin reventar", () => {
    expect(isSupportPending(undefined)).toBe(true);
    expect(isSupportPending(42)).toBe(true);
  });
});

describe("categorías", () => {
  it("son las cuatro de la PRD", () => {
    expect(Object.keys(SUPPORT_CATEGORIES).sort()).toEqual([
      "facturacion",
      "operativo",
      "otro",
      "tecnico",
    ]);
  });
});

describe("ventana de reapertura", () => {
  it("permite reabrir dentro de la ventana", () => {
    expect(canReopen({ status: "resuelto", resolvedAt: haceDias(1) })).toBe(true);
    expect(canReopen({ status: "resuelto", resolvedAt: haceDias(SUPPORT_LIMITS.reopenWindowDays - 1) })).toBe(true);
  });

  it("no permite reabrir pasada la ventana", () => {
    expect(canReopen({ status: "resuelto", resolvedAt: haceDias(SUPPORT_LIMITS.reopenWindowDays + 1) })).toBe(false);
  });

  it("solo se reabre desde resuelto — nunca desde cerrado", () => {
    // `cerrado` es terminal. Si se pudiera reabrir, el número de pendientes
    // dejaría de significar algo.
    expect(canReopen({ status: "cerrado", resolvedAt: haceDias(1) })).toBe(false);
    expect(canReopen({ status: "abierto", resolvedAt: haceDias(1) })).toBe(false);
    expect(canReopen({ status: "en_proceso", resolvedAt: haceDias(1) })).toBe(false);
  });

  it("sin fecha de resolución no se reabre", () => {
    expect(canReopen({ status: "resuelto" })).toBe(false);
    expect(canReopen({ status: "resuelto", resolvedAt: "no-es-fecha" })).toBe(false);
  });
});

describe("antigüedad", () => {
  it("cuenta días desde la última actividad", () => {
    expect(daysSinceActivity({ lastActivityAt: haceDias(3) })).toBe(3);
    expect(daysSinceActivity({ lastActivityAt: new Date().toISOString() })).toBe(0);
  });

  it("devuelve null sin dato o con fecha inválida", () => {
    expect(daysSinceActivity({})).toBeNull();
    expect(daysSinceActivity({ lastActivityAt: "ayer" })).toBeNull();
  });
});

describe("límites", () => {
  it("son los acordados y frenan el abuso, no el uso", () => {
    expect(SUPPORT_LIMITS.maxOpenPerTenant).toBe(5);
    expect(SUPPORT_LIMITS.maxPerDay).toBe(10);
    expect(SUPPORT_LIMITS.reopenWindowDays).toBe(7);
  });

  it("el mensaje cabe holgadamente para describir un problema", () => {
    expect(SUPPORT_LIMITS.descriptionMaxLength).toBeGreaterThanOrEqual(2000);
    expect(SUPPORT_LIMITS.subjectMaxLength).toBeLessThanOrEqual(200);
  });
});
