"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BillingHeroCard } from "@/components/features/billing/BillingHeroCard";
import { BillingPeriodCard } from "@/components/features/billing/BillingPeriodCard";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { db, storage } from "@/lib/firebase/client";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentAccountPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const { items, loading } = useBillingStatements(user?.tenantId, user?.unitId);

  const [uploading, setUploading] = useState(false);
  // Tracks which statementId is being uploaded (null = global upload)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStatementId = useRef<string | null>(null);

  // Sort statements newest-first
  const sortedItems = [...items].sort((a, b) => (a.period > b.period ? -1 : 1));

  function handleUploadForStatement(statementId: string) {
    pendingStatementId.current = statementId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const tenantId = user?.tenantId;
    const unitId = user?.unitId;
    const uid = user?.uid;
    const statementId = pendingStatementId.current;

    if (!tenantId || !unitId || !uid) {
      toast.error("No se pudo identificar tu unidad. Recarga la página.");
      return;
    }
    if (!db || !storage) {
      toast.error("Firebase no está disponible en este momento.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Solo se permiten imágenes (JPG, PNG, WEBP) o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar 10 MB.");
      return;
    }

    setUploading(true);
    if (statementId) setUploadingFor(statementId);

    try {
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
      const storagePath = `tenants/${tenantId}/payment-receipts/${unitId}/${Date.now()}-${cleanName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "paymentReceipts"), {
        tenantId,
        unitId,
        uploadedBy: uid,
        uploadedAt: serverTimestamp(),
        fileUrl,
        fileName: file.name,
        storagePath,
        status: "pending",
        // F2: statementId links this receipt to a specific billing period
        ...(statementId ? { statementId } : {}),
      });

      toast.success("Comprobante enviado. El administrador lo revisará pronto.");
    } catch {
      toast.error("No fue posible subir el comprobante. Intenta de nuevo.");
    } finally {
      setUploading(false);
      setUploadingFor(null);
      pendingStatementId.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <div>
        <CardTitle>Estado de cuenta</CardTitle>
        <CardDescription className="mt-1">
          Saldo, movimientos y cuotas de tu unidad.
        </CardDescription>
      </div>

      {/* Hidden file input — shared across all period cards */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hero card — situación financiera */}
      {!loading && sortedItems.length > 0 && (
        <div className="mt-4">
          <BillingHeroCard items={sortedItems} formatAmount={formatAmount} />
        </div>
      )}

      {/* Period cards */}
      <div className="mt-4 grid gap-2">
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-[var(--slate-100)]"
              />
            ))}
          </>
        )}

        {!loading && sortedItems.length === 0 && (
          <EmptyState
            title="Sin movimientos"
            description="Aun no hay estados de cuenta publicados para tu unidad."
          />
        )}

        {sortedItems.map((item, index) => (
          <BillingPeriodCard
            key={item.id}
            item={item}
            formatAmount={formatAmount}
            onUploadReceipt={uploading ? undefined : handleUploadForStatement}
            receiptStatus={null} // F2 will supply real receipt status per period
            defaultOpen={index === 0 && item.status !== "paid"}
          />
        ))}
      </div>
    </Card>
  );
}
