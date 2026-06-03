import { type Firestore, Timestamp } from "firebase-admin/firestore";

/**
 * Retención / anonimización de datos sensibles de comprobantes (F2/G4).
 *
 * Pasado el período de retención configurado por conjunto
 * (`tenantSettings.fiscalProfile.dataRetentionMonths`, default 12), se borran la
 * cédula y el nombre del condómino de los comprobantes ya emitidos, conservando
 * lo no sensible (secuencial, monto, fecha, referencia fiscal). La conservación
 * legal del documento recae en el contribuyente y en el ente fiscal, no en la
 * plataforma, por eso Vivaru puede purgar la PII que almacena.
 */

const DEFAULT_RETENTION_MONTHS = 12;

/** Fecha de corte (YYYY-MM-DD): comprobantes anteriores se anonimizan. */
export function cutoffDateISO(retentionMonths: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() - retentionMonths);
  return d.toISOString().slice(0, 10);
}

/**
 * Recorre los conjuntos, aplica el período de retención de cada uno y anonimiza
 * los comprobantes vencidos. Devuelve cuántos se anonimizaron.
 */
export async function anonymizeExpiredVouchers(db: Firestore, now: Date = new Date()): Promise<number> {
  const settingsSnap = await db.collection("tenantSettings").get();
  let anonymizedTotal = 0;

  for (const settingsDoc of settingsSnap.docs) {
    const fiscalProfile = (settingsDoc.data().fiscalProfile ?? {}) as { dataRetentionMonths?: number };
    const months =
      typeof fiscalProfile.dataRetentionMonths === "number" && fiscalProfile.dataRetentionMonths > 0
        ? fiscalProfile.dataRetentionMonths
        : DEFAULT_RETENTION_MONTHS;
    const cutoff = cutoffDateISO(months, now);
    const tenantId = settingsDoc.id;

    // Consulta por igualdad de tenantId (sin índice compuesto); se filtra en código.
    const vouchersSnap = await db.collection("paymentVouchers").where("tenantId", "==", tenantId).get();

    let batch = db.batch();
    let ops = 0;
    for (const voucherDoc of vouchersSnap.docs) {
      const v = voucherDoc.data();
      const expired = (v.issueDate ?? "") < cutoff;
      const hasPII = Boolean(v.payerTaxId || v.payerName);
      const notDone = !v.anonymizedAt;
      if (expired && hasPII && notDone) {
        batch.update(voucherDoc.ref, {
          payerTaxId: null,
          payerName: null,
          anonymizedAt: Timestamp.now(),
        });
        ops += 1;
        anonymizedTotal += 1;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) await batch.commit();
  }

  return anonymizedTotal;
}
