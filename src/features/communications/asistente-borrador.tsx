"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { claveDatoFaltante, etiquetaDe, ordenarDatosFaltantes } from "@/lib/ai/datos-faltantes";
import {
  redactarComunicacionCallable,
  type BorradorComunicacion,
  type CuotaRestante,
  type RedactarComunicacionInput,
} from "@/lib/firebase/callables";

/**
 * Panel de borrador asistido — Paso 2.5 de `docs/hoja-de-ruta-ia.md`.
 *
 * **Va DENTRO del formulario que ya existe**, no en una pantalla aparte: lo pide
 * la hoja de ruta y lo confirma `PRD-VAI-FEAT-003` §11. Quien no quiera ayuda
 * ignora el panel y escribe como siempre.
 *
 * Tres reglas que no son estéticas y que vienen medidas:
 *
 * 1. **La lista de lo que falta va ANTES del borrador y no se rellena sola**
 *    (PRD §5). No es un accesorio del producto: es el producto. La hipótesis
 *    que sobrevivió a la evaluación —H2′— dice que el valor es que el aviso
 *    salga completo, y hoy los avisos del corpus traen 1,2 de 4 datos.
 * 2. **`duracion` va arriba del todo**, siempre. Falta en el 95% de los avisos
 *    reales y en el 68% de los de corte de agua. Es el dato que hace que la
 *    gente baje a caseta a preguntar.
 * 3. **Descartar una petición cuesta un clic.** El fallo que le queda al modelo
 *    es pedir de más en avisos permanentes, y la salida NO es enseñarle a
 *    callarse: preguntar es el valor del producto. Se abarata rechazar.
 *
 * Lo que este panel no toca jamás —audiencia, torres, unidades, vigencia,
 * estado y publicación— no depende de esta pantalla: no está en el esquema de
 * entrada de la operación, así que no hay forma de que salga por el de salida.
 */

const TONOS = [
  { valor: "informativo", etiqueta: "Informativo" },
  { valor: "urgente", etiqueta: "Urgente" },
  { valor: "cordial", etiqueta: "Cordial" },
] as const;

/**
 * El único dato que lleva explicación, y solo porque el corpus la justifica.
 * Poner una nota en los cinco convertiría la lista en un muro de texto.
 */
const NOTA_DURACION = "Es el dato que más se olvida: falta en 95 de cada 100 avisos.";

export interface AsistenteBorradorProps {
  /** Inserta la propuesta en el formulario. El padre guarda lo que había. */
  onAplicar: (borrador: BorradorComunicacion) => void;
  /** Devuelve el formulario a lo que había antes de aplicar. */
  onDeshacer: () => void;
}

