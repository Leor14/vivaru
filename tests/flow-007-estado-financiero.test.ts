import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { computeFundPosition } from "@/features/finanzas/use-ledger";
import { summarizePayables } from "@/features/finanzas/payables";
import { sumarSaldoInicial } from "@/features/finanzas/use-bank-accounts";
import {
  construirEstadoFinanciero,
  sumarCuentasPorCobrar,
  sumarDeudaAProveedores,
  type EntradaDelNucleo,
} from "@/lib/finanzas/nucleo-estado-financiero";

/**
 * `PRD-V-FLOW-007` entrega 1 — **el lado de `src/` del banco compartido.**
 *
 * El mismo fichero de casos lo corre `functions/tests/flow-007-nucleo-espejo.test.ts`
 * contra la copia del servidor. Los dos comparan **NÚMEROS**, que es lo que pide
 * `CA1`: comprobar que existe un import habría estado en verde durante R12 y R16.
 */

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
  fs.readFileSync(path.resolve("tests/fixtures/estado-financiero-golden.json"), "utf8"),
) as {
  casos: Caso[];
  cuentasPorCobrar: { nombre: string; cargos: { balance?: number; status?: string }[]; esperado: number }[];
  deudaAProveedores: { nombre: string; egresos: { amount?: number; status?: string }[]; esperado: number }[];
};

function ejecutar(caso: Caso) {
  return construirEstadoFinanciero({
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
  });
}

describe("CA1 · el núcleo de `src/` da los números escritos a mano en el banco", () => {
  // Sin esta comprobación, un fichero de casos vacío o mal leído dejaría todo el
  // `it.each` sin iteraciones: cero pruebas y verde. Es la misma trampa que ya
  // cazó el espejo del catálogo de avisos.
  it("el banco de casos tiene contenido", () => {
    expect(GOLDEN.casos.length).toBeGreaterThanOrEqual(8);
  });

  it.each(GOLDEN.casos.map((c) => [c.nombre, c] as const))("%s", (_nombre, caso) => {
    const r = ejecutar(caso) as unknown as Record<string, unknown>;
    for (const [clave, valor] of Object.entries(caso.esperado)) {
      // `null` en el JSON representa `undefined`: JSON no tiene undefined, y la
      // diferencia entre «no hay saldo» y «el saldo es cero» es justo lo que
      // este banco vigila.
      expect(r[clave], `${caso.nombre} · ${clave}`).toEqual(valor === null ? undefined : valor);
    }
  });
});

describe("CA8 · las dos partidas nuevas, con sus filtros", () => {
  it.each(GOLDEN.cuentasPorCobrar.map((c) => [c.nombre, c] as const))(
    "cuentas por cobrar: %s",
    (_n, caso) => expect(sumarCuentasPorCobrar(caso.cargos)).toBe(caso.esperado),
  );

  it.each(GOLDEN.deudaAProveedores.map((c) => [c.nombre, c] as const))(
    "deuda a proveedores: %s",
    (_n, caso) => expect(sumarDeudaAProveedores(caso.egresos)).toBe(caso.esperado),
  );

  /**
   * **La tarjeta de Cartera y el informe dicen la MISMA cifra.**
   *
   * `summarizePayables` calculaba su `totalPayable` con un bucle propio hasta
   * esta entrega. Los dos coincidían, y esa es exactamente la situación en la
   * que nació R12: dos definiciones que hoy coinciden y mañana no. Ahora una
   * llama a la otra, y esto lo vigila.
   */
  it("`summarizePayables` no tiene una definición propia de la deuda", () => {
    const egresos = GOLDEN.deudaAProveedores[0].egresos.map((e, i) => ({
      id: `e${i}`,
      tenantId: "t",
      category: "proveedores" as const,
      description: "",
      amount: e.amount ?? 0,
      issueDate: "2026-09-01",
      status: e.status as "registrado" | "pagado" | "anulado",
    }));
    expect(summarizePayables(egresos, { asOf: "2026-09-03" }).totalPayable).toBe(
      sumarDeudaAProveedores(egresos),
    );
  });
});

