"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumarPagado = exports.estadoDerivado = void 0;
exports.pagarCuota = pagarCuota;
exports.anularCuota = anularCuota;
exports.anularEgresoConCuotas = anularEgresoConCuotas;
exports.guardarPlan = guardarPlan;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const nucleo_estado_financiero_1 = require("./nucleo-estado-financiero");
Object.defineProperty(exports, "estadoDerivado", { enumerable: true, get: function () { return nucleo_estado_financiero_1.estadoDerivadoDelPlan; } });
Object.defineProperty(exports, "sumarPagado", { enumerable: true, get: function () { return nucleo_estado_financiero_1.sumarPagadoDelPlan; } });
const plan_de_cuentas_1 = require("./plan-de-cuentas");
/**
 * `PRD-V-FLOW-008`, entrega 2 — pagar y anular una cuota.
 *
 * ## Por qué esto es CALLABLE y declarar el plan no
 *
 * La ficha parte la escritura a propósito (§11), y las dos mitades tienen motivo
 * distinto:
 *
 *   - **Declarar el plan** es captura de datos sobre una colección que ya se
 *     escribe desde el cliente, y sus reglas (`RN-01`–`RN-03`) son de forma.
 *   - **Pagar una cuota** escribe en **dos sitios** —la cuota y el libro—, mueve
 *     dinero, y sella `paidAmount` y el estado derivado del egreso. **Un campo
 *     escribible desde el cliente no puede sostener un invariante**: bajar la
 *     deuda del conjunto sería editar un número.
 *
 * **Esto cambia el patrón de hoy**, donde marcar un egreso como pagado es
 * escritura directa y **el propio navegador crea el asiento**. Con una fecha y un
 * importe eso era defendible; con un plan aparece un invariante y deja de serlo.
 *
 * ## La cuenta contable se DERIVA, y este bloque decía lo contrario
 *
 * Decía que «sale del egreso, no se vuelve a calcular», con dos afirmaciones que
 * al medirlas el 4 de septiembre de 2026 resultaron **falsas las dos**: que el
 * egreso guarda su `accountCode` —**0 de 52 en producción**, porque no es un
 * campo del egreso: lo escribe el ASIENTO— y que el mapa vive solo en `src/`
 * —el gemelo es `cuentaParaCategoriaDeEgreso`, aquí al lado, y `trial-seed` ya
 * lo usaba—. Con eso, evitar «una segunda implementación» acababa escribiendo
 * `accountCode: null` en todos los asientos de cuota, que es justo la rama de
 * respaldo que `R9` quiere evitar.
 *
 * **Los tres sitios que escriben este asiento derivan ahora del mismo mapa.**
 *
 * ## La forma del asiento
 *
 * **Idéntica a la que crea el camino del egreso sin plan** (`createExpenseLedgerEntry`):
 * `type: "egreso"`, `sourceType: "expense"`, `sourceId` el egreso y `reconciled:
 * false`. Si el asiento de una cuota tuviera otra forma, **la conciliación
 * dejaría de emparejarlo** y el estado financiero lo agruparía en otro sitio.
 * Lo único que se añade es `installmentNumber`, para poder volver de un asiento a
 * su cuota.
 */
const db = () => (0, firestore_1.getFirestore)();
function leerEgreso(snap, tenantId) {
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Ese egreso no existe.");
    const e = snap.data();
    if (e.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "Ese egreso no pertenece a este conjunto.");
    }
    return e;
}
function exigirPlan(e) {
    const cuotas = e.installments;
    if (!cuotas || cuotas.length === 0) {
        throw new https_1.HttpsError("failed-precondition", "Ese egreso no tiene plan de cuotas. Se paga cambiando su estado, como siempre.");
    }
    return cuotas;
}
/**
 * Paga una cuota: la marca, **crea su asiento** y vuelve a derivar el estado del
 * egreso. Todo **dentro de una transacción**.
 *
 * Que sea atómico no es cosmética: entre marcar la cuota y escribir el asiento
 * hay dos escrituras, y si solo cuajara la primera el conjunto tendría una cuota
 * pagada **que no aparece en el libro** — dinero que salió y que ningún informe
 * cuenta. Es la lección de `un-error-despues-del-commit` puesta antes del commit.
 */
