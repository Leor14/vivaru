import { describe, expect, it } from "vitest";

import { entradaDelHilo, marcasSup001, repartoDeAsignacion, seAsignaAlResponder } from "../src/support";

/**
 * `PRD-V-FIX-005` · H3 / R4 / `CF6` — ningún conjunto ve el uid de nadie del equipo de Vivaru.
 *
 * El administrador del conjunto lee el documento ENTERO de su ticket —las reglas no filtran
 * campos—, así que lo que se escribe ahí es suyo. El uid del equipo iba por DOS campos:
 * `thread[].authorUid` de cada respuesta y `assignedTo`. Se comprueba recorriendo TODO lo que
 * va al documento, no un campo concreto, para que un campo nuevo con el uid enrojezca igual.
 * Lo que de verdad necesita el uid —el «Asignármelo» de la consola, quién escribió cada
 * respuesta— va a `equipo`, que solo lee el superadmin.
 */

const UID = "uid-equipo-fix005";
const CTX = { esVivaru: true, uid: UID, autorNombre: "Equipo Vivaru", nowIso: "2026-09-12T01:00:00.000Z" };
const llevaElUid = (valor: unknown) => JSON.stringify(valor).includes(UID);

describe("FIX-005 · CF6 · el documento del ticket no lleva el uid del equipo", () => {
  it("la respuesta del equipo entra en el hilo sin su uid", () => {
    const entrada = entradaDelHilo({ ...CTX, id: "m1", message: "Hola", adjuntos: [] });
    expect(llevaElUid(entrada)).toBe(false);
    expect(entrada).toMatchObject({
      id: "m1",
      role: "vivaru",
      authorName: "Equipo Vivaru",
      message: "Hola",
      createdAt: CTX.nowIso,
    });
  });

  it("la autoasignación al responder no escribe el uid en el ticket", () => {
    const marcas = marcasSup001({}, CTX);
    expect(llevaElUid(marcas)).toBe(false);
    expect(marcas).toMatchObject({
      assignedToName: "Equipo Vivaru",
      assignedAt: CTX.nowIso,
      firstResponseAt: CTX.nowIso,
    });
  });

  it("la asignación a mano tampoco: el uid va a `equipo`", () => {
    const reparto = repartoDeAsignacion({ uid: UID, nombre: "Ana de Vivaru" }, CTX.nowIso);
    expect(llevaElUid(reparto.ticket)).toBe(false);
    expect(reparto.ticket).toEqual({ assignedToName: "Ana de Vivaru", assignedAt: CTX.nowIso });
    expect(reparto.equipo).toEqual({ uid: UID, updatedAt: CTX.nowIso });
  });

  it("desasignar borra el nombre y la hora del ticket, y el documento de `equipo`", () => {
    const reparto = repartoDeAsignacion(null, CTX.nowIso);
    expect(reparto.ticket).toEqual({ assignedToName: null, assignedAt: null });
    expect(reparto.equipo).toBeNull();
  });
});

describe("FIX-005 · lo que no cambia", () => {
  // El control del primero: el cliente sigue firmando con SU uid, que no es del equipo.
  // Si esto enrojeciera, el arreglo habría quitado de más.
  it("la respuesta del CLIENTE conserva su authorUid", () => {
    const entrada = entradaDelHilo({
      ...CTX,
      esVivaru: false,
      uid: "uid-cliente",
      autorNombre: "Administración",
      id: "m2",
      message: "Gracias",
      adjuntos: [],
    });
    expect(entrada).toMatchObject({ role: "cliente", authorUid: "uid-cliente" });
  });

  it("un ticket con el assignedTo de antes, aunque no tenga nombre, sigue contando como asignado", () => {
    expect(seAsignaAlResponder({ assignedTo: "uid-viejo" }, CTX)).toBe(false);
    expect(seAsignaAlResponder({ assignedToName: "Otra persona" }, CTX)).toBe(false);
    expect(seAsignaAlResponder({}, CTX)).toBe(true);
    expect(seAsignaAlResponder({}, { ...CTX, esVivaru: false })).toBe(false);
  });
});
