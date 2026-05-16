"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { BillingHeroCard } from "@/components/features/billing/BillingHeroCard";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { db, storage } from "@/lib/firebase/client";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

// ─── Status label helper ──────────────────────────────────────────────────────

function statusLabel(status: string): string {
  if (status === "paid") return "Al día";
  if (status === "overdue") return "Vencido";
  return "Pendiente";
}

function statusColor(status: string): string {
  if (status === "paid") return "text-emerald-600";
  if (status === "overdue") return "text-red-600";
  return "text-amber-600";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentAccountPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const { items, loading } = useBillingStatements(user?.tenantId, user?.unitId);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const tenantId = user?.tenantId;
    const unitId = user?.unitId;
    const uid = user?.uid;

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
      });

      toast.success("Comprobante enviado. El administrador lo revisará pronto.");
    } catch {
      toast.error("No fue posible subir el comprobante. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Estado de cuenta</CardTitle>
          <CardDescription className="mt-1">
            Saldo, movimientos y cuotas de tu unidad.
          </CardDescription>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          variant="outline"
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Subiendo…" : "Subir comprobante"}
        </Button>
      </div>

      {/* Hero card — situación financiera */}
      {!loading && items.length > 0 && (
        <div className="mt-4">
          <BillingHeroCard items={items} formatAmount={formatAmount} />
        </div>
      )}

      <div className="mt-4 grid gap-2 text-sm">
        {loading ? (
          <p className="text-[var(--slate-600)]">Cargando estado de cuenta...</p>
        ) : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Aun no hay estados de cuenta publicados para tu unidad."
          />
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-[var(--slate-200)] px-4 py-3"
          >
            <div>
              <p className="font-medium text-[var(--slate-900)]">{item.period}</p>
              {item.dueDate && (
                <p className="text-xs text-[var(--slate-500)]">Vence: {item.dueDate}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-[var(--slate-900)]">
                {formatAmount(item.balance)}
              </p>
              <p className={`text-xs font-medium ${statusColor(item.status)}`}>
                {statusLabel(item.status)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
