"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esAdminActivoDelConjunto = esAdminActivoDelConjunto;
exports.esMiembroDelConjunto = esMiembroDelConjunto;
const firestore_1 = require("firebase-admin/firestore");
/**
 * ¿Es `uid` administrador ACTIVO del conjunto `tenantId`?
 *
 * **La autoridad sobre qué conjunto puede operar alguien es el documento de
 * membresía (`tenantUsers/{tenantId}_{uid}`), nunca el claim del token.** El
 * claim `tenantId` significa «el último conjunto conocido» y es de un solo
 * valor por diseño (`PRD-V-PLAT-002` §7.4): compararlo con el conjunto pedido
 * hace imposible que un mismo administrador opere dos conjuntos aunque tenga
 * membresía válida en ambos.
 *
 * **Por qué vive aquí y no en `index.ts`.** Mismo movimiento, y por el mismo
 * motivo, que `assertTenantOperable` → `tenant-status.ts`: `payments.ts` y
 * `advances.ts` no pueden importar el índice sin un ciclo. `index.ts` tiene su
 * propio `assertActiveTenantAdmin`, que además valida el perfil de la cuenta y
 * el estado del conjunto; esto es la pieza mínima —¿membresía de admin, activa,
 * en ESTE conjunto?— para que cada llamador componga su propia secuencia y
 * lance **su** mensaje. En la ruta del dinero el orden de las comprobaciones
 * está razonado y no puede heredarse de otra función (ver `assertPuedeCobrar`).
 *
 * Devuelve un booleano y no lanza a propósito: el mensaje de denegación es del
 * llamador. Un `false` no distingue «no eres miembro» de «tu membresía está
 * inactiva», y eso es deliberado — hacia fuera las dos son «no tienes permiso».
 */
async function esAdminActivoDelConjunto(tenantId, uid) {
    if (!tenantId || !uid)
        return false;
    const snap = await (0, firestore_1.getFirestore)().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    if (!snap.exists)
        return false;
    const membresia = snap.data();
    if (!membresia)
        return false;
    // El id del documento ya lleva el conjunto, pero el campo se comprueba igual:
    // es la misma defensa que hace `assertActiveTenantAdmin` y cubre un documento
    // escrito con el campo y el id discrepando.
    if (membresia.tenantId !== tenantId)
        return false;
    if (membresia.role !== "tenant_admin" && membresia.role !== "admin_tenant")
        return false;
    // Sin `status` explícito se asume activa, igual que `assertActiveTenantAdmin`
    // y que el resto del producto: hay membresías anteriores al campo.
    return (membresia.status ?? "active") === "active";
}
/**
 * ¿Es `uid` miembro del conjunto `tenantId`, con el rol que sea?
 *
 * El gemelo sin rol de `esAdminActivoDelConjunto`, para lo que solo necesita
 * saber **si la persona pertenece al conjunto**: atribuir una medición, archivar
 * un error, elegir el conjunto sobre el que trabaja una operación asistida.
 *
 * Existe porque el claim del token dejó de servir para eso. Antes de `PLAT-002`
 * el claim y el conjunto activo eran siempre el mismo valor, así que media
 * docena de sitios lo usaban como sinónimo de «dónde está trabajando esta
 * persona». Con el selector pueden diferir, y esos sitios pasan a mentir **sin
 * aviso y sin error**: la medición se le carga a otro cliente y el error se
 * archiva en un conjunto donde nunca ocurrió.
 *
 * **La membresía no autoriza aquí, identifica.** Quien llame con esto sigue
 * teniendo que comprobar el rol si lo que hace lo necesita.
 */
async function esMiembroDelConjunto(tenantId, uid) {
    if (!tenantId || !uid)
        return false;
    const snap = await (0, firestore_1.getFirestore)().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    if (!snap.exists)
        return false;
    const membresia = snap.data();
    if (!membresia)
        return false;
    if (membresia.tenantId !== tenantId)
        return false;
    return (membresia.status ?? "active") === "active";
}
