"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BillingStatement } from "@/types/domain";

export function useBillingStatements(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<BillingStatement[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("billing:query:refetch:start", { tenantId, unitId: unitId ?? null });
    }

    const unsub = subscribeTenantCollection<BillingStatement>(
      "billingStatements",
      tenantId,
      (data) => {
        if (process.env.NODE_ENV !== "production") {
          console.info("billing:query:refetch:success", { tenantId, count: data.length });
        }
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[admin-dashboard:billingStatements]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      {
        orderByField: "period",
        orderDirection: "desc",
        equals: unitId ? [{ field: "unitId", value: unitId }] : undefined,
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  if (!tenantId) {
    return { items: [], loading: false, error: null };
  }

  if (!db) return { items: [], loading: false, error: "Firebase no esta configurado." };

  return { items, loading, error };
}

export async function createBillingStatement(input: {
  tenantId: string;
  userId: string;
  unitId: string;
  unitLabel: string;
  period: string;
  amount: number;
  paymentAmount: number;
  balance: number;
  dueDate?: string;
  /** "import" agrupa el aviso al residente (lote); "manual" notifica individual. */
  source?: "manual" | "import";
}) {
  if (!input.unitId || !input.unitId.trim()) {
    throw new Error("unitId es obligatorio en createBillingStatement. No se permite derivar unitId desde unitLabel.");
  }

  await createTenantDocument("billingStatements", input.tenantId, input.userId, {
    unitId: input.unitId,
    unitLabel: input.unitLabel,
    period: input.period,
    amount: input.amount,
    paymentAmount: input.paymentAmount,
    balance: input.balance,
    dueDate: input.dueDate ?? null,
    source: input.source ?? "manual",
    status: input.balance <= 0 ? "paid" : input.dueDate && input.dueDate < new Date().toISOString().slice(0, 10) ? "overdue" : "pending",
    lastPaymentAt: input.paymentAmount > 0 ? new Date().toISOString().slice(0, 10) : null,
  });
}

export async function updateBillingStatement(
  id: string,
  input: {
    unitId?: string;
    unitLabel: string;
    period: string;
    amount: number;
    paymentAmount: number;
    balance: number;
    dueDate?: string;
    userId: string;
  },
) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const status = input.balance <= 0 ? "paid" : input.dueDate && input.dueDate < today ? "overdue" : "pending";

  await updateDoc(doc(db, "billingStatements", id), {
    ...(input.unitId ? { unitId: input.unitId } : {}),
    unitLabel: input.unitLabel,
    period: input.period,
    amount: input.amount,
    paymentAmount: input.paymentAmount,
    balance: input.balance,
    dueDate: input.dueDate ?? null,
    status,
    lastPaymentAt: input.paymentAmount > 0 ? today : null,
    updatedBy: input.userId,
    updatedAt: serverTimestamp(),
  });
}
