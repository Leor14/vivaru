"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esPeriodoValido = esPeriodoValido;
exports.periodoAnterior = periodoAnterior;
exports.calcularConsumo = calcularConsumo;
exports.redondear = redondear;
exports.importeDelConsumo = importeDelConsumo;
exports.unidadesSinFoto = unidadesSinFoto;
exports.registrarLectura = registrarLectura;
exports.cerrarPeriodo = cerrarPeriodo;
exports.reabrirPeriodo = reabrirPeriodo;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/** `YYYY-MM`. Se valida aquí porque de él cuelga la búsqueda del período anterior. */
function esPeriodoValido(period) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
        return false;
    const anio = Number(period.slice(0, 4));
    return anio >= 2000 && anio <= 2100;
}
/** El período inmediatamente anterior. Diciembre retrocede de año. */
function periodoAnterior(period) {
    const anio = Number(period.slice(0, 4));
    const mes = Number(period.slice(5, 7));
    return mes === 1
        ? `${anio - 1}-12`
        : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}
/**
 * El consumo. **`RN-03`: una lectura menor que la anterior avisa pero NO
 * bloquea** — un medidor que completa su vuelta es real, y bloquearlo dejaría al
 * administrador sin forma de registrar ese mes.
 *
 * Cuando eso pasa, el consumo del período **no se puede derivar de la
 * diferencia**: sería negativo. Se devuelve `0` y se marca `reinicio`, para que
 * quien lo mire sepa que ese mes hay que revisarlo a mano en vez de encontrarse
 * un número inventado.
 */
function calcularConsumo(previous, current) {
    if (current < previous)
        return { consumption: 0, reinicio: true };
    return { consumption: redondear(current - previous), reinicio: false };
}
/**
 * Tres decimales. **No se usa `toFixed` sobre el float directamente**: en
 * `4.3 - 1.1` da `3.1999999999999997`, y ese número acabaría multiplicado por
 * una tarifa y convertido en dinero.
 */
function redondear(valor) {
    return Math.round(valor * 1000) / 1000;
}
/** El importe. Es lo que Habitanto —textual— «no nos calcula». */
function importeDelConsumo(consumption, rate) {
    return Math.round(consumption * rate);
}
/**
 * `RN-09` — **la foto es obligatoria para CERRAR el período, no para guardar la
 * lectura** (decisión de David, 9 sep 2026). Recorre los medidores caminando, a
 * veces en varios días y en sótanos sin señal: exigirla en cada tecleo le haría
 * perder el recorrido entero.
 *
 * Devuelve **las unidades que faltan, nombradas**, igual que hace el reparto por
 * coeficiente cuando falta un coeficiente. Un «no se puede cerrar» sin decir
 * cuál obliga a buscar a mano entre noventa y tres.
 */
function unidadesSinFoto(lecturas) {
    return lecturas.filter((l) => !l.photoUrl).map((l) => l.unitId);
}
/**
 * Registra una lectura. `previous` y `consumption` **los pone este lado**
 * (`RN-10`, `RN-02`): lo que llega de fuera es el conjunto, el servicio, la
 * unidad, el período y la lectura actual.
 */
