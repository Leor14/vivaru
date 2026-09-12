import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { isDateTimeValid } from "./utils/datetimeValidation";
import {
  formatRangeLabel,
  isRangeAvailable,
  normalizeAmenityWindows,
  parseClockTime,
  parseSlotRange,
  type TimeRange,
} from "./time-range";
import { diaDeLaSemana, instanteEnZona, zonaDelConjunto } from "./zona-del-conjunto";

/**
 * `PRD-V-FIX-001` entrega 1 — las reglas de reserva se cumplen en el servidor.
 *
 * **Qué había antes, y por qué era un agujero de regla de negocio.** De las
 * trece reglas de una reserva, la regla de Firestore verificaba seis (quién,
 * dónde, margen fijo de 30 minutos). Las otras siete —mora, cupo mensual,
 * aforo, día disponible, ventana horaria, duración máxima y solapamiento—
 * vivían SOLO en el navegador (`use-reservations.ts`,
 * `eligibility.ts`). Un residente en mora, o con el cupo agotado, podía crear
 * la reserva escribiendo directo contra la base.
 *
 * **Además, dos de esas comprobaciones del cliente estaban rotas de origen:**
 *
 * - La exención por unidad consultaba `units` por el CAMPO `unitId` — que es
 *   un slug del nombre — pasándole el **doc id** que viaja en la sesión. Nunca
 *   coincidía: `reservationExempt` jamás aplicó. (La trampa de CLAUDE.md:
 *   «`unitId` de personas = doc id de la unidad, no el slug».)
 * - El cupo mensual contaba sobre `tenants/{id}/reservations`, una
 *   subcolección que NO existe — las reservas viven en la colección raíz
 *   `reservations` con `tenantId` como campo. El conteo siempre fallaba y el
 *   `catch` lo silenciaba.
 *
 * Y el aforo por turno solo miraba las reservas de la PROPIA unidad, porque
 * las reglas no dejan a un residente leer las del vecino: dos unidades podían
 * reservar el mismo turno de un área con aforo 1.
 *
 * **Tres decisiones que sostienen este módulo:**
 *
 * 1. **La decisión es una función pura** (`evaluarReglasDeReserva`): recibe la
 *    configuración del área, las reservas existentes y el candidato, y devuelve
 *    o vía libre o LA regla concreta que se incumplió (R7 de la PRD: «no se
 *    puede reservar» sin motivo no es aceptable). Se prueba entera sin
 *    emulador, igual que `calcularSaldo` en payments.
 * 2. **Aforo y solapamiento se verifican DENTRO de la transacción** que crea
 *    la reserva (R9). Comprobar antes de escribir deja una ventana que dos
 *    peticiones simultáneas atraviesan; `runTransaction` reintenta si otra
 *    escritura tocó los docs leídos.
 * 3. **Comportamiento idéntico al de hoy** (D1, cerrada 21 ago 2026): margen
 *    fijo de 30 minutos, política de mora a nivel de conjunto, sin
 *    autoaprobación. La política por área es la entrega 2, nunca en el mismo
 *    despliegue que la corrección.
 *
 * **Entrega 1.1 (12 sep 2026) — tres defectos de la entrega 1, corregidos solos**
 * (decisión de David: primero el arreglo, después la entrega 2):
 *
 * - La hora elegida se leía en la zona del PROCESO, UTC: la antelación rechazaba
 *   reservas del mismo día a menos de ~6 h y `startAt` quedaba desplazado. Ahora
 *   es hora de pared del conjunto (`zona-del-conjunto.ts`).
 * - La mudanza del residente se creaba con `addDoc` desde el navegador, y el
 *   paso 4 le cerró la puerta: `CA11` no se cumplía. Ahora la escribe
 *   `crearMudanza`, con el mismo documento de siempre.
 * - En el cliente, las reservas del administrador no llevaban `amenityId`, y aquí
 *   se cuentan por ese campo: no ocupaban aforo ni cupo.
 */

// `initializeApp()` corre en index.ts y los imports se evalúan antes.
const db = () => getFirestore();

type AmenityDoc = {
  tenantId?: string;
  name?: string;
  status?: string;
  isReservable?: boolean;
  temporaryDisabled?: boolean;
  deletedAt?: string | null;
  reservationSlots?: string[];
  availableWeekdays?: number[];
  blockedDates?: string[];
  unavailableDates?: string[];
  availabilityStartDate?: string;
  availabilityEndDate?: string;
  maxReservationsPerSlot?: number;
  maxReservationDurationMinutes?: number;
  maxReservationsPerUnitPerMonth?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
};

