/**
 * **La lectura de un indicador porcentual: su cifra, su tono y LA VENTANA QUE MIDE.**
 *
 * Existe por un defecto que no estaba en ninguna fórmula. El «% recaudo» del Panel de Control
 * mide **un mes**; el de Cartera, **hasta doce períodos**. Misma aritmética —las funciones puras
 * de `features/billing/collection.ts`, que ningún cambio de aquí toca— y ninguno de los dos decía
 * cuál era su ventana. Medido el 30 de agosto de 2026 contra producción, **los siete conjuntos
 * divergían**: Palmas y Nogal marcaban 0,0% en el panel y 50,0% en Cartera, a un clic de
 * distancia. Dos cifras contradictorias del mismo concepto destruyen la confianza en las dos.
 *
 * **Por eso `ventana` es un parámetro obligatorio y no un adorno opcional.** No se puede construir
 * la lectura de un porcentaje sin declarar sobre qué se calculó; la única forma de saltárselo es
 * no usar esta función, y de eso se encarga el guardián de `tests/panel-ventanas.test.ts`.
 *
 * Y resuelve el segundo defecto de la misma pantalla: **«sin datos» dejaba de distinguirse de
 * «cero medido»**. Cuando no hay nada facturado, la tasa es 0 —correcto como número, falso como
 * afirmación— y se pintaba en rojo. Aquí un total vacío no produce porcentaje ni alarma.
 */

import { tonoPorPorcentaje, type TonoDeIndicador } from "./umbrales";

/** Lo que se enseña en lugar de un porcentaje cuando no hay nada que medir. */
export const SIN_DATOS = "—";

export type LecturaDePorcentaje = {
  /** La cifra grande. `SIN_DATOS` cuando el total es cero. */
  valor: string;
  tono: TonoDeIndicador;
  /** Qué mide, en palabras, para ponerlo debajo del rótulo. */
  ventana: string;
  /** `true` cuando no había nada que medir. El consumidor lo usa para el texto de apoyo. */
  sinDatos: boolean;
};

/**
 * Lectura de un indicador porcentual donde **más alto es mejor**.
 *
 * @param pct   El porcentaje ya calculado (sin redondear; aquí se decide la presentación).
 * @param total El denominador real. **Con `0` no hay porcentaje**, no hay tono de alarma y se
 *              dice explícitamente que no hay datos.
 * @param ventana El período que se midió, en palabras que quepan bajo el rótulo.
 */
export function lecturaDePorcentaje(pct: number, total: number, ventana: string): LecturaDePorcentaje {
  if (total === 0) {
    return { valor: SIN_DATOS, tono: "neutral", ventana, sinDatos: true };
  }
  return { valor: `${pct.toFixed(1)}%`, tono: tonoPorPorcentaje(pct, total), ventana, sinDatos: false };
}
