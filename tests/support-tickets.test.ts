// tests/support-tickets.test.ts
// Contrato de los tickets de soporte (PRD-V-FEAT-001). Lógica pura.

import { describe, expect, it } from "vitest";

import {
  CLIENT_WRITABLE_STATUSES,
  SUPPORT_ATTACHMENT_TYPES,
  isAllowedAttachment,
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


describe("adjuntos", () => {
  it("acepta imágenes y PDF", () => {
    expect(isAllowedAttachment({ type: "image/png", size: 1000 })).toBeNull();
    expect(isAllowedAttachment({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(isAllowedAttachment({ type: "application/pdf", size: 1000 })).toBeNull();
  });

  it("rechaza vídeo, ejecutables y ofimática", () => {
    // Un tope alto y tipos abiertos solo invitan a subir un vídeo de pantalla
    // de 20 MB que nadie va a ver.
    expect(isAllowedAttachment({ type: "video/mp4", size: 1000 })).not.toBeNull();
    expect(isAllowedAttachment({ type: "application/x-msdownload", size: 1000 })).not.toBeNull();
    expect(isAllowedAttachment({ type: "application/vnd.ms-excel", size: 1000 })).not.toBeNull();
  });

  it("rechaza lo que pase de 5 MB", () => {
    const limite = SUPPORT_LIMITS.maxAttachmentBytes;
    expect(isAllowedAttachment({ type: "image/png", size: limite })).toBeNull();
    expect(isAllowedAttachment({ type: "image/png", size: limite + 1 })).not.toBeNull();
  });

  it("el tope de soporte es MUY inferior al global de Storage", () => {
    // Storage permite 25 MB para todo el conjunto; soporte se queda en 5.
    // Esto NO se puede imponer en las reglas de Storage —suman permisos, no
    // los restan— asi que el limite vive en la callable.
    expect(SUPPORT_LIMITS.maxAttachmentBytes).toBeLessThan(25 * 1024 * 1024);
    expect(SUPPORT_LIMITS.maxAttachmentsPerMessage).toBe(3);
  });

  it("los tipos permitidos no incluyen nada ejecutable ni ofimático", () => {
    for (const t of SUPPORT_ATTACHMENT_TYPES) {
      expect(t === "application/pdf" || t.startsWith("image/")).toBe(true);
    }
  });

  it("da un mensaje entendible, no un código", () => {
    const msg = isAllowedAttachment({ type: "video/mp4", size: 10 });
    expect(msg).toMatch(/imágenes|PDF/i);
  });
});