type ReservaExistente = {
  unitId?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  slot?: string;
  date?: string;
};

export type CrearReservaInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  amenityId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  startTime: string;
  endTime: string;
  exclusiveUse?: boolean;
  createdByName?: string;
};

export type ReglaIncumplida =
  | "rango_invalido"
  | "anticipacion"
  | "dia_no_disponible"
  | "fuera_de_ventana"
  | "duracion_maxima"
  | "mora"
  | "cupo_mensual"
  | "aforo";

export type DecisionReserva =
  | { ok: true }
  | { ok: false; regla: ReglaIncumplida; mensaje: string };

/** Lo que la decisión pura necesita saber, ya leído de Firestore. */
export type ContextoDecision = {
  amenity: Pick<
    AmenityDoc,
    | "reservationSlots"
    | "availableWeekdays"
    | "blockedDates"
    | "unavailableDates"
    | "availabilityStartDate"
    | "availabilityEndDate"
    | "maxReservationsPerSlot"
    | "maxReservationDurationMinutes"
    | "maxReservationsPerUnitPerMonth"
    | "operatingHoursStart"
    | "operatingHoursEnd"
  >;
  /** Reservas vivas del área ese día — de TODAS las unidades. */
  reservasDelDia: ReservaExistente[];
  /** Cuántas reservas vivas lleva la unidad en el área este mes. */
  usoMensualDeLaUnidad: number;
  /** Resultado de la comprobación de mora (null = política apagada o exenta). */
  saldoVencido: number | null;
  /** Inyectado para que la función sea pura y testeable. */
  ahora: Date;
  /** Zona IANA del conjunto: la hora elegida es hora de pared de ahí (entrega 1.1). */
  zona: string;
};

function rangoDeReserva(reserva: ReservaExistente): TimeRange | null {
  if (reserva.startTime && reserva.endTime) {
    const start = parseClockTime(reserva.startTime);
    const end = parseClockTime(reserva.endTime);
    if (start !== null && end !== null && end > start) return { start, end };
  }
  if (reserva.slot) return parseSlotRange(reserva.slot);
  return null;
}

function esReservaViva(reserva: ReservaExistente) {
  return reserva.status !== "cancelled" && reserva.status !== "rejected";
}

/**
 * Las trece reglas, en el orden en que fallan más barato. Devuelve la PRIMERA
 * incumplida: el mensaje al residente nombra una causa concreta, no una lista.
 */
