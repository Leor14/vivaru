"use client";

import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { fechaDelSello, firmantes } from "@/features/finanzas/informe-mensual-texto";
import type { MonthlyReport } from "@/features/finanzas/use-monthly-reports";

/**
 * Las cifras de un informe mensual (`PRD-V-FLOW-007`), las mismas para la administración y
 * para el consejo.
 *
 * Vivían dentro de `InformeMensualCard`. Salieron cuando el consejo ganó su propia pantalla
 * (`PRD-V-PLAT-004` entrega 2): dos copias de este bloque serían dos sitios donde un «$0»
 * sin dato podría volver a colarse (`CA4`) y donde un anulado podría dejar de verse anulado.
 *
 * Pinta TOTALES, como siempre. La cartera por unidad ya no viaja en el informe: vive en
 * `monthlyReportReceivables`, que solo lee la administración (`K2`), porque este documento lo
 * lee también el consejo.
 */
export function ResumenDelInforme({ informe }: { informe: MonthlyReport }) {
  const { formatAmount } = useTenantCurrency();
  const quienes = firmantes(informe);

  return (
    <>
      {/* `RN-14` · un informe anulado se conserva y **se ve anulado, con su motivo**. */}
      {informe.status === "anulado" && informe.voidReason && (
        <p className="mt-2 text-sm text-[var(--mapa-rojo-texto-1)]">
          Anulado el {fechaDelSello(informe.voidedAt)}: {informe.voidReason}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--slate-500)]">Saldo inicial</dt>
          {/* `CA4` · sin dato NO se escribe «$0»: nadie afirmó ese cero. */}
          <dd className="font-medium text-[var(--slate-900)]">
            {informe.openingBalanceSource === "registrado" ? (
              formatAmount(informe.openingBalance)
            ) : (
              <span className="text-[var(--slate-500)]">Sin saldo de apertura</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Resultado del mes</dt>
          <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.netResult)}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Saldo final</dt>
          <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.closingBalance)}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Por cobrar</dt>
          <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.receivables?.total ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Deuda a proveedores</dt>
          <dd className="font-medium text-[var(--slate-900)]">{formatAmount(informe.payables?.total ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-[var(--slate-500)]">Firmas</dt>
          <dd className="font-medium text-[var(--slate-900)]">
            {quienes === "" ? <span className="text-[var(--slate-500)]">Sin firmar</span> : quienes}
          </dd>
        </div>
      </dl>
    </>
  );
}
