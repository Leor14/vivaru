"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fusionarPersonas = fusionarPersonas;
exports.descartarGrupoDeDuplicados = descartarGrupoDeDuplicados;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const referencias_a_persona_1 = require("./referencias-a-persona");
const tenant_membership_1 = require("./tenant-membership");
const tenant_status_1 = require("./tenant-status");
/**
 * `PRD-V-FEAT-005` — el padrón sin duplicados, del lado del servidor.
 *
 * **Por qué callable y no escritura del cliente.** Detectar es lectura pura y vive en el
 * navegador (`src/features/residents/duplicados.ts`); **fusionar y descartar no pueden**:
 * escriben en varias colecciones, tienen que ser atómicas hasta donde Firestore lo permite, y el
 * cliente no debe poder falsificar quién decidió ni qué se pisó. Y la razón que este repositorio
 * ya pagó: **una regla de Firestore no protege lo que escribe una callable**, así que el
 * invariante tiene que vivir aquí y la regla queda de refuerzo.
 */
const db = () => (0, firestore_1.getFirestore)();
const texto = (v) => (typeof v === "string" ? v.trim() : "");
/**
 * Rol primero, estado del conjunto al final (`CF7`).
 *
 * El orden no es cosmético y está escrito en `CLAUDE.md`: al revés, a un no-miembro se le
 * respondería «este conjunto está suspendido» en vez de «no tienes permiso», **filtrando el
 * estado comercial de un cliente a quien no es nadie**. El superadministrador sale antes porque
 * necesita operar un conjunto suspendido para reactivarlo.
 */
async function assertPuedeGestionarPadron(role, uid, tenantId) {
    const rol = typeof role === "string" ? role : "";
    if (rol === "superadmin" || rol === "super_admin")
        return;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para gestionar el padrón.");
    const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
    if (!esAdmin || !(await (0, tenant_membership_1.esAdminActivoDelConjunto)(tenantId, uid))) {
        throw new https_1.HttpsError("permission-denied", "No tienes permiso para gestionar el padrón de este conjunto.");
    }
    await (0, tenant_status_1.assertTenantOperable)(tenantId);
}
/** La huella del grupo, idéntica a la del cliente: sus ids ordenados. */
function claveDelGrupo(ids) {
    return [...ids].sort().join("·");
}
/**
 * Fusiona registros duplicados del padrón en un superviviente **elegido por una persona**.
 *
 * **El orden de los pasos es la parte que importa**, y cada uno responde a un criterio:
 *
 * 1. **Se barre ANTES de escribir** (`R4`, `CF3`). Si algo apunta a estas personas desde un campo
 *    que el inventario no conoce, la fusión **aborta sin haber tocado nada** — no hay «a medias».
 *    Es la lección de `mergeUnits`, que repuntaba nueve campos de dieciocho y borraba igual.
 * 2. **El `snapshot` se guarda ANTES de repuntar** (`R7`). Si la corrida muere a la mitad, lo
 *    pisado ya está copiado. **Sin snapshot no hay fusión**: sin él, «fusionar» es «borrar con un
 *    nombre amable», y `FIX-002` ya enseñó que una migración solo es reversible mientras se
 *    guardó el valor anterior.
 * 3. **Las personas se archivan, no se borran.** Se les escribe la decisión encima —hacia quién,
 *    quién y por qué—, que es lo que hace el archivador de huérfanos: archivar es registrar una
 *    decisión, no esconder un documento.
 */
