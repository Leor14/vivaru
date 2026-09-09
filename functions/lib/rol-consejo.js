"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aplicarMarcaDeConsejo = aplicarMarcaDeConsejo;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Concede o retira la marca de consejo sobre una membresía.
 *
 * `tenantId` llega **ya validado** por el guardián del llamador: esta función no
 * decide si el actor puede operar ese conjunto, decide si ESE DESTINATARIO puede
 * recibir la marca.
 */
async function aplicarMarcaDeConsejo(params) {
    const { tenantId, actorUid, targetUid, quiereLaMarca } = params;
    const db = (0, firestore_1.getFirestore)();
    // `CA10` — nadie se nombra a sí mismo. Hoy es además imposible por
    // construcción (quien concede es administrador y quien recibe tiene que ser
    // residente: dos valores del mismo campo), pero un invariante se escribe donde
    // se lee, no se deduce de otros dos.
    if (targetUid === actorUid) {
        throw new https_1.HttpsError("permission-denied", "No puedes concederte la marca de consejo a ti mismo.");
    }
    const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    // `RN-05` — la marca no sobrevive a su membresía. Si no hay membresía no hay
    // dónde ponerla: una persona del padrón SIN cuenta de acceso no tiene
    // documento aquí, y ese es el caso que trae este error.
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("not-found", "Esa persona no pertenece a este conjunto.");
    }
    const membership = (membershipSnap.data() ?? {});
    // `CA11`. El id lo compone esta función con un `tenantId` ya validado, pero el
    // CAMPO se comprueba igual: es la misma guarda que hace `identidadParaFirmar`,
    // y protege del dato mal escrito, no del llamador.
    if (membership.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "Esa persona pertenece a otro conjunto.");
    }
    // `RN-02` y `RN-03` · `CA12`. Solo un residente. Un `security_guard` no puede
    // recibirla y un `tenant_admin` no la necesita: ya ve más. Es
    // `invalid-argument` y no `failed-precondition` porque no es un estado que se
    // pueda arreglar y reintentar — ese destinatario nunca puede recibirla.
    if (membership.role !== "resident") {
        throw new https_1.HttpsError("invalid-argument", "Solo un residente del conjunto puede ser consejero.");
    }
    const yaLaTiene = membership.isCommittee === true;
    // Idempotente (§5): no escribe y no falla.
    if (yaLaTiene === quiereLaMarca) {
        return { ok: true, cambiado: false };
    }
    // La membresía inactiva solo bloquea al CONCEDER. **Retirar tiene que
    // funcionar siempre**: si no, a una membresía desactivada no se le podría
    // limpiar la marca y quedaría un permiso sin dueño operable.
    if (quiereLaMarca && (membership.status ?? "active") !== "active") {
        throw new https_1.HttpsError("failed-precondition", "Su membresía está inactiva. Actívala antes de nombrarla consejo.");
    }
    const now = firestore_1.Timestamp.now();
    // Al retirar se BORRAN `committeeSince` y `committeeGrantedBy`: dejarlos
    // pintaría «consejo desde…» sobre alguien que ya no lo es, y si más adelante
    // se le vuelve a nombrar la fecha tiene que ser la del nombramiento nuevo. El
    // rastro histórico no se pierde — vive en la auditoría (`RN-08`), que es donde
    // debe vivir. Y `RN-06` no depende de estos campos: la firma ya puesta lleva
    // el nombre y la fecha DENTRO del informe.
    await membershipRef.set(quiereLaMarca
        ? { isCommittee: true, committeeSince: now, committeeGrantedBy: actorUid, updatedAt: now }
        : {
            isCommittee: false,
            committeeSince: firestore_1.FieldValue.delete(),
            committeeGrantedBy: firestore_1.FieldValue.delete(),
            updatedAt: now,
        }, { merge: true });
    return { ok: true, cambiado: true };
}
