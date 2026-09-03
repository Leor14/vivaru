"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { construirEstadoDeCuenta } from "@/features/billing/estado-de-cuenta";
import { useClearanceCertificates } from "@/features/billing/use-clearance-certificates";
import {
  renderEstadoDeCuentaPdf,
  renderEstadosDeCuentaEnLotePdf,
} from "@/features/finanzas/comprobante/estado-de-cuenta-pdf";
import { renderPazYSalvoPdf } from "@/features/finanzas/comprobante/paz-y-salvo-pdf";
import { saldoAFavor, useAdvances } from "@/features/finanzas/use-advances";
import { useTenantVocabulary } from "@/features/tenant/use-tenant-vocabulary";
import { capitalizar } from "@/lib/config/vocabulario-pais";
import { Input } from "@/components/ui/input";
import { cancelClearanceCertificateCallable, emitClearanceCertificateCallable } from "@/lib/firebase/callables";
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
  /** La CLAVE de la unidad elegida (su id de documento), no su etiqueta. */
  const [claveElegida, setClaveElegida] = useState("");
  const [emitiendo, setEmitiendo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  // Los anticipos del CONJUNTO entero, no de la unidad: `saldoAFavor` ya filtra
  // por unidad, y el lote los necesita todos. Pedirlos por unidad obligaría a
  // una suscripción por cada una al emitir en lote.
  const { items: anticipos } = useAdvances(tenantId);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState<string | null>(null);
  const [lote, setLote] = useState(false);

  /**
   * **Se agrupa por la CLAVE de la unidad, y la etiqueta solo se enseña.**
   *
   * Aquí se agrupaba por ETIQUETA, y era lo correcto mientras el dato estaba
   * partido: con dos convenciones de `unitId` conviviendo —197 cargos por id y 19
   * por campo en producción—, agrupar por clave hacía que **la misma unidad
   * apareciera dos veces en el selector con su estado de cuenta partido**. Se vio
   * en staging: seis unidades ofreciendo «12 estados de cuenta». La etiqueta era
   * lo único estable entre las dos claves.
   *
   * **`FIX-002` unificó el dato el 26 de agosto de 2026 y agrupar por etiqueta
   * pasó de arreglo a defecto:** nada impide que dos unidades del conjunto se
   * llamen igual —`updateUnit` no lo comprueba—, y entonces esto las fundiría en
   * una sola fila, sumando la cartera de las dos en un papel que se entrega.
   *
   * Y con ello se va **la elección de clave por su FORMA**: se cogía la que
   * llevara `--` porque ese es el molde de los conjuntos de prueba
   * (`${tenantId}--${slug}`), y en cualquier otro conjunto caía en «la primera».
   * Clasificar un identificador por su aspecto es justo lo que hizo fracasar las
   * dos migraciones anteriores de este campo.
   */
  const unidades = useMemo(() => {
    const map = new Map<string, { clave: string; label: string }>();
    for (const s of items) {
      if (!s.unitId) continue;
      if (!map.has(s.unitId)) map.set(s.unitId, { clave: s.unitId, label: s.unitLabel || s.unitId });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "es-CO"));
  }, [items]);

  const seleccionada = unidades.find((u) => u.clave === claveElegida);
  const deLaUnidad = useMemo(
    () => (seleccionada ? items.filter((s) => s.unitId === seleccionada.clave) : []),
    [items, seleccionada],
  );
  const estado = useMemo(() => construirEstadoDeCuenta(deLaUnidad), [deLaUnidad]);
  const etiqueta = seleccionada?.label ?? "";
  /** A la callable va el id del documento, que es lo que guarda `tenantUsers.unitId`. */
  const claveParaCallable = seleccionada?.clave ?? "";
  const { items: certificados } = useClearanceCertificates(tenantId, claveParaCallable || undefined);
  const aFavor = seleccionada ? saldoAFavor(anticipos, seleccionada.clave) : 0;

  function hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const vocab = useTenantVocabulary();

  async function descargar() {
    setDescargando(true);
    try {
      await renderEstadoDeCuentaPdf(
        estado,
        {
          conjunto: tenantName ?? "",
          unidad: etiqueta,
          emitidoEl: hoy(),
          saldoAFavor: aFavor,
          pazYSalvoFrase: `${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}`,
        },
        formatAmount,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible generar el estado de cuenta.");
    } finally {
      setDescargando(false);
    }
  }

  async function emitir() {
    if (!tenantId || !claveParaCallable) return;
    setEmitiendo(true);
    try {
      const issueDate = hoy();
      const r = await emitClearanceCertificateCallable({
        tenantId,
        unitId: claveParaCallable,
        unitLabel: etiqueta,
        issueDate,
        // Misma clave que usa el residente: **una emisión por unidad y día**. Si
        // el administrador y el residente usaran claves distintas, pedirlo los
        // dos el mismo día crearía dos certificados del mismo hecho, con códigos
        // distintos y los dos válidos.
        operationKey: `pys-${claveParaCallable}-${issueDate}`,
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
        { titulo: vocab.pazYSalvoTitulo },
      );
      toast.success(
        r.created
          ? `Se emitió ${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}: ${r.code}`
          : `Ya se había emitido hoy: ${r.code}`,
      );
    } catch (error) {
      // El servidor dice cuánto debe y desde cuándo. Se enseña tal cual.
      toast.error(error instanceof Error ? error.message : `No fue posible emitir ${vocab.pazYSalvoArticulo} ${vocab.pazYSalvo}.`);
    } finally {
      setEmitiendo(false);
    }
  }

  /**
   * CA8 · un estado de cuenta por unidad, en un solo archivo.
   *
   * **Solo las unidades con movimientos.** Una hoja que dice «esta unidad no
   * tiene movimientos» no le sirve a nadie y alarga el documento; la unidad sin
   * historia se consulta de una en una, que es donde tiene sentido preguntarlo.
   */
  async function emitirLote() {
    if (unidades.length === 0) return;
    setLote(true);
    try {
      const emitidoEl = hoy();
      const paquete = unidades
        .map((u) => ({ ...u, propios: items.filter((s) => s.unitId === u.clave) }))
        .filter((u) => u.propios.length > 0)
        .map((u) => ({
          estado: construirEstadoDeCuenta(u.propios),
          cabecera: {
            conjunto: tenantName ?? "",
            unidad: u.label,
            emitidoEl,
            saldoAFavor: saldoAFavor(anticipos, u.clave),
          },
        }));
      await renderEstadosDeCuentaEnLotePdf(paquete, tenantName ?? "", emitidoEl, formatAmount);
      toast.success(`${paquete.length} estados de cuenta en un archivo.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible emitir el lote.");
    } finally {
      setLote(false);
    }
  }

  async function anular(certificateId: string) {
    if (!tenantId || !motivo.trim()) return;
    setAnulando(certificateId);
    try {
      const r = await cancelClearanceCertificateCallable({ tenantId, certificateId, reason: motivo.trim() });
      toast.success(r.alreadyCancelled ? "Ese certificado ya estaba anulado." : "Certificado anulado.");
      setMotivo("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible anular el certificado.");
    } finally {
      setAnulando(null);
    }
  }

  /**
   * Un certificado ANULADO se sigue pudiendo descargar, y el PDF lo dice en la
   * cara. Es parte del histórico: alguien puede tener el papel en la mano y
   * necesitar comprobar que ya no vale.
   */
  async function volverADescargar(c: (typeof certificados)[number]) {
    await renderPazYSalvoPdf(
      {
        code: c.code,
        unidad: c.unitLabel,
        conjunto: tenantName ?? "",
        asOfDate: c.asOfDate,
        issuedAt: c.issuedAt,
        creditBalance: c.creditBalance,
        anulado: c.status === "anulado",
        anuladoMotivo: c.anuladoMotivo,
      },
      formatAmount,
      { titulo: vocab.pazYSalvoTitulo },
    );
  }

  return (
    <Card className="p-4">
      <CardTitle>Estado de cuenta de una unidad</CardTitle>
      <CardDescription>
        {`El movimiento completo de la unidad y, si está al día, su ${vocab.pazYSalvo}.`}
      </CardDescription>

      <label className="mt-3 block text-sm text-[var(--slate-700)]">
        Unidad
        <select
          className="mt-1 h-10 w-full rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 text-sm sm:max-w-xs"
          value={claveElegida}
          onChange={(event) => setClaveElegida(event.target.value)}
        >
          <option value="">Selecciona una unidad</option>
          {unidades.map((u) => (
            <option key={u.clave} value={u.clave}>
              {u.label}
            </option>
          ))}
        </select>
      </label>

      {/* El lote va junto al selector y NO dentro de la rama de la unidad: es una
          acción del conjunto, y esconderla hasta elegir una unidad la haría
          parecer de esa unidad. */}
      <div className="mt-2">
        <Button type="button" variant="outline" disabled={lote || unidades.length === 0} onClick={() => void emitirLote()}>
          {lote ? "Generando…" : `Descargar los ${unidades.length} estados de cuenta`}
        </Button>
      </div>

      {claveElegida ? (
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
                {emitiendo ? "Emitiendo…" : capitalizar(vocab.pazYSalvo)}
              </Button>
            </div>
          </div>

          {certificados.length > 0 ? (
            <div className="mt-4 rounded-xl border border-[var(--slate-200)] p-3">
              <p className="text-sm font-medium text-[var(--slate-900)]">
                Certificados emitidos para esta unidad
              </p>
              {/* El motivo va ARRIBA y uno solo para toda la lista: pedirlo
                  después de pulsar convertiría R8 en un trámite que se rellena
                  con cualquier cosa para seguir. Y el botón no se activa sin él,
                  que es lo mismo que hace el servidor. */}
              <Input
                className="mt-2"
                placeholder="Motivo de la anulación"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              />
              <ul className="mt-2 divide-y divide-[var(--slate-200)]">
                {certificados.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-[var(--slate-700)]">
                      <span className="font-medium text-[var(--slate-900)]">{c.code}</span> · {c.asOfDate}
                      {c.status === "anulado" ? (
                        <span className="ml-2 rounded-sm bg-[var(--slate-100)] px-1.5 py-0.5 text-xs text-[var(--slate-500)]">
                          Anulado
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => void volverADescargar(c)}>
                        Descargar
                      </Button>
                      {c.status === "emitido" ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={anulando !== null || !motivo.trim()}
                          onClick={() => void anular(c.id)}
                        >
                          {anulando === c.id ? "Anulando…" : "Anular"}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
