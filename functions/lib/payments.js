"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularSaldo = calcularSaldo;
exports.esRecaudoDeCartera = esRecaudoDeCartera;
exports.aplicarPago = aplicarPago;
exports.saldoTrasRevertir = saldoTrasRevertir;
exports.revertirPago = revertirPago;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const comprobante_1 = require("./comprobante");
const feature_flags_1 = require("./feature-flags");
const plan_de_cuentas_1 = require("./plan-de-cuentas");
/**
 * `FIN-001` — aplicación de pagos: un solo comando, transaccional e idempotente.
 *
 * **Qué había antes, y por qué era grave.** Dos rutas aplicaban un pago y
 * producían efectos distintos:
 *
 * - `recordPayment` (cobro manual) hacía **cuatro escrituras sueltas sin
 *   transacción**: reservar secuencial, asiento del libro, comprobante y cuota.
 *   Un fallo entre la segunda y la cuarta dejaba **el libro diciendo que entró
 *   dinero y la cartera diciendo que se debe**.
 * - `approveReceiptAndRegisterPayment` (aprobación del comprobante del
 *   residente) actualizaba la cuota **y no escribía en el libro**: el dinero se
 *   movía en cartera y nunca llegaba a la contabilidad.
 *
 * Y las dos calculaban el saldo **en el navegador**, con reglas de Firestore que
 * aceptaban cualquier cifra que el cliente enviara. Nada comprobaba que
 * `balance = amount − paymentAmount`.
 *
 * **Tres decisiones que sostienen este módulo:**
 *
 * 1. **La aritmética es del servidor.** El cliente dice cuánto se pagó; el saldo
 *    y el estado los calcula esto, leyendo la cuota dentro de la transacción. Un
 *    cliente con un dato viejo ya no puede escribir un saldo incorrecto.
 * 2. **Todo o nada.** Cuota, asiento y comprobante-de-residente se escriben en
 *    una transacción. No existe el estado intermedio.
 * 3. **Idempotente por clave.** El llamante manda una `operationKey`; si llega
 *    dos veces —doble clic, reintento de red, reenvío— el pago se aplica **una
 *    sola vez** y la segunda llamada devuelve el mismo resultado.
 *
 * **Lo fiscal queda fuera a propósito** (decisión de David, 18 ago 2026: «no nos
 * metemos al tema fiscal de momento para ninguno de los países»). El comprobante
 * con secuencial lo sigue emitiendo el cobro manual desde el cliente, con dos
 * matices: **ya no se emite antes de aplicar el pago sino después**, así que un
 * fallo deja un pago sin comprobante —recuperable— en vez de un comprobante
 * fiscal de un pago inexistente; y la aprobación del residente **no emite
 * comprobante**, igual que hoy.
 */
// `initializeApp()` corre en index.ts y los imports se evalúan antes.
const db = () => (0, firestore_1.getFirestore)();
/**
 * Saldo y estado a partir de lo cobrado y lo pagado.
 *
 * Espejo de `computeBalanceStatus` en `src/features/finanzas/use-payments.ts`,
 * duplicado a propósito: `src/` no puede importar de `functions/` sin romper el
 * build de App Hosting (ver CLAUDE.md). **Si cambias uno, cambia el otro** — y
 * el que manda es este, porque es el que escribe.
 */
