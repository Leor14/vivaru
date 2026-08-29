"use client";

// Registro del dispositivo para Web Push (PRD-V-PLAT-005 §5).
//
// La pieza que decide es `estadoDeSoportePush()`: en iOS el permiso solo
// existe DENTRO de una web app instalada en la pantalla de inicio, así que
// pedirlo desde Safari a pelo no falla — ni aparece. La invitación tiene que
// saber en cuál de los tres mundos está antes de enseñar un botón.

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { registerWebPush } from "@/lib/firebase/messaging";

export type SoportePush =
  | "soportado" // hay Push API y se puede pedir permiso
  | "ios-sin-instalar" // iPhone/iPad en Safari: primero añadir a inicio
  | "denegado" // el permiso del navegador está denegado; no se insiste (R5)
  | "sin-soporte"; // navegador sin Push API

function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS se disfraza de Mac; lo delata el táctil.
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1)
  );
}

function instalada(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari expone su propio campo, fuera del estándar.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function estadoDeSoportePush(): SoportePush {
  if (typeof window === "undefined") return "sin-soporte";
  const hayApi =
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!hayApi) return esIos() && !instalada() ? "ios-sin-instalar" : "sin-soporte";
  if (Notification.permission === "denied") return "denegado";
  return "soportado";
}

/** D1 de la ficha: 5 dispositivos por usuario y conjunto. */
export const TOPE_DE_DISPOSITIVOS = 5;

/** Para el campo `platform` del documento — diagnóstico, no lógica. */
export function plataformaActual(): "android" | "ios" | "desktop" | "otro" {
  if (typeof navigator === "undefined") return "otro";
  if (esIos()) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  if (/Win|Mac|Linux|CrOS/.test(navigator.userAgent)) return "desktop";
  return "otro";
}

/**
 * Pide el permiso, obtiene el token FCM y lo escribe en `pushTokens` con el
 * token como id (idempotencia: re-registrar sobrescribe, no duplica — CA6).
 * Devuelve el token, o null si el usuario no concedió o el entorno no da más.
 */
export async function registrarDispositivo(input: {
  uid: string;
  tenantId: string;
}): Promise<string | null> {
  if (!db) return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.error("[push] falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en este ambiente");
    return null;
  }

  const token = await registerWebPush(vapidKey);
  if (!token) return null;

  await setDoc(doc(db, "pushTokens", token), {
    userId: input.uid,
    tenantId: input.tenantId,
    createdAt: serverTimestamp(),
    platform: plataformaActual(),
  });

  // R7: tope de 5 dispositivos por usuario — el que excede borra el más viejo.
  // Sin orderBy a propósito (patrón watchLedger): se ordena en memoria, y así
  // ni depende de índice ni descarta documentos sin el campo.
  try {
    const propios = await getDocs(
      query(
        collection(db, "pushTokens"),
        where("userId", "==", input.uid),
        where("tenantId", "==", input.tenantId),
      ),
    );
    // El recién registrado se aparta ANTES de contar: si entrara en la lista
    // (su serverTimestamp puede leerse aún sin resolver, como 0), un salto al
    // borrarlo dejaría tope+1 vivos.
    const viejos = propios.docs
      .filter((d) => d.id !== token)
      .map((d) => ({
        id: d.id,
        creado: (d.data().createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0,
      }))
      .sort((a, b) => a.creado - b.creado);
    const sobran = viejos.length - (TOPE_DE_DISPOSITIVOS - 1);
    for (let i = 0; i < sobran; i++) {
      await deleteDoc(doc(db, "pushTokens", viejos[i].id));
    }
  } catch (e) {
    // El tope es limpieza, no invariante de seguridad: su fallo no rompe el registro.
    console.error("[push] tope de dispositivos", e);
  }

  return token;
}
