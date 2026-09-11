"use client";

import { useState } from "react";
import { Ban, CheckCircle2, CircleSlash } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { cuentasDeSalida } from "@/features/finanzas/cuentas-de-salida";
import { capitalizar } from "@/lib/config/vocabulario-pais";
import {
  payExpenseInstallmentCallable,
  voidExpenseInstallmentCallable,
} from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, Expense, PettyCashFund } from "@/types/domain";
import { toDateInputValue } from "@/utils/datetimeValidation";

/**
 * `PRD-V-FLOW-008` entrega 2 — pagar y anular las cuotas de una factura.
 *
 * **Aquí no se escribe ni un campo de la cuota.** Todo va por callable: pagar
 * mueve dinero, crea el asiento del libro y sella `paidAmount` y el estado del
 * egreso. Esta pantalla pide y enseña; el servidor decide.
 *
 * **Ni el importe ni el estado resultante viajan desde aquí**, a propósito: si lo
 * hicieran, bajar la deuda del conjunto sería editar un número.
 *
 * **Y de dónde sale el dinero, sí** (`PRD-V-FEAT-010`, 11 sep 2026). El panel no mandaba
 * cuenta, así que toda cuota pagada quedaba «sin cuenta» en la tesorería mientras el egreso
 * normal sí la elegía. Ofrece lo mismo que «Sale de» en el formulario (`cuentasDeSalida`), y el
 * servidor lo vuelve a comprobar (`comprobarCuentaDeSalida`).
 */

// Local, no UTC: por la tarde en México la cuota se proponía pagada mañana.
const hoy = () => toDateInputValue(new Date());

