"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORT_LIMITS = void 0;
exports.createSupportTicket = createSupportTicket;
exports.marcasSup001 = marcasSup001;
exports.replySupportTicket = replySupportTicket;
exports.updateSupportTicket = updateSupportTicket;
exports.reopenSupportTicket = reopenSupportTicket;
exports.closeSupportTicket = closeSupportTicket;
exports.addSupportInternalNote = addSupportInternalNote;
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const auth_1 = require("firebase-admin/auth");
const https_1 = require("firebase-functions/v2/https");
const node_crypto_1 = require("node:crypto");
const email_1 = require("./email");
/**
 * Tickets de soporte al cliente — lógica de servidor (PRD-V-FEAT-001).
 *
 * Toda escritura pasa por aquí y ninguna por el cliente. Cuatro razones, y
 * cualquiera bastaría: manda correo, hay campos que el cliente no debe poder
 * falsificar (`status`, `priority`, `createdBy`, las marcas de tiempo), el
 * hilo es append-only, y hay límites por conjunto que exigen contar antes de
 * escribir.
 *
 * ESPEJO del contrato en `src/features/support/types.ts`. `src/` no puede
 * importar de `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así
 * que vive duplicado a propósito. Si cambias uno, cambia el otro.
 */
// `initializeApp()` corre en index.ts y los imports se evalúan antes: llamar
// getFirestore() en la carga del módulo revienta con "default app does not
// exist". Trampa conocida, ver CLAUDE.md.
function getDb() {
    return (0, firestore_1.getFirestore)();
}
const DEV_INBOX = "dev@qintilab.com";
/**
 * Buzón que recibe los avisos. Variable propia y NO reutiliza
 * `LEAD_NOTIFICATION_TO`: soporte y comercial son colas distintas aunque hoy
 * las mire la misma persona. Separarlas cuesta una línea ahora y una migración
 * después.
 */
function supportInbox() {
    return process.env.SUPPORT_NOTIFICATION_TO?.trim() || DEV_INBOX;
}
function isProductionProject() {
    return (process.env.GCLOUD_PROJECT ?? "") === "hogaru-1";
}
function envTag() {
    return isProductionProject() ? "" : "[STAGING] ";
}
exports.SUPPORT_LIMITS = {
    maxOpenPerTenant: 5,
    maxPerDay: 10,
    reopenWindowDays: 7,
    subjectMaxLength: 120,
    descriptionMaxLength: 4000,
    messageMaxLength: 4000,
};
const ATTACHMENT_TYPES = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
]);
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/**
 * Valida la evidencia adjunta leyendo su metadato REAL de Storage.
 *
 * Dos cosas que no se pueden delegar al cliente:
 *
 * 1. **La ruta.** El archivo se sube directo desde el navegador y solo después
 *    se le pasa la ruta a esta función. Sin comprobar que está bajo
 *    `tenants/{tenantId}/support/{uid}/` —el uid de QUIEN LLAMA, no un segmento
 *    libre—, cualquiera podría inyectar en el hilo un enlace a otro conjunto,
 *    a un archivo ajeno, o externo, que el equipo va a abrir.
 * 2. **El tamaño y el tipo.** La regla de Storage corta en 25 MB (gobernanza
 *    general del bucket), pero el límite fino de 5 MB y el tipo no pueden
 *    venir de ahí: el contentType de una subida lo declara el cliente, y
 *    fiarse de lo que declare sería fiarse de quien queremos validar. Aquí se
 *    lee el metadato REAL del objeto ya subido.
 *
 * Lo que no pasa el filtro se BORRA: un archivo subido que nunca llega a un
 * ticket es basura que nadie va a limpiar después.
 */
