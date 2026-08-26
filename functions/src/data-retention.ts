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

/**
 * Retención de la telemetría de IA: 12 meses (regla del Paso 0 del programa de
 * IA, ver docs/hoja-de-ruta-ia.md).
 *
 * `aiUsage` no guarda contenido del conjunto —solo metadatos y métricas—, así
 * que la purga no es por privacidad sino por higiene: una colección que crece
 * sin fin acaba costando más de lo que mide. Se borra, no se anonimiza: no hay
 * nada que preservar sin identificar.
 *
 * Escribir datos con una retención declarada y sin mecanismo que la cumpla es
 * la forma habitual de incumplirla.
 */
export const AI_USAGE_RETENTION_MONTHS = 12;

/** Corte por fecha para la telemetría. Devuelve la fecha límite como Date. */
export function aiUsageCutoff(now: Date = new Date(), months = AI_USAGE_RETENTION_MONTHS): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Borra por lotes lo vencido de una colección con `createdAt`. */
async function purgarPorFecha(db: Firestore, coleccion: string, cutoff: Timestamp): Promise<number> {
  let borradas = 0;

  // Por lotes: una colección de telemetría puede tener muchas filas y un
  // borrado de golpe no cabe en una sola operación.
  for (;;) {
    const vencidas = await db.collection(coleccion).where("createdAt", "<", cutoff).limit(400).get();

    if (vencidas.empty) break;

    const batch = db.batch();
    for (const doc of vencidas.docs) batch.delete(doc.ref);
    await batch.commit();
    borradas += vencidas.size;

    if (vencidas.size < 400) break;
  }

  return borradas;
}

/** Borra la telemetría de IA vencida. Devuelve cuántas filas se eliminaron. */
export async function purgeExpiredAiUsage(db: Firestore, now: Date = new Date()): Promise<number> {
  return purgarPorFecha(db, "aiUsage", Timestamp.fromDate(aiUsageCutoff(now)));
}

/**
 * Borra el feedback del borrador asistido vencido (Paso 2.5).
 *
 * **Misma retención que la telemetría, y por el mismo motivo:** tampoco guarda
 * contenido del conjunto —solo categorías y números—, así que se borra por
 * higiene y no por privacidad. Nace con purga el mismo día que nace la
 * colección, porque declarar una retención y no implementarla es la forma
 * habitual de incumplirla.
 */
export async function purgeExpiredAiFeedback(db: Firestore, now: Date = new Date()): Promise<number> {
  return purgarPorFecha(db, "aiFeedback", Timestamp.fromDate(aiUsageCutoff(now)));
}

/** Retención del rastro de entrega de correo (`PRD-V-FLOW-003` §7.4). */
export const EMAIL_DELIVERY_RETENTION_MONTHS = 12;

/**
 * Anonimiza el rastro de entrega vencido: doce meses.
 *
 * **ANONIMIZA, no borra, y la diferencia importa.** El dato personal de una fila de
 * `emailDeliveries` es la dirección del destinatario; el resto —cuándo salió, qué aviso era, si
 * llegó o rebotó— es la métrica que da sentido a la colección entera. Borrar la fila cumpliría la
 * retención destruyendo el indicador; vaciar la dirección la cumple y lo conserva. Es el mismo
 * tratamiento que `anonymizeExpiredVouchers`, y por el mismo motivo: ahí también sobrevive lo no
 * sensible.
 *
 * **Nace el mismo día que la colección**, siguiendo la regla que este módulo ya se dio en
 * `purgeExpiredAiFeedback`: declarar una retención y no implementarla es la forma habitual de
 * incumplirla.
 *
 * Pagina con cursor sobre `sentAt` en vez de repetir la misma consulta. Filtrar por «todavía
 * tiene PII» dentro de la consulta exigiría un índice más, y sin cursor el bucle no terminaría el
 * día que las primeras 400 ya estén anonimizadas: seguiría devolviéndolas para siempre.
 */
export async function anonymizeExpiredEmailDeliveries(
  db: Firestore,
  now: Date = new Date(),
  months = EMAIL_DELIVERY_RETENTION_MONTHS,
  /** Solo para poder probar la paginación: sembrar 400 filas por prueba no es razonable. */
  tamanoLote = 400,
): Promise<number> {
  const corte = new Date(now);
  corte.setMonth(corte.getMonth() - months);
  const cutoff = Timestamp.fromDate(corte);

  let anonimizadas = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let q = db
      .collection("emailDeliveries")
      .where("sentAt", "<", cutoff)
      .orderBy("sentAt")
      .limit(tamanoLote);
    if (cursor) q = q.startAfter(cursor);

    const vencidas = await q.get();
    if (vencidas.empty) break;

    const batch = db.batch();
    let ops = 0;
    for (const doc of vencidas.docs) {
      const d = doc.data();
      const tienePII = Boolean(d.recipientEmail || d.recipientUserId);
      if (!d.anonymizedAt && tienePII) {
        batch.update(doc.ref, {
          recipientEmail: null,
          recipientUserId: null,
          anonymizedAt: Timestamp.now(),
        });
        ops += 1;
      }
    }
    if (ops > 0) {
      await batch.commit();
      anonimizadas += ops;
    }

    cursor = vencidas.docs[vencidas.docs.length - 1];
    if (vencidas.size < tamanoLote) break;
  }

  return anonimizadas;
}
