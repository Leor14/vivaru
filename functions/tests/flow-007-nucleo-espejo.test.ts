import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  construirEstadoFinanciero,
  sumarCuentasPorCobrar,
  sumarDeudaAProveedores,
  type EntradaDelNucleo,
} from "../src/nucleo-estado-financiero";

/**
 * `PRD-V-FLOW-007` `CA1` — **el lado del servidor del banco compartido.**
 *
 * ## Los dos guardianes, y por qué hacen falta LOS DOS
 *
 * `monthlyFinancialArchive` reimplementaba el resumen del mes en línea y **se
 * desvió dos veces con todas las suites en verde**: R12/R13 el 23 de agosto de
 * 2026 y R16 el 24. Las dos por la misma causa mecánica: nada comparaba las dos
 * versiones. Ahora hay una sola aritmética, copiada byte a byte, y:
 *
 *   1. **La identidad del fichero** garantiza que no puedan divergir NUNCA, ni
 *      en una rama que la aritmética no alcance.
 *   2. **Los números del banco** garantizan que la copia que corre en el
 *      servidor produce lo que dice producir. Sin esto, dos ficheros idénticos y
 *      ambos equivocados pasarían el primer guardián sin despeinarse.
 *
 * Y el fichero de casos se lee de `tests/` de la raíz. **Leerlo no es
 * importarlo**: no entra en el grafo de módulos, así que la prohibición de
 * CLAUDE.md no aplica — el mismo mecanismo que `notification-catalog-espejo`.
 */

const RUTA_PROPIA = path.resolve(__dirname, "../src/nucleo-estado-financiero.ts");
const RUTA_ESPEJO = path.resolve(__dirname, "../../src/lib/finanzas/nucleo-estado-financiero.ts");

describe("el núcleo del estado financiero es el MISMO fichero en los dos lados", () => {
  it("byte a byte, sin una coma de diferencia", () => {
    const propio = fs.readFileSync(RUTA_PROPIA, "utf8");
    const espejo = fs.readFileSync(RUTA_ESPEJO, "utf8");
    expect(
      propio,
      "el núcleo del estado financiero divergió entre functions/ y src/. NO se arregla " +
        "editando este fichero: se copia el de src/ encima, que es el que gobierna.",
    ).toBe(espejo);
  });

  /**
   * **La condición que hace posible la copia byte a byte.** En cuanto el núcleo
   * importe algo, los dos caminos dejan de poder ser iguales —el de `src/` usa
   * el alias `@/`— y el guardián de arriba se cae. Enrojecer aquí es más barato
   * que descubrirlo cuando la copia ya no compila en un lado.
   */
  it("y no importa nada, que es lo que lo permite", () => {
    const propio = fs.readFileSync(RUTA_PROPIA, "utf8");
    const importaciones = propio.match(/^\s*import\s/gm) ?? [];
    expect(importaciones, "el núcleo dejó de ser autocontenido").toHaveLength(0);
  });
});

type Caso = {
  nombre: string;
  entrada: {
    asientos: EntradaDelNucleo["asientos"];
    cuota: number;
    openingBalance?: number;
    pendingReceivables?: number;
    supplierDebt?: number;
    plan?: { codigoPorSystemKey: [string, string][]; nombrePorCodigo: [string, string][] };
  };
  esperado: Record<string, unknown>;
};

const GOLDEN = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../tests/fixtures/estado-financiero-golden.json"), "utf8"),
) as {
  casos: Caso[];
  cuentasPorCobrar: { nombre: string; cargos: { balance?: number; status?: string }[]; esperado: number }[];
  deudaAProveedores: { nombre: string; egresos: { amount?: number; status?: string }[]; esperado: number }[];
};