async function validateAttachments(entrada, tenantId, uid) {
    if (!Array.isArray(entrada) || entrada.length === 0)
        return [];
    if (entrada.length > MAX_ATTACHMENTS) {
        throw new https_1.HttpsError("invalid-argument", `Máximo ${MAX_ATTACHMENTS} archivos por mensaje.`);
    }
    const bucket = (0, storage_1.getStorage)().bucket();
    const prefijo = `tenants/${tenantId}/support/${uid}/`;
    const salida = [];
    for (const raw of entrada) {
        const path = typeof raw?.path === "string" ? raw.path : "";
        if (!path.startsWith(prefijo)) {
            throw new https_1.HttpsError("permission-denied", "El archivo no pertenece a este conjunto.");
        }
        const file = bucket.file(path);
        const [existe] = await file.exists();
        if (!existe)
            throw new https_1.HttpsError("not-found", "El archivo adjunto no se encontró.");
        const [meta] = await file.getMetadata();
        const size = Number(meta.size ?? 0);
        const contentType = String(meta.contentType ?? "");
        if (!ATTACHMENT_TYPES.has(contentType)) {
            await file.delete().catch(() => undefined);
            throw new https_1.HttpsError("invalid-argument", "Solo se aceptan imágenes o PDF.");
        }
        if (size > MAX_ATTACHMENT_BYTES) {
            await file.delete().catch(() => undefined);
            throw new https_1.HttpsError("invalid-argument", "Cada archivo debe pesar menos de 5 MB.");
        }
        salida.push({
            name: typeof raw?.name === "string" ? raw.name.slice(0, 160) : "archivo",
            path,
            url: typeof raw?.url === "string" ? raw.url : "",
            size,
            contentType,
        });
    }
    return salida;
}
const CATEGORIES = new Set(["tecnico", "facturacion", "operativo", "otro"]);
const PRIORITIES = new Set(["alta", "media", "baja"]);
const CLIENT_WRITABLE = new Set(["abierto", "en_proceso", "esperando_respuesta"]);
const CLOSED = "cerrado";
function text(value, max, field) {
    const out = typeof value === "string" ? value.trim() : "";
    if (!out)
        throw new https_1.HttpsError("invalid-argument", `Falta ${field}.`);
    if (out.length > max) {
        throw new https_1.HttpsError("invalid-argument", `${field} supera el límite de ${max} caracteres.`);
    }
    return out;
}
/**
 * Quién puede pedir soporte: administrador del conjunto o superadmin.
 *
 * **NO usa `assertTenantOperable` a propósito.** Ese guarda deja en solo
 * lectura a los conjuntos suspendidos y vencidos, y aquí sería exactamente lo
 * contrario de lo que hace falta: el soporte es el canal por el que un cliente
 * suspendido deja de estarlo. Encerrarlo fuera y quitarle la llave.
 */
