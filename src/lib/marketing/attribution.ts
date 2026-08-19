import { z } from "zod";

/**
 * Atribución del lead (`REVOPS-001A`) — de dónde vino quien acabó dejando sus datos.
 *
 * **Por qué se captura al ENTRAR y no al enviar el formulario.** Un visitante
 * aterriza en `/?utm_source=google&utm_campaign=lanzamiento`, navega a
 * `/diagnostico` y envía el formulario cinco minutos después. En ese momento la
 * URL ya no lleva los `utm_*` y `document.referrer` apunta a nuestro propio
 * sitio. Leerlo al enviar daría «vino de vivaru» en todos los casos, que es
 * exactamente no saber nada. Por eso se captura en el primer render y se guarda.
 *
 * **Primera visita gana.** Si ya hay atribución en la sesión no se sobrescribe:
 * la pregunta que responde esta ficha es «de dónde vino el clic», y eso es el
 * primer contacto. Un segundo `utm_*` en la misma sesión es navegación interna,
 * no un origen nuevo.
 *
 * **Por qué NO va detrás del consentimiento de cookies.** Son propósitos
 * distintos: aquello gobierna analítica de terceros (GA4, PostHog); esto es el
 * expediente del lead. El dato vive en `sessionStorage` y **no sale del
 * navegador** hasta que la persona envía un formulario aceptando el tratamiento
 * de forma expresa. Ponerlo detrás de la cookie significaría que quien rechaza
 * cookies y luego pide una demo llega sin atribuir — justo lo que esta ficha
 * existe para evitar.
 *
 * **Los nombres van en snake_case**, al revés que el resto del repositorio. Es
 * deliberado: `utm_source` y compañía se llaman así en la URL, en Google Ads y
 * en GA4. Renombrarlos a camelCase obligaría a traducir en cada lectura.
 */

const CLAVE = "vivaru.attribution";

/** Tope por valor. Sin él, cualquiera puede meter 10 KB en un `utm_source`. */
const MAX_VALOR = 200;
const MAX_REFERRER = 500;

export type Atribucion = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  /** De dónde venía el navegador. Vacío en tráfico directo. */
  referrer?: string;
  /** Primera ruta vista en el sitio, sin query. */
  landing?: string;
  /** Cuándo se capturó, en ISO. Del navegador — es contexto, no prueba. */
  capturedAt?: string;
};

const PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/**
 * Esquema para las rutas de API. Todo opcional: un lead de tráfico directo es
 * un lead válido, y rechazarlo por no traer `utm_*` sería perder justo lo que
 * queremos guardar.
 */
export const atribucionSchema = z
  .object({
    utm_source: z.string().max(MAX_VALOR).optional(),
    utm_medium: z.string().max(MAX_VALOR).optional(),
    utm_campaign: z.string().max(MAX_VALOR).optional(),
    utm_content: z.string().max(MAX_VALOR).optional(),
    utm_term: z.string().max(MAX_VALOR).optional(),
    referrer: z.string().max(MAX_REFERRER).optional(),
    landing: z.string().max(MAX_VALOR).optional(),
    capturedAt: z.string().max(40).optional(),
  })
  .optional();

function recortar(valor: string | null, max: number): string | undefined {
  if (!valor) return undefined;
  const limpio = valor.trim().slice(0, max);
  return limpio === "" ? undefined : limpio;
}

/**
 * Captura la atribución si es la primera vez en esta sesión. Idempotente y
 * silenciosa: en modo incógnito estricto `sessionStorage` lanza, y perder la
 * atribución nunca debe costar la captura del lead.
 */
export function capturarAtribucion(): void {
  if (typeof window === "undefined") return;

  try {
    if (window.sessionStorage.getItem(CLAVE)) return; // primera visita gana

    const query = new URLSearchParams(window.location.search);
    const datos: Atribucion = {};

    for (const param of PARAMS) {
      const valor = recortar(query.get(param), MAX_VALOR);
      if (valor) datos[param] = valor;
    }

    const referrer = recortar(document.referrer, MAX_REFERRER);
    // Un referrer de nuestro propio dominio no es un origen: es navegación
    // interna, y guardarlo haría pasar por «vino de vivaru» a quien llegó
    // directo. En ese caso se omite y el lead queda como tráfico directo.
    if (referrer && !referrer.startsWith(window.location.origin)) {
      datos.referrer = referrer;
    }

    datos.landing = recortar(window.location.pathname, MAX_VALOR);
    datos.capturedAt = new Date().toISOString();

    window.sessionStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // sessionStorage no disponible — se sigue sin atribución.
  }
}

/** Devuelve la atribución de esta sesión, o `undefined` si no hay. */
export function leerAtribucion(): Atribucion | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const crudo = window.sessionStorage.getItem(CLAVE);
    if (!crudo) return undefined;
    const datos = JSON.parse(crudo) as Atribucion;
    return Object.keys(datos).length > 0 ? datos : undefined;
  } catch {
    return undefined;
  }
}