export function evaluarReglasDeReserva(
  input: Pick<CrearReservaInput, "date" | "startTime" | "endTime" | "unitId">,
  ctx: ContextoDecision,
): DecisionReserva {
  const startMinutes = parseClockTime(input.startTime);
  const endMinutes = parseClockTime(input.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return { ok: false, regla: "rango_invalido", mensaje: "Selecciona un rango horario válido para continuar." };
  }

  const inicio = instanteEnZona(input.date, input.startTime, ctx.zona);
  if (!inicio || !isDateTimeValid(inicio, "reservation", ctx.ahora)) {
    return {
      ok: false,
      regla: "anticipacion",
      mensaje: "La reserva requiere al menos 30 minutos de anticipación.",
    };
  }

  // Día disponible: día de la semana, fechas bloqueadas y ventana de vigencia.
  // El día es el de la FECHA elegida: del instante no sirve, porque las 20:00 de
  // un sábado en México ya son domingo en UTC.
  const dia = diaDeLaSemana(input.date);
  const weekdays = ctx.amenity.availableWeekdays;
  if (Array.isArray(weekdays) && weekdays.length > 0 && (dia === null || !weekdays.includes(dia))) {
    return { ok: false, regla: "dia_no_disponible", mensaje: "El área no está disponible ese día de la semana." };
  }

  const fechasBloqueadas = [
    ...(ctx.amenity.blockedDates ?? []),
    ...(ctx.amenity.unavailableDates ?? []),
  ];
  if (fechasBloqueadas.includes(input.date)) {
    return { ok: false, regla: "dia_no_disponible", mensaje: "El área está bloqueada en la fecha elegida." };
  }

  if (ctx.amenity.availabilityStartDate && input.date < ctx.amenity.availabilityStartDate) {
    return { ok: false, regla: "dia_no_disponible", mensaje: "El área aún no está disponible en esa fecha." };
  }
  if (ctx.amenity.availabilityEndDate && input.date > ctx.amenity.availabilityEndDate) {
    return { ok: false, regla: "dia_no_disponible", mensaje: "El área ya no está disponible en esa fecha." };
  }

  // Ventana horaria del área. Con horario explícito manda el horario; si no,
  // las ventanas derivadas de los turnos configurados; sin nada, la ventana
  // por defecto (06:00–22:00) — el mismo orden que aplica la interfaz.
  const horaInicio = ctx.amenity.operatingHoursStart ? parseClockTime(ctx.amenity.operatingHoursStart) : null;
  const horaFin = ctx.amenity.operatingHoursEnd ? parseClockTime(ctx.amenity.operatingHoursEnd) : null;
  const ventanas: TimeRange[] =
    horaInicio !== null && horaFin !== null && horaFin > horaInicio
      ? [{ start: horaInicio, end: horaFin }]
      : normalizeAmenityWindows(ctx.amenity.reservationSlots);

  const dentroDeVentana = ventanas.some((v) => startMinutes >= v.start && endMinutes <= v.end);
  if (!dentroDeVentana) {
    return {
      ok: false,
      regla: "fuera_de_ventana",
      mensaje: "El horario elegido está fuera del horario de operación del área.",
    };
  }

  const duracion = endMinutes - startMinutes;
  const duracionMaxima = ctx.amenity.maxReservationDurationMinutes;
  if (typeof duracionMaxima === "number" && duracionMaxima > 0 && duracion > duracionMaxima) {
    return {
      ok: false,
      regla: "duracion_maxima",
      mensaje: `La duración máxima permitida es de ${duracionMaxima} minutos.`,
    };
  }

  if (ctx.saldoVencido !== null && ctx.saldoVencido > 0) {
    return {
      ok: false,
      regla: "mora",
      mensaje: "Tu unidad tiene un saldo pendiente. Regulariza tu pago para hacer reservas.",
    };
  }

  const cupoMensual = ctx.amenity.maxReservationsPerUnitPerMonth;
  if (typeof cupoMensual === "number" && cupoMensual > 0 && ctx.usoMensualDeLaUnidad >= cupoMensual) {
    return {
      ok: false,
      regla: "cupo_mensual",
      mensaje: `Tu unidad ya usó sus ${cupoMensual} reservas del mes en esta área.`,
    };
  }

  // Aforo y solapamiento, contra TODAS las unidades — no solo la propia, que
  // era lo único que el navegador podía leer.
  const rangosExistentes = ctx.reservasDelDia
    .filter(esReservaViva)
    .map(rangoDeReserva)
    .filter((r): r is TimeRange => r !== null);

  const aforo =
    typeof ctx.amenity.maxReservationsPerSlot === "number" && ctx.amenity.maxReservationsPerSlot > 0
      ? ctx.amenity.maxReservationsPerSlot
      : 1;

  const disponible = isRangeAvailable({
    candidate: { start: startMinutes, end: endMinutes },
    existing: rangosExistentes,
    maxConcurrent: aforo,
  });

  if (!disponible) {
    return { ok: false, regla: "aforo", mensaje: "Ese rango ya no está disponible. Selecciona otro horario." };
  }

  return { ok: true };
}

/**
 * Mora de la unidad, decidida en el servidor. Espejo funcional de
 * `src/features/reservations/eligibility.ts` con las DOS correcciones:
 * la exención se busca por doc id (con caída al campo `unitId` para datos
 * viejos), y devuelve `null` cuando la política está apagada o la unidad
 * exenta — que significa «no aplica», no «sin deuda».
 */
async function saldoVencidoDeUnidad(tenantId: string, unitId: string): Promise<number | null> {
  const firestore = db();

  const settingsSnap = await firestore.collection("tenantSettings").doc(tenantId).get();
  const settings = settingsSnap.data() as { reservationPolicy?: { blockOnDebt?: boolean } } | undefined;
  if (!settings?.reservationPolicy?.blockOnDebt) return null;

  // Exención por unidad: primero por doc id — que es lo que viaja en la
  // sesión y en la membresía — y, para unidades antiguas cuyo id no case,
  // por el campo `unitId` como hacía el cliente.
  const unitByIdSnap = await firestore.collection("units").doc(unitId).get();
  if (unitByIdSnap.exists) {
    const data = unitByIdSnap.data() as { tenantId?: string; reservationExempt?: boolean };
    if (data.tenantId === tenantId && data.reservationExempt === true) return null;
  } else {
    const unitByFieldSnap = await firestore
      .collection("units")
      .where("tenantId", "==", tenantId)
      .where("unitId", "==", unitId)
      .limit(1)
      .get();
    const data = unitByFieldSnap.docs[0]?.data() as { reservationExempt?: boolean } | undefined;
    if (data?.reservationExempt === true) return null;
  }

  const overdueSnap = await firestore
    .collection("billingStatements")
    .where("tenantId", "==", tenantId)
    .where("unitId", "==", unitId)
    .where("status", "==", "overdue")
    .get();

  let total = 0;
  for (const docSnap of overdueSnap.docs) {
    const balance = (docSnap.data() as { balance?: number }).balance;
    if (typeof balance === "number" && balance > 0) total += balance;
  }
  return total;
}