async function assertSupportRequester(tenantId, uid, role) {
    if (role === "superadmin")
        return { role: "superadmin", fullName: "", email: "" };
    const snap = await getDb().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    if (!snap.exists) {
        throw new https_1.HttpsError("permission-denied", "No perteneces a este conjunto.");
    }
    const data = snap.data();
    if (data.role !== "tenant_admin" && data.role !== "admin_tenant") {
        // El residente y la portería no escriben a Vivaru: su canal es la
        // administración del conjunto (PQRS).
        throw new https_1.HttpsError("permission-denied", "Solo la administración del conjunto puede abrir tickets de soporte.");
    }
    return { role: "cliente", fullName: data.fullName ?? "", email: data.email ?? "" };
}
function assertSuperadmin(role) {
    if (role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "Solo el equipo de Vivaru puede realizar esta acción.");
    }
}
async function ticketOrThrow(ticketId) {
    const ref = getDb().collection("supportTickets").doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "El ticket no existe.");
    return { ref, data: snap.data() };
}
async function createSupportTicket(input, uid, role) {
    const db = getDb();
    const tenantId = typeof input.tenantId === "string" ? input.tenantId.trim() : "";
    if (!tenantId)
        throw new https_1.HttpsError("invalid-argument", "Falta el conjunto.");
    const solicitante = await assertSupportRequester(tenantId, uid, role);
    const category = CATEGORIES.has(input.category) ? input.category : "otro";
    const subject = text(input.subject, exports.SUPPORT_LIMITS.subjectMaxLength, "el asunto");
    const description = text(input.description, exports.SUPPORT_LIMITS.descriptionMaxLength, "la descripción");
    // ── Límites por conjunto ──────────────────────────────────────────────────
    // Frenan el abuso y los bucles de integración, no el uso normal. Se cuentan
    // ANTES de escribir, que es la razón por la que esto no puede ser una
    // escritura directa desde el cliente.
    const abiertos = await db
        .collection("supportTickets")
        .where("tenantId", "==", tenantId)
        .where("status", "in", ["abierto", "en_proceso", "esperando_respuesta", "resuelto"])
        .limit(exports.SUPPORT_LIMITS.maxOpenPerTenant + 1)
        .get();
    if (abiertos.size >= exports.SUPPORT_LIMITS.maxOpenPerTenant) {
        throw new https_1.HttpsError("failed-precondition", `Tienes ${exports.SUPPORT_LIMITS.maxOpenPerTenant} tickets sin cerrar. Cierra alguno antes de abrir otro.`);
    }
    const desdeAyer = new Date(Date.now() - 86_400_000).toISOString();
    const hoy = await db
        .collection("supportTickets")
        .where("tenantId", "==", tenantId)
        .where("createdAtIso", ">=", desdeAyer)
        .limit(exports.SUPPORT_LIMITS.maxPerDay + 1)
        .get();
    if (hoy.size >= exports.SUPPORT_LIMITS.maxPerDay) {
        throw new https_1.HttpsError("resource-exhausted", "Alcanzaste el máximo de tickets por día. Intenta mañana.");
    }
    // Se validan ANTES de crear el ticket: si la evidencia no sirve, es mejor
    // que el administrador lo sepa al enviar y no con el ticket ya abierto.
    const adjuntos = await validateAttachments(input.attachments, tenantId, uid);
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenant = tenantSnap.data();
    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data();
    const nowIso = new Date().toISOString();
    const ref = await db.collection("supportTickets").add({
        tenantId,
        tenantName: tenant?.name ?? tenantId,
        createdBy: uid,
        createdByName: user?.fullName ?? solicitante.fullName ?? "Administración",
        createdByEmail: user?.email ?? solicitante.email ?? "",
        category,
        subject,
        description,
        priority: "media",
        status: "abierto",
        thread: adjuntos.length
            ? [{
                    id: (0, node_crypto_1.randomUUID)(),
                    role: "cliente",
                    authorUid: uid,
                    authorName: user?.fullName ?? solicitante.fullName ?? "Administración",
                    message: "Evidencia adjunta.",
                    attachments: adjuntos,
                    createdAt: nowIso,
                }]
            : [],
        // ISO además del Timestamp: el filtro por rango del límite diario necesita
        // un campo comparable sin índice compuesto extra.
        createdAtIso: nowIso,
        lastActivityAt: nowIso,
        createdAt: firestore_1.Timestamp.now(),
        updatedAt: firestore_1.Timestamp.now(),
    });
    await notifyTeam({
        subject: `${envTag()}🎫 [Soporte] ${tenant?.name ?? tenantId} — ${subject}`,
        body: [
            `${user?.fullName ?? "Un administrador"} abrió un ticket de soporte.`,
            "",
            "— QUIÉN —",
            `Conjunto:  ${tenant?.name ?? tenantId}`,
            `Estado:    ${tenant?.status ?? "-"}${tenant?.planId ? ` · plan ${tenant.planId}` : ""}`,
            `Contacto:  ${user?.fullName ?? "-"} <${user?.email ?? "-"}>`,
            "",
            "— QUÉ PIDE —",
            `Categoría: ${category}`,
            `Asunto:    ${subject}`,
            adjuntos.length ? `Adjuntos:  ${adjuntos.length} archivo(s)` : "",
            "",
            description,
            "",
            `Ambiente:  ${tenantId}`,
        ].join("\n"),
    });
    return { ticketId: ref.id };
}
// ── Respuestas ──────────────────────────────────────────────────────────────
/**
 * `SUP-001` — qué marcas deja una respuesta. Función pura y exportada para
 * poder probarla sin emulador: es la parte del módulo que, si se equivoca,
 * destruye un dato que no se reconstruye.
 *
 * Dos reglas, y las dos son de idempotencia:
 *
 * 1. **`firstResponseAt` se escribe una sola vez.** Sobrescribirlo en cada
 *    respuesta haría que todos los tickets parecieran contestados al instante
 *    — la métrica marcaría siempre el último mensaje, no el primero.
 * 2. **La asignación automática no roba tickets.** Si ya hay responsable no se
 *    toca: puede habérselo asignado otra persona a propósito, y responder en
 *    un hilo ajeno no debería cambiar de quién es.
 *
 * Y ninguna de las dos aplica cuando escribe el cliente: que el cliente
 * conteste no es que Vivaru haya respondido.
 */