async function registrarLectura(params) {
    const { tenantId, serviceId, unitId, period, current, actorUid } = params;
    const db = (0, firestore_1.getFirestore)();
    if (!esPeriodoValido(period)) {
        throw new https_1.HttpsError("invalid-argument", "El período debe tener la forma AAAA-MM.");
    }
    if (!Number.isFinite(current) || current < 0) {
        throw new https_1.HttpsError("invalid-argument", "La lectura debe ser un número positivo.");
    }
    const servicio = await db.collection("meteredServices").doc(serviceId).get();
    if (!servicio.exists || servicio.data().tenantId !== tenantId) {
        throw new https_1.HttpsError("not-found", "Ese servicio medido no existe en este conjunto.");
    }
    // 🔴 **La unidad tiene que EXISTIR, y esto no es una validación de cortesía.**
    // `unitId` en Vivaru está partido en dos —el id del documento y un campo con
    // un slug—, y clasificarlo por su FORMA no funciona: conviven `unit-t1-101`,
    // `t1-101`, `1014` e ids sembrados que PARECEN slugs. Si aquí entrara un slug,
    // la lectura quedaría colgada de una unidad que no existe **sin dar error**, y
    // no aparecería en ninguna pantalla — que es exactamente cómo nacieron los
    // 3.580.000 de deuda que ninguna pantalla sumaba (`FIX-002`).
    //
    // Lo destapó el guardián de `clave-de-unidad`, que enrojeció al aparecer este
    // módulo. **Nada más lo comprobaba.**
    const unidad = await db.collection("units").doc(unitId).get();
    if (!unidad.exists || unidad.data().tenantId !== tenantId) {
        throw new https_1.HttpsError("not-found", "Esa unidad no existe en este conjunto.");
    }
    // `RN-05` — un período ya cobrado no se edita. El cargo ya salió: cambiar su
    // respaldo reescribiría la prueba de una deuda.
    const idLectura = `${tenantId}_${serviceId}_${unitId}_${period}`;
    const previa = await db.collection("meterReadings").doc(idLectura).get();
    if (previa.exists && previa.data().status === "cobrado") {
        throw new https_1.HttpsError("failed-precondition", "Ese período ya se cobró: su lectura no se edita.");
    }
    // `RN-10` — la lectura anterior la busca el servidor, no llega en la petición.
    const anterior = await db
        .collection("meterReadings")
        .doc(`${tenantId}_${serviceId}_${unitId}_${periodoAnterior(period)}`)
        .get();
    // `RN-04` — sin lectura anterior, ésta es LÍNEA BASE y no genera cargo.
    // Cobrar el acumulado del medidor le cobraría a quien vive hoy el consumo de
    // quien vivió antes.
    const esLineaBase = !anterior.exists;
    const previous = esLineaBase ? current : anterior.data().current;
    const { consumption, reinicio } = calcularConsumo(previous, current);
    await db.collection("meterReadings").doc(idLectura).set({
        tenantId,
        serviceId,
        unitId,
        period,
        previous,
        current,
        consumption: esLineaBase ? 0 : consumption,
        esLineaBase,
        reinicio,
        ...(params.photoUrl ? { photoUrl: params.photoUrl } : {}),
        status: "abierto",
        readAt: firestore_1.Timestamp.now(),
        readBy: actorUid,
        updatedAt: firestore_1.Timestamp.now(),
    }, { merge: true });
    return { ok: true, consumption: esLineaBase ? 0 : consumption, reinicio, esLineaBase };
}
/**
 * Cierra el período. **Aquí sí muerde la foto** (`RN-09`): si falta alguna, se
 * deniega nombrando las unidades.
 */
async function cerrarPeriodo(params) {
    const { tenantId, serviceId, period, actorUid } = params;
    const db = (0, firestore_1.getFirestore)();
    const snap = await db
        .collection("meterReadings")
        .where("tenantId", "==", tenantId)
        .where("serviceId", "==", serviceId)
        .where("period", "==", period)
        .get();
    if (snap.empty) {
        throw new https_1.HttpsError("failed-precondition", "No hay ninguna lectura registrada en este período.");
    }
    const lecturas = snap.docs.map((d) => d.data());
    if (lecturas.some((l) => l.status === "cobrado")) {
        throw new https_1.HttpsError("failed-precondition", "Ese período ya se cobró.");
    }
    const faltan = unidadesSinFoto(lecturas);
    if (faltan.length > 0) {
        const lista = faltan.slice(0, 8).join(", ");
        const resto = faltan.length > 8 ? ` y ${faltan.length - 8} más` : "";
        throw new https_1.HttpsError("failed-precondition", `Faltan las fotos de ${faltan.length} ${faltan.length === 1 ? "unidad" : "unidades"}: ${lista}${resto}.`);
    }
    const lote = db.batch();
    for (const d of snap.docs) {
        lote.set(d.ref, { status: "cerrado", closedAt: firestore_1.Timestamp.now(), closedBy: actorUid }, { merge: true });
    }
    await lote.commit();
    return { ok: true, lecturas: snap.size };
}
/** Reabre un período cerrado. Un período `cobrado` no vuelve: `RN-05`. */
async function reabrirPeriodo(params) {
    const db = (0, firestore_1.getFirestore)();
    const snap = await db
        .collection("meterReadings")
        .where("tenantId", "==", params.tenantId)
        .where("serviceId", "==", params.serviceId)
        .where("period", "==", params.period)
        .get();
    if (snap.docs.some((d) => d.data().status === "cobrado")) {
        throw new https_1.HttpsError("failed-precondition", "Ese período ya se cobró y no se reabre.");
    }
    const lote = db.batch();
    for (const d of snap.docs) {
        lote.set(d.ref, { status: "abierto", closedAt: firestore_1.FieldValue.delete(), closedBy: firestore_1.FieldValue.delete() }, { merge: true });
    }
    await lote.commit();
    return { ok: true, lecturas: snap.size };
}
