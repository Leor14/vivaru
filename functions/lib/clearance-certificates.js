"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitirPazYSalvo = emitirPazYSalvo;
exports.anularPazYSalvo = anularPazYSalvo;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const clave_de_unidad_1 = require("./clave-de-unidad");
const vocabulario_pais_1 = require("./vocabulario-pais");
const comprobante_1 = require("./comprobante");
/**
 * `PRD-V-FEAT-004` — el certificado de paz y salvo.
 *
 * **Por qué es callable y el estado de cuenta no** (§11.1): la única condición
 * de este documento es «saldo cero», y **esa no la puede evaluar el cliente**.
 * Un navegador manipulado emitiría un paz y salvo falso — y este papel se enseña
 * en una notaría, no en la aplicación. El servidor lee, comprueba y emite.
 *
 * ---
 *
 * **R6 NO SE IMPLEMENTA, Y HAY QUE DECIR POR QUÉ.** La ficha permite que el
 * certificado acredite una fecha **anterior** a hoy. Eso exige saber qué debía la
 * unidad ese día, y **no se puede saber**: los cargos sí tienen fecha —`period`,
 * a veces `dueDate`— pero **los pagos no**. De 90 cargos con pago en producción
 * solo 50 traen `lastPaymentAt`; `paymentOperations` son 5 porque nacieron con
 * `FIN-001` el 20 de agosto de 2026; y `ledgerEntries` no tiene `unitId`.
 *
 * Con los cargos fechados y los pagos no, un certificado retroactivo **contaría
 * como cobrados pagos que llegaron después de la fecha** y certificaría que
 * alguien estaba al día cuando no lo estaba. En un documento que se entrega a un
 * tercero eso no es una imprecisión: es una afirmación falsa firmada por el
 * conjunto.
 *
 * Por eso `asOfDate` **es siempre el día de la emisión** en el MVP, y la fecha
 * viaja igualmente en el documento (que es la otra mitad de R6: declarar a qué
 * fecha aplica). Retroactivo entra cuando los pagos tengan fecha, no antes.
 */
const db = () => (0, firestore_1.getFirestore)();
/**
 * Emite el certificado si —y solo si— la unidad no debe nada.
 *
 * **El saldo se lee de `balance`, no de «cargado − pagado».** Es la misma cifra
 * que enseñan la cartera y el estado de cuenta; calcularla de otra forma dejaría
 * al certificado contradiciendo a las dos pantallas desde las que se pide.
 */
