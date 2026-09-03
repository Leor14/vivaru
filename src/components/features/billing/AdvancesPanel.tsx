"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Undo2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/features/finanzas/stat-tile";
import { deudaDelCargo, ordenarParaMostrar } from "@/features/billing/reparto";
import {
  applyAdvanceCallable,
  cancelAdvanceCallable,
  crucesVigentes,
  saldoAFavor,
  undoAdvanceApplicationCallable,
  useAdvances,
} from "@/features/finanzas/use-advances";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { Advance, AdvanceApplication, BillingStatement } from "@/types/domain";

/**
 * `PRD-V-FLOW-002` — **la vista de anticipos, que es la herramienta de G5.**
 *
 * No es un listado informativo. Un anticipo `open` que nadie cruza es dinero de
 * un residente parado dentro del conjunto, y **sin esta pantalla nadie se
 * entera de que existe**: el sobrante deja de evaporarse (D-A) pero se queda
 * quieto, que es un defecto más silencioso que el anterior. Por eso lo primero
 * que se ve es cuánto hay sin aplicar y de quién.
 *
 * Escribir pasa siempre por callable (§11.1): las reglas no dejan al cliente
 * tocar `advances` ni `advanceApplications`. Aquí solo se lee y se pide.
 */

type Props = {
  tenantId?: string;
  /** Los cargos del conjunto, para poder cruzar contra ellos. */
  statements: BillingStatement[];
  formatAmount: (value: number) => string;
};

const ETIQUETA_ESTADO: Record<Advance["status"], string> = {
  open: "Con saldo",
  applied: "Aplicado",
  cancelled: "Anulado",
};

const ETIQUETA_ORIGEN: Record<Advance["origin"], string> = {
  overpayment: "Sobrepago",
  manual: "Registrado a mano",
};

