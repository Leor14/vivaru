"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BillingHeroCard } from "@/components/features/billing/BillingHeroCard";
import { BillingPeriodCard } from "@/components/features/billing/BillingPeriodCard";
import { ResidentVouchersCard } from "@/components/features/finanzas/ResidentVouchersCard";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { usePaymentReceipts } from "@/features/billing/use-payment-receipts";
import { db, storage } from "@/lib/firebase/client";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentAccountPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const { items, loading } = useBillingStatements(user?.tenantId, user?.unitId);
  const { receiptByStatementId } = usePaymentReceipts(user?.tenantId, user?.unitId);

  const [uploading, setUploading] = useState(false);
  // Tracks which statementId is being uploaded (null = global upload)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStatementId = useRef<string | null>(null);
  // F1: el residente confirma el monto antes de enviar el comprobante.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [declaredAmount, setDeclaredAmount] = useState("");

  // Sort statements newest-first
  const sortedItems = [...items].sort((a, b) => (a.period > b.period ? -1 : 1));

  function handleUploadForStatement(statementId: string) {
    pendingStatementId.current = statementId;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Solo se permiten imágenes (JPG, PNG, WEBP) o PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar 10 MB.");
      return;
    }

    // Pre-llena el monto con el saldo del período para que el residente lo confirme/ajuste.
    const stmt = items.find((i) => i.id === pendingStatementId.current);
    setDeclaredAmount(stmt && stmt.balance ? String(stmt.balance) : "");
    setPendingFile(file);
  }

  function cancelUpload() {
    setPendingFile(null);
    setDeclaredAmount("");
    pendingStatementId.current = null;
  }

  async function confirmUpload() {
    const file = pendingFile;
    const tenantId = user?.tenantId;
    const unitId = user?.unitId;
    const uid = user?.uid;
    const statementId = pendingStatementId.current;

    if (!file) return;
    if (!tenantId || !unitId || !uid) {
      toast.error("No se pudo identificar tu unidad. Recarga la página.");
      return;
    }
    if (!db || !storage) {
      toast.error("Firebase no está disponible en este momento.");
      return;
    }
    const amount = parseFloat(declaredAmount.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Indica el monto que pagaste.");
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
        amount,
        status: "pending",
        // statementId links this receipt to a specific billing period
        ...(statementId ? { statementId } : {}),
      });

      toast.success("Comprobante enviado. El administrador lo revisará pronto.");
      setPendingFile(null);
      setDeclaredAmount("");
    } catch {
      toast.error("No fue posible subir el comprobante. Intenta de nuevo.");
    } finally {
      setUploading(false);
      setUploadingFor(null);
      pendingStatementId.current = null;
    }
  }

  return (
    <div className="space-y-4">
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
      {loading ? (
        <Skeleton className="mt-4 h-[148px] rounded-xl" />
      ) : sortedItems.length > 0 ? (
        <div className="mt-4">
          <BillingHeroCard items={sortedItems} formatAmount={formatAmount} />
        </div>
      ) : null}

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
            description="Aún no hay estados de cuenta publicados para tu unidad."
          />
        )}

        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            className="opacity-0 translate-y-1"
            style={{
              animation: `billingCardIn 280ms var(--ease-out) ${index * 60}ms forwards`,
            }}
          >
            <BillingPeriodCard
              item={item}
              formatAmount={formatAmount}
              onUploadReceipt={uploading ? undefined : handleUploadForStatement}
              isUploading={uploadingFor === item.id}
              receiptStatus={receiptByStatementId.get(item.id)?.status ?? null}
              defaultOpen={index === 0 && item.status !== "paid"}
            />
          </div>
        ))}
      </div>
    </Card>
    <ResidentVouchersCard />

    {pendingFile ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-base font-semibold text-[var(--slate-900)]">Confirmar comprobante</h3>
          <p className="mt-1 text-sm text-[var(--slate-600)]">
            Indica el monto que pagaste. Así el administrador lo valida más rápido.
          </p>
          <label className="mt-4 block text-xs font-medium text-[var(--slate-700)]">
            Monto pagado
            <input
              type="number"
              inputMode="decimal"
              value={declaredAmount}
              onChange={(e) => setDeclaredAmount(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
              placeholder="0"
              autoFocus
            />
          </label>
          <p className="mt-2 truncate text-xs text-[var(--slate-500)]">Archivo: {pendingFile.name}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancelUpload} disabled={uploading}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmUpload} disabled={uploading}>
              {uploading ? "Enviando..." : "Enviar comprobante"}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    </div>
  );
}
