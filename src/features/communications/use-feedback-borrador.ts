"use client";

import { useCallback, useMemo, useRef } from "react";

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

export function useFeedbackBorrador(): FeedbackBorrador {
  const estado = useRef<EstadoFeedback>(FEEDBACK_INICIAL);
  /** Lo último que propuso el modelo. Contenido: no sale del navegador. */
  const cuerpoPropuesto = useRef<string | null>(null);

  const reiniciar = useCallback(() => {
    estado.current = FEEDBACK_INICIAL;
    cuerpoPropuesto.current = null;
  }, []);

  const enviar = useCallback(() => {
    const carga = paraEnviar(estado.current);
    reiniciar();
    if (!carga) return;
    // Sin `await` y sin `catch`: el callable ya es best-effort y traga sus
    // errores. Esto ocurre al cerrar un modal, y esperar a que termine
    // retrasaría la pantalla de la persona por una métrica.
    void registrarFeedbackIaCallable({
      operationKey: "comunicaciones-redactar",
      propuestas: carga.propuestas,
      aplicada: carga.aplicada,
      deshecha: carga.deshecha,
      guardada: carga.guardada,
      mostrados: carga.mostrados,
      descartados: carga.descartados,
      distanciaEdicion: carga.distanciaEdicion,
    });
  }, [reiniciar]);

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