export function AdvancesPanel({ tenantId, statements, formatAmount }: Props) {
  const { items, aplicaciones, loading, error } = useAdvances(tenantId);
  /**
   * La bandera decide si se puede OPERAR, no si se ve.
   *
   * El servidor la exige también para cruzar y anular, así que apagada esas dos
   * fallarían — pero **esconder la sección escondería dinero que existe**, y
   * apagar un interruptor no puede hacer desaparecer el saldo a favor de un
   * residente de la pantalla de quien responde por él. Así que: con anticipos
   * en la base la sección se ve siempre, y sin ellos y con la bandera apagada
   * —que es toda la producción de hoy— no se pinta nada.
   */
  const puedeOperar = useFeatureFlag("producto-anticipos");

  const [cruzando, setCruzando] = useState<Advance | null>(null);
  const [anulando, setAnulando] = useState<Advance | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);

  const abiertos = useMemo(() => items.filter((a) => a.status === "open"), [items]);
  const total = useMemo(() => saldoAFavor(items), [items]);
  const unidadesConSaldo = useMemo(() => new Set(abiertos.map((a) => a.unitId)).size, [abiertos]);

  /**
   * Deshacer un cruce (CA12). La clave de idempotencia es la de ESTA operación y
   * tiene que ser distinta de la del cruce; si no, la marca del cruce se
   * confundiría con la de su reverso. Se genera en el clic porque deshacer no
   * tiene formulario donde conservarla: el riesgo del doble clic se cubre
   * bloqueando el botón mientras va.
   */
  async function deshacer(cruce: AdvanceApplication) {
    if (!tenantId || enCurso) return;
    setEnCurso(cruce.id);
    try {
      await undoAdvanceApplicationCallable({
        tenantId,
        applicationId: cruce.id,
        operationKey: `undo-${cruce.id}-${crypto.randomUUID()}`,
      });
      toast.success("Cruce deshecho. El anticipo vuelve a tener saldo.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setEnCurso(null);
    }
  }

  if (!tenantId) return null;
  if (!puedeOperar && items.length === 0 && !error) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Anticipos</CardTitle>
          <CardDescription className="mt-1">
            Dinero pagado de más que todavía no se ha aplicado a ningún cargo. Cruzarlo salda cuotas sin que entre
            dinero nuevo.
          </CardDescription>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatTile tone="green" label="Saldo a favor sin aplicar" value={formatAmount(total)} />
        <StatTile tone="slate" label="Unidades con saldo" value={String(unidadesConSaldo)} />
      </div>

      {error ? (
        // Un `catch` que deja la lista vacía convierte un fallo ruidoso en un
        // dato falso: «no hay anticipos» y «no pude leerlos» se ven igual, y el
        // segundo es el que hace que alguien cobre dos veces.
        <p className="mt-4 rounded-xl border border-[#f0d6d2] bg-[#fff6f4] px-3 py-2 text-sm text-[#9c4631]">
          No pudimos cargar los anticipos: {error}
        </p>
      ) : null}

      {!puedeOperar && items.length > 0 ? (
        <p className="mt-4 rounded-xl border border-[#eee0c1] bg-[#fff8e8] px-3 py-2 text-sm text-[#936b24]">
          Los anticipos están apagados en este conjunto: este dinero se ve, pero no se puede cruzar ni anular hasta
          volver a encenderlos.
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--slate-100)]" />
          ))}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Sin anticipos"
            description="Cuando alguien pague más de lo que debe, el excedente aparecerá aquí como saldo a favor de su unidad."
          />
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {items.map((anticipo) => {
            const cruces = crucesVigentes(aplicaciones, anticipo.id);
            const esAbierto = anticipo.status === "open";
            return (
              <li
                key={anticipo.id}
                className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--slate-900)]">
                      {anticipo.unitLabel || anticipo.unitId}
                      <span className="ml-2 rounded-full border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] font-normal text-[var(--slate-600)]">
                        {ETIQUETA_ESTADO[anticipo.status]}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--slate-600)]">
                      {ETIQUETA_ORIGEN[anticipo.origin]} · {anticipo.date}
                      {anticipo.amount !== anticipo.remaining ? (
                        <> · de {formatAmount(anticipo.amount)} originales</>
                      ) : null}
                    </p>
                    {anticipo.status === "cancelled" && anticipo.cancellationReason ? (
                      // El motivo se enseña, no solo se guarda: es la única forma
                      // de que quien mire después sepa por qué desapareció el
                      // saldo a favor de un residente.
                      <p className="mt-1 text-xs text-[#9c4631]">Anulado: {anticipo.cancellationReason}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-[#2f775f]">{formatAmount(anticipo.remaining)}</p>
                    <p className="text-[11px] text-[var(--slate-500)]">por aplicar</p>
                  </div>
                </div>

                {cruces.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t border-[var(--slate-200)] pt-2">
                    {cruces.map((cruce) => (
                      <li key={cruce.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-[var(--slate-600)]">
                          {formatAmount(cruce.amount)} aplicados a{" "}
                          {statements.find((s) => s.id === cruce.statementId)?.period ?? "un cargo"} · {cruce.date}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={enCurso === cruce.id}
                          onClick={() => void deshacer(cruce)}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          {enCurso === cruce.id ? "Deshaciendo..." : "Deshacer"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {esAbierto && puedeOperar ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCruzando(anticipo)}>
                      <IconBadge tone="mint" className="mr-2">
                        <Wallet className="h-4 w-4" />
                      </IconBadge>
                      Cruzar contra un cargo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAnulando(anticipo)}>
                      <XCircle className="mr-1 h-4 w-4" />
                      Anular
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <CruzarAnticipoModal
        anticipo={cruzando}
        tenantId={tenantId}
        statements={statements}
        formatAmount={formatAmount}
        onClose={() => setCruzando(null)}
      />
      <AnularAnticipoModal
        anticipo={anulando}
        tenantId={tenantId}
        formatAmount={formatAmount}
        onClose={() => setAnulando(null)}
      />
    </Card>
  );
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cruzar un anticipo contra un cargo.
 *
 * **Solo se ofrecen cargos de SU unidad** (R6, CF1). El servidor lo rechaza
 * igualmente, pero ofrecer una opción que va a fallar es enseñarle al
 * administrador un camino que no existe.
 */
function CruzarAnticipoModal({
  anticipo,
  tenantId,
  statements,
  formatAmount,
  onClose,
}: {
  anticipo: Advance | null;
  tenantId: string;
  statements: BillingStatement[];
  formatAmount: (value: number) => string;
  onClose: () => void;
}) {
  const [statementId, setStatementId] = useState("");
  const [importe, setImporte] = useState("");
  const [enviando, setEnviando] = useState(false);
  /**
   * Clave de idempotencia del cruce. Se genera **una vez por apertura** y se
   * conserva entre reintentos: con la misma clave, un doble clic o un reintento
   * tras un timeout cruzan una sola vez. Una clave nueva por intento no
   * protegería de nada. Mismo mecanismo que `RecordPaymentModal`.
   */
  const clave = useRef("");

  const candidatos = useMemo(() => {
    if (!anticipo) return [];
    // Del más antiguo al más nuevo, que es el orden en que un contador espera
    // imputar. Aquí es solo presentación: quien cruza elige un cargo explícito.
    return ordenarParaMostrar(
      statements.filter((s) => s.unitId === anticipo.unitId && deudaDelCargo(s) > 0),
    );
  }, [anticipo, statements]);

  const elegido = candidatos.find((c) => c.id === statementId) ?? null;
  const deuda = elegido ? deudaDelCargo(elegido) : 0;
  const propuesto = anticipo ? Math.min(anticipo.remaining, deuda) : 0;

  useEffect(() => {
    if (!anticipo) return;
    clave.current = crypto.randomUUID();
    setStatementId("");
    setImporte("");
  }, [anticipo]);

  async function confirmar() {
    if (!anticipo) return;
    const objetivo = elegido;
    if (!objetivo) {
      toast.error("Elige el cargo que quieres cubrir.");
      return;
    }
    const monto = importe.trim() === "" ? propuesto : Number(importe);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error("El importe a cruzar debe ser mayor a cero.");
      return;
    }
    setEnviando(true);
    try {
      const res = await applyAdvanceCallable({
        tenantId,
        advanceId: anticipo.id,
        statementId: objetivo.id,
        amount: monto,
        date: hoy(),
        operationKey: `apply-${anticipo.id}:${clave.current}`,
      });
      // Se anuncia lo APLICADO, no lo pedido: §5.3 lo limita al saldo del cargo
      // y el resto sigue en el anticipo. Decir el importe que se envió sería
      // mentir justo en el caso que la regla existe para cubrir.
      toast.success(
        res.appliedAmount < monto
          ? `Se aplicaron ${formatAmount(res.appliedAmount)}, que es lo que debía ese cargo. Quedan ${formatAmount(res.remaining)} de saldo a favor.`
          : `Cruzados ${formatAmount(res.appliedAmount)}. Quedan ${formatAmount(res.remaining)} de saldo a favor.`,
      );
      onClose();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={Boolean(anticipo)} title="Cruzar anticipo" onClose={onClose}>
      {anticipo ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
            <p className="text-[var(--slate-700)]">
              Unidad <strong>{anticipo.unitLabel || anticipo.unitId}</strong>
            </p>
            <p className="mt-1 text-[var(--slate-500)]">
              Saldo a favor disponible: {formatAmount(anticipo.remaining)}
            </p>
          </div>

          {candidatos.length === 0 ? (
            <EmptyState
              title="Esa unidad no debe nada"
              description="No hay cargos pendientes contra los que cruzar este anticipo. El saldo a favor se queda esperando al próximo cobro."
            />
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Cargo a cubrir</label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)]"
                  value={statementId}
                  onChange={(event) => {
                    setStatementId(event.target.value);
                    setImporte("");
                  }}
                >
                  <option value="">Elige un cargo…</option>
                  {candidatos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.period} · debe {formatAmount(deudaDelCargo(cargo))}
                    </option>
                  ))}
                </select>
              </div>

              {elegido ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm text-[var(--slate-700)]">Importe a cruzar</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={importe}
                      onChange={(event) => setImporte(event.target.value)}
                      placeholder={String(propuesto)}
                    />
                    <p className="mt-1 text-xs text-[var(--slate-500)]">
                      Sugerido: {formatAmount(propuesto)}. Si pides más de lo que debe el cargo, se aplica solo lo que
                      debe y el resto sigue a favor de la unidad.
                    </p>
                  </div>
                  {/* La regla contable de la ficha, dicha donde se opera y no
                      solo en la PRD: es la pregunta que hace cualquiera que vea
                      bajar una deuda sin que entre dinero. */}
                  <p className="rounded-xl border border-[#d6e6f3] bg-[#f5faff] px-3 py-2 text-xs text-[#2c648d]">
                    Cruzar no mueve dinero ni cambia los ingresos del mes: ese dinero ya entró cuando se recibió el
                    anticipo. Lo único que cambia es a qué cuota queda imputado.
                  </p>
                </>
              ) : null}

              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  disabled={enviando || !elegido}
                  onClick={() => void confirmar()}
                >
                  {enviando ? "Cruzando..." : "Cruzar"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * Anular un anticipo con motivo (R9, CF4).
 *
 * **El aviso de qué NO hace anular es parte de la pantalla.** Anular no devuelve
 * el dinero y no baja el ingreso: el dinero entró y se queda en el conjunto, y
 * lo que desaparece es el crédito de esa unidad. Quien anula pensando que
 * devuelve, deja a un residente sin saldo y sin dinero.
 */
function AnularAnticipoModal({
  anticipo,
  tenantId,
  formatAmount,
  onClose,
}: {
  anticipo: Advance | null;
  tenantId: string;
  formatAmount: (value: number) => string;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  /** Idempotencia de la anulación, una por apertura. Ver el diálogo de cruce. */
  const clave = useRef("");

  useEffect(() => {
    if (!anticipo) return;
    clave.current = crypto.randomUUID();
    setMotivo("");
  }, [anticipo]);

  async function confirmar() {
    if (!anticipo) return;
    const razon = motivo.trim();
    if (!razon) {
      toast.error("Escribe por qué se anula. Sin motivo no se puede auditar.");
      return;
    }
    setEnviando(true);
    try {
      await cancelAdvanceCallable({
        tenantId,
        advanceId: anticipo.id,
        reason: razon,
        operationKey: `cancel-${anticipo.id}:${clave.current}`,
      });
      toast.success("Anticipo anulado.");
      onClose();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal open={Boolean(anticipo)} title="Anular anticipo" onClose={onClose}>
      {anticipo ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--slate-700)]">
            Vas a anular {formatAmount(anticipo.remaining)} de saldo a favor de{" "}
            <strong>{anticipo.unitLabel || anticipo.unitId}</strong>.
          </p>
          <p className="rounded-xl border border-[#eee0c1] bg-[#fff8e8] px-3 py-2 text-xs text-[#936b24]">
            Anular <strong>no devuelve el dinero</strong> y no cambia los ingresos del conjunto: ese dinero entró y se
            queda. Lo que desaparece es el crédito de esta unidad, y no se puede deshacer. Si lo que quieres es
            devolver el pago entero, reviértelo desde el libro.
          </p>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Motivo</label>
            <Input
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Por qué se anula este saldo a favor"
            />
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="button"
              disabled={enviando || !motivo.trim()}
              onClick={() => void confirmar()}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              {enviando ? "Anulando..." : "Anular anticipo"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
