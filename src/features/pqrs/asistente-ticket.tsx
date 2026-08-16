"use client";

import { AlertTriangle, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getTicketCategoryLabel,
  getTicketPriorityLabel,
  getTicketTypeLabel,
} from "@/features/pqrs/ticket-status";
import type { FeedbackAsistencia } from "@/features/pqrs/use-feedback-asistencia";
import {
  asistirTicketPqrsCallable,
  type AsistenciaPqrs,
  type CuotaRestante,
  type RecorteAsistencia,
} from "@/lib/firebase/callables";

/**
 * Bloque de asistencia del ticket — Fase 3 de `PRD-VAI-FEAT-002`, §11.
 *
 * **Va DENTRO del drawer que ya existe**, plegado, con el patrón del panel
 * «Redactar con IA» de comunicaciones. Quien no quiera ayuda ve el detalle de
 * siempre con una línea más.
 *
 * Cuatro reglas que no son estéticas:
 *
 * 1. **El panel propone; no confirma nada.** La clasificación de verdad se edita
 *    en el cuerpo del drawer, con el estilo normal de Vivaru. Aquí solo se
 *    sugiere, y «Usar esta clasificación» RELLENA esos selectores sin guardar:
 *    guardar sigue siendo un acto de la persona. La PRD §5 lo pide así —
 *    «sugerencias separadas de los campos confirmados, nunca preseleccionadas en
 *    silencio»— y es lo que separa sugerir de cambiar.
 * 2. **Si el servidor no clasificó, no se pinta clasificación.** En
 *    `buzon_simple` la salida trae nulls por contrato de producto, y la pantalla
 *    obedece a lo que llegó, no a lo que el cliente crea que es el conjunto. Así
 *    la puerta dura se ve cumplida en pantalla, no solo en el evaluador.
 * 3. **El borrador lleva su aviso.** La corrida de la Fase 2 midió que 44 de 152
 *    borradores afirman acciones que nadie tomó —«procederemos a programar la
 *    inspección»— y el botón de abajo publica al residente. Copiar es un clic y
 *    publicar es otro; entre los dos va dicho el riesgo.
 * 4. **El editor manual sobrevive a todo.** Panel cerrado, bandera apagada o IA
 *    caída: responder y cambiar el estado funcionan igual que hoy.
 */

/** El morado de marca, reservado a lo asistido por IA — igual que en comunicaciones. */
const IA_TOKENS = {
  "--ia-tinta": "var(--color-brand-purple-deep)",
  "--ia-borde": "color-mix(in srgb, var(--color-brand-purple-deep) 22%, white)",
  "--ia-fondo": "color-mix(in srgb, var(--color-brand-purple-deep) 5%, white)",
} as React.CSSProperties;

/**
 * Las cinco banderas del §7. `enfado` lleva nota porque es la que se presta a
 * malentendido: entró por la decisión del 15 de agosto (caso `MX#3441`)
 * precisamente para que el enfado NO subiera la prioridad.
 */
const BANDERAS: Record<string, { etiqueta: string; nota?: string }> = {
  amenaza: { etiqueta: "Amenaza" },
  dato_sensible: { etiqueta: "Dato sensible" },
  lenguaje_ofensivo: { etiqueta: "Lenguaje ofensivo" },
  posible_urgencia: { etiqueta: "Posible urgencia", nota: "Señales que la prioridad no captura." },
  enfado: { etiqueta: "Enfado", nota: "No sube la prioridad: es tono, no consecuencia." },
};

/**
 * Tope de regeneraciones (PRD §10: «una asistencia por ticket + regeneraciones
 * limitadas»). La entrada no cambia entre una y otra —la v1 de la operación no
 * acepta instrucciones—, así que pedir otra versión es pedirle al modelo otra
 * lectura del mismo ticket, no una corrección dirigida.
 */
const MAX_REGENERACIONES = 3;

export interface ClasificacionSugerida {
  category: "pqrs" | "maintenance" | "billing";
  type: "petition" | "complaint" | "claim" | "suggestion" | "other";
  priority: "low" | "medium" | "high";
}

