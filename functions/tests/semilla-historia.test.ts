import { describe, expect, it } from "vitest";

import {
  CASAS_DEMO,
  CORREOS_CON_ACCESO,
  DOMINIO_INERTE,
  SECCIONES,
  construirPadron,
  digitoDeControlClabe,
  repartirIndivisos,
  slugDeUnidad,
} from "../scripts/historias/lomas-de-sayilbedra.mjs";
import {
  diaDelMes,
  diaLocal,
  diasEntre,
  instante,
  meses,
  mesMas,
  sumarHabiles,
} from "../scripts/historias/reloj.mjs";

/**
 * **El guion de la semilla de Lomas de Sayilbedra** (docs/plan-seed-demo-lomas-de-sayilbedra.md).
 *
 * Es puro, así que lo que aquí se comprueba vale igual para el emulador, el ensayo de staging y
 * producción. Lo que NO se comprueba aquí —que lo escrito cuadre con el producto— lo mira
 * `verificar-historia-demo.mjs` contra la base.
 */

const T = "conjunto-de-prueba";
const padron = construirPadron(T);
type Casa = (typeof padron.casas)[number];

describe("el padrón de la historia", () => {
  it("48 casas, 16 por sección, cada una en una agrupación del conjunto", () => {
    expect(padron.casas).toHaveLength(48);
    for (const s of SECCIONES) expect(padron.casas.filter((c: Casa) => c.tower === s)).toHaveLength(16);
    expect(padron.ajustes.agrupaciones).toEqual(SECCIONES);
  });

  it("los indivisos suman 100,000000 exacto y ninguno pasa de seis decimales", () => {
    const millonesimas = padron.casas.map((c: Casa) => c.coefficient * 1_000_000);
    for (const m of millonesimas) expect(Math.abs(m - Math.round(m))).toBeLessThan(1e-6);
    expect(millonesimas.reduce((s: number, m: number) => s + Math.round(m), 0)).toBe(100_000_000);
  });

  it("el resto mayor cierra el 100 % aunque las superficies no dividan", () => {
    const tres = repartirIndivisos([1, 1, 1]);
    expect(tres).toEqual([33.333334, 33.333333, 33.333333]);
    expect(Math.round(tres.reduce((s: number, x: number) => s + x, 0) * 1e6)).toBe(100_000_000);
  });

  it("todo id lleva el conjunto delante: los ids de estas colecciones son globales", () => {
    const ids = [
      ...padron.casas.map((c: Casa) => c.id),
      ...padron.personas.map((p: { id: string }) => p.id),
      ...padron.areas.map((a: { id: string }) => a.id),
      ...padron.proveedores.map((p: { id: string }) => p.id),
      ...padron.bancos.map((b: { id: string }) => b.id),
      padron.servicioMedido.id,
      padron.caja.id,
    ];
    for (const id of ids) expect(id.startsWith(`${T}--`), id).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("`unitId` es el slug del nombre, carácter a carácter como `createUnit`", () => {
    for (const c of padron.casas) expect(slugDeUnidad(c.displayName)).toBe(c.clave);
  });

  it("cada casa tiene dueño: la corrida por indiviso lo exige", () => {
    for (const c of padron.casas) expect(c.ownerIds.length, c.clave).toBeGreaterThan(0);
  });

  it("los correos son inertes, salvo los tres alias de las cuentas de residente con acceso", () => {
    const alias = new Set([CORREOS_CON_ACCESO.resCorriente, CORREOS_CON_ACCESO.resMoroso, CORREOS_CON_ACCESO.consejero]);
    const correos = padron.personas.map((p: { email: string }) => p.email);
    for (const e of correos) expect(e.endsWith(`@${DOMINIO_INERTE}`) || alias.has(e), e).toBe(true);
    expect(correos.filter((e: string) => alias.has(e))).toHaveLength(3);
    expect(new Set(correos).size).toBe(correos.length);
  });

  it("nadie lleva teléfono ni documento: un número inventado puede ser de alguien (D12)", () => {
    for (const p of padron.personas) {
      expect(p).not.toHaveProperty("phone");
      expect(p).not.toHaveProperty("documentNumber");
    }
  });

  it("cuatro cuentas con acceso, una treintena sin él, y dos del consejo (D3, D13)", () => {
    const con = padron.cuentas.filter((c: { acceso: boolean }) => c.acceso);
    const sin = padron.cuentas.filter((c: { acceso: boolean }) => !c.acceso);
    expect(con.map((c: { email: string }) => c.email).sort()).toEqual(Object.values(CORREOS_CON_ACCESO).sort());
    expect(sin.length).toBeGreaterThanOrEqual(30);
    expect(sin.length).toBeLessThanOrEqual(40);
    for (const c of sin) expect(c.email.endsWith(`@${DOMINIO_INERTE}`), c.email).toBe(true);
    expect(padron.cuentas.filter((c: { consejo: boolean }) => c.consejo)).toHaveLength(2);
    expect(padron.cuentas.filter((c: { role: string }) => c.role === "security_guard")).toHaveLength(1);
    const correos = padron.cuentas.map((c: { email: string }) => c.email);
    expect(new Set(correos).size).toBe(correos.length);
  });

  it("las casas demo tienen su papel: adelantada, morosa y las dos del consejo", () => {
    const casa = (clave: string) => padron.casas.find((c: Casa) => c.clave === clave);
    const cuenta = (clave: string) => padron.cuentas.find((c: { clave: string }) => c.clave === `res-${clave}`);
    expect(casa(CASAS_DEMO.resCorriente)?.cohorte).toBe("adelantado");
    expect(casa(CASAS_DEMO.resMoroso)?.cohorte).toBe("moroso");
    expect(cuenta(CASAS_DEMO.consejero)).toMatchObject({ acceso: true, consejo: true, email: CORREOS_CON_ACCESO.consejero });
    expect(cuenta(CASAS_DEMO.consejeroSinAcceso)).toMatchObject({ acceso: false, consejo: true });
  });

  it("las CLABE tienen 18 dígitos y el dígito de control MAL: no pueden ser de nadie", () => {
    // Vector calculado a mano con el algoritmo de Banxico (pesos 3, 7, 1; módulo 10).
    expect(digitoDeControlClabe("12345678901234567")).toBe(3);
    for (const b of padron.bancos) {
      expect(b.accountNumber).toMatch(/^\d{18}$/);
      expect(Number(b.accountNumber[17])).not.toBe(digitoDeControlClabe(b.accountNumber.slice(0, 17)));
    }
  });

  it("es determinista, y el conjunto solo cambia el prefijo", () => {
    expect(construirPadron(T)).toEqual(padron);
    const otro = construirPadron("otro-conjunto");
    expect(otro.casas.map((c: Casa) => [c.clave, c.coefficient])).toEqual(padron.casas.map((c: Casa) => [c.clave, c.coefficient]));
    expect(otro.personas.map((p: { fullName: string }) => p.fullName)).toEqual(padron.personas.map((p: { fullName: string }) => p.fullName));
  });
});

describe("el reloj de Puebla", () => {
  it("las 18:30 del 12 son el 13 en UTC, y siguen siendo el 12 en Puebla", () => {
    const t = instante("2026-09-12", "18:30");
    expect(t.toISOString()).toBe("2026-09-13T00:30:00.000Z");
    expect(diaLocal(t)).toBe("2026-09-12");
  });

  it("los meses se desplazan sin `setMonth` y un 31 no se desborda", () => {
    expect(mesMas("2026-01", -1)).toBe("2025-12");
    expect(mesMas("2026-12", 1)).toBe("2027-01");
    expect(diaDelMes("2026-02", 31)).toBe("2026-02-28");
    expect(meses("2026-06", "2026-09")).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(diasEntre("2026-05-31", "2026-06-01")).toBe(1);
  });

  it("los días hábiles saltan el fin de semana", () => {
    expect(sumarHabiles("2026-09-11", 1)).toBe("2026-09-14");
    expect(sumarHabiles("2026-09-14", 5)).toBe("2026-09-21");
  });
});
