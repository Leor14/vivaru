"use client";

import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BankAccount } from "@/types/domain";

import type { BankAccountFormValues } from "./schemas";

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

function normalizeBankAccount(values: BankAccountFormValues) {
  return {
    label: values.label.trim(),
    bankName: values.bankName.trim(),
    accountNumber: values.accountNumber?.trim() || null,
    accountType: values.accountType ?? null,
    currency: values.currency ?? null,
    openingBalance: typeof values.openingBalance === "number" ? values.openingBalance : 0,
    active: values.active,
  };
}

export async function createBankAccount(tenantId: string, userId: string, values: BankAccountFormValues) {
  await createTenantDocument("bankAccounts", tenantId, userId, normalizeBankAccount(values));
}

export async function updateBankAccount(id: string, userId: string, values: BankAccountFormValues) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await updateDoc(doc(db, "bankAccounts", id), {
    ...normalizeBankAccount(values),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteBankAccount(id: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await deleteDoc(doc(db, "bankAccounts", id));
}
