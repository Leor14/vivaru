"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { codigoDeCategoriaDeEgreso } from "@/lib/finanzas/conceptos-de-cargo";

import { fundirPlan } from "./cuotas-del-egreso";
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
    /**
     * `PRD-V-FLOW-008` · el plan.
     *
     * **`null` cuando no hay cuotas, y no un array vacío**: es la diferencia
     * entre «esta factura se paga de una vez» y «tiene un plan sin cuotas», y el
     * resto del producto lee la ausencia como lo primero.
     *
     * **Las cuotas nacen `pendiente` y sin nada del pago.** El estado, el asiento
     * y `paidAt` los escribe el SERVIDOR en la entrega 2; si viajaran desde aquí,
     * marcar una cuota como pagada sería editar un campo y la deuda del conjunto
     * bajaría sin que nadie pagase.
     */
    installments:
      values.installments && values.installments.length > 0
        ? values.installments.map((c) => ({
            number: c.number,
            dueDate: c.dueDate,
            amount: c.amount,
            status: "pendiente" as const,
          }))
        : null,
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
  const payload = {
    ...normalizeExpensePayload(values),
    // **`PRD-V-FLOW-008` · el plan se FUNDE, no se sobrescribe.** El formulario
    // solo trae número, fecha e importe; guardar el array tal cual devolvía una
    // cuota `pagada` a `pendiente` y dejaba su asiento huérfano en el libro.
    // Ver `fundirPlan`.
    installments: fundirPlan(prev.installments, values.installments),
  };
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
