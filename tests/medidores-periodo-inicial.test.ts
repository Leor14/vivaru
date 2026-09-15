import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mesAnterior, nombreDelPeriodo, ultimoPeriodoConLecturas } from "../src/features/medidores/periodos";

/**
 * **La pantalla de lecturas no abre en un mes vacío si hay meses con lecturas.**
 *
 * La ronda se hace a fin de mes, así que durante casi todo el mes el período en curso no tiene
 * ninguna lectura. La pantalla abría ahí: todas las unidades en blanco y los totales en cero, con
 * meses enteros registrados detrás del selector. Lo vio David en la demo de Lomas el 15 sep 2026.
 */

const raiz = path.resolve(__dirname, "..");

describe("el período con el que abre la pantalla de lecturas", () => {
  it("el mes anterior cruza el año sin pasar por `Date`", () => {
    expect(mesAnterior("2026-09")).toBe("2026-08");
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2025-12")).toBe("2025-11");
    expect(mesAnterior("2026-10")).toBe("2026-09");
  });

  it("nombra el período como se lee", () => {
    expect(nombreDelPeriodo("2026-08")).toBe("agosto de 2026");
    expect(nombreDelPeriodo("2026-01")).toBe("enero de 2026");
    expect(nombreDelPeriodo("2025-12")).toBe("diciembre de 2025");
  });

  it("con el mes en curso vacío, encuentra el último con lecturas y se para ahí", async () => {
    const conLecturas = new Set(["2026-05", "2026-06", "2026-07", "2026-08"]);
    const preguntados: string[] = [];
    const ultimo = await ultimoPeriodoConLecturas(async (p) => {
      preguntados.push(p);
      return conLecturas.has(p);
    }, "2026-09");
    expect(ultimo).toBe("2026-08");
    expect(preguntados).toEqual(["2026-08"]);
  });

  it("salta los meses vacíos, también al cruzar el año", async () => {
    expect(await ultimoPeriodoConLecturas(async (p) => p === "2025-11", "2026-02")).toBe("2025-11");
  });

  it("no pregunta por el mes de partida: ese ya lo mira la pantalla", async () => {
    const preguntados: string[] = [];
    await ultimoPeriodoConLecturas(async (p) => {
      preguntados.push(p);
      return true;
    }, "2026-09");
    expect(preguntados).not.toContain("2026-09");
  });

  it("sin lecturas en los últimos doce meses, no hay a dónde ir", async () => {
    const preguntados: string[] = [];
    const ultimo = await ultimoPeriodoConLecturas(async (p) => {
      preguntados.push(p);
      return false;
    }, "2026-09");
    expect(ultimo).toBeNull();
    expect(preguntados).toHaveLength(12);
    expect(preguntados.at(-1)).toBe("2025-09");
  });

  it("la pantalla lo usa, y no mueve el período que la persona eligió a mano", () => {
    const fuente = fs.readFileSync(path.join(raiz, "src/app/(admin)/admin/finanzas/medidores/page.tsx"), "utf8");
    expect(fuente).toMatch(/ultimoPeriodoConLecturas\(/);
    expect(fuente).toMatch(/if \(!vigente \|\| eligioPeriodo\.current\) return;/);
    expect(fuente).toMatch(/eligioPeriodo\.current = true;\s*setAviso\(null\);\s*setPeriodo\(e\.target\.value\);/);
  });
});
