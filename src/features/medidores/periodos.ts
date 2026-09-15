/**
 * `PRD-V-FEAT-008` · qué período enseña la pantalla de lecturas al abrirse.
 *
 * **Abre en el mes en curso, salvo que esté vacío.** La ronda de lecturas se hace a fin de mes, así
 * que durante casi todo el mes el período actual no tiene ninguna: la pantalla abría con todas las
 * unidades en blanco y los totales en cero, y parecía que no había datos, con meses enteros
 * registrados detrás del selector. Lo vio David en la demo de Lomas el 15 sep 2026. Si el mes en
 * curso está vacío, se abre el último con lecturas, se dice por qué, y un botón vuelve al actual.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** El mes anterior de un período «AAAA-MM». Con texto y no con `Date`: `setMonth` se desborda un 31. */
export function mesAnterior(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

/** «2026-08» → «agosto de 2026». */
export function nombreDelPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return `${MESES[mes - 1] ?? periodo} de ${anio}`;
}

/**
 * El último período con lecturas ANTERIOR a `desde`, mirando hacia atrás mes a mes y como mucho
 * `maxMeses`. `hayLecturas` es una consulta por período —la misma forma que la pantalla, sin
 * `orderBy` y sin índice compuesto—: se pregunta de uno en uno y se para en el primero que tenga.
 */
export async function ultimoPeriodoConLecturas(
  hayLecturas: (periodo: string) => Promise<boolean>,
  desde: string,
  maxMeses = 12,
): Promise<string | null> {
  let periodo = desde;
  for (let i = 0; i < maxMeses; i += 1) {
    periodo = mesAnterior(periodo);
    if (await hayLecturas(periodo)) return periodo;
  }
  return null;
}
