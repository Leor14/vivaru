"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardarAdministradora = guardarAdministradora;
exports.asociarConjunto = asociarConjunto;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * **La empresa administradora** — `PRD-V-PLAT-002` §7.1, paso 3 del MVP.
 *
 * La lógica vive aquí y no en `index.ts` por lo mismo que `tenant-status.ts` y
 * `tenant-membership.ts`: para que se pueda probar sin arrastrar el índice.
 *
 * **Va por callable y no por escritura directa** (§11.1) por dos motivos que no
 * son el mismo: `managementCompanies` es una colección **sin `tenantId`**, fuera
 * del modelo que las reglas saben proteger por conjunto; y asociar un conjunto
 * escribe en `tenants`, que gobierna facturación y ciclo de vida.
 *
 * La regla de Firestore cierra la escritura a TODOS —`if false`—, no «solo
 * superadmin». El Admin SDK no la evalúa, así que dejarla abierta al superadmin
 * sería una segunda puerta al mismo sitio; la lección de `CF8` es que las dos
 * puertas se olvidan por separado.
 */
const db = () => (0, firestore_1.getFirestore)();
function texto(valor, campo) {
    const out = typeof valor === "string" ? valor.trim() : "";
    if (!out)
        throw new https_1.HttpsError("invalid-argument", `Falta ${campo}.`);
    return out;
}
function opcional(valor) {
    const out = typeof valor === "string" ? valor.trim() : "";
    return out || null;
}
/**
 * Alta o edición de una administradora. Solo superadmin (G5): quien la crea es
 * el equipo de Vivaru, en el alta comercial.
 *
 * **Al renombrar, el nombre se propaga a sus conjuntos.** Es el precio de haber
 * desnormalizado `managementCompanyName` en `tenants` para que los miembros lo
 * vean sin abrir el registro: si no se propagara, el residente vería para
 * siempre el nombre viejo y nadie se enteraría. Se hace en lote y **solo cuando
 * el nombre cambia de verdad**.
 */
async function guardarAdministradora(input, uid) {
    const nombre = texto(input.name, "el nombre de la administradora");
    const pais = texto(input.country, "el país");
    const estado = input.status === "inactive" ? "inactive" : "active";
    const firestore = db();
    const ref = input.id
        ? firestore.collection("managementCompanies").doc(texto(input.id, "la administradora"))
        : firestore.collection("managementCompanies").doc();
    const previo = input.id ? await ref.get() : null;
    if (input.id && (!previo || !previo.exists)) {
        throw new https_1.HttpsError("not-found", "Esa administradora no existe.");
    }
    const nombrePrevio = previo?.exists ? previo.data().name : undefined;
    await ref.set({
        name: nombre,
        taxId: opcional(input.taxId),
        country: pais,
        contactEmail: opcional(input.contactEmail),
        contactPhone: opcional(input.contactPhone),
        status: estado,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        ...(previo?.exists ? {} : { createdAt: firestore_1.FieldValue.serverTimestamp(), createdBy: uid }),
    }, { merge: true });
    let conjuntosRenombrados = 0;
    if (nombrePrevio !== undefined && nombrePrevio !== nombre) {
        const suyos = await firestore.collection("tenants").where("managementCompanyId", "==", ref.id).get();
        const lote = firestore.batch();
        for (const d of suyos.docs)
            lote.update(d.ref, { managementCompanyName: nombre });
        await lote.commit();
        conjuntosRenombrados = suyos.size;
    }
    return { ok: true, id: ref.id, conjuntosRenombrados };
}
/**
 * Asocia o desasocia un conjunto. Solo superadmin.
 *
 * **R5 — un conjunto pertenece a lo sumo a UNA administradora**, y por eso
 * mover uno de una a otra se RECHAZA en vez de reasignarse en silencio: pasar
 * quince conjuntos de dueño es una operación comercial, no un `update`. Para
 * moverlo hay que desasociarlo antes, y ese segundo paso es el que da la
 * oportunidad de darse cuenta.
 *
 * **R6 — no toca ninguna membresía.** La asociación es comercial y el acceso es
 * operativo: son ejes independientes, y mezclarlos daría acceso a quince
 * conjuntos por una decisión de facturación.
 *
 * **R4 — no toca el estado del conjunto.** Ni al asociar ni al desasociar.
 */
async function asociarConjunto(input) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const pedido = input.managementCompanyId === null ? null : opcional(input.managementCompanyId);
    const firestore = db();
    const tenantRef = firestore.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists)
        throw new https_1.HttpsError("not-found", "Ese conjunto no existe.");
    const actual = tenantSnap.data().managementCompanyId ?? null;
    if (pedido === null) {
        if (actual === null)
            return { ok: true, cambiado: false };
        await tenantRef.update({
            managementCompanyId: firestore_1.FieldValue.delete(),
            managementCompanyName: firestore_1.FieldValue.delete(),
        });
        return { ok: true, cambiado: true };
    }
    if (actual !== null && actual !== pedido) {
        throw new https_1.HttpsError("failed-precondition", "Ese conjunto ya pertenece a otra administradora. Desasócialo primero.");
    }
    if (actual === pedido)
        return { ok: true, cambiado: false };
    const companySnap = await firestore.collection("managementCompanies").doc(pedido).get();
    if (!companySnap.exists)
        throw new https_1.HttpsError("not-found", "Esa administradora no existe.");
    await tenantRef.update({
        managementCompanyId: pedido,
        managementCompanyName: companySnap.data().name ?? null,
    });
    return { ok: true, cambiado: true };
}
