"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolverAutorizacionDeVisita = resolverAutorizacionDeVisita;
exports.residentesActivosDeLaUnidad = residentesActivosDeLaUnidad;
exports.camposDeAutorizacionAlCrear = camposDeAutorizacionAlCrear;
exports.registrarVisitaNoAnunciada = registrarVisitaNoAnunciada;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const autorizacion_de_visita_1 = require("./autorizacion-de-visita");
const tenant_membership_1 = require("./tenant-membership");
const tenant_status_1 = require("./tenant-status");
/**
 * `PRD-V-FLOW-005` — autorizar la visita que llega sin avisar, del lado del servidor.
 *
 * **Por qué callable y no escritura del cliente. Cumple CINCO criterios a la vez**, y con uno
 * bastaba: hay lógica de negocio (la caducidad y la carrera entre dos residentes), permisos
 * cruzados, avisos, escritura en varias colecciones, y **datos que el cliente no debe poder
 * falsificar** — quién autorizó y por qué medio.
 *
 * **Y hay una razón dura, medida en las reglas de hoy:** el `update` de `visitorPasses` deja al
 * residente tocar **solo lo que él creó** (`resource.data.createdBy == request.auth.uid`). Un pase
 * creado por portería lleva el uid del guardia, así que **con las reglas actuales el residente no
 * puede autorizarlo**. Abrir esa rama para que el cliente escriba el estado sería exactamente el
 * agujero que esta ficha viene a evitar.
 */
const db = () => (0, firestore_1.getFirestore)();
const texto = (v) => (typeof v === "string" ? v.trim() : "");
/** Milisegundos de un `Timestamp` de Firestore, o `null`. La función pura no sabe de Firestore. */
function comoMs(valor) {
    const t = valor;
    return typeof t?.toMillis === "function" ? t.toMillis() : null;
}
/**
 * Quién puede resolver, y con qué medio.
 *
 * **Las dos vías no son el mismo permiso con distinto nombre.** El residente de la unidad resuelve
 * por `app` porque le llegó el aviso; el guardia resuelve por `llamada` porque habló por fuera de
 * la plataforma y lo declara. **El administrador NO resuelve** (`CF5`): si pudiera autorizar en
 * nombre de un residente, la constancia dejaría de significar algo — y significar algo es todo lo
 * que esta ficha aporta.
 */
async function quienResuelve(tenantId, unitId, uid, rol) {
    const r = typeof rol === "string" ? rol : "";
    if (r === "security_guard" || r === "security") {
        if (!(await (0, tenant_membership_1.esMiembroDelConjunto)(tenantId, uid))) {
            throw new https_1.HttpsError("permission-denied", "No perteneces a este conjunto.");
        }
        return { via: "guardia", medio: "llamada" };
    }
    if (r === "resident") {
        const membresia = await db().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
        const datos = membresia.data();
        // `CF1`: un residente resuelve la de SU unidad y ninguna otra.
        if (!membresia.exists || datos?.status !== "active" || texto(datos?.unitId) !== unitId) {
            throw new https_1.HttpsError("permission-denied", "Esta visita no es de tu unidad.");
        }
        return { via: "residente", medio: "app" };
    }
    // `CF5`: el administrador y el superadministrador ven y auditan; no autorizan.
    if (r === "tenant_admin" || r === "superadmin" || (await (0, tenant_membership_1.esAdminActivoDelConjunto)(tenantId, uid))) {
        throw new https_1.HttpsError("permission-denied", "La autorización la da el residente de la unidad o la portería declarando el medio. " +
            "La administración la consulta, no la firma.");
    }
    throw new https_1.HttpsError("permission-denied", "No tienes permiso para resolver esta visita.");
}
/**
 * Resuelve una petición de autorización — la usan el residente y el guardia, con ramas distintas.
 *
 * **Va en transacción por `CA4`**, que es una carrera de verdad: dos residentes de la misma unidad
 * pueden pulsar a la vez. El segundo **no recibe un error**: recibe quién la resolvió, porque
 * «alguien se te adelantó» es información y «algo falló» es mentira.
 */
