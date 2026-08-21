"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { codigoDeRecibo } from "@/features/finanzas/comprobante/codigo";
import { renderReciboPdf } from "@/features/finanzas/comprobante/recibo-pdf";
import { watchPaymentVouchers } from "@/features/finanzas/use-payments";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { PaymentVoucher } from "@/types/domain";

/**
 * Filtra recibos por texto libre: código, pagador, unidad o concepto.
 *
 * Se filtra **en memoria** porque la suscripción ya trae la lista entera:
 * pedirle a Firestore un índice más por una búsqueda de texto no compensa
 * mientras un conjunto emita decenas de recibos al mes, no miles. El día que
 * los emita a miles, esto se cambia por una consulta — y entonces el cambio
 * está aquí, en una función, y no repartido por el componente.
 */
export function filtrarRecibos(recibos: PaymentVoucher[], busqueda: string): PaymentVoucher[] {
  const q = busqueda.trim().toLowerCase();
  if (!q) return recibos;
  return recibos.filter((v) =>
    [codigoDeRecibo(v), v.payerName, v.payerUnitLabel, v.concept]
      .filter(Boolean)
      .some((campo) => String(campo).toLowerCase().includes(q)),
  );
}

/**
 * Los recibos que ha emitido el conjunto, para la administración.
 *
 * **Por qué existe.** Hasta el 20 de agosto de 2026 un administrador solo veía
 * el recibo **en el instante de emitirlo**, dentro de la ventana de registrar
 * cobro; al cerrarla no había ninguna forma de volver a él. El residente sí
 * tenía su lista, la administración no. Lo destapó David probando el reverso en
 * staging: no encontró dónde descargar el recibo para comprobar que había
 * quedado anulado, y no lo encontró porque no existía.
 *
 * Antes importaba poco —el recibo lo construía el navegador y era casi un
 * adorno—. **Ahora es el registro del propio sistema:** se emite dentro de la
 * misma transacción que el dinero y se anula al revertir el pago. Que quien
 * administra no pueda verlo deja al conjunto sin poder responder a un residente
 * que pide su recibo.
 *
 * **La columna «Comprobante» de Cartera no es esto:** aquella muestra el archivo
 * que SUBE el residente como prueba de pago. Este es el recibo que EMITE Vivaru.
 * Son dos documentos distintos y conviene no confundirlos al buscarlos.
 */
export function AdminVouchersCard() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    if (!user?.tenantId) return;
    setLoading(true);
    const unsub = watchPaymentVouchers(
      user.tenantId,
      (items) => {
        setVouchers(items);
        setErrorMessage(null);
        setLoading(false);
      },
      (message) => {
        setErrorMessage(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user?.tenantId]);

  const filtrados = useMemo(() => filtrarRecibos(vouchers, busqueda), [vouchers, busqueda]);

  const columns: DataTableColumn<PaymentVoucher>[] = [
    {
      key: "code",
      header: "Recibo",
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              item.anulado
                ? "font-medium text-[var(--slate-900)] line-through opacity-60"
                : "font-medium text-[var(--slate-900)]"
            }
          >
            {codigoDeRecibo(item)}
          </span>
          {item.anulado ? (
            <span className="rounded-full bg-[var(--danger-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger-700)]">
              Anulado
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "issueDate", header: "Fecha", render: (item) => item.issueDate },
    {
      key: "unit",
      header: "Unidad",
      render: (item) => item.payerUnitLabel ?? <span className="text-[var(--slate-400)]">—</span>,
    },
    {
      key: "payer",
      header: "Pagador",
      mobileHidden: true,
      render: (item) => item.payerName ?? <span className="text-[var(--slate-400)]">—</span>,
    },
    {
      key: "amount",
      header: "Monto",
      render: (item) => (
        <span className={item.anulado ? "opacity-60" : "font-medium"}>
          {formatAmount(item.amount)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Recibos emitidos</CardTitle>
          <CardDescription className="mt-1">
            Los recibos que el conjunto entregó al registrar un pago. Un recibo anulado
            corresponde a un pago revertido: se conserva como histórico, no se borra.
          </CardDescription>
        </div>
        <Input
          className="w-full sm:w-64"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por recibo, unidad o pagador"
          aria-label="Buscar recibos"
        />
      </div>
      <div className="mt-3">
        <DataTable
          columns={columns}
          rows={filtrados}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando recibos..."
          emptyText={
            busqueda.trim()
              ? "Ningún recibo coincide con la búsqueda."
              : "Aún no se ha emitido ningún recibo."
          }
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[560px] sm:min-w-[640px]"
          renderActions={(item) => (
            <Button
              size="sm"
              variant="outline"
              type="button"
              aria-label={`Descargar recibo ${codigoDeRecibo(item)}`}
              onClick={() => {
                renderReciboPdf(item, formatAmount).catch((error) => toastFirebaseError(error));
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          )}
        />
      </div>
    </Card>
  );
}
