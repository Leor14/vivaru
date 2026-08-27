/**
 * `PRD-V-FEAT-004` / `PRD-V-FLOW-003` — el estado de cuenta, ESPEJO DEL SERVIDOR.
 *
 * **Está duplicado a propósito y no hay alternativa.** `src/` no puede importar de `functions/` ni
 * al revés —lo prohíbe `CLAUDE.md` porque App Hosting hace `npm ci` solo en la raíz y romperlo
 * tumba el `next build`—. El front lo necesita para pintar la pantalla; el servidor, para armar el
 * PDF que viaja adjunto en el correo de cobranza.
 *
 * **Y como está duplicado, tiene guardián.** `functions/tests/estado-de-cuenta-espejo.test.ts`
 * compara los dos como TEXTO y enrojece si divergen. Sin él, el precedente ya está escrito en este
 * repositorio: el catálogo de avisos llevaba desde siempre una cabecera diciendo «las cadenas
 * deben mantenerse en sincronía» y **nada lo comprobaba** — era una frase, no una guarda. Aquí el
 * síntoma sería el peor posible: la pantalla enseñando un saldo y el papel adjunto diciendo otro.
 *
 * **El núcleo es copia literal de `src/features/billing/estado-de-cuenta.ts`**, salvo el tipo del
 * cargo, que allí viene de `@/types/domain` y aquí es estructural. Si hay que cambiar la lógica,
 * se cambia en los DOS y el guardián lo exige.
 */

/** Lo que este cálculo necesita de un cargo. Estructural: el servidor no importa `@/types`. */
export type CargoDeCartera = {
  id: string;
  period: string;
  concept?: string;
  amount?: number;
  paymentAmount?: number;
  advanceAppliedAmount?: number;
  balance?: number;
  status?: string;
  dueDate?: string;
  createdAt?: unknown;
};

/** Cómo se fechó la línea. */
export type FuenteDeFecha = "dueDate" | "period" | "createdAt";

export type LineaEstadoDeCuenta = {
  statementId: string;
  fecha: string;
  fuenteDeFecha: FuenteDeFecha;
  periodo: string;
  concepto: string;
  cargo: number;
  pagado: number;
  saldo: number;
  saldoAcumulado: number;
};

export type EstadoDeCuenta = {
  lineas: LineaEstadoDeCuenta[];
  totalCargado: number;
  totalPagado: number;
  saldoFinal: number;
  anuladosExcluidos: number;
  alDia: boolean;
};

// ─── NÚCLEO ESPEJADO · no editar sin editar también el del front ──────────────
function cubierto(c: CargoDeCartera): number {
  return (c.paymentAmount ?? 0) + (c.advanceAppliedAmount ?? 0);
}

function fechaDe(c: CargoDeCartera): { fecha: string; fuente: FuenteDeFecha } {
  if (c.dueDate) return { fecha: c.dueDate, fuente: "dueDate" };
  if (c.period) return { fecha: c.period, fuente: "period" };
  return { fecha: String(c.createdAt ?? "").slice(0, 10), fuente: "createdAt" };
}

export function construirEstadoDeCuenta(
  cargos: CargoDeCartera[],
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
}// ─── FIN DEL NÚCLEO ESPEJADO ─────────────────────────────────────────────────
