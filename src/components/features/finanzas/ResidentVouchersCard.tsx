"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { codigoDeRecibo } from "@/features/finanzas/comprobante/codigo";
import { renderReciboPdf } from "@/features/finanzas/comprobante/recibo-pdf";
import { watchPaymentVouchers } from "@/features/finanzas/use-payments";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { PaymentVoucher } from "@/types/domain";

export function ResidentVouchersCard() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId || !user?.unitId) {
      setLoading(false);
      return;
    }
    const unsub = watchPaymentVouchers(
      user.tenantId,
      (data) => {
        setVouchers(data);
        setLoading(false);
      },
      () => setLoading(false),
      user.unitId,
    );
    return () => unsub();
  }, [user?.tenantId, user?.unitId]);

  if (loading || vouchers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardTitle>Comprobantes de pago</CardTitle>
      <CardDescription className="mt-1">Descarga el recibo de tus pagos registrados.</CardDescription>
      <ul className="mt-3 divide-y divide-[var(--slate-100)]">
        {vouchers.map((voucher) => (
          <li key={voucher.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              {/*
                Un recibo anulado tiene que decirlo AQUÍ, no solo dentro del PDF.
                Si la lista los pinta iguales, quien mira cree que su pago sigue
                en pie y solo se entera al abrir el papel — o no se entera.
              */}
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--slate-900)]">
                <span className={voucher.anulado ? "line-through opacity-60" : undefined}>
                  {codigoDeRecibo(voucher)}
                </span>
                {voucher.anulado ? (
                  <span className="rounded-full bg-[var(--danger-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger-700)]">
                    Anulado
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-[var(--slate-500)]">
                {voucher.issueDate} · {formatAmount(voucher.amount)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              type="button"
              aria-label={`Descargar recibo ${codigoDeRecibo(voucher)}`}
              onClick={() => {
                renderReciboPdf(voucher, formatAmount).catch((error) => toastFirebaseError(error));
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