function calcularSaldo(totalCobrado, pagado, vencimiento, hoy) {
    const bruto = totalCobrado - pagado;
    const balance = bruto > 0 ? bruto : 0;
    const status = bruto <= 0 ? "paid" : vencimiento && vencimiento < hoy ? "overdue" : "pending";
    return { balance, status };
}
/**
 * Si un asiento de ingreso **ya viene contado por Cartera** y por tanto no debe
 * volver a sumarse desde el libro.
 *
 * Espejo de `esRecaudoDeCartera` en `src/features/finanzas/financial-statement.ts`,
 * duplicado a propósito porque `functions/` y `src/` no pueden importarse entre
 * sí (ver CLAUDE.md). **Si cambias una, cambia la otra** — igual que
 * `calcularSaldo` / `computeBalanceStatus`.
 *
 * Vive aquí, al lado de `aplicarPago` y `revertirPago`, porque los dos campos
 * que lee —`sourceType` y `reversedSourceType`— **se escriben en este mismo
 * fichero**. Quien cambie cómo se estampan ve la regla que los interpreta.
 *
 * **Por qué hizo falta:** R12 se aplicó en `src/` el 22 de agosto de 2026 y
 * **nunca llegó a `functions/`**. El informe automático mensual
 * (`monthlyFinancialArchive`) siguió preguntando `category !== "alicuota"`, así
 * que todo cargo cobrado con una categoría distinta de la cuota —una
 * extraordinaria, una multa— entraba en `ingresosOtros` **y** seguía dentro del
 * recaudo de Cartera: contado dos veces. Medido el 23 de agosto sobre datos
 * reales en LOS DOS ambientes: Las Playas daba 129.000 en el informe automático
 * y 127.500 en pantalla. Es el mismo doble conteo que la pantalla ya había
 * matado, vivo en el PDF que se archiva solo cada mes.
 *
 * **Y no dependía de la bandera:** los asientos sembrados llevan su categoría
 * real sin pasar por `aplicarPago`, así que ya estaba ocurriendo.
 */
function esRecaudoDeCartera(entry) {
    return (entry.sourceType === "billingStatement" ||
        entry.reversedSourceType === "billingStatement" ||
        // Convivencia: cubre lo escrito antes de que existiera `reversedSourceType`
        // y lo que se siga escribiendo con `producto-concepto-al-libro` apagada.
        entry.category === "alicuota");
}
function texto(valor, campo) {
    const out = typeof valor === "string" ? valor.trim() : "";
    if (!out)
        throw new https_1.HttpsError("invalid-argument", `Falta ${campo}.`);
    return out;
}
/**
 * Quién puede aplicar un pago: administración del conjunto o superadmin.
 *
 * **No** se acepta al residente aunque el pago nazca de su comprobante: subirlo
 * es una solicitud, aprobarlo es una decisión de la administración.
 */
function assertPuedeCobrar(role, tokenTenant, tenantId) {
    const rol = typeof role === "string" ? role : "";
    if (rol === "superadmin" || rol === "super_admin")
        return;
    const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
    if (!esAdmin || tokenTenant !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No tienes permiso para registrar cobros en este conjunto.");
    }
}
/**
 * Aplica un pago sobre una cuota. Transaccional e idempotente.
 *
 * El orden de lectura importa: Firestore exige **todas las lecturas antes de
 * cualquier escritura** dentro de una transacción, así que primero se leen la
 * marca de idempotencia, la cuota y —si aplica— el comprobante del residente.
 */
