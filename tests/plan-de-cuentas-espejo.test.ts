import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIA_POR_CONCEPTO,
  CODIGO_POR_CATEGORIA_DE_EGRESO,
  CODIGO_POR_CONCEPTO,
  categoriaDeConcepto,
  codigoDeCategoriaDeEgreso,
  codigoDeConcepto,
} from "@/lib/finanzas/conceptos-de-cargo";

/**
 * El espejo del mapa concepto→cuenta, vigilado.
 *
 * `src/lib/finanzas/conceptos-de-cargo.ts` copia a mano lo que decide
 * `functions/src/plan-de-cuentas.ts`, porque `src/` no puede importar de
 * `functions/` sin romper el build de App Hosting.
 *
 * **Copiar a mano es exactamente el error que este repositorio ya cometió tres
 * veces**: el catálogo de banderas repartido en cuatro sitios que las dejaba
 * imposibles de encender, y la exclusión del doble conteo copiada en tres
 * ficheros de los que el inventario solo encontró dos. En los tres casos el
 * daño no fue la copia: fue que **nada avisaba cuando una se quedaba atrás**.
 *
 * Así que esta prueba LEE el fichero de `functions/` como texto y lo compara.
 * Leer no es importar —no entra en el grafo de módulos del build—, así que la
 * prohibición de CLAUDE.md no aplica. Si alguien cambia un lado y no el otro,
 * esto se pone rojo con el concepto exacto que divergió.
 */

const FUENTE = path.resolve("functions/src/plan-de-cuentas.ts");

function leerFuente(): string {
  return fs.readFileSync(FUENTE, "utf8");
}

/** Extrae un objeto literal `const NOMBRE: ... = { ... };` como pares clave→valor. */
function extraerMapa(texto: string, nombre: string): Record<string, string> {
  const inicio = texto.indexOf(`export const ${nombre}`);
  if (inicio === -1) throw new Error(`No encuentro ${nombre} en ${FUENTE}`);
  const abre = texto.indexOf("{", inicio);
  const cierra = texto.indexOf("};", abre);
  const cuerpo = texto.slice(abre + 1, cierra);
  const mapa: Record<string, string> = {};
  for (const linea of cuerpo.split("\n")) {
    const m = linea.match(/^\s*(\w+)\s*:\s*(?:"([^"]+)"|(\w+))\s*,/);
    if (m) mapa[m[1]] = m[2] ?? m[3];
  }
  return mapa;
}

/** Extrae la semilla como código→systemKey. */
function extraerSemilla(texto: string): Record<string, string> {
  const inicio = texto.indexOf("export const SEMILLA_PLAN_DE_CUENTAS");
  if (inicio === -1) throw new Error("No encuentro la semilla");
  const cierra = texto.indexOf("];", inicio);
  const cuerpo = texto.slice(inicio, cierra);
  const mapa: Record<string, string> = {};
  for (const m of cuerpo.matchAll(/code:\s*"([^"]+)"[^}]*?systemKey:\s*"([^"]+)"/g)) {
    mapa[m[1]] = m[2];
  }
  return mapa;
}

/** Extrae la semilla como systemKey→{code,type}, para el lado de los egresos. */
function extraerSemillaPorKey(texto: string): Record<string, { code: string; type: string }> {
  const inicio = texto.indexOf("export const SEMILLA_PLAN_DE_CUENTAS");
  if (inicio === -1) throw new Error("No encuentro la semilla");
  const cuerpo = texto.slice(inicio, texto.indexOf("];", inicio));
  const mapa: Record<string, { code: string; type: string }> = {};
  for (const m of cuerpo.matchAll(
    /code:\s*"([^"]+)"[^}]*?type:\s*"([^"]+)"[^}]*?systemKey:\s*"([^"]+)"/g,
  )) {
    mapa[m[3]] = { code: m[1], type: m[2] };
  }
  return mapa;
}