async function emitirPazYSalvo(input, uid) {
    const firestore = db();
    // Idempotencia por clave, mismo patrón que el reparto y el pago: el id ES la
    // clave normalizada. Y se resuelve ANTES de nada, porque un reintento de la
    // misma emisión no es una emisión nueva — la lección de `FLOW-001`.
    const certificateId = `pys_${input.operationKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
    const ref = firestore.collection("clearanceCertificates").doc(certificateId);
    const existente = await ref.get();
    if (existente.exists) {
        const d = existente.data();
        return {
            ok: true,
            certificateId,
            code: d.code ?? (0, comprobante_1.codigoDesdeId)(certificateId, "PYS"),
            created: false,
            balanceAtIssue: d.balanceAtIssue ?? 0,
            creditBalance: d.creditBalance ?? 0,
        };
    }
    /**
     * **La unidad se resuelve UNA vez, por el resolvedor único** (`PRD-V-FIX-002`, R6).
     *
     * Aquí vivía un parche de tres vías —el id, el campo `unitId` y la etiqueta—
     * y era lo correcto mientras el dato estaba partido: en producción convivían
     * 197 cargos por id y 19 por campo, y `tenant-santa-maria` tenía la unidad
     * `u-t1-101` con la cartera repartida entre `u-t1-101` (3.360.000) y
     * `unit-t1-101` (**3.580.000**), que no existía como unidad. Consultar una
     * sola clave habría certificado al día a quien debía la mitad.
     *
     * **`FIX-002` migró el dato el 26 de agosto de 2026 y el parche pasó de
     * necesario a peligroso.** La vía de la etiqueta consulta
     * `where("unitLabel", "==", …)` **sin restringir a la unidad**, y nada impide
     * que dos unidades del mismo conjunto se llamen igual —`updateUnit` no lo
     * comprueba—. El día que pase, esto se negaría a certificar a quien está al
     * día porque su homónima debe. Y con una unidad borrada, sus cargos huérfanos
     * bloquearían a la unidad NUEVA que reutilizara la etiqueta, que es otra
     * unidad y no hereda deudas.
     *
     * Se resuelve **sin pasar la etiqueta**, y es deliberado: `unitLabel` viaja en
     * la petición y un administrador puede mandar lo que quiera. Que un texto del
     * cliente pueda elegir de qué unidad se certifica sería darle a la petición
     * una autoridad que solo tiene la membresía.
     *
     * **Lo que SÍ se conserva es el slug propio de la unidad**, y la diferencia con
     * la etiqueta es toda: el slug pertenece a ESTA unidad y a ninguna otra, así que
     * mirarlo no puede traer deuda ajena. Solo se consulta si además **no es el id
     * de documento de otra unidad** —esa comprobación es la que impide el único
     * cruce posible—. Cuesta una consulta y mantiene imposible el fallo que
     * importa: certificar al día a quien debe. El otro sentido —negarse a
     * certificar a quien está al día— se arregla mirando; este no.
     *
     * Y si no resuelve, **no se emite**. Un papel que afirma que una unidad no
     * debe nada no se puede firmar sobre una unidad que no se sabe cuál es.
     */
    // El «no» de esta función lo lee una persona, y el documento se llama
    // distinto en cada país (30 ago 2026): el término sale del país del conjunto.
    const tenantSnap = await firestore.collection("tenants").doc(input.tenantId).get();
    const pys = (0, vocabulario_pais_1.terminoPazYSalvo)(tenantSnap.data()?.country);
    const unidadesSnap = await firestore
        .collection("units")
        .where("tenantId", "==", input.tenantId)
        .get();
    const catalogo = (0, clave_de_unidad_1.construirCatalogo)(unidadesSnap.docs.map((d) => {
        const u = d.data();
        return { id: d.id, slug: u.unitId, displayName: u.displayName };
    }));
    const resolucion = (0, clave_de_unidad_1.resolverClaveDeUnidad)(input.unitId, catalogo);
    if (resolucion.estado !== "canonica" && resolucion.estado !== "migrable") {
        throw new https_1.HttpsError("failed-precondition", `No se puede emitir ${pys.articulo} ${pys.nombre}: la unidad no existe en este conjunto.`);
    }
    const clave = resolucion.clave;
    const slugPropio = unidadesSnap.docs.find((d) => d.id === clave)?.data()?.unitId;
    const claves = (0, clave_de_unidad_1.clavesDeConsulta)(clave, catalogo, slugPropio);
    const porClave = await Promise.all(claves.map((c) => firestore
        .collection("billingStatements")
        .where("tenantId", "==", input.tenantId)
        .where("unitId", "==", c)
        .get()));
    // Sin deduplicar: las dos claves son distintas por construcción, así que un
    // cargo no puede salir por las dos.
    const cargosSnap = { docs: porClave.flatMap((snap) => snap.docs) };
    // R5 · un cargo anulado no cuenta. Y su `balance` ya es cero, así que esto es
    // el segundo de los dos caminos que lo dejan fuera: el estado y el saldo.
    const vigentes = cargosSnap.docs
        .map((d) => d.data())
        .filter((c) => c.status !== "cancelled");
    const saldo = vigentes.reduce((a, c) => a + (c.balance ?? 0), 0);
    // R3 · la condición del documento. Se nombra QUÉ debe y desde cuándo: «no se
    // puede emitir» sin decir por qué manda a la persona a preguntar.
    if (saldo > 0) {
        const conDeuda = vigentes.filter((c) => (c.balance ?? 0) > 0);
        const periodos = [...new Set(conDeuda.map((c) => c.period).filter(Boolean))].sort();
        throw new https_1.HttpsError("failed-precondition", 
        // El importe va con separadores de miles: este texto lo lee una persona en
        // pantalla, y «1700000» se cuenta con el dedo. Se formatea aquí y no en el
        // cliente porque el mensaje del servidor se enseña tal cual — que es
        // justo lo que lo hace útil.
        `No se puede emitir ${pys.articulo} ${pys.nombre}: la unidad tiene un saldo pendiente de ${saldo.toLocaleString("es-CO")}` +
            (periodos.length > 0 ? `, desde ${periodos[0]}${periodos.length > 1 ? ` (${periodos.length} períodos)` : ""}.` : "."));
    }
    // R4 · un saldo A FAVOR no impide emitirlo, y el documento lo nombra. Se lee
    // aquí porque no vive en los cargos: son documentos de `advances`.
    //
    // **Por las MISMAS claves que la deuda**, que es lo que hace que las dos cifras
    // del papel hablen de la misma unidad. `aplicarPago` crea el anticipo con la
    // convención que traía el cargo sobrepagado (`payments.ts`), así que `advances`
    // estaba mezclada exactamente igual que `billingStatements` — y se migró en la
    // misma pasada, porque `FIX-002` recorre las dieciocho colecciones. Aquí el
    // error va en la dirección CONTRARIA a la de la deuda —callar dinero a favor en
    // vez de callar deuda— y por eso no bloquea; pero R4 dice que se NOMBRA.
    const anticiposPorClave = await Promise.all(claves.map((c) => firestore
        .collection("advances")
        .where("tenantId", "==", input.tenantId)
        .where("unitId", "==", c)
        .get()));
    const creditBalance = anticiposPorClave
        .flatMap((snap) => snap.docs)
        .map((d) => d.data())
        .filter((a) => a.status === "open")
        .reduce((a, x) => a + (x.remaining ?? 0), 0);
    // **El código NO se deriva del id del documento**, y esto costó una prueba en
    // rojo. El id es determinista a propósito —lleva dentro la `operationKey`,
    // que es lo que hace idempotente la emisión—, así que derivar de él daba
    // `PYS-PYS_PY`: repetía el prefijo, colaba un `_` y, lo que importa,
    // **dejaba el código elegible por el cliente**, que es quien manda la clave.
    //
    // La semilla es un id de Firestore recién generado: aleatorio, de veinte
    // caracteres —que es para lo que `codigoDesdeId` está escrita— y estable,
    // porque se guarda en el documento y el reintento idempotente devuelve el
    // guardado, no uno nuevo.
    const code = (0, comprobante_1.codigoDesdeId)(firestore.collection("clearanceCertificates").doc().id, "PYS");
    await ref.set({
        tenantId: input.tenantId,
        unitId: input.unitId,
        unitLabel: input.unitLabel ?? vigentes[0]?.unitLabel ?? input.unitId,
        issuedAt: input.issueDate,
        // Ver la cabecera: en el MVP acredita el día en que se emite, nunca antes.
        asOfDate: input.issueDate,
        code,
        requestedBy: uid,
        // Cero por definición —si no, no se habría llegado aquí— y se guarda igual,
        // porque un documento que afirma algo tiene que conservar lo que midió.
        balanceAtIssue: saldo,
        ...(creditBalance > 0 ? { creditBalance } : {}),
        status: "emitido",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, certificateId, code, created: true, balanceAtIssue: saldo, creditBalance };
}
/**
 * Anula un certificado emitido con datos incorrectos (§6).
 *
 * **No se borra, se marca.** Un paz y salvo que alguien descargó ya salió del
 * sistema: borrar el registro dejaría al conjunto sin forma de saber que ese
 * papel existió y fue retirado. Es la misma decisión que el recibo anulado.
 */
async function anularPazYSalvo(input, uid) {
    const motivo = (input.reason ?? "").trim();
    if (!motivo)
        throw new https_1.HttpsError("invalid-argument", "Anular exige un motivo.");
    const ref = db().collection("clearanceCertificates").doc(input.certificateId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Ese certificado no existe.");
    const cert = snap.data();
    if (cert.tenantId !== input.tenantId) {
        throw new https_1.HttpsError("permission-denied", "Ese certificado no pertenece a este conjunto.");
    }
    if (cert.status === "anulado") {
        return { ok: true, certificateId: input.certificateId, alreadyCancelled: true };
    }
    await ref.update({
        status: "anulado",
        anuladoEn: firestore_1.FieldValue.serverTimestamp(),
        anuladoPor: uid,
        anuladoMotivo: motivo,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, certificateId: input.certificateId, alreadyCancelled: false };
}
