import { describe, expect, it } from "vitest";

import {
  ACTOR_SOMBRA,
  decisionDelTicket,
  esEstadoTerminal,
  hayQueRegistrarDecision,
  planificarSombra,
  type TicketEnSombra,
} from "../src/ai/sombra-pqrs";
import { evaluateQuota } from "../src/ai/quota";
import { findOperation } from "../src/ai/catalog";

/**
 * Modo sombra de PQRS — Fase 4 de `PRD-VAI-FEAT-002`.
 *
 * Lo que se prueba aquí es **cuándo NO se gasta dinero** y **qué se guarda como
 * decisión del administrador**. Las dos cosas son las que deciden si el conjunto
 * de evaluación de G7 sirve o miente: la primera porque una sombra que corre
 * donde no debe fabrica filas sin par, y la segunda porque un `priority`
 * inventado convertiría un default en una decisión — que es exactamente el
 * defecto que costó corregir el 16 de agosto.
 */

const CONJUNTO = "conjunto-a";

function ticket(overrides: Partial<TicketEnSombra> = {}): TicketEnSombra {
  return {
    tenantId: CONJUNTO,
    subject: "Fuga en el parqueadero",
    message: "Hay agua saliendo del techo del parqueadero desde ayer.",
    status: "open",
    ...overrides,
  };
}

describe("dónde NO corre la sombra", () => {
  it("omite los conjuntos de buzón simple, y deja dicho el motivo", () => {
    // No es ahorro: en esa variante la pantalla no pinta el editor de
    // clasificación, así que no hay decisión del administrador que capturar.
    // Sin decisión no hay par, y el par es lo único que la sombra fabrica.
    const plan = planificarSombra(ticket(), CONJUNTO, "buzon_simple");

    expect(plan).toEqual({ accion: "omitir", motivo: "buzon_simple" });
  });

  it("omite un ticket sin nada que leer", () => {
    const plan = planificarSombra(ticket({ subject: "", message: "" }), CONJUNTO, "con_sla");

    expect(plan).toEqual({ accion: "omitir", motivo: "ticket_sin_texto" });
  });

  it("omite un ticket cuyo conjunto no coincide con el suyo", () => {
    const plan = planificarSombra(ticket({ tenantId: "conjunto-b" }), CONJUNTO, "con_sla");

    expect(plan).toMatchObject({ accion: "omitir" });
  });

  it("omite un ticket sin conjunto — un documento sin conjunto no es de nadie", () => {
    const plan = planificarSombra(ticket({ tenantId: undefined }), CONJUNTO, "con_sla");

    expect(plan).toMatchObject({ accion: "omitir" });
  });
});

describe("dónde sí corre", () => {
  it("clasifica un ticket normal con SLA y arma la entrada en servidor", () => {
    const plan = planificarSombra(ticket(), CONJUNTO, "con_sla");

    expect(plan.accion).toBe("clasificar");
    // La variante viaja dentro de la entrada porque es lo que decide la puerta
    // dura de nulls, y aquí la resuelve el servidor leyendo `tenantSettings`.
    expect(plan.accion === "clasificar" && plan.entrada).toMatchObject({ variante: "con_sla" });
  });

  it("le dice al modelo el asunto y el mensaje, y nada del ticket que no sea eso", () => {
    // PRD §7: la entrada permitida es acotada. Si mañana alguien mete el
    // historial de pagos o el nombre del residente en la entrada, esto se cae.
    const plan = planificarSombra(
      ticket({ priority: "high", classifiedBy: "admin-1", status: "in_progress" }),
      CONJUNTO,
      "con_sla",
    );

    expect(plan.accion === "clasificar" && Object.keys(plan.entrada as object).sort()).toEqual([
      "asunto",
      "mensaje",
      "variante",
    ]);
  });
});

describe("la decisión del administrador se guarda como está, no como convendría", () => {
  it("no escribe `priority` cuando el administrador no decidió ese eje", () => {
    // LA prueba del 16 de agosto, por el otro extremo. Allí el defecto era
    // escribir el default «Media» como si fuera una decisión; aquí sería
    // convertir la ausencia en un `null` que un lector futuro no sabría
    // distinguir de «decidió que ninguna».
    const decision = decisionDelTicket(
      ticket({ category: "maintenance", type: "claim", classifiedAt: "2026-08-17T04:00:00.000Z" }),
    );

    expect(decision).not.toHaveProperty("priority");
    expect(decision).toMatchObject({ category: "maintenance", type: "claim" });
  });

  it("sí la escribe cuando el administrador la eligió", () => {
    const decision = decisionDelTicket(ticket({ category: "pqrs", type: "complaint", priority: "high" }));

    expect(decision.priority).toBe("high");
  });

  it("no inventa campos a partir de cadenas vacías", () => {
    expect(decisionDelTicket(ticket({ category: "   ", classifiedBy: "" }))).not.toHaveProperty("category");
  });
});

