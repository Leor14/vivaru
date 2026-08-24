"use client";

import { useMemo } from "react";
import { PiggyBank } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { crucesVigentes, saldoAFavor, useAdvances } from "@/features/finanzas/use-advances";

/**
 * `PRD-V-FLOW-002` CA2 — **el saldo a favor, en el portal del residente.**
 *
 * No se esconde detrás de la bandera. Con `producto-anticipos` apagada no nace
 * ninguno nuevo, pero los que ya existen siguen siendo dinero de esta persona:
 * apagar un interruptor no puede hacer desaparecer su saldo de su propia
 * pantalla. Cuando no hay ninguno, la tarjeta no se pinta — que es toda la
 * producción de hoy.
 *
 * **Y dice de dónde viene.** «Tienes 60.000 a favor» sin más invita a la llamada
 * que esto venía a evitar: la pregunta siguiente es siempre «¿de qué pago?».
 */
export function ResidentAdvancesCard({
  tenantId,
  unitId,
  formatAmount,
}: {
  tenantId?: string;
  unitId?: string;
  formatAmount: (value: number) => string;
}) {
  const { items, aplicaciones } = useAdvances(tenantId, unitId);

  const abiertos = useMemo(() => items.filter((a) => a.status === "open" && a.remaining > 0), [items]);
  const total = useMemo(() => saldoAFavor(items, unitId), [items, unitId]);

  if (!tenantId || !unitId || abiertos.length === 0) return null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <CardTitle>Tienes {formatAmount(total)} a favor</CardTitle>
          <CardDescription className="mt-1">
            Es dinero tuyo que ya pagaste y todavía no se ha aplicado a ninguna cuota. Se descuenta de lo próximo que
            debas; no hace falta que hagas nada.
          </CardDescription>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {abiertos.map((anticipo) => {
          const cruces = crucesVigentes(aplicaciones, anticipo.id);
          return (
            <li
              key={anticipo.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--slate-600)]">
                {anticipo.origin === "overpayment" ? "Del pago del" : "Registrado el"} {anticipo.date}
                {/* Si ya se usó una parte, se dice: si no, el residente ve un
                    número menor que el que recuerda haber pagado de más y no
                    tiene forma de saber a dónde fue la diferencia. */}
                {cruces.length > 0 ? (
                  <span className="ml-1 text-xs text-[var(--slate-500)]">
                    · ya se aplicaron {formatAmount(anticipo.amount - anticipo.remaining)} a cuotas anteriores
                  </span>
                ) : null}
              </span>
              <span className="font-semibold text-emerald-700">{formatAmount(anticipo.remaining)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
