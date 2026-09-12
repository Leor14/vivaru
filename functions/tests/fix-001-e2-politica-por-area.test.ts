process.env.TZ = "UTC";

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  anticipacionDelArea,
  aplicaMora,
  avisoAlResidenteDeReservaCreada,
  estadoInicial,
  evaluarReglasDeReserva,
  MIN_ANTICIPACION_POR_DEFECTO,
  type ContextoDecision,
} from "../src/reservations";

/**
 * `PRD-V-FIX-001` entrega 2 — la política de reserva baja al ÁREA.
 *
 * R3: si el área define `blockOnDebt`, manda el área; `null` hereda del conjunto.
 * R4: la exención de la unidad sigue saltándose la mora, venga de donde venga.
 * R5: el margen de anticipación es el del área; por defecto 30 minutos, el de hoy.
 * R6: un área con `autoApprove` crea la reserva ya aprobada.
 * CA10: un área sin configurar se comporta EXACTAMENTE como hoy.
 */

const AHORA = new Date("2026-08-21T10:00:00Z");

function contexto(overrides: Partial<ContextoDecision> = {}): ContextoDecision {
  return {
    amenity: {},
    reservasDelDia: [],
    usoMensualDeLaUnidad: 0,
    saldoVencido: null,
    ahora: AHORA,
    zona: "UTC",
    ...overrides,
  };
}

const hoy = (startTime: string, endTime: string) => ({ unitId: "u-1", date: "2026-08-21", startTime, endTime });

describe("FIX-001 e2 · R5 — la anticipación es la del área", () => {
  it("sin configurar, 30 minutos: los de hoy (CA10)", () => {
    expect(MIN_ANTICIPACION_POR_DEFECTO).toBe(30);
    expect(anticipacionDelArea({})).toBe(30);
  });

  it("un entero entre 0 y una semana se respeta", () => {
    expect(anticipacionDelArea({ minAdvanceMinutes: 120 })).toBe(120);
    expect(anticipacionDelArea({ minAdvanceMinutes: 0 })).toBe(0);
    expect(anticipacionDelArea({ minAdvanceMinutes: 10080 })).toBe(10080);
  });

  // Un dato roto no puede dejar reservar sin margen: cae a los 30 de hoy, no a cero.
  it("lo que no es un entero válido cae a 30", () => {
    for (const valor of [-5, 10081, 45.5, Number.NaN, "60", null]) {
      expect(anticipacionDelArea({ minAdvanceMinutes: valor as unknown as number })).toBe(30);
    }
  });

  it("con 120 minutos, reservar a 90 se rechaza nombrando los 120", () => {
    const r = evaluarReglasDeReserva(hoy("11:30", "12:30"), contexto({ amenity: { minAdvanceMinutes: 120 } }));
    expect(r).toMatchObject({ ok: false, regla: "anticipacion" });
    if (!r.ok) expect(r.mensaje).toContain("120");
  });

  it("con 120 minutos, reservar a 121 pasa", () => {
    expect(evaluarReglasDeReserva(hoy("12:01", "13:01"), contexto({ amenity: { minAdvanceMinutes: 120 } }))).toEqual({
      ok: true,
    });
  });

  it("con 0 minutos, reservar para dentro de 5 pasa; con los 30 de hoy, no", () => {
    expect(evaluarReglasDeReserva(hoy("10:05", "11:00"), contexto({ amenity: { minAdvanceMinutes: 0 } }))).toEqual({
      ok: true,
    });
    expect(evaluarReglasDeReserva(hoy("10:05", "11:00"), contexto())).toMatchObject({ ok: false, regla: "anticipacion" });
  });
});