describe("cuándo se vuelve a anotar la decisión", () => {
  it("anota cuando cambia cualquiera de los tres ejes", () => {
    expect(hayQueRegistrarDecision(ticket(), ticket({ category: "maintenance" }))).toBe(true);
    expect(hayQueRegistrarDecision(ticket(), ticket({ type: "claim" }))).toBe(true);
    expect(hayQueRegistrarDecision(ticket(), ticket({ priority: "high" }))).toBe(true);
  });

  it("anota cuando el ticket cruza a resuelto, aunque nadie tocara la clasificación", () => {
    // Es lo que congela la fila para G7.
    expect(hayQueRegistrarDecision(ticket(), ticket({ status: "resolved" }))).toBe(true);
    expect(hayQueRegistrarDecision(ticket(), ticket({ status: "closed" }))).toBe(true);
  });

  it("NO anota al responder un ticket, que es la escritura más frecuente", () => {
    // `onDocumentUpdated` dispara con cualquier escritura. Sin esta guardia, la
    // fila se reescribiría en todas y `decisionActualizadaEn` se movería cuando
    // la decisión no se movió.
    expect(hayQueRegistrarDecision(ticket(), ticket({ status: "responded" }))).toBe(false);
    expect(hayQueRegistrarDecision(ticket(), ticket())).toBe(false);
  });

  it("`responded` no es un estado terminal — responder no es resolver", () => {
    expect(esEstadoTerminal("responded")).toBe(false);
    expect(esEstadoTerminal("in_progress")).toBe(false);
    expect(esEstadoTerminal("resolved")).toBe(true);
    expect(esEstadoTerminal("closed")).toBe(true);
  });
});

describe("la sombra no es un usuario, a efectos de cuota", () => {
  const OPERACION = findOperation("pqrs-asistir");
  if (!OPERACION) throw new Error("El catálogo perdió pqrs-asistir.");

  it("un conjunto con más tickets que el tope por usuario los sigue clasificando", () => {
    // Sin esto, los 20 diarios por usuario se convertirían en un techo de 20
    // tickets al día por conjunto, y a partir del 21 se perdería conjunto de
    // evaluación EN SILENCIO — el hueco no se vería al contar.
    const contados = { conjuntoDia: 25, conjuntoMes: 25, usuarioDia: 25 };

    expect(evaluateQuota(contados, OPERACION.quota, { topeDeUsuario: false }).ok).toBe(true);
    expect(evaluateQuota(contados, OPERACION.quota).ok).toBe(false);
  });

  it("los topes del CONJUNTO sí se le aplican", () => {
    // Existen para que un conjunto desbocado no se coma el presupuesto de
    // todos, y el gasto de la sombra es gasto del conjunto como cualquier otro.
    const decision = evaluateQuota(
      { conjuntoDia: OPERACION.quota.perTenantDay, conjuntoMes: 0, usuarioDia: 0 },
      OPERACION.quota,
      { topeDeUsuario: false },
    );

    expect(decision).toMatchObject({ ok: false, excedida: "conjunto_dia" });
  });

  it("sin tope de usuario, lo que queda de ese contador se reporta entero", () => {
    // No se leyó ni se escribió: restarle un consumo que no ocurrió sería
    // inventarse un número en la respuesta.
    const decision = evaluateQuota({ conjuntoDia: 0, conjuntoMes: 0, usuarioDia: 0 }, OPERACION.quota, {
      topeDeUsuario: false,
    });

    expect(decision.restante.usuarioDia).toBe(OPERACION.quota.perUserDay);
  });

  it("el actor de la sombra no puede confundirse con un uid de Firebase", () => {
    // Es la etiqueta que separa el gasto de la sombra del de los
    // administradores al leer la factura, así que tiene que ser inconfundible.
    expect(ACTOR_SOMBRA).toBe("__sombra__");
  });
});
