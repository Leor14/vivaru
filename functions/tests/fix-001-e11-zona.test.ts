// Cloud Functions corre en UTC. La prueba fija esa zona para que dé lo mismo en
// un portátil en México que en CI, y la zona del CONJUNTO se pasa explícita.
process.env.TZ = "UTC";

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { evaluarReglasDeReserva, type ContextoDecision } from "../src/reservations";
import { instanteEnZona, zonaDelConjunto } from "../src/zona-del-conjunto";

/**
 * `PRD-V-FIX-001` entrega 1.1 — la hora que elige el residente es la de SU conjunto.
 *
 * Hasta el 12 sep 2026 el servidor leía «2026-09-21 08:30» como UTC: la reserva de
 * Santa María guardó `startAt = 08:30Z` cuando las 08:30 de Bogotá son las 13:30Z, y
 * la antelación rechazaba reservas del mismo día que empezaban dentro de ~5,5 h
 * (6,5 en México). Decisión de David (12 sep): la zona sale del país del conjunto,
 * solo en reservas; el «vencido» sigue en UTC hasta que él decida.
 */

const MX = "America/Mexico_City";
const CO = "America/Bogota";

function contexto(overrides: Partial<ContextoDecision> = {}): ContextoDecision {
  return {
    amenity: {},
    reservasDelDia: [],
    usoMensualDeLaUnidad: 0,
    saldoVencido: null,
    ahora: new Date("2026-08-21T14:00:00Z"),
    zona: MX,
    ...overrides,
  };
}

describe("FIX-001 e1.1 · instanteEnZona", () => {
  it("la reserva real de Santa María: las 08:30 de Bogotá son las 13:30Z", () => {
    expect(instanteEnZona("2026-09-21", "08:30", CO)?.toISOString()).toBe("2026-09-21T13:30:00.000Z");
  });

  it("las 20:00 de un sábado en Ciudad de México ya son domingo en UTC", () => {
    expect(instanteEnZona("2026-08-22", "20:00", MX)?.toISOString()).toBe("2026-08-23T02:00:00.000Z");
  });

  it("Guayaquil va a UTC-5", () => {
    expect(instanteEnZona("2026-09-12", "07:00", "America/Guayaquil")?.toISOString()).toBe(
      "2026-09-12T12:00:00.000Z",
    );
  });

  it("una fecha o una hora imposibles no dan instante", () => {
    expect(instanteEnZona("2026-13-40", "10:00", MX)).toBeNull();
    expect(instanteEnZona("2026-02-30", "10:00", MX)).toBeNull();
    expect(instanteEnZona("2026-09-12", "25:00", MX)).toBeNull();
    expect(instanteEnZona("", "10:00", MX)).toBeNull();
  });
});

describe("FIX-001 e1.1 · zonaDelConjunto", () => {
  it("una zona por país, y la de la capital de México si no hay país", () => {
    expect(zonaDelConjunto("CO")).toBe(CO);
    expect(zonaDelConjunto("EC")).toBe("America/Guayaquil");
    expect(zonaDelConjunto("MX")).toBe(MX);
    expect(zonaDelConjunto(undefined)).toBe(MX);
  });
});

describe("FIX-001 e1.1 · la antelación se mide en la hora del conjunto", () => {
  const CANDIDATA = { unitId: "u-1", date: "2026-08-21", startTime: "10:00", endTime: "11:00" };

  it("en México, a las 08:00, reservar a las 10:00 del mismo día PASA (antes: «anticipación»)", () => {
    const r = evaluarReglasDeReserva(CANDIDATA, contexto({ ahora: new Date("2026-08-21T14:00:00Z"), zona: MX }));
    expect(r).toEqual({ ok: true });
  });

  it("en Bogotá, a las 08:00, reservar a las 08:20 sigue rechazado", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "08:20", endTime: "09:00" },
      contexto({ ahora: new Date("2026-08-21T13:00:00Z"), zona: CO }),
    );
    expect(r).toMatchObject({ ok: false, regla: "anticipacion" });
  });

  it("en Bogotá, a las 08:00, reservar a las 08:31 pasa", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "08:31", endTime: "09:31" },
      contexto({ ahora: new Date("2026-08-21T13:00:00Z"), zona: CO }),
    );
    expect(r).toEqual({ ok: true });
  });

  // El lado que no puede fallar abierto: a las 11:00 de México, las 10:30 de ese
  // día ya pasaron. Una conversión que sumara la zona dos veces las pondría a las
  // 22:30Z y las dejaría pasar.
  it("una hora ya pasada en el conjunto se rechaza", () => {
    const r = evaluarReglasDeReserva(
      { ...CANDIDATA, startTime: "10:30", endTime: "11:30" },
      contexto({ ahora: new Date("2026-08-21T17:00:00Z"), zona: MX }),
    );
    expect(r).toMatchObject({ ok: false, regla: "anticipacion" });
  });

  // 2026-08-22 es sábado. A las 20:00 de México ya es domingo en UTC: si el día se
  // sacara del instante, un área de solo sábados rechazaría su propio sábado.
  it("el día de la semana es el de la FECHA elegida, no el del instante en UTC", () => {
    const r = evaluarReglasDeReserva(
      { unitId: "u-1", date: "2026-08-22", startTime: "20:00", endTime: "21:00" },
      contexto({ zona: MX, amenity: { availableWeekdays: [6] } }),
    );
    expect(r).toEqual({ ok: true });
  });
});

describe("FIX-001 e1.1 · guardián", () => {
  // `combineDateAndTime` interpreta la fecha en la zona del PROCESO, que en
  // Cloud Functions es UTC. Es exactamente el defecto: en el módulo de reservas
  // del servidor no puede volver a aparecer.
  it("reservations.ts ya no interpreta una hora sin la zona del conjunto", () => {
    const src = fs
      .readFileSync(path.resolve(__dirname, "../src/reservations.ts"), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/combineDateAndTime\s*\(/);
    expect(src).toMatch(/instanteEnZona\s*\(/);
  });
});
