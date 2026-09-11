"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { codigoDeCategoriaDeEgreso } from "@/lib/finanzas/conceptos-de-cargo";

import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Expense } from "@/types/domain";
import { toDateInputValue } from "@/utils/datetimeValidation";

import {
  createExpenseLedgerEntry,
  deleteLedgerEntry,
  resolveExpenseLedgerAction,
  updateExpenseLedgerEntry,
} from "./use-ledger";
import type { ExpenseFormValues } from "./schemas";

// «Hoy» en el calendario de quien registra, no en UTC: a las 19:00 de Ciudad de
// México ya es mañana en UTC, y el egreso caía en el día —y a fin de mes, en el
// mes— siguiente.
const today = () => toDateInputValue(new Date());

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
    // §7.2. Va en el payload normalizado —y no solo en el alta— porque el
    // egreso PUEDE cambiar de categoría al editarlo: resolverlo únicamente al
    // crear dejaría la cuenta apuntando a la categoría vieja, que es la forma
    // silenciosa de que un informe agrupe mal. Aquí las dos se mueven juntas.
    accountCode: codigoDeCategoriaDeEgreso(values.category),
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
    // **`PRD-V-FLOW-008` · el plan NO se escribe aquí (`R8`).** Lo guarda
    // `saveExpensePlan`, y la regla de `expenses` congela `installments` frente
    // al cliente: desde la entrega 2 la deuda del conjunto deriva de las cuotas
    // vivas, así que este array sostiene un invariante.
  };
}

export async function createExpense(tenantId: string, userId: string, values: ExpenseFormValues): Promise<string> {
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
  // `FLOW-008` · lo devuelve para que el plan pueda guardarse a continuación.
  return ref.id;
}

export async function updateExpense(prev: Expense, userId: string, values: ExpenseFormValues) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const payload = normalizeExpensePayload(values);
  // Editar un egreso que YA estaba pagado no cambia cuándo se pagó. Antes esto
  // volvía a sellar «hoy» en cada edición, y corregir la descripción de un gasto
  // pagado en agosto lo movía —a él y a su asiento— al mes en curso.
  const paidAt =
    payload.status !== "pagado" ? null : prev.status === "pagado" && prev.paidAt ? prev.paidAt : today();

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
    // `FLOW-004` R7: el tenant va porque el borrado tiene que soltar antes la
    // conciliación, y esa liberación la hace el servidor.
    await deleteLedgerEntry(prev.ledgerEntryId, prev.tenantId);
    await updateDoc(doc(db, "expenses", prev.id), { ledgerEntryId: null });
  }
}

export async function deleteExpense(expense: Pick<Expense, "id" | "ledgerEntryId" | "tenantId">) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (expense.ledgerEntryId) {
    await deleteLedgerEntry(expense.ledgerEntryId, expense.tenantId);
  }
  await deleteDoc(doc(db, "expenses", expense.id));
}
