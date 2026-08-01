"use client";

import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * Estado del recorrido guiado que NO se puede deducir de los datos.
 *
 * Vive en su propia colección `tenantOnboarding` y no como un campo de
 * `tenants`: ese documento guarda `status` y `trialEndsAt`, y darle permiso de
 * escritura al administrador para marcar un checklist le abriría la puerta a
 * extenderse la prueba solo. Aquí lo peor que puede hacer es mentirse a sí mismo
 * sobre su propio progreso.
 */

/**
 * Marca un paso como recorrido. Best-effort a propósito: es telemetría de
 * acompañamiento, y un fallo de red no debe interrumpir lo que el usuario está
 * haciendo ni sacarle un toast.
 */
export async function markStepSeen(tenantId: string, stepKey: string): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, "tenantOnboarding", tenantId),
      {
        tenantId,
        seen: { [stepKey]: new Date().toISOString() },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn("[onboarding] no fue posible registrar el paso", { stepKey, error });
  }
}

export type OnboardingSummary = {
  tenantId: string;
  activationDone: number;
  activationTotal: number;
  discoveryDone: number;
  discoveryTotal: number;
};

/**
 * Deja el avance ya contado en el propio documento del ambiente.
 *
 * La consola comercial necesita mostrar "Activación: 5 de 7" para decenas de
 * ambientes en una sola tabla; recalcularlo ahí exigiría abrir diez colecciones
 * por tenant. Así el superadmin lee un documento por ambiente y ya.
 *
 * El cálculo lo hace el navegador del administrador, de modo que el dato es
 * indicativo —sirve para priorizar a quién llamar, no para facturar.
 */
export async function saveOnboardingSummary(summary: OnboardingSummary): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, "tenantOnboarding", summary.tenantId),
      { ...summary, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    console.warn("[onboarding] no fue posible guardar el resumen", error);
  }
}

/** Avance de todos los ambientes, para la consola de superadmin. */
export function watchOnboardingSummaries(
  onData: (byTenant: Record<string, OnboardingSummary>) => void,
): () => void {
  if (!db) return () => undefined;
  return onSnapshot(
    collection(db, "tenantOnboarding"),
    (snapshot) => {
      const result: Record<string, OnboardingSummary> = {};
      for (const item of snapshot.docs) {
        const data = item.data() as Partial<OnboardingSummary>;
        if (typeof data.activationDone !== "number") continue;
        result[item.id] = {
          tenantId: item.id,
          activationDone: data.activationDone,
          activationTotal: data.activationTotal ?? 0,
          discoveryDone: data.discoveryDone ?? 0,
          discoveryTotal: data.discoveryTotal ?? 0,
        };
      }
      onData(result);
    },
    (error) => {
      console.warn("[onboarding] no fue posible leer el avance de los ambientes", error);
      onData({});
    },
  );
}
