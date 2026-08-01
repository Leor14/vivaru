"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  activationStepsFor,
  discoveryStepsFor,
  stepsForTrack,
  type OnboardingStep,
  type OnboardingTrack,
} from "@/lib/onboarding/steps";

/**
 * Progreso del recorrido guiado, detectado **solo con evidencia real**.
 *
 * No hay "marcar como hecho" a mano: el paso se completa cuando el dato existe.
 * Es más honesto para el administrador y es lo único que sirve para medir
 * activación desde la consola comercial — un checklist que se puede palomear
 * sin hacer nada no mide nada.
 *
 * La pieza que lo hace posible es el marcador `isExample: true` que
 * `functions/src/trial-seed.ts` escribe en todo lo sembrado. Sin él, un ambiente
 * de prueba nacería con el checklist completo (ya trae 6 unidades y 6 personas
 * de ejemplo) y sería inútil desde el primer minuto.
 *
 * Los pasos de tipo `seen` —recorrer el portal del residente, mirar el bloque
 * financiero— no dejan rastro en datos, así que se registran en
 * `tenantOnboarding/{tenantId}` al llegar con la guía abierta.
 */

export type OnboardingProgress = {
  loading: boolean;
  /** Paso → si está completo. */
  done: Record<string, boolean>;
  /** Paso → ISO en que se recorrió (solo los que se visitaron con la guía). */
  seen: Record<string, string>;
  activationDone: number;
  discoveryDone: number;
  isDone: (key: string) => boolean;
};

/** Colecciones a vigilar, deducidas de las señales de los pasos. */
type Watch = { collection: string; filterExamples: boolean };

function collectWatches(steps: OnboardingStep[]): Watch[] {
  const byCollection = new Map<string, Watch>();
  for (const step of steps) {
    if (step.signal.kind !== "docs") continue;
    const filterExamples = step.signal.filterExamples === true;
    const current = byCollection.get(step.signal.collection);
    // Si dos pasos miran la misma colección, gana el criterio más estricto.
    if (!current || (filterExamples && !current.filterExamples)) {
      byCollection.set(step.signal.collection, { collection: step.signal.collection, filterExamples });
    }
  }
  return [...byCollection.values()];
}



/**
 * Cuántos documentos traer para decidir si hay alguno "real".
 *
 * Si no hay que filtrar ejemplos, con uno basta. Si hay que filtrarlos, se
 * traen 30: la siembra nunca pasa de 6 documentos por colección, así que es
 * imposible que los 30 devueltos sean todos de ejemplo habiendo alguno real.
 */
function pageSizeFor(watch: Watch) {
  return watch.filterExamples ? 30 : 1;
}

const EMPTY_SEEN: Record<string, string> = {};

export function useOnboardingProgress(
  tenantId: string | undefined,
  track: OnboardingTrack = "trial",
): OnboardingProgress {
  const [agrupaciones, setAgrupaciones] = useState<number | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>(EMPTY_SEEN);
  const [hasGuard, setHasGuard] = useState<boolean | null>(null);
  const [hasResident, setHasResident] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tenantId || !db) {
      setReady(true);
      return;
    }
    const firestore = db;
    setReady(false);

    const watches = collectWatches(stepsForTrack(track));
    const pending = new Set<string>(["settings", "onboarding", "guard", ...watches.map((w) => w.collection)]);
    const settle = (key: string) => {
      pending.delete(key);
      if (pending.size === 0) setReady(true);
    };

    const unsubs: Array<() => void> = [];

    // Lista canónica de agrupaciones (paso 1).
    unsubs.push(
      onSnapshot(
        doc(firestore, "tenantSettings", tenantId),
        (snap) => {
          const raw = (snap.data() as { agrupaciones?: unknown } | undefined)?.agrupaciones;
          setAgrupaciones(Array.isArray(raw) ? raw.filter((v) => typeof v === "string" && v.trim()).length : 0);
          settle("settings");
        },
        () => {
          setAgrupaciones(0);
          settle("settings");
        },
      ),
    );

    // Pasos "de recorrido": lo único que no se puede deducir de los datos.
    unsubs.push(
      onSnapshot(
        doc(firestore, "tenantOnboarding", tenantId),
        (snap) => {
          const raw = (snap.data() as { seen?: Record<string, unknown> } | undefined)?.seen;
          const next: Record<string, string> = {};
          if (raw && typeof raw === "object") {
            for (const [key, value] of Object.entries(raw)) {
              if (typeof value === "string") next[key] = value;
            }
          }
          setSeen(next);
          settle("onboarding");
        },
        () => {
          setSeen(EMPTY_SEEN);
          settle("onboarding");
        },
      ),
    );

    // Portería: cuenta real del conjunto, no la cuenta técnica de prueba.
    unsubs.push(
      onSnapshot(
        query(collection(firestore, "users"), where("tenantId", "==", tenantId)),
        (snap) => {
          const real = (role: string) =>
            snap.docs.some((item) => {
              const data = item.data() as { role?: string; isDemoAccount?: boolean };
              return data.role === role && data.isDemoAccount !== true;
            });
          setHasGuard(real("security_guard"));
          setHasResident(real("resident"));
          settle("guard");
        },
        () => {
          setHasGuard(false);
          setHasResident(false);
          settle("guard");
        },
      ),
    );

    for (const watch of watches) {
      unsubs.push(
        onSnapshot(
          query(
            collection(firestore, watch.collection),
            where("tenantId", "==", tenantId),
            limit(pageSizeFor(watch)),
          ),
          (snap) => {
            const real = watch.filterExamples
              ? snap.docs.filter((item) => (item.data() as { isExample?: boolean }).isExample !== true).length
              : snap.size;
            setCounts((prev) => (prev[watch.collection] === real ? prev : { ...prev, [watch.collection]: real }));
            settle(watch.collection);
          },
          // Una colección sin permiso o sin índice no debe romper el checklist:
          // ese paso simplemente se queda pendiente.
          () => {
            setCounts((prev) => (watch.collection in prev ? prev : { ...prev, [watch.collection]: 0 }));
            settle(watch.collection);
          },
        ),
      );
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [tenantId, track]);

  const done = useMemo(() => {
    const result: Record<string, boolean> = {};
    for (const step of stepsForTrack(track)) {
      let complete = false;
      switch (step.signal.kind) {
        case "agrupaciones":
          complete = (agrupaciones ?? 0) > 0;
          break;
        case "docs":
          complete = (counts[step.signal.collection] ?? 0) > 0;
          break;
        case "guardUser":
          complete = hasGuard === true;
          break;
        case "residentUser":
          complete = hasResident === true;
          break;
        case "seen":
          complete = Boolean(seen[step.key]);
          break;
      }
      // El recorrido de descubrimiento se completa con haberlo visto: el
      // objetivo es que sepa que el módulo existe, no cargarle más tareas.
      // Si además creó algo, cuenta igual — por eso es un OR.
      if (step.block === "descubre" && seen[step.key]) complete = true;
      result[step.key] = complete;
    }
    return result;
  }, [agrupaciones, counts, hasGuard, hasResident, seen, track]);

  const isDone = useCallback((key: string) => done[key] === true, [done]);

  return {
    loading: !ready,
    done,
    seen,
    activationDone: activationStepsFor(track).filter((step) => done[step.key]).length,
    discoveryDone: discoveryStepsFor(track).filter((step) => done[step.key]).length,
    isDone,
  };
}