async function fusionarPersonas(input, actor) {
    const tenantId = texto(input?.tenantId);
    const survivorId = texto(input?.survivorId);
    const motivo = texto(input?.motivo);
    const mergedIds = [...new Set((input?.mergedIds ?? []).map(texto).filter(Boolean))];
    if (!tenantId || !survivorId) {
        throw new https_1.HttpsError("invalid-argument", "Falta el conjunto o la persona que se conserva.");
    }
    // `CF2`: fusionar sin elegir superviviente no es una fusión, es un borrado.
    if (mergedIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "No hay ninguna persona que fusionar.");
    }
    if (mergedIds.includes(survivorId)) {
        throw new https_1.HttpsError("invalid-argument", "La persona que se conserva no puede estar entre las que se fusionan.");
    }
    if (!motivo) {
        throw new https_1.HttpsError("invalid-argument", "Escribe por qué son la misma persona. Sin motivo no se puede fusionar.");
    }
    await assertPuedeGestionarPadron(actor.role, actor.uid, tenantId);
    const firestore = db();
    const refs = [survivorId, ...mergedIds].map((id) => firestore.collection("people").doc(id));
    const snaps = await firestore.getAll(...refs);
    const docs = snaps.map((s, i) => {
        if (!s.exists) {
            throw new https_1.HttpsError("not-found", `La persona ${refs[i].id} no existe.`);
        }
        const datos = s.data();
        // `CF1` y `CF6`: ni el superadministrador fusiona entre conjuntos. Se comprueba documento a
        // documento y no solo contra el que pidieron, porque el `tenantId` viaja en la petición.
        if (texto(datos.tenantId) !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Una de las personas pertenece a otro conjunto.");
        }
        if (datos.fusionadaEn) {
            throw new https_1.HttpsError("failed-precondition", `«${datos.fullName ?? s.id}» ya se fusionó antes.`);
        }
        return { id: s.id, datos, raw: s.data() ?? {} };
    });
    // `R5` y `CF4`. **Cuentas DISTINTAS, no registros con cuenta**: dos fichas que apuntan al mismo
    // uid son una sola persona con el padrón duplicado, y ese es justo el caso que hay que poder
    // resolver. Lo que frena es que detrás de cada ficha haya una cuenta propia: fusionar a ciegas
    // deja a alguien sin acceso a lo suyo.
    const cuentas = [...new Set(docs.map((d) => texto(d.datos.authUid)).filter(Boolean))];
    if (cuentas.length > 1) {
        throw new https_1.HttpsError("failed-precondition", `Estas personas tienen ${cuentas.length} cuentas de acceso distintas (${cuentas.join(", ")}). ` +
            "Retira el acceso de la que no se conserva antes de fusionar.");
    }
    // ── 1. El barrido, ANTES de escribir nada (R4 / CF3) ──────────────────────
    const encontradas = await (0, referencias_a_persona_1.buscarReferenciasAPersona)(firestore, tenantId, mergedIds);
    const desconocidas = encontradas.filter((r) => !(0, referencias_a_persona_1.estaRegistrada)(r.coleccion, r.campo));
    if (desconocidas.length > 0) {
        const nombres = [...new Set(desconocidas.map((r) => `${r.coleccion}.${r.campo}`))].sort();
        throw new https_1.HttpsError("failed-precondition", `Hay referencias que el inventario no conoce (${nombres.join(", ")}). ` +
            "La fusión se detuvo sin tocar nada: registrarlas primero evita dejar documentos huérfanos.");
    }
    // ── 2. El snapshot, ANTES de repuntar (R7) ────────────────────────────────
    const decisionRef = firestore.collection("personMergeDecisions").doc();
    await decisionRef.set({
        tenantId,
        tipo: "fusion",
        claveDelGrupo: claveDelGrupo([survivorId, ...mergedIds]),
        survivorId,
        mergedIds,
        motivo,
        // La copia de lo que se va a pisar: los documentos enteros y las referencias que se moverán.
        snapshot: {
            personas: Object.fromEntries(docs.filter((d) => d.id !== survivorId).map((d) => [d.id, d.raw])),
            referencias: encontradas,
        },
        estado: "en-curso",
        decidedBy: actor.uid ?? null,
        decidedAt: firestore_1.Timestamp.now(),
    });
    // ── 3. Repuntar ───────────────────────────────────────────────────────────
    let repuntadas = 0;
    for (const grupo of agruparPorDocumento(encontradas)) {
        const ref = firestore.collection(grupo.coleccion).doc(grupo.docId);
        const cambios = {};
        for (const r of grupo.referencias) {
            if (r.esLista) {
                // Dos operaciones sobre el mismo campo no caben en un solo `update`, así que las listas
                // van por separado y en su propio paso.
                continue;
            }
            cambios[r.campo] = survivorId;
            repuntadas += 1;
        }
        if (Object.keys(cambios).length > 0)
            await ref.update(cambios);
        for (const r of grupo.referencias.filter((x) => x.esLista)) {
            await ref.update({ [r.campo]: firestore_1.FieldValue.arrayRemove(r.personaId) });
            await ref.update({ [r.campo]: firestore_1.FieldValue.arrayUnion(survivorId) });
            repuntadas += 1;
        }
    }
    // ── 4. Archivar, no borrar ────────────────────────────────────────────────
    const lote = firestore.batch();
    for (const id of mergedIds) {
        lote.set(firestore.collection("people").doc(id), {
            fusionadaEn: firestore_1.Timestamp.now(),
            fusionadaHaciaId: survivorId,
            fusionadaMotivo: motivo,
            fusionadaPor: actor.uid ?? null,
            updatedAt: firestore_1.Timestamp.now(),
        }, { merge: true });
    }
    await lote.commit();
    await decisionRef.update({ estado: "completada", repuntadas });
    return { ok: true, fusionadas: mergedIds.length, repuntadas, decisionId: decisionRef.id };
}
function agruparPorDocumento(referencias) {
    const mapa = new Map();
    for (const r of referencias) {
        const clave = `${r.coleccion}/${r.docId}`;
        const actual = mapa.get(clave) ?? { coleccion: r.coleccion, docId: r.docId, referencias: [] };
        actual.referencias.push(r);
        mapa.set(clave, actual);
    }
    return [...mapa.values()];
}
/**
 * Marca un grupo como «no son la misma persona», con motivo (`CF5`).
 *
 * **El descarte NO es para siempre, y esa es la parte que se olvida.** Se guarda contra la huella
 * de los ids del grupo: si mañana entra un cuarto homónimo, la huella cambia y el grupo **vuelve
 * a salir**. Un descarte que silencia para siempre convierte esta pantalla en el sitio donde los
 * problemas se esconden.
 */
