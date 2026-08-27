"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConjuntoActivoNota } from "@/components/shared/conjunto-activo-nota";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import {
  cancelDistributionCallable,
  distributeExpenseCallable,
  type DistributeExpenseResult,
} from "@/lib/firebase/callables";
import { useTenantVocabulary } from "@/features/tenant/use-tenant-vocabulary";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BillingConcept, Expense } from "@/types/domain";

/**
 * `PRD-V-FLOW-001` — repartir un egreso entre las unidades.
 *
 * **La vista previa NO la calcula esta pantalla.** La sirve la misma callable
 * que acaba creando los cargos, con `dryRun` (§11.1). Si el navegador hiciera
 * la aritmética, la previa y lo creado podrían diferir sin que nadie se
 * enterara — y además un cliente manipulado emitiría los importes que quisiera.
 * Aquí solo se elige QUÉ y CON QUÉ concepto.
 *
 * **La previa se pide al abrir, no al pulsar un botón.** Los tres motivos por
 * los que un reparto no se puede hacer —la base no cuadra, hay una unidad sin
 * coeficiente, el egreso está anulado— **son del conjunto, no de lo que el
 * administrador teclee aquí**. Enseñárselos después de rellenar el formulario
 * sería hacerle trabajar para nada.
 */

const CONCEPTOS: { value: BillingConcept; label: string }[] = [
  { value: "extraordinaria", label: "Cuota extraordinaria" },
  { value: "reparacion", label: "Reparación" },
  { value: "administracion", label: "Administración" },
  { value: "multa", label: "Multa" },
  { value: "parqueadero", label: "Parqueadero" },
  { value: "vigilancia", label: "Vigilancia" },
  { value: "interes_mora", label: "Interés de mora" },
];

const RELACIONES = [
  { value: "responsible", label: "Responsable de cobro" },
  { value: "owner", label: "Propietario" },
  { value: "tenant", label: "Inquilino" },
] as const;

