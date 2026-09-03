"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumarSaldoDeApertura = sumarSaldoDeApertura;
exports.detallarCarteraPorUnidad = detallarCarteraPorUnidad;
exports.detallarDeudaAProveedores = detallarDeudaAProveedores;
exports.finDelPeriodo = finDelPeriodo;
exports.construirInstantanea = construirInstantanea;
exports.leerYConstruirInstantanea = leerYConstruirInstantanea;
exports.idDelInforme = idDelInforme;
exports.assertPeriodoValido = assertPeriodoValido;
exports.guardarBorrador = guardarBorrador;
exports.prepararEmision = prepararEmision;
exports.sellarEmision = sellarEmision;
exports.firmarInforme = firmarInforme;
exports.anularInforme = anularInforme;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const nucleo_estado_financiero_1 = require("./nucleo-estado-financiero");
/**
 * `PRD-V-FLOW-007`, entrega 2 — el informe mensual **emitible y firmable**.
 *
 * ## Qué añade sobre la entrega 1
 *
 * La entrega 1 unificó la ARITMÉTICA: una sola implementación del estado
 * financiero, espejada byte a byte entre `src/` y `functions/`. Lo que no
 * existía todavía es el **documento**: un informe que se emite una vez, congela
 * sus cifras, lo firma quien responde por él y se conserva aunque después se
 * corrija un asiento.
 *
 * ## Por qué CALLABLE y no escritura directa (§11.1 de la ficha)
 *
 * Sin discusión posible, y por tres razones que se acumulan:
 *
 *   1. **Escribe en tres sitios** —`monthlyReports`, `documents` y Storage—, y
 *      los tres tienen que quedar coherentes o ninguno.
 *   2. **Congela cifras.** Si las mandara el cliente, el administrador emitiría
 *      el número que quisiera. El servidor las **recalcula** y las sella; de la
 *      petición solo se admite QUÉ conjunto y QUÉ período.
 *   3. **`issuedBy` / `issuedAt` sostienen un invariante** —quién firma un
 *      documento con sanción legal detrás—, y **un campo escribible desde el
 *      cliente no puede sostener un invariante**.
 *
 * La LECTURA sí va directa, protegida por reglas: son consultas de lista con
 * `tenantId` y `status`, y eso las reglas lo saben proteger entero.
 *
 * ## La cifra se calcula UNA vez, aquí
 *
 * `construirInstantanea` es **pura** —recibe documentos ya leídos y no toca
 * Firestore— y es la que usan **los dos** caminos: la corrida programada del día
 * 1 (`monthlyFinancialArchive`) y las callables. Es la misma decisión que tomó la
 * entrega 1 con el núcleo, por la misma razón mecánica: `R12` y `R16` se
 * desviaron porque **nada comparaba dos implementaciones**, y la forma de que no
 * haya nada que comparar es que no haya dos.
 *
 * `leerYConstruirInstantanea` es la envoltura que hace las lecturas. La corrida
 * programada **no la usa**: ya tiene los cargos y los asientos en la mano, y
 * pedirlos otra vez sería pagar nueve veces por mes unas lecturas que ya están
 * hechas.
 */
const db = () => (0, firestore_1.getFirestore)();
/**
 * Suma el saldo de apertura de las cuentas del conjunto.
 *
 * **Devuelve `undefined` cuando no hay NINGÚN documento de saldo**, no cero.
 * Sumar sobre una lista vacía da `0` y afirmaría que el conjunto abrió sin un
 * peso — que es una afirmación que nadie hizo (`CA4`). Es la misma lógica que ya
 * corre dentro de `monthlyFinancialArchive`, extraída aquí para que los dos
 * caminos no puedan discrepar.
 */
function sumarSaldoDeApertura(saldos) {
    let acumulado = 0;
    let alguno = false;
    for (const s of saldos) {
        const v = s.openingBalance;
        if (typeof v !== "number" || !Number.isFinite(v))
            continue;
        acumulado += v;
        alguno = true;
    }
    return alguno ? acumulado : undefined;
}
/**
 * El detalle de cartera por unidad.
 *
 * **El total NO se recalcula desde aquí**: lo da `sumarCuentasPorCobrar`, del
 * núcleo, que es la misma función que alimenta la tarjeta de Cartera y el
 * resumen. Dos formas de sumar la misma deuda acaban discrepando, y entonces el
 * informe se contradice consigo mismo entre el total y el desglose.
 *
 * El desglose aplica **los mismos dos filtros** que el total —fuera `cancelled`,
 * fuera `paid`, y el saldo topado en cero por cargo— porque si no, la suma de las
 * filas no daría el total impreso al lado.
 */
