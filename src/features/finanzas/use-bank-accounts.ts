"use client";

import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BankAccount } from "@/types/domain";

import type { BankAccountFormValues } from "./schemas";

/** Colección donde vive el saldo inicial, fuera del documento de la cuenta. */
const SALDOS = "bankAccountBalances";

/** Suscripción a las cuentas bancarias del conjunto (orden client-side por nombre). */
export function watchBankAccounts(
  tenantId: string,
  onData: (items: BankAccount[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<BankAccount>(
      "bankAccounts",
      tenantId,
      (items) => onData([...items].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))),
      onError,
    ) ?? (() => {})
  );
}

/**
 * Las cuentas que puede ver **cualquier miembro** del conjunto, no solo la
 * administración: es lo que necesita el residente para decir a qué cuenta pagó
 * (`FLOW-002` CA11).
 *
 * **El filtro `active` no es cosmético, es lo que hace pasar la regla.** Las
 * reglas conceden la lectura a un no-administrador solo si el documento está
 * activo, y Firestore evalúa una consulta contra la regla **sin ejecutarla**:
 * una consulta sin este `where` sería rechazada entera aunque todas las cuentas
 * estuvieran activas. Ver el bloque `bankAccounts` de `firestore.rules`.
 *
 * No pide índice: es igualdad sobre dos campos y el orden se hace en memoria.
 */
export function watchActiveBankAccounts(
  tenantId: string,
  onData: (items: BankAccount[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<BankAccount>(
      "bankAccounts",
      tenantId,
      (items) => onData([...items].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""))),
      onError,
      { equalsBoolean: [{ field: "active", value: true }] },
    ) ?? (() => {})
  );
}

function normalizeBankAccount(values: BankAccountFormValues) {
  return {
    label: values.label.trim(),
    bankName: values.bankName.trim(),
    accountNumber: values.accountNumber?.trim() || null,
    accountType: values.accountType ?? null,
    currency: values.currency ?? null,
    active: values.active,
  };
}

/**
 * Escribe el saldo inicial en su propio documento, con el id de la cuenta.
 *
 * Se escribe **siempre**, también cuando vale cero: un documento ausente y un
 * saldo de cero se leen igual desde el producto, pero el ausente obliga a
 * adivinar si nadie lo puso o si de verdad era cero.
 */
async function guardarSaldoInicial(bankAccountId: string, tenantId: string, userId: string, openingBalance: number) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await setDoc(
    doc(db, SALDOS, bankAccountId),
    { tenantId, openingBalance, updatedBy: userId, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Lee el saldo inicial de una cuenta. Devuelve 0 si no tiene documento. */
export async function fetchOpeningBalance(bankAccountId: string): Promise<number> {
  if (!db) return 0;
  const snap = await getDoc(doc(db, SALDOS, bankAccountId));
  const valor = (snap.data() as { openingBalance?: number } | undefined)?.openingBalance;
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

export async function createBankAccount(tenantId: string, userId: string, values: BankAccountFormValues) {
  const ref = await createTenantDocument("bankAccounts", tenantId, userId, normalizeBankAccount(values));
  // El saldo va DESPUÉS y en su propio documento. Si esta segunda escritura
  // falla, la cuenta existe con saldo inicial cero, que es recuperable
  // editándola; el orden inverso dejaría un saldo huérfano sin cuenta.
  await guardarSaldoInicial(ref.id, tenantId, userId, typeof values.openingBalance === "number" ? values.openingBalance : 0);
  return ref.id;
}

export async function updateBankAccount(id: string, userId: string, values: BankAccountFormValues, tenantId: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await updateDoc(doc(db, "bankAccounts", id), {
    ...normalizeBankAccount(values),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
  await guardarSaldoInicial(id, tenantId, userId, typeof values.openingBalance === "number" ? values.openingBalance : 0);
}

export async function deleteBankAccount(id: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await deleteDoc(doc(db, "bankAccounts", id));
  // El saldo se va con la cuenta. Un documento de saldo sin cuenta no lo lee
  // nadie y reaparecería si alguien reutilizara el id.
  await deleteDoc(doc(db, SALDOS, id));
}

/**
 * El saldo inicial del CONJUNTO: la suma de lo registrado en sus cuentas.
 *
 * **`undefined` cuando ninguna cuenta tiene documento de saldo**, y esa
 * distinción es el punto entero (`PRD-V-FLOW-007` `CA4`). Medido en producción
 * el 3 de septiembre de 2026: cuatro conjuntos tienen documento —dos de ellos
 * con el valor **cero**, escrito a propósito— y cinco no tienen ninguno.
 * Devolver `0` en los dos casos afirma que el conjunto abrió sin un peso, que
 * es una afirmación que nadie hizo, y es lo que hacía que `/admin/finanzas`
 * avisara «Fondo insuficiente» a un conjunto con dinero en el banco.
 *
 * **Se suman TODAS las cuentas, activas o no.** Una cuenta desactivada sigue
 * teniendo el dinero con el que abrió el período mientras no se cierre; filtrar
 * por `active` haría desaparecer del fondo un saldo que está en el banco.
 */
export function sumarSaldoInicial(
  saldos: ReadonlyArray<{ openingBalance?: number }>,
): number | undefined {
  let total = 0;
  let alguno = false;
  for (const saldo of saldos) {
    const valor = saldo.openingBalance;
    if (typeof valor !== "number" || !Number.isFinite(valor)) continue;
    total += valor;
    alguno = true;
  }
  return alguno ? total : undefined;
}

/**
 * Suscripción a los saldos iniciales del conjunto.
 *
 * La colección es **solo-administración** por regla, así que esto no se puede
 * colgar de ninguna pantalla del residente ni de la portería: la consulta se
 * rechazaría entera y la pantalla diría «sin datos» en vez de «sin permiso».
 */
export function watchBankAccountBalances(
  tenantId: string,
  onData: (items: Array<{ id: string; openingBalance?: number }>) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<{ id: string; openingBalance?: number }>(
      SALDOS,
      tenantId,
      onData,
      onError,
    ) ?? (() => {})
  );
}