describe("CA9 · el aviso de «Fondo insuficiente» — la regresión del defecto vivo", () => {
  /**
   * La condición de la pantalla es `fundPosition.balance < 0` **y** que el saldo
   * inicial exista. Aquí se ejercita la aritmética que la alimenta; la guarda de
   * existencia vive en la página y se comprueba abajo, sobre su texto.
   */
  const mesEnNegativo = [
    { id: "e1", tenantId: "t", type: "egreso" as const, concept: "x", amount: 500, date: "2026-09-01" },
  ];

  it("con saldo inicial 10.000 y un mes de −500, el fondo NO es negativo", () => {
    const pos = computeFundPosition(mesEnNegativo, 0, 10_000);
    expect(pos.balance).toBe(9_500);
    expect(pos.balance < 0).toBe(false);
  });

  it("con saldo inicial 0 y el mismo mes, SÍ lo es", () => {
    const pos = computeFundPosition(mesEnNegativo, 0, 0);
    expect(pos.balance).toBe(-500);
    expect(pos.balance < 0).toBe(true);
  });

  /**
   * **El defecto medido, en su forma exacta.** Santa María tiene 5.000.000
   * registrados; con el `0` literal que pasaban los tres consumidores, cualquier
   * mes en negativo disparaba «evita registrar nuevos egresos».
   */
  it("Santa María, con 5.000.000 en el banco, no recibe el aviso", () => {
    const conSaldo = computeFundPosition(mesEnNegativo, 0, 5_000_000);
    const comoAntes = computeFundPosition(mesEnNegativo, 0, 0);
    expect(conSaldo.balance).toBe(4_999_500);
    expect(comoAntes.balance).toBeLessThan(0);
  });

  /**
   * **La guarda de la pantalla, sobre el fichero.** Es de texto porque la página
   * es un componente con hooks de Firestore y no se monta en este banco; lo que
   * hay que impedir es que alguien devuelva la condición a `fundPosition.balance
   * < 0` a secas, que es como estaba y como volvería el aviso falso.
   */
  it("la página condiciona el aviso a que HAYA saldo registrado", () => {
    const pagina = fs.readFileSync(
      path.resolve("src/app/(admin)/admin/finanzas/page.tsx"),
      "utf8",
    );
    expect(pagina).toContain("haySaldoInicial && fundPosition.balance < 0");
    // Y que ningún consumidor haya vuelto al cero literal.
    expect(pagina).not.toContain("buildFinancialStatement(entries, cuotaParaEstado, 0,");
    expect(pagina).toContain("computeFundPosition(entries, cuotaIncome, saldoInicial)");
  });

  it("y el informe del consejo tampoco pasa un cero literal", () => {
    const informe = fs.readFileSync(
      path.resolve("src/features/reports/use-committee-report.ts"),
      "utf8",
    );
    expect(informe).toContain("computeFundPosition(ledger, cuotaIncomeAllTime, saldoInicial)");
    expect(informe).toContain("openingBalance: statement.openingBalance");
  });
});

describe("CA4 · el saldo del conjunto distingue «no registrado» de «cero»", () => {
  it("sin ningún documento de saldo, es `undefined`", () => {
    expect(sumarSaldoInicial([])).toBeUndefined();
  });

  it("un documento con cero SÍ es un saldo registrado", () => {
    expect(sumarSaldoInicial([{ openingBalance: 0 }])).toBe(0);
  });

  it("suma todas las cuentas, y las que no traen número no cuentan como registro", () => {
    expect(sumarSaldoInicial([{ openingBalance: 85_000 }, { openingBalance: 15_000 }])).toBe(100_000);
    expect(sumarSaldoInicial([{}, {}])).toBeUndefined();
    expect(sumarSaldoInicial([{}, { openingBalance: 42 }])).toBe(42);
  });
});
