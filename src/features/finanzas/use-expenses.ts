"use client";

import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Expense } from "@/types/domain";

import type { ExpenseFormValues } from "./schemas";

const today = () => new Date().toISOString().slice(0, 10);

/** Suscripción en tiempo real a los egresos del tenant, ordenados por fecha de emisión. */
export function watchExpenses(
  tenantId: string,
  onData: (items: Expense[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<Expense>("expenses", tenantId, onData, onError, {
      orderByField: "issueDate",
      orderDirection: "desc",
    }) ?? (() => {})
  );
}

function normalizeExpensePayload(values: ExpenseFormValues) {
  return {
    category: values.category,
    description: values.description.trim(),
    vendorName: values.vendorName?.trim() || null,
    vendorTaxId: values.vendorTaxId?.trim() || null,
    amount: values.amount,
    issueDate: values.issueDate,
    dueDate: values.dueDate || null,
    status: values.status,
    paymentMethod: values.paymentMethod ? values.paymentMethod : null,
    checkNumber: values.paymentMethod === "cheque" ? values.checkNumber?.trim() || null : null,
    bankAccountId: values.bankAccountId?.trim() || null,
  };
}

export async function createExpense(tenantId: string, userId: string, values: ExpenseFormValues) {
  const payload = normalizeExpensePayload(values);
  await createTenantDocument("expenses", tenantId, userId, {
    ...payload,
    paidAt: payload.status === "pagado" ? today() : null,
    supportFileUrl: null,
    supportFileName: null,
    supportStoragePath: null,
    ledgerEntryId: null,
  });
}

export async function updateExpense(id: string, userId: string, values: ExpenseFormValues) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const payload = normalizeExpensePayload(values);
  await updateDoc(doc(db, "expenses", id), {
    ...payload,
    paidAt: payload.status === "pagado" ? today() : null,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteExpense(id: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await deleteDoc(doc(db, "expenses", id));
}
