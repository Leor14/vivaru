import type { Ticket } from "@/types/domain";

/**
 * **`L-21` — la evidencia de que el PQRS se resolvió.**
 *
 * Lote «Análisis de la plataforma», pág. 9: «Debería poder adjuntar la evidencia de la solución».
 * Medido en producción el 17 de septiembre de 2026: **54 tickets, 39 respondidos y CERO con
 * adjunto**. El tipo `Ticket` ya declaraba `attachmentUrl` y `attachments` desde antes, y **nadie
 * los escribe ni los lee en PQRS** —son de Servicios y de Comunicaciones, que los usan de verdad—:
 * campos muertos que hacían parecer construido lo que no existía.
 *
 * **Va en el lado de la ADMINISTRACIÓN, no del residente.** Lo que pide la pág. 9 es demostrar la
 * solución, y quien la ejecuta es la administración; que el residente adjunte la foto del problema
 * es otra necesidad (`L-09` la roza) y no está decidida.
 *
 * **Dónde vive el archivo y quién lo ve:** `tenants/{tenantId}/pqrs-evidence/{ticketId}/…`, una
 * carpeta nueva de `storage.rules` **solo para administración**. El residente la ve por la URL con
 * token que queda en su ticket, y **quién puede leer ese ticket lo decide `firestore.rules`**, que
 * lo acota a su unidad: es el mismo mecanismo de la foto del medidor, y la palanca real está en el
 * otro fichero. Abrir la carpeta a «miembro» habría dado LISTADO de la evidencia de todo el
 * conjunto —en Storage `read` incluye listar—, y una foto de un PQRS es del apartamento de alguien.
 */

export type EvidenciaDeLaSolucion = {
  name: string;
  /** Ruta de Storage: es lo que identifica el archivo; la URL es solo para enseñarlo. */
  path: string;
  url: string;
  size: number;
  contentType: string;
};

/** Una captura o un PDF, nada más. Es la misma lista que el canal de soporte acepta. */
export const TIPOS_DE_EVIDENCIA = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export const MAXIMO_POR_EVIDENCIA = 10 * 1024 * 1024;

/** El límite de Storage son 25 MB por archivo (`tamanoOk`); aquí se corta antes y con un mensaje. */
export function evidenciaInadmisible(archivo: { type: string; size: number }): string | null {
  if (!(TIPOS_DE_EVIDENCIA as readonly string[]).includes(archivo.type)) {
    return "Solo se aceptan imágenes (PNG, JPG, WEBP, GIF) o PDF.";
  }
  if (archivo.size > MAXIMO_POR_EVIDENCIA) {
    return `Cada archivo debe pesar menos de ${MAXIMO_POR_EVIDENCIA / (1024 * 1024)} MB.`;
  }
  return null;
}

/**
 * Sin acentos, espacios ni barras: el nombre va dentro de una ruta de Storage. **Y no empieza por
 * punto ni por guion**, que es lo que dejaba `../../etc/passwd` como `..-..-etc-passwd`: en un
 * nombre de objeto los `..` son literales y no escalan directorios, pero un archivo que empieza por
 * punto se descarga oculto y uno que empieza por guion se lee como una opción en una consola.
 */
export function nombreSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/-+$/g, "");
  return limpio || "evidencia";
}

export function rutaDeEvidencia(input: {
  tenantId: string;
  ticketId: string;
  nombre: string;
  ahora?: number;
}): string {
  const sello = input.ahora ?? Date.now();
  return `tenants/${input.tenantId}/pqrs-evidence/${input.ticketId}/${sello}-${nombreSeguro(input.nombre)}`;
}

/**
 * La evidencia que se enseña de un ticket: la del campo propio y, si no está, la de la última
 * respuesta del historial. **Nunca la de `attachments`/`attachmentUrl`**, que en PQRS están vacíos
 * y en otras pantallas significan «el adjunto que puso quien publicó», no una evidencia de
 * solución: confundirlos enseñaría el archivo equivocado con el rótulo más comprometido que hay.
 */
export function evidenciasDeLaSolucion(ticket: Pick<Ticket, "resolutionAttachments" | "responseHistory">): EvidenciaDeLaSolucion[] {
  const propias = ticket.resolutionAttachments;
  if (Array.isArray(propias) && propias.length) return propias.filter(esEvidencia);
  const historial = ticket.responseHistory ?? [];
  for (let i = historial.length - 1; i >= 0; i -= 1) {
    const adjuntos = historial[i]?.attachments;
    if (Array.isArray(adjuntos) && adjuntos.length) return adjuntos.filter(esEvidencia);
  }
  return [];
}

function esEvidencia(valor: unknown): valor is EvidenciaDeLaSolucion {
  if (!valor || typeof valor !== "object") return false;
  const v = valor as Partial<EvidenciaDeLaSolucion>;
  return typeof v.url === "string" && v.url.length > 0 && typeof v.name === "string" && v.name.length > 0;
}
