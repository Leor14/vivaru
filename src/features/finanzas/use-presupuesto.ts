import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { LineaDelPresupuesto } from "@/lib/finanzas/presupuesto";
import type { Budget } from "@/types/domain";

/**
 * `PRD-V-FEAT-009` · leer y escribir el presupuesto del año.
 *
 * **Siempre `setDoc` del documento entero, nunca `updateDoc`.** Los códigos de
 * cuenta llevan punto, y en `updateDoc` un punto es una ruta de campo. Por la
 * misma razón las líneas van en array (ver `Budget`).
 */

function assertDb() {
  if (!db) throw new Error("Firestore no está configurado en este entorno.");
  return db;
}

/** `RN-10`: el id lo comprueban también las reglas. */
export function idDelPresupuesto(tenantId: string, year: number): string {
  return `${tenantId}_${year}`;
}

export function watchPresupuesto(
  tenantId: string,
  year: number,
  onData: (presupuesto: Budget | null) => void,
  onError: (message: string) => void,
) {
  if (!db) {
    onError("Firestore no está configurado en este entorno.");
    return () => {};
  }
  return onSnapshot(
    doc(db, "budgets", idDelPresupuesto(tenantId, year)),
    (snap) => onData(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Budget, "id">) }) : null),
    (error) => onError(error.message),
  );
}

export async function guardarBorrador(input: {
  tenantId: string;
  year: number;
  lines: LineaDelPresupuesto[];
  uid: string;
  previo: Budget | null;
}) {
  const ahora = serverTimestamp();
  await setDoc(doc(assertDb(), "budgets", idDelPresupuesto(input.tenantId, input.year)), {
    tenantId: input.tenantId,
    year: input.year,
    lines: input.lines,
    status: "borrador",
    createdAt: input.previo?.createdAt ?? ahora,
    createdBy: input.previo?.createdBy ?? input.uid,
    updatedAt: ahora,
    updatedBy: input.uid,
  });
}