export function AsistenteBorrador({ onAplicar, onDeshacer }: AsistenteBorradorProps) {
  const [proposito, setProposito] = useState("");
  const [hechos, setHechos] = useState<string[]>([""]);
  const [tono, setTono] = useState<RedactarComunicacionInput["tono"]>("informativo");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<BorradorComunicacion | null>(null);
  const [cuota, setCuota] = useState<CuotaRestante | null>(null);
  const [descartados, setDescartados] = useState<string[]>([]);
  const [aplicado, setAplicado] = useState(false);

  const ultimoHechoRef = useRef<HTMLInputElement | null>(null);

  const hechosLimpios = hechos.map((h) => h.trim()).filter(Boolean);
  // Mismos mínimos que el esquema del catálogo, comprobados antes de gastar una
  // llamada. La PRD lo pide en su flujo: «reglas validan mínimos y longitud»
  // ANTES de la IA. El servidor los vuelve a comprobar; esto solo evita el viaje.
  const propositoValido = proposito.trim().length >= 10;
  const listoParaPedir = propositoValido && hechosLimpios.length > 0;

  // Se deshabilita ANTES de que alguien choque contra el tope, no después. El
  // dato solo existe desde la primera respuesta: no hay forma de consultarlo
  // sin llamar, así que hasta entonces el botón está disponible.
  const sinCuota = cuota !== null && (cuota.conjuntoDia <= 0 || cuota.conjuntoMes <= 0 || cuota.usuarioDia <= 0);

  const faltantes = borrador ? ordenarDatosFaltantes(borrador.missingInformation).filter((d) => !descartados.includes(claveDatoFaltante(d))) : [];

  function cambiarHecho(indice: number, valor: string) {
    setHechos((prev) => prev.map((h, i) => (i === indice ? valor : h)));
  }

  function anadirHecho() {
    setHechos((prev) => [...prev, ""]);
    // El foco va al campo nuevo: si no, el administrador tiene que buscarlo.
    window.setTimeout(() => ultimoHechoRef.current?.focus(), 0);
  }

  function quitarHecho(indice: number) {
    setHechos((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== indice)));
  }

  async function pedirBorrador() {
    setCargando(true);
    setError(null);
    try {
      const resultado = await redactarComunicacionCallable({
        proposito: proposito.trim(),
        hechos: hechosLimpios,
        tono,
      });
      setBorrador(resultado.output);
      setCuota(resultado.cuotaRestante);
      // Lo descartado pertenecía a la propuesta anterior. Arrastrarlo ocultaría
      // peticiones nuevas que el administrador nunca vio.
      setDescartados([]);
      setAplicado(false);
    } catch (e) {
      // El mensaje ya viene escrito para la persona y termina mandándola al
      // proceso manual. El detalle técnico se queda en los logs del servidor.
      setError(e instanceof Error ? e.message : "No pudimos preparar el borrador.");
      setBorrador(null);
    } finally {
      setCargando(false);
    }
  }

  function aplicar() {
    if (!borrador) return;
    onAplicar(borrador);
    setAplicado(true);
  }

  function deshacer() {
    onDeshacer();
    setAplicado(false);
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4"
      aria-label="Redactar con ayuda"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--brand-700)]">Redactar con ayuda</h3>
        {cuota ? (
          <span className="text-xs text-[var(--slate-500)]">Te quedan {cuota.usuarioDia} hoy</span>
        ) : null}
      </div>

      <div>
        <label htmlFor="ia-proposito" className="mb-1 block text-sm text-[var(--slate-700)]">
          ¿Qué quieres comunicar?
        </label>
        <Input
          id="ia-proposito"
          value={proposito}
          onChange={(event) => setProposito(event.target.value)}
          placeholder="Avisar del corte de agua del sábado"
          maxLength={500}
        />
      </div>

      <div>
        <span className="mb-1 block text-sm text-[var(--slate-700)]">Hechos</span>
        <div className="space-y-2">
          {hechos.map((hecho, indice) => (
            <div key={indice} className="flex items-center gap-2">
              <Input
                ref={indice === hechos.length - 1 ? ultimoHechoRef : undefined}
                value={hecho}
                onChange={(event) => cambiarHecho(indice, event.target.value)}
                placeholder={indice === 0 ? "El corte va de 8:00 a 14:00" : "Otro hecho"}
                maxLength={500}
                aria-label={`Hecho ${indice + 1}`}
              />
              <button
                type="button"
                onClick={() => quitarHecho(indice)}
                className="h-10 w-10 shrink-0 rounded-xl border border-[var(--slate-300)] bg-white text-[var(--slate-500)] hover:bg-[var(--slate-100)]"
                aria-label={`Quitar hecho ${indice + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {hechos.length < 20 ? (
          <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={anadirHecho}>
            + Añadir un hecho
          </Button>
        ) : null}
      </div>

      <div>
        <label htmlFor="ia-tono" className="mb-1 block text-sm text-[var(--slate-700)]">
          Tono
        </label>
        <select
          id="ia-tono"
          className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
          value={tono}
          onChange={(event) => setTono(event.target.value as RedactarComunicacionInput["tono"])}
        >
          {TONOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void pedirBorrador()} disabled={!listoParaPedir || cargando || sinCuota}>
          {cargando ? "Preparando…" : borrador ? "Pedir otra versión" : "Proponer borrador"}
        </Button>
        {!propositoValido && proposito.length > 0 ? (
          <span className="text-xs text-[var(--slate-500)]">Cuéntame un poco más (mínimo 10 caracteres).</span>
        ) : null}
        {sinCuota ? (
          <span className="text-xs text-[var(--slate-700)]">
            Se agotaron los borradores asistidos por hoy. Puedes escribirlo a mano.
          </span>
        ) : null}
      </div>

      <p className="text-xs text-[var(--slate-500)]">Lo que escribas aquí no se guarda con el comunicado.</p>

      {error ? (
        <p role="alert" className="rounded-xl border border-[var(--slate-200)] bg-white p-3 text-sm text-[var(--slate-900)]">
          {error}
        </p>
      ) : null}

      {/*
        La lista va ANTES de la propuesta, y no es una preferencia de maquetación:
        la PRD lo escribe como requisito y la hipótesis de valor lo justifica.
        Quien lee de arriba abajo ve primero qué le falta y solo después el texto.
      */}
      {borrador && faltantes.length > 0 ? (
        <div className="rounded-xl border border-[var(--amber-300)] bg-[var(--amber-50)] p-3">
          <h4 className="text-sm font-semibold text-[var(--slate-900)]">
            {faltantes.length === 1 ? "Falta 1 dato" : `Faltan ${faltantes.length} datos`}
          </h4>
          <p className="mb-2 text-xs text-[var(--slate-700)]">
            Añádelos arriba y pide otra versión, o descarta los que no apliquen.
          </p>
          <ul className="space-y-2">
            {faltantes.map((dato) => (
              <li
                key={claveDatoFaltante(dato)}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--amber-300)] bg-white p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                    {etiquetaDe(dato.categoria)}
                  </span>
                  <span className="block text-sm text-[var(--slate-900)]">{dato.detalle}</span>
                  {dato.categoria === "duracion" ? (
                    <span className="mt-0.5 block text-xs text-[var(--slate-500)]">{NOTA_DURACION}</span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setDescartados((prev) => [...prev, claveDatoFaltante(dato)])}
                >
                  No aplica
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {borrador ? (
        <div className="rounded-xl border border-[var(--brand-200)] border-l-4 border-l-[var(--brand-700)] bg-white p-3">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
            Propuesta de la IA
          </span>
          <p className="mb-1 text-sm font-semibold text-[var(--slate-900)]">{borrador.title}</p>
          <Textarea readOnly value={borrador.body} className="bg-[var(--surface-soft)]" rows={6} />
          <p className="mt-2 border-t border-dashed border-[var(--slate-200)] pt-2 text-xs text-[var(--slate-500)]">
            <span className="font-semibold">Aviso en la app:</span> {borrador.notificationSummary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {aplicado ? (
              <Button type="button" variant="outline" onClick={deshacer}>
                ↩ Deshacer
              </Button>
            ) : (
              <Button type="button" onClick={aplicar}>
                Usar este borrador
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => setBorrador(null)}>
              Descartar
            </Button>
          </div>
          {aplicado ? (
            <p className="mt-2 text-xs text-[var(--slate-500)]">
              Se copió al título y al mensaje. Edítalo libremente: la audiencia, la vigencia y el estado no se tocaron.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
