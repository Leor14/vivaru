"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { billConsumptionPeriodCallable, type BillConsumptionResult } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-FEAT-008` entrega 2 · cobrar el consumo del período.
 *
 * **En dos tiempos, como la corrida por coeficiente:** al abrir se pide la vista
 * previa —`dryRun`, no escribe nada— y solo el botón de confirmar cobra. Esto
 * crea cargos de dinero sobre veintitantas unidades de golpe, y lo que hay que
 * poder mirar antes no es solo el total: es **a quién NO se le va a cobrar**.
 *
 * Esa lista se enseña **arriba y en ámbar**, no escondida al final. Una unidad
 * sin lectura no aparece en la corrida, y si nadie la mira se queda un mes sin
 * cobrar sin que salte ninguna alarma.
 */
export function CobrarConsumoDialog({
  open,
  onClose,
  tenantId,
  serviceId,
  period,
  onCobrado,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  serviceId: string;
  period: string;
  onCobrado: () => void;
}) {
  const { formatAmount } = useTenantCurrency();
  const [previa, setPrevia] = useState<BillConsumptionResult | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vence, setVence] = useState("");

  const pedirPrevia = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPrevia(await billConsumptionPeriodCallable({ tenantId, serviceId, period, dryRun: true }));
    } catch (e) {
      // El servidor deniega **nombrando** lo que falta —las fotos, las unidades
      // sin lectura—. Ese mensaje se enseña tal cual dentro del diálogo, no como
      // un aviso que se va: es lo que dice qué hay que arreglar.
      setError(e instanceof Error ? e.message : "No fue posible calcular el reparto.");
      setPrevia(null);
    } finally {
      setCargando(false);
    }
  }, [tenantId, serviceId, period]);

  useEffect(() => {
    if (open) void pedirPrevia();
    else {
      setPrevia(null);
      setError(null);
      setVence("");
    }
  }, [open, pedirPrevia]);

  async function cobrar() {
    setCobrando(true);
    try {
      const r = await billConsumptionPeriodCallable({
        tenantId,
        serviceId,
        period,
        dueDate: vence || undefined,
      });
      if (r.created === false) {
        // Un segundo clic. No se cobró dos veces, y se dice en vez de fingir que
        // acaba de pasar algo.
        toast.info("Este período ya estaba cobrado. No se generaron cargos nuevos.");
      } else {
        toast.success(
          `${r.lines.length} ${r.lines.length === 1 ? "cargo generado" : "cargos generados"} por ${formatAmount(r.total)}.`,
        );
      }
      onCobrado();
      onClose();
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setCobrando(false);
    }
  }

  return (
    <Modal
      open={open}
      title=""
      header={
        <h3 className="text-lg font-semibold text-[var(--slate-900)]">
          Cobrar el consumo de {period}
        </h3>
      }
      onClose={onClose}
    >
      <p className="text-sm text-[var(--slate-600)]">
        Cada unidad se cobra por lo que consumió. Esto es la vista previa: nada se
        genera hasta que confirmes.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-[var(--danger-300)] bg-[var(--danger-50)] p-3 text-sm text-[var(--danger-700)]">
          {error}
        </div>
      ) : null}

      {cargando ? (
        <p className="mt-4 text-sm text-[var(--slate-600)]">Calculando el reparto…</p>
      ) : null}

      {previa ? (
        <>
          {previa.sinLectura.length > 0 ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-[var(--warning-300)] bg-[var(--warning-50)] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[var(--warning-700)]" />
              <div className="text-sm text-[var(--warning-800)]">
                <b>
                  {previa.sinLectura.length}{" "}
                  {previa.sinLectura.length === 1 ? "unidad no tiene lectura" : "unidades no tienen lectura"}
                </b>{" "}
                y no se les va a cobrar este mes: {previa.sinLectura.join(", ")}.
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-[var(--slate-600)]">
            <span>
              <b className="tabular-nums text-[var(--slate-900)]">{previa.lines.length}</b>{" "}
              {previa.lines.length === 1 ? "unidad" : "unidades"} con consumo
            </span>
            <span>
              Total <b className="tabular-nums text-[var(--slate-900)]">{formatAmount(previa.total)}</b>
            </span>
            <span className="text-[var(--slate-500)]">
              a {formatAmount(previa.rate)} por unidad de medida
            </span>
          </div>

          <label className="mt-4 block text-sm text-[var(--slate-700)]">
            Vence el <span className="text-[var(--slate-500)]">(opcional)</span>
            <Input
              type="date"
              className="mt-1 w-48"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
            />
          </label>

          <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-[var(--slate-200)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-strong)]">
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--slate-600)]">
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2 text-right">Consumo</th>
                  <th className="px-3 py-2 text-right">Se le cobra</th>
                </tr>
              </thead>
              <tbody>
                {previa.lines.map((l) => (
                  <tr key={l.unitId} className="border-t border-[var(--slate-100)]">
                    <td className="px-3 py-2 text-[var(--slate-900)]">{l.unitLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--slate-600)]">{l.consumption}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--slate-900)]">
                      {formatAmount(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void cobrar()}
          disabled={!previa || previa.lines.length === 0 || cobrando || cargando}
        >
          {cobrando
            ? "Cobrando…"
            : previa
              ? `Cobrar ${previa.lines.length} ${previa.lines.length === 1 ? "unidad" : "unidades"}`
              : "Cobrar"}
        </Button>
      </div>
      <p className="mt-2 text-right text-xs text-[var(--slate-500)]">
        Los cargos salen en Cartera. Al cobrar, las lecturas de este período quedan
        selladas y ya no se editan.
      </p>
    </Modal>
  );
}
