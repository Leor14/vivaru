"use strict";
/**
 * El recibo que emite Vivaru al aplicar un pago.
 *
 * **Vivaru NO emite documentos fiscales** (decisión de David, 20 de agosto de
 * 2026): la factura la emite el cliente, en los tres países. Esto es un recibo
 * **interno** — prueba de que el conjunto registró un pago, no un comprobante
 * ante la autoridad tributaria.
 *
 * **Por qué vive aquí y no en `src/`.** Hasta el 20 de agosto lo construía el
 * navegador y lo escribía por su cuenta, DESPUÉS de que el servidor aplicara el
 * pago. Eso dejaba un hueco real: si la escritura fallaba, el pago quedaba
 * aplicado y sin recibo. Al meter la emisión dentro de la transacción del pago,
 * el constructor tiene que estar del lado del servidor — y `src/` no puede
 * importar de `functions/` sin romper el build de App Hosting (ver CLAUDE.md),
 * así que se mudó entero en vez de duplicarse.
 *
 * **Por qué ya no hay secuencial.** El número correlativo existía porque el
 * recibo era un documento fiscal y una serie fiscal no admite huecos. Al dejar
 * de serlo, el contador dejó de tener sentido — y estorbaba: `nextSequential`
 * era una transacción sobre un ÚNICO documento por conjunto, así que serializaba
 * todos sus pagos. Meterlo dentro de la transacción del pago habría empeorado la
 * contención justo en la escritura más importante del sistema. El identificador
 * ahora se deriva del id del propio recibo: único de nacimiento, sin contador y
 * sin coordinación.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.codigoDesdeId = codigoDesdeId;
exports.construirRecibo = construirRecibo;
/**
 * Código legible a partir del id del recibo.
 *
 * Se toman seis caracteres del id de Firestore y se pasan a mayúsculas, quitando
 * los que se confunden al leerlos en voz alta o al teclearlos desde un papel:
 * `O`/`0`, `I`/`1`/`L`. Si tras el filtro quedan menos de seis, se rellena con el
 * resto del id — un id de Firestore tiene veinte caracteres, así que no se agota.
 *
 * **No es una clave.** La clave sigue siendo el id del documento; esto es una
 * etiqueta para que una persona pueda nombrar su recibo. Dos etiquetas iguales en
 * el mismo conjunto serían improbables y, sobre todo, inofensivas.
 */
function codigoDesdeId(voucherId, prefijo = "REC") {
    const limpio = voucherId.toUpperCase().replace(/[OI0L1]/g, "");
    const base = (limpio + voucherId.toUpperCase().replace(/[^A-Z0-9]/g, "")).slice(0, 6);
    return `${prefijo}-${base.padEnd(6, "X")}`;
}
/**
 * Construye el recibo. Función pura: sin I/O, para poder probarla sin emulador.
 *
 * El país entra por el perfil fiscal del conjunto y hoy no cambia nada — los tres
 * comparten formato. Se conserva el parámetro porque **el formato del recibo sí
 * puede diferir por país** aunque ninguno lleve factura, y porque el día que
 * difiera el cambio queda aquí dentro en vez de repartirse por la tubería de
 * pagos.
 */
function construirRecibo(input) {
    return {
        type: "ingreso",
        code: codigoDesdeId(input.voucherId),
        issueDate: input.issueDate,
        amount: input.amount,
        concept: input.concept,
        payerName: input.payer?.name ?? null,
        payerTaxId: input.payer?.taxId ?? null,
        payerUnitId: input.payer?.unitId ?? null,
        payerUnitLabel: input.payer?.unitLabel ?? null,
        issuerTaxId: input.issuer?.taxId ?? null,
        issuerLegalName: input.issuer?.legalName ?? null,
        issuerAddress: input.issuer?.address ?? null,
        issuerCountry: input.issuer?.country ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        anulado: false,
    };
}
