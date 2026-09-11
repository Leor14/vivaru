import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { ordenarTraspasos } from "@/lib/finanzas/tesoreria";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { TreasuryTransfer } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 2a · leer, registrar y anular traspasos.
 *
 * El traspaso **no es un asiento** (`RN-01`): esta colección no la lee ningún
 * consumidor del libro. Lo vigila un guardián.
 */

const COLECCION = "treasuryTransfers";

/** Sin `orderBy`, a propósito: se ordena en memoria y no hace falta índice. */
export function watchTraspasos(
  tenantId: string,
  onData: (items: TreasuryTransfer[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<TreasuryTransfer>(
      COLECCION,
      tenantId,
      (items) => onData(ordenarTraspasos(items)),
      onError,
    ) ?? (() => {})
  );
}

export async function registrarTraspaso(
  tenantId: string,
  uid: string,
  input: { fromAccountId: string; toAccountId: string; amount: number; date: string; reference?: string; detail?: string },
) {
  const reference = input.reference?.trim();
  const detail = input.detail?.trim();
  // Un campo `undefined` hace que Firestore rechace el documento entero: solo se
  // manda lo que existe.
  return createTenantDocument(COLECCION, tenantId, uid, {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount,
    date: input.date,
    ...(reference ? { reference } : {}),
    ...(detail ? { detail } : {}),
    kind: "traspaso",
    status: "registrado",
  });
}

/** `RN-06`: no se borra. Anulado, deja de contar en los dos saldos. */
export async function anularTraspaso(id: string, uid: string) {
  if (!db) throw new Error("Firestore no está configurado en este entorno.");
  await updateDoc(doc(db, COLECCION, id), {
    status: "anulado",
    voidedAt: serverTimestamp(),
    voidedBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}
