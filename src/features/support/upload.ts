"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { storage } from "@/lib/firebase/client";
import { SUPPORT_LIMITS, isAllowedAttachment, type SupportAttachment } from "@/features/support/types";

/**
 * Sube la evidencia de un ticket a `tenants/{tenantId}/support/…`.
 *
 * Esa ruta no es cosmética: es lo que la callable comprueba antes de meter el
 * archivo en el hilo. Un adjunto fuera de ella se rechaza, precisamente para
 * que nadie pueda inyectar en una conversación un enlace a otro conjunto o a
 * un sitio externo que el equipo va a abrir.
 *
 * La validación de aquí es **para el usuario, no para la seguridad**: evita que
 * suba 20 MB y se entere al enviar. La que cuenta ocurre en el servidor, que
 * lee el tamaño y el tipo reales del archivo ya subido.
 */
export async function uploadSupportAttachments(
  tenantId: string,
  files: File[],
): Promise<Pick<SupportAttachment, "name" | "path" | "url">[]> {
  if (files.length === 0) return [];
  if (!storage) throw new Error("El almacenamiento no está disponible en este entorno.");
  if (files.length > SUPPORT_LIMITS.maxAttachmentsPerMessage) {
    throw new Error(`Máximo ${SUPPORT_LIMITS.maxAttachmentsPerMessage} archivos por mensaje.`);
  }

  const subidos: Pick<SupportAttachment, "name" | "path" | "url">[] = [];
  for (const file of files) {
    const problema = isAllowedAttachment(file);
    if (problema) throw new Error(problema);

    const limpio = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-").slice(-120);
    const path = `tenants/${tenantId}/support/${Date.now()}-${limpio}`;
    const destino = ref(storage, path);
    await uploadBytes(destino, file, { contentType: file.type });
    subidos.push({ name: file.name, path, url: await getDownloadURL(destino) });
  }
  return subidos;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
