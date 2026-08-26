import { describe, expect, it } from "vitest";

import {
  cicloDeVencidasValido,
  diaDeAvisoValido,
  MIN_CICLO_DIAS,
  tocaAvisoHoy,
  tocaVencidasHoy,
} from "../src/calendario-de-cobranza";

/**
 * `PRD-V-FLOW-003` §5.2 — el calendario de cobranza.
 *
 * **Lo que más se prueba aquí no es «toca hoy», es «no vuelve a tocar».** Un proceso programado
 * puede correr dos veces —un reintento, un redespliegue a la hora justa— y sin memoria del último
 * envío el residente recibe el mismo aviso dos veces. Un aviso duplicado no da error, no enrojece
 * nada y no lo ve nadie del equipo: lo ve el destinatario.
 */

const D = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe("FLOW-003 · R5, el día del aviso", () => {
  it.each([1, 15, 28])("acepta el día %i", (d) => expect(diaDeAvisoValido(d)).toBe(true));

  it.each([29, 30, 31])("RECHAZA el %i — no existe en todos los meses", (d) => {
    // Un aviso que a veces no sale es peor que uno que sale siempre el 28: el que
    // falla se descubre el mes que hace falta.
    expect(diaDeAvisoValido(d)).toBe(false);
  });

  it.each([0, -1, 1.5, "15", true, {}])("RECHAZA %s", (v) => expect(diaDeAvisoValido(v)).toBe(false));

  it("null y undefined son «desactivado», no un error", () => {
    expect(diaDeAvisoValido(null)).toBe(true);
    expect(diaDeAvisoValido(undefined)).toBe(true);
  });
});

describe("FLOW-003 · R6, el ciclo de vencidas", () => {
  it("el mínimo son 7 días, y es una decisión de negocio", () => {
    // Un ciclo de un día es un correo diario a alguien que debe dinero. Habitanto
    // permite 1; aquí no, y por eso el mínimo también vive en las reglas.
    expect(MIN_CICLO_DIAS).toBe(7);
    expect(cicloDeVencidasValido(7)).toBe(true);
    expect(cicloDeVencidasValido(6)).toBe(false);
    expect(cicloDeVencidasValido(1)).toBe(false);
  });

  it("acepta ciclos largos y el desactivado", () => {
    expect(cicloDeVencidasValido(30)).toBe(true);
    expect(cicloDeVencidasValido(null)).toBe(true);
  });
});

describe("FLOW-003 · ¿toca el aviso mensual?", () => {
  it("sale el día configurado", () => {
    expect(tocaAvisoHoy({ noticeDayOfMonth: 5 }, D("2026-09-05"))).toBe(true);
  });

  it("no sale otro día", () => {
    expect(tocaAvisoHoy({ noticeDayOfMonth: 5 }, D("2026-09-06"))).toBe(false);
  });

  it("desactivado no sale nunca", () => {
    expect(tocaAvisoHoy({ noticeDayOfMonth: null }, D("2026-09-05"))).toBe(false);
    expect(tocaAvisoHoy({}, D("2026-09-05"))).toBe(false);
  });

  /**
   * **La prueba que justifica mirar el último envío.** Sin ella, un proceso que corre dos veces el
   * mismo día manda el aviso dos veces — y eso no rompe nada que alguien del equipo vea.
   */
  it("NO repite si ya salió este mes, aunque el proceso corra otra vez", () => {
    expect(tocaAvisoHoy({ noticeDayOfMonth: 5, lastNoticeSentAt: "2026-09-05" }, D("2026-09-05"))).toBe(false);
  });

  it("y sí vuelve a salir el mes siguiente", () => {
    expect(tocaAvisoHoy({ noticeDayOfMonth: 5, lastNoticeSentAt: "2026-09-05" }, D("2026-10-05"))).toBe(true);
  });

  it("un día inválido guardado a mano no dispara nada", () => {
    // Cinturón: la regla de Firestore ya lo impide, pero un valor viejo o escrito
    // por otra vía no debe hacer que el proceso decida cualquier cosa.
    expect(tocaAvisoHoy({ noticeDayOfMonth: 31 }, D("2026-10-31"))).toBe(false);
  });
});

describe("FLOW-003 · ¿toca el aviso de vencidas?", () => {
  it("sin envío previo, toca", () => {
    // Esperar un ciclo entero desde que se configura dejaría al conjunto sin su
    // primer aviso durante N días sin que nadie entienda por qué.
    expect(tocaVencidasHoy({ overdueCycleDays: 7 }, D("2026-09-01"))).toBe(true);
  });

  it("respeta el ciclo: al sexto día no, al séptimo sí", () => {
    const cal = { overdueCycleDays: 7, lastOverdueSentAt: "2026-09-01" };
    expect(tocaVencidasHoy(cal, D("2026-09-07"))).toBe(false);
    expect(tocaVencidasHoy(cal, D("2026-09-08"))).toBe(true);
  });

  it("desactivado no sale nunca", () => {
    expect(tocaVencidasHoy({ overdueCycleDays: null, lastOverdueSentAt: "2020-01-01" }, D("2026-09-01"))).toBe(false);
  });

  it("un ciclo por debajo del mínimo no dispara — ni escrito a mano", () => {
    expect(tocaVencidasHoy({ overdueCycleDays: 1, lastOverdueSentAt: "2026-09-01" }, D("2026-09-02"))).toBe(false);
  });

  it("cruza el fin de mes sin contar mal", () => {
    // Restar meses o días de calendario a mano es donde estas cosas se rompen.
    expect(tocaVencidasHoy({ overdueCycleDays: 7, lastOverdueSentAt: "2026-08-28" }, D("2026-09-04"))).toBe(true);
    expect(tocaVencidasHoy({ overdueCycleDays: 7, lastOverdueSentAt: "2026-08-28" }, D("2026-09-03"))).toBe(false);
  });

  it("tolera una marca con hora dentro", () => {
    expect(tocaVencidasHoy({ overdueCycleDays: 7, lastOverdueSentAt: "2026-09-01T18:22:00Z" }, D("2026-09-08"))).toBe(true);
  });
});