/** La zona del conjunto, por su país (entrega 1.1). Sin documento o sin país, la de la capital de México. */
async function zonaDe(tenantId: string): Promise<string> {
  const snap = await db().collection("tenants").doc(tenantId).get();
  return zonaDelConjunto((snap.data() as { country?: unknown } | undefined)?.country);
}

export type CrearReservaResultado = {
  ok: true;
  reservationId: string;
  status: "pending";
};

/**
 * Crea la reserva con todas las reglas verificadas en el servidor. La
 * membresía ya la validó el llamador (index.ts); aquí se valida el área, la
 * mora, y —dentro de la transacción— aforo, cupo y solapamiento.
 */
export async function crearReserva(
  input: CrearReservaInput,
  uid: string,
): Promise<CrearReservaResultado> {
  const firestore = db();

  const amenityRef = firestore.collection("amenities").doc(input.amenityId);
  const amenitySnap = await amenityRef.get();
  if (!amenitySnap.exists) {
    throw new HttpsError("not-found", "El área no existe.");
  }
  const amenity = amenitySnap.data() as AmenityDoc;

  if (amenity.tenantId !== input.tenantId) {
    throw new HttpsError("permission-denied", "El área no pertenece a tu conjunto.");
  }
  const reservable =
    amenity.status === "active" &&
    amenity.isReservable !== false &&
    amenity.temporaryDisabled !== true &&
    !(typeof amenity.deletedAt === "string" && amenity.deletedAt.trim().length > 0);
  if (!reservable) {
    throw new HttpsError("failed-precondition", "El área no está disponible para reservas.");
  }

  const saldoVencido = await saldoVencidoDeUnidad(input.tenantId, input.unitId);
  const zona = await zonaDe(input.tenantId);

  const primerDiaDelMes = `${input.date.slice(0, 7)}-01`;

  const reservasDelDiaQuery = firestore
    .collection("reservations")
    .where("tenantId", "==", input.tenantId)
    .where("amenityId", "==", input.amenityId)
    .where("date", "==", input.date);

  const usoMensualQuery = firestore
    .collection("reservations")
    .where("tenantId", "==", input.tenantId)
    .where("amenityId", "==", input.amenityId)
    .where("unitId", "==", input.unitId)
    .where("date", ">=", primerDiaDelMes)
    .where("date", "<=", `${input.date.slice(0, 7)}-31`);

  return firestore.runTransaction(async (tx) => {
    // Lecturas dentro de la transacción: si otra reserva del mismo turno se
    // escribe entre la lectura y el commit, Firestore reintenta y el aforo se
    // reevalúa con el dato fresco. Es lo que cierra la carrera de dos
    // peticiones simultáneas (R9).
    const [reservasDelDiaSnap, usoMensualSnap] = await Promise.all([
      tx.get(reservasDelDiaQuery),
      tx.get(usoMensualQuery),
    ]);

    const reservasDelDia = reservasDelDiaSnap.docs.map((d) => d.data() as ReservaExistente);
    const usoMensualDeLaUnidad = usoMensualSnap.docs
      .map((d) => d.data() as ReservaExistente)
      .filter(esReservaViva).length;

    const decision = evaluarReglasDeReserva(input, {
      amenity,
      reservasDelDia,
      usoMensualDeLaUnidad,
      saldoVencido,
      ahora: new Date(),
      zona,
    });

    if (!decision.ok) {
      throw new HttpsError("failed-precondition", decision.mensaje, { regla: decision.regla });
    }

    const startMinutes = parseClockTime(input.startTime) as number;
    const endMinutes = parseClockTime(input.endTime) as number;
    const inicio = instanteEnZona(input.date, input.startTime, zona) as Date;

    const reservaRef = firestore.collection("reservations").doc();
    tx.set(reservaRef, {
      tenantId: input.tenantId,
      createdBy: uid,
      createdByName: input.createdByName?.trim() || "",
      residentName: input.createdByName?.trim() || "",
      reservedBy: input.createdByName?.trim() || "",
      updatedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      unitId: input.unitId,
      unitLabel: input.unitLabel,
      amenityId: input.amenityId,
      amenity: amenity.name ?? "",
      amenityName: amenity.name ?? "",
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      startAt: Timestamp.fromDate(inicio),
      slot: formatRangeLabel(startMinutes, endMinutes),
      exclusiveUse: input.exclusiveUse === true,
      status: "pending" as const,
      // Deja rastro de la vía: cuando la regla de Firestore se cierre (paso 4
      // del despliegue), este campo distingue lo creado por el servidor.
      createdVia: "callable",
    });

    return { ok: true as const, reservationId: reservaRef.id, status: "pending" as const };
  });
}

