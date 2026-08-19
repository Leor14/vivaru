import { describe, expect, it } from "vitest";

import {
  esperaPrimeraRespuesta,
  horasHastaPrimeraRespuesta,
  isSupportPending,
  type SupportTicket,
} from "@/features/support/types";

/**
 * `SUP-001` — responsable y primera respuesta.
 *
 * Lo que defienden estas pruebas es un dato que **no se reconstruye**:
 * `firstResponseAt` sale de un instante que ya pasó. Si se sobrescribe o se
 * calcula mal, no hay forma de recuperarlo.
 */

function ticket(parcial: Partial<SupportTicket>): SupportTicket {
  return {
    id: "t1",
    tenantId: "tenant-a",
    tenantName: "Conjunto A",
    createdBy: "uid-cliente",
    createdByName: "Ana",
    createdByEmail: "ana@conjunto.com",
    category: "tecnico",
    subject: "No carga la cartera",
    description: "…",
    priority: "media",
    status: "abierto",
    thread: [],
    ...parcial,
  };
}

describe("SUP-001 · horas hasta la primera respuesta", () => {
  it("calcula las horas entre el alta y la primera respuesta", () => {
    const t = ticket({
      createdAt: "2026-08-18T08:00:00.000Z",
      firstResponseAt: "2026-08-18T11:30:00.000Z",
    });
    expect(horasHastaPrimeraRespuesta(t)).toBe(3.5);
  });

  it("sin primera respuesta devuelve null", () => {
    expect(horasHastaPrimeraRespuesta(ticket({ createdAt: "2026-08-18T08:00:00.000Z" }))).toBeNull();
  });

  // Los tickets anteriores a la ficha no tienen el dato y nunca lo tendrán.
  it("un ticket viejo sin ninguno de los dos campos no rompe el cálculo", () => {
    expect(horasHastaPrimeraRespuesta(ticket({}))).toBeNull();
  });

  it("fechas corruptas devuelven null en vez de NaN", () => {
    const t = ticket({ createdAt: "no-es-fecha", firstResponseAt: "2026-08-18T11:00:00.000Z" });
    expect(horasHastaPrimeraRespuesta(t)).toBeNull();
  });

  // Defensa contra relojes torcidos: una respuesta anterior al alta es un dato
  // roto, y devolver un negativo pintaría «-3 h» en la consola.
  it("una respuesta anterior al alta devuelve null, no un negativo", () => {
    const t = ticket({
      createdAt: "2026-08-18T11:00:00.000Z",
      firstResponseAt: "2026-08-18T08:00:00.000Z",
    });
    expect(horasHastaPrimeraRespuesta(t)).toBeNull();
  });
});

describe("SUP-001 · distinguir «sin responder» de «sin dato»", () => {
  it("un ticket abierto y sin respuesta está esperando", () => {
    expect(esperaPrimeraRespuesta(ticket({ status: "abierto" }))).toBe(true);
    expect(esperaPrimeraRespuesta(ticket({ status: "en_proceso" }))).toBe(true);
  });

  it("si ya se respondió, no espera", () => {
    const t = ticket({ status: "en_proceso", firstResponseAt: "2026-08-18T11:00:00.000Z" });
    expect(esperaPrimeraRespuesta(t)).toBe(false);
  });

  // El caso que no debe alarmar: un ticket cerrado hace meses, sin el campo
  // porque es anterior a la ficha, NO es un ticket desatendido.
  it("un ticket cerrado sin el dato no cuenta como desatendido", () => {
    expect(esperaPrimeraRespuesta(ticket({ status: "cerrado" }))).toBe(false);
    expect(esperaPrimeraRespuesta(ticket({ status: "resuelto" }))).toBe(false);
  });

  // La pelota está en el cliente: no es una omisión nuestra.
  it("esperando respuesta del cliente tampoco cuenta", () => {
    expect(esperaPrimeraRespuesta(ticket({ status: "esperando_respuesta" }))).toBe(false);
  });
});

describe("SUP-001 · el contador de pendientes no cambia de significado", () => {
  it("pendiente sigue siendo lo que espera acción de Vivaru", () => {
    expect(isSupportPending("abierto")).toBe(true);
    expect(isSupportPending("en_proceso")).toBe(true);
    expect(isSupportPending("esperando_respuesta")).toBe(false);
    expect(isSupportPending("resuelto")).toBe(false);
    expect(isSupportPending("cerrado")).toBe(false);
  });
});

/**
 * El sellado ocurre en `functions/src/support.ts` y se prueba allí contra el
 * emulador. Aquí se fija la REGLA que ese código debe cumplir, para que quede
 * escrita del lado que la consola consume:
 *
 * 1. `firstResponseAt` se escribe solo si NO existe. Sobrescribirlo en cada
 *    respuesta haría que todos los tickets parecieran contestados al instante.
 * 2. Solo lo escribe una respuesta de Vivaru. Un cambio de estado no es
 *    responder.
 * 3. `assignedTo` se rellena al responder solo si estaba vacío: responder no
 *    debe robar un ticket que otra persona ya se había asignado.
 */
describe("SUP-001 · la regla del sellado, escrita donde se consume", () => {
  it("un ticket ya contestado conserva su primera respuesta aunque haya más", () => {
    const primera = "2026-08-18T09:00:00.000Z";
    const t = ticket({
      createdAt: "2026-08-18T08:00:00.000Z",
      firstResponseAt: primera,
      thread: [
        {
          id: "m1",
          role: "vivaru",
          authorUid: "u1",
          authorName: "Soporte",
          message: "Vamos a mirarlo",
          createdAt: primera,
        },
        {
          id: "m2",
          role: "vivaru",
          authorUid: "u1",
          authorName: "Soporte",
          message: "Ya está",
          createdAt: "2026-08-19T15:00:00.000Z",
        },
      ],
    });
    expect(t.firstResponseAt).toBe(primera);
    expect(horasHastaPrimeraRespuesta(t)).toBe(1);
  });
});