function detallarCarteraPorUnidad(cargos) {
    const porUnidad = new Map();
    for (const c of cargos) {
        if (c.status === "cancelled" || c.status === "paid")
            continue;
        const saldo = c.balance ?? 0;
        if (saldo <= 0)
            continue;
        const id = c.unitId ?? "";
        const e = porUnidad.get(id) ?? { label: c.unitLabel ?? id, balance: 0, periods: new Set() };
        e.balance += saldo;
        if (c.period)
            e.periods.add(c.period);
        porUnidad.set(id, e);
    }
    return Array.from(porUnidad.entries())
        .map(([unitId, e]) => ({
        unitId,
        unitLabel: e.label,
        balance: (0, nucleo_estado_financiero_1.aCentimos)(e.balance),
        periods: e.periods.size,
    }))
        .sort((a, b) => b.balance - a.balance);
}
/**
 * El detalle de la deuda a proveedores, y **lo vencido**.
 *
 * **La fuente son los EGRESOS, no `vendors`** — `R5` se falsificó al medir: la
 * colección tiene cero filas y ningún egreso lleva `vendorId`, pero la deuda
 * existe y está en las facturas en `registrado`. Por eso se agrupa por
 * `vendorName`, que el egreso conserva como copia congelada, y quien no lo trae
 * cae en un cajón nombrado en vez de desaparecer del desglose.
 *
 * **`overdue` se mide contra el ÚLTIMO DÍA DEL PERÍODO, no contra hoy.** Un
 * informe de marzo emitido en junio diría, con «hoy», que estaba vencido lo que
 * en marzo no lo estaba — y las cifras congeladas dejarían de describir el mes
 * que dicen describir. Un egreso **sin `dueDate` no cuenta como vencido**: no se
 * sabe cuándo vencía, y afirmarlo sería inventarlo.
 */
function detallarDeudaAProveedores(egresos, finDelPeriodo) {
    const porProveedor = new Map();
    let vencido = 0;
    for (const e of egresos) {
        // El catálogo es castellano: `registrado | pagado | anulado`. Filtrar en
        // inglés no excluye nada — la lección que triplicó la cifra al medir.
        if (e.status !== "registrado")
            continue;
        const monto = e.amount ?? 0;
        const nombre = (e.vendorName ?? "").trim() || "Sin proveedor identificado";
        const actual = porProveedor.get(nombre) ?? { vendorId: e.vendorId, amount: 0 };
        actual.amount += monto;
        porProveedor.set(nombre, actual);
        if (e.dueDate && e.dueDate.slice(0, 10) <= finDelPeriodo)
            vencido += monto;
    }
    return {
        overdue: (0, nucleo_estado_financiero_1.aCentimos)(vencido),
        byVendor: Array.from(porProveedor.entries())
            .map(([vendorName, v]) => ({
            ...(v.vendorId ? { vendorId: v.vendorId } : {}),
            vendorName,
            amount: (0, nucleo_estado_financiero_1.aCentimos)(v.amount),
        }))
            .sort((a, b) => b.amount - a.amount),
    };
}
/** El último día del mes de `YYYY-MM`, como `YYYY-MM-DD`. */
function finDelPeriodo(period) {
    const [y, m] = period.split("-").map((n) => Number(n));
    // Día 0 del mes siguiente = último día de este. Vale para febrero y bisiestos
    // sin tabla de días, que es donde una tabla escrita a mano se equivoca.
    const d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
}
/**
 * Construye las cifras del informe. **Pura**: no lee Firestore ni mira el reloj.
 *
 * Que sea pura es lo que la hace comprobable con números escritos a mano, que es
 * lo que pide `CA1` —«no vale comprobar que existe un import»— y lo que permite
 * que la corrida programada y la callable **compartan la implementación en vez de
 * parecerse**.
 */
