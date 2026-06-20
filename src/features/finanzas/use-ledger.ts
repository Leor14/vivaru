"use client";

import { useEffect, useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Expense, LedgerEntry } from "@/types/domain";

import type { LedgerEntryFormValues } from "./schemas";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Suscripción en tiempo real al libro de movimientos del tenant. El orden se
 * aplica del lado del cliente para no exigir un índice compuesto en Firestore.
 */
export function watchLedger(
  tenantId: string,
  onData: (items: LedgerEntry[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<LedgerEntry>(
      "ledgerEntries",
      tenantId,
      (items) => onData([...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))),
      onError,
    ) ?? (() => {})
  );
}

/**
 * Hook de conveniencia: suscribe el libro del tenant y expone los asientos.
 * Permite que un tablero (p. ej. Liquidez) traiga sus propios datos sin que el
 * contenedor tenga que cablearlos. Mismo patrón que la página de Libro y fondos.
 */
export function useLedgerEntries(tenantId?: string) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const unsub = watchLedger(
      tenantId,
      (data) => {
        setEntries(data);
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

  return { entries, loading, error };
}

export async function createManualLedgerEntry(
  tenantId: string,
  userId: string,
  values: LedgerEntryFormValues,
) {
  await createTenantDocument("ledgerEntries", tenantId, userId, {
    type: values.type,
    date: values.date,
    amount: values.amount,
    concept: values.concept.trim(),
    category: values.category?.trim() || null,
    bankAccountId: values.bankAccountId?.trim() || null,
    sourceType: "manual",
    sourceId: null,
    reconciled: false,
  });
}

export async function deleteLedgerEntry(id: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await deleteDoc(doc(db, "ledgerEntries", id));
}

// ── Movimientos automáticos derivados de egresos pagados ──────────────────

export type ExpenseLedgerAction = "create" | "update" | "delete" | "none";

/**
 * Decide qué hacer con el asiento de libro de un egreso al guardarlo,
 * de forma idempotente (evita duplicar el movimiento al re-editar).
 */
export function resolveExpenseLedgerAction(input: {
  prevLedgerEntryId?: string | null;
  nextStatus: Expense["status"];
}): ExpenseLedgerAction {
  const hasEntry = Boolean(input.prevLedgerEntryId);
  if (input.nextStatus === "pagado") {
    return hasEntry ? "update" : "create";
  }
  return hasEntry ? "delete" : "none";
}

/** Crea el asiento de egreso de un gasto pagado y devuelve su id. */
export async function createExpenseLedgerEntry(
  tenantId: string,
  userId: string,
  expense: { id: string; description: string; amount: number; category: Expense["category"]; paidAt?: string | null; issueDate: string; bankAccountId?: string | null },
): Promise<string> {
  const ref = await createTenantDocument("ledgerEntries", tenantId, userId, {
    type: "egreso",
    date: expense.paidAt || expense.issueDate || today(),
    amount: expense.amount,
    concept: expense.description,
    category: expense.category,
    bankAccountId: expense.bankAccountId ?? null,
    sourceType: "expense",
    sourceId: expense.id,
    reconciled: false,
  });
  return ref.id;
}

export async function updateExpenseLedgerEntry(
  id: string,
  userId: string,
  expense: { description: string; amount: number; category: Expense["category"]; paidAt?: string | null; issueDate: string; bankAccountId?: string | null },
) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await updateDoc(doc(db, "ledgerEntries", id), {
    date: expense.paidAt || expense.issueDate || today(),
    amount: expense.amount,
    concept: expense.description,
    category: expense.category,
    bankAccountId: expense.bankAccountId ?? null,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

// ── Posición de fondos ────────────────────────────────────────────────────

export type FundPosition = {
  cuotaIncome: number;
  ledgerIncome: number;
  totalIncome: number;
  expenses: number;
  balance: number;
};

/**
 * Calcula la posición de fondos combinando los movimientos del libro con el
 * recaudo de cuotas derivado de Cartera (read-only, para no duplicar el ingreso).
 */
export function computeFundPosition(
  entries: LedgerEntry[],
  cuotaIncome: number,
  openingBalance = 0,
): FundPosition {
  let ledgerIncome = 0;
  let expenses = 0;
  for (const entry of entries) {
    if (entry.type === "ingreso") {
      // El recaudo de cuotas (categoría "alicuota") se cuenta vía cuotaIncome
      // (derivado de Cartera, fuente completa). Se excluye aquí para no duplicar.
      if (entry.category !== "alicuota") ledgerIncome += entry.amount;
    } else if (entry.type === "egreso") {
      expenses += entry.amount;
    }
  }
  const totalIncome = cuotaIncome + ledgerIncome;
  return {
    cuotaIncome,
    ledgerIncome,
    totalIncome,
    expenses,
    balance: openingBalance + totalIncome - expenses,
  };
}
