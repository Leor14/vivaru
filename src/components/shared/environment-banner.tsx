import { APP_ENV_LABEL, APP_ENV, isProduction } from "@/lib/env";

/**
 * Banda de identificación de ambiente.
 *
 * En producción no renderiza nada. Fuera de producción marca TODAS las páginas
 * —landing incluido— para que nadie confunda dónde está: staging sirve el mismo
 * código y, cuando exista el registro de prueba, va a ser muy fácil creer que
 * se está operando el sitio real.
 *
 * Va fija arriba y desplaza el contenido (no lo tapa): un banner flotante sobre
 * headers `sticky` genera solapes en los portales.
 */
export function EnvironmentBanner() {
  if (isProduction) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-[#7c2d12] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
    >
      <span aria-hidden>⚠</span>
      {APP_ENV_LABEL[APP_ENV]} · los datos aquí no son reales
    </div>
  );
}