function construirInstantanea(datos) {
    const saldoInicial = sumarSaldoDeApertura(datos.saldos);
    const estado = (0, nucleo_estado_financiero_1.construirEstadoFinanciero)({
        asientos: datos.asientos,
        cuota: datos.recaudado,
        openingBalance: saldoInicial,
        plan: datos.plan,
        pendingReceivables: (0, nucleo_estado_financiero_1.sumarCuentasPorCobrar)(datos.cargos),
        supplierDebt: (0, nucleo_estado_financiero_1.sumarDeudaAProveedores)(datos.egresos),
    });
    const proveedores = detallarDeudaAProveedores(datos.egresos, finDelPeriodo(datos.period));
    return {
        // Cero cuando no hay dato, y `openingBalanceSource` es quien lo dice. Ver
        // el comentario del tipo: la distinción va en un campo, no en un `undefined`.
        openingBalance: estado.openingBalance ?? 0,
        openingBalanceSource: estado.openingBalanceSource,
        // `fundBalance` ES el saldo final. El nombre distinto es la razón de que
        // buscar `closingBalance` en el repositorio diera cero (§2, hallazgo 3).
        closingBalance: estado.fundBalance,
        income: estado.incomeByCategory.map((c) => ({ code: c.category, label: c.label, amount: c.amount })),
        expenses: estado.expenseByCategory.map((c) => ({ code: c.category, label: c.label, amount: c.amount })),
        totalIncome: estado.totalIncome,
        totalExpenses: estado.totalExpenses,
        netResult: estado.netResult,
        receivables: {
            total: estado.pendingReceivables,
            byUnit: detallarCarteraPorUnidad(datos.cargos),
        },
        payables: {
            total: estado.supplierDebt,
            overdue: proveedores.overdue,
            byVendor: proveedores.byVendor,
        },
    };
}
// ── Las lecturas ─────────────────────────────────────────────────────────────
/**
 * Lee lo que el informe necesita y construye la instantánea.
 *
 * La usan las callables, que no tienen nada leído. La corrida programada **no**:
 * ya trae los cargos y los asientos, y volver a pedirlos sería pagar dos veces.
 */
async function leerYConstruirInstantanea(tenantId, period, plan) {
    const firestore = db();
    const [cargosSnap, asientosSnap, saldosSnap, egresosSnap] = await Promise.all([
        firestore.collection("billingStatements").where("tenantId", "==", tenantId).get(),
        firestore.collection("ledgerEntries").where("tenantId", "==", tenantId).get(),
        firestore.collection("bankAccountBalances").where("tenantId", "==", tenantId).get(),
        firestore.collection("expenses").where("tenantId", "==", tenantId).get(),
    ]);
    const cargos = cargosSnap.docs.map((d) => d.data());
    // El recaudo del mes, con la MISMA fórmula que la corrida programada:
    // `paymentAmount` topado en cero. Se cuenta sobre los cargos del período.
    const delMes = cargos.filter((c) => c.period === period);
    const recaudado = delMes.reduce((a, c) => a + Math.max(c.paymentAmount ?? 0, 0), 0);
    const asientos = asientosSnap.docs
        .map((d) => d.data())
        .filter((e) => (e.date ?? "").slice(0, 7) === period);
    return construirInstantanea({
        period,
        cargos,
        asientos,
        recaudado,
        saldos: saldosSnap.docs.map((d) => d.data()),
        egresos: egresosSnap.docs.map((d) => d.data()),
        plan,
    });
}
// ── El identificador ─────────────────────────────────────────────────────────
/**
 * El id del informe **es determinista**: `<tenantId>_<period>`.
 *
 * No es cosmética. Un conjunto tiene **un** informe por mes, y dejar que
 * Firestore genere el id permitiría dos borradores del mismo período —dos
 * corridas, dos regeneraciones, un reintento— y entonces «el informe de marzo»
 * deja de ser una cosa. Con el id derivado, la segunda corrida **encuentra** la
 * primera en vez de duplicarla, y la guarda de estado decide qué hacer con ella.
 *
 * Es el mismo patrón de idempotencia del paz y salvo y del reparto: **el id ES
 * la clave**.
 */