function marcasSup001(actual, ctx) {
    if (!ctx.esVivaru)
        return {};
    const marcas = {};
    if (!actual.firstResponseAt)
        marcas.firstResponseAt = ctx.nowIso;
    if (!actual.assignedTo) {
        marcas.assignedTo = ctx.uid;
        marcas.assignedToName = ctx.autorNombre;
        marcas.assignedAt = ctx.nowIso;
    }
    return marcas;
}
async function replySupportTicket(input, uid, role) {
    const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
    if (!ticketId)
        throw new https_1.HttpsError("invalid-argument", "Falta el ticket.");
    const message = text(input.message, exports.SUPPORT_LIMITS.messageMaxLength, "el mensaje");
    const { ref, data } = await ticketOrThrow(ticketId);
    // Un ticket cerrado no admite mensajes. Es lo que permite que el número de
    // pendientes signifique algo, y evita hilos que reviven meses después.
    if (data.status === CLOSED) {
        throw new https_1.HttpsError("failed-precondition", "Este ticket está cerrado. Abre uno nuevo citando el anterior.");
    }
    const esVivaru = role === "superadmin";
    let autorNombre = "Equipo Vivaru";
    if (!esVivaru) {
        const solicitante = await assertSupportRequester(data.tenantId, uid, role);
        autorNombre = solicitante.fullName || "Administración";
        if (!CLIENT_WRITABLE.has(data.status ?? "")) {
            throw new https_1.HttpsError("failed-precondition", "Este ticket ya no admite respuestas.");
        }
    }
    const adjuntos = await validateAttachments(input.attachments, data.tenantId, uid);
    const nowIso = new Date().toISOString();
    // Vivaru responde ⇒ la pelota pasa al cliente. El cliente responde ⇒ vuelve
    // a nuestra cola. Es lo que hace que «pendiente» sea un número accionable.
    const nuevoEstado = esVivaru ? "esperando_respuesta" : "en_proceso";
    const sup001 = marcasSup001(data, { esVivaru, uid, autorNombre, nowIso });
    await ref.update({
        // arrayUnion garantiza append: nada se edita ni se borra.
        thread: firestore_1.FieldValue.arrayUnion({
            id: (0, node_crypto_1.randomUUID)(),
            role: esVivaru ? "vivaru" : "cliente",
            authorUid: uid,
            authorName: autorNombre,
            message,
            ...(adjuntos.length ? { attachments: adjuntos } : {}),
            createdAt: nowIso,
        }),
        status: nuevoEstado,
        lastActivityAt: nowIso,
        updatedAt: firestore_1.Timestamp.now(),
        ...sup001,
    });
    if (esVivaru) {
        await notifyClient(data, "Tienes una respuesta de Vivaru", [
            `Respondimos tu ticket «${data.subject ?? ""}».`,
            "",
            message,
        ].join("\n"));
    }
    else {
        await notifyTeam({
            subject: `${envTag()}💬 [Soporte] ${data.tenantName ?? data.tenantId} — respuesta del cliente`,
            body: [
                `${autorNombre} respondió en «${data.subject ?? ""}».`,
                "",
                message,
                "",
                `Ambiente: ${data.tenantId}`,
            ].join("\n"),
        });
    }
    return { ok: true, status: nuevoEstado };
}
// ── Cambio de estado y prioridad ────────────────────────────────────────────
async function updateSupportTicket(input, uid, role) {
    assertSuperadmin(role);
    const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
    if (!ticketId)
        throw new https_1.HttpsError("invalid-argument", "Falta el ticket.");
    const { ref, data } = await ticketOrThrow(ticketId);
    if (data.status === CLOSED) {
        throw new https_1.HttpsError("failed-precondition", "Un ticket cerrado no admite cambios.");
    }
    const nowIso = new Date().toISOString();
    const patch = { lastActivityAt: nowIso, updatedAt: firestore_1.Timestamp.now() };
    if (input.priority) {
        if (!PRIORITIES.has(input.priority))
            throw new https_1.HttpsError("invalid-argument", "Prioridad inválida.");
        patch.priority = input.priority;
    }
    if (input.status) {
        const permitidos = ["abierto", "en_proceso", "esperando_respuesta", "resuelto", "cerrado"];
        if (!permitidos.includes(input.status))
            throw new https_1.HttpsError("invalid-argument", "Estado inválido.");
        patch.status = input.status;
        if (input.status === "resuelto")
            patch.resolvedAt = nowIso;
        if (input.status === CLOSED)
            patch.closedAt = nowIso;
    }
    // SUP-001 · asignación explícita. Se distingue «no viene» de «viene null»:
    // lo primero deja la asignación como esté (este update iba de otra cosa) y
    // lo segundo la retira a propósito. Con `undefined` en ambos casos no habría
    // forma de desasignar.
    if (input.assignedTo !== undefined) {
        if (input.assignedTo === null || input.assignedTo === "") {
            patch.assignedTo = firestore_1.FieldValue.delete();
            patch.assignedToName = firestore_1.FieldValue.delete();
            patch.assignedAt = firestore_1.FieldValue.delete();
        }
        else {
            // Solo se asigna a alguien de Vivaru: el soporte lo opera Vivaru, y un
            // ticket asignado a un administrador de conjunto no significaría nada.
            const destino = await (0, auth_1.getAuth)()
                .getUser(input.assignedTo)
                .catch(() => null);
            if (!destino)
                throw new https_1.HttpsError("not-found", "Esa persona no existe.");
            if (destino.customClaims?.role !== "superadmin") {
                throw new https_1.HttpsError("failed-precondition", "Solo se puede asignar a alguien de Vivaru.");
            }
            patch.assignedTo = input.assignedTo;
            // El nombre que manda el cliente es solo comodidad para pintar; si no
            // viene o viene vacío, la fuente fiable es la propia cuenta.
            const nombreEnviado = typeof input.assignedToName === "string" ? input.assignedToName.trim().slice(0, 120) : "";
            patch.assignedToName =
                nombreEnviado || destino.displayName || destino.email || "Equipo Vivaru";
            patch.assignedAt = nowIso;
        }
    }
    await ref.update(patch);
    if (input.status === "resuelto") {
        await notifyClient(data, "Tu ticket quedó resuelto", [
            `Marcamos como resuelto «${data.subject ?? ""}».`,
            "",
            `Si el problema sigue, puedes reabrirlo desde tu portal durante los próximos ${exports.SUPPORT_LIMITS.reopenWindowDays} días.`,
        ].join("\n"));
    }
    return { ok: true };
}
/**
 * Reapertura por el cliente. Va aparte de `updateSupportTicket` porque es la
 * única transición que provoca el cliente, y tiene su propia ventana.
 */