async function resolverAutorizacionDeVisita(input, actor) {
    const tenantId = texto(input?.tenantId);
    const visitorPassId = texto(input?.visitorPassId);
    const decision = input?.decision;
    if (!tenantId || !visitorPassId) {
        throw new https_1.HttpsError("invalid-argument", "Falta el conjunto o la visita.");
    }
    if (decision !== "autorizar" && decision !== "rechazar") {
        throw new https_1.HttpsError("invalid-argument", "La decisión solo puede ser autorizar o rechazar.");
    }
    if (!actor.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión.");
    const firestore = db();
    const ref = firestore.collection("visitorPasses").doc(visitorPassId);
    const previo = await ref.get();
    const datosPrevios = previo.data();
    if (!previo.exists || texto(datosPrevios?.tenantId) !== tenantId) {
        throw new https_1.HttpsError("not-found", "Esa visita no existe en este conjunto.");
    }
    if (!datosPrevios?.authorizationStatus) {
        throw new https_1.HttpsError("failed-precondition", "Esta visita no es de las que se autorizan en portería.");
    }
    const { via, medio } = await quienResuelve(tenantId, texto(datosPrevios.unitId), actor.uid, actor.role);
    // `CF6`: el estado del conjunto va DESPUÉS del rol, para no filtrarle a un extraño que el
    // conjunto está suspendido. Y se comprueba aquí y no solo en las reglas, porque el Admin SDK
    // no las evalúa.
    await (0, tenant_status_1.assertTenantOperable)(tenantId);
    // `R5` y `CF3`. El medio no lo elige el cliente: lo determina quién resuelve. Se acepta el que
    // manda solo para poder rechazarlo si miente — un cliente que dice «app» siendo el guardia
    // estaría fabricando la constancia.
    const medioPedido = input?.medio;
    if (decision === "autorizar" && medioPedido && medioPedido !== medio) {
        throw new https_1.HttpsError("invalid-argument", `El medio de esta autorización es «${medio}» y no se puede declarar otro.`);
    }
    const nombre = await nombreDelActor(tenantId, actor.uid);
    return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const datos = snap.data();
        const ahora = firestore_1.Timestamp.now();
        const estadoActual = (0, autorizacion_de_visita_1.estadoDeAutorizacion)(datos.authorizationStatus, comoMs(datos.authorizationRequestedAt), ahora.toMillis());
        // `R6` y `CA4`/`CF7`: lo ya resuelto no se pisa, y se dice QUIÉN lo resolvió.
        if ((0, autorizacion_de_visita_1.estaResuelta)(estadoActual)) {
            return {
                ok: true,
                aplicada: false,
                estado: estadoActual,
                resueltaPor: texto(datos.authorizedByName) || "otra persona",
            };
        }
        // `CA6`: una expirada NO está resuelta, y **solo la rescata la vía B**. Si el residente
        // pudiera resolverla pasados los cinco minutos, el guardia ya habría decidido por otra vía
        // y tendríamos dos verdades sobre la misma visita.
        if (estadoActual === "expirada" && via === "residente") {
            throw new https_1.HttpsError("failed-precondition", "Pasaron los cinco minutos y la portería ya resolvió esta visita por otra vía.");
        }
        const nuevo = decision === "autorizar" ? "autorizada" : "rechazada";
        tx.update(ref, {
            authorizationStatus: nuevo,
            authorizedBy: actor.uid,
            authorizedByName: nombre,
            // `R5`: siempre, sin excepción. Sin esto las dos vías serían indistinguibles y la
            // constancia no valdría para nada — que es justo lo que la ficha viene a arreglar.
            authorizationMedium: medio,
            authorizationResolvedAt: ahora,
            updatedAt: ahora,
            updatedBy: actor.uid,
        });
        return { ok: true, aplicada: true, estado: nuevo, resueltaPor: nombre };
    });
}
async function nombreDelActor(tenantId, uid) {
    const membresia = await db().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    const deMembresia = texto(membresia.data()?.fullName);
    if (deMembresia)
        return deMembresia;
    const usuario = await db().collection("users").doc(uid).get();
    return texto(usuario.data()?.fullName) || "Alguien de la unidad";
}
/** Los residentes activos de una unidad. `R7`: sin ninguno, la vía A no se puede ofrecer. */
async function residentesActivosDeLaUnidad(tenantId, unitId) {
    const snap = await db()
        .collection("tenantUsers")
        .where("tenantId", "==", tenantId)
        .where("role", "==", "resident")
        .where("unitId", "==", unitId)
        .get();
    return snap.docs
        .map((d) => d.data())
        .filter((d) => !d.status || d.status === "active")
        .map((d) => texto(d.uid))
        .filter(Boolean);
}
/** Los campos de autorización con los que nace el pase, según la vía. */
function camposDeAutorizacionAlCrear(via, ahora, uid, nombre) {
    if (via === "app") {
        return {
            origen: "porteria",
            authorizationStatus: "pendiente",
            authorizationRequestedAt: ahora,
        };
    }
    return {
        origen: "porteria",
        // `R4`: la vía B no espera nada y está disponible desde el primer momento.
        authorizationStatus: "autorizada",
        authorizedBy: uid,
        authorizedByName: nombre,
        authorizationMedium: "llamada",
        authorizationResolvedAt: ahora,
    };
}
/**
 * Captura una visita que llegó sin avisar. **La escritura y la decisión viven aquí; el aviso lo
 * manda quien llama**, porque el catálogo de avisos y su entrega viven en `index.ts` y traérselos
 * aquí arrastraría medio fichero. El resultado dice a quién hay que avisar.
 */