// ── Mudanza (`CA11`, entrega 1.1) ────────────────────────────────────────────

export type CrearMudanzaInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  startTime: string;
  endTime: string;
  requiresElevator: boolean;
  depositPaid: boolean;
  depositAmount?: number;
  additionalNotes?: string;
  createdByName?: string;
};

export type ReglaDeMudanza = "rango_invalido" | "anticipacion" | "datos_invalidos";

/** El asistente no tenía tope; el servidor pone este y el asistente, el mismo. */
export const MAX_NOTAS_DE_MUDANZA = 2000;

/**
 * El documento de una mudanza, decidido en el servidor. Es el MISMO que escribía
 * `createMudanzaReservation` desde el navegador hasta el 24 ago 2026 —cuando el
 * paso 4 le cerró la puerta sin que nadie lo notara—, más `createdVia` y `startAt`
 * en la hora del conjunto. No añade reglas: la mudanza «sigue su camino actual»
 * (§5 de la ficha), sin aforo ni cupo. Un recibo por URL no se acepta: el asistente
 * nunca lo mandó, y sería un enlace que el administrador abre sin saber adónde va.
 */
export function construirMudanza(
  input: CrearMudanzaInput,
  uid: string,
  ctx: { ahora: Date; zona: string },
):
  | { ok: true; documento: Record<string, unknown> }
  | { ok: false; regla: ReglaDeMudanza; mensaje: string } {
  const startMinutes = parseClockTime(input.startTime);
  const endMinutes = parseClockTime(input.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return { ok: false, regla: "rango_invalido", mensaje: "Selecciona un rango horario válido para continuar." };
  }

  const inicio = instanteEnZona(input.date, input.startTime, ctx.zona);
  if (!inicio || !isDateTimeValid(inicio, "reservation", ctx.ahora)) {
    return { ok: false, regla: "anticipacion", mensaje: "La mudanza requiere al menos 30 minutos de anticipación." };
  }

  const mudanza: Record<string, unknown> = {
    requiresElevator: input.requiresElevator === true,
    depositPaid: input.depositPaid === true,
  };
  if (input.depositPaid === true && input.depositAmount != null) {
    const monto = input.depositAmount;
    if (typeof monto !== "number" || !Number.isFinite(monto) || monto < 0) {
      return { ok: false, regla: "datos_invalidos", mensaje: "El monto del depósito no es válido." };
    }
    mudanza.depositAmount = monto;
  }
  const notas = typeof input.additionalNotes === "string" ? input.additionalNotes.trim() : "";
  if (notas.length > MAX_NOTAS_DE_MUDANZA) {
    return {
      ok: false,
      regla: "datos_invalidos",
      mensaje: `Las notas admiten hasta ${MAX_NOTAS_DE_MUDANZA} caracteres.`,
    };
  }
  if (notas) mudanza.additionalNotes = notas;

  const nombre = input.createdByName?.trim() || "";
  return {
    ok: true,
    documento: {
      tenantId: input.tenantId,
      createdBy: uid,
      createdByName: nombre,
      residentName: nombre,
      updatedBy: uid,
      unitId: input.unitId,
      amenityId: "mudanza",
      amenity: "Mudanza",
      amenityName: "Mudanza",
      unitLabel: input.unitLabel,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      slot: formatRangeLabel(startMinutes, endMinutes),
      exclusiveUse: true,
      kind: "mudanza",
      mudanza,
      status: "pending",
      startAt: Timestamp.fromDate(inicio),
      createdVia: "callable",
    },
  };
}

/** Crea la mudanza. La membresía y la unidad ya las validó el llamador (index.ts). */
export async function crearMudanza(input: CrearMudanzaInput, uid: string): Promise<CrearReservaResultado> {
  const decision = construirMudanza(input, uid, { ahora: new Date(), zona: await zonaDe(input.tenantId) });
  if (!decision.ok) {
    const codigo = decision.regla === "datos_invalidos" ? "invalid-argument" : "failed-precondition";
    throw new HttpsError(codigo, decision.mensaje, { regla: decision.regla });
  }
  const ref = db().collection("reservations").doc();
  await ref.set({
    ...decision.documento,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, reservationId: ref.id, status: "pending" };
}
