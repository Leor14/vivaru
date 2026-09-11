import { toDateInputValue } from "@/utils/datetimeValidation";

/**
 * Las fechas contra las que el Panel de Control cuenta «hoy», «ayer» y los meses.
 *
 * Son del calendario LOCAL desde el 10 de septiembre de 2026 (`d91e1af`), pero vivían calculadas en
 * línea dentro de la página y **ninguna prueba las alcanzaba**: el guardián de `tests/hoy-local.test.ts`
 * busca `new Date().toISOString()`, y aquí el día sale de una variable.
 *
 * **Los meses anteriores se cuentan desde el día 1 del mes en curso.** Se calculaban con
 * `setMonth(mes - 1)` sobre la fecha de HOY, y un 31 eso se desborda: el 31 de marzo pasaba al «31 de
 * febrero» —el 3 de marzo— y el panel llamaba «mes pasado» al mes en curso. El gemelo que ya lo hacía
 * bien es `InformeMensualCard`, que construye el mes anterior con el día 1.
 */
export function mesLocal(fecha: Date): string {
  return toDateInputValue(fecha).slice(0, 7);
}

export function ventanasDelPanel(ahora: Date = new Date()) {
  const mesAtras = (n: number) => mesLocal(new Date(ahora.getFullYear(), ahora.getMonth() - n, 1));
  return {
    hoy: toDateInputValue(ahora),
    ayer: toDateInputValue(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)),
    mes: mesLocal(ahora),
    mesAnterior: mesAtras(1),
    mesAntesDelAnterior: mesAtras(2),
  };
}