function idDelInforme(tenantId, period) {
    return `${tenantId}_${period}`;
}
const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;
function assertPeriodoValido(period) {
    if (!PERIODO_VALIDO.test(period)) {
        throw new https_1.HttpsError("invalid-argument", "El período debe tener la forma AAAA-MM.");
    }
}
// ── Guardar el borrador ──────────────────────────────────────────────────────
/**
 * Escribe (o refresca) el borrador del período.
 *
 * **Nunca toca un informe que no esté en `borrador`.** Es `RN-05` visto desde el
 * otro lado: si la corrida del día 1 pudiera reescribir un informe ya emitido,
 * las cifras congeladas no lo estarían — bastaría esperar al mes siguiente para
 * que cambiaran solas. Devuelve `false` y no escribe.
 *
 * `merge: false` a propósito: un borrador que se regenera **sustituye** sus
 * cifras. Con `merge` sobrevivirían líneas de una versión anterior que ya no
 * existen —una cuenta del plan que se quedó sin asientos—, y el informe diría
 * una deuda que nadie tiene.
 */
async function guardarBorrador(input) {
    const ref = db().collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));
    const snap = await ref.get();
    const previo = snap.data();
    if (previo?.status && previo.status !== "borrador") {
        return { escrito: false, motivo: previo.status };
    }
    await ref.set({
        tenantId: input.tenantId,
        period: input.period,
        status: "borrador",
        ...input.instantanea,
        generatedBy: input.actorUid,
        generatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        // **`createdAt` se arrastra a mano, y no sobra.** Con `merge: false` el
        // documento se sustituye entero, así que regenerar un borrador borraría
        // la fecha en que nació y el informe diría haberse creado la última vez
        // que alguien pulsó «regenerar».
        createdAt: previo?.createdAt ?? firestore_1.FieldValue.serverTimestamp(),
    }, { merge: false });
    return { escrito: true };
}
/**
 * Comprueba que se pueda emitir y **recalcula las cifras**. No escribe nada.
 *
 * Se parte en dos —preparar aquí, sellar después— porque entre las dos cosas hay
 * que construir el PDF y archivarlo, y el archivador vive en `index.ts` con la
 * carpeta de sistema y el bucket. Sellar primero dejaría un informe `emitido`
 * **sin PDF** si el archivo fallara, que es la peor de las dos mitades: un
 * documento que la ley obliga a publicar, marcado como emitido, y sin nada que
 * enseñar.
 *
 * **Las cifras se recalculan aquí y NO se toman del borrador.** El borrador lo
 * escribió una corrida de hace días; entre medias el administrador corrigió
 * asientos —que es exactamente lo que el flujo le pide hacer— y emitir cifras
 * viejas sellaría como definitivo lo que él acaba de arreglar. Y del cliente no
 * llega ni una cifra: solo qué conjunto y qué período.
 */
async function prepararEmision(input) {
    assertPeriodoValido(input.period);
    const ref = db().collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));
    const snap = await ref.get();
    const estado = snap.data()?.status;
    if (estado === "anulado") {
        throw new https_1.HttpsError("failed-precondition", "Ese informe está anulado. Un informe anulado no se reemite: se genera y se emite uno nuevo.");
    }
    if (estado === "emitido" || estado === "publicado") {
        return { instantanea: snap.data(), yaEmitido: true };
    }
    // Sin borrador no se emite. El borrador no es un trámite: es la versión que
    // alguien miró antes de firmar, y emitir sin él sería firmar sin haber visto.
    if (!snap.exists) {
        throw new https_1.HttpsError("failed-precondition", "No hay borrador de ese período. Genéralo antes de emitir.");
    }
    return {
        instantanea: await leerYConstruirInstantanea(input.tenantId, input.period, input.plan),
        yaEmitido: false,
    };
}
/**
 * Sella la emisión: estado, cifras congeladas, firmante y PDF.
 *
 * **Va en transacción y vuelve a comprobar el estado dentro.** Entre `prepararEmision`
 * y esto pasan las lecturas del informe y la construcción del PDF —cientos de
 * milisegundos—, y en ese hueco cabe otra pestaña emitiendo el mismo período. Sin
 * la relectura, el segundo sobrescribiría las cifras del primero **después** de que
 * el primero ya archivó su PDF, y quedarían un documento y un informe diciendo cosas
 * distintas del mismo mes.
 */
