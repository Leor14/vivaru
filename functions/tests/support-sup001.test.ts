import { describe, expect, it } from "vitest";

import { marcasSup001 } from "../src/support";

/**
 * `SUP-001` — las dos reglas de idempotencia del sellado.
 *
 * Esto es lo que protege un dato irrecuperable: `firstResponseAt` sale de un
 * instante que ya pasó, y si una respuesta posterior lo pisa, no hay de dónde
 * sacarlo otra vez.
 */

const CTX = {
  esVivaru: true,
  uid: "uid-soporte",
  autorNombre: "Equipo Vivaru",
  nowIso: "2026-08-18T12:00:00.000Z",
};

describe("SUP-001 · primera respuesta", () => {
  it("sella la primera respuesta cuando no había ninguna", () => {
    const m = marcasSup001({}, CTX);
    expect(m.firstResponseAt).toBe(CTX.nowIso);
  });

  // La regla central. Sin esto, la métrica marcaría siempre el ÚLTIMO mensaje
  // y todos los tickets parecerían contestados al instante.
  it("NO la sobrescribe si el ticket ya tenía una", () => {
    const previa = "2026-08-01T09:00:00.000Z";
    const m = marcasSup001({ firstResponseAt: previa }, CTX);
    expect(m.firstResponseAt).toBeUndefined();
  });

  it("cuando escribe el CLIENTE no sella nada", () => {
    const m = marcasSup001({}, { ...CTX, esVivaru: false });
    expect(m).toEqual({});
  });
});

describe("SUP-001 · asignación automática", () => {
  it("quien responde primero se queda el ticket si no tenía dueño", () => {
    const m = marcasSup001({}, CTX);
    expect(m.assignedTo).toBe("uid-soporte");
    expect(m.assignedToName).toBe("Equipo Vivaru");
    expect(m.assignedAt).toBe(CTX.nowIso);
  });

  // Responder en un hilo ajeno no debe cambiar de quién es.
  it("NO roba un ticket que ya tenía responsable", () => {
    const m = marcasSup001({ assignedTo: "otra-persona" }, CTX);
    expect(m.assignedTo).toBeUndefined();
    expect(m.assignedToName).toBeUndefined();
    expect(m.assignedAt).toBeUndefined();
  });

  it("un ticket con dueño pero sin primera respuesta sella solo la respuesta", () => {
    const m = marcasSup001({ assignedTo: "otra-persona" }, CTX);
    expect(m.firstResponseAt).toBe(CTX.nowIso);
    expect(Object.keys(m)).toEqual(["firstResponseAt"]);
  });

  it("un ticket ya contestado y ya asignado no produce ninguna marca", () => {
    const m = marcasSup001(
      { firstResponseAt: "2026-08-01T09:00:00.000Z", assignedTo: "otra-persona" },
      CTX,
    );
    expect(m).toEqual({});
  });
});
