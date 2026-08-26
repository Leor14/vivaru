/**
 * `PRD-V-FLOW-003` §5.2 — el calendario de cobranza del conjunto.
 *
 * **Función pura, sin Firestore.** Recibe la configuración de un conjunto y la fecha de hoy, y
 * dice si toca enviar. Se prueba entera sin emulador, que es donde de verdad conviene tener las
 * decisiones de fecha: son las que se rompen en los bordes del mes y esos bordes son baratos de
 * escribir y caros de descubrir.
 *
 * ---
 *
 * **DOS COSAS QUE SALEN DE LEER EL CÓDIGO, no de la ficha.**
 *
 * **1 · Los dos procesos programados NO tienen hoy ningún calendario.** `sendScheduledReminders`
 * consume `billingReminderJobs`, que son de una sola vez y traen su propia fecha;
 * `updateOverdueStatements` marca vencidos por `dueDate`. Ninguno tiene noción de «día del mes» ni
 * de «cada N días». Así que esto **no parametriza una conducta existente: añade una nueva**, y por
 * eso «con la bandera apagada se comportan como hoy» se cumple solo, sin ramas de compatibilidad.
 *
 * **2 · El deduplicado es la parte que importa, no el «toca hoy».** Un proceso programado puede
 * correr dos veces —un reintento, un redespliegue a la hora justa—, y sin memoria de lo ya enviado
 * el residente recibe el mismo aviso dos veces. Por eso las dos decisiones miran `lastNoticeSentAt`
 * / `lastOverdueSentAt` y no solo el calendario: **la fecha del último envío es lo que hace que
 * esto sea seguro de repetir.**
 */

/**
 * El ciclo mínimo entre avisos de cartera vencida, en días. **Decisión D1.**
 *
 * **No es un detalle técnico.** Un ciclo de un día es un correo diario a alguien que debe dinero,
 * y eso tiene nombre en varias legislaciones. Habitanto permite 1; aquí el mínimo es 7 a
 * propósito, y por eso la comprobación vive también en las reglas de Firestore: si solo estuviera
 * en el formulario, se salta con una escritura directa desde la consola.
 */
export const MIN_CICLO_DIAS = 7;

/**
 * El día máximo del mes que se ofrece.
 *
 * **29, 30 y 31 no se ofrecen** porque no existen en todos los meses, y un aviso que a veces no
 * sale es peor que uno que sale siempre el 28: el que falla se descubre el mes que hace falta.
 */
export const DIA_MAX = 28;

export type CalendarioDeCobranza = {
  noticeDayOfMonth?: number | null;
  overdueCycleDays?: number | null;
  lastNoticeSentAt?: string | null;
  lastOverdueSentAt?: string | null;
};

/** R5 · el día del aviso: 1–28, o desactivado. */
export function diaDeAvisoValido(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true; // desactivado
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 1 && valor <= DIA_MAX;
}

/** R6 · el ciclo de vencidas: mínimo `MIN_CICLO_DIAS`, o desactivado. */
export function cicloDeVencidasValido(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true; // desactivado
  return typeof valor === "number" && Number.isInteger(valor) && valor >= MIN_CICLO_DIAS;
}

/** `YYYY-MM-DD` en UTC, que es como fechan los dos procesos programados. */
export function fechaUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * ¿Toca el aviso mensual hoy?
 *
 * **Una vez por mes, no una vez por día del mes.** Comparar solo `hoy.getUTCDate() === día` haría
 * que un proceso que corre dos veces el mismo día enviara dos veces. Se compara el MES del último
 * envío: si ya salió este mes, no vuelve a salir aunque el proceso se repita.
 */
export function tocaAvisoHoy(cal: CalendarioDeCobranza, hoy: Date): boolean {
  const dia = cal.noticeDayOfMonth;
  if (!diaDeAvisoValido(dia) || dia === null || dia === undefined) return false;
  if (hoy.getUTCDate() !== dia) return false;

  const ultimo = cal.lastNoticeSentAt;
  if (!ultimo) return true;
  return ultimo.slice(0, 7) !== fechaUTC(hoy).slice(0, 7);
}

/**
 * ¿Toca el aviso de vencidas hoy?
 *
 * **Sin envío previo, toca.** La alternativa —esperar un ciclo entero desde que se configura—
 * dejaría al conjunto sin su primer aviso durante N días sin que nadie entienda por qué.
 */
export function tocaVencidasHoy(cal: CalendarioDeCobranza, hoy: Date): boolean {
  const ciclo = cal.overdueCycleDays;
  if (!cicloDeVencidasValido(ciclo) || ciclo === null || ciclo === undefined) return false;

  const ultimo = cal.lastOverdueSentAt;
  if (!ultimo) return true;

  const dias = Math.floor((Date.parse(`${fechaUTC(hoy)}T00:00:00Z`) - Date.parse(`${ultimo.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(dias)) return true;
  return dias >= ciclo;
}
