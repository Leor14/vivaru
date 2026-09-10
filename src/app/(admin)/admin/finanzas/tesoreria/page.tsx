"use client";

import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { watchBankAccountBalances, watchBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { movimientoEntraAlFondo, watchLedger } from "@/features/finanzas/use-ledger";
import { anularTraspaso, registrarTraspaso, watchTraspasos } from "@/features/finanzas/use-traspasos";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { repartirRecaudo } from "@/lib/finanzas/conceptos-de-cargo";
import {
  errorDeTraspaso,
  saldoNegativoTrasTraspaso,
  saldosPorCuenta,
  type FilaDeTesoreria,
} from "@/lib/finanzas/tesoreria";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, LedgerEntry, TreasuryTransfer } from "@/types/domain";

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
  const [traspasos, setTraspasos] = useState<Leido<TreasuryTransfer[]>>(null);
  const [error, setError] = useState<string | null>(null);
  const [verSinCuenta, setVerSinCuenta] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState({ fromAccountId: "", toAccountId: "", amount: "", date: "", reference: "", detail: "" });
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarAnular, setConfirmarAnular] = useState<string | null>(null);
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

  useEffect(() => {
    if (!tenantId) return;
    return watchTraspasos(tenantId, (valor) => setTraspasos({ tenantId, valor }), setError);
  }, [tenantId]);

  const cuotaIncome = useMemo(() => repartirRecaudo(statements).total, [statements]);
  const asientosDelConjunto = asientos && asientos.tenantId === tenantId ? asientos.valor : null;
  const cuentasDelConjunto = cuentas && cuentas.tenantId === tenantId ? cuentas.valor : null;
  const saldosDelConjunto = saldos && saldos.tenantId === tenantId ? saldos.valor : null;
  const traspasosDelConjunto = traspasos && traspasos.tenantId === tenantId ? traspasos.valor : null;

  const tesoreria = useMemo(() => {
    if (!asientosDelConjunto || !cuentasDelConjunto || !saldosDelConjunto || !traspasosDelConjunto) return null;
    return saldosPorCuenta({
      cuentas: cuentasDelConjunto,
      saldosIniciales: saldosDelConjunto,
      asientos: asientosDelConjunto,
      cuotaIncome,
      traspasos: traspasosDelConjunto,
    });
  }, [asientosDelConjunto, cuentasDelConjunto, saldosDelConjunto, traspasosDelConjunto, cuotaIncome]);

  const cuentasActivas = useMemo(() => (cuentasDelConjunto ?? []).filter((c) => c.active !== false), [cuentasDelConjunto]);
  const nombreDe = useMemo(
    () => new Map((cuentasDelConjunto ?? []).map((c) => [c.id, c.label])),
    [cuentasDelConjunto],
  );
  const avisoNegativo = saldoNegativoTrasTraspaso(
    tesoreria?.cuentas.find((f) => f.id === form.fromAccountId),
    Number(form.amount),
  );

  function abrirFormulario() {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    setForm({ fromAccountId: "", toAccountId: "", amount: "", date: fecha, reference: "", detail: "" });
    setErrorForm(null);
    setFormAbierto(true);
  }

  async function guardarTraspaso() {
    if (!tenantId || !user?.uid) return;
    const problema = errorDeTraspaso(form, new Date());
    setErrorForm(problema);
    if (problema) return;
    setGuardando(true);
    try {
      await registrarTraspaso(tenantId, user.uid, {
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        amount: Math.round(Number(form.amount) * 100) / 100,
        date: form.date,
        reference: form.reference,
        detail: form.detail,
      });
      toast.success("Traspaso registrado");
      setFormAbierto(false);
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setGuardando(false);
    }
  }

  async function anular(id: string) {
    if (!user?.uid) return;
    try {
      await anularTraspaso(id, user.uid);
      toast.success("Traspaso anulado. Ya no cuenta en los saldos.");
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setConfirmarAnular(null);
    }
  }

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
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--slate-200)] text-left text-[var(--slate-600)]">
                      <th className="py-2 pr-4 font-medium">Cuenta</th>
                      <th className="py-2 pr-4 text-right font-medium">Saldo inicial</th>
                      <th className="py-2 pr-4 text-right font-medium">Entradas</th>
                      <th className="py-2 pr-4 text-right font-medium">Salidas</th>
                      <th className="py-2 pr-4 text-right font-medium">Traspasos</th>
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Traspasos</CardTitle>
                <CardDescription className="mt-1">
                  Dinero que pasa de una cuenta del conjunto a otra. Baja una y sube la otra en el
                  mismo importe: el saldo de fondos no cambia, y no cuenta como ingreso ni como gasto.
                </CardDescription>
              </div>
              {!formAbierto ? (
                <Button variant="outline" onClick={abrirFormulario} disabled={cuentasActivas.length < 2}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden />
                  Traspasar
                </Button>
              ) : null}
            </div>
            {cuentasActivas.length < 2 ? (
              <p className="mt-3 text-sm text-[var(--slate-600)]">
                Para traspasar hacen falta al menos dos cuentas activas. Este conjunto tiene{" "}
                {cuentasActivas.length === 1 ? "una" : "ninguna"}.
              </p>
            ) : null}

            {formAbierto ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Sale de</span>
                  <select
                    className="h-10 rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                    value={form.fromAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, fromAccountId: e.target.value }))}
                  >
                    <option value="">Elige la cuenta</option>
                    {cuentasActivas.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} · {c.bankName}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Entra en</span>
                  <select
                    className="h-10 rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                    value={form.toAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
                  >
                    <option value="">Elige la cuenta</option>
                    {cuentasActivas.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} · {c.bankName}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Valor</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Fecha</span>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Referencia del banco (opcional)</span>
                  <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-[var(--slate-900)]">Detalle (opcional)</span>
                  <Input value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} />
                </label>
                {avisoNegativo !== null ? (
                  <p className="text-sm text-[var(--warning-700)] sm:col-span-2">
                    Después del traspaso, {nombreDe.get(form.fromAccountId) ?? "la cuenta de origen"} quedaría en{" "}
                    {formatAmount(avisoNegativo)}. Se puede registrar igual: el saldo calculado puede estar incompleto.
                  </p>
                ) : null}
                {errorForm ? (
                  <p role="alert" className="text-sm text-[var(--danger-700)] sm:col-span-2">{errorForm}</p>
                ) : null}
                <div className="flex gap-2 sm:col-span-2">
                  <Button onClick={guardarTraspaso} disabled={guardando}>
                    {guardando ? "Registrando…" : "Registrar traspaso"}
                  </Button>
                  <Button variant="ghost" onClick={() => setFormAbierto(false)} disabled={guardando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : null}

            {traspasosDelConjunto && traspasosDelConjunto.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <tbody>
                    {traspasosDelConjunto.map((tr) => {
                      const anulado = tr.status === "anulado";
                      return (
                        <tr key={tr.id} className="border-b border-[var(--slate-100)]">
                          <td className="py-2 pr-4 tabular-nums text-[var(--slate-600)]">{tr.date}</td>
                          <td className={anulado ? "py-2 pr-4 text-[var(--slate-600)] line-through" : "py-2 pr-4 text-[var(--slate-900)]"}>
                            {nombreDe.get(tr.fromAccountId) ?? "Cuenta que ya no existe"} →{" "}
                            {nombreDe.get(tr.toAccountId) ?? "Cuenta que ya no existe"}
                            {tr.reference || tr.detail ? (
                              <span className="ml-2 text-[var(--slate-600)]">{[tr.reference, tr.detail].filter(Boolean).join(" · ")}</span>
                            ) : null}
                          </td>
                          <td className={anulado ? "py-2 pr-4 text-right tabular-nums text-[var(--slate-600)] line-through" : "py-2 pr-4 text-right tabular-nums text-[var(--slate-900)]"}>
                            {formatAmount(tr.amount)}
                          </td>
                          <td className="py-2 text-right">
                            {anulado ? (
                              <span className="text-[var(--slate-600)]">Anulado</span>
                            ) : confirmarAnular === tr.id ? (
                              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                                <span className="text-[var(--slate-600)]">Deja de contar en los dos saldos. ¿Anular?</span>
                                <Button variant="danger" onClick={() => anular(tr.id)}>Anular</Button>
                                <Button variant="ghost" onClick={() => setConfirmarAnular(null)}>No</Button>
                              </span>
                            ) : (
                              <Button variant="ghost" onClick={() => setConfirmarAnular(tr.id)}>Anular</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--slate-600)]">Todavía no hay traspasos.</p>
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
      <td className="py-2 pr-4 text-right tabular-nums text-[var(--slate-600)]">
        {fila.traspasos === 0 ? "—" : `${fila.traspasos > 0 ? "+" : "−"}${formatAmount(Math.abs(fila.traspasos))}`}
      </td>
      <td className="py-2 text-right font-semibold tabular-nums text-[var(--slate-900)]">{formatAmount(fila.saldo)}</td>
    </tr>
  );
}
