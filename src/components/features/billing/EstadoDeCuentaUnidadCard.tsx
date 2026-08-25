"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { construirEstadoDeCuenta } from "@/features/billing/estado-de-cuenta";
import { renderEstadoDeCuentaPdf } from "@/features/finanzas/comprobante/estado-de-cuenta-pdf";
import { renderPazYSalvoPdf } from "@/features/finanzas/comprobante/paz-y-salvo-pdf";
import { saldoAFavor, useAdvances } from "@/features/finanzas/use-advances";
import { emitClearanceCertificateCallable } from "@/lib/firebase/callables";
import type { BillingStatement } from "@/types/domain";

/**
 * `PRD-V-FEAT-004` — el estado de cuenta de una unidad, del lado del
 * administrador.
 *
 * **Va en una tarjeta propia y no dentro de la tabla de cartera** porque son dos
 * lecturas distintas: la tabla responde «quién debe», y esto responde «qué le ha
 * pasado a esta unidad». Meterlo como acción de fila obligaría a elegir una fila
 * —un cobro— para preguntar por otra cosa —una unidad—.
 *
 * **El cálculo es el mismo que ve el residente**, literalmente la misma función.
 * Si el administrador y el residente pudieran ver saldos distintos del mismo
 * cargo, la llamada la recibe el administrador y no tiene con qué responder.
 */
export function EstadoDeCuentaUnidadCard({
  tenantId,
  tenantName,
  items,
  formatAmount,
}: {
  tenantId?: string;
  tenantName?: string;
  /** Todos los cobros del conjunto; aquí se filtran por unidad. */
  items: BillingStatement[];
  formatAmount: (value: number) => string;
}) {
  const [unitId, setUnitId] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const { items: anticipos } = useAdvances(tenantId, unitId || undefined);

  const unidades = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of items) if (s.unitId) map.set(s.unitId, s.unitLabel || s.unitId);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es-CO"));
  }, [items]);

  const deLaUnidad = useMemo(() => items.filter((s) => s.unitId === unitId), [items, unitId]);
  const estado = useMemo(() => construirEstadoDeCuenta(deLaUnidad), [deLaUnidad]);
  const etiqueta = unidades.find(([id]) => id === unitId)?.[1] ?? unitId;
  const aFavor = saldoAFavor(anticipos, unitId || undefined);

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function descargar() {
    setDescargando(true);
    try {
      await renderEstadoDeCuentaPdf(
        estado,
        { conjunto: tenantName ?? "", unidad: etiqueta, emitidoEl: hoy(), saldoAFavor: aFavor },
        formatAmount,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el estado de cuenta.");
    } finally {
      setDescargando(false);
    }
  }

  async function emitir() {
    if (!tenantId || !unitId) return;
    setEmitiendo(true);
    try {
      const issueDate = hoy();
      const r = await emitClearanceCertificateCallable({
        tenantId,
        unitId,
        unitLabel: etiqueta,
        issueDate,
        // Misma clave que usa el residente: **una emisión por unidad y día**. Si
        // el administrador y el residente usaran claves distintas, pedirlo los
        // dos el mismo día crearía dos certificados del mismo hecho, con códigos
        // distintos y los dos válidos.
        operationKey: `pys-${unitId}-${issueDate}`,
      });
      await renderPazYSalvoPdf(
        {
          code: r.code,
          unidad: etiqueta,
          conjunto: tenantName ?? "",
          asOfDate: issueDate,
          issuedAt: issueDate,
          creditBalance: r.creditBalance,
        },
        formatAmount,
      );
      toast.success(r.created ? `Paz y salvo emitido: ${r.code}` : `Ya había uno de hoy: ${r.code}`);
    } catch (error) {
      // El servidor dice cuánto debe y desde cuándo. Se enseña tal cual.
      toast.error(error instanceof Error ? error.message : "No fue posible emitir el paz y salvo.");
    } finally {
      setEmitiendo(false);
    }
  }

  return (
    <Card className="p-4">
      <CardTitle>Estado de cuenta de una unidad</CardTitle>
      <CardDescription>
        El movimiento completo de la unidad y, si está al día, su certificado de paz y salvo.
      </CardDescription>

      <label className="mt-3 block text-sm text-[var(--slate-700)]">
        Unidad
        <select
          className="mt-1 h-10 w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 text-sm sm:max-w-xs"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
        >
          <option value="">Selecciona una unidad</option>
          {unidades.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {unitId ? (
        <>
          <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wide text-[var(--slate-500)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Período</th>
                  <th className="px-3 py-2 text-left font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">Cargo</th>
                  <th className="px-3 py-2 text-right font-medium">Pagado</th>
                  <th className="px-3 py-2 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {estado.lineas.map((l) => (
                  <tr key={l.statementId} className="border-t border-[var(--slate-200)]">
                    <td className="px-3 py-2 text-[var(--slate-900)]">{l.periodo}</td>
                    <td className="px-3 py-2 text-[var(--slate-500)]">{l.concepto}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatAmount(l.cargo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--slate-500)]">
                      {l.pagado > 0 ? formatAmount(l.pagado) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatAmount(l.saldoAcumulado)}
                    </td>
                  </tr>
                ))}
                {estado.lineas.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[var(--slate-500)]" colSpan={5}>
                      Esta unidad no tiene movimientos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="text-[var(--slate-600)]">
              Saldo pendiente:{" "}
              <span className="font-semibold text-[var(--slate-900)]">{formatAmount(estado.saldoFinal)}</span>
              {aFavor > 0 ? <> · a favor: <span className="font-medium">{formatAmount(aFavor)}</span></> : null}
              {estado.anuladosExcluidos > 0 ? (
                <> · {estado.anuladosExcluidos} cargo(s) anulado(s) fuera</>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={descargando} onClick={() => void descargar()}>
                {descargando ? "Generando…" : "Descargar estado de cuenta"}
              </Button>
              {/* El botón se ofrece con saldo o sin él: la condición la decide el
                  servidor y su «no» dice cuánto se debe y desde cuándo, que es
                  más útil que un botón apagado sin explicación. */}
              <Button type="button" disabled={emitiendo} onClick={() => void emitir()}>
                {emitiendo ? "Emitiendo…" : "Paz y salvo"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}