async function registrarVisitaNoAnunciada(input, actor) {
    const tenantId = texto(input?.tenantId);
    const unitId = texto(input?.unitId);
    const unitLabel = texto(input?.unitLabel);
    const visitorName = texto(input?.visitorName);
    const documentNumber = texto(input?.documentNumber);
    if (!tenantId || !unitId || !unitLabel || !visitorName || !documentNumber) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para registrar la visita.");
    }
    const rol = typeof actor.rol === "string" ? actor.rol : "";
    const esGuardia = rol === "security_guard" || rol === "security";
    if (!esGuardia && rol !== "tenant_admin" && rol !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para registrar visitas.");
    }
    if (!(await (0, tenant_membership_1.esMiembroDelConjunto)(tenantId, actor.uid)) && rol !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No perteneces a este conjunto.");
    }
    // `CF6`: el estado del conjunto, DESPUÉS del rol y en el servidor.
    await (0, tenant_status_1.assertTenantOperable)(tenantId);
    const via = input?.via === "llamada" ? "llamada" : "app";
    const residentes = await residentesActivosDeLaUnidad(tenantId, unitId);
    // **`R7` y `CA11`: sin residentes activos la vía A no existe**, y hay que decirlo aquí y no solo
    // ocultarla en la pantalla — una vía que el servidor acepta y nadie puede contestar deja al
    // visitante esperando cinco minutos a nadie.
    if (via === "app" && residentes.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "Esta unidad no tiene residentes con acceso, así que no hay a quién preguntarle. " +
            "Llama por teléfono y autoriza declarando el medio.");
    }
    const ahora = firestore_1.Timestamp.now();
    const serverDate = ahora.toDate();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(texto(input?.date))
        ? texto(input.date)
        : serverDate.toISOString().slice(0, 10);
    const scheduledTime = /^\d{2}:\d{2}/.test(texto(input?.scheduledTime))
        ? texto(input.scheduledTime).slice(0, 5)
        : `${String(serverDate.getUTCHours()).padStart(2, "0")}:${String(serverDate.getUTCMinutes()).padStart(2, "0")}`;
    const [torre, unidad] = unitLabel.split("-");
    const ref = await db().collection("visitorPasses").add({
        tenantId,
        unitId,
        unitLabel,
        visitorName,
        documentNumber,
        qrCodeValue: "",
        hostResidentName: texto(input?.hostResidentName),
        tower: torre?.trim() || "-",
        unit: unidad?.trim() || unitLabel,
        date,
        eventDate: date,
        scheduledTime,
        // **`scheduled`, NO `inside`.** El ingreso lo registra el guardia después, y solo si está
        // autorizada: la regla de Firestore exige `authorizationStatus == "autorizada"` para ese paso.
        status: "scheduled",
        checkInAt: null,
        checkOutAt: null,
        registeredByGuard: true,
        ...camposDeAutorizacionAlCrear(via, ahora, actor.uid, actor.nombre),
        createdBy: actor.uid,
        createdByName: actor.nombre,
        residentName: texto(input?.hostResidentName),
        createdAt: ahora,
        updatedAt: ahora,
    });
    return {
        visitorPassId: ref.id,
        authorizationStatus: via === "app" ? "pendiente" : "autorizada",
        residentes,
    };
}