function mesDe(fecha?: string) {
  return fecha && fecha.length >= 7 ? fecha.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

export function RepartirEgresoModal({
  open,
  expense,
  tenantId,
  formatAmount,
  onClose,
}: {
  open: boolean;
  expense: Expense | null;
  tenantId: string;
  formatAmount: (value: number) => string;
  onClose: () => void;
}) {
  /**
   * **La columna de la base se llama distinto en cada país** —«coeficiente» en
   * Colombia, «alícuota» en Ecuador, «indiviso» en México— y quien mira esta
   * pantalla es el ADMINISTRADOR, que usa el término de su ley. El servidor ya
   * redacta sus errores con la misma palabra (`terminoCoeficiente`); dejarla
   * fija aquí las haría discrepar dentro del mismo diálogo.
   */
  const { coeficienteCorto } = useTenantVocabulary();
  const [concept, setConcept] = useState<BillingConcept>("extraordinaria");
  const [payerRelation, setPayerRelation] = useState<(typeof RELACIONES)[number]["value"]>("responsible");
  const [period, setPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [previa, setPrevia] = useState<DistributeExpenseResult | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);

  /**
   * **La clave de idempotencia se fija al ABRIR, no en cada envío.** Es lo único
   * que hace que un doble clic —o un reintento de red— no cree dos corridas de
   * decenas de cargos cada una. Generarla en el envío la haría distinta cada vez
   * y la idempotencia no serviría de nada.
   */
  const operationKey = useRef<string>("");

  useEffect(() => {
    if (!open || !expense) return;
    operationKey.current = `exp-${expense.id}-${crypto.randomUUID()}`;
    setConcept("extraordinaria");
    setPayerRelation("responsible");
    setPeriod(mesDe(expense.issueDate));
    setDueDate("");
    setPrevia(null);
    setBloqueo(null);
    setMotivo("");
  }, [open, expense]);

  const pedirPrevia = useCallback(async () => {
    if (!expense) return;
    setCargando(true);
    setBloqueo(null);
    try {
      const r = await distributeExpenseCallable({
        tenantId,
        expenseId: expense.id,
        period: mesDe(expense.issueDate),
        dryRun: true,
        operationKey: operationKey.current,
      });
      setPrevia(r);
    } catch (error) {
      // El servidor nombra la unidad que falta o dice cuánto suma la base. Ese
      // texto es la respuesta útil: no se sustituye por uno genérico.
      setPrevia(null);
      setBloqueo(error instanceof Error ? error.message : "No fue posible calcular el reparto.");
    } finally {
      setCargando(false);
    }
  }, [expense, tenantId]);

  useEffect(() => {
    if (open && expense) void pedirPrevia();
  }, [open, expense, pedirPrevia]);

  const suma = useMemo(() => (previa ? previa.lines.reduce((a, l) => a + l.amount, 0) : 0), [previa]);
  const conResiduo = useMemo(
    () => (previa ? previa.lines.filter((l) => l.roundingAdjustment > 0).length : 0),
    [previa],
  );

  async function confirmar() {
    if (!expense || !previa) return;
    setGuardando(true);
    try {
      const r = await distributeExpenseCallable({
        tenantId,
        expenseId: expense.id,
        period,
        concept,
        payerRelation,
        dueDate: dueDate || undefined,
        confirmarRepetido: previa.yaRepartido.length > 0,
        operationKey: operationKey.current,
      });
      toast.success(
        r.created
          ? `Repartido entre ${r.lines.length} unidades por ${formatAmount(r.total)}.`
          : "Este reparto ya estaba hecho.",
      );
      onClose();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setGuardando(false);
    }
  }

  async function anular(campaignId: string) {
    if (!motivo.trim()) {
      toast.error("Anular exige un motivo.");
      return;
    }
    setAnulando(campaignId);
    try {
      const r = await cancelDistributionCallable({ tenantId, campaignId, reason: motivo.trim() });
      toast.success(
        r.alreadyCancelled ? "Esa corrida ya estaba anulada." : `Anulados ${r.cancelled} cargos.`,
      );
      setMotivo("");
      await pedirPrevia();
    } catch (error) {
      // R7 · el servidor nombra las unidades con pago. Ese texto es el valor.
      toastFirebaseError(error);
    } finally {
      setAnulando(null);
    }
  }

  if (!expense) return null;

  return (
    <Modal open={open} title="Repartir entre unidades" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-sm font-medium text-[var(--slate-900)]">{expense.description}</p>
          <p className="mt-0.5 text-xs text-[var(--slate-500)]">
            {expense.vendorName ? `${expense.vendorName} · ` : ""}
            {formatAmount(expense.amount)}
          </p>
        </div>

        {cargando && !previa && !bloqueo ? (
          // **Sin esto el diálogo se abre en blanco durante unos segundos** y el
          // botón dice «Repartir entre 0 unidades», que se lee como «este
          // conjunto no tiene unidades». Visto en staging el 25 de agosto de
          // 2026: la previa la sirve el servidor y tarda lo que tarda; lo que
          // no puede es parecer una respuesta.
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-2/3 animate-pulse rounded-sm bg-[var(--slate-100)]" />
            <div className="h-24 animate-pulse rounded-xl bg-[var(--slate-100)]" />
            <p className="text-xs text-[var(--slate-500)]">Calculando el reparto…</p>
          </div>
        ) : null}

        {bloqueo ? (
          <div className="flex gap-2 rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger-700)]" />
            <div>
              <p className="text-sm font-medium text-[var(--danger-700)]">No se puede repartir todavía</p>
              <p className="mt-0.5 text-xs text-[var(--danger-700)]">{bloqueo}</p>
            </div>
          </div>
        ) : null}

        {previa?.avisoDobleCobro ? (
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-amber-800">Este gasto suele estar cubierto por la cuota</p>
              {/* Avisa, no bloquea: hay conjuntos que cobran cuota base baja y
                  reparten lo demás, y eso lo decide su asamblea. */}
              <p className="mt-0.5 text-xs text-amber-800">
                Es un gasto ordinario. Si la cuota de administración ya lo cubre, repartirlo aparte lo cobraría
                dos veces. Puedes continuar.
              </p>
            </div>
          </div>
        ) : null}

        {previa && previa.yaRepartido.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">
              Este egreso ya se repartió ({previa.yaRepartido.length}{" "}
              {previa.yaRepartido.length === 1 ? "corrida" : "corridas"})
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Puedes repartirlo otra vez —los cargos se suman a los que ya existen— o anular la corrida
              anterior. Anular exige un motivo y no toca ningún cargo que ya tenga pagos.
            </p>
            <Input
              className="mt-2"
              placeholder="Motivo de la anulación"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {previa.yaRepartido.map((id) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  disabled={anulando !== null || !motivo.trim()}
                  onClick={() => void anular(id)}
                >
                  {anulando === id ? "Anulando…" : "Anular la corrida anterior"}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {previa ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[var(--slate-700)]">
                Concepto del cargo
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 text-sm"
                  value={concept}
                  onChange={(event) => setConcept(event.target.value as BillingConcept)}
                >
                  {CONCEPTOS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Se le cobra a
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 text-sm"
                  value={payerRelation}
                  onChange={(event) => setPayerRelation(event.target.value as typeof payerRelation)}
                >
                  {RELACIONES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Período
                <Input
                  className="mt-1"
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                />
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Vencimiento (opcional)
                <Input
                  className="mt-1"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--slate-200)]">
              <table className="w-full min-w-[380px] text-sm">
                <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wide text-[var(--slate-500)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Unidad</th>
                    <th className="px-3 py-2 text-right font-medium">{coeficienteCorto}</th>
                    <th className="px-3 py-2 text-right font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.lines.map((l) => (
                    <tr key={l.unitId} className="border-t border-[var(--slate-200)]">
                      <td className="px-3 py-2 text-[var(--slate-900)]">{l.unitLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--slate-500)]">
                        {l.coefficient}%
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--slate-900)]">
                        {formatAmount(l.amount)}
                        {/* El residuo se enseña. Si no, dos unidades con el mismo
                            coeficiente pagan distinto y nadie sabe por qué. */}
                        {l.roundingAdjustment > 0 ? (
                          <span className="ml-1 text-xs text-[var(--slate-500)]">+ residuo</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[var(--slate-200)] bg-[var(--surface-soft)]">
                  <tr>
                    <td className="px-3 py-2 font-medium text-[var(--slate-900)]" colSpan={2}>
                      Total repartido
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-[var(--slate-900)]">
                      {formatAmount(suma)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex gap-2 text-xs text-[var(--slate-500)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                {previa.lines.length} unidades activas · base {previa.coefficientSum.toFixed(6)}%
                {conResiduo > 0
                  ? ` · el residuo del redondeo se repartió entre ${conResiduo} ${conResiduo === 1 ? "unidad" : "unidades"}`
                  : ""}
                . Repartir no crea ningún movimiento del libro: el egreso ya tiene el suyo.
              </p>
            </div>
          </>
        ) : null}

        <ConjuntoActivoNota accion="Se reparte" />

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={!previa || cargando || guardando} onClick={() => void confirmar()}>
            {guardando
              ? "Repartiendo…"
              : previa
                ? `Repartir entre ${previa.lines.length} unidades`
                : "Repartir entre unidades"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