async function reopenSupportTicket(input, uid, role) {
    const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
    if (!ticketId)
        throw new https_1.HttpsError("invalid-argument", "Falta el ticket.");
    const message = text(input.message, exports.SUPPORT_LIMITS.messageMaxLength, "el mensaje");
    const { ref, data } = await ticketOrThrow(ticketId);
    await assertSupportRequester(data.tenantId, uid, role);
    if (data.status !== "resuelto") {
        throw new https_1.HttpsError("failed-precondition", "Solo se puede reabrir un ticket resuelto.");
    }
    const resolved = data.resolvedAt ? new Date(data.resolvedAt).getTime() : 0;
    const dias = (Date.now() - resolved) / 86_400_000;
    if (!resolved || dias > exports.SUPPORT_LIMITS.reopenWindowDays) {
        throw new https_1.HttpsError("failed-precondition", `La ventana de ${exports.SUPPORT_LIMITS.reopenWindowDays} días para reabrir ya pasó. Abre un ticket nuevo citando este.`);
    }
    const nowIso = new Date().toISOString();
    await ref.update({
        thread: firestore_1.FieldValue.arrayUnion({
            id: (0, node_crypto_1.randomUUID)(),
            role: "cliente",
            authorUid: uid,
            authorName: data.createdByName ?? "Administración",
            message,
            createdAt: nowIso,
        }),
        status: "en_proceso",
        resolvedAt: firestore_1.FieldValue.delete(),
        lastActivityAt: nowIso,
        updatedAt: firestore_1.Timestamp.now(),
    });
    await notifyTeam({
        subject: `${envTag()}🔁 [Soporte] ${data.tenantName ?? data.tenantId} — ticket reabierto`,
        body: [`Reabrieron «${data.subject ?? ""}».`, "", message, "", `Ambiente: ${data.tenantId}`].join("\n"),
    });
    return { ok: true };
}
/** Cierre por el cliente. Terminal: no se reabre. */
async function closeSupportTicket(input, uid, role) {
    const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
    if (!ticketId)
        throw new https_1.HttpsError("invalid-argument", "Falta el ticket.");
    const { ref, data } = await ticketOrThrow(ticketId);
    if (role !== "superadmin")
        await assertSupportRequester(data.tenantId, uid, role);
    if (data.status === CLOSED)
        return { ok: true };
    const nowIso = new Date().toISOString();
    await ref.update({
        status: CLOSED,
        closedAt: nowIso,
        lastActivityAt: nowIso,
        updatedAt: firestore_1.Timestamp.now(),
    });
    return { ok: true };
}
// ── Notas internas ──────────────────────────────────────────────────────────
/**
 * Nota interna del equipo. Va a la subcolección `internal`, que el cliente no
 * puede leer ni siquiera consultando el documento crudo.
 */
