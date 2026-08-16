"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { distanciaEdicion } from "@/lib/ai/feedback-borrador";
import { registrarFeedbackIaCallable } from "@/lib/firebase/callables";

/**
 * Acumula lo que hace el administrador con la asistencia de un ticket y lo manda
 * al terminar — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * **La fila que de verdad importa es el par sugerida/guardada.** Las dos puertas
 * de G7 se cobran contra «la decisión real del administrador», y hasta ahora esa
 * decisión no existía en el producto ni había dónde anotarla. Con esto, «¿cuántas
 * veces corrigió la categoría sugerida?» se contesta contando.
 *
 * Mismo diseño que el de comunicaciones y por las mismas razones medidas: todo
 * en refs porque nada de esto se pinta; un envío por sesión y no uno por clic; y
 * envío también al ocultarse la pestaña, que es el único momento fiable —en la
 * primera sesión real se perdió la mitad de la evidencia por recargar la página.
 *
 * El texto propuesto se queda en memoria para poder medir cuánto se editó, y no
 * puede salir de aquí: lo que viaja es un número.
 */

export interface ClasificacionMedida {
  category: "pqrs" | "maintenance" | "billing" | null;
  type: "petition" | "complaint" | "claim" | "suggestion" | "other" | null;
  priority: "low" | "medium" | "high" | null;
}

export interface FeedbackAsistencia {
  /** El modelo propuso. `borrador` se queda en memoria; nunca se envía. */
  anotarLectura: (sugerida: ClasificacionMedida, borrador: string) => void;
  /** Pulsó «usar esta clasificación»: la propuesta llegó a los selectores. */
  anotarClasificacionAplicada: () => void;
  /** Guardó la clasificación. Esto es la «decisión real» de la que habla G7. */
  anotarClasificacionGuardada: (guardada: ClasificacionMedida) => void;
  anotarBorradorCopiado: () => void;
  /** Compara en el navegador para que al servidor solo viaje un número. */
  anotarRespuestaGuardada: (mensajeFinal: string) => void;
  enviar: () => void;
  /**
   * Cierra la fila del ticket anterior y abre una nueva.
   *
   * Se llama al cambiar de ticket. Sin esto, la clasificación guardada en un
   * caso se anotaría junto a la sugerencia de otro — que es la peor forma de
   * equivocarse justo en el par que G7 viene a leer.
   */
  reiniciar: () => void;
}

function nuevaSesion(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function useFeedbackAsistencia(): FeedbackAsistencia {
  const lecturas = useRef(0);
  const sugerida = useRef<ClasificacionMedida | null>(null);
  const clasificacionAplicada = useRef(false);
  const guardada = useRef<ClasificacionMedida | null>(null);
  const borradorCopiado = useRef(false);
  const respuestaGuardada = useRef(false);
  const distancia = useRef<number | null>(null);
  /** Contenido: no sale del navegador. */
  const borradorPropuesto = useRef<string | null>(null);
  const sesionId = useRef<string>(nuevaSesion());

  const enviar = useCallback(() => {
    // Sin una sola lectura no hay nada que contar: el administrador atendió el
    // ticket a mano y eso no es una asistencia con resultado cero.
    if (lecturas.current === 0 || !sugerida.current) return;

    // Sin `await` y sin `catch`: el callable es best-effort y traga sus errores.
    // Esto ocurre al cerrar un drawer; esperar retrasaría la pantalla por una
    // métrica.
    void registrarFeedbackIaCallable({
      sesionId: sesionId.current,
      operationKey: "pqrs-asistir",
      lecturas: lecturas.current,
      sugerida: sugerida.current,
      clasificacionAplicada: clasificacionAplicada.current,
      guardada: guardada.current,
      borradorCopiado: borradorCopiado.current,
      respuestaGuardada: respuestaGuardada.current,
      distanciaEdicion: distancia.current,
    });
  }, []);

  useEffect(() => {
    const alOcultarse = () => {
      if (document.visibilityState === "hidden") enviar();
    };
    document.addEventListener("visibilitychange", alOcultarse);
    return () => {
      document.removeEventListener("visibilitychange", alOcultarse);
      // Y al desmontar: cerrar el drawer o cambiar de ticket no dispara el
      // evento de visibilidad.
      enviar();
    };
  }, [enviar]);

  const reiniciar = useCallback(() => {
    // Manda lo del ticket anterior ANTES de limpiar: si se limpiara primero, esa
    // fila se perdería entera.
    enviar();
    lecturas.current = 0;
    sugerida.current = null;
    clasificacionAplicada.current = false;
    guardada.current = null;
    borradorCopiado.current = false;
    respuestaGuardada.current = false;
    distancia.current = null;
    borradorPropuesto.current = null;
    sesionId.current = nuevaSesion();
  }, [enviar]);

  return useMemo<FeedbackAsistencia>(
    () => ({
      anotarLectura: (propuesta, borrador) => {
        lecturas.current += 1;
        sugerida.current = propuesta;
        borradorPropuesto.current = borrador;
      },
      anotarClasificacionAplicada: () => {
        clasificacionAplicada.current = true;
      },
      anotarClasificacionGuardada: (valores) => {
        guardada.current = valores;
      },
      anotarBorradorCopiado: () => {
        borradorCopiado.current = true;
      },
      anotarRespuestaGuardada: (mensajeFinal) => {
        respuestaGuardada.current = true;
        // Sin haber copiado el borrador no hay nada que comparar: escribió la
        // respuesta a mano, y eso no es «la editó al 100%», es otra cosa. El
        // esquema del servidor exige exactamente esta correspondencia.
        if (!borradorCopiado.current || borradorPropuesto.current === null) return;
        distancia.current = distanciaEdicion(borradorPropuesto.current, mensajeFinal);
      },
      enviar,
      reiniciar,
    }),
    [enviar, reiniciar],
  );
}
