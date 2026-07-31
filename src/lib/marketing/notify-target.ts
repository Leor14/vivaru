import { APP_ENV, isProduction } from "@/lib/env";

/**
 * Destinatarios y asunto de las notificaciones internas de marketing.
 *
 * Antes, staging y producción escribían al MISMO buzón comercial: cada prueba
 * interna generaba un lead indistinguible de uno real en la bandeja de ventas.
 * Fuera de producción se descarta cualquier dirección comercial y se marca el
 * asunto, para que el buzón de ventas solo reciba prospectos de verdad.
 */

/** Direcciones que jamás deben recibir correo desde un ambiente de pruebas. */
const COMMERCIAL_INBOXES = ["comercial@", "hola@", "ventas@"];

function parseList(raw: string | undefined, fallback: string): string[] {
  return (raw || fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Lista de destinatarios internos ya filtrada por ambiente.
 * En no-producción, si al filtrar no queda ninguno, cae a `dev@qintilab.com`
 * para no perder la notificación de la prueba.
 */
export function resolveNotifyTo(raw: string | undefined, fallback: string): string[] {
  const all = parseList(raw, fallback);
  if (isProduction) return all;

  const safe = all.filter(
    (address) => !COMMERCIAL_INBOXES.some((inbox) => address.toLowerCase().startsWith(inbox)),
  );
  return safe.length > 0 ? safe : ["dev@qintilab.com"];
}

/** Antepone `[STAGING]` / `[DEV]` al asunto fuera de producción. */
export function envSubject(subject: string): string {
  if (isProduction) return subject;
  const tag = APP_ENV === "staging" ? "STAGING" : "DEV";
  return `[${tag}] ${subject}`;
}
