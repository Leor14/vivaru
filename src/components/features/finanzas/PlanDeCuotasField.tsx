"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { explicarProblema, sumaDelPlan, validarPlan } from "@/features/finanzas/cuotas-del-egreso";

/**
 * `PRD-V-FLOW-008` — el editor del calendario de pagos de una factura.
 *
 * **Es lo que hoy se teclea a mano fuera del producto.** La administradora paga
 * la póliza del seguro en once cuotas y mete el cuadro de pagos entero en su
 * sistema; aquí lo mete en el nuestro.
 *
 * **Enseña la diferencia mientras se escribe, no al guardar.** Once filas es
 * bastante que teclear, y descubrir al final que faltan 11 pesos obliga a
 * revisarlas una a una. La misma validación corre en el esquema —el guardián de
 * verdad—, porque un plan que no cuadra descuadra la deuda del conjunto.
 */

export type CuotaEditable = { number: number; dueDate: string; amount: number };

/** Un mes después, respetando el fin de mes: del 31 de enero al 28 de febrero. */
function unMesDespues(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  // Día 0 del mes siguiente al siguiente = último día del mes siguiente. Es lo
  // que impide que «31 de enero + 1 mes» se desborde al 3 de marzo.
  const ultimoDelSiguiente = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const siguiente = new Date(Date.UTC(y, m, Math.min(d, ultimoDelSiguiente)));
  return siguiente.toISOString().slice(0, 10);
}

export function PlanDeCuotasField({
  cuotas,
  total,
  onChange,
  formatAmount,
  disabled,
}: {
  cuotas: CuotaEditable[] | undefined;
  total: number;
  onChange: (cuotas: CuotaEditable[] | undefined) => void;
  formatAmount: (n: number) => string;
  disabled?: boolean;
}) {
  const activo = Array.isArray(cuotas);
  const filas = cuotas ?? [];

  /** Renumera siempre desde 1: `RN-02` exige consecutivos y sin huecos, y quitar
   *  una fila de en medio los dejaría. Que el usuario no pueda equivocarse aquí
   *  es mejor que avisarle de que se equivocó. */
  const renumerar = (lista: CuotaEditable[]) => lista.map((c, i) => ({ ...c, number: i + 1 }));

  const problemas = activo && filas.length > 0
    ? validarPlan(filas.map((c) => ({ ...c, status: "pendiente" as const })), total)
    : [];
  const suma = sumaDelPlan(filas.map((c) => ({ ...c, status: "pendiente" as const })));

  return (
    <div className="rounded-xl border border-[var(--slate-200)] p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-[var(--slate-900)]">
        <input
          type="checkbox"
          checked={activo}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? [{ number: 1, dueDate: "", amount: total || 0 }]
                : undefined,
            )
          }
        />
        Esta factura se paga en cuotas
      </label>
      <p className="mt-1 text-xs text-[var(--slate-600)]">
        Cada cuota vence por su cuenta, y lo que se debe pasa a ser lo que falta por pagar.
      </p>

      {activo && (
        <>
          <div className="mt-3 space-y-2">
            {filas.map((c, i) => (
              <div key={i} className="flex items-end gap-2">
                <span className="w-8 pb-2 text-sm text-[var(--slate-500)]">{c.number}</span>
                <label className="flex-1 text-xs text-[var(--slate-600)]">
                  Vence
                  <Input
                    type="date"
                    value={c.dueDate}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...filas];
                      next[i] = { ...c, dueDate: e.target.value };
                      onChange(next);
                    }}
                  />
                </label>
                <label className="flex-1 text-xs text-[var(--slate-600)]">
                  Importe
                  <Input
                    type="number"
                    step="0.01"
                    value={Number.isFinite(c.amount) ? c.amount : ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...filas];
                      next[i] = { ...c, amount: Number(e.target.value) };
                      onChange(next);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  disabled={disabled || filas.length === 1}
                  aria-label={`Quitar la cuota ${c.number}`}
                  onClick={() => onChange(renumerar(filas.filter((_, j) => j !== i)))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            size="xs"
            variant="outline"
            className="mt-2"
            disabled={disabled}
            onClick={() => {
              const ultima = filas[filas.length - 1];
              onChange(
                renumerar([
                  ...filas,
                  // Se propone la fecha un mes después de la anterior y el mismo
                  // importe. **No es «generar el plan»** —eso está fuera de
                  // alcance y obligaría a decidir dónde cae el residuo—: es que
                  // teclear once filas no cueste once veces lo mismo.
                  { number: 0, dueDate: unMesDespues(ultima?.dueDate ?? ""), amount: ultima?.amount ?? 0 },
                ]),
              );
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Añadir cuota
          </Button>

          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--slate-100)] pt-2 text-sm">
            <span className="text-[var(--slate-600)]">
              {filas.length} {filas.length === 1 ? "cuota" : "cuotas"} · suman{" "}
              <strong className="text-[var(--slate-900)]">{formatAmount(suma)}</strong>
            </span>
            <span className="text-[var(--slate-600)]">
              Factura: <strong className="text-[var(--slate-900)]">{formatAmount(total || 0)}</strong>
            </span>
          </div>

          {problemas.length > 0 && (
            <ul className="mt-2 space-y-1">
              {problemas.map((p, i) => (
                <li key={i} className="text-xs text-[var(--mapa-rojo-texto-1)]">
                  {explicarProblema(p, formatAmount)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
