"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { applyPaymentCallable } from "@/lib/firebase/callables";
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

/**
 * Aprueba el comprobante Y registra el pago en el cobro vinculado (flujo semi-ágil):
 * aplica el monto confirmado por el admin al `billingStatement` (abono/saldo/estado) y
 * marca el comprobante como aprobado, en una sola transacción.
 */
export async function approveReceiptAndRegisterPayment(input: {
  receiptId: string;
  statementId: string;
  amount: number;
  reviewerId: string;
  reviewerName?: string;
  /** Conjunto al que pertenece la cuota. Lo exige la callable para validar permisos. */
  tenantId: string;
  /**
   * Clave de idempotencia (`FIN-001`). **La genera quien llama y la conserva
   * entre reintentos**: si se genera una nueva en cada intento, la protección
   * contra el doble cobro no sirve de nada.
   */
  operationKey: string;
}): Promise<void> {
  // Ya no escribe nada directamente. Antes actualizaba la cuota y marcaba el
  // comprobante en un batch —atómico entre esos dos, sí— pero **no tocaba el
  // libro contable**: el dinero se movía en cartera y nunca llegaba a la
  // contabilidad. Y calculaba el saldo aquí, en el navegador, con las reglas de
  // Firestore aceptando cualquier cifra.
  //
  // Ahora el servidor hace las tres cosas en una transacción. Ver
  // `functions/src/payments.ts`.
  await applyPaymentCallable({
    tenantId: input.tenantId,
    statementId: input.statementId,
    amount: input.amount,
    date: new Date().toISOString().slice(0, 10),
    operationKey: input.operationKey,
    source: "receipt",
    receiptId: input.receiptId,
    ...(input.reviewerName ? { reviewerName: input.reviewerName } : {}),
  });
}

/**
 * Backfill: archiva en la carpeta de sistema los comprobantes ya aprobados que aún no
 * están registrados en Documentos. Deduplica por storagePath. Idempotente.
 */
export async function backfillApprovedReceipts(input: {
  tenantId: string;
  folderId: string;
  userId: string;
  userName?: string;
}): Promise<number> {
  if (!db) return 0;
  const firestore = db;
  const [receipts, docsSnap] = await Promise.all([
    getDocs(query(collection(firestore, "paymentReceipts"), where("tenantId", "==", input.tenantId), where("status", "==", "approved"))),
    getDocs(query(collection(firestore, "documents"), where("tenantId", "==", input.tenantId), where("category", "==", "comprobante"))),
  ]);
  const registered = new Set(
    docsSnap.docs.map((d) => (d.data() as { storagePath?: string }).storagePath).filter(Boolean) as string[],
  );
  const pending = receipts.docs.filter((r) => {
    const data = r.data() as { storagePath?: string; fileUrl?: string };
    return Boolean(data.storagePath && data.fileUrl && !registered.has(data.storagePath));
  });
  await Promise.all(
    pending.map((r) => {
      const data = r.data() as { storagePath?: string; fileUrl?: string; fileName?: string };
      return addDoc(collection(firestore, "documents"), {
        tenantId: input.tenantId,
        fileName: data.fileName || "Comprobante",
        description: "",
        fileUrl: data.fileUrl,
        storagePath: data.storagePath,
        uploadedBy: input.userId,
        uploadedByName: input.userName ?? "",
        category: "comprobante",
        folderId: input.folderId,
        fileSize: 0,
        contentType: "",
        source: "payment_receipt",
        sourceId: r.id,
        createdBy: input.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  );
  return pending.length;
}
