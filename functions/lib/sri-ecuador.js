"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stubSriTransport = void 0;
exports.buildSriDocument = buildSriDocument;
exports.transmitVoucher = transmitVoucher;
const firestore_1 = require("firebase-admin/firestore");
/** Transporte simulado: marca la transmisión como exitosa con una referencia ficticia. */
exports.stubSriTransport = {
    async post(document) {
        return { ok: true, ref: `STUB-${document.secuencial}` };
    },
};
/** Arma el documento a transmitir; devuelve error si faltan los datos mandatorios. */
function buildSriDocument(voucher) {
    if (!voucher.issuerTaxId)
        return { error: "Falta el RUC del conjunto." };
    if (!voucher.payerTaxId)
        return { error: "Falta la cédula del condómino." };
    return {
        document: {
            ruc: voucher.issuerTaxId,
            cedula: voucher.payerTaxId,
            secuencial: voucher.sequentialNumber ?? "",
            fecha: voucher.issueDate ?? "",
            monto: voucher.amount ?? 0,
            concepto: voucher.concept ?? "",
        },
    };
}
/**
 * Transmite un comprobante al SRI y actualiza su estado fiscal.
 * Solo procesa comprobantes de emisor Ecuador. Idempotente para reintentos.
 */
async function transmitVoucher(db, voucherId, transport) {
    const ref = db.collection("paymentVouchers").doc(voucherId);
    const snap = await ref.get();
    if (!snap.exists)
        return;
    const voucher = snap.data();
    if (voucher.issuerCountry !== "EC")
        return;
    const { document, error } = buildSriDocument(voucher);
    if (error || !document) {
        await ref.update({
            fiscalStatus: "error",
            fiscalProviderRef: null,
            updatedAt: firestore_1.Timestamp.now(),
        });
        return;
    }
    const result = await transport.post(document);
    await ref.update({
        fiscalStatus: result.ok ? "transmitted" : "error",
        fiscalProviderRef: result.ref ?? null,
        updatedAt: firestore_1.Timestamp.now(),
    });
}
