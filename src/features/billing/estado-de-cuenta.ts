import type { BillingStatement } from "@/types/domain";

/**
 * `PRD-V-FEAT-004` — el estado de cuenta de la unidad.
 *
 * **Función pura, sin Firestore**: recibe los cargos de UNA unidad y devuelve el
 * libro corrido. Se prueba entera sin emulador, y es donde vive R2 —la regla que
 * la ficha llama «la que hace confiable el documento»—.
 *
 * ---
 *
 * **DOS DECISIONES QUE SALEN DE MEDIR LOS DATOS, no de leer la ficha.**
 *
 * **1 · Se ordena por `period`, NO por `dueDate`, y §11.3 pedía lo contrario.**
 * Vale para las DOS cosas, y conviene decirlo separado porque durante un tiempo
 * solo valió para una:
 *
 * *La consulta* no puede usar `orderBy dueDate`. El campo es opcional en
 * `BillingStatement` y **falta en el 27% de los cargos de producción** (60 de
 * 221); un `orderBy` descarta los documentos que no lo traen, así que perdería
 * uno de cada cuatro movimientos **y rompería R2 en silencio**: el saldo final
 * dejaría de coincidir con la cartera. No daría error, daría un número más
 * pequeño. Es el defecto que el 24 de agosto de 2026 dejó al residente viendo
 * «Sin documentos» teniendo ocho.
 *
 * *El `sort` en memoria* tampoco, y esto se arregló el 26 de agosto de 2026
 * **después de verlo en producción**. Ordenaba por `fechaDe()`, que prefiere
 * `dueDate`, y entonces la cabecera decía una cosa y el código hacía otra. Dos
 * consecuencias, las dos visibles en un papel que se entrega:
 *
 *   · **Un cargo de marzo que vence el 28 de mayo se listaba detrás de mayo.**
 *     En `tenant-santa-maria`, T2-503 salía `05 · 03 · 04 · 06`, con la columna
 *     de saldo acumulado al lado. El total era exacto; el orden, ilegible.
 *   · **Comparaba cadenas de distinta longitud** —`"2026-05"` contra
 *     `"2026-05-28"`—, así que un cargo sin vencimiento caía SIEMPRE antes que
 *     uno fechado del mismo mes. Eso no lo decidió nadie: era un efecto de
 *     comparar dos cosas distintas.
 *
 * `period` está en el 100% de los cargos y con formato `YYYY-MM`, medido en los
 * dos ambientes (221 y 171). `dueDate` se sigue enseñando y sigue desempatando
 * dentro del mismo mes; lo que ya no hace es mandar.
 *
 * **2 · Cada cargo es UNA línea con su pago dentro, no dos movimientos.** La
 * ficha (R1) habla de «saldo acumulado tras cada movimiento», que supone poder
 * ordenar cargos y pagos juntos en el tiempo. **No se puede: no hay registro
 * completo y fechado de los pagos.** De 90 cargos con `paymentAmount > 0` en
 * producción, **solo 50 traen `lastPaymentAt`**; `paymentVouchers` son 4 y
 * `paymentOperations` 5, porque ambos nacieron con `FIN-001` el 20 de agosto.
 * Y `ledgerEntries` **no tiene `unitId`** —cero de 93—, así que ni siquiera se
 * puede cruzar barato.
 *
 * Poner los 40 pagos sin fecha en una posición cualquiera del libro sería
 * inventar información dentro de un documento que se entrega a terceros. Con una
 * línea por cargo, el saldo acumulado sigue siendo cierto y nada se inventa.
 */

/** Cómo se fechó la línea. Se expone porque el PDF lo dice. **No manda en el
 *  orden** —eso es `period`—, pero sí desempata dentro de un mismo mes. */
export type FuenteDeFecha = "dueDate" | "period" | "createdAt";

export type LineaEstadoDeCuenta = {
  statementId: string;
  /** `YYYY-MM-DD` cuando hay `dueDate`; `YYYY-MM` en otro caso. */
  fecha: string;
  fuenteDeFecha: FuenteDeFecha;
  periodo: string;
  concepto: string;
  /** Lo que se cobró. */
  cargo: number;
  /** Lo cubierto: pago directo **más** anticipo cruzado. */
  pagado: number;
  /** Lo que queda de ESTE cargo. */
  saldo: number;
  /** Saldo de la unidad tras este movimiento. */
  saldoAcumulado: number;
};

