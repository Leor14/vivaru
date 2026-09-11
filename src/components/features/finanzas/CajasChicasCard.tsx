"use client";

import { Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { abrirCaja, cerrarCaja, reponerCaja } from "@/features/finanzas/use-cajas";
import { capitalizar } from "@/lib/config/vocabulario-pais";
import {
  devolucionAlCerrar,
  errorDeApertura,
  errorDeTraspaso,
  excesoSobreElLimite,
  propuestaDeReposicion,
  saldoNegativoTrasTraspaso,
  type FilaDeTesoreria,
} from "@/lib/finanzas/tesoreria";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, PettyCashFund } from "@/types/domain";

/**
 * `PRD-V-FEAT-010` entrega 3 · la caja chica —«caja menor» en Colombia (`RN-12`)—.
 *
 * Fondo fijo con límite: nace con el límite, lo que se paga desde ella es un
 * egreso como cualquier otro, y «Reponer» propone lo que la devuelve a su
 * límite (`RN-11`). Abrir, reponer y cerrar son traspasos con nombre: el saldo
 * de fondos no cambia. Los avisos no bloquean (`RN-09`).
 */

function hoyLocal() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

const aMoneda = (valor: string) => Math.round(Number(valor) * 100) / 100;

const CAMPO = "h-10 rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm";

type Accion = { tipo: "reponer" | "cerrar"; cajaId: string } | null;

