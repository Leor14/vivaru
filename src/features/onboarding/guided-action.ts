"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Puente entre la banda de guía y el formulario de cada pantalla.
 *
 * El problema: la banda vive en el shell (`app-shell.tsx`) y el botón "Crear
 * unidad" vive dentro de la página. La banda no puede abrir ese modal por sí
 * sola sin acoplarse al DOM de cada pantalla —lo que se rompería en el primer
 * rediseño.
 *
 * La solución es un registro mínimo: la pantalla declara con `useGuidedAction`
 * qué sabe hacer para un paso, y la banda solo muestra su botón si alguien lo
 * registró. Si nadie lo hizo, la banda se muestra igual pero sin CTA — nunca un
 * botón muerto.
 *
 * Se descartó abrir el modal automáticamente al llegar: taparía con un
 * formulario justo la explicación que el usuario vino a leer.
 */

type Handler = () => void;

const handlers = new Map<string, Handler>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `true` si alguna pantalla montada sabe ejecutar la acción de este paso. */
export function useHasGuidedAction(stepKey: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (stepKey ? handlers.has(stepKey) : false),
    // En SSR nunca hay pantalla montada: sin CTA hasta hidratar.
    () => false,
  );
}

/** Ejecuta la acción del paso, si hay quien la atienda. */
export function runGuidedAction(stepKey: string) {
  handlers.get(stepKey)?.();
}

/**
 * Declara qué hace esta pantalla cuando el usuario pulsa el botón de la guía.
 * Una línea por pantalla, p. ej.:
 *
 * ```tsx
 * useGuidedAction("unidades", () => setUnitModalOpen(true));
 * ```
 *
 * Acepta una función nueva en cada render a propósito: lo registrado es un
 * envoltorio estable que delega en la última versión. Sin eso, quien pasara un
 * `useCallback` con dependencias incompletas dejaría guardado un manejador con
 * estado congelado del primer render — y el fallo sería silencioso.
 */
export function useGuidedAction(stepKey: string, handler: Handler) {
  const latest = useRef(handler);
  // Sin arreglo de dependencias a propósito: se refresca tras cada render, que
  // es justo lo que mantiene viva la versión más reciente del manejador.
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const stable = () => latest.current();
    handlers.set(stepKey, stable);
    emit();
    return () => {
      // Solo se retira si sigue siendo el propio: evita que el desmontaje de una
      // pantalla borre el manejador que otra acaba de registrar.
      if (handlers.get(stepKey) === stable) {
        handlers.delete(stepKey);
        emit();
      }
    };
  }, [stepKey]);
}
