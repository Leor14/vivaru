import { describe, expect, it } from "vitest";

import { claveDeAgrupacion, deducirContexto } from "../src/ai/tenant-context";

/**
 * Contexto del conjunto — el cambio del 14 de agosto de 2026.
 *
 * Lo que se protege aquí no es un cálculo, es una **dirección de error**. Este
 * módulo decide si el modelo deja de preguntar por las torres, y equivocarse
 * hacia «no tiene torres» calla una pregunta legítima en un conjunto que sí las
 * tiene. Equivocarse hacia el otro lado solo hace que pregunte, que es lo que ya
 * hace hoy. Casi todas las pruebas de abajo comprueban esa asimetría.
 */

describe("la clave solo puede equivocarse hacia arriba", () => {
  it("ignora mayúsculas, acentos, guiones y espacios", () => {
    expect(claveDeAgrupacion("Torre 1")).toBe(claveDeAgrupacion("torre-1"));
    expect(claveDeAgrupacion("  TORRE 1  ")).toBe(claveDeAgrupacion("Torre 1"));
    expect(claveDeAgrupacion("Manzana Ñ")).toBe(claveDeAgrupacion("manzana ñ"));
  });

  it("NO funde dos agrupaciones que de verdad son distintas", () => {
    // Es la garantía que sostiene todo lo demás: si dos torres reales colapsaran
    // en una clave, el conjunto pasaría por edificio único y se callaría una
    // pregunta que hacía falta.
    const claves = new Set(["Torre 1", "Torre 2", "Bloque A", "Bloque B"].map(claveDeAgrupacion));
    expect(claves.size).toBe(4);
  });

  it("separar de más es aceptable: «T1» y «Torre 1» cuentan como dos", () => {
    // La canonización de verdad las uniría. Aquí no, y da igual: el resultado es
    // «tiene torres» y el modelo pregunta, que es la conducta de siempre.
    expect(claveDeAgrupacion("T1")).not.toBe(claveDeAgrupacion("Torre 1"));
    expect(deducirContexto(["T1", "Torre 1"]).tieneAgrupaciones).toBe(true);
  });
});

describe("qué se deduce de las unidades", () => {
  it("una sola agrupación es un edificio único", () => {
    expect(deducirContexto(["Principal", "Principal", "Principal"])).toEqual({ tieneAgrupaciones: false });
  });

  it("dos o más agrupaciones son torres", () => {
    expect(deducirContexto(["Torre 1", "Torre 2", "Torre 1"])).toEqual({ tieneAgrupaciones: true });
  });

  it("el valor por defecto de un conjunto de un solo bloque cuenta como edificio único", () => {
    // `DEFAULT_TOWER` en la aplicación es «Principal», y es lo que llevan las
    // unidades de un conjunto que nunca configuró agrupaciones.
    expect(deducirContexto(["Principal"])).toEqual({ tieneAgrupaciones: false });
  });
});

describe("cuándo NO se afirma nada", () => {
  it("sin unidades no se sabe", () => {
    // Un conjunto recién dado de alta no es un edificio único: es un conjunto
    // del que no sabemos nada. Devolver `false` aquí callaría la pregunta del
    // alcance en el peor momento, que es cuando el conjunto aún se está armando.
    expect(deducirContexto([])).toEqual({});
  });

  it("unidades sin agrupación rellenada tampoco dicen nada", () => {
    expect(deducirContexto([null, undefined, "", "   "])).toEqual({});
  });

  it("una unidad sin agrupación no invalida a las que sí la tienen", () => {
    expect(deducirContexto([null, "Torre 1", "Torre 2"])).toEqual({ tieneAgrupaciones: true });
    expect(deducirContexto(["", "Principal"])).toEqual({ tieneAgrupaciones: false });
  });
});
