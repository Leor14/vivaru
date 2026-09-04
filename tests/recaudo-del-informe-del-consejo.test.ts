import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeCollectionSummary,
  statementCollectedAmount,
} from "../src/features/billing/collection";
import { repartirRecaudo } from "../src/lib/finanzas/conceptos-de-cargo";

/**
 * **El informe del consejo tiraba los pagos PARCIALES.**
 *
 * `/admin/reports` y `/admin/finanzas` enseñaban «Saldo de fondos» distinto para
 * el mismo conjunto el mismo día —**−675.000 contra 725.000** en Santa María—
 * llamando las dos a la misma `computeFundPosition`. Lo que difería era el
 * `cuotaIncome`: el informe hacía `billing.filter(b => b.status === "paid")`, y
 * **un cargo con pago parcial no es `paid`**, así que lo descartaba entero.
 *
 * Medido en producción el 4 de septiembre de 2026: **10 cargos parciales por
 * $4.800.000**, y no en un conjunto sino en **tres** —Queretarock, Qintilab y
 * Santa María—. La nota que describía el defecto solo conocía el de Santa María.
 *
 * **La fórmula única ya existía**, y este mismo fichero ya la importaba para
 * «facturado»: `src/features/billing/collection.ts`, cuya cabecera dice que
 * Dashboard, Cartera y **el Reporte de Comité** tenían tres fórmulas distintas y
 * se unificaron ahí. El «recaudado» del informe se quedó fuera de esa
 * unificación. Coincide además con el informe EMITIDO
 * (`functions/src/informe-mensual.ts`), que ya suma `max(paymentAmount, 0)`.
 */

const RUTA = path.resolve("src/features/reports/use-committee-report.ts");

/** Fuera comentarios y espacios: un comentario no puede satisfacer una prueba. */
function esqueleto(cuerpo: string): string {
  return cuerpo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

describe("la fórmula única cuenta el pago parcial, y es la que debe usarse", () => {
  it("un cargo a medio pagar aporta lo pagado, no cero", () => {
    expect(statementCollectedAmount({ amount: 100_000, balance: 30_000, paymentAmount: 70_000 })).toBe(70_000);
  });

  it("y su estado NO interviene: `pending` u `overdue` cuentan igual", () => {
    const parcial = { amount: 100_000, balance: 30_000, paymentAmount: 70_000 };
    expect(computeCollectionSummary([parcial]).collected).toBe(70_000);
  });

  /**
   * **Consecuencia deliberada del arreglo, y hay que dejarla escrita.** En
   * producción hay **8 cargos `paid` con importe y SIN `paymentAmount`**
   * ($1.572.800, en Palmas y El Nogal), sembrados: `balance: 0`, sin `paidAt` y
   * **sin asiento en el libro**. El informe los contaba por un respaldo
   * `?? b.amount` que **ninguna de las otras tres fórmulas tiene** —ni
   * `/admin/finanzas`, ni la fórmula única, ni el informe emitido y firmado—.
   * Al unificar dejan de contarse, que es lo que hace que las cuatro coincidan.
   */
  it("un cargo `paid` sin `paymentAmount` aporta cero, como en las otras tres fórmulas", () => {
    expect(computeCollectionSummary([{ amount: 350_000, balance: 0 }]).collected).toBe(0);
  });

  it("un `paymentAmount` negativo no resta", () => {
    expect(statementCollectedAmount({ amount: 100_000, paymentAmount: -50_000 })).toBe(0);
  });
});

describe("`repartirRecaudo` — la que alimenta las dos pantallas", () => {
  it("reparte el pago PARCIAL por su concepto, sin mirar el estado", () => {
    const r = repartirRecaudo([
      { concept: "administracion", paymentAmount: 70_000 },
      { concept: "multa", paymentAmount: 30_000 },
    ]);
    expect(r.total).toBe(100_000);
    expect(r.porCategoria.get("alicuota")).toBe(70_000);
  });

  /**
   * **Esto es lo que unificar en la raíz vino a cerrar.** `repartirRecaudo`
   * sumaba `paymentAmount` a pelo, así que un negativo habría RESTADO aquí y
   * contado cero en `statementCollectedAmount` — dos cifras para el mismo dinero.
   * Hoy no hay ninguno en producción (medido, 4 sep 2026): el borde estaba
   * abierto y nadie lo habría visto venir.
   */
  it("un `paymentAmount` negativo no resta del total", () => {
    expect(repartirRecaudo([{ concept: "administracion", paymentAmount: -50_000 }]).total).toBe(0);
  });

  it("el total es exactamente la suma del mapa", () => {
    const r = repartirRecaudo([
      { concept: "administracion", paymentAmount: 70_000 },
      { concept: "multa", paymentAmount: 30_000 },
      { concept: "administracion", paymentAmount: 10_000 },
    ]);
    expect([...r.porCategoria.values()].reduce((a, b) => a + b, 0)).toBe(r.total);
  });
});

describe("el informe del consejo NO reimplementa el recaudo", () => {
  const cuerpo = esqueleto(fs.readFileSync(RUTA, "utf8"));

  /**
   * **El guardián que importa.** No basta con comprobar que llama a la función
   * buena: hay que comprobar que **la reimplementación ya no está**, o las dos
   * conviven y la rota sigue alimentando una cifra.
   */
  it("el respaldo `?? amount` desapareció — era la desviación", () => {
    expect(cuerpo).not.toContain("paymentAmount??b.amount??0");
  });

  it("no queda ningún filtro por `status === \"paid\"` sumando dinero", () => {
    expect(cuerpo).not.toContain('.filter((b)=>b.status==="paid").reduce');
  });

  it("las CUATRO cifras salen de la fórmula única", () => {
    // El total del período y su reparto, de una sola llamada.
    expect(cuerpo).toContain("constrecaudo=repartirRecaudo(billingInPeriod)");
    expect(cuerpo).toContain("consttotalCollected=recaudo.total");
    expect(cuerpo).toContain("constcuotaIncomeAllTime=computeCollectionSummary(billing).collected");
    // El del período anterior ya estaba calculado cinco líneas más arriba, con
    // la fórmula buena, y el fichero lo volvía a calcular con la rota.
    expect(cuerpo).toContain("buildFinancialStatement(prevLedger,recaudadoPrev)");
  });

  /**
   * **El cuarto sitio, que no estaba contado.** La nota del defecto hablaba de
   * una línea; el barrido encontró tres; y al mirar el fichero entero apareció
   * un cuarto: el reparto por categoría se construía a mano, con el mismo filtro
   * roto, **al lado de la función que devuelve ese mapa ya hecho**.
   */
  it("el reparto por categoría no se vuelve a construir a mano", () => {
    expect(cuerpo).not.toContain("recaudoPorCategoria.set");
  });
});
