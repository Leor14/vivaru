"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import type { CategoriaDatoFaltante } from "@/lib/ai/datos-faltantes";
import {
  aplicarEvento,
  distanciaEdicion,
  FEEDBACK_INICIAL,
  paraEnviar,
  type EstadoFeedback,
} from "@/lib/ai/feedback-borrador";
import { registrarFeedbackIaCallable } from "@/lib/firebase/callables";

/**
 * Acumula lo que hace el administrador con el borrador y lo manda **una vez**
 * al terminar — Paso 2.5, precondición del piloto del 2.6.
 *
 * **Todo en refs y nada en estado, a propósito.** Nada de esto se pinta. Si
 * viviera en `useState`, cada «no aplica» volvería a renderizar el modal entero
 * para cambiar un contador que nadie ve.
 *
 * **Un envío por sesión de borrador, no uno por clic.** Cada clic sería una
 * invocación de función más para contar exactamente lo mismo.
 *
 * El texto propuesto se guarda aquí en memoria porque hace falta para medir
 * cuánto se editó, y **no puede acabar en el envío**: lo que se manda lo
 * construye `paraEnviar` a partir de `EstadoFeedback`, un tipo que no tiene ni
 * un campo de texto donde pudiera colarse.
 */
export interface FeedbackBorrador {
  /** El modelo propuso algo. `cuerpo` se queda en memoria; nunca se envía. */
  anotarPropuesta: (mostrados: CategoriaDatoFaltante[], cuerpo: string) => void;
  anotarDescarte: (categoria: CategoriaDatoFaltante) => void;
  anotarAplicada: () => void;
  anotarDeshecha: () => void;
  /** Compara aquí, en el navegador, para que al servidor solo viaje un número. */
  anotarGuardado: (mensajeFinal: string) => void;
  /** Manda lo acumulado y vuelve a empezar. Silencioso si no hay nada que contar. */
  enviar: () => void;
  reiniciar: () => void;
}

/**
 * Identificador de la sesión de borrador. No identifica a nadie: nace y muere
 * con el panel abierto, y solo sirve para que dos envíos de la misma sesión
 * escriban en la misma fila.
 */
function nuevaSesion(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Navegador viejo o entorno sin `crypto`: no vale la pena romper una métrica
  // por esto. La colisión solo importaría dentro del mismo conjunto y minuto.
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function useFeedbackBorrador(): FeedbackBorrador {
  const estado = useRef<EstadoFeedback>(FEEDBACK_INICIAL);
  /** Lo último que propuso el modelo. Contenido: no sale del navegador. */
  const cuerpoPropuesto = useRef<string | null>(null);
  const sesionId = useRef<string>(nuevaSesion());

  const reiniciar = useCallback(() => {
    estado.current = FEEDBACK_INICIAL;
    cuerpoPropuesto.current = null;
    // Sesión nueva: lo que venga después es otro borrador y otra fila.
    sesionId.current = nuevaSesion();
  }, []);

  /**
   * Manda lo acumulado **sin reiniciar**.
   *
   * No reiniciar es lo que permite mandar varias veces: el envío temprano —el
   * de «se ocultó la pestaña»— deja la fila a medias, y el tardío la completa
   * con si se guardó y cuánto se editó. Como los dos llevan el mismo
   * `sesionId`, el servidor los funde en una sola fila en vez de duplicarla.
   */
  const enviar = useCallback(() => {
    const carga = paraEnviar(estado.current);
    if (!carga) return;
    // Sin `await` y sin `catch`: el callable ya es best-effort y traga sus
    // errores. Esto ocurre al cerrar un modal, y esperar a que termine
    // retrasaría la pantalla de la persona por una métrica.
    void registrarFeedbackIaCallable({
      sesionId: sesionId.current,
      operationKey: "comunicaciones-redactar",
      propuestas: carga.propuestas,
      aplicada: carga.aplicada,
      deshecha: carga.deshecha,
      guardada: carga.guardada,
      mostrados: carga.mostrados,
      descartados: carga.descartados,
      distanciaEdicion: carga.distanciaEdicion,
    });
    // Sin dependencias: solo lee refs, que no se recrean. Antes dependía de
    // `reiniciar` porque enviaba y limpiaba a la vez; ahora enviar no limpia.
  }, []);

  /**
   * Manda lo acumulado cuando la pestaña se oculta.
   *
   * **Es el único momento fiable.** La primera prueba real lo demostró: cuatro
   * llamadas al modelo y solo dos filas de feedback, porque las otras dos
   * murieron al recargar la página sin cerrar el modal. En una prueba da
   * igual; en el piloto es perder la mitad de la evidencia.
   *
   * `visibilitychange` y no `beforeunload`: el segundo no se dispara de forma
   * fiable en móvil ni cuando el sistema mata una pestaña. Tampoco vale
   * `sendBeacon`, que no puede llevar la cabecera de autenticación.
   *
   * Mandar de más no cuesta nada: el `sesionId` hace que el servidor funda los
   * envíos en una sola fila.
   */
  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === "hidden") enviar();
    };
    document.addEventListener("visibilitychange", alOcultarse);
    return () => {
      document.removeEventListener("visibilitychange", alOcultarse);
      // Y al desmontar: si alguien navega a otra pantalla con el modal abierto,
      // el evento de visibilidad no llega a dispararse.
      enviar();
    };
  }, [enviar]);

  return useMemo<FeedbackBorrador>(
    () => ({
      anotarPropuesta: (mostrados, cuerpo) => {
        estado.current = aplicarEvento(estado.current, { tipo: "propuesta", mostrados });
        cuerpoPropuesto.current = cuerpo;
      },
      anotarDescarte: (categoria) => {
        estado.current = aplicarEvento(estado.current, { tipo: "descarte", categoria });
      },
      anotarAplicada: () => {
        estado.current = aplicarEvento(estado.current, { tipo: "aplicada" });
      },
      anotarDeshecha: () => {
        estado.current = aplicarEvento(estado.current, { tipo: "deshecha" });
      },
      anotarGuardado: (mensajeFinal) => {
        // Sin propuesta no hay nada que comparar: guardó un comunicado escrito
        // a mano, y eso no es «editó el 0%», es otra cosa distinta.
        if (cuerpoPropuesto.current === null) return;
        estado.current = aplicarEvento(estado.current, {
          tipo: "guardada",
          distanciaEdicion: distanciaEdicion(cuerpoPropuesto.current, mensajeFinal),
        });
      },
      enviar,
      reiniciar,
    }),
    [enviar, reiniciar],
  );
}