describe("FIX-001 e2 · R3 — la política de mora del área manda; sin ella, la del conjunto", () => {
  it("un área sin política hereda la del conjunto (CA10)", () => {
    expect(aplicaMora(true, undefined)).toBe(true);
    expect(aplicaMora(true, null)).toBe(true);
    expect(aplicaMora(false, undefined)).toBe(false);
    expect(aplicaMora(undefined, undefined)).toBe(false);
  });

  it("CA4 · un área que permite morosos gana al conjunto que los bloquea", () => {
    expect(aplicaMora(true, false)).toBe(false);
  });

  it("un área que bloquea gana al conjunto que no", () => {
    expect(aplicaMora(false, true)).toBe(true);
    expect(aplicaMora(undefined, true)).toBe(true);
  });

  it("un valor que no es booleano no cuenta como política del área", () => {
    expect(aplicaMora(true, "no" as unknown as boolean)).toBe(true);
    expect(aplicaMora(false, "sí" as unknown as boolean)).toBe(false);
  });
});

describe("FIX-001 e2 · R6 — aprobación automática por área", () => {
  it("CA10 · sin configurar, la reserva nace pendiente, como hoy", () => {
    expect(estadoInicial({})).toBe("pending");
    expect(estadoInicial({ autoApprove: false })).toBe("pending");
  });

  it("CA5 · con autoApprove, nace aprobada", () => {
    expect(estadoInicial({ autoApprove: true })).toBe("approved");
  });

  it("solo el booleano true aprueba", () => {
    expect(estadoInicial({ autoApprove: "true" as unknown as boolean })).toBe("pending");
  });
});

describe("FIX-001 e2 · el aviso al residente de una reserva que nace aprobada", () => {
  const base = { tenantId: "t-1", createdBy: "uid-res", amenity: "Gimnasio" };

  // `onReservationUpdated` solo avisa cuando el estado CAMBIA; una reserva que nace
  // aprobada no cambia, y sin esto el residente no se enteraría.
  it("autoaprobada: el residente recibe «Reserva aprobada»", () => {
    expect(avisoAlResidenteDeReservaCreada({ ...base, status: "approved", autoApproved: true })).toMatchObject({
      userId: "uid-res",
      tenantId: "t-1",
      type: "reservation",
      title: "Reserva aprobada",
      link: "/resident/reservations",
    });
  });

  it("pendiente: ningún aviso al residente (el administrador ya recibe el suyo)", () => {
    expect(avisoAlResidenteDeReservaCreada({ ...base, status: "pending" })).toBeNull();
  });

  it("aprobada por el administrador al crearla: tampoco, como hoy", () => {
    expect(avisoAlResidenteDeReservaCreada({ ...base, status: "approved" })).toBeNull();
  });

  it("sin creador no hay a quién avisar", () => {
    expect(avisoAlResidenteDeReservaCreada({ tenantId: "t-1", status: "approved", autoApproved: true })).toBeNull();
  });
});

describe("FIX-001 e2 · guardianes del cableado", () => {
  const sinComentarios = (fichero: string) =>
    fs
      .readFileSync(path.resolve(__dirname, fichero), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("crearReserva decide el estado con estadoInicial y la mora con la política del área", () => {
    const src = sinComentarios("../src/reservations.ts");
    const cuerpo = src.slice(src.indexOf("export async function crearReserva("), src.indexOf("export type CrearMudanzaInput"));
    expect(cuerpo).toMatch(/estadoInicial\(amenity\)/);
    expect(cuerpo).toMatch(/saldoVencidoDeUnidad\([^)]*amenity\.blockOnDebt/);
    expect(cuerpo).not.toMatch(/status:\s*"pending"\s+as const/);
  });

  it("onReservationCreated avisa al residente con avisoAlResidenteDeReservaCreada", () => {
    const src = sinComentarios("../src/index.ts");
    const inicio = src.indexOf("export const onReservationCreated");
    expect(inicio).toBeGreaterThan(-1);
    const bloque = src.slice(inicio, src.indexOf("\n});\n", inicio));
    expect(bloque).toMatch(/avisoAlResidenteDeReservaCreada\(/);
    // Y que el aviso entre de verdad en la lista: llamar a la función sin usar su
    // resultado no avisa a nadie.
    expect(bloque).toMatch(/\.\.\.\(alResidente \? \[alResidente\] : \[\]\)/);
  });
});
