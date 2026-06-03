import { type Firestore, Timestamp } from "firebase-admin/firestore";

/**
 * Capa de transmisión del comprobante de alícuota al SRI (Ecuador).
 *
 * F2/G1: el transporte real aún no está definido (pendiente del spike técnico
 * con el experto SAP↔SRI). Por eso la transmisión vive detrás de la interfaz
 * `SriTransport` con una implementación `stubSriTransport` que simula el POST,
 * permitiendo construir y probar todo el flujo end-to-end. En G3 se reemplaza
 * por `realSriTransport` (firma electrónica + endpoint del SRI) sin tocar el
 * resto del flujo.
 *
 * Recordatorio del discovery: la integración es SOLO de salida (un POST); no se
 * lee nada del SRI, no requiere autorización, y usa secuencial propio.
 */

export interface SriDocument {
  ruc: string; // RUC del conjunto (obligatorio)
  cedula: string; // cédula del condómino (obligatorio)
  secuencial: string;
  fecha: string;
  monto: number;
  concepto: string;
}

export interface SriTransportResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

export interface SriTransport {
  post(document: SriDocument): Promise<SriTransportResult>;
}

/** Transporte simulado: marca la transmisión como exitosa con una referencia ficticia. */
export const stubSriTransport: SriTransport = {
  async post(document) {
    return { ok: true, ref: `STUB-${document.secuencial}` };
  },
};

interface VoucherData {
  issuerCountry?: string;
  issuerTaxId?: string | null;
  payerTaxId?: string | null;
  sequentialNumber?: string;
  issueDate?: string;
  amount?: number;
  concept?: string;
}

/** Arma el documento a transmitir; devuelve error si faltan los datos mandatorios. */
export function buildSriDocument(voucher: VoucherData): { document?: SriDocument; error?: string } {
  if (!voucher.issuerTaxId) return { error: "Falta el RUC del conjunto." };
  if (!voucher.payerTaxId) return { error: "Falta la cédula del condómino." };
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
export async function transmitVoucher(
  db: Firestore,
  voucherId: string,
  transport: SriTransport,
): Promise<void> {
  const ref = db.collection("paymentVouchers").doc(voucherId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const voucher = snap.data() as VoucherData;
  if (voucher.issuerCountry !== "EC") return;

  const { document, error } = buildSriDocument(voucher);
  if (error || !document) {
    await ref.update({
      fiscalStatus: "error",
      fiscalProviderRef: null,
      updatedAt: Timestamp.now(),
    });
    return;
  }

  const result = await transport.post(document);
  await ref.update({
    fiscalStatus: result.ok ? "transmitted" : "error",
    fiscalProviderRef: result.ref ?? null,
    updatedAt: Timestamp.now(),
  });
}
