"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOLERANCIA_SUMA = void 0;
exports.repartirPorCoeficiente = repartirPorCoeficiente;
exports.generarCorridaPorCoeficiente = generarCorridaPorCoeficiente;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const vocabulario_pais_1 = require("./vocabulario-pais");
/**
 * `PRD-V-PLAT-001` — corrida de cobro por coeficiente de copropiedad.
 *
 * **Qué había antes.** La corrida masiva escribe un solo `unitAmount` y lo
 * replica a todas las unidades: solo es correcto cuando todas son iguales,
 * que en propiedad horizontal es la excepción. Y la escribía el navegador,
 * statement a statement.
 *
 * **Tres decisiones que sostienen este módulo:**
 *
 * 1. **La aritmética del reparto es del servidor** (mismo criterio que
 *    FIN-001): el cliente dice el total y el servidor calcula cuánto le toca
 *    a cada unidad. Un cliente manipulado no puede emitir cargos con importes
 *    inventados — la vista previa también la sirve el servidor (`dryRun`),
 *    para que la lógica no viva duplicada (PRD §11.4 de FLOW-002 aplica igual
 *    aquí: si el reparto se duplica, se duplica el riesgo).
 * 2. **El residuo se asigna por resto mayor** (R6): cada importe se redondea
 *    hacia abajo a la unidad monetaria que el producto muestra, y las
 *    unidades con mayor parte truncada reciben una unidad más hasta agotar el
 *    residuo. La suma de los cargos es EXACTAMENTE el total repartido — CA3 y
 *    CA4 lo fijan en pruebas.
 * 3. **Solo se genera con la base cuadrada** (R2): la suma de coeficientes de
 *    las unidades activas debe estar en 100 ± 1e-6. Guardar un conjunto
 *    descuadrado se permite; generar con él, no.
 *
 * La moneda decide los decimales (D3, cerrada 21 ago 2026): COP opera en
 * pesos enteros; MXN y USD en centavos. Espejo del FRACTION_DIGITS de
 * `src/lib/currency.ts` — si cambias uno, cambia el otro.
 */
const db = () => (0, firestore_1.getFirestore)();
/** Decimales por moneda — espejo de `src/lib/currency.ts` (D3, PLAT-001). */
const FRACTION_DIGITS = {
    COP: 0,
    MXN: 2,
    USD: 2,
};
exports.TOLERANCIA_SUMA = 0.000001;
/**
 * Valida la base y reparte. Función pura: se prueba entera sin Firestore.
 * Lanza HttpsError con el detalle exacto de qué falta — R4: la unidad sin
 * coeficiente se NOMBRA, no se dice "hay un error".
 */
function repartirPorCoeficiente(total, unidades, currency, 
/**
 * Cómo se llama el coeficiente en el país del conjunto: «coeficiente» en
 * Colombia, «alícuota» en Ecuador, «indiviso» en México. Los mensajes de
 * abajo los lee una persona, y decirle «coeficiente» a quien su ley llama
 * «indiviso» es un error sobre algo que no reconoce. Ver
 * `functions/src/vocabulario-pais.ts`.
 */
termino = "porcentaje") {
    if (!(total > 0)) {
        throw new https_1.HttpsError("invalid-argument", "El total a repartir debe ser mayor que cero.");
    }
    // R3: las inactivas no reciben cargo ni cuentan para la suma.
    const activas = unidades.filter((u) => u.status !== "inactive");
    if (activas.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "El conjunto no tiene unidades activas.");
    }
    const sinCoeficiente = activas.filter((u) => typeof u.coefficient !== "number" || Number.isNaN(u.coefficient));
    if (sinCoeficiente.length > 0) {
        const nombres = sinCoeficiente.slice(0, 5).map((u) => u.unitLabel).join(", ");
        const extra = sinCoeficiente.length > 5 ? ` y ${sinCoeficiente.length - 5} más` : "";
        throw new https_1.HttpsError("failed-precondition", `No se puede generar por ${termino}: sin ${termino} ${nombres}${extra}.`);
    }
    const suma = activas.reduce((acc, u) => acc + u.coefficient, 0);
    if (Math.abs(suma - 100) > exports.TOLERANCIA_SUMA) {
        throw new https_1.HttpsError("failed-precondition", `La suma de ${termino === "alícuota" ? "alícuotas" : `${termino}s`} es ${suma.toFixed(6)}% y debe ser 100%. Corrige el reparto antes de generar.`);
    }
    // R5: el cargo necesita a quién emitirse. Responsable designado o primer
    // propietario; sin ninguno, la unidad bloquea la corrida y se nombra.
    const sinResponsable = activas.filter((u) => !u.billingResponsiblePersonId && !(Array.isArray(u.ownerIds) && u.ownerIds.length > 0));
    if (sinResponsable.length > 0) {
        const nombres = sinResponsable.slice(0, 5).map((u) => u.unitLabel).join(", ");
        const extra = sinResponsable.length > 5 ? ` y ${sinResponsable.length - 5} más` : "";
        throw new https_1.HttpsError("failed-precondition", `Estas unidades no tienen responsable ni propietario: ${nombres}${extra}.`);
    }
    // R6 · resto mayor, en unidades menores enteras para no arrastrar coma
    // flotante: se trabaja en centavos (o pesos enteros en COP) y se vuelve al
    // final.
    const digits = FRACTION_DIGITS[currency] ?? 0;
    const factor = 10 ** digits;
    const totalMinor = Math.round(total * factor);
    const exactos = activas.map((u) => (totalMinor * u.coefficient) / 100);
    const pisos = exactos.map((v) => Math.floor(v));
    let residuo = totalMinor - pisos.reduce((a, b) => a + b, 0);
    // Orden por parte decimal truncada, descendente. Empates: por etiqueta,
    // para que el resultado sea determinista y explicable.
    const orden = activas
        .map((u, i) => ({ i, frac: exactos[i] - pisos[i], label: u.unitLabel }))
        .sort((a, b) => b.frac - a.frac || a.label.localeCompare(b.label, "es-CO"));
    const ajustes = new Array(activas.length).fill(0);
    for (const { i } of orden) {
        if (residuo <= 0)
            break;
        ajustes[i] = 1;
        residuo -= 1;
    }
    const lines = activas.map((u, i) => ({
        unitId: u.id,
        unitLabel: u.unitLabel,
        coefficient: u.coefficient,
        amount: (pisos[i] + ajustes[i]) / factor,
        roundingAdjustment: ajustes[i] / factor,
    }));
    return { lines, total, coefficientSum: suma };
}
/**
 * Vista previa y generación de la corrida. La membresía la validó index.ts;
 * aquí se lee la base, se reparte y —solo sin `dryRun`— se escribe campaña y
 * cargos en un batch, con el id de campaña derivado de `operationKey` para
 * que el doble clic no cree dos corridas.
 */