describe("CA1 · la copia del servidor da los MISMOS números que el banco", () => {
  it("el banco de casos tiene contenido", () => {
    expect(GOLDEN.casos.length).toBeGreaterThanOrEqual(8);
  });

  it.each(GOLDEN.casos.map((c) => [c.nombre, c] as const))("%s", (_nombre, caso) => {
    const r = construirEstadoFinanciero({
      asientos: caso.entrada.asientos,
      cuota: caso.entrada.cuota,
      openingBalance: caso.entrada.openingBalance,
      pendingReceivables: caso.entrada.pendingReceivables,
      supplierDebt: caso.entrada.supplierDebt,
      plan: caso.entrada.plan
        ? {
            codigoPorSystemKey: new Map(caso.entrada.plan.codigoPorSystemKey),
            nombrePorCodigo: new Map(caso.entrada.plan.nombrePorCodigo),
          }
        : undefined,
    }) as unknown as Record<string, unknown>;
    for (const [clave, valor] of Object.entries(caso.esperado)) {
      expect(r[clave], `${caso.nombre} · ${clave}`).toEqual(valor === null ? undefined : valor);
    }
  });

  it.each(GOLDEN.cuentasPorCobrar.map((c) => [c.nombre, c] as const))(
    "cuentas por cobrar: %s",
    (_n, caso) => expect(sumarCuentasPorCobrar(caso.cargos)).toBe(caso.esperado),
  );

  it.each(GOLDEN.deudaAProveedores.map((c) => [c.nombre, c] as const))(
    "deuda a proveedores: %s",
    (_n, caso) => expect(sumarDeudaAProveedores(caso.egresos)).toBe(caso.esperado),
  );
});

describe("`monthlyFinancialArchive` ya no reimplementa el resumen", () => {
  const INDEX = fs.readFileSync(path.resolve(__dirname, "../src/index.ts"), "utf8");

  /**
   * **El guardián de la causa, no del síntoma.** R12 y R16 no fueron dos
   * despistes: fueron la consecuencia de que este fichero tuviera su propia
   * aritmética. Si alguien la devuelve, esto enrojece antes de que la deriva
   * tenga tiempo de nacer.
   */
  it("el resumen del mes sale del núcleo", () => {
    expect(INDEX).toContain("const estado = construirEstadoFinanciero({");
    expect(INDEX).toContain("const ingresos = estado.totalIncome;");
    expect(INDEX).toContain("const egresos = estado.totalExpenses;");
  });

  it("y las dos sumas viejas ya no están escritas aquí", () => {
    expect(INDEX).not.toContain('const ingresos = recaudado + ingresosOtros;');
    expect(INDEX).not.toContain('monthLed.filter((e) => e.type === "egreso").reduce(');
  });

  /**
   * `CA17`. El bucle de conjuntos lleva un `try/catch` **por conjunto** desde
   * antes de esta ficha, y es lo que hace que un conjunto con datos rotos no
   * deje a los otros ocho sin informe. Las tres consultas nuevas del saldo van
   * DENTRO de ese `try`, así que un fallo leyendo `bankAccountBalances` de un
   * conjunto no puede abortar el archivo mensual entero.
   */
  it("CA17 · el fallo de un conjunto no aborta los demás", () => {
    const inicio = INDEX.indexOf("export const monthlyFinancialArchive");
    const fin = INDEX.indexOf("export const anonymizeExpiredVouchersDaily");
    expect(inicio).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(inicio);
    const cuerpo = INDEX.slice(inicio, fin);
    expect(cuerpo).toContain("catch (e) {");
    expect(cuerpo).toContain("[monthly-archive][${tenantId}]");
    // Y las lecturas nuevas están dentro del bloque protegido, no antes de él.
    const iTry = cuerpo.indexOf("try {");
    const iCatch = cuerpo.indexOf("catch (e) {");
    const iSaldos = cuerpo.indexOf('db.collection("bankAccountBalances")');
    expect(iSaldos).toBeGreaterThan(iTry);
    expect(iSaldos).toBeLessThan(iCatch);
  });

  /**
   * `R1`. Con la bandera apagada el archivo tiene que producir **exactamente lo
   * de hoy**. Las cuatro filas nuevas y las tres consultas cuelgan de
   * `informeAnclado`, y esto lo comprueba sobre el código.
   */
  it("R1 · con la bandera apagada no se lee ni se escribe nada nuevo", () => {
    const inicio = INDEX.indexOf("export const monthlyFinancialArchive");
    const fin = INDEX.indexOf("export const anonymizeExpiredVouchersDaily");
    const cuerpo = INDEX.slice(inicio, fin);
    expect(cuerpo).toContain('await isFeatureEnabled("producto-informe-mensual", tenantId)');
    expect(cuerpo).toContain("if (informeAnclado) {");
    // Las cuatro filas nuevas, las dos veces (Excel y PDF), tras la bandera.
    expect(cuerpo.match(/\.\.\.\(informeAnclado/g) ?? []).toHaveLength(2);
    expect(cuerpo.match(/"Deuda a proveedores"/g) ?? []).toHaveLength(2);
  });
});
