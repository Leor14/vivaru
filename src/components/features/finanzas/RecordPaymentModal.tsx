"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { watchPeople, type PersonItem } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import {
  deudaDelCargo,
  ordenarPorAntiguedad,
  repartirConAjustes,
  repartoCuadra,
} from "@/features/billing/reparto";
import { watchBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { renderReciboPdf } from "@/features/finanzas/comprobante/recibo-pdf";
import { fetchPaymentVoucher, recordPayment } from "@/features/finanzas/use-payments";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, BillingStatement } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

type RecordPaymentModalProps = {
  open: boolean;
  statement: BillingStatement | null;
  /**
   * Todos los cargos del conjunto. Hacen falta para ofrecer los OTROS cargos de
   * la misma unidad cuando un pago cubre varios (D-B). Sin esto, la pantalla
   * solo conoce el cargo sobre el que se hizo clic.
   */
  statements?: BillingStatement[];
  onClose: () => void;
};

export function RecordPaymentModal({ open, statement, statements = [], onClose }: RecordPaymentModalProps) {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const pagoMultiple = useFeatureFlag("producto-pago-multiple");
  const anticipos = useFeatureFlag("producto-anticipos");

  const [people, setPeople] = useState<PersonItem[]>([]);
  const [cuentas, setCuentas] = useState<BankAccount[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payerName, setPayerName] = useState("");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** Los cargos marcados. Siempre incluye aquel sobre el que se abrió. */
  const [seleccion, setSeleccion] = useState<string[]>([]);
  /**
   * El reparto editado a mano, por cargo. Vacío = se usa el sugerido de R7.
   *
   * Se guarda **aparte del sugerido** para que tocar el importe total vuelva a
   * proponer sin pisar lo que el administrador ya ajustó a mano en otras líneas.
   */
  const [ajustes, setAjustes] = useState<Record<string, string>>({});
  /**
   * Clave de idempotencia del cobro (`FIN-001`).
   *
   * Se genera **una vez por apertura del formulario**, no en cada envío: esa es
   * toda la gracia. Con la misma clave, un doble clic o un reintento tras un
   * timeout aplican el pago una sola vez; con una clave nueva por intento, la
   * protección no existiría. Se renueva al abrir para un cobro distinto.
   */
  const operationKey = useRef<string>("");
  const [createdVoucher, setCreatedVoucher] = useState<{ id: string; code: string; advance?: number } | null>(null);

  // Ya no se escucha el perfil fiscal del conjunto: desde el 20 de agosto de
  // 2026 lo lee el servidor al emitir el recibo, que es donde debe leerse. Esta
  // pantalla necesita a las personas para prellenar quién paga, y las cuentas
  // bancarias para decir a cuál entró el dinero (D-C).
  useEffect(() => {
    if (!user?.tenantId) return;
    return watchPeople(user.tenantId, setPeople, () => setPeople([]));
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    return watchBankAccounts(user.tenantId, setCuentas, () => setCuentas([]));
  }, [user?.tenantId]);

  useEffect(() => {
    if (open && statement) {
      setAmount(String(statement.balance > 0 ? statement.balance : ""));
      setDate(today());
      // Prellenar nombre y cédula desde el residente de la unidad (prioriza propietario).
      const unitPeople = people.filter((p) => p.unitId === statement.unitId);
      const holder = unitPeople.find((p) => p.roleType === "owner_occupant") ?? unitPeople[0];
      setPayerName(holder?.fullName ?? "");
      setPayerTaxId(holder?.documentNumber ?? "");
      setCreatedVoucher(null);
      setSeleccion([statement.id]);
      setAjustes({});
      setBankAccountId("");
    }
  }, [open, statement, people]);

  useEffect(() => {
    if (open) operationKey.current = crypto.randomUUID();
  }, [open, statement?.id]);

  /** Los otros cargos con deuda de la MISMA unidad, del más antiguo al más nuevo (R7). */
  const cargosDeLaUnidad = useMemo(() => {
    if (!statement) return [];
    return ordenarPorAntiguedad(
      statements.filter((s) => s.unitId === statement.unitId && (s.id === statement.id || deudaDelCargo(s) > 0)),
    );
  }, [statement, statements]);

  const marcados = useMemo(
    () => cargosDeLaUnidad.filter((c) => seleccion.includes(c.id)),
    [cargosDeLaUnidad, seleccion],
  );

  const importe = Number(amount);
  const importeValido = Number.isFinite(importe) && importe > 0;

  /**
   * La propuesta de R7 sobre lo marcado, con lo ajustado a mano por encima.
   *
   * **Lo que se envía sale de aquí y no de lo que se pinta.** Dos formas de
   * calcular el mismo número acaban discrepando, y aquí el número es dinero.
   */
  const reparto = useMemo(
    () =>
      importeValido && marcados.length > 0
        ? repartirConAjustes(marcados, importe, ajustes)
        : { lineas: [], sobrante: 0 },
    [ajustes, importe, importeValido, marcados],
  );

  const hayAjustes = Object.values(ajustes).some((v) => v.trim() !== "");
  const cuadra = !hayAjustes || repartoCuadra(reparto.lineas, importe);

  function alternar(id: string) {
    setSeleccion((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
    setAjustes((actual) => {
      const { [id]: _fuera, ...resto } = actual;
      return resto;
    });
  }

  async function handleSubmit() {
    if (!user?.tenantId || !statement) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (!cuadra) {
      toast.error("El reparto suma más que el importe pagado. Ajusta las líneas.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordPayment(user.tenantId, user.uid, {
        statement,
        allocations: pagoMultiple && reparto.lineas.length > 1 ? reparto.lineas : undefined,
        amount: parsed,
        date,
        bankAccountId: bankAccountId || null,
        payerName: payerName.trim() || null,
        payerTaxId: payerTaxId.trim() || null,
        operationKey: operationKey.current,
      });
      setCreatedVoucher({ id: result.voucherId, code: result.voucherCode, advance: result.advanceAmount });
      toast.success(`Cobro registrado. Recibo ${result.voucherCode}.`);
      // El saldo a favor se anuncia SIEMPRE que lo haya, y con su importe: un
      // residente que paga de más y no ve confirmado el sobrante llama al
      // administrador, y esa es la llamada más barata de evitar.
      if (result.advanceAmount && result.advanceAmount > 0) {
        toast.success(`Sobraron ${formatAmount(result.advanceAmount)} y quedaron como saldo a favor de la unidad.`);
      }
      // R8. Va DESPUÉS del éxito y como aviso, no como error: el cobro se
      // aplicó y el dinero no se perdió —cayó en «Otros ingresos»—. Decirlo
      // como fallo haría dudar de un pago que está bien.
      if (result.cayoEnOtrosIngresos) {
        toast.warning(
          "El concepto de este cargo no tiene cuenta en el plan, así que el ingreso quedó en «Otros ingresos». Créale su cuenta si vas a cobrarlo seguido.",
        );
      }
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!createdVoucher) return;
    try {
      // Se lee el recibo guardado en vez de armar el PDF con lo que tiene esta
      // pantalla: el papel debe salir de lo que está escrito.
      const voucher = await fetchPaymentVoucher(createdVoucher.id);
      if (!voucher) {
        toast.error("No encontramos el recibo. Vuelve a abrir la lista de recibos.");
        return;
      }
      await renderReciboPdf(voucher, formatAmount);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const cuentasActivas = cuentas.filter((c) => c.active !== false);

  return (
    <Modal open={open} title="Registrar cobro" onClose={onClose}>
      {statement ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
            <p className="text-[var(--slate-700)]">
              Unidad <strong>{statement.unitLabel}</strong> · Período {statement.period}
            </p>
            <p className="mt-1 text-[var(--slate-500)]">Saldo actual: {formatAmount(statement.balance)}</p>
          </div>

          {createdVoucher ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--slate-200)] bg-white p-3 text-sm">
                <p className="text-[var(--slate-700)]">
                  Recibo <strong>{createdVoucher.code}</strong> emitido por{" "}
                  {formatAmount(Number(amount) || 0)}.
                </p>
                {createdVoucher.advance && createdVoucher.advance > 0 ? (
                  <p className="mt-1 text-[#2f775f]">
                    {formatAmount(createdVoucher.advance)} quedaron como saldo a favor de la unidad.
                  </p>
                ) : null}
              </div>
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button className="w-full sm:w-auto" type="button" onClick={() => void handleDownload()}>
                  Descargar recibo
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Monto del cobro</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Fecha del cobro</label>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>

              {/* D-C / R11. Sin bandera: el servidor ya la valida y el asiento
                  la guardaba fijo en `null`, así que la conciliación tenía que
                  adivinar por importe y fecha. «Efectivo» es una opción real y
                  no un hueco por rellenar: R11 dice «todo pago salvo efectivo». */}
              {cuentasActivas.length > 0 ? (
                <div>
                  <label className="mb-1 block text-sm text-[var(--slate-700)]">¿A qué cuenta entró?</label>
                  <select
                    className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
                    value={bankAccountId}
                    onChange={(event) => setBankAccountId(event.target.value)}
                  >
                    <option value="">Efectivo o sin identificar</option>
                    {cuentasActivas.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.label} · {cuenta.bankName}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Decirlo aquí es lo que permite después cuadrar el extracto del banco sin adivinar.
                  </p>
                </div>
              ) : null}

              {pagoMultiple && cargosDeLaUnidad.length > 1 ? (
                <div className="rounded-xl border border-[var(--slate-200)] p-3">
                  <p className="text-sm font-medium text-[var(--slate-800)]">¿Qué cargos cubre este pago?</p>
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Se reparte del más antiguo al más nuevo. Puedes ajustar cada línea a mano.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {cargosDeLaUnidad.map((cargo) => {
                      const marcado = seleccion.includes(cargo.id);
                      const linea = reparto.lineas.find((l) => l.statementId === cargo.id);
                      return (
                        <li key={cargo.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <label className="flex flex-1 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternar(cargo.id)}
                              className="h-4 w-4"
                            />
                            <span className="text-[var(--slate-700)]">
                              {cargo.period}
                              <span className="ml-2 text-xs text-[var(--slate-500)]">
                                debe {formatAmount(deudaDelCargo(cargo))}
                              </span>
                            </span>
                          </label>
                          {marcado ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-32"
                              value={ajustes[cargo.id] ?? (linea ? String(linea.amount) : "")}
                              onChange={(event) =>
                                setAjustes((actual) => ({ ...actual, [cargo.id]: event.target.value }))
                              }
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {!cuadra ? (
                    <p className="mt-2 rounded-lg border border-[#f0d6d2] bg-[#fff6f4] px-2 py-1 text-xs text-[#9c4631]">
                      El reparto suma más que el importe pagado. Puede sumar menos —lo que sobre queda a favor de la
                      unidad—, pero no más.
                    </p>
                  ) : null}

                  {cuadra && reparto.sobrante > 0 ? (
                    <p className="mt-2 rounded-lg border border-[#d6ede4] bg-[#f1fbf7] px-2 py-1 text-xs text-[#2f775f]">
                      {anticipos
                        ? `Sobran ${formatAmount(reparto.sobrante)}: quedarán como saldo a favor de la unidad.`
                        : `Sobran ${formatAmount(reparto.sobrante)}, y se contabilizarán contra el cargo. Para guardarlos como saldo a favor hay que encender los anticipos.`}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Sin reparto pero con anticipos: el sobrante del cargo único
                  también hay que anunciarlo, que es CA1 mirado desde la
                  pantalla. */}
              {!(pagoMultiple && cargosDeLaUnidad.length > 1) && anticipos && importeValido
                ? (() => {
                    const sobra = importe - deudaDelCargo(statement);
                    return sobra > 0 ? (
                      <p className="rounded-lg border border-[#d6ede4] bg-[#f1fbf7] px-2 py-1 text-xs text-[#2f775f]">
                        Sobran {formatAmount(sobra)}: quedarán como saldo a favor de la unidad.
                      </p>
                    ) : null;
                  })()
                : null}

              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">
                  Nombre del pagador (opcional)
                </label>
                <Input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder="Nombre del residente"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">
                  Cédula del condómino (opcional)
                </label>
                <Input
                  value={payerTaxId}
                  onChange={(event) => setPayerTaxId(event.target.value)}
                  placeholder="Documento de identidad"
                />
              </div>
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  disabled={submitting || !cuadra}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? "Registrando..." : "Registrar y emitir recibo"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
