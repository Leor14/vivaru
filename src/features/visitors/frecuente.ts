import { toDateInputValue } from "@/utils/datetimeValidation";

/**
 * **El visitante frecuente y el personal del conjunto** (`L-08b` y `L-10`, lote «Análisis de la
 * plataforma», fase 7, 18 sep 2026).
 *
 * Un frecuente es un pase `larga_duracion` con vigencia `validFrom`–`validUntil`, y puede traer un
 * horario: qué días de la semana y en qué franja entra. Lo crean el residente (para su unidad) y la
 * administración (para una unidad o para el conjunto: el personal de aseo, jardinería…). **Es el
 * mismo objeto venga de quien venga**, y por eso las reglas de «¿le toca hoy?» y «¿está en su
 * franja?» viven aquí, una sola vez: la lista de hoy de la portería y la tarjeta las leen de este
 * fichero.
 *
 * **El horario AVISA, no bloquea.** Una regla de Firestore no sabe la hora local del conjunto, y un
 * bloqueo solo en el cliente sería decorativo: fuera de franja la portería ve «Fuera de horario» y
 * decide ella.
 */

/** 0 = domingo … 6 = sábado, como `Date.getDay()`. */
export type DiaDeLaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HorarioDeIngreso = {
  /** Días en que entra. Vacío o ausente = todos los días. */
  dias: DiaDeLaSemana[];
  /** Franja «HH:mm». Las dos o ninguna. */
  desde?: string;
  hasta?: string;
};

export const DIAS_DE_LA_SEMANA: Array<{ valor: DiaDeLaSemana; corto: string }> = [
  { valor: 1, corto: "Lun" },
  { valor: 2, corto: "Mar" },
  { valor: 3, corto: "Mié" },
  { valor: 4, corto: "Jue" },
  { valor: 5, corto: "Vie" },
  { valor: 6, corto: "Sáb" },
  { valor: 0, corto: "Dom" },
];

