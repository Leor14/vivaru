import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * Reserva atómicamente el siguiente número de secuencial para una serie de
 * comprobantes dentro de un tenant. Crea el contador si no existe.
 *
 * Usa una transacción de Firestore para evitar condiciones de carrera cuando
 * dos comprobantes se emiten simultáneamente. Devuelve el entero reservado
 * (1-based).
 *
 * @param tenantId  Tenant propietario del contador.
 * @param series    Serie lógica, ej. "ingreso" | "egreso".
 */
export async function nextSequential(tenantId: string, series: string): Promise<number> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (!tenantId) {
    throw new Error("tenantId es obligatorio para reservar un secuencial.");
  }

  const counterId = `${tenantId}_${series}`;
  const ref = doc(db, "financialCounters", counterId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? ((snap.data().value as number | undefined) ?? 0) : 0;
    const next = current + 1;
    tx.set(
      ref,
      { tenantId, series, value: next, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return next;
  });
}

/**
 * Formatea un secuencial con prefijo de serie opcional.
 * Ej: (123, "001-001") → "001-001-000000123"; (123) → "000000123".
 */
export function formatSequential(value: number, prefix?: string): string {
  const padded = String(Math.max(0, Math.trunc(value))).padStart(9, "0");
  return prefix && prefix.trim() ? `${prefix.trim()}-${padded}` : padded;
}
