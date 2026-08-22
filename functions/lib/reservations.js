"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluarReglasDeReserva = evaluarReglasDeReserva;
exports.crearReserva = crearReserva;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const datetimeValidation_1 = require("./utils/datetimeValidation");
const time_range_1 = require("./time-range");
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
 */
// `initializeApp()` corre en index.ts y los imports se evalúan antes.
const db = () => (0, firestore_1.getFirestore)();
function rangoDeReserva(reserva) {
    if (reserva.startTime && reserva.endTime) {
        const start = (0, time_range_1.parseClockTime)(reserva.startTime);
        const end = (0, time_range_1.parseClockTime)(reserva.endTime);
        if (start !== null && end !== null && end > start)
            return { start, end };
    }
    if (reserva.slot)
        return (0, time_range_1.parseSlotRange)(reserva.slot);
    return null;
}
function esReservaViva(reserva) {
    return reserva.status !== "cancelled" && reserva.status !== "rejected";
}
/**
 * Las trece reglas, en el orden en que fallan más barato. Devuelve la PRIMERA
 * incumplida: el mensaje al residente nombra una causa concreta, no una lista.
 */
function evaluarReglasDeReserva(input, ctx) {
    const startMinutes = (0, time_range_1.parseClockTime)(input.startTime);
    const endMinutes = (0, time_range_1.parseClockTime)(input.endTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return { ok: false, regla: "rango_invalido", mensaje: "Selecciona un rango horario válido para continuar." };
    }
    const inicio = (0, datetimeValidation_1.combineDateAndTime)(input.date, input.startTime);
    if (!inicio || !(0, datetimeValidation_1.isDateTimeValid)(inicio, "reservation", ctx.ahora)) {
        return {
            ok: false,
            regla: "anticipacion",
            mensaje: "La reserva requiere al menos 30 minutos de anticipación.",
        };
    }
    // Día disponible: día de la semana, fechas bloqueadas y ventana de vigencia.
    const dia = inicio.getDay();
    const weekdays = ctx.amenity.availableWeekdays;
    if (Array.isArray(weekdays) && weekdays.length > 0 && !weekdays.includes(dia)) {
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
    const horaInicio = ctx.amenity.operatingHoursStart ? (0, time_range_1.parseClockTime)(ctx.amenity.operatingHoursStart) : null;
    const horaFin = ctx.amenity.operatingHoursEnd ? (0, time_range_1.parseClockTime)(ctx.amenity.operatingHoursEnd) : null;
    const ventanas = horaInicio !== null && horaFin !== null && horaFin > horaInicio
        ? [{ start: horaInicio, end: horaFin }]
        : (0, time_range_1.normalizeAmenityWindows)(ctx.amenity.reservationSlots);
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
        .filter((r) => r !== null);
    const aforo = typeof ctx.amenity.maxReservationsPerSlot === "number" && ctx.amenity.maxReservationsPerSlot > 0
        ? ctx.amenity.maxReservationsPerSlot
        : 1;
    const disponible = (0, time_range_1.isRangeAvailable)({
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
async function saldoVencidoDeUnidad(tenantId, unitId) {
    const firestore = db();
    const settingsSnap = await firestore.collection("tenantSettings").doc(tenantId).get();
    const settings = settingsSnap.data();
    if (!settings?.reservationPolicy?.blockOnDebt)
        return null;
    // Exención por unidad: primero por doc id — que es lo que viaja en la
    // sesión y en la membresía — y, para unidades antiguas cuyo id no case,
    // por el campo `unitId` como hacía el cliente.
    const unitByIdSnap = await firestore.collection("units").doc(unitId).get();
    if (unitByIdSnap.exists) {
        const data = unitByIdSnap.data();
        if (data.tenantId === tenantId && data.reservationExempt === true)
            return null;
    }
    else {
        const unitByFieldSnap = await firestore
            .collection("units")
            .where("tenantId", "==", tenantId)
            .where("unitId", "==", unitId)
            .limit(1)
            .get();
        const data = unitByFieldSnap.docs[0]?.data();
        if (data?.reservationExempt === true)
            return null;
    }
    const overdueSnap = await firestore
        .collection("billingStatements")
        .where("tenantId", "==", tenantId)
        .where("unitId", "==", unitId)
        .where("status", "==", "overdue")
        .get();
    let total = 0;
    for (const docSnap of overdueSnap.docs) {
        const balance = docSnap.data().balance;
        if (typeof balance === "number" && balance > 0)
            total += balance;
    }
    return total;
}
/**
 * Crea la reserva con todas las reglas verificadas en el servidor. La
 * membresía ya la validó el llamador (index.ts); aquí se valida el área, la
 * mora, y —dentro de la transacción— aforo, cupo y solapamiento.
 */
async function crearReserva(input, uid) {
    const firestore = db();
    const amenityRef = firestore.collection("amenities").doc(input.amenityId);
    const amenitySnap = await amenityRef.get();
    if (!amenitySnap.exists) {
        throw new https_1.HttpsError("not-found", "El área no existe.");
    }
    const amenity = amenitySnap.data();
    if (amenity.tenantId !== input.tenantId) {
        throw new https_1.HttpsError("permission-denied", "El área no pertenece a tu conjunto.");
    }
    const reservable = amenity.status === "active" &&
        amenity.isReservable !== false &&
        amenity.temporaryDisabled !== true &&
        !(typeof amenity.deletedAt === "string" && amenity.deletedAt.trim().length > 0);
    if (!reservable) {
        throw new https_1.HttpsError("failed-precondition", "El área no está disponible para reservas.");
    }
    const saldoVencido = await saldoVencidoDeUnidad(input.tenantId, input.unitId);
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
        const reservasDelDia = reservasDelDiaSnap.docs.map((d) => d.data());
        const usoMensualDeLaUnidad = usoMensualSnap.docs
            .map((d) => d.data())
            .filter(esReservaViva).length;
        const decision = evaluarReglasDeReserva(input, {
            amenity,
            reservasDelDia,
            usoMensualDeLaUnidad,
            saldoVencido,
            ahora: new Date(),
        });
        if (!decision.ok) {
            throw new https_1.HttpsError("failed-precondition", decision.mensaje, { regla: decision.regla });
        }
        const startMinutes = (0, time_range_1.parseClockTime)(input.startTime);
        const endMinutes = (0, time_range_1.parseClockTime)(input.endTime);
        const inicio = (0, datetimeValidation_1.combineDateAndTime)(input.date, input.startTime);
        const reservaRef = firestore.collection("reservations").doc();
        tx.set(reservaRef, {
            tenantId: input.tenantId,
            createdBy: uid,
            createdByName: input.createdByName?.trim() || "",
            residentName: input.createdByName?.trim() || "",
            reservedBy: input.createdByName?.trim() || "",
            updatedBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            unitId: input.unitId,
            unitLabel: input.unitLabel,
            amenityId: input.amenityId,
            amenity: amenity.name ?? "",
            amenityName: amenity.name ?? "",
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            startAt: firestore_1.Timestamp.fromDate(inicio),
            slot: (0, time_range_1.formatRangeLabel)(startMinutes, endMinutes),
            exclusiveUse: input.exclusiveUse === true,
            status: "pending",
            // Deja rastro de la vía: cuando la regla de Firestore se cierre (paso 4
            // del despliegue), este campo distingue lo creado por el servidor.
            createdVia: "callable",
        });
        return { ok: true, reservationId: reservaRef.id, status: "pending" };
    });
}