export function CuotasDelEgresoPanel({
  egreso,
  formatAmount,
  salida,
}: {
  egreso: Expense;
  formatAmount: (n: number) => string;
  /**
   * De qué cuentas y cajas puede salir el pago, y cómo se llama la caja en el país del
   * conjunto. `null` con la tesorería apagada: sin selector y sin cuenta, como antes.
   */
  salida: { bancos: BankAccount[]; cajas: PettyCashFund[]; cajaChica: string } | null;
}) {
  const cuotas = egreso.installments ?? [];
  const [ocupada, setOcupada] = useState<number | null>(null);
  const [pagando, setPagando] = useState<number | null>(null);
  const [fecha, setFecha] = useState(hoy());
  const [cuenta, setCuenta] = useState("");
  const [anulando, setAnulando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");

  if (cuotas.length === 0) return null;

  const pagadas = cuotas.filter((c) => c.status === "pagada");
  const vivas = cuotas.filter((c) => c.status === "pendiente");
  const debe = vivas.reduce((a, c) => a + c.amount, 0);
  const cerrado = egreso.status === "anulado";
  // Un pago nuevo: sin «la que ya lleva», solo lo activo y lo abierto.
  const opciones = salida ? { ...cuentasDeSalida(salida.bancos, salida.cajas), cajaChica: salida.cajaChica } : null;

  async function conAviso(n: number, accion: () => Promise<void>) {
    setOcupada(n);
    try {
      await accion();
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--slate-900)]">
          Plan de pagos · {cuotas.length} {cuotas.length === 1 ? "cuota" : "cuotas"}
        </p>
        <p className="text-sm text-[var(--slate-600)]">
          Pagado <strong className="text-[var(--slate-900)]">{formatAmount(egreso.paidAmount ?? 0)}</strong>
          {" · "}
          {/* Lo que se debe son las cuotas VIVAS, no «total − pagado»: una cuota
              anulada dejó de deberse aunque nadie la pagara. */}
          debe <strong className="text-[var(--slate-900)]">{formatAmount(debe)}</strong>
        </p>
      </div>

      <ul className="mt-3 divide-y divide-[var(--slate-100)]">
        {cuotas.map((c) => (
          <li key={c.number} className="py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm">
                <span className="w-6 text-[var(--slate-500)]">{c.number}</span>
                <span className="text-[var(--slate-700)]">{c.dueDate}</span>
                <strong className="text-[var(--slate-900)]">{formatAmount(c.amount)}</strong>
                <StatusBadge status={c.status} />
              </span>

              {c.status === "pendiente" && !cerrado && (
                <span className="flex gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={ocupada !== null}
                    onClick={() => {
                      setPagando(pagando === c.number ? null : c.number);
                      setAnulando(null);
                      setFecha(hoy());
                      setCuenta("");
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Pagar
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={ocupada !== null}
                    onClick={() => {
                      setAnulando(anulando === c.number ? null : c.number);
                      setPagando(null);
                      setMotivo("");
                    }}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Anular
                  </Button>
                </span>
              )}
              {c.status === "pagada" && (
                <span className="text-xs text-[var(--slate-500)]">Pagada el {c.paidAt}</span>
              )}
              {c.status === "anulada" && c.voidReason && (
                <span className="flex items-center gap-1 text-xs text-[var(--slate-500)]">
                  <CircleSlash className="h-3 w-3" />
                  {c.voidReason}
                </span>
              )}
            </div>

            {pagando === c.number && (
              <div className="mt-2 rounded-lg bg-[var(--slate-100)] p-3">
                <label className="text-xs text-[var(--slate-700)]">
                  Fecha del pago
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </label>
                {opciones ? (
                  <label className="mt-2 block text-xs text-[var(--slate-700)]">
                    Sale de
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                      value={cuenta}
                      onChange={(e) => setCuenta(e.target.value)}
                    >
                      <option value="">Sin indicar</option>
                      {opciones.bancos.length > 0 ? (
                        <optgroup label="Cuentas bancarias">
                          {opciones.bancos.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label} · {b.bankName}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {opciones.cajas.length > 0 ? (
                        <optgroup label={capitalizar(opciones.cajaChica)}>
                          {opciones.cajas.map((caja) => (
                            <option key={caja.id} value={caja.id}>
                              {caja.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                    <span className="mt-1 block text-xs text-[var(--slate-600)]">
                      La cuenta o la {opciones.cajaChica} de la que salió el dinero. Con ella, Tesorería sabe qué saldo baja.
                    </span>
                  </label>
                ) : null}
                <p className="mt-1 text-xs text-[var(--slate-600)]">
                  Se registrará un movimiento en el libro por {formatAmount(c.amount)} con esta fecha.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="xs"
                    disabled={ocupada !== null || !fecha}
                    onClick={() =>
                      conAviso(c.number, async () => {
                        const r = await payExpenseInstallmentCallable({
                          tenantId: egreso.tenantId,
                          expenseId: egreso.id,
                          installmentNumber: c.number,
                          paidAt: fecha,
                          bankAccountId: cuenta || undefined,
                        });
                        setPagando(null);
                        toast.success(
                          r.expenseStatus === "pagado"
                            ? "Cuota pagada. La factura queda saldada."
                            : "Cuota pagada.",
                        );
                      })
                    }
                  >
                    Registrar el pago
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setPagando(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {anulando === c.number && (
              <div className="mt-2 rounded-lg bg-[var(--slate-100)] p-3">
                <label className="text-xs font-medium text-[var(--slate-900)]">
                  Motivo de la anulación
                </label>
                <p className="mt-0.5 text-xs text-[var(--slate-600)]">
                  Queda escrito en la cuota. Una cuota anulada deja de deberse y no se paga.
                </p>
                <Textarea className="mt-1" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="xs"
                    variant="danger"
                    /* El servidor lo exige igual (`RN-13`); esto evita el viaje. */
                    disabled={ocupada !== null || motivo.trim().length === 0}
                    onClick={() =>
                      conAviso(c.number, async () => {
                        await voidExpenseInstallmentCallable({
                          tenantId: egreso.tenantId,
                          expenseId: egreso.id,
                          installmentNumber: c.number,
                          reason: motivo,
                        });
                        setAnulando(null);
                        setMotivo("");
                        toast.success("Cuota anulada.");
                      })
                    }
                  >
                    Anular la cuota
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setAnulando(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {pagadas.length > 0 && cerrado && (
        <p className="mt-2 text-xs text-[var(--slate-600)]">
          Este egreso está anulado. Las {pagadas.length} cuotas ya pagadas se conservan con su
          movimiento en el libro: anular no borra dinero que ya salió.
        </p>
      )}
    </div>
  );
}
