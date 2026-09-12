/**
 * `PRD-V-FIX-001` entrega 1.1 — la zona en la que VIVE un conjunto, sacada de su país.
 *
 * Una hora de reserva («2026-09-21», «08:30») es hora de pared del conjunto y solo
 * tiene una lectura correcta: la de su zona. Cloud Functions corre en UTC, y leerla
 * ahí la adelanta cinco o seis horas. Hasta el 12 sep 2026 el servidor lo hacía: la
 * reserva de Santa María de las 08:30 guardó 08:30Z, y la antelación rechazaba
 * reservas del mismo día que empezaban dentro de ~5,5 h (6,5 en México).
 *
 * **Decisión de David (12 sep 2026): la zona sale del país, y solo en reservas.** El
 * «vencido» de la cartera sigue en UTC hasta que él decida (`docs/pendientes.md`).
 * México tiene varias zonas: se usa la de la capital, y un conjunto sin país cae ahí.
 */
export function zonaDelConjunto(country: unknown): string {
  if (country === "CO") return "America/Bogota";
  if (country === "EC") return "America/Guayaquil";
  return "America/Mexico_City";
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^(\d{1,2}):(\d{2})/;

/** Minutos que la zona va por delante de UTC en ese instante (negativos en América). */
function desfaseEnMinutos(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const parte = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  const comoUtc = Date.UTC(parte("year"), parte("month") - 1, parte("day"), parte("hour"), parte("minute"), parte("second"));
  return Math.round((comoUtc - instante.getTime()) / 60_000);
}

/**
 * El instante de una hora de pared del conjunto, o `null` si esa fecha u hora no
 * existen. Dos pasadas por si el desfase cambia ese mismo día (horario de verano);
 * en Colombia, Ecuador y el centro de México hoy no lo hay.
 */
export function instanteEnZona(fecha: string, hora: string, zona: string): Date | null {
  const f = FECHA.exec(fecha?.trim() ?? "");
  const h = HORA.exec(hora?.trim() ?? "");
  if (!f || !h) return null;
  const [anio, mes, dia, horas, minutos] = [Number(f[1]), Number(f[2]), Number(f[3]), Number(h[1]), Number(h[2])];
  if (mes < 1 || mes > 12 || horas > 23 || minutos > 59) return null;

  const pared = Date.UTC(anio, mes - 1, dia, horas, minutos);
  const comprobacion = new Date(pared);
  // `Date.UTC` desborda en silencio: el 30 de febrero sería el 2 de marzo.
  if (comprobacion.getUTCDate() !== dia || comprobacion.getUTCMonth() !== mes - 1) return null;

  const primera = pared - desfaseEnMinutos(new Date(pared), zona) * 60_000;
  return new Date(pared - desfaseEnMinutos(new Date(primera), zona) * 60_000);
}

/** Día de la semana (0 = domingo) de una fecha `YYYY-MM-DD`, sin pasar por ninguna zona. */
export function diaDeLaSemana(fecha: string): number | null {
  const f = FECHA.exec(fecha?.trim() ?? "");
  if (!f) return null;
  return new Date(Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]))).getUTCDay();
}
