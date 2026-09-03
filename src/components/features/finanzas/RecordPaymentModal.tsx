"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { ConjuntoActivoNota } from "@/components/shared/conjunto-activo-nota";
import { Input } from "@/components/ui/input";
import { watchPeople, type PersonItem } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import {
  aplicarAjustes,
  avisoDelSobrante,
  deudaDelCargo,
  motivoDeNoCuadrar,
  ordenarParaMostrar,
  type EstadoPropuesta,
  type LineaDeReparto,
} from "@/features/billing/reparto";
import { previewPaymentAllocationCallable } from "@/lib/firebase/callables";
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

  /**
   * **Las personas, en una `ref`, y no en las dependencias del reset.**
   *
   * `people` viene de una suscripción viva: cualquier cambio en cualquier persona
   * del conjunto —otro administrador editando un teléfono— devolvía un array
   * nuevo, el efecto de reset se volvía a ejecutar y **borraba el formulario
   * abierto**, incluido el importe ya escrito. Y peor: ponía `createdVoucher` a
   * `null`, así que a quien estuviera mirando el recibo recién emitido se lo
   * quitaba de la pantalla. Solo se usan para prellenar quién paga al ABRIR.
   */
  const peopleRef = useRef<PersonItem[]>([]);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    if (!user?.tenantId) return;
    return watchBankAccounts(user.tenantId, setCuentas, () => setCuentas([]));
  }, [user?.tenantId]);

  useEffect(() => {
    if (open && statement) {
      setAmount(String(statement.balance > 0 ? statement.balance : ""));
      setDate(today());
      // Prellenar nombre y cédula desde el residente de la unidad (prioriza propietario).
      const unitPeople = peopleRef.current.filter((p) => p.unitId === statement.unitId);
      const holder = unitPeople.find((p) => p.roleType === "owner_occupant") ?? unitPeople[0];
      setPayerName(holder?.fullName ?? "");
      setPayerTaxId(holder?.documentNumber ?? "");
      setCreatedVoucher(null);
      setSeleccion([statement.id]);
      setAjustes({});
      setBankAccountId("");
      // #11 — estos tres tampoco se limpiaban, y sobrevivían al cierre: al
      // reabrir para otro cobro se pintaba el sobrante del anterior y
      // «Calculando…» podía quedarse encendido para siempre.
      setSugerido([]);
      setSobranteSeraAnticipo(false);
      setCalculando(false);
      setEstadoPropuesta("pendiente");
    }
  }, [open, statement]);

  useEffect(() => {
    if (open) operationKey.current = crypto.randomUUID();
  }, [open, statement?.id]);

  /**
   * Los cargos que se OFRECEN para marcar: los de la MISMA unidad con deuda, más
   * aquel desde el que se abrió el cobro. Decidir qué enseñar es de la pantalla;
   * el ORDEN en que se reparte ya no —lo trae la propuesta del servidor.
   */
  const cargosDeLaUnidad = useMemo(() => {
    if (!statement) return [];
    // Ordenados del más antiguo al más nuevo **para que la lista diga lo mismo
    // que su propio rótulo**: sin esto salían en el orden en que los devolvió
    // Firestore —el más nuevo arriba— justo debajo de «se reparte del más
    // antiguo al más nuevo». Es presentación; el orden que cuenta lo decide el
    // servidor.
    return ordenarParaMostrar(
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
   * **La propuesta la calcula el SERVIDOR** (§11.3): R7 —el orden y la
   * aritmética— dejó de vivir aquí el 24 de agosto de 2026.
   *
   * Se pide al abrir y cuando cambian el importe o lo marcado, con un respiro de
   * 400 ms: pedirla por tecla sería un viaje de red por dígito. Mientras llega,
   * se conserva la anterior en vez de vaciarla — parpadear la propuesta a cero
   * mientras alguien escribe es peor que enseñarla un momento desactualizada.
   *
   * Si la llamada falla, `sugerido` queda vacío y no se propone nada: **no hay
   * plan B que calcule el reparto en el navegador**, que es justo lo que se vino
   * a quitar.
   */
  const [sugerido, setSugerido] = useState<LineaDeReparto[]>([]);
  const [sobranteSeraAnticipo, setSobranteSeraAnticipo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  /**
   * **En qué punto está la propuesta, dicho explícitamente.**
   *
   * No se puede deducir de `sugerido.length`: una propuesta vacía es un estado
   * legítimo —CA8, el pago que se va íntegro a anticipo— y era indistinguible de
   * «todavía no ha llegado». Por eso la pantalla anunciaba el importe entero como
   * saldo a favor durante el viaje de red, y para siempre si la llamada fallaba.
   */
  const [estadoPropuesta, setEstadoPropuesta] = useState<EstadoPropuesta>("pendiente");

  const clavesMarcadas = marcados.map((c) => c.id).join(",");
  useEffect(() => {
    if (!open || !user?.tenantId || !statement || !importeValido || marcados.length === 0) {
      setSugerido([]);
      setEstadoPropuesta("pendiente");
      // **Y se apaga el indicador.** Esta rama devolvía sin tocarlo: si alguien
      // borraba el importe mientras había una propuesta en vuelo, la limpieza del
      // efecto anterior mataba la llamada —y con ella su `finally`— y
      // «Calculando…» se quedaba encendido sin nada calculándose.
      setCalculando(false);
      return;
    }
    let vigente = true;
    setCalculando(true);
    // Vuelve a «pendiente» en cuanto cambia lo que se pide: la propuesta que hay
    // en pantalla ya no corresponde al importe nuevo.
    setEstadoPropuesta("pendiente");
    const t = setTimeout(() => {
      void previewPaymentAllocationCallable({
        tenantId: user.tenantId as string,
        unitId: statement.unitId,
        amount: importe,
        statementIds: clavesMarcadas ? clavesMarcadas.split(",") : [],
      })
        .then((res) => {
          if (!vigente) return;
          setSugerido(res.lineas.map((l) => ({ statementId: l.statementId, amount: l.amount })));
          setSobranteSeraAnticipo(res.sobranteSeraAnticipo);
          setEstadoPropuesta("recibida");
        })
        .catch(() => {
          if (!vigente) return;
          setSugerido([]);
          // **El fallo se dice.** Antes se tragaba, y la pantalla se quedaba con
          // el sobrante entero anunciado como saldo a favor indefinidamente.
          setEstadoPropuesta("error");
        })
        .finally(() => {
          if (vigente) setCalculando(false);
        });
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [open, user?.tenantId, statement, importe, importeValido, marcados.length, clavesMarcadas]);

  /** Lo que se envía: la propuesta del servidor con lo que se tocó a mano encima. */
  const reparto = useMemo(() => aplicarAjustes(sugerido, importe, ajustes), [sugerido, importe, ajustes]);

  const hayAjustes = Object.values(ajustes).some((v) => v.trim() !== "");
  // #12 — el motivo, no solo el sí/no: el aviso decía «suma más que el importe»
  // también cuando el problema era una línea en cero, y el reparto sumaba menos.
  const motivo = hayAjustes ? motivoDeNoCuadrar(reparto.lineas, importe) : null;
  const cuadra = motivo === null;
  // **La misma condicion que decide si viaja `allocations`** (ver el envio mas
  // abajo). Se nombra aqui porque de ella depende que pasa con el sobrante, y
  // tenerla escrita dos veces con formas distintas es como la pantalla acabo
  // prometiendo lo contrario de lo que hacia el servidor.
  const vaPorReparto = pagoMultiple && reparto.lineas.length > 1;
  /**
   * **#3 — la propuesta que hay en pantalla puede ser la ANTERIOR.**
   *
   * Al desmarcar un cargo, el efecto vuelve a pedir la propuesta pero conserva la
   * de antes a propósito, para no parpadear a cero mientras alguien escribe. Con
   * el botón activo durante ese hueco —400 ms de respiro más el viaje de red— se
   * podía registrar el reparto viejo, **imputando dinero a un cargo que se acababa
   * de quitar**. Se espera a que la propuesta corresponda a lo que hay marcado.
   */
  const esperandoPropuesta = pagoMultiple && marcados.length > 1 && estadoPropuesta === "pendiente";
  // **Qué se le puede decir al administrador sobre el sobrante**, decidido por
  // una función pura y probada en vez de por un ternario anidado en el JSX.
  // Incluye el caso que la pantalla contaba al revés: mientras la propuesta no ha
  // llegado, el sobrante es el importe entero y no significa nada.
  const aviso = avisoDelSobrante({
    estado: estadoPropuesta,
    sobrante: reparto.sobrante,
    seraAnticipo: sobranteSeraAnticipo,
    vaPorReparto,
  });
  // Con los anticipos apagados, un reparto que no llega al importe **se rechaza
  // en el servidor**: sin anticipos no hay donde guardar la diferencia. Se
  // bloquea aqui para que el administrador lo vea antes de enviar y no en un
  // error rojo despues.
  const sobranteSinDestino = aviso.tipo === "sin-destino";

  function alternar(id: string) {
    setSeleccion((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
    // Al marcar o desmarcar se olvida lo que se hubiera escrito a mano en esa
    // línea: el reparto se vuelve a proponer, y conservar un ajuste de un cargo
    // que ya no está seleccionado dejaría un importe fantasma esperando a que
    // alguien lo volviera a marcar.
    setAjustes((actual) => Object.fromEntries(Object.entries(actual).filter(([clave]) => clave !== id)));
  }

  async function handleSubmit() {
    if (!user?.tenantId || !statement) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (!cuadra) {
      toast.error(
        motivo === "linea-no-positiva"
          ? "Hay una línea del reparto en cero o negativa. Cada cargo tiene que llevar un importe mayor que cero."
          : "El reparto suma más que el importe pagado. Ajusta las líneas.",
      );
      return;
    }
    if (esperandoPropuesta) {
      toast.error("Todavía se está calculando el reparto. Espera un momento y vuelve a intentarlo.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordPayment(user.tenantId, user.uid, {
        statement,
        // Solo con la propuesta recibida: una lista heredada de la selección
        // anterior repartiría el dinero entre cargos que ya no están marcados.
        allocations: vaPorReparto && estadoPropuesta === "recibida" ? reparto.lineas : undefined,
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
              <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3 text-sm">
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
                    className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)]"
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
                    {/* El reparto lo propone el servidor, así que hay un viaje de
                        red por medio. Decirlo evita que un importe recién escrito
                        parezca que no hizo nada. */}
                    {calculando ? <span className="ml-1 text-[var(--slate-400)]">Calculando…</span> : null}
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
                            <span className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="w-32"
                                placeholder="0"
                                value={ajustes[cargo.id] ?? (linea ? String(linea.amount) : "")}
                                onChange={(event) =>
                                  setAjustes((actual) => ({ ...actual, [cargo.id]: event.target.value }))
                                }
                              />
                              {/* Un cargo marcado al que el reparto no le dio
                                  nada dejaba la casilla en blanco, y una casilla
                                  en blanco parece esperar que la rellenes. No
                                  espera nada: es que el dinero se acabó en los
                                  cargos más antiguos. */}
                              {!linea && !ajustes[cargo.id] ? (
                                <span className="text-xs text-[var(--slate-500)]">
                                  el importe se agotó en los anteriores
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {motivo === "linea-no-positiva" ? (
                    <p className="mt-2 rounded-lg border border-[#f0d6d2] bg-[#fff6f4] px-2 py-1 text-xs text-[#9c4631]">
                      Hay una línea en cero o negativa. Cada cargo del reparto tiene que llevar un importe mayor que
                      cero; si no quieres cubrirlo, desmárcalo.
                    </p>
                  ) : motivo === "suma-mayor" ? (
                    <p className="mt-2 rounded-lg border border-[#f0d6d2] bg-[#fff6f4] px-2 py-1 text-xs text-[#9c4631]">
                      El reparto suma más que el importe pagado. Puede sumar menos —lo que sobre queda a favor de la
                      unidad—, pero no más.
                    </p>
                  ) : null}

                </div>
              ) : null}

              {/* **Un solo mensaje para los dos casos, y los dos números vienen
                  del servidor**: el sobrante sale de la vista previa —no de una
                  resta local— y si va a quedar a favor lo dice la bandera tal
                  como el servidor la resuelve, con overrides incluidos. La
                  pantalla no puede prometer un saldo a favor que la bandera
                  apagada no va a crear. */}
              {cuadra && aviso.tipo === "error" ? (
                <p className="rounded-lg border border-[#f0d6d2] bg-[#fff6f4] px-2 py-1 text-xs text-[#9c4631]">
                  No pudimos calcular el reparto. Puedes registrar el cobro contra este cargo, pero
                  revisa después a qué quedó aplicado.
                </p>
              ) : null}

              {cuadra && (aviso.tipo === "a-favor" || aviso.tipo === "contra-el-cargo") ? (
                <p className="rounded-lg border border-[#d6ede4] bg-[#f1fbf7] px-2 py-1 text-xs text-[#2f775f]">
                  {aviso.tipo === "a-favor"
                    ? `Sobran ${formatAmount(aviso.sobrante)}: quedarán como saldo a favor de la unidad.`
                    : `Sobran ${formatAmount(aviso.sobrante)}, y se contabilizarán contra el cargo. Para guardarlos como saldo a favor hay que encender los anticipos.`}
                </p>
              ) : null}

              {cuadra && aviso.tipo === "sin-destino" ? (
                <p className="rounded-lg border border-[#f0d6d2] bg-[#fff6f4] px-2 py-1 text-xs text-[#9c4631]">
                  Sobran {formatAmount(aviso.sobrante)} y no hay dónde guardarlos: al repartir el pago
                  entre varios cargos, con los anticipos apagados, la diferencia no se contabiliza en
                  ninguna parte. Ajusta las líneas hasta sumar el importe, o enciende los anticipos.
                </p>
              ) : null}

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
              <div className="mt-3">
                <ConjuntoActivoNota accion="Se registra" />
              </div>
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  disabled={submitting || !cuadra || sobranteSinDestino || esperandoPropuesta}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? "Registrando..." : esperandoPropuesta ? "Calculando el reparto..." : "Registrar y emitir recibo"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