async function addSupportInternalNote(input, uid, role) {
    assertSuperadmin(role);
    const ticketId = typeof input.ticketId === "string" ? input.ticketId.trim() : "";
    if (!ticketId)
        throw new https_1.HttpsError("invalid-argument", "Falta el ticket.");
    const note = text(input.note, exports.SUPPORT_LIMITS.messageMaxLength, "la nota");
    const { ref } = await ticketOrThrow(ticketId);
    await ref.collection("internal").add({
        note,
        createdBy: uid,
        createdAt: firestore_1.Timestamp.now(),
    });
    return { ok: true };
}
// ── Correo ──────────────────────────────────────────────────────────────────
async function notifyTeam(input) {
    try {
        await (0, email_1.sendNotificationEmail)({
            to: supportInbox(),
            subject: input.subject,
            body: input.body,
            link: "/superadmin/support",
        });
    }
    catch (error) {
        // Best-effort: el ticket ya está guardado. Un fallo de correo no puede
        // deshacer una solicitud de ayuda.
        console.error("[soporte] correo al equipo falló", error);
    }
}
async function notifyClient(ticket, subject, body) {
    if (!ticket.createdByEmail)
        return;
    try {
        await (0, email_1.sendNotificationEmail)({
            to: ticket.createdByEmail,
            // Sin promesas de plazo: el producto no controla cuándo contesta una
            // persona, y prometerlo lo incumple la pantalla, no el equipo.
            subject: `${envTag()}${subject}`,
            body,
            link: "/admin/soporte",
            // `PLAT-006`: va a una PERSONA del conjunto, así que pasa por la puerta. Sin
            // `contexto`, que además escribiría fila de entrega en la bandeja del
            // administrador y este no es un correo de residente.
            tenantId: ticket.tenantId,
        });
    }
    catch (error) {
        console.error("[soporte] correo al cliente falló", error);
    }
}
