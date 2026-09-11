import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { PettyCashFund } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 3 · la caja chica.
 *
 * Abrir, reponer y cerrar **son traspasos con nombre** (`treasuryTransfers`,
 * `kind` apertura / reposicion / cierre): mueven dinero entre el banco y la
 * caja, y el saldo de fondos no se entera. Los gastos de la caja son egresos
 * normales que la llevan en `bankAccountId`.
 *
 * Apertura y cierre van en **un lote**: la caja y su traspaso nacen —o se
 * cierran— juntos, o no pasa nada. Las reglas lo saben (`getAfter`).
 */

const CAJAS = "pettyCashFunds";
const TRASPASOS = "treasuryTransfers";

/** Sin `orderBy`, como los traspasos: se ordena en memoria y no hace falta índice. */
export function watchCajas(
  tenantId: string,
  onData: (items: PettyCashFund[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<PettyCashFund>(
      CAJAS,
      tenantId,
      (items) => onData([...items].sort((a, b) => a.name.localeCompare(b.name))),
      onError,
    ) ?? (() => {})
  );
}

function firmas(uid: string) {
  return { createdBy: uid, updatedBy: uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}

/** `CA8`: la caja nace con su límite, que sale de la cuenta elegida. */
export async function abrirCaja(
  tenantId: string,
  uid: string,
  input: { name: string; limit: number; sourceAccountId: string; date: string },
) {
  if (!db) throw new Error("Firestore no está configurado en este entorno.");
  const lote = writeBatch(db);
  const caja = doc(collection(db, CAJAS));
  lote.set(caja, {
    tenantId,
    name: input.name.trim(),
    limit: input.limit,
    sourceAccountId: input.sourceAccountId,
    status: "abierta",
    ...firmas(uid),
  });
  lote.set(doc(collection(db, TRASPASOS)), {
    tenantId,
    fromAccountId: input.sourceAccountId,
    toAccountId: caja.id,
    amount: input.limit,
    date: input.date,
    kind: "apertura",
    status: "registrado",
    ...firmas(uid),
  });
  await lote.commit();
  return caja.id;
}

/** `RN-11`: el importe lo propone la pantalla y se puede ajustar. */
export async function reponerCaja(
  tenantId: string,
  uid: string,
  input: { cajaId: string; fromAccountId: string; amount: number; date: string },
) {
  return createTenantDocument(TRASPASOS, tenantId, uid, {
    fromAccountId: input.fromAccountId,
    toAccountId: input.cajaId,
    amount: input.amount,
    date: input.date,
    kind: "reposicion",
    status: "registrado",
  });
}

/**
 * §6 · cerrar exige saldo cero. Con dinero dentro, el cierre lo devuelve a la
 * cuenta en el mismo lote; en cero, solo se cierra. **La regla no puede sumar
 * el saldo**: lo que sostiene el cero es que la pantalla mande `devolver`.
 */
export async function cerrarCaja(
  tenantId: string,
  uid: string,
  input: { cajaId: string; toAccountId: string; devolver: number; date: string },
) {
  if (!db) throw new Error("Firestore no está configurado en este entorno.");
  const lote = writeBatch(db);
  if (input.devolver > 0) {
    lote.set(doc(collection(db, TRASPASOS)), {
      tenantId,
      fromAccountId: input.cajaId,
      toAccountId: input.toAccountId,
      amount: input.devolver,
      date: input.date,
      kind: "cierre",
      status: "registrado",
      ...firmas(uid),
    });
  }
  lote.update(doc(db, CAJAS, input.cajaId), {
    status: "cerrada",
    closedAt: serverTimestamp(),
    closedBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await lote.commit();
}
