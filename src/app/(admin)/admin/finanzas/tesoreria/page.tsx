"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { watchBankAccountBalances, watchBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { movimientoEntraAlFondo, watchLedger } from "@/features/finanzas/use-ledger";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { repartirRecaudo } from "@/lib/finanzas/conceptos-de-cargo";
import { saldosPorCuenta, type FilaDeTesoreria } from "@/lib/finanzas/tesoreria";
import type { BankAccount, LedgerEntry } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 1 — dónde está el dinero del conjunto.
 *
 * **El total no se calcula aquí**: sale de `saldosPorCuenta`, que lo toma de la
 * misma función que da el saldo de fondos en «Libro y fondos» (`RN-04`), y con
 * las mismas entradas que esa pantalla: el libro, lo cobrado según Cartera y los
 * saldos iniciales. Lo vigila un guardián.
 */

// Lo leído va atado al conjunto que lo pidió: al cambiar de conjunto, lo del
// anterior deja de valer sin tener que borrarlo a mano.
type Leido<T> = { tenantId: string; valor: T } | null;

export default function TesoreriaPage() {
  const { user } = useAuth();
  const activa = useFeatureFlag("producto-tesoreria");
  const { formatAmount } = useTenantCurrency();
  const tenantId = user?.tenantId;

  const [asientos, setAsientos] = useState<Leido<LedgerEntry[]>>(null);
  const [cuentas, setCuentas] = useState<Leido<BankAccount[]>>(null);
  const [saldos, setSaldos] = useState<Leido<Array<{ id: string; openingBalance?: number }>>>(null);
  const [error, setError] = useState<string | null>(null);
  const [verSinCuenta, setVerSinCuenta] = useState(false);
  const { items: statements } = useBillingStatements(tenantId);

  useEffect(() => {
    if (!tenantId) return;
    return watchLedger(tenantId, (valor) => setAsientos({ tenantId, valor }), setError);
  }, [tenantId]);
  useEffect(() => {
    if (!tenantId) return;
    return watchBankAccounts(tenantId, (valor) => setCuentas({ tenantId, valor }), setError);
  }, [tenantId]);
  useEffect(() => {
    if (!tenantId) return;
    // Mismo respaldo que «Libro y fondos»: si los saldos no se pueden leer, cuenta
    // como sin saldo inicial. Así los dos totales siguen siendo el mismo número.
    return watchBankAccountBalances(
      tenantId,
      (valor) => setSaldos({ tenantId, valor }),
      () => setSaldos({ tenantId, valor: [] }),
    );
  }, [tenantId]);

  const cuotaIncome = useMemo(() => repartirRecaudo(statements).total, [statements]);
  const asientosDelConjunto = asientos && asientos.tenantId === tenantId ? asientos.valor : null;
  const cuentasDelConjunto = cuentas && cuentas.tenantId === tenantId ? cuentas.valor : null;
  const saldosDelConjunto = saldos && saldos.tenantId === tenantId ? saldos.valor : null;

  const tesoreria = useMemo(() => {
    if (!asientosDelConjunto || !cuentasDelConjunto || !saldosDelConjunto) return null;
    return saldosPorCuenta({
      cuentas: cuentasDelConjunto,
      saldosIniciales: saldosDelConjunto,
      asientos: asientosDelConjunto,
      cuotaIncome,
    });
  }, [asientosDelConjunto, cuentasDelConjunto, saldosDelConjunto, cuotaIncome]);

  if (!activa) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <CardTitle>Esta función no está activa en tu conjunto</CardTitle>
          <CardDescription className="mt-2">
            La tesorería te dice cuánto dinero hay en cada cuenta del conjunto, y cuadra con el
            saldo de fondos. Escríbenos si quieres activarla.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* El encabezado de nivel 1 lo pone el shell, con el nombre del menú. */}
      <Card className="p-6">
        <CardTitle>Dónde está el dinero</CardTitle>
        <CardDescription className="mt-1">
          Cuánto hay en cada cuenta del conjunto. El total es el mismo saldo de fondos que ves en
          Libro y fondos, y las líneas de abajo explican lo que no se puede atribuir a una cuenta.
        </CardDescription>
      </Card>

      {error ? (
        <Card className="border-[var(--danger-300)] p-4 text-sm text-[var(--danger-700)]">{error}</Card>
      ) : null}

      {!tesoreria ? (
        <Card className="p-6 text-sm text-[var(--slate-600)]">Cargando…</Card>
      ) : (
        <>
          <Card className="p-6">
            <CardTitle>Cuentas</CardTitle>
            {tesoreria.cuentas.length === 0 && !tesoreria.cuentasQueYaNoExisten ? (
              <p className="mt-3 text-sm text-[var(--slate-600)]">
                Este conjunto no tiene cuentas bancarias registradas. Todo su dinero aparece en las
                líneas de abajo.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--slate-200)] text-left text-[var(--slate-600)]">
                      <th className="py-2 pr-4 font-medium">Cuenta</th>
                      <th className="py-2 pr-4 text-right font-medium">Saldo inicial</th>
                      <th className="py-2 pr-4 text-right font-medium">Entradas</th>
                      <th className="py-2 pr-4 text-right font-medium">Salidas</th>
                      <th className="py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tesoreria.cuentas.map((fila) => (
                      <FilaDeCuenta key={fila.id} fila={fila} formatAmount={formatAmount} />
                    ))}
                    {tesoreria.cuentasQueYaNoExisten ? (
                      <FilaDeCuenta fila={tesoreria.cuentasQueYaNoExisten} formatAmount={formatAmount} />
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <CardTitle>Lo que no está en ninguna cuenta</CardTitle>
            <CardDescription className="mt-1">
              El saldo de fondos lo cuenta, pero no se sabe en qué cuenta está. Por eso tiene su
              propia línea en vez de repartirse.
            </CardDescription>
            <dl className="mt-4 divide-y divide-[var(--slate-100)] text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <dt className="text-[var(--slate-900)]">
                  Movimientos sin cuenta asignada
                  <span className="ml-2 text-[var(--slate-600)]">
                    {tesoreria.sinCuenta.cantidad === 1 ? "1 movimiento" : `${tesoreria.sinCuenta.cantidad} movimientos`}
                  </span>
                </dt>
                <dd className="tabular-nums text-[var(--slate-900)]">{formatAmount(tesoreria.sinCuenta.monto)}</dd>
              </div>
              {tesoreria.sinCuenta.cantidad > 0 ? (
                <div className="py-2">
                  <Button variant="ghost" aria-expanded={verSinCuenta} onClick={() => setVerSinCuenta((v) => !v)}>
                    <ChevronDown className={verSinCuenta ? "mr-2 h-4 w-4 rotate-180" : "mr-2 h-4 w-4"} aria-hidden />
                    {verSinCuenta ? "Ocultar cuáles son" : "Ver cuáles son"}
                  </Button>
                  {verSinCuenta ? (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm">
                        <tbody>
                          {tesoreria.sinCuenta.asientos.map((a) => {
                            const entra = movimientoEntraAlFondo(a.type, a.amount ?? 0);
                            return (
                              <tr key={a.id} className="border-b border-[var(--slate-100)]">
                                <td className="py-2 pr-4 tabular-nums text-[var(--slate-600)]">{a.date}</td>
                                <td className="py-2 pr-4 text-[var(--slate-900)]">{a.concept}</td>
                                <td className="py-2 text-right tabular-nums text-[var(--slate-900)]">
                                  {entra ? "+" : "−"}
                                  {formatAmount(Math.abs(a.amount ?? 0))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <dt className="max-w-[var(--medida-lectura)] text-[var(--slate-900)]">
                  Cobrado en Cartera sin asiento en el libro
                  <span className="mt-1 block text-[var(--slate-600)]">
                    Lo que Cartera da por cobrado y el libro no registra como movimiento.
                  </span>
                </dt>
                <dd className="tabular-nums text-[var(--slate-900)]">{formatAmount(tesoreria.cobradoSinAsiento)}</dd>
              </div>
              {tesoreria.sinExplicar !== 0 ? (
                <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                  <dt className="text-[var(--danger-700)]">Diferencia sin explicar</dt>
                  <dd className="tabular-nums font-semibold text-[var(--danger-700)]">
                    {formatAmount(tesoreria.sinExplicar)}
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <dt className="font-semibold text-[var(--slate-900)]">Saldo de fondos</dt>
                <dd className="tabular-nums text-lg font-semibold text-[var(--slate-900)]">
                  {formatAmount(tesoreria.total)}
                </dd>
              </div>
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}

function FilaDeCuenta({ fila, formatAmount }: { fila: FilaDeTesoreria; formatAmount: (n: number) => string }) {
  return (
    <tr className="border-b border-[var(--slate-100)]">
      <td className="py-2 pr-4">
        <span className="text-[var(--slate-900)]">{fila.label}</span>
        {fila.detalle ? <span className="ml-2 text-[var(--slate-600)]">{fila.detalle}</span> : null}
        {!fila.activa && fila.detalle ? <span className="ml-2 text-[var(--slate-600)]">(desactivada)</span> : null}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-600)]">
        {fila.saldoInicial === null ? "Sin registrar" : formatAmount(fila.saldoInicial)}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{formatAmount(fila.entradas)}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{formatAmount(fila.salidas)}</td>
      <td className="py-2 text-right font-semibold tabular-nums text-[var(--slate-900)]">{formatAmount(fila.saldo)}</td>
    </tr>
  );
}
