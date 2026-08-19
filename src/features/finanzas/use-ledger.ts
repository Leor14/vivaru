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

/**
 * Borrado físico de un asiento. SOLO para el ciclo automático de egresos
 * (sincronizar el asiento auto-generado cuando el egreso deja de estar pagado).
 * Los movimientos manuales NO se borran desde la UI: se reversan con
 * `reverseLedgerEntry` para conservar la trazabilidad contable.
 */
export async function deleteLedgerEntry(id: string) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  await deleteDoc(doc(db, "ledgerEntries", id));
}

/**
 * Anula un movimiento manual creando su asiento inverso (mismo tipo, monto
 * NEGATIVO) y marcando el original con `reversedByEntryId`. El monto negativo
 * — en vez de tipo opuesto — mantiene simétricas todas las agregaciones
 * (`computeFundPosition` y la exclusión de "alicuota" aplican igual al
 * original y a su reverso). Convención contable: nunca borrar, siempre anular.
 */
export async function reverseLedgerEntry(
  tenantId: string,
  userId: string,
  entry: LedgerEntry,
): Promise<string> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (entry.sourceType === "reversal" || entry.amount < 0) {
    throw new Error("Un reverso no se puede reversar.");
  }
  if (entry.reversedByEntryId) {
    throw new Error("Este movimiento ya fue anulado.");
  }
  const ref = await createTenantDocument("ledgerEntries", tenantId, userId, {
    type: entry.type,
    date: today(),
    amount: -Math.abs(entry.amount),
    concept: `Reverso: ${entry.concept}`,
    category: entry.category ?? null,
    bankAccountId: entry.bankAccountId ?? null,
    sourceType: "reversal",
    sourceId: entry.id,
    reconciled: false,
  });
  await updateDoc(doc(db, "ledgerEntries", entry.id), {
    reversedByEntryId: ref.id,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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

/**
 * Si un movimiento SUMA o RESTA al fondo, mirando tipo y monto a la vez.
 *
 * **Por qué hace falta.** El signo no se puede derivar solo del tipo. Un reverso
 * conserva el tipo del asiento que anula y lleva **monto negativo** —convención
 * de `reverseLedgerEntry`, ver arriba—, así que un reverso de ingreso es de tipo
 * `ingreso` y sin embargo resta. Derivarlo del tipo pintaba `+-$430.000` en
 * verde, como si hubiera entrado dinero: los dos signos juntos y el color al
 * revés. Defecto de `72c3083`, visible desde que `FIN-001` trajo reversos de
 * pago al libro.
 *
 * Las cuatro combinaciones: ingreso positivo entra; ingreso negativo (su
 * reverso) sale; egreso positivo sale; egreso negativo (su reverso) **entra**,
 * porque anular un gasto devuelve el dinero al fondo.
 */
export function movimientoEntraAlFondo(type: LedgerEntry["type"], amount: number): boolean {
  return (type === "ingreso") === (amount >= 0);
}