describe("el espejo de src/ no puede divergir de functions/", () => {
  it("el fichero de origen sigue donde dice el comentario", () => {
    expect(fs.existsSync(FUENTE), `${FUENTE} no existe — ¿se movió?`).toBe(true);
  });

  it("los dos lados mandan el mismo concepto a la misma cuenta", () => {
    const texto = leerFuente();
    const conceptoACodigo = extraerMapa(texto, "CUENTA_POR_CONCEPTO");
    const codigoAKey = extraerSemilla(texto);

    // El original resuelve `otro` a la constante CUENTA_OTROS_INGRESOS, no a un
    // literal, así que se resuelve aquí igual que lo hace el módulo.
    const otrosIngresos = texto.match(/export const CUENTA_OTROS_INGRESOS = "([^"]+)"/)?.[1];
    expect(otrosIngresos, "no encuentro CUENTA_OTROS_INGRESOS").toBeDefined();

    const conceptos = Object.keys(CATEGORIA_POR_CONCEPTO);
    expect(Object.keys(conceptoACodigo).sort()).toEqual(conceptos.sort());

    for (const concepto of conceptos) {
      const bruto = conceptoACodigo[concepto];
      const codigo = bruto === "CUENTA_OTROS_INGRESOS" ? otrosIngresos! : bruto;
      const esperada = codigoAKey[codigo];
      expect(
        CATEGORIA_POR_CONCEPTO[concepto as keyof typeof CATEGORIA_POR_CONCEPTO],
        `«${concepto}» diverge: functions dice ${codigo} (${esperada}) y src dice ${CATEGORIA_POR_CONCEPTO[concepto as keyof typeof CATEGORIA_POR_CONCEPTO]}`,
      ).toBe(esperada);
    }
  });

  // Las dos resoluciones que no se deducen del nombre, fijadas aquí también:
  // si alguien "simplifica" el espejo resolviendo por igualdad de nombre, esto
  // se pone rojo antes de que el recaudo se vaya a una cuenta de egreso.
  it("el cargo `administracion` va a la cuenta de INGRESO (CA12)", () => {
    expect(categoriaDeConcepto("administracion")).toBe("alicuota");
  });

  it("el cargo `otro` va a otros ingresos, no a la categoría de egreso `otros`", () => {
    expect(categoriaDeConcepto("otro")).toBe("otros_ingresos");
  });

  it("un cargo sin concepto es cuota de administración, que es el default del campo", () => {
    expect(categoriaDeConcepto(undefined)).toBe("alicuota");
    expect(categoriaDeConcepto(null)).toBe("alicuota");
  });

  it("un concepto desconocido cae en otros ingresos, nunca se pierde", () => {
    expect(categoriaDeConcepto("mudanza")).toBe("otros_ingresos");
  });

  // ── El espejo del CÓDIGO (§7.2, R9) ──────────────────────────────────────
  // `CATEGORIA_POR_CONCEPTO` ya estaba vigilado. El código es el que de verdad
  // agrupa los informes desde R9, así que necesita su propio guardián: los dos
  // se escriben a la vez y separarlos es la forma segura de que uno se atrase.

  it("los dos lados mandan el mismo concepto al mismo CÓDIGO de cuenta", () => {
    const texto = leerFuente();
    const conceptoACodigo = extraerMapa(texto, "CUENTA_POR_CONCEPTO");
    const otrosIngresos = texto.match(/export const CUENTA_OTROS_INGRESOS = "([^"]+)"/)?.[1];
    expect(otrosIngresos, "no encuentro CUENTA_OTROS_INGRESOS").toBeDefined();

    expect(Object.keys(CODIGO_POR_CONCEPTO).sort()).toEqual(Object.keys(conceptoACodigo).sort());

    for (const [concepto, bruto] of Object.entries(conceptoACodigo)) {
      const esperado = bruto === "CUENTA_OTROS_INGRESOS" ? otrosIngresos! : bruto;
      expect(
        CODIGO_POR_CONCEPTO[concepto as keyof typeof CODIGO_POR_CONCEPTO],
        `«${concepto}» diverge en el código: functions dice ${esperado}`,
      ).toBe(esperado);
    }
  });

  it("el código y la categoría de un mismo concepto apuntan a la MISMA cuenta", () => {
    const texto = leerFuente();
    const codigoAKey = extraerSemilla(texto);
    for (const concepto of Object.keys(CODIGO_POR_CONCEPTO)) {
      const codigo = codigoDeConcepto(concepto);
      expect(
        categoriaDeConcepto(concepto),
        `«${concepto}» escribe el código ${codigo} y una categoría que no es la suya`,
      ).toBe(codigoAKey[codigo]);
    }
  });

  it("cada categoría de egreso apunta a su cuenta de EGRESO en la semilla", () => {
    const porKey = extraerSemillaPorKey(leerFuente());
    for (const [categoria, codigo] of Object.entries(CODIGO_POR_CATEGORIA_DE_EGRESO)) {
      const enLaSemilla = porKey[categoria];
      expect(enLaSemilla, `la semilla no tiene cuenta para «${categoria}»`).toBeDefined();
      expect(enLaSemilla.type, `«${categoria}» apunta a una cuenta que no es de egreso`).toBe(
        "egreso",
      );
      expect(enLaSemilla.code, `«${categoria}» diverge`).toBe(codigo);
    }
  });

  // La trampa de R11 mirando al otro lado: la misma palabra, dos vocabularios.
  it("`administracion` es 1.1 como CARGO y 2.5 como EGRESO, y las dos son correctas", () => {
    expect(codigoDeConcepto("administracion")).toBe("1.1");
    expect(codigoDeCategoriaDeEgreso("administracion")).toBe("2.5");
  });

  it("una categoría de egreso desconocida cae en otros egresos, no en otros ingresos", () => {
    expect(codigoDeCategoriaDeEgreso("seguridad")).toBe("2.8");
    expect(codigoDeCategoriaDeEgreso(undefined)).toBe("2.8");
  });
});
