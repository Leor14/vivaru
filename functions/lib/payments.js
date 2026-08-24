"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularSaldo = calcularSaldo;
exports.esRecaudoDeCartera = esRecaudoDeCartera;
exports.ordenarPorAntiguedad = ordenarPorAntiguedad;
exports.deudaDelCargo = deudaDelCargo;
exports.repartirPorAntiguedad = repartirPorAntiguedad;
exports.vistaPreviaReparto = vistaPreviaReparto;
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
function calcularSaldo(totalCobrado, pagado, anticipoAplicado, vencimiento, hoy) {
    const bruto = totalCobrado - pagado - anticipoAplicado;
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
 * Ordena del cargo **más antiguo por vencimiento** al más nuevo (R7).
 *
 * Un cargo **sin `dueDate` cae a su período**, que es `YYYY-MM`: es el mismo
 * criterio con el que se decide la mora, y separarse de él dejaría un cargo
 * «vencido» en una pantalla y «el más nuevo» en la siguiente. El desempate por
 * `id` no es estética: sin él, dos cargos del mismo mes se ordenarían según cómo
 * los devolviera Firestore, y la propuesta cambiaría entre dos llamadas
 * idénticas sin que nadie hubiera tocado nada.
 */
function ordenarPorAntiguedad(cargos) {
    const clave = (c) => c.dueDate ?? (c.period ? `${c.period}-01` : "9999-12-31");
    return [...cargos].sort((a, b) => clave(a).localeCompare(clave(b)) || a.id.localeCompare(b.id));
}
/** Lo que le falta a un cargo para quedar saldado, según `calcularSaldo`. */
function deudaDelCargo(cargo, hoy) {
    const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return calcularSaldo(n(cargo.amount), n(cargo.paymentAmount), n(cargo.advanceAppliedAmount), cargo.dueDate, hoy)
        .balance;
}
/**
 * Reparte `importe` entre `cargos`, del más antiguo al más nuevo (R7).
 *
 * **Un cargo sin deuda no genera línea, ni siquiera de cero**: `aplicarPago` no
 * escribe asientos de importe cero, y una línea de cero en la vista previa haría
 * creer que ese cargo recibió algo. Un pago que no cabe en ninguno sale con
 * `lineas: []` y todo en `sobrante`, que es CA8.
 */
function repartirPorAntiguedad(cargos, importe, hoy) {
    let restante = typeof importe === "number" && Number.isFinite(importe) ? importe : 0;
    if (restante <= 0)
        return { lineas: [], sobrante: 0 };
    const lineas = [];
    for (const cargo of ordenarPorAntiguedad(cargos)) {
        if (restante <= 0)
            break;
        const deuda = deudaDelCargo(cargo, hoy);
        if (deuda <= 0)
            continue;
        const aplicar = Math.min(restante, deuda);
        lineas.push({ statementId: cargo.id, amount: aplicar });
        restante -= aplicar;
    }
    return { lineas, sobrante: restante };
}
/**
 * **Calcula la vista previa del reparto. No escribe nada.**
 *
 * Devuelve también `period`, `concept` y `deuda` de cada línea para que la
 * pantalla pueda pintarla sin una segunda lectura, y `sobranteSeraAnticipo`
 * para que no prometa un saldo a favor que la bandera apagada no va a crear.
 */
async function vistaPreviaReparto(input, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const unitId = texto(input.unitId, "la unidad");
    assertPuedeCobrar(role, tokenTenant, tenantId);
    const monto = typeof input.amount === "number" ? input.amount : NaN;
    if (!Number.isFinite(monto) || monto <= 0) {
        throw new https_1.HttpsError("invalid-argument", "El monto del cobro debe ser mayor a cero.");
    }
    const firestore = db();
    const snap = await firestore
        .collection("billingStatements")
        .where("tenantId", "==", tenantId)
        .where("unitId", "==", unitId)
        .get();
    const pedidos = Array.isArray(input.statementIds) ? new Set(input.statementIds) : null;
    const cargos = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => (pedidos ? pedidos.has(c.id) : true));
    const hoy = new Date().toISOString().slice(0, 10);
    const reparto = repartirPorAntiguedad(cargos, monto, hoy);
    const porId = new Map(cargos.map((c) => [c.id, c]));
    return {
        ok: true,
        lineas: reparto.lineas.map((l) => {
            const c = porId.get(l.statementId);
            return {
                ...l,
                period: c?.period,
                concept: c?.concept,
                unitLabel: c?.unitLabel,
                deuda: c ? deudaDelCargo(c, hoy) : 0,
            };
        }),
        sobrante: reparto.sobrante,
        sobranteSeraAnticipo: await (0, feature_flags_1.isFeatureEnabled)("producto-anticipos", tenantId),
    };
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
    const operationKey = texto(input.operationKey, "la clave de operación");
    const fecha = texto(input.date, "la fecha");
    assertPuedeCobrar(role, tokenTenant, tenantId);
    const monto = typeof input.amount === "number" ? input.amount : NaN;
    if (!Number.isFinite(monto) || monto <= 0) {
        throw new https_1.HttpsError("invalid-argument", "El monto del cobro debe ser mayor a cero.");
    }
    // ── El reparto, normalizado a una lista ────────────────────────────────────
    //
    // La forma vieja se convierte en un reparto de una línea. Es lo que evita dos
    // caminos paralelos para la misma operación: la ruta de un solo cargo —la que
    // está en producción— pasa exactamente por el mismo código que la nueva, así
    // que no puede divergir en silencio.
    const asignaciones = Array.isArray(input.allocations) && input.allocations.length > 0
        ? input.allocations.map((a) => ({
            statementId: texto(a?.statementId, "el cargo de una de las líneas"),
            amount: typeof a?.amount === "number" ? a.amount : NaN,
        }))
        : [{ statementId: texto(input.statementId, "la cuota"), amount: monto }];
    if (asignaciones.some((a) => !Number.isFinite(a.amount) || a.amount <= 0)) {
        throw new https_1.HttpsError("invalid-argument", "Cada línea del reparto debe ser mayor a cero.");
    }
    // Un cargo repetido sumaría dos veces sobre el mismo documento dentro de la
    // misma transacción, y la segunda escritura pisaría a la primera: el dinero
    // se perdería sin que nada fallase.
    if (new Set(asignaciones.map((a) => a.statementId)).size !== asignaciones.length) {
        throw new https_1.HttpsError("invalid-argument", "Un mismo cargo no puede aparecer dos veces en el reparto.");
    }
    // Tope defensivo: una transacción de Firestore tiene un límite de escrituras,
    // y aquí cada línea escribe dos documentos. Mejor un error claro que el error
    // opaco del motor a mitad de una operación de dinero.
    if (asignaciones.length > 40) {
        throw new https_1.HttpsError("invalid-argument", "Son demasiados cargos para un solo pago.");
    }
    // **R7/CF5: la suma del reparto no puede pasarse del importe pagado.** Si es
    // menor, la diferencia es sobrante y se convierte en anticipo (R2).
    const sumaAsignada = asignaciones.reduce((s, a) => s + a.amount, 0);
    if (sumaAsignada > monto) {
        throw new https_1.HttpsError("invalid-argument", "El reparto suma más que el importe pagado.");
    }
    const statementId = asignaciones[0].statementId;
    if (input.source !== "manual" && input.source !== "receipt") {
        throw new https_1.HttpsError("invalid-argument", "Origen de pago inválido.");
    }
    if (input.source === "receipt" && !input.receiptId) {
        throw new https_1.HttpsError("invalid-argument", "Falta el comprobante que origina el pago.");
    }
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(operationKey);
    const cuotaRefs = asignaciones.map((a) => firestore.collection("billingStatements").doc(a.statementId));
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
    // R2. Apagada, el sobrepago se sigue contabilizando entero contra la cuota,
    // exactamente como hasta hoy: `sobrante` queda en cero por construcción y no
    // nace ningún anticipo. Se lee aquí arriba, fuera de la transacción, por lo
    // mismo que la otra: una transacción se reintenta, y releerla no aportaría nada.
    const anticipos = await (0, feature_flags_1.isFeatureEnabled)("producto-anticipos", tenantId);
    // El reparto va por su propia bandera (§11.4). Separadas a propósito: el
    // reparto puede salir sin los anticipos, pero **no al revés** — sin anticipo,
    // el sobrante de un reparto volvería a evaporarse.
    if (asignaciones.length > 1) {
        await (0, feature_flags_1.assertFeatureEnabled)("producto-pago-multiple", tenantId);
    }
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
                // R10. El anticipo del intento original, no uno nuevo.
                ...(prev.advanceId ? { advanceId: prev.advanceId, advanceAmount: prev.advanceAmount } : {}),
            };
        }
        // Todas las cuotas del reparto, en orden. Se leen ANTES de escribir nada:
        // una transacción de Firestore no admite leer después de escribir, y con
        // varias líneas la tentación de leer cada una dentro de su vuelta del bucle
        // es exactamente lo que rompería la transacción.
        const cuotas = [];
        for (const ref of cuotaRefs) {
            const snap = await tx.get(ref);
            if (!snap.exists) {
                throw new https_1.HttpsError("not-found", "El cobro vinculado ya no existe.");
            }
            const doc = snap.data();
            // El conjunto de la cuota manda sobre el que diga el llamante: si no
            // coinciden, alguien está intentando cobrar en un conjunto ajeno.
            if (doc.tenantId && doc.tenantId !== tenantId) {
                throw new https_1.HttpsError("permission-denied", "Esa cuota pertenece a otro conjunto.");
            }
            cuotas.push(doc);
        }
        const cuota = cuotas[0];
        // **Todas las líneas, de la misma unidad.** Un pago es de alguien que paga
        // lo de SU unidad, y el sobrante se convierte en anticipo **de esa unidad**
        // (R2). Repartir entre unidades distintas dejaría un anticipo sin dueño
        // claro, y el saldo a favor de un residente podría nacer de un pago que
        // cubrió cargos de un vecino.
        if (cuotas.some((c) => (c.unitId ?? "") !== (cuota.unitId ?? ""))) {
            throw new https_1.HttpsError("invalid-argument", "Un pago no puede repartirse entre cargos de unidades distintas.");
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
        // La cuenta bancaria se COMPROBA, no se copia tal cual.
        //
        // El objetivo entero de D-C es que la conciliación deje de adivinar; un id
        // que no existe, o peor, el de OTRO conjunto, escribiría un asiento que
        // parece conciliable y no lo es — y eso es peor que el `null` de antes,
        // porque el `null` al menos se ve. La comprobación de conjunto es la misma
        // que ya se le hace a la cuota y al comprobante unas líneas más arriba.
        //
        // Va aquí, con el resto de lecturas, porque una transacción de Firestore no
        // admite leer después de escribir.
        let cuentaBancariaId = null;
        const bankAccountIdCrudo = typeof input.bankAccountId === "string" ? input.bankAccountId.trim() : "";
        if (bankAccountIdCrudo) {
            const cuentaSnap = await tx.get(firestore.collection("bankAccounts").doc(bankAccountIdCrudo));
            if (!cuentaSnap.exists) {
                throw new https_1.HttpsError("not-found", "Esa cuenta bancaria no existe.");
            }
            const cuentaBancaria = cuentaSnap.data();
            if (cuentaBancaria.tenantId && cuentaBancaria.tenantId !== tenantId) {
                throw new https_1.HttpsError("permission-denied", "Esa cuenta bancaria pertenece a otro conjunto.");
            }
            // Una cuenta dada de baja no recibe dinero nuevo. No se bloquea la
            // reversión de lo que ya entró por ella: el reverso COPIA la del asiento
            // original y no vuelve a pasar por aquí.
            if (cuentaBancaria.active === false) {
                throw new https_1.HttpsError("failed-precondition", "Esa cuenta bancaria está inactiva.");
            }
            cuentaBancariaId = bankAccountIdCrudo;
        }
        // ── Aritmética y escrituras, una vuelta por línea del reparto ────────────
        //
        // **D-A: el sobrepago deja de evaporarse.** Hasta hoy esto era
        // `pagadoDespues = pagadoAntes + monto` a secas, y `calcularSaldo` topaba el
        // saldo en cero: pagar 200 sobre una cuota de 140 dejaba la cuota en `paid`
        // con `paymentAmount: 200`, y **los 60 sobrantes se contabilizaban íntegros
        // como ingreso de cuotas**. No quedaba saldo a favor en ninguna parte. El
        // dinero entró y el producto lo olvidó.
        //
        // Ahora a cada cargo va solo lo que debía, y lo que sobre —de una línea o de
        // todas— se guarda como anticipo. Con `producto-anticipos` apagada, `deuda`
        // no se mira y el comportamiento es idéntico al de hoy.
        //
        // **Un asiento POR LÍNEA, y no uno por pago.** Cada cargo lleva su propia
        // cuenta (R6 de `PLAT-003`): un pago que cubre una cuota y una multa tiene
        // que dejar el ingreso en las dos cuentas, no elegir una. Un solo asiento
        // para todo obligaría a inventarse una cuenta común, que es justo el defecto
        // que `PLAT-003` corrigió.
        const entradas = [];
        let totalAplicado = 0;
        let cayoEnOtrosIngresos = false;
        let pagadoDespues = 0;
        let balance = 0;
        let status = "pending";
        // El concepto de la primera línea, que es el del recibo cuando el pago va a
        // un solo cargo — el noventa por ciento de las veces.
        let conceptoDelRecibo = "";
        for (let i = 0; i < asignaciones.length; i += 1) {
            const linea = asignaciones[i];
            const doc = cuotas[i];
            const cobrado = typeof doc.amount === "number" ? doc.amount : 0;
            const pagadoAntes = typeof doc.paymentAmount === "number" ? doc.paymentAmount : 0;
            // R4. Lo cubierto con anticipos NO se suma a `paymentAmount` —ver el
            // tipo—, pero sí cuenta para saber si la cuota está saldada.
            const anticipoAplicado = typeof doc.advanceAppliedAmount === "number" ? doc.advanceAppliedAmount : 0;
            const deuda = Math.max(cobrado - pagadoAntes - anticipoAplicado, 0);
            const aplicadoAlCargo = anticipos ? Math.min(linea.amount, deuda) : linea.amount;
            const pagadoDeLaLinea = pagadoAntes + aplicadoAlCargo;
            const saldo = calcularSaldo(cobrado, pagadoDeLaLinea, anticipoAplicado, doc.dueDate, hoy);
            totalAplicado += aplicadoAlCargo;
            // ── La cuenta del concepto (R6) ────────────────────────────────────────
            //
            // Hasta el 22 de agosto de 2026 aquí había un `category: "alicuota"` fijo,
            // y el `concept` del cargo —que lleva existiendo desde siempre en el mismo
            // documento que se acaba de leer— no se miraba. Una multa, una cuota
            // extraordinaria o un parqueadero se contabilizaban todos como cuota de
            // administración, así que **el estado financiero de cualquier conjunto que
            // cobrara algo distinto de la cuota estaba mal**.
            //
            // Se escriben las TRES cosas coherentes o ninguna: el código de cuenta, la
            // categoría equivalente —que se sigue escribiendo, §7.2— y la descripción,
            // que también estaba cableada a «alícuota».
            const resolucion = (0, plan_de_cuentas_1.cuentaParaConcepto)(doc.concept);
            // R8: un concepto sin cuenta equivalente cae en `otros_ingresos` y **se
            // avisa**. Nunca se descarta. Con varias líneas basta que UNA caiga por
            // defecto para que el aviso viaje: quien cobra tiene que enterarse.
            if (conceptoAlLibro && resolucion.porDefecto)
                cayoEnOtrosIngresos = true;
            const ledgerRef = firestore.collection("ledgerEntries").doc();
            const queSeCobra = conceptoAlLibro ? (0, plan_de_cuentas_1.descripcionDeCobro)(doc.concept) : "alícuota";
            const concepto = `Pago de ${queSeCobra} ${doc.period ?? ""} — ${doc.unitLabel ?? ""}`.trim();
            // Un asiento de importe cero no se escribe: con `producto-anticipos`
            // encendida, una línea contra un cargo ya saldado aplica 0 y su dinero se
            // va al anticipo. Una fila de cero en el libro es ruido que nadie sabe
            // interpretar después.
            if (aplicadoAlCargo > 0) {
                tx.set(ledgerRef, {
                    tenantId,
                    type: "ingreso",
                    date: fecha,
                    // Lo APLICADO al cargo, no lo pagado. El sobrante tiene su propio
                    // asiento. Este importe no alimenta el ingreso —el asiento se excluye
                    // por origen, ver `esRecaudoDeCartera`— pero sí es la fila que el
                    // administrador ve en el libro y la que el reverso refleja. Dejarlo en
                    // `monto` diría 200 donde Cartera contó 140, y al revertir se
                    // restarían 200 de un `paymentAmount` que solo subió 140.
                    amount: aplicadoAlCargo,
                    concept: concepto,
                    category: conceptoAlLibro ? (0, plan_de_cuentas_1.categoriaParaConcepto)(doc.concept) : "alicuota",
                    // Con la bandera apagada NO se escribe `accountCode`, y no es un
                    // detalle: R9 dice que los informes agrupan por el código y solo caen
                    // en la categoría si falta.
                    ...(conceptoAlLibro ? { accountCode: resolucion.code } : {}),
                    // D-C. `null` cuando no viene: es efectivo, o un cobro registrado sin
                    // decir por dónde entró. Lo que ya no ocurre es que sea `null` SIEMPRE.
                    bankAccountId: cuentaBancariaId,
                    sourceType: "billingStatement",
                    // El asiento guarda SU clave de operación. Sin esto la reversión no es
                    // direccionable: la marca de idempotencia sabe cuáles son sus asientos,
                    // pero el asiento no sabría cuál es su marca.
                    operationKey,
                    sourceId: linea.statementId,
                    reconciled: false,
                    // Deja ver de qué ruta vino sin tener que cruzar colecciones.
                    paymentSource: input.source,
                    ...(input.receiptId ? { receiptId: input.receiptId } : {}),
                    createdBy: uid,
                    updatedBy: uid,
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                entradas.push({ statementId: linea.statementId, ledgerEntryId: ledgerRef.id, amount: aplicadoAlCargo });
                tx.update(cuotaRefs[i], {
                    paymentAmount: pagadoDeLaLinea,
                    balance: saldo.balance,
                    status: saldo.status,
                    lastPaymentAt: fecha,
                    ...(input.receiptId ? { lastReceiptId: input.receiptId } : {}),
                    updatedBy: uid,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            // El resultado del callable sigue hablando de UN cargo —el primero— para
            // no romper a quien ya lo consume. El detalle completo va en `allocations`.
            if (i === 0) {
                pagadoDespues = pagadoDeLaLinea;
                balance = saldo.balance;
                status = saldo.status;
                conceptoDelRecibo = concepto;
            }
        }
        const sobrante = monto - totalAplicado;
        // **R1, comprobada y no supuesta:** lo aplicado más el anticipo es
        // EXACTAMENTE lo pagado. Si esto salta es un fallo de programación, no de
        // datos, y se prefiere abortar la transacción entera a escribir un reparto
        // que no cuadra con lo que el residente pagó.
        if (totalAplicado + sobrante !== monto || totalAplicado < 0 || sobrante < 0) {
            throw new https_1.HttpsError("internal", "El reparto del pago no cuadra con el importe recibido.");
        }
        // ── El anticipo (R2, R3, R5) ─────────────────────────────────────────────
        //
        // Nace en la MISMA transacción del pago a propósito (§11.1): si se creara
        // aparte, un fallo entre las dos operaciones dejaría dinero sin registrar —
        // exactamente el hueco que `FIN-001` cerró para el recibo.
        let advanceId;
        // **R3: un anticipo de importe cero no se crea.** No es cosmética: una lista
        // de anticipos llena de ceros es una lista que nadie mira, y la vista de
        // anticipos abiertos es la herramienta de G5.
        if (sobrante > 0) {
            const advanceRef = firestore.collection("advances").doc();
            const anticipoLedgerRef = firestore.collection("ledgerEntries").doc();
            // **R5 y §7.4, y es LA línea de esta ficha.**
            //
            // `sourceType: "advance"`, NO `"billingStatement"`. Este asiento nace
            // dentro de `aplicarPago`, donde el del cobro se escribe con
            // `billingStatement`; heredarlo —que es lo que pasa si nadie lo piensa—
            // haría que `esRecaudoDeCartera` lo excluyera del libro **aunque su
            // categoría diga `anticipo`**, y el anticipo desapareceria: no está en
            // `cuotaIncome`, porque eso suma `paymentAmount` de cargos y un anticipo
            // no es de ningún cargo. Se descontaría de un lado sin estar sumado en el
            // otro.
            //
            // Con origen propio, `esRecaudoDeCartera` devuelve `false` y el importe
            // entra en el ingreso del período (CA7), en su propia línea (D1).
            tx.set(anticipoLedgerRef, {
                tenantId,
                type: "ingreso",
                date: fecha,
                amount: sobrante,
                concept: `Anticipo de ${cuota.unitLabel ?? "la unidad"}`.trim(),
                category: "anticipo",
                // Misma bandera que el resto de cuentas: apagada no se escribe código, y
                // los informes caen en la categoría (R9).
                ...(conceptoAlLibro ? { accountCode: plan_de_cuentas_1.CUENTA_ANTICIPO } : {}),
                bankAccountId: cuentaBancariaId,
                sourceType: "advance",
                operationKey,
                sourceId: advanceRef.id,
                reconciled: false,
                paymentSource: input.source,
                createdBy: uid,
                updatedBy: uid,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.set(advanceRef, {
                tenantId,
                unitId: cuota.unitId ?? "",
                unitLabel: cuota.unitLabel ?? "",
                amount: sobrante,
                remaining: sobrante,
                origin: "overpayment",
                sourceOperationKey: operationKey,
                ledgerEntryId: anticipoLedgerRef.id,
                date: fecha,
                status: "open",
                createdBy: uid,
                updatedBy: uid,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            advanceId = advanceRef.id;
        }
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
                // **Un recibo por PAGO, no por línea.** El residente hizo una
                // transferencia; darle tres papeles por un movimiento sería contarle su
                // contabilidad interna. Cuando cubre varios cargos, el concepto lo dice
                // y el detalle va en el aviso (§9).
                concept: entradas.length > 1
                    ? `Pago de ${entradas.length} cargos — ${cuota.unitLabel ?? ""}`.trim()
                    : conceptoDelRecibo,
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
                // El primero. Con varias líneas el recibo no cuelga de un asiento
                // concreto; el puente completo es `operationKey`, que los ata todos.
                ...(entradas[0] ? { ledgerEntryId: entradas[0].ledgerEntryId } : {}),
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
            // Lo que de verdad fue al cargo. `amount` es lo que pagó el residente, y
            // los dos dejan de coincidir en cuanto hay sobrante: sin este campo, la
            // reversión restaría del `paymentAmount` un importe que nunca subió ahí.
            appliedToStatement: totalAplicado,
            // **El reparto entero, que es lo que la reversión necesita para deshacerlo.**
            // Sin esto el reverso solo sabría de un cargo y un asiento, y un pago
            // repartido entre tres cuotas se desharía a un tercio.
            allocations: entradas,
            source: input.source,
            ...(input.receiptId ? { receiptId: input.receiptId } : {}),
            ...(entradas[0] ? { ledgerEntryId: entradas[0].ledgerEntryId } : {}),
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherId ? { voucherId, voucherCode } : {}),
            // R10: el reintento devuelve ESTE anticipo, no crea otro.
            ...(advanceId ? { advanceId, advanceAmount: sobrante } : {}),
            actorUid: uid,
            createdAt: firestore_1.Timestamp.now(),
        });
        return {
            ok: true,
            applied: true,
            // Se conserva en singular por compatibilidad: es lo que consume el front
            // de hoy. Con varias líneas es el primero, y el detalle va en `allocations`.
            ledgerEntryId: entradas[0]?.ledgerEntryId ?? "",
            allocations: entradas,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherId ? { voucherId, voucherCode } : {}),
            ...(advanceId ? { advanceId, advanceAmount: sobrante } : {}),
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
function saldoTrasRevertir(totalCobrado, pagadoAntes, montoRevertido, anticipoAplicado, vencimiento, hoy) {
    const pagadoDespues = Math.max(pagadoAntes - montoRevertido, 0);
    const { balance, status } = calcularSaldo(totalCobrado, pagadoDespues, anticipoAplicado, vencimiento, hoy);
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
        // **Lo que se le quita a la cuota es lo que se le puso**, que deja de ser
        // `op.amount` en cuanto el pago dejó sobrante: un pago de 200 sobre una
        // cuota de 140 subió `paymentAmount` en 140, no en 200. Restar `amount` a
        // ciegas dejaría el pagado en cero cuando debería quedar en 60 —o en
        // negativo, que `saldoTrasRevertir` tapa con su `max(…, 0)` y entonces el
        // descuadre se vuelve invisible—.
        //
        // El respaldo a `amount` es para los pagos anteriores a `FLOW-002`, que no
        // tienen el campo y en los que los dos importes siempre coincidieron.
        const montoDeCartera = typeof op.appliedToStatement === "number" ? op.appliedToStatement : monto;
        // **El reparto que hay que deshacer, normalizado.**
        //
        // Los pagos anteriores a `FLOW-002` no tienen `allocations`: se reconstruye
        // la línea única desde los campos viejos. Sin este respaldo, revertir un
        // pago de antes de esta ficha no desharía nada — y son todos los que hay en
        // producción ahora mismo.
        const reparto = Array.isArray(op.allocations) && op.allocations.length > 0
            ? op.allocations
            : [{ statementId, ledgerEntryId: op.ledgerEntryId ?? "", amount: montoDeCartera }];
        // **R15 — revertir un pago se lleva por delante el anticipo que generó.**
        //
        // Sin esto, revertir un pago de 200 sobre una cuota de 140 devolvería los
        // 140 y **dejaría vivo un saldo a favor de 60 de un dinero ya devuelto**: el
        // residente conservaría un crédito por dinero que tiene otra vez en el
        // bolsillo. R8 cubría solo el anticipo YA CRUZADO, que es el caso raro; este
        // es el normal, y no estaba escrito en ninguna versión de la PRD.
        const advanceRef = op.advanceId ? firestore.collection("advances").doc(op.advanceId) : null;
        const advanceSnap = advanceRef ? await tx.get(advanceRef) : null;
        const advance = advanceSnap?.data();
        // **R8: no se revierte un pago cuyo anticipo tenga cruces VIGENTES.**
        //
        // Deshacerlos aquí sería tocar cargos que el llamante no nombró —y que
        // pueden ser de otros períodos— dentro de una transacción que él cree que
        // afecta a una sola cuota. Se bloquea y se dice qué hacer: primero se
        // deshacen los cruces, y entonces se revierte.
        //
        // **Se preguntan los cruces, no el remanente.** Esto era
        // `remaining < amount`, que parecía lo mismo y no lo es: **anular un
        // anticipo (R9) pone `remaining` a cero sin haber cruzado nada**, así que un
        // anticipo anulado se leía como «cruzado» y bloqueaba una reversión
        // perfectamente legítima. Lo destapó verificar contra la base con una
        // secuencia larga —pagar, cruzar, descruzar, anular, revertir—; ninguna
        // prueba unitaria encadenaba las cinco.
        //
        // La consulta va DENTRO de la transacción, con el resto de lecturas, y se
        // filtra en memoria: `reversedAt` está AUSENTE en los cruces vivos, y un
        // `where("reversedAt", "==", null)` no encuentra un campo que no existe —
        // habría devuelto cero cruces siempre, que es la peor forma de estar mal.
        const crucesSnap = op.advanceId
            ? await tx.get(firestore.collection("advanceApplications").where("advanceId", "==", op.advanceId))
            : null;
        const cruceVigente = (crucesSnap?.docs ?? []).some((d) => !d.data().reversedAt);
        if (cruceVigente) {
            throw new https_1.HttpsError("failed-precondition", "El saldo a favor de ese pago ya se aplicó a otros cargos. Primero hay que deshacer esos cruces.");
        }
        // Su asiento se lee AQUÍ, con el resto: la transacción no admite leer
        // después de escribir, y el reverso necesita copiarle la cuenta bancaria.
        const advanceLedgerRef = advance?.ledgerEntryId
            ? firestore.collection("ledgerEntries").doc(advance.ledgerEntryId)
            : null;
        const advanceLedgerSnap = advanceLedgerRef ? await tx.get(advanceLedgerRef) : null;
        // Una cuota y un asiento por línea del reparto. Todas las lecturas antes de
        // cualquier escritura: la transacción no admite el orden contrario.
        const lineas = [];
        for (const linea of reparto) {
            const cuotaRef = firestore.collection("billingStatements").doc(linea.statementId);
            const cuotaSnap = await tx.get(cuotaRef);
            if (!cuotaSnap.exists) {
                throw new https_1.HttpsError("not-found", "La cuota del pago ya no existe.");
            }
            const asientoRef = linea.ledgerEntryId
                ? firestore.collection("ledgerEntries").doc(linea.ledgerEntryId)
                : null;
            const asientoSnap = asientoRef ? await tx.get(asientoRef) : null;
            lineas.push({
                statementId: linea.statementId,
                amount: linea.amount,
                cuotaRef,
                cuota: cuotaSnap.data(),
                asientoRef,
                asiento: asientoSnap?.data(),
                asientoExiste: Boolean(asientoSnap?.exists),
            });
        }
        const cuota = lineas[0].cuota;
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
        // ── Aritmética y escrituras, una vuelta por línea del reparto ────────────
        //
        // **R7 y R13: el reverso hereda del asiento que anula.**
        //
        // **R7 — la misma cuenta.** Si el reverso cayera en otra, la reversión no
        // anularía nada: dejaría un positivo en una cuenta y un negativo en otra, y
        // las dos mentirían. Se COPIA del original en vez de volver a resolverla
        // desde el concepto, porque el cargo pudo cambiar de concepto entre el pago
        // y su reversión, y lo que hay que deshacer es el asiento que se escribió,
        // no el que se escribiría hoy.
        //
        // **R13 — el reverso arrastra el ORIGEN de lo que anula.** Un reverso pierde
        // su origen al nacer (`sourceType: "reversal"`). Mientras todo cobro se
        // escribía como `alicuota`, la exclusión que evita el doble conteo lo
        // atrapaba por la categoría. En cuanto el reverso lleva la cuenta del
        // concepto —una multa— **deja de ser las dos cosas**: ni `billingStatement`
        // ni `alicuota`. Entonces su monto NEGATIVO entra en el ingreso del libro
        // mientras Cartera ya lo descontó del `paymentAmount`, y el ingreso baja dos
        // veces. Sin R13, encender `producto-concepto-al-libro` arregla el cobro y
        // rompe la reversión.
        let pagadoDespues = 0;
        let balance = 0;
        let status = "pending";
        let reversalEntryId = "";
        for (let i = 0; i < lineas.length; i += 1) {
            const linea = lineas[i];
            const cobradoLinea = typeof linea.cuota.amount === "number" ? linea.cuota.amount : 0;
            const pagadoAntesLinea = typeof linea.cuota.paymentAmount === "number" ? linea.cuota.paymentAmount : 0;
            const saldo = saldoTrasRevertir(cobradoLinea, pagadoAntesLinea, linea.amount, 
            // Revertir un pago NO devuelve el anticipo cruzado: son dos operaciones
            // distintas y se deshacen por separado (R8 bloquea el caso conflictivo).
            // Si no se pasara, revertir un pago sobre un cargo cubierto en parte con
            // anticipo dejaría el saldo inflado por ese importe.
            typeof linea.cuota.advanceAppliedAmount === "number" ? linea.cuota.advanceAppliedAmount : 0, linea.cuota.dueDate, hoy);
            const reversoRef = firestore.collection("ledgerEntries").doc();
            const conceptoOriginal = linea.asiento?.concept ?? `Pago ${linea.statementId}`;
            tx.set(reversoRef, {
                tenantId,
                type: "ingreso",
                date: hoy,
                // Negativo, no tipo opuesto: misma convención que `reverseLedgerEntry`.
                // Y del importe DE CARTERA, que es lo que el asiento original escribió.
                amount: -Math.abs(linea.amount),
                concept: `Reverso: ${conceptoOriginal}`,
                // El respaldo a `"alicuota"` conserva exactamente lo que hacía antes
                // para los asientos viejos, que no tienen categoría propia.
                category: linea.asiento?.category ?? "alicuota",
                ...(linea.asiento?.accountCode ? { accountCode: linea.asiento.accountCode } : {}),
                // **D-C, el segundo de los dos.** Se copia la del asiento que se anula:
                // si el reverso cayera en otra cuenta, la conciliación vería un positivo
                // en una y un negativo en otra, y **las dos estarían mal**. `null`
                // cuando no hay asiento que leer —pagos anteriores a `FIN-001`—: no se
                // inventa una cuenta que nunca se registró.
                bankAccountId: linea.asiento?.bankAccountId ?? null,
                sourceType: "reversal",
                // R13. Se escribe SIEMPRE, con bandera o sin ella: hoy no cambia nada
                // —el reverso ya se excluye por su categoría— y el día que la bandera se
                // encienda tiene que estar ya en los asientos, no empezar a escribirse
                // entonces. Un campo de seguridad que aparece a la vez que el peligro
                // llega tarde para todo lo escrito en medio.
                ...(linea.asiento?.sourceType && linea.asiento.sourceType !== "reversal"
                    ? { reversedSourceType: linea.asiento.sourceType }
                    : { reversedSourceType: "billingStatement" }),
                sourceId: linea.asientoRef?.id ?? linea.statementId,
                reversalReason: motivo,
                reconciled: false,
                createdBy: uid,
                updatedBy: uid,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            if (linea.asientoRef && linea.asientoExiste) {
                tx.update(linea.asientoRef, {
                    reversedByEntryId: reversoRef.id,
                    updatedBy: uid,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            tx.update(linea.cuotaRef, {
                paymentAmount: saldo.paymentAmount,
                balance: saldo.balance,
                status: saldo.status,
                updatedBy: uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            if (i === 0) {
                pagadoDespues = saldo.paymentAmount;
                balance = saldo.balance;
                status = saldo.status;
                reversalEntryId = reversoRef.id;
            }
        }
        // ── R15: el anticipo se anula y su asiento se revierte ───────────────────
        //
        // **Y aquí sí se revierte el asiento, al revés que al anular un anticipo a
        // secas (R9).** Son dos cosas distintas: anular deja el dinero dentro del
        // conjunto —lo que desaparece es el crédito de esa unidad, y devolverlo es
        // un egreso aparte (§4)—; revertir el pago devuelve el dinero entero. Si no
        // se revirtiera, el libro seguiría diciendo que entraron esos 60.
        //
        // El reverso lleva `reversedSourceType: "advance"`, así que
        // `esRecaudoDeCartera` NO lo excluye y su importe negativo baja el ingreso
        // del período. Es la simetría exacta de la entrada.
        if (advanceRef && advance) {
            const advanceOriginal = advanceLedgerSnap?.data();
            if (advanceLedgerRef && advanceLedgerSnap?.exists) {
                const reversoAnticipoRef = firestore.collection("ledgerEntries").doc();
                tx.set(reversoAnticipoRef, {
                    tenantId,
                    type: "ingreso",
                    date: hoy,
                    amount: -Math.abs(advance.amount ?? 0),
                    concept: `Reverso de anticipo: ${cuota.unitLabel ?? ""}`.trim(),
                    category: advanceOriginal?.category ?? "anticipo",
                    ...(advanceOriginal?.accountCode ? { accountCode: advanceOriginal.accountCode } : {}),
                    bankAccountId: advanceOriginal?.bankAccountId ?? null,
                    sourceType: "reversal",
                    reversedSourceType: "advance",
                    sourceId: advance.ledgerEntryId ?? "",
                    reversalReason: motivo,
                    reconciled: false,
                    createdBy: uid,
                    updatedBy: uid,
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
                tx.update(advanceLedgerRef, {
                    reversedByEntryId: reversoAnticipoRef.id,
                    updatedBy: uid,
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
            // El anticipo no se borra: se anula con motivo, igual que R9. Los
            // registros contables no se borran nunca en este repositorio.
            tx.update(advanceRef, {
                status: "cancelled",
                remaining: 0,
                cancelledAt: firestore_1.FieldValue.serverTimestamp(),
                cancelledBy: uid,
                cancellationReason: `Se revirtió el pago que lo generó: ${motivo}`,
                updatedBy: uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
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
            // Lo mismo que el asiento: lo que se deshizo en Cartera.
            amount: -Math.abs(montoDeCartera),
            reason: motivo,
            reversalEntryId,
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
            // El del primer cargo, por lo mismo que en `aplicarPago`: se conserva en
            // singular para no romper a quien ya lo consume.
            reversalEntryId,
            paymentAmount: pagadoDespues,
            balance,
            status,
            ...(voucherAnuladoId ? { voucherAnuladoId } : {}),
        };
    });
}