export type EstadoDeCuenta = {
  lineas: LineaEstadoDeCuenta[];
  totalCargado: number;
  totalPagado: number;
  /** R2 · coincide **siempre** con la suma de `balance` de los cargos vigentes. */
  saldoFinal: number;
  /** Cuántos cargos anulados se dejaron fuera. Se enseña: callarlo sería raro. */
  anuladosExcluidos: number;
  /** R3 · la condición del paz y salvo, calculada aquí para que no se duplique. */
  alDia: boolean;
};

/**
 * `paymentAmount` y `advanceAppliedAmount` van **aparte** desde `FLOW-002` —para
 * que el anticipo no cuente dos veces como ingreso— pero desde la unidad son lo
 * mismo: dinero que ya no debe. Sumarlos aquí es lo correcto **y** es lo que hace
 * que el estado de cuenta cuadre con `balance`, que también los resta a los dos.
 */
function cubierto(c: BillingStatement): number {
  return (c.paymentAmount ?? 0) + (c.advanceAppliedAmount ?? 0);
}

function fechaDe(c: BillingStatement): { fecha: string; fuente: FuenteDeFecha } {
  if (c.dueDate) return { fecha: c.dueDate, fuente: "dueDate" };
  if (c.period) return { fecha: c.period, fuente: "period" };
  return { fecha: String(c.createdAt ?? "").slice(0, 10), fuente: "createdAt" };
}

export function construirEstadoDeCuenta(
  cargos: BillingStatement[],
  opts: { desde?: string; hasta?: string } = {},
): EstadoDeCuenta {
  // R5 · un cargo anulado no cuenta ni en el libro ni en el saldo. Va ANTES del
  // filtro de fechas para poder contarlos todos, no solo los del rango.
  const vigentes = cargos.filter((c) => c.status !== "cancelled");
  const anuladosExcluidos = cargos.length - vigentes.length;

  // El rango se compara contra `period` (`YYYY-MM`) recortando los límites al
  // mismo largo: comparar `2026-03` con `2026-03-15` como cadenas dejaría fuera
  // el mes entero de un extremo.
  const enRango = vigentes.filter((c) => {
    const { fecha } = fechaDe(c);
    if (opts.desde && fecha < opts.desde.slice(0, fecha.length)) return false;
    if (opts.hasta && fecha > opts.hasta.slice(0, fecha.length)) return false;
    return true;
  });

  // **Orden: `period` primero, y a igualdad la fecha y el id.** El desempate por
  // id no es cosmético: sin él, dos cargos del mismo mes salen en el orden que
  // devuelva Firestore, que no es el mismo entre cargas — y un documento que se
  // imprime no puede cambiar de orden entre dos descargas.
  const ordenados = [...enRango].sort(
    (a, b) =>
      String(a.period).localeCompare(String(b.period)) ||
      fechaDe(a).fecha.localeCompare(fechaDe(b).fecha) ||
      String(a.id).localeCompare(String(b.id)),
  );

  let acumulado = 0;
  const lineas: LineaEstadoDeCuenta[] = ordenados.map((c) => {
    const cargo = c.amount ?? 0;
    const pagado = cubierto(c);
    const saldo = c.balance ?? 0;
    acumulado += saldo;
    const { fecha, fuente } = fechaDe(c);
    return {
      statementId: c.id,
      fecha,
      fuenteDeFecha: fuente,
      periodo: c.period,
      concepto: c.concept ?? "administracion",
      cargo,
      pagado,
      saldo,
      saldoAcumulado: acumulado,
    };
  });

  return {
    lineas,
    totalCargado: ordenados.reduce((a, c) => a + (c.amount ?? 0), 0),
    totalPagado: ordenados.reduce((a, c) => a + cubierto(c), 0),
    // **R2 por construcción, y no por coincidencia.** El saldo final ES la suma
    // de los `balance`, que es la misma cifra que la cartera enseña. Calcularlo
    // como «cargado − pagado» daría lo mismo hoy y podría divergir mañana: son
    // dos definiciones distintas del mismo número, y una de ellas es la que el
    // resto del producto ya usa.
    saldoFinal: acumulado,
    anuladosExcluidos,
    alDia: acumulado <= 0,
  };
}

/**
 * **El saldo a favor NO se calcula aquí: ya existe.** `saldoAFavor` vive en
 * `src/features/finanzas/use-advances.ts` desde `FLOW-002` y es la que usa la
 * tarjeta de anticipos del residente. Se escribió aquí una segunda versión antes
 * de buscarla, y además **estaba mal**: suponía `status === "active"` y
 * `remainingAmount`, y los campos reales son `status === "open"` y `remaining`
 * — habría devuelto cero para todos los anticipos vivos, dentro de un documento
 * que R4 obliga a nombrarlos.
 */