async function sellarEmision(input) {
    const firestore = db();
    const ref = firestore.collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));
    await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const estado = snap.data()?.status;
        if (estado !== "borrador") {
            throw new https_1.HttpsError("failed-precondition", estado === "anulado"
                ? "Ese informe fue anulado mientras se emitía."
                : "Ese informe ya fue emitido.");
        }
        tx.update(ref, {
            status: "emitido",
            ...input.instantanea,
            issuedBy: input.actorUid,
            issuedAt: firestore_1.FieldValue.serverTimestamp(),
            documentId: input.documentId,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    });
}
/**
 * Deja constancia de que alguien aprobó el informe.
 *
 * **`RN-12`: esto es constancia, no firma electrónica certificada.** Guarda
 * quién, con qué cargo y cuándo; no promete validez jurídica de firma, y el PDF
 * lo dice con esas palabras.
 *
 * **El nombre y el cargo los pone el SERVIDOR, leídos de la membresía.** Si
 * vinieran en la petición, cualquiera firmaría como «Presidente del consejo»
 * mandando ese texto — y el bloque de firmas de un documento con sanción legal
 * detrás dejaría de significar nada.
 *
 * **Solo se firma lo `emitido` o lo `publicado`.** Un borrador no: sus cifras
 * todavía cambian, y una firma sobre cifras que cambian no dice nada. Un anulado
 * tampoco: ya no hay nada que aprobar.
 *
 * **Idempotente por uid**: firmar dos veces no añade dos filas ni mueve la fecha
 * de la primera.
 */
async function firmarInforme(input) {
    const firestore = db();
    const ref = firestore.collection("monthlyReports").doc(input.reportId);
    return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Ese informe no existe.");
        const informe = snap.data();
        if (informe.tenantId !== input.tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese informe no pertenece a este conjunto.");
        }
        if (informe.status !== "emitido" && informe.status !== "publicado") {
            throw new https_1.HttpsError("failed-precondition", informe.status === "borrador"
                ? "Un borrador no se firma: sus cifras todavía pueden cambiar. Emítelo primero."
                : "Ese informe está anulado y ya no se firma.");
        }
        const firmas = informe.signatures ?? [];
        if (firmas.some((f) => f.uid === input.actorUid)) {
            return { ok: true, yaFirmado: true };
        }
        tx.update(ref, {
            // `arrayUnion` no sirve: sus elementos llevan `signedAt`, y dos firmas de
            // la misma persona en instantes distintos serían objetos distintos, así
            // que no deduplicaría nada. La deduplicación por uid es la de arriba.
            signatures: [
                ...firmas,
                {
                    uid: input.actorUid,
                    name: input.actorName,
                    role: input.actorRole,
                    // Dentro de un array no se puede usar `serverTimestamp()` —Firestore
                    // lo rechaza—, así que la marca la pone el servidor con su propio
                    // reloj. Sigue sin ser falsificable desde el cliente, que es lo que
                    // importa.
                    signedAt: firestore_1.Timestamp.now(),
                },
            ],
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, yaFirmado: false };
    });
}
/**
 * Anula un informe emitido, **con motivo obligatorio** (`RN-06`, `CA16`).
 *
 * **No se borra, se marca** (`RN-14`, y la lección de «archivar no es esconder»).
 * Un informe emitido salió del sistema: lo vio el consejo, quizá lo vio la
 * comunidad. Borrar el registro dejaría al conjunto sin forma de saber que ese
 * papel existió y fue retirado — que es justo lo que un tercero preguntaría.
 *
 * **El motivo se exige en el SERVIDOR** y no solo en el formulario: `CA16` dice
 * exactamente eso, y un formulario es una sugerencia para quien llama por HTTP.
 */
async function anularInforme(input) {
    const motivo = (input.reason ?? "").trim();
    if (!motivo)
        throw new https_1.HttpsError("invalid-argument", "Anular un informe exige un motivo.");
    const firestore = db();
    const ref = firestore.collection("monthlyReports").doc(input.reportId);
    return firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "Ese informe no existe.");
        const informe = snap.data();
        if (informe.tenantId !== input.tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese informe no pertenece a este conjunto.");
        }
        if (informe.status === "anulado") {
            return { ok: true, yaAnulado: true };
        }
        // Un borrador no se anula: se regenera. Anularlo dejaría un estado terminal
        // sobre algo que nunca afirmó nada, y bloquearía el período entero — la
        // corrida del mes siguiente no puede escribir sobre un `anulado`.
        if (informe.status === "borrador") {
            throw new https_1.HttpsError("failed-precondition", "Un borrador no se anula: no ha afirmado nada todavía. Regenéralo o emítelo.");
        }
        tx.update(ref, {
            status: "anulado",
            voidReason: motivo,
            voidedBy: input.actorUid,
            voidedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { ok: true, yaAnulado: false };
    });
}