async function generarCorridaPorCoeficiente(input, uid) {
    const firestore = db();
    const tenantSnap = await firestore.collection("tenants").doc(input.tenantId).get();
    if (!tenantSnap.exists)
        throw new https_1.HttpsError("not-found", "El conjunto no existe.");
    const currency = (tenantSnap.data().currency ?? "COP").toUpperCase();
    const unitsSnap = await firestore
        .collection("units")
        .where("tenantId", "==", input.tenantId)
        .get();
    const unidades = unitsSnap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            unitLabel: data.displayName ?? d.id,
            coefficient: data.coefficient,
            status: data.status,
            billingResponsiblePersonId: data.billingResponsiblePersonId,
            ownerIds: data.ownerIds,
        };
    });
    const tenantData = tenantSnap.data();
    const reparto = repartirPorCoeficiente(input.totalAmount, unidades, currency, (0, vocabulario_pais_1.terminoCoeficiente)(tenantData.country));
    if (input.dryRun) {
        return { ok: true, dryRun: true, ...reparto };
    }
    // Idempotencia por clave: el id de la campaña ES la clave normalizada. Un
    // reintento encuentra el documento y devuelve lo ya creado sin duplicar.
    const campaignId = `coef_${input.operationKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
    const campaignRef = firestore.collection("billingCampaigns").doc(campaignId);
    const existing = await campaignRef.get();
    if (existing.exists) {
        return { ok: true, dryRun: false, campaignId, created: false, ...reparto };
    }
    const batch = firestore.batch();
    batch.set(campaignRef, {
        tenantId: input.tenantId,
        concept: input.concept ?? "administracion",
        period: input.period,
        // `unitAmount` queda en 0 a propósito: esta corrida NO tiene importe
        // plano. El campo se conserva por compatibilidad con la lista existente.
        unitAmount: 0,
        distributionBasis: "coefficient",
        totalDistributed: reparto.total,
        dueDate: input.dueDate ?? null,
        unitCount: reparto.lines.length,
        source: "immediate",
        status: "vigente",
        sentAt: firestore_1.FieldValue.serverTimestamp(),
        createdBy: uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    for (const line of reparto.lines) {
        const stmtRef = firestore.collection("billingStatements").doc();
        batch.set(stmtRef, {
            tenantId: input.tenantId,
            unitId: line.unitId,
            unitLabel: line.unitLabel,
            period: input.period,
            concept: input.concept ?? "administracion",
            campaignId,
            amount: line.amount,
            paymentAmount: 0,
            balance: line.amount,
            // R8/CA12: el coeficiente viaja congelado en el cargo. Si mañana cambia
            // en la unidad, este cargo sigue explicando por qué vale lo que vale.
            distributionBasisValue: line.coefficient,
            ...(line.roundingAdjustment > 0 ? { roundingAdjustment: line.roundingAdjustment } : {}),
            ...(input.dueDate ? { dueDate: input.dueDate } : {}),
            status: "pending",
            createdBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    return { ok: true, dryRun: false, campaignId, created: true, ...reparto };
}