export function CajasChicasCard({
  tenantId,
  uid,
  cajas,
  filas,
  bancos,
  termino,
  formatAmount,
}: {
  tenantId: string;
  uid: string;
  cajas: PettyCashFund[];
  /** Todas las filas de la tesorería: las de las cajas y las de los bancos. */
  filas: FilaDeTesoreria[];
  /** Las cuentas bancarias activas: de ellas sale y a ellas vuelve el dinero. */
  bancos: Array<Pick<BankAccount, "id" | "label" | "bankName">>;
  /** «caja menor» o «caja chica», según el país del conjunto. */
  termino: string;
  formatAmount: (n: number) => string;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [apertura, setApertura] = useState({ name: "", limit: "", sourceAccountId: "", date: "" });
  const [accion, setAccion] = useState<Accion>(null);
  const [reposicion, setReposicion] = useState({ fromAccountId: "", amount: "", date: "" });
  const [destinoCierre, setDestinoCierre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const filaDe = useMemo(() => new Map(filas.map((f) => [f.id, f])), [filas]);
  const nombreDelBanco = useMemo(() => new Map(bancos.map((b) => [b.id, b.label])), [bancos]);
  const abiertas = cajas.filter((c) => c.status === "abierta");
  const Termino = capitalizar(termino);
  const bancoPorDefecto = (caja?: PettyCashFund) =>
    caja && bancos.some((b) => b.id === caja.sourceAccountId) ? caja.sourceAccountId : bancos[0]?.id ?? "";

  function empezarApertura() {
    setApertura({ name: "", limit: "", sourceAccountId: bancoPorDefecto(), date: hoyLocal() });
    setError(null);
    setAccion(null);
    setAbriendo(true);
  }

  function empezarReposicion(caja: PettyCashFund) {
    const fila = filaDe.get(caja.id);
    const propuesta = fila ? propuestaDeReposicion(fila) : 0;
    setReposicion({ fromAccountId: bancoPorDefecto(caja), amount: propuesta > 0 ? String(propuesta) : "", date: hoyLocal() });
    setError(null);
    setAbriendo(false);
    setAccion({ tipo: "reponer", cajaId: caja.id });
  }

  function empezarCierre(caja: PettyCashFund) {
    setDestinoCierre(bancoPorDefecto(caja));
    setError(null);
    setAbriendo(false);
    setAccion({ tipo: "cerrar", cajaId: caja.id });
  }

  async function guardar(operacion: () => Promise<unknown>, exito: string) {
    setGuardando(true);
    try {
      await operacion();
      toast.success(exito);
      setAbriendo(false);
      setAccion(null);
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarApertura() {
    if (!tenantId || !uid) return;
    const problema = errorDeApertura(apertura, new Date());
    setError(problema);
    if (problema) return;
    await guardar(
      () =>
        abrirCaja(tenantId, uid, {
          name: apertura.name,
          limit: aMoneda(apertura.limit),
          sourceAccountId: apertura.sourceAccountId,
          date: apertura.date,
        }),
      `${Termino} abierta`,
    );
  }

  async function guardarReposicion(caja: PettyCashFund) {
    if (!tenantId || !uid) return;
    const problema = errorDeTraspaso({ ...reposicion, toAccountId: caja.id }, new Date());
    setError(problema);
    if (problema) return;
    await guardar(
      () =>
        reponerCaja(tenantId, uid, {
          cajaId: caja.id,
          fromAccountId: reposicion.fromAccountId,
          amount: aMoneda(reposicion.amount),
          date: reposicion.date,
        }),
      "Reposición registrada",
    );
  }

  async function confirmarCierre(caja: PettyCashFund, devolver: number) {
    if (!tenantId || !uid) return;
    if (devolver > 0 && !destinoCierre) {
      setError("Elige la cuenta a la que vuelve el dinero.");
      return;
    }
    await guardar(
      () => cerrarCaja(tenantId, uid, { cajaId: caja.id, toAccountId: destinoCierre, devolver, date: hoyLocal() }),
      `${Termino} cerrada`,
    );
  }

  const avisoApertura = saldoNegativoTrasTraspaso(filaDe.get(apertura.sourceAccountId), Number(apertura.limit));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{Termino}</CardTitle>
          <CardDescription className="mt-1">
            El fondo fijo para los gastos menores. Nace con un límite que sale del banco; lo que se
            paga desde ella es un egreso como cualquier otro, y «Reponer» la devuelve a su límite.
            Nada de esto cambia el saldo de fondos.
          </CardDescription>
        </div>
        {!abriendo ? (
          <Button variant="outline" onClick={empezarApertura} disabled={bancos.length === 0}>
            <Wallet className="mr-2 h-4 w-4" aria-hidden />
            Abrir {termino}
          </Button>
        ) : null}
      </div>
      {bancos.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--slate-600)]">
          Para abrir una {termino} hace falta una cuenta bancaria activa de la que salga el dinero.
        </p>
      ) : null}

      {abriendo ? (
        // `items-start`: el texto de ayuda del límite alarga su celda, y sin esto
        // el campo del nombre bajaba y los dos quedaban desalineados.
        <div className="mt-4 grid items-start gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-900)]">Nombre</span>
            <Input
              value={apertura.name}
              placeholder="Caja de portería"
              onChange={(e) => setApertura((a) => ({ ...a, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-900)]">Límite</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={apertura.limit}
              onChange={(e) => setApertura((a) => ({ ...a, limit: e.target.value }))}
            />
            <span className="text-xs text-[var(--slate-600)]">El fondo fijo: la caja nace con él y se repone hasta él.</span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-900)]">Sale de</span>
            <select
              className={CAMPO}
              value={apertura.sourceAccountId}
              onChange={(e) => setApertura((a) => ({ ...a, sourceAccountId: e.target.value }))}
            >
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>{b.label} · {b.bankName}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-900)]">Fecha</span>
            <Input type="date" value={apertura.date} onChange={(e) => setApertura((a) => ({ ...a, date: e.target.value }))} />
          </label>
          {avisoApertura !== null ? (
            <p className="text-sm text-[var(--warning-700)] sm:col-span-2">
              Después de abrirla, {nombreDelBanco.get(apertura.sourceAccountId) ?? "la cuenta"} quedaría en{" "}
              {formatAmount(avisoApertura)}. Se puede abrir igual: el saldo calculado puede estar incompleto.
            </p>
          ) : null}
          {error ? <p role="alert" className="text-sm text-[var(--danger-700)] sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button onClick={guardarApertura} disabled={guardando}>
              {guardando ? "Abriendo…" : `Abrir ${termino}`}
            </Button>
            <Button variant="ghost" onClick={() => setAbriendo(false)} disabled={guardando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {abiertas.length === 0 && !abriendo ? (
        <p className="mt-3 text-sm text-[var(--slate-600)]">Este conjunto no tiene ninguna {termino} abierta.</p>
      ) : null}

      {abiertas.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--slate-100)]">
          {abiertas.map((caja) => {
            const fila = filaDe.get(caja.id);
            const saldo = fila?.saldo ?? 0;
            const propuesta = fila ? propuestaDeReposicion(fila) : 0;
            const reponiendo = accion?.cajaId === caja.id && accion.tipo === "reponer";
            const cerrando = accion?.cajaId === caja.id && accion.tipo === "cerrar";
            const exceso = reponiendo ? excesoSobreElLimite(fila, Number(reposicion.amount)) : null;
            const bancoNegativo = reponiendo
              ? saldoNegativoTrasTraspaso(filaDe.get(reposicion.fromAccountId), Number(reposicion.amount))
              : null;
            const devolver = fila ? devolucionAlCerrar(fila) : 0;
            return (
              <li key={caja.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[var(--slate-900)]">{caja.name}</p>
                    <p className="text-sm text-[var(--slate-600)]">
                      Límite {formatAmount(caja.limit)} ·{" "}
                      {propuesta > 0 ? `faltan ${formatAmount(propuesta)} para volver a su límite` : "en su límite"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={saldo < 0 ? "font-semibold tabular-nums text-[var(--danger-700)]" : "font-semibold tabular-nums text-[var(--slate-900)]"}>
                      {formatAmount(saldo)}
                    </span>
                    <Button variant="outline" onClick={() => empezarReposicion(caja)} disabled={bancos.length === 0}>
                      Reponer
                    </Button>
                    <Button variant="ghost" onClick={() => empezarCierre(caja)}>
                      Cerrar
                    </Button>
                  </div>
                </div>

                {reponiendo ? (
                  <div className="mt-3 grid gap-3 rounded-lg bg-[var(--slate-100)] p-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-[var(--slate-900)]">Sale de</span>
                      <select
                        className={CAMPO}
                        value={reposicion.fromAccountId}
                        onChange={(e) => setReposicion((r) => ({ ...r, fromAccountId: e.target.value }))}
                      >
                        <option value="">Elige la cuenta</option>
                        {bancos.map((b) => (
                          <option key={b.id} value={b.id}>{b.label} · {b.bankName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-[var(--slate-900)]">Valor</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={reposicion.amount}
                        onChange={(e) => setReposicion((r) => ({ ...r, amount: e.target.value }))}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-[var(--slate-900)]">Fecha</span>
                      <Input type="date" value={reposicion.date} onChange={(e) => setReposicion((r) => ({ ...r, date: e.target.value }))} />
                    </label>
                    <p className="text-sm text-[var(--slate-600)] sm:col-span-3">
                      Propuesto: {formatAmount(propuesta)}, lo gastado desde que estuvo en su límite. Se puede ajustar.
                    </p>
                    {exceso !== null ? (
                      <p className="text-sm text-[var(--warning-700)] sm:col-span-3">
                        Con esta reposición la {termino} quedaría {formatAmount(exceso)} por encima de su límite. Se
                        puede registrar igual.
                      </p>
                    ) : null}
                    {bancoNegativo !== null ? (
                      <p className="text-sm text-[var(--warning-700)] sm:col-span-3">
                        Después, {nombreDelBanco.get(reposicion.fromAccountId) ?? "la cuenta de origen"} quedaría en{" "}
                        {formatAmount(bancoNegativo)}. Se puede registrar igual: el saldo calculado puede estar incompleto.
                      </p>
                    ) : null}
                    {error ? <p role="alert" className="text-sm text-[var(--danger-700)] sm:col-span-3">{error}</p> : null}
                    <div className="flex gap-2 sm:col-span-3">
                      <Button onClick={() => guardarReposicion(caja)} disabled={guardando}>
                        {guardando ? "Registrando…" : "Registrar reposición"}
                      </Button>
                      <Button variant="ghost" onClick={() => setAccion(null)} disabled={guardando}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {cerrando ? (
                  <div className="mt-3 grid gap-3 rounded-lg bg-[var(--slate-100)] p-3 text-sm">
                    {devolver === null ? (
                      <>
                        <p className="text-[var(--danger-700)]">
                          La {termino} está en {formatAmount(saldo)}. En negativo no se cierra: registra lo que falta o
                          repónla antes, porque cerrarla escondería la diferencia.
                        </p>
                        <div>
                          <Button variant="ghost" onClick={() => setAccion(null)}>Entendido</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {devolver > 0 ? (
                          <label className="grid gap-1">
                            <span className="text-[var(--slate-900)]">
                              Quedan {formatAmount(devolver)} en la {termino}. Al cerrarla vuelven a
                            </span>
                            <select className={CAMPO} value={destinoCierre} onChange={(e) => setDestinoCierre(e.target.value)}>
                              <option value="">Elige la cuenta</option>
                              {bancos.map((b) => (
                                <option key={b.id} value={b.id}>{b.label} · {b.bankName}</option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="text-[var(--slate-900)]">
                            La {termino} está en cero. Cerrada, deja de aparecer al pagar un egreso.
                          </p>
                        )}
                        {error ? <p role="alert" className="text-[var(--danger-700)]">{error}</p> : null}
                        <div className="flex gap-2">
                          <Button variant="danger" onClick={() => confirmarCierre(caja, devolver)} disabled={guardando}>
                            {guardando ? "Cerrando…" : devolver > 0 ? "Devolver y cerrar" : `Cerrar ${termino}`}
                          </Button>
                          <Button variant="ghost" onClick={() => setAccion(null)} disabled={guardando}>
                            No
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
