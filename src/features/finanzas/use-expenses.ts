"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Expense } from "@/types/domain";

import {
  createExpenseLedgerEntry,
  deleteLedgerEntry,
  resolveExpenseLedgerAction,
  updateExpenseLedgerEntry,
} from "./use-ledger";
import type { ExpenseFormValues } from "./schemas";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Suscripción en tiempo real a los egresos del tenant. El orden se aplica del
 * lado del cliente para evitar exigir un índice compuesto en Firestore.
 */
export function watchExpenses(
  tenantId: string,
  onData: (items: Expense[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<Expense>(
      "expenses",
      tenantId,
      (items) =>
        onData([...items].sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""))),
      onError,
    ) ?? (() => {})
  );
}

/**
 * Hook de conveniencia: suscribe los egresos del tenant y los expone. Permite
 * que un tablero (Cuentas por pagar, Flujo de caja) traiga sus propios datos.
 */
export function useExpenses(tenantId?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const unsub = watchExpenses(
      tenantId,
      (data) => {
        setExpenses(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tenantId]);

  return { expenses, loading, error };
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
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const payload = normalizeExpensePayload(values);
  const paidAt = payload.status === "pagado" ? today() : null;

  const ref = await createTenantDocument("expenses", tenantId, userId, {
    ...payload,
    paidAt,
    supportFileUrl: null,
    supportFileName: null,
    supportStoragePath: null,
    ledgerEntryId: null,
  });

  if (payload.status === "pagado") {
    const ledgerId = await createExpenseLedgerEntry(tenantId, userId, {
      id: ref.id,
      description: payload.description,
      amount: payload.amount,
      category: payload.category,
      paidAt,
      issueDate: payload.issueDate,
      bankAccountId: payload.bankAccountId,
    });
    await updateDoc(doc(db, "expenses", ref.id), { ledgerEntryId: ledgerId });
  }
}

export async function updateExpense(prev: Expense, userId: string, values: ExpenseFormValues) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const payload = normalizeExpensePayload(values);
  const paidAt = payload.status === "pagado" ? today() : null;

  await updateDoc(doc(db, "expenses", prev.id), {
    ...payload,
    paidAt,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });

  const action = resolveExpenseLedgerAction({
    prevLedgerEntryId: prev.ledgerEntryId,
    nextStatus: payload.status,
  });
  const expenseForLedger = {
    id: prev.id,
    description: payload.description,
    amount: payload.amount,
    category: payload.category,
    paidAt,
    issueDate: payload.issueDate,
    bankAccountId: payload.bankAccountId,
  };

  if (action === "create") {
    const ledgerId = await createExpenseLedgerEntry(prev.tenantId, userId, expenseForLedger);
    await updateDoc(doc(db, "expenses", prev.id), { ledgerEntryId: ledgerId });
  } else if (action === "update" && prev.ledgerEntryId) {
    await updateExpenseLedgerEntry(prev.ledgerEntryId, userId, expenseForLedger);
  } else if (action === "delete" && prev.ledgerEntryId) {
    await deleteLedgerEntry(prev.ledgerEntryId);
    await updateDoc(doc(db, "expenses", prev.id), { ledgerEntryId: null });
  }
}

export async function deleteExpense(expense: Pick<Expense, "id" | "ledgerEntryId">) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (expense.ledgerEntryId) {
    await deleteLedgerEntry(expense.ledgerEntryId);
  }
  await deleteDoc(doc(db, "expenses", expense.id));
}
