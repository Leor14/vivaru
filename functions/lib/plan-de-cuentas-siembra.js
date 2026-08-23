"use strict";
/**
 * Plan de cuentas — la siembra (`PRD-V-PLAT-003`, entrega 1b-ii, regla **R1**).
 *
 * Vive aparte de `plan-de-cuentas.ts` **a propósito**: aquel módulo es puro —sin
 * Firestore ni callables— para poder probar sin emulador la parte que decide en
 * qué cuenta cae el dinero. Meter aquí un `getFirestore()` le quitaría eso.
 *
 * ## Dos decisiones que no son obvias
 *
 * **El id es derivado, no aleatorio.** `{tenantId}_{code}` es lo que hace que la
 * unicidad del código por conjunto la garantice la base de datos y no una
 * comprobación previa del cliente, que dos pestañas abiertas ganan a la vez
 * (PRD §11.1). La regla de Firestore exige además que el `code` del documento
 * coincida con su id, o la unicidad se burla escribiendo bajo otro id.
 *
 * **No pisa lo que ya existe.** Sembrar es idempotente, pero la forma barata de
 * conseguirlo —`set()` sobre el id derivado— **borraría el nombre que el
 * administrador le haya puesto a una cuenta**, que es justo lo que R3 permite
 * cambiar. Así que se lee primero y solo se escriben las que faltan. Cuesta una
 * consulta y evita que reejecutar el alta deshaga trabajo humano.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sembrarPlanDeCuentas = sembrarPlanDeCuentas;
const firestore_1 = require("firebase-admin/firestore");
const plan_de_cuentas_1 = require("./plan-de-cuentas");
/**
 * Escribe las 20 cuentas del plan estándar del conjunto, saltándose las que ya
 * existan. Devuelve el reparto para poder registrarlo en la auditoría del alta.
 *
 * Si se pasa un `batch`, las escrituras se acumulan en él y **no se hace commit**
 * —el llamante decide cuándo—; si no, se usa un batch propio y se commitea aquí.
 */
async function sembrarPlanDeCuentas(db, tenantId, uid, batchExterno) {
    const coleccion = db.collection("chartOfAccounts");
    const existentesSnap = await coleccion.where("tenantId", "==", tenantId).get();
    const yaEstan = new Set(existentesSnap.docs.map((d) => d.id));
    const batch = batchExterno ?? db.batch();
    let creadas = 0;
    for (const cuenta of plan_de_cuentas_1.SEMILLA_PLAN_DE_CUENTAS) {
        const docId = (0, plan_de_cuentas_1.docIdDeCuenta)(tenantId, cuenta.code);
        if (yaEstan.has(docId))
            continue;
        batch.set(coleccion.doc(docId), {
            tenantId,
            code: cuenta.code,
            name: cuenta.name,
            type: cuenta.type,
            ...(cuenta.parentCode ? { parentCode: cuenta.parentCode } : {}),
            ...(cuenta.systemKey ? { systemKey: cuenta.systemKey } : {}),
            status: "active",
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            ...(uid ? { createdBy: uid } : {}),
        });
        creadas += 1;
    }
    if (!batchExterno && creadas > 0)
        await batch.commit();
    return { creadas, existentes: plan_de_cuentas_1.SEMILLA_PLAN_DE_CUENTAS.length - creadas };
}