/** Las del residente y las de una unidad. */
export const CATEGORIAS_DE_UNIDAD = [
  { valor: "familiar", etiqueta: "Familiar" },
  { valor: "servicio", etiqueta: "Servicio" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

/** `L-10`: el personal DEL CONJUNTO, decidido por David el 18 sep 2026 (catálogo del conjunto). */
export const CATEGORIAS_DEL_CONJUNTO = [
  { valor: "aseo", etiqueta: "Aseo" },
  { valor: "jardineria", etiqueta: "Jardinería" },
  { valor: "mantenimiento", etiqueta: "Mantenimiento" },
  { valor: "seguridad", etiqueta: "Seguridad" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export type CategoriaDeVisitante =
  | (typeof CATEGORIAS_DE_UNIDAD)[number]["valor"]
  | (typeof CATEGORIAS_DEL_CONJUNTO)[number]["valor"];

const TODAS_LAS_CATEGORIAS: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  ...CATEGORIAS_DE_UNIDAD,
  ...CATEGORIAS_DEL_CONJUNTO,
];

export function esCategoriaDeVisitante(valor: unknown): valor is CategoriaDeVisitante {
  return typeof valor === "string" && TODAS_LAS_CATEGORIAS.some((c) => c.valor === valor);
}

export function etiquetaDeCategoria(valor: string | undefined): string | null {
  if (!valor) return null;
  return TODAS_LAS_CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? null;
}

/** Tope de vigencia del frecuente que crea un residente: sin tope, un QR valdría para siempre. */
export const MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE = 12;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Lee un horario de la base. **Todo lo que no tenga forma se descarta** —devuelve `undefined`, que
 * es «sin horario»— en vez de inventar un valor: un horario mal formado no puede restringir a nadie.
 */
export function normalizarHorario(raw: unknown): HorarioDeIngreso | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const dias = Array.isArray(r.dias)
    ? [...new Set(r.dias.filter((d): d is DiaDeLaSemana => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort()
    : [];
  const desde = typeof r.desde === "string" && HORA.test(r.desde) ? r.desde : undefined;
  const hasta = typeof r.hasta === "string" && HORA.test(r.hasta) ? r.hasta : undefined;
  const franja = desde && hasta && desde < hasta ? { desde, hasta } : {};
  if (dias.length === 0 && !("desde" in franja)) return undefined;
  return { dias, ...franja };
}

function diaDeLaSemana(fechaLocal: string): DiaDeLaSemana | null {
  const [a, m, d] = fechaLocal.split("-").map(Number);
  if (!a || !m || !d) return null;
  const fecha = new Date(a, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : (fecha.getDay() as DiaDeLaSemana);
}

type PaseConVigencia = {
  authorizationType?: "puntual" | "larga_duracion";
  validFrom?: string;
  validUntil?: string;
  date?: string;
  horario?: HorarioDeIngreso;
};

/**
 * **¿Le toca venir este día?** Solo para frecuentes: dentro de la vigencia (los dos extremos
 * cuentan) y, si tiene días, en uno de ellos. `validFrom` ausente cae a `date`; `validUntil`
 * ausente es «sin límite», como `dentroDeVigencia`.
 */
export function frecuenteLeTocaElDia(pase: PaseConVigencia, fechaLocal: string): boolean {
  if (pase.authorizationType !== "larga_duracion") return false;
  const desde = (pase.validFrom || pase.date || "").slice(0, 10);
  if (desde && fechaLocal < desde) return false;
  const hasta = (pase.validUntil || "").slice(0, 10);
  if (hasta && fechaLocal > hasta) return false;
  const dias = pase.horario?.dias ?? [];
  if (dias.length === 0) return true;
  const dia = diaDeLaSemana(fechaLocal);
  return dia !== null && dias.includes(dia);
}

/**
 * **¿Está ahora en su horario?** `null` si el pase no tiene horario: no hay nada que avisar. Mira
 * el día de la semana y la franja con la hora LOCAL de quien está en la puerta.
 */
export function dentroDeHorario(pase: PaseConVigencia, ahora: Date = new Date()): boolean | null {
  const horario = pase.horario;
  if (!horario) return null;
  if (horario.dias.length > 0 && !horario.dias.includes(ahora.getDay() as DiaDeLaSemana)) return false;
  if (horario.desde && horario.hasta) {
    const hhmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
    return hhmm >= horario.desde && hhmm <= horario.hasta;
  }
  return true;
}

/** «Lun, Mié, Vie · 07:00–17:00», «Todos los días · 08:00–12:00», «Lun a Vie». */
export function describirHorario(horario: HorarioDeIngreso | undefined): string | null {
  if (!horario) return null;
  const dias = horario.dias;
  let textoDias = "Todos los días";
  if (dias.length > 0 && dias.length < 7) {
    const orden = DIAS_DE_LA_SEMANA.filter((d) => dias.includes(d.valor));
    const esLunAVie = dias.length === 5 && [1, 2, 3, 4, 5].every((d) => dias.includes(d as DiaDeLaSemana));
    textoDias = esLunAVie ? "Lun a Vie" : orden.map((d) => d.corto).join(", ");
  }
  const franja = horario.desde && horario.hasta ? ` · ${horario.desde}–${horario.hasta}` : "";
  return `${textoDias}${franja}`;
}

/**
 * El último día que puede cubrir un frecuente del residente que empieza en `desde`. **No se suma
 * con `new Date(a, m + 12, d)`**: un 29 de febrero se desborda al 1 de marzo (la trampa de
 * `setMonth` de `CLAUDE.md`); el día se recorta al último del mes de llegada.
 */
export function ultimoDiaPermitidoDelResidente(desde: string): string {
  const [a, m, d] = desde.split("-").map(Number);
  const mesDestino = m - 1 + MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE;
  const ultimoDelMes = new Date(a, mesDestino + 1, 0).getDate();
  return toDateInputValue(new Date(a, mesDestino, Math.min(d, ultimoDelMes)));
}

/** Margen que exige la regla de `visitorInvitations` (`isValidInvitationWindow`): 15 minutos. */
const MARGEN_DE_LA_REGLA_MS = 16 * 60 * 1000;

/**
 * El instante de inicio y de fin que guarda la invitación de un frecuente. Vale **de `desde` a
 * `hasta`, días enteros**: empieza en la franja de entrada del primer día (o a medianoche) y acaba
 * al cerrar la franja del último (o a las 23:59).
 *
 * **Si el inicio ya pasó —un frecuente que empieza hoy a las 07:00 creado a las 10:00—, se corre
 * a dentro de 16 minutos**, porque la regla exige 15 de antelación. Se queda en el mismo día, así
 * que el pase conserva su `validFrom`.
 */
export function ventanaDelFrecuente(
  desde: string,
  hasta: string,
  horario: HorarioDeIngreso | undefined,
  ahora: Date = new Date(),
): { startAt: Date; endAt: Date } {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  const [hi, mi] = (horario?.desde ?? "00:00").split(":").map(Number);
  const [hf, mf] = (horario?.hasta ?? "23:59").split(":").map(Number);
  let startAt = new Date(a1, m1 - 1, d1, hi, mi);
  const minimo = new Date(ahora.getTime() + MARGEN_DE_LA_REGLA_MS);
  if (startAt < minimo && toDateInputValue(minimo) === desde) startAt = minimo;
  return { startAt, endAt: new Date(a2, m2 - 1, d2, hf, mf) };
}