async function descartarGrupoDeDuplicados(input, actor) {
    const tenantId = texto(input?.tenantId);
    const motivo = texto(input?.motivo);
    const ids = [...new Set((input?.ids ?? []).map(texto).filter(Boolean))];
    if (!tenantId || ids.length < 2) {
        throw new https_1.HttpsError("invalid-argument", "Un grupo necesita al menos dos personas.");
    }
    if (!motivo) {
        throw new https_1.HttpsError("invalid-argument", "Escribe por qué no son la misma persona.");
    }
    await assertPuedeGestionarPadron(actor.role, actor.uid, tenantId);
    const firestore = db();
    const snaps = await firestore.getAll(...ids.map((id) => firestore.collection("people").doc(id)));
    for (const s of snaps) {
        const datos = s.data();
        if (!s.exists || texto(datos?.tenantId) !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Una de las personas pertenece a otro conjunto.");
        }
    }
    const clave = claveDelGrupo(ids);
    await firestore.collection("personMergeDecisions").doc(`${tenantId}__${hash(clave)}`).set({
        tenantId,
        tipo: "descarte",
        claveDelGrupo: clave,
        mergedIds: ids,
        motivo,
        decidedBy: actor.uid ?? null,
        decidedAt: firestore_1.Timestamp.now(),
    });
    return { ok: true, clave };
}
/** Huella corta y estable para el id del documento: la clave lleva «·» y puede ser larga. */
function hash(valor) {
    let h = 0;
    for (let i = 0; i < valor.length; i += 1)
        h = (Math.imul(31, h) + valor.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}
