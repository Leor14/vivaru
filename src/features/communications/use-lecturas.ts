"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";

import {
  claveDeLectura,
  resumenDeLecturas,
  type LecturaDeComunicado,
  type VistosDeComunicado,
} from "./lectura-del-comunicado";

/**
 * **`L-13` — anotar y contar quién vio un comunicado.** La decisión de qué cuenta como «vio» y por
 * qué el camino de las notificaciones no servía está en `lectura-del-comunicado.ts`.
 */

/** Escribe la lectura del residente. Idempotente por el id del documento. */
export async function registrarLectura(input: {
  tenantId: string;
  communicationId: string;
  uid: string;
  nombre?: string;
}) {
  if (!db) return;
  await setDoc(
    doc(db, "communicationReads", claveDeLectura(input.communicationId, input.uid)),
    {
      tenantId: input.tenantId,
      communicationId: input.communicationId,
      uid: input.uid,
      // El nombre se desnormaliza para que la administración vea personas y no uids, igual que en
      // el resto del producto. Sin nombre, la lectura cuenta igual.
      ...(input.nombre?.trim() ? { name: input.nombre.trim() } : {}),
      seenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Devuelve la `ref` que hay que poner en la tarjeta de cada comunicado: anota la lectura **cuando
 * la tarjeta entra de verdad en la pantalla** (60% visible), no al cargar la lista.
 *
 * **Nunca rompe la pantalla.** Si falla la escritura —sesión caducada, reglas, red— el residente no
 * se entera: está leyendo un comunicado, y un aviso de error sobre una estadística sería ruido.
 * Tampoco reintenta: la próxima vez que lo vea se anota otra vez.
 */
export function useAnotarLecturas(input: { tenantId?: string; uid?: string; nombre?: string }) {
  const { tenantId, uid, nombre } = input;
  const anotadas = useRef<Set<string>>(new Set());
  const idPorNodo = useRef<Map<Element, string>>(new Map());
  const observador = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Al cambiar de conjunto o de persona, lo anotado ya no vale.
    anotadas.current = new Set();
  }, [tenantId, uid]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const id = idPorNodo.current.get(entrada.target);
          if (!id || !tenantId || !uid) continue;
          if (anotadas.current.has(id)) continue;
          anotadas.current.add(id);
          void registrarLectura({ tenantId, communicationId: id, uid, nombre }).catch(() => {
            // Silencio a propósito: ver el comunicado es lo importante, anotarlo es lo secundario.
          });
        }
      },
      { threshold: 0.6 },
    );
    observador.current = observer;
    return () => {
      observer.disconnect();
      observador.current = null;
      idPorNodo.current = new Map();
    };
  }, [tenantId, uid, nombre]);

  return useCallback(
    (communicationId: string) => (nodo: HTMLElement | null) => {
      if (!nodo) return;
      idPorNodo.current.set(nodo, communicationId);
      observador.current?.observe(nodo);
    },
    [],
  );
}

/** Lo que lee la administración: un resumen por comunicado, en vivo. */
export function useLecturasDeComunicados(tenantId?: string) {
  const [resumen, setResumen] = useState<Map<string, VistosDeComunicado>>(new Map());

  useEffect(() => {
    if (!tenantId || !db) {
      setResumen(new Map());
      return;
    }
    const unsub = subscribeTenantCollection<LecturaDeComunicado & { id: string }>(
      "communicationReads",
      tenantId,
      (items) => setResumen(resumenDeLecturas(items)),
      // Un fallo aquí no puede tumbar Comunicaciones: se queda sin el contador y nada más.
      () => setResumen(new Map()),
    );
    return () => unsub?.();
  }, [tenantId]);

  return resumen;
}