async function aplicarPago(input, uid, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const statementId = texto(input.statementId, "la cuota");
    const operationKey = texto(input.operationKey, "la clave de operación");
    const fecha = texto(input.date, "la fecha");
    assertPuedeCobrar(role, tokenTenant, tenantId);
    const monto = typeof input.amount === "number" ? input.amount : NaN;
    if (!Number.isFinite(monto) || monto <= 0) {
        throw new https_1.HttpsError("invalid-argument", "El monto del cobro debe ser mayor a cero.");
    }
    if (input.source !== "manual" && input.source !== "receipt") {
        throw new https_1.HttpsError("invalid-argument", "Origen de pago inválido.");
    }
    if (input.source === "receipt" && !input.receiptId) {
        throw new https_1.HttpsError("invalid-argument", "Falta el comprobante que origina el pago.");
    }
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(operationKey);
    const cuotaRef = firestore.collection("billingStatements").doc(statementId);
    const reciboRef = input.receiptId
        ? firestore.collection("paymentReceipts").doc(input.receiptId)
        : null;
    const hoy = new Date().toISOString().slice(0, 10);
    // La bandera se resuelve AQUÍ, fuera de la transacción, y no dentro. Dos
    // razones: `isFeatureEnabled` hace su propia lectura, que no sería
    // transaccional y por tanto mentiría sobre estar dentro; y una transacción de
    // Firestore **se reintenta**, así que leerla dentro la releería en cada
    // reintento sin que eso aporte nada.
    const conceptoAlLibro = await (0, feature_flags_1.isFeatureEnabled)("producto-concepto-al-libro", tenantId);
    return firestore.runTransaction(async (tx) => {
        // ── Lecturas, todas antes de escribir ────────────────────────────────────
        const opSnap = await tx.get(opRef);
        if (opSnap.exists) {
            // Ya se aplicó con esta clave. Se devuelve el mismo resultado sin volver a
            // tocar nada: es lo que convierte un reintento en algo inofensivo.
            const prev = opSnap.data();
            return {
                ok: true,
                applied: false,
                ledgerEntryId: prev.ledgerEntryId ?? "",
                paymentAmount: prev.paymentAmount ?? 0,
                balance: prev.balance ?? 0,
                status: prev.status ?? "pending",
                // El recibo del intento original, no uno nuevo: un reintento no debe
                // multiplicar recibos de un pago que ya existe.
                ...(prev.voucherId ? { voucherId: prev.voucherId, voucherCode: prev.voucherCode } : {}),
            };
        }
        const cuotaSnap = await tx.get(cuotaRef);
        if (!cuotaSnap.exists) {
            throw new https_1.HttpsError("not-found", "El cobro vinculado ya no existe.");
        }
        const cuota = cuotaSnap.data();
        // El conjunto de la cuota manda sobre el que diga el llamante: si no
        // coinciden, alguien está intentando cobrar en un conjunto ajeno.
        if (cuota.tenantId && cuota.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Esa cuota pertenece a otro conjunto.");
        }
        let reciboYaAprobado = false;
        if (reciboRef) {
            const reciboSnap = await tx.get(reciboRef);
            if (!reciboSnap.exists) {
                throw new https_1.HttpsError("not-found", "El comprobante ya no existe.");
            }
            const recibo = reciboSnap.data();
            if (recibo.tenantId && recibo.tenantId !== tenantId) {
                throw new https_1.HttpsError("permission-denied", "Ese comprobante pertenece a otro conjunto.");
            }
            // Un comprobante ya aprobado no se vuelve a cobrar. Es la segunda red
            // contra el doble pago, además de la clave de idempotencia: protege
            // también del caso en que alguien apruebe dos veces con claves distintas.
            reciboYaAprobado = recibo.status === "approved";
            if (reciboYaAprobado) {
                throw new https_1.HttpsError("failed-precondition", "Ese comprobante ya fue aprobado.");
            }
        }
        // El perfil fiscal del conjunto se lee AQUÍ, del servidor, y no llega desde
        // el navegador como antes: el que emite el recibo es quien debe leer con qué
        // datos lo emite. Y va con el resto de lecturas porque una transacción de
        // Firestore no admite leer después de escribir.
        let perfil = null;
        if (input.source === "manual") {
            const ajustesSnap = await tx.get(firestore.collection("tenantSettings").doc(tenantId));
            perfil = ajustesSnap.data()?.fiscalProfile ?? null;
        }
        // ── Aritmética, en el servidor ───────────────────────────────────────────
        const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
        const pagadoAntes = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
        const pagadoDespues = pagadoAntes + monto;
        const { balance, status } = calcularSaldo(cobrado, pagadoDespues, cuota.dueDate, hoy);
        // ── La cuenta del concepto (R6) ──────────────────────────────────────────
        //
        // Hasta el 22 de agosto de 2026 aquí había un `category: "alicuota"` fijo, y
        // el `concept` del cargo —que lleva existiendo desde siempre en el mismo
        // documento que se acaba de leer— no se miraba. Una multa, una cuota
        // extraordinaria o un parqueadero se contabilizaban todos como cuota de
        // administración, así que **el estado financiero de cualquier conjunto que
        // cobrara algo distinto de la cuota estaba mal**.
        //
        // Se escriben las TRES cosas coherentes o ninguna: el código de cuenta, la
        // categoría equivalente —que se sigue escribiendo, §7.2— y la descripción,
        // que también estaba cableada a «alícuota». Dejar la descripción vieja con
        // la cuenta nueva sería un asiento que se contradice a sí mismo.
        const resolucion = (0, plan_de_cuentas_1.cuentaParaConcepto)(cuota.concept);
        // R8: un concepto sin cuenta equivalente cae en `otros_ingresos` y **se
        // avisa**. Nunca se descarta. El aviso viaja en la respuesta del callable, y
        // por eso `porDefecto` no se traga aquí en silencio.
        const cayoEnOtrosIngresos = conceptoAlLibro && resolucion.porDefecto;
        // ── Escrituras ───────────────────────────────────────────────────────────
        const ledgerRef = firestore.collection("ledgerEntries").doc();
        const queSeCobra = conceptoAlLibro ? (0, plan_de_cuentas_1.descripcionDeCobro)(cuota.concept) : "alícuota";
        const concepto = `Pago de ${queSeCobra} ${cuota.period ?? ""} — ${cuota.unitLabel ?? ""}`.trim();
        tx.set(ledgerRef, {
            tenantId,
            type: "ingreso",
            date: fecha,
            amount: monto,
            concept: concepto,
            category: conceptoAlLibro ? (0, plan_de_cuentas_1.categoriaParaConcepto)(cuota.concept) : "alicuota",
            // Con la bandera apagada NO se escribe `accountCode`, y no es un detalle:
            // R9 dice que los informes agrupan por el código y solo caen en la
            // categoría si falta. Escribirlo ya cambiaría lo que se muestra, que es
            // justo lo que la bandera existe para gobernar.
            ...(conceptoAlLibro ? { accountCode: resolucion.code } : {}),
            bankAccountId: null,
            sourceType: "billingStatement",
            // El asiento guarda SU clave de operación. Sin esto la reversión no es
            // direccionable: la marca de idempotencia sabe cuál es su asiento, pero
            // el asiento no sabría cuál es su marca, y la del cobro manual es un UUID
            // que muere con el formulario. Es el único puente entre la fila que el
            // administrador ve y el pago que quiere deshacer.
            operationKey,
            sourceId: statementId,
            reconciled: false,
            // Deja ver de qué ruta vino sin tener que cruzar colecciones.
            paymentSource: input.source,
            ...(input.receiptId ? { receiptId: input.receiptId } : {}),
            createdBy: uid,
            updatedBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(cuotaRef, {
            paymentAmount: pagadoDespues,
            balance,
            status,
            lastPaymentAt: fecha,
            ...(input.receiptId ? { lastReceiptId: input.receiptId } : {}),
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        // ── El recibo, DENTRO de la misma transacción ────────────────────────────
        //
        // Hasta el 20 de agosto de 2026 esto lo hacía el navegador, después de que
        // el pago estuviera aplicado, y el motivo estaba escrito: emitir dentro de
        // la transacción «es meterse en lo fiscal». **Dejó de serlo** al salir lo
        // fiscal del alcance, así que el hueco que aquello dejaba —un pago aplicado
        // y sin recibo si la escritura de después fallaba— ya no tiene por qué
        // existir. Ahora o están los dos o no está ninguno.
        //
        // Solo el cobro manual emite recibo. La aprobación del comprobante del
        // residente no lo hacía antes y sigue sin hacerlo: el residente ya tiene su
        // propio comprobante archivado, y emitirle además uno de Vivaru sería
        // duplicar la evidencia del mismo pago.
        let voucherId;
        let voucherCode;
        if (input.source === "manual") {
            const voucherRef = firestore.collection("paymentVouchers").doc();
            const recibo = (0, comprobante_1.construirRecibo)({
                voucherId: voucherRef.id,
                issueDate: fecha,
                amount: monto,
                concept: concepto,
                payer: {
                    name: input.payerName ?? null,
                    taxId: input.payerTaxId ?? null,
                    unitId: cuota.unitId ?? null,
                    unitLabel: cuota.unitLabel ?? null,
                },
                issuer: perfil,
                sourceType: "billingStatement",
                sourceId: statementId,
            });
            tx.set(voucherRef, {
                ...recibo,
                tenantId,
                ledgerEntryId: ledgerRef.id,
                operationKey,
                createdBy: uid,
                updatedBy: uid,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            voucherId = voucherRef.id;
            voucherCode = recibo.code;
        }
        if (reciboRef) {
            tx.update(reciboRef, {
                status: "approved",
                registeredAmount: monto,
                reviewedAt: firestore_1.FieldValue.serverTimestamp(),
                reviewedBy: uid,
                ...(input.reviewerName ? { reviewedByName: input.reviewerName } : {}),
                rejectedReason: null,
            });
        }
        // La marca de idempotencia se escribe DENTRO de la transacción: si algo
        // falla, tampoco queda ella, y el reintento vuelve a aplicar de verdad.
        tx.set(opRef, {
            tenantId,
            statementId,
            amount: monto,
            source: input.source,
            ...(input.receiptId ? { receiptId: input.receiptId } : {}),
            ledgerEntryId: ledgerRef.id,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherId ? { voucherId, voucherCode } : {}),
            actorUid: uid,
            createdAt: firestore_1.Timestamp.now(),
        });
        return {
            ok: true,
            applied: true,
            ledgerEntryId: ledgerRef.id,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherId ? { voucherId, voucherCode } : {}),
            ...(cayoEnOtrosIngresos ? { cayoEnOtrosIngresos: true } : {}),
        };
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Reversión
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cómo queda una cuota después de quitarle un pago.
 *
 * El `Math.max(…, 0)` no es defensa teórica: si alguien tocó la cuota por otra
 * vía entre el pago y su reversión, restar a ciegas dejaría un **pagado
 * negativo**, que en cartera se lee como que el conjunto le debe dinero al
 * residente. Quedarse en cero es incorrecto de una forma que se nota y se
 * corrige; el negativo es incorrecto de una forma que se propaga.
 */
function saldoTrasRevertir(totalCobrado, pagadoAntes, montoRevertido, vencimiento, hoy) {
    const pagadoDespues = Math.max(pagadoAntes - montoRevertido, 0);
    const { balance, status } = calcularSaldo(totalCobrado, pagadoDespues, vencimiento, hoy);
    return { paymentAmount: pagadoDespues, balance, status };
}
/**
 * Revierte un pago aplicado. Transaccional e idempotente, como su gemelo.
 *
 * **Sigue la convención contable del repositorio: nunca borrar, siempre anular.**
 * El asiento original se conserva y se crea su espejo con **monto negativo** —no
 * con el tipo opuesto—, que es como `reverseLedgerEntry` lo viene haciendo para
 * los movimientos manuales: así las agregaciones tratan igual al original y a su
 * reverso, sin excepciones que recordar.
 *
 * **Qué pasa con el comprobante del residente, y por qué no vuelve a `pending`.**
 * Queda **rechazado** con el motivo. Devolverlo a pendiente parecería más amable
 * pero rompería algo: la clave de idempotencia de su aprobación es su propio id,
 * así que al re-aprobarlo la marca ya existiría y el pago **no se aplicaría**,
 * devolviendo «ya aplicado» sin haber aplicado nada — un fallo silencioso, que es
 * la peor clase. Con el rechazo se mantiene el invariante de que un comprobante
 * sostiene como mucho un pago. Si hubo error de monto, se registra por el cobro
 * manual, que ya tiene la evidencia archivada.
 *
 * **El recibo se ANULA aquí, en la misma transacción** (20 ago 2026). Hasta
 * entonces no se anulaba, y el motivo escrito era que «eso pide una nota de
 * crédito, que es terreno fiscal»: se levantaba `requiereNotaCredito` y la
 * pantalla avisaba, **pero el paso quedaba en manos de una persona y nadie lo
 * perseguía**. Al salir lo fiscal del alcance el recibo dejó de ser un documento
 * ante la autoridad, así que anularlo es marcar un campo — no emitir nada—, y
 * puede ocurrir dentro de la transacción que ya existía. Se cambia una tarea
 * pendiente que nadie hacía por una escritura que no se puede olvidar.
 */
async function revertirPago(input, uid, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const operationKey = texto(input.operationKey, "la operación a revertir");
    const reversalKey = texto(input.reversalKey, "la clave de la reversión");
    const motivo = texto(input.reason, "el motivo de la reversión");
    assertPuedeCobrar(role, tokenTenant, tenantId);
    if (reversalKey === operationKey) {
        throw new https_1.HttpsError("invalid-argument", "La clave de la reversión no puede ser la misma del pago.");
    }
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(operationKey);
    const revRef = firestore.collection("paymentOperations").doc(reversalKey);
    const hoy = new Date().toISOString().slice(0, 10);
    return firestore.runTransaction(async (tx) => {
        // ── Lecturas ─────────────────────────────────────────────────────────────
        const revSnap = await tx.get(revRef);
        if (revSnap.exists) {
            const prev = revSnap.data();
            return {
                ok: true,
                reversed: false,
                reversalEntryId: prev.reversalEntryId ?? "",
                paymentAmount: prev.paymentAmount ?? 0,
                balance: prev.balance ?? 0,
                status: prev.status ?? "pending",
                ...(prev.voucherAnuladoId ? { voucherAnuladoId: prev.voucherAnuladoId } : {}),
            };
        }
        const opSnap = await tx.get(opRef);
        if (!opSnap.exists) {
            throw new https_1.HttpsError("not-found", "No existe el pago que se quiere revertir.");
        }
        const op = opSnap.data();
        if (op.tenantId && op.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese pago pertenece a otro conjunto.");
        }
        if (op.reversedAt) {
            throw new https_1.HttpsError("failed-precondition", "Ese pago ya fue revertido.");
        }
        const monto = typeof op.amount === "number" ? op.amount : 0;
        const statementId = op.statementId ?? "";
        if (!statementId || monto <= 0) {
            throw new https_1.HttpsError("failed-precondition", "El pago original está incompleto y no se puede revertir.");
        }
        const cuotaRef = firestore.collection("billingStatements").doc(statementId);
        const cuotaSnap = await tx.get(cuotaRef);
        if (!cuotaSnap.exists) {
            throw new https_1.HttpsError("not-found", "La cuota del pago ya no existe.");
        }
        const cuota = cuotaSnap.data();
        const asientoRef = op.ledgerEntryId
            ? firestore.collection("ledgerEntries").doc(op.ledgerEntryId)
            : null;
        const asientoSnap = asientoRef ? await tx.get(asientoRef) : null;
        const reciboRef = op.receiptId
            ? firestore.collection("paymentReceipts").doc(op.receiptId)
            : null;
        // Se lee para saber si SIGUE existiendo. `tx.update` sobre un documento
        // borrado aborta la transacción entera, y un comprobante que ya no está no
        // puede ser motivo para que el dinero no se pueda revertir.
        const reciboSnap = reciboRef ? await tx.get(reciboRef) : null;
        // El recibo emitido por Vivaru, si el pago fue manual. Se lee por lo mismo
        // que el comprobante del residente: si alguien lo borró, un `tx.update`
        // sobre él tumbaría la reversión entera — y que falte el recibo no puede
        // impedir deshacer el movimiento del dinero.
        const voucherRef = op.voucherId
            ? firestore.collection("paymentVouchers").doc(op.voucherId)
            : null;
        const voucherSnap = voucherRef ? await tx.get(voucherRef) : null;
        // ── Aritmética ───────────────────────────────────────────────────────────
        const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
        const pagadoAntes = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
        const { paymentAmount: pagadoDespues, balance, status, } = saldoTrasRevertir(cobrado, pagadoAntes, monto, cuota.dueDate, hoy);
        // ── Escrituras ───────────────────────────────────────────────────────────
        const reversoRef = firestore.collection("ledgerEntries").doc();
        const conceptoOriginal = asientoSnap?.data()?.concept ?? `Pago ${statementId}`;
        // ── R7 y R13: el reverso hereda del asiento que anula ────────────────────
        //
        // **R7 — la misma cuenta.** Si el reverso cayera en otra, la reversión no
        // anularía nada: dejaría un positivo en una cuenta y un negativo en otra, y
        // las dos mentirían. Se COPIA del original en vez de volver a resolverla
        // desde el concepto, porque el cargo pudo cambiar de concepto entre el pago
        // y su reversión, y lo que hay que deshacer es el asiento que se escribió,
        // no el que se escribiría hoy.
        //
        // **R13 — el reverso arrastra el ORIGEN de lo que anula.** Y esto no es
        // adorno: un reverso pierde su origen al nacer (`sourceType: "reversal"`).
        // Mientras todo cobro se escribía como `alicuota`, la exclusión que evita el
        // doble conteo lo atrapaba por la categoría. En cuanto el reverso lleva la
        // cuenta del concepto —una multa— **deja de ser las dos cosas**: ni
        // `billingStatement` ni `alicuota`. Entonces su monto NEGATIVO entra en el
        // ingreso del libro mientras Cartera ya lo descontó del `paymentAmount` de
        // la cuota, y el ingreso baja dos veces.
        //
        // Es el defecto de §2 mirando al revés, y por eso viaja en este mismo
        // incremento. Sin R13, encender `producto-concepto-al-libro` arregla el
        // cobro y rompe la reversión.
        const asientoOriginal = asientoSnap?.data();
        tx.set(reversoRef, {
            tenantId,
            type: "ingreso",
            date: hoy,
            // Negativo, no tipo opuesto: misma convención que `reverseLedgerEntry`.
            amount: -Math.abs(monto),
            concept: `Reverso: ${conceptoOriginal}`,
            // El respaldo a `"alicuota"` conserva exactamente lo que hacía antes para
            // los asientos viejos, que no tienen categoría propia.
            category: asientoOriginal?.category ?? "alicuota",
            ...(asientoOriginal?.accountCode ? { accountCode: asientoOriginal.accountCode } : {}),
            bankAccountId: null,
            sourceType: "reversal",
            // R13. Se escribe SIEMPRE, con bandera o sin ella: hoy no cambia nada
            // —el reverso ya se excluye por su categoría— y el día que la bandera se
            // encienda tiene que estar ya en los asientos, no empezar a escribirse
            // entonces. Un campo de seguridad que aparece a la vez que el peligro
            // llega tarde para todo lo escrito en medio.
            ...(asientoOriginal?.sourceType && asientoOriginal.sourceType !== "reversal"
                ? { reversedSourceType: asientoOriginal.sourceType }
                : { reversedSourceType: "billingStatement" }),
            sourceId: op.ledgerEntryId ?? statementId,
            reversalReason: motivo,
            reconciled: false,
            createdBy: uid,
            updatedBy: uid,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        if (asientoRef && asientoSnap?.exists) {
            tx.update(asientoRef, {
                reversedByEntryId: reversoRef.id,
                updatedBy: uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        tx.update(cuotaRef, {
            paymentAmount: pagadoDespues,
            balance,
            status,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        if (reciboRef && reciboSnap?.exists) {
            tx.update(reciboRef, {
                status: "rejected",
                rejectedReason: `Pago revertido: ${motivo}`,
                registeredAmount: null,
                reviewedAt: firestore_1.FieldValue.serverTimestamp(),
                reviewedBy: uid,
            });
        }
        tx.update(opRef, {
            reversedAt: firestore_1.Timestamp.now(),
            reversedBy: uid,
            reversalKey,
            reversalReason: motivo,
        });
        // Anular el recibo: un campo, dentro de esta misma transacción. Antes esto
        // era una bandera y un aviso en pantalla que alguien tenía que atender a
        // mano — ver la nota de arriba.
        let voucherAnuladoId;
        if (voucherRef && voucherSnap?.exists) {
            tx.update(voucherRef, {
                anulado: true,
                anuladoEn: firestore_1.Timestamp.now(),
                anuladoPor: uid,
                anuladoMotivo: motivo,
                updatedBy: uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            voucherAnuladoId = voucherRef.id;
        }
        tx.set(revRef, {
            tenantId,
            kind: "reversal",
            reversesOperationKey: operationKey,
            statementId,
            amount: -Math.abs(monto),
            reason: motivo,
            reversalEntryId: reversoRef.id,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherAnuladoId ? { voucherAnuladoId } : {}),
            actorUid: uid,
            createdAt: firestore_1.Timestamp.now(),
        });
        return {
            ok: true,
            reversed: true,
            reversalEntryId: reversoRef.id,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherAnuladoId ? { voucherAnuladoId } : {}),
        };
    });
}
