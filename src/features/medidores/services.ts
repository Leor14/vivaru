"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import type { MeterReading, MeteredService } from "@/types/domain";

/**
 * `PRD-V-FEAT-008` · el catálogo de servicios medidos y las lecturas.
 *
 * **Las consultas filtran `tenantId` siempre, y eso no es cosmético:** Firestore
 * evalúa una consulta de lista contra la regla **sin ejecutarla**, así que sin el
 * filtro la rechaza entera aunque todos los documentos fueran del conjunto. Está
 * medido contra el emulador en `tests/medicion-de-consumos.rules.test.ts`,
 * incluida la que falla: la del residente sin `unitId`.
 */

function assertDb() {
  if (!db) throw new Error("Firestore no está configurado en este entorno.");
  return db;
}

// ── catálogo ────────────────────────────────────────────────────────────────
// Escritura directa a propósito: es un CRUD del administrador que las reglas
// protegen entero y que no sostiene ningún invariante. Las LECTURAS no, y por
// eso van por callable.

export function watchMeteredServices(
  tenantId: string,
  onData: (items: MeteredService[]) => void,
  onError: (mensaje: string) => void,
) {
  const consulta = query(collection(assertDb(), "meteredServices"), where("tenantId", "==", tenantId));
  return onSnapshot(
    consulta,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeteredService, "id">) }))),
    (e) => onError(e.message),
  );
}

export async function createMeteredService(input: Omit<MeteredService, "id">) {
  const r = await addDoc(collection(assertDb(), "meteredServices"), input);
  return r.id;
}

export async function updateMeteredService(id: string, cambios: Partial<Omit<MeteredService, "id" | "tenantId">>) {
  await updateDoc(doc(assertDb(), "meteredServices", id), cambios);
}

export async function deleteMeteredService(id: string) {
  await deleteDoc(doc(assertDb(), "meteredServices", id));
}

// ── lecturas ────────────────────────────────────────────────────────────────

export function watchMeterReadings(
  tenantId: string,
  serviceId: string,
  period: string,
  onData: (items: MeterReading[]) => void,
  onError: (mensaje: string) => void,
) {
  const consulta = query(
    collection(assertDb(), "meterReadings"),
    where("tenantId", "==", tenantId),
    where("serviceId", "==", serviceId),
    where("period", "==", period),
  );
  return onSnapshot(
    consulta,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeterReading, "id">) }))),
    (e) => onError(e.message),
  );
}

/**
 * Sube la foto del medidor y devuelve su enlace.
 *
 * **Se comprime antes de subir.** Una foto de móvil ronda los 4 MB y aquí van
 * 93 unidades cada mes: sin esto son ~450 MB al mes por conjunto, y la
 * administradora las sube desde el teléfono, a veces con mala señal.
 *
 * El nombre lleva la unidad y el período **a propósito**: si algún día hay que
 * mirar el almacenamiento a mano, un `T1-101-2026-09.jpg` se entiende y un
 * identificador aleatorio no.
 */
export async function uploadMeterPhoto(input: {
  tenantId: string;
  serviceId: string;
  unitId: string;
  period: string;
  file: File;
}) {
  if (!storage) throw new Error("Storage no está configurado en este entorno.");
  const comprimida = await comprimirImagen(input.file);
  const limpio = `${input.unitId}-${input.period}`.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const ruta = `tenants/${input.tenantId}/meter-readings/${input.serviceId}/${limpio}.jpg`;
  const destino = ref(storage, ruta);
  await uploadBytes(destino, comprimida, { contentType: "image/jpeg" });
  return { photoUrl: await getDownloadURL(destino), storagePath: ruta };
}

/**
 * Reduce la foto a 1600 px de lado mayor y la reencoda a JPEG.
 *
 * **Si algo falla, devuelve el archivo original en vez de romper.** Perder la
 * compresión cuesta megabytes; perder la lectura le cuesta a ella volver al
 * sótano.
 */
async function comprimirImagen(file: File): Promise<Blob> {
  const MAX = 1600;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    const blob = await new Promise<Blob | null>((res) => lienzo.toBlob(res, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}