export interface AsistenteTicketProps {
  ticketId: string;
  /** Rellena los selectores del drawer. No guarda: eso lo hace la persona. */
  onAplicarClasificacion: (clasificacion: ClasificacionSugerida) => void;
  /** Copia el borrador al cuadro de respuesta. Publicar sigue siendo otro clic. */
  onUsarBorrador: (texto: string) => void;
  /**
   * Anota qué se hizo con la propuesta. Sin esto la sesión de F3 no puede medir
   * si el asistente sirve — solo si costó.
   */
  feedback: FeedbackAsistencia;
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">{titulo}</span>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-[var(--slate-800)]">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AsistenteTicket({
  ticketId,
  onAplicarClasificacion,
  onUsarBorrador,
  feedback,
}: AsistenteTicketProps) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asistencia, setAsistencia] = useState<AsistenciaPqrs | null>(null);
  const [cuota, setCuota] = useState<CuotaRestante | null>(null);
  const [recorte, setRecorte] = useState<RecorteAsistencia | null>(null);
  const [veces, setVeces] = useState(0);
  const [borradorUsado, setBorradorUsado] = useState(false);
  const [clasificacionUsada, setClasificacionUsada] = useState(false);

  // Se deshabilita ANTES de que alguien choque con el tope, no después. El dato
  // solo existe desde la primera respuesta.
  const sinCuota = cuota !== null && (cuota.conjuntoDia <= 0 || cuota.conjuntoMes <= 0 || cuota.usuarioDia <= 0);
  const sinRegeneraciones = veces > MAX_REGENERACIONES;

  async function pedirAsistencia() {
    setCargando(true);
    setError(null);
    try {
      // Manda el `ticketId` y nada más: el mensaje, el historial y la variante
      // los lee el servidor. Ver `asistirTicketPqrsCallable`.
      const resultado = await asistirTicketPqrsCallable(ticketId);
      setAsistencia(resultado.output);
      setCuota(resultado.cuotaRestante);
      setRecorte(resultado.recorte);
      setVeces((v) => v + 1);
      setBorradorUsado(false);
      setClasificacionUsada(false);
      feedback.anotarLectura(
        {
          category: resultado.output.suggestedCategory,
          type: resultado.output.suggestedType,
          priority: resultado.output.suggestedPriority,
        },
        resultado.output.draftResponse,
      );
    } catch (e) {
      // El mensaje ya viene escrito para la persona y termina mandándola al
      // proceso manual. El detalle técnico se queda en los logs del servidor.
      setError(e instanceof Error ? e.message : "No pudimos preparar la asistencia.");
      setAsistencia(null);
    } finally {
      setCargando(false);
    }
  }

  const banderas = (asistencia?.safetyFlags ?? []).filter((f) => BANDERAS[f]);

  return (
    <section
      className={
        abierto
          ? "space-y-3 rounded-xl border border-[var(--ia-borde)] bg-[var(--ia-fondo)] p-4"
          : undefined
      }
      style={IA_TOKENS}
      aria-label="Analizar con IA"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls="asistente-pqrs"
          className={
            abierto
              ? "inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[var(--ia-tinta)]"
              : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--ia-borde)] bg-[var(--ia-fondo)] px-4 py-2.5 text-sm font-semibold text-[var(--ia-tinta)] hover:bg-[color-mix(in_srgb,var(--color-brand-purple-deep)_10%,white)]"
          }
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Analizar con IA
          {abierto ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : null}
        </button>
        {abierto && cuota ? (
          <span className="text-xs text-[var(--slate-500)]">Te quedan {cuota.usuarioDia} hoy</span>
        ) : null}
      </div>

      {!abierto ? null : (
        <div id="asistente-pqrs" className="space-y-3">
          {/*
            Hay un botón en vez de analizar al abrir. La PRD §10 dice «nunca en
            render automático»: abrir el panel para mirar no debe gastar una
            llamada ni empezar a leer el ticket por su cuenta.
          */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => void pedirAsistencia()}
              disabled={cargando || sinCuota || sinRegeneraciones}
              className="bg-[var(--ia-tinta)] hover:bg-[var(--color-brand-plum-dark)]"
            >
              {cargando ? "Analizando…" : asistencia ? "Pedir otra lectura" : "Analizar este ticket"}
            </Button>
            {sinCuota ? (
              <span className="text-xs text-[var(--slate-700)]">
                Se agotaron los análisis por hoy. Puedes atender el ticket a mano.
              </span>
            ) : null}
            {sinRegeneraciones && !sinCuota ? (
              <span className="text-xs text-[var(--slate-700)]">
                Ya pediste varias lecturas de este ticket. Sigue a mano desde aquí.
              </span>
            ) : null}
          </div>

          <p className="text-xs text-[var(--slate-500)]">
            El asistente lee el ticket y su historial y propone. No cambia el estado, no clasifica solo y no
            responde al residente.
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-[var(--slate-200)] bg-white p-3 text-sm text-[var(--slate-900)]"
            >
              {error}
            </p>
          ) : null}

          {asistencia ? (
            <div className="space-y-3 rounded-xl border border-[var(--ia-borde)] border-l-4 border-l-[var(--ia-tinta)] bg-white p-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ia-tinta)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Propuesta de la IA
              </span>

              {/*
                Las banderas van ARRIBA del todo. Una amenaza o un dato sensible
                cambian cómo se trata el caso entero, así que enterarse después
                de haber leído el resumen y el borrador llega tarde.
              */}
              {banderas.length > 0 ? (
                <div className="rounded-lg border border-[var(--amber-300)] bg-[var(--amber-50)] p-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--slate-900)]">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {banderas.length === 1 ? "Una señal para tener en cuenta" : "Señales para tener en cuenta"}
                  </span>
                  <ul className="mt-1 space-y-0.5 text-sm text-[var(--slate-800)]">
                    {banderas.map((f) => (
                      <li key={f}>
                        <span className="font-medium">{BANDERAS[f].etiqueta}</span>
                        {BANDERAS[f].nota ? (
                          <span className="text-[var(--slate-600)]"> — {BANDERAS[f].nota}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  Resumen
                </span>
                <p className="mt-0.5 text-sm text-[var(--slate-900)]">{asistencia.summary}</p>
              </div>

              {/*
                El guardrail de runtime de la PRD: obligatorio en todo `high`.
                Se pinta como línea propia porque es una instrucción para la
                persona, no un adorno de la prioridad.
              */}
              {asistencia.needsHumanReview ? (
                <p className="rounded-lg bg-[var(--surface-soft)] p-2 text-xs text-[var(--slate-800)]">
                  <span className="font-semibold">Revísalo tú.</span> El asistente no tiene bastante para decidir, o
                  propuso prioridad alta.
                </p>
              ) : null}

              {asistencia.suggestedCategory && asistencia.suggestedType ? (
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                    Clasificación propuesta
                  </span>
                  <p className="mt-1 text-sm text-[var(--slate-900)]">
                    {getTicketCategoryLabel(asistencia.suggestedCategory)} ·{" "}
                    {getTicketTypeLabel(asistencia.suggestedType)} ·{" "}
                    {getTicketPriorityLabel(asistencia.suggestedPriority)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--slate-600)]">{asistencia.priorityReason}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="mt-2"
                    onClick={() => {
                      onAplicarClasificacion({
                        category: asistencia.suggestedCategory!,
                        type: asistencia.suggestedType!,
                        priority: asistencia.suggestedPriority,
                      });
                      setClasificacionUsada(true);
                      feedback.anotarClasificacionAplicada();
                    }}
                  >
                    Usar esta clasificación
                  </Button>
                  {clasificacionUsada ? (
                    <p className="mt-1 text-xs text-[var(--slate-500)]">
                      Se copió a los selectores de arriba. Corrígela si hace falta y guarda tú.
                    </p>
                  ) : null}
                </div>
              ) : (
                /*
                  La puerta dura, visible. En `buzon_simple` el servidor devuelve
                  nulls por contrato de producto; decirlo es mejor que dejar un
                  hueco que se lea como un fallo del modelo.
                */
                <p className="text-xs text-[var(--slate-600)]">
                  En buzón simple el asistente no clasifica: este conjunto opera sin categorías.
                </p>
              )}

              <Lista titulo="Lo que pide el residente" items={asistencia.requests} />
              <Lista titulo="Datos que faltan" items={asistencia.missingInformation} />
              <Lista titulo="Próximos pasos" items={asistencia.nextSteps} />

              <div className="border-t border-dashed border-[var(--slate-200)] pt-3">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  Borrador de respuesta
                </span>
                {/*
                  El aviso no es genérico ni prudencial: nombra un fallo MEDIDO,
                  con su cifra, porque un aviso vago se aprende a ignorar en tres
                  tickets y uno concreto se comprueba.
                */}
                <p className="mt-1 rounded-lg border border-[var(--amber-300)] bg-[var(--amber-50)] p-2 text-xs text-[var(--slate-800)]">
                  <span className="font-semibold">Léelo antes de enviarlo.</span> En la evaluación, 44 de 152
                  borradores daban por hechas acciones que nadie había tomado («procederemos a programar la
                  inspección»). Borra lo que no sea verdad.
                </p>
                <Textarea readOnly value={asistencia.draftResponse} className="mt-2 bg-[var(--surface-soft)]" rows={6} />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() => {
                    onUsarBorrador(asistencia.draftResponse);
                    setBorradorUsado(true);
                    feedback.anotarBorradorCopiado();
                  }}
                >
                  Copiar al cuadro de respuesta
                </Button>
                {borradorUsado ? (
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Se copió abajo. Edítalo: no se envía hasta que pulses «Responder».
                  </p>
                ) : null}
              </div>

              {/*
                Lo que el modelo NO llegó a leer. Un resumen de un mensaje leído a
                medias parece completo; decirlo cuesta una línea.
              */}
              {recorte && (recorte.mensaje || recorte.historialOmitido > 0) ? (
                <p className="border-t border-dashed border-[var(--slate-200)] pt-2 text-xs text-[var(--slate-600)]">
                  {recorte.mensaje ? "El mensaje era muy largo y se analizó solo su principio. " : ""}
                  {recorte.historialOmitido > 0
                    ? `Se analizaron las 10 respuestas más recientes; quedaron ${recorte.historialOmitido} fuera.`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
