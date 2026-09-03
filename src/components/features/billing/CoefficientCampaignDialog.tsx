"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConjuntoActivoNota } from "@/components/shared/conjunto-activo-nota";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import {
  generateCoefficientCampaignCallable,
  type CoefficientCampaignLine,
} from "@/lib/firebase/callables";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useTenantVocabulary } from "@/features/tenant/use-tenant-vocabulary";
import { AYUDA, capitalizar } from "@/lib/config/vocabulario-pais";
import { HelpTip } from "@/components/shared/help-tip";
import { BILLING_CONCEPTS, billingConceptLabel } from "@/features/billing/use-billing-statements";

/**
 * Corrida por coeficiente (PRD-V-PLAT-001, tras `producto-cobro-por-coeficiente`).
 *
 * El flujo es en dos tiempos a propósito: **Calcular** pide la vista previa al
 * servidor (dryRun: nada se escribe) y **Generar** confirma con la MISMA
 * `operationKey` — así el doble clic no crea dos corridas, y cancelar en la
 * vista previa no deja ningún cargo (CA11). El reparto no se calcula aquí:
 * mostrar una aritmética y escribir otra es el defecto que FIN-001 corrigió en
 * pagos, y no se reintroduce en cobros.
 */
export function CoefficientCampaignDialog({
  open,
  tenantId,
  onClose,
  onCreated,
}: {
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { formatAmount } = useTenantCurrency();
  const vocab = useTenantVocabulary();
  const [total, setTotal] = useState("");
  const [concept, setConcept] = useState("administracion");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<{
    lines: CoefficientCampaignLine[];
    total: number;
    coefficientSum: number;
    operationKey: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPreview(null);
    setTotal("");
    setDueDate("");
    setBusy(false);
  }

  async function handlePreview() {
    const parsed = Number(total.replace(",", "."));
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Escribe el total a repartir.");
      return;
    }
    if (!period.match(/^\d{4}-\d{2}$/)) {
      toast.error("El período debe tener formato AAAA-MM.");
      return;
    }
    setBusy(true);
    try {
      const operationKey = `${tenantId}_${period}_${crypto.randomUUID()}`;
      const result = await generateCoefficientCampaignCallable({
        tenantId,
        totalAmount: parsed,
        period,
        concept,
        dueDate: dueDate || undefined,
        dryRun: true,
        operationKey,
      });
      setPreview({ lines: result.lines, total: result.total, coefficientSum: result.coefficientSum, operationKey });
    } catch (error) {
      // El servidor nombra la causa exacta: la suma descuadrada con su
      // diferencia, o las unidades sin coeficiente o sin responsable (R2/R4/R5).
      toast.error(error instanceof Error ? error.message : "No fue posible calcular el reparto.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!preview) return;
    setBusy(true);
    try {
      const parsed = Number(total.replace(",", "."));
      const result = await generateCoefficientCampaignCallable({
        tenantId,
        totalAmount: parsed,
        period,
        concept,
        dueDate: dueDate || undefined,
        operationKey: preview.operationKey,
      });
      toast.success(
        result.created === false
          ? "Esta corrida ya se había generado; no se duplicó."
          : `Corrida generada: ${result.lines.length} cuotas por ${formatAmount(result.total)}.`,
      );
      reset();
      onCreated();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar la corrida.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title=""
      header={
        <h3 className="inline-flex items-center gap-1.5 text-lg font-semibold text-[var(--slate-900)]">
          Generar cuotas por {vocab.coeficienteCorto}
          <HelpTip text={AYUDA.corridaPorCoeficiente} />
        </h3>
      }
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <p className="text-sm text-[var(--slate-600)]">
        Reparte un total entre las unidades activas según su {vocab.coeficiente}. Primero
        calcula la vista previa; nada se genera hasta que confirmes.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-[var(--slate-700)]">
          Total del período a repartir
          <Input className="mt-1" inputMode="decimal" value={total} onChange={(e) => { setTotal(e.target.value); setPreview(null); }} placeholder="Ej: 7722.00" />
        </label>
        <label className="text-sm text-[var(--slate-700)]">
          Concepto
          <select
            className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
            value={concept}
            onChange={(e) => { setConcept(e.target.value); setPreview(null); }}
          >
            {BILLING_CONCEPTS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--slate-700)]">
          Período (AAAA-MM)
          <Input className="mt-1" value={period} onChange={(e) => { setPeriod(e.target.value); setPreview(null); }} placeholder="2026-09" />
        </label>
        <label className="text-sm text-[var(--slate-700)]">
          Vencimiento (opcional)
          <Input className="mt-1" type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setPreview(null); }} />
        </label>
      </div>

      {preview ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-[var(--slate-900)]">
              Vista previa: {preview.lines.length} unidades · suma: {preview.coefficientSum.toFixed(6)}%
            </p>
            <p className="text-sm font-semibold text-[var(--slate-900)]">Total {formatAmount(preview.total)}</p>
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-[var(--slate-200)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--slate-50)] text-left text-xs text-[var(--slate-600)]">
                <tr>
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2 text-right">{capitalizar(vocab.coeficienteCorto)}</th>
                  <th className="px-3 py-2 text-right">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line) => (
                  <tr key={line.unitId} className="border-t border-[var(--slate-100)]">
                    <td className="px-3 py-1.5">{line.unitLabel}</td>
                    <td className="px-3 py-1.5 text-right">{line.coefficient.toFixed(6)}%</td>
                    <td className="px-3 py-1.5 text-right">
                      {formatAmount(line.amount)}
                      {line.roundingAdjustment > 0 ? (
                        <span className="ml-1 text-xs text-[var(--slate-500)]" title="Recibió el ajuste de redondeo (resto mayor)">*</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-[var(--slate-500)]">
            * unidades con el ajuste de redondeo: la suma de las cuotas es exactamente el total repartido.
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <ConjuntoActivoNota accion="Se generan las cuotas" />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }}>
          Cancelar
        </Button>
        {preview ? (
          <Button type="button" onClick={handleGenerate} disabled={busy}>
            {busy ? "Generando…" : `Generar ${preview.lines.length} cuotas`}
          </Button>
        ) : (
          <Button type="button" onClick={handlePreview} disabled={busy}>
            {busy ? "Calculando…" : "Calcular vista previa"}
          </Button>
        )}
      </div>
      <p className="mt-2 text-right text-xs text-[var(--slate-500)]">
        Concepto: {billingConceptLabel(concept)} · Los residentes NO son notificados por esta vía todavía.
      </p>
    </Modal>
  );
}
