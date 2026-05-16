"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { PaymentReceipt } from "@/types/domain";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Subscribes to `paymentReceipts` in real time.
 *
 * - Resident view: pass both `tenantId` + `unitId` → only sees own receipts.
 * - Admin view:    pass only `tenantId`            → sees all tenant receipts.
 *
 * Returns `receiptByStatementId`: a Map keyed by `statementId` for O(1) lookup
 * inside BillingPeriodCard. When a receipt has no statementId it is still
 * accessible via the `items` array.
 */
export function usePaymentReceipts(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) return;

    const unsub = subscribeTenantCollection<PaymentReceipt>(
      "paymentReceipts",
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
      {
        orderByField: "uploadedAt",
        orderDirection: "desc",
        equals: unitId ? [{ field: "unitId", value: unitId }] : undefined,
      },
    );

    return () => { if (unsub) unsub(); };
  }, [tenantId, unitId]);

  if (!tenantId) return { items: [], receiptByStatementId: new Map<string, PaymentReceipt>(), loading: false, error: null };
  if (!db) return { items: [], receiptByStatementId: new Map<string, PaymentReceipt>(), loading: false, error: "Firebase no está configurado." };

  // Index by statementId for fast lookup in period cards
  const receiptByStatementId = new Map<string, PaymentReceipt>();
  for (const receipt of items) {
    if (receipt.statementId) {
      // Keep only the most recent receipt per statement (items are desc by uploadedAt)
      if (!receiptByStatementId.has(receipt.statementId)) {
        receiptByStatementId.set(receipt.statementId, receipt);
      }
    }
  }

  return { items, receiptByStatementId, loading, error };
}

// ─── Admin action ─────────────────────────────────────────────────────────────

/**
 * Called by the admin to approve or reject a payment receipt.
 * Writes `status`, `reviewedAt`, `reviewedBy`, `reviewedByName`, and
 * optionally `rejectedReason` to the Firestore document.
 */
export async function updateReceiptStatus(
  receiptId: string,
  input: {
    status: "approved" | "rejected";
    reviewedBy: string;
    reviewedByName?: string;
    rejectedReason?: string;
  },
): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");

  await updateDoc(doc(db, "paymentReceipts", receiptId), {
    status: input.status,
    reviewedAt: serverTimestamp(),
    reviewedBy: input.reviewedBy,
    ...(input.reviewedByName ? { reviewedByName: input.reviewedByName } : {}),
    ...(input.status === "rejected" && input.rejectedReason
      ? { rejectedReason: input.rejectedReason }
      : { rejectedReason: null }),
  });
}