async function pagarCuota(input, uid) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt ?? "")) {
        throw new https_1.HttpsError("invalid-argument", "La fecha de pago debe tener la forma AAAA-MM-DD.");
    }
    const firestore = db();
    const ref = firestore.collection("expenses").doc(input.expenseId);
    const asientoRef = firestore.collection("ledgerEntries").doc();
    return firestore.runTransaction(async (tx) => {
        const egreso = leerEgreso(await tx.get(ref), input.tenantId);
        if (egreso.status === "anulado") {
            throw new https_1.HttpsError("failed-precondition", "Ese egreso está anulado: sus cuotas ya no se pagan.");
        }
        const cuotas = exigirPlan(egreso);
        const i = cuotas.findIndex((c) => c.number === input.installmentNumber);
        if (i < 0)
            throw new https_1.HttpsError("not-found", `Ese egreso no tiene una cuota ${input.installmentNumber}.`);
        const cuota = cuotas[i];
        // Reintento idempotente: no se escribe un segundo asiento por el mismo pago.
        if (cuota.status === "pagada") {
            return {
                ok: true,
                ledgerEntryId: cuota.ledgerEntryId ?? "",
                paidAmount: (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(cuotas),
                expenseStatus: (0, nucleo_estado_financiero_1.estadoDerivadoDelPlan)(cuotas),
                yaPagada: true,
            };
        }
        if (cuota.status === "anulada") {
            throw new https_1.HttpsError("failed-precondition", "Esa cuota está anulada: no se paga.");
        }
        // `RN-06` · lo pagado nunca supera el total de la factura. Con el plan
        // validado esto no puede darse, y se comprueba igual: es el invariante que
        // sostiene la deuda del conjunto, y las validaciones de forma viven en el
        // cliente — donde no protegen de una llamada directa.
        const pagadoTrasEste = (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(cuotas) + (cuota.amount ?? 0);
        if (pagadoTrasEste > (egreso.amount ?? 0) + 0.005) {
            throw new https_1.HttpsError("failed-precondition", "Pagar esa cuota haría que lo pagado superase el total de la factura.");
        }
        // El asiento, **con la MISMA forma que el del egreso sin plan**.
        tx.set(asientoRef, {
            tenantId: input.tenantId,
            type: "egreso",
            date: input.paidAt,
            amount: cuota.amount ?? 0,
            concept: `${egreso.description ?? "Egreso"} — cuota ${cuota.number} de ${cuotas.length}`,
            category: egreso.category ?? null,
            // **Se DERIVA de la categoría, como en los otros dos sitios que escriben
            // este asiento** (`createExpenseLedgerEntry` y `trial-seed`). Leerla del
            // egreso —que es lo que hacía esto— daba `null` siempre: `accountCode` no
            // es un campo del egreso, lo escribe el asiento. Medido en producción el
            // 4 de septiembre de 2026: **0 de 52 egresos lo traen**, así que la cuenta
            // se perdía en todos, no solo en los viejos. R9 manda que los informes
            // agrupen por código y solo caigan en la categoría si falta.
            accountCode: (0, plan_de_cuentas_1.cuentaParaCategoriaDeEgreso)(egreso.category).code,
            bankAccountId: input.bankAccountId ?? null,
            sourceType: "expense",
            sourceId: input.expenseId,
            installmentNumber: cuota.number,
            reconciled: false,
            createdBy: uid,
            updatedBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const actualizadas = [...cuotas];
        actualizadas[i] = {
            ...cuota,
            status: "pagada",
            paidAt: input.paidAt,
            paidBy: uid,
            paymentMethod: input.paymentMethod || null,
            bankAccountId: input.bankAccountId || null,
            ledgerEntryId: asientoRef.id,
        };
        const paidAmount = (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(actualizadas);
        const expenseStatus = (0, nucleo_estado_financiero_1.estadoDerivadoDelPlan)(actualizadas);
        tx.update(ref, {
            installments: actualizadas,
            paidAmount,
            status: expenseStatus,
            // El `paidAt` del egreso es el de su ÚLTIMA cuota: la fecha en que la
            // factura quedó saldada. Mientras quede alguna pendiente, no hay tal fecha.
            paidAt: expenseStatus === "pagado" ? input.paidAt : null,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, ledgerEntryId: asientoRef.id, paidAmount, expenseStatus, yaPagada: false };
    });
}
/**
 * Anula una cuota que todavía no se pagó (`RN-13`).
 *
 * **Una cuota PAGADA no se anula aquí** (`RN-07`): dejó un asiento en el libro, y
 * puede estar conciliada contra una línea del banco. Retirarla es anular ese
 * asiento, que es otra operación con sus propias consecuencias.
 */
async function anularCuota(input, uid) {
    const motivo = (input.reason ?? "").trim();
    if (!motivo)
        throw new https_1.HttpsError("invalid-argument", "Anular una cuota exige un motivo.");
    const firestore = db();
    const ref = firestore.collection("expenses").doc(input.expenseId);
    return firestore.runTransaction(async (tx) => {
        const egreso = leerEgreso(await tx.get(ref), input.tenantId);
        const cuotas = exigirPlan(egreso);
        const i = cuotas.findIndex((c) => c.number === input.installmentNumber);
        if (i < 0)
            throw new https_1.HttpsError("not-found", `Ese egreso no tiene una cuota ${input.installmentNumber}.`);
        const cuota = cuotas[i];
        if (cuota.status === "anulada") {
            return { ok: true, yaAnulada: true, expenseStatus: (0, nucleo_estado_financiero_1.estadoDerivadoDelPlan)(cuotas) };
        }
        if (cuota.status === "pagada") {
            throw new https_1.HttpsError("failed-precondition", "Esa cuota ya está pagada y dejó un asiento en el libro: para retirarla hay que anular el asiento.");
        }
        const actualizadas = [...cuotas];
        actualizadas[i] = { ...cuota, status: "anulada", voidReason: motivo };
        const expenseStatus = (0, nucleo_estado_financiero_1.estadoDerivadoDelPlan)(actualizadas);
        tx.update(ref, {
            installments: actualizadas,
            // Se recalcula igualmente: anular no cambia lo pagado, pero dejar el campo
            // sin tocar hace depender su exactitud de que nadie se equivoque después.
            paidAmount: (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(actualizadas),
            status: expenseStatus,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, yaAnulada: false, expenseStatus };
    });
}
/**
 * Anula la factura entera (`RN-08`).
 *
 * **Conserva las cuotas PAGADAS con su asiento** y anula solo las pendientes.
 * Anular no borra dinero que ya salió: el asiento de una cuota pagada describe un
 * pago real, y puede estar conciliado contra el extracto del banco. **Archivar no
 * es esconder.**
 */
async function anularEgresoConCuotas(input, uid) {
    const motivo = (input.reason ?? "").trim();
    if (!motivo)
        throw new https_1.HttpsError("invalid-argument", "Anular un egreso exige un motivo.");
    const firestore = db();
    const ref = firestore.collection("expenses").doc(input.expenseId);
    return firestore.runTransaction(async (tx) => {
        const egreso = leerEgreso(await tx.get(ref), input.tenantId);
        if (egreso.status === "anulado") {
            return { ok: true, yaAnulado: true, cuotasAnuladas: 0, cuotasConservadas: 0 };
        }
        const cuotas = egreso.installments ?? [];
        const actualizadas = cuotas.map((c) => c.status === "pendiente" ? { ...c, status: "anulada", voidReason: motivo } : c);
        const anuladas = cuotas.filter((c) => c.status === "pendiente").length;
        const conservadas = cuotas.filter((c) => c.status === "pagada").length;
        tx.update(ref, {
            ...(cuotas.length > 0 ? { installments: actualizadas, paidAmount: (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(actualizadas) } : {}),
            status: "anulado",
            voidReason: motivo,
            voidedBy: uid,
            voidedAt: firestore_1.Timestamp.now(),
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, yaAnulado: false, cuotasAnuladas: anuladas, cuotasConservadas: conservadas };
    });
}
/**
 * Declara o edita el calendario de pagos de una factura. **`PRD-V-FLOW-008`, `R8`.**
 *
 * ## Por qué esto dejó de ser escritura directa
 *
 * §11 de la ficha decidió que declarar el plan fuera escritura directa, y era
 * correcto **cuando la deuda salía de `paidAmount`**: las validaciones del plan
 * eran de forma y las reglas podían con ellas.
 *
 * **La entrega 2 cambió eso sin querer.** Al corregir la deuda para que derive de
 * las **cuotas vivas** —porque `amount − paidAmount` contaba de más en cuanto se
 * anulaba una cuota—, el array `installments` pasó a **sostener la deuda del
 * conjunto**. Y por la regla de este repositorio, *un campo escribible desde el
 * cliente no puede sostener un invariante*.
 *
 * Las reglas de Firestore **no podían cerrarlo: no iteran listas**, así que no hay
 * forma de comprobar cuota por cuota que ninguna venga marcada `pagada` con un
 * asiento inventado. Por eso el plan entero pasa por aquí, y la regla se limita a
 * **congelar `installments` frente al cliente**, que sí sabe hacer.
 *
 * ## Lo que este camino garantiza y la escritura directa no
 *
 *   1. **El plan se valida en el SERVIDOR** con la misma función que el
 *      formulario, la del núcleo. Un plan que no cuadra descuadra la deuda para
 *      siempre, y el formulario es una sugerencia para quien llama por HTTP.
 *   2. **Solo entran número, fecha e importe.** El estado, el asiento y las
 *      marcas de pago **no viajan**: se conservan de lo guardado.
 *   3. **`paidAmount` y el estado se RECALCULAN** de las cuotas resultantes.
 */
async function guardarPlan(input, uid) {
    const firestore = db();
    const ref = firestore.collection("expenses").doc(input.expenseId);
    return firestore.runTransaction(async (tx) => {
        const egreso = leerEgreso(await tx.get(ref), input.tenantId);
        if (egreso.status === "anulado") {
            throw new https_1.HttpsError("failed-precondition", "Ese egreso está anulado: su plan ya no se edita.");
        }
        // **Solo se admiten los tres campos de captura.**
        //
        // **Esto es defensa en profundidad, NO la guarda**, y conviene saberlo antes
        // de tocarlo: quitar este filtro **no rompe nada**, porque `fundirPlan`
        // reconstruye cada cuota campo a campo y fuerza `pendiente`. Lo dijo una
        // falsación que pasó EN VERDE — rompí el sitio equivocado. La guarda de
        // verdad está en el núcleo; si algún día se toca aquella, esto no salva.
        const entrantes = (input.installments ?? []).map((c) => ({
            number: Number(c.number),
            dueDate: String(c.dueDate ?? ""),
            amount: Number(c.amount),
        }));
        const fundidas = (0, nucleo_estado_financiero_1.fundirPlan)(egreso.installments, entrantes);
        if (fundidas && fundidas.length > 0) {
            // **La validación corre en el servidor, con la MISMA función del núcleo que
            // usa el formulario.** No es una segunda comprobación: es la única que
            // manda.
            const problemas = (0, nucleo_estado_financiero_1.validarPlan)(fundidas, egreso.amount ?? 0);
            if (problemas.length > 0) {
                const texto = problemas
                    .map((p) => (0, nucleo_estado_financiero_1.explicarProblemaDelPlan)(p, (n) => Math.round(n).toLocaleString("es-CO")))
                    .join(" ");
                throw new https_1.HttpsError("invalid-argument", texto);
            }
        }
        const cuotas = fundidas ?? [];
        const paidAmount = (0, nucleo_estado_financiero_1.sumarPagadoDelPlan)(cuotas);
        const expenseStatus = cuotas.length > 0 ? (0, nucleo_estado_financiero_1.estadoDerivadoDelPlan)(cuotas) : egreso.status;
        tx.update(ref, {
            installments: fundidas,
            paidAmount,
            // Con plan el estado es derivado; sin plan se deja el que tuviera, que lo
            // gobierna el camino de siempre.
            ...(cuotas.length > 0 ? { status: expenseStatus } : {}),
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, cuotas: cuotas.length, paidAmount, expenseStatus };
    });
}
