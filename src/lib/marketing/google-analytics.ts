import type { Analytics } from "firebase/analytics";

/**
 * Google Analytics 4 vía Firebase — SOLO rutas de marketing.
 *
 * ── Por qué todo se carga en diferido ──────────────────────────────────────
 * El árbol de `(marketing)` no importa Firebase en ninguna parte. Añadir
 * `firebase/app` + `firebase/analytics` de forma estática le metería unos
 * 50–60 KB comprimidos al paquete de la página cuyo único trabajo es pintar
 * rápido. Aquí TODO entra por `import()` dinámico y solo después de que la
 * persona acepte cookies: quien no acepta no descarga ni un byte de Firebase.
 *
 * ── Por qué una app de Firebase propia ─────────────────────────────────────
 * `@/lib/firebase/client` arrastra auth, firestore, functions, storage y
 * messaging. Para medir visitas no hace falta nada de eso, así que aquí se
 * crea una app nombrada aparte con la configuración mínima. Si el visitante
 * navega a una ruta que sí levanta la app por defecto, conviven sin chocar.
 *
 * ── Consentimiento ─────────────────────────────────────────────────────────
 * Este módulo NO decide nada sobre consentimiento. Solo se llama a
 * `iniciarGoogleAnalytics()` desde `AnalyticsProvider`, que es el único sitio
 * que lee `vivaru.consent` y escucha `vivaru:init_analytics`.
 *
 * ── Fuera de producción no se envía nada ───────────────────────────────────
 * Un `npm run dev` en cualquier portátil ensuciaría la propiedad de GA4 con
 * tráfico que no es de nadie. Solo se inicializa en compilaciones de
 * producción, lo que incluye staging: ahí es donde se verifica.
 */

// Clave LITERAL a propósito. Next solo inyecta en el paquete del cliente los
// accesos literales a `process.env.NEXT_PUBLIC_*`; un acceso dinámico queda
// `undefined` en el navegador. Está documentado en `lib/firebase/config.ts` y
// ya costó una vez.
const ID_MEDICION = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
const ID_PROYECTO = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const ID_APP = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

/**
 * Producción y staging comparten hoy el mismo `measurementId`
 * (`G-L1XRDSMWBG` en los dos `apphosting.yaml`). Hasta que se separen, este
 * parámetro es lo único que permite distinguir el tráfico dentro de la misma
 * propiedad de GA4. Conviene registrarlo como dimensión personalizada en la
 * consola, si no, no aparece en los informes.
 */
function entorno(): "produccion" | "staging" | "desconocido" {
  if (ID_PROYECTO === "hogaru-1") return "produccion";
  if (ID_PROYECTO === "vivaru-staging-02") return "staging";
  return "desconocido";
}

let analytics: Analytics | null = null;
let arranque: Promise<void> | null = null;

/**
 * GA4 rechaza el evento entero si un parámetro se pasa de largo, y lo hace en
 * silencio: no hay error en consola, simplemente no aparece el dato. Límites
 * reales de la plataforma: 25 parámetros por evento, 40 caracteres de nombre
 * y 100 de valor.
 */
function sanear(props: Record<string, unknown>): Record<string, string | number | boolean> {
  const salida: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined) continue;
    if (n >= 24) break; // 24 + `entorno` = 25, el tope
    const k = clave.slice(0, 40);
    if (typeof valor === "number" || typeof valor === "boolean") {
      salida[k] = valor;
    } else {
      salida[k] = String(valor).slice(0, 100);
    }
    n += 1;
  }
  salida.entorno = entorno();
  return salida;
}

/** Idempotente: varias llamadas comparten la misma promesa. */
export function iniciarGoogleAnalytics(): Promise<void> {
  if (arranque) return arranque;

  arranque = (async () => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!ID_MEDICION || !API_KEY || !ID_APP || !ID_PROYECTO) return;

    // `respect_dnt` es lo que ya hace PostHog en este mismo proyecto. Se
    // mantiene el mismo criterio para que las dos fuentes cuenten lo mismo;
    // si algún día se decide dejar de respetarlo, se quita de los dos sitios
    // a la vez o los números dejarán de cuadrar entre sí.
    if (navigator.doNotTrack === "1") return;

    try {
      const [{ initializeApp, getApps, getApp }, { initializeAnalytics, isSupported }] =
        await Promise.all([import("firebase/app"), import("firebase/analytics")]);

      // Navegadores sin cookies, algunos navegadores embebidos y ciertos
      // modos privados devuelven `false`. Ahí no se insiste.
      if (!(await isSupported())) return;

      const NOMBRE = "vivaru-analytics";
      const app = getApps().some((a) => a.name === NOMBRE)
        ? getApp(NOMBRE)
        : initializeApp(
            {
              apiKey: API_KEY,
              projectId: ID_PROYECTO,
              appId: ID_APP,
              measurementId: ID_MEDICION,
            },
            NOMBRE,
          );

      // `send_page_view: false` es deliberado. Por defecto GA4 registra una
      // vista al cargar el tag, y en el App Router la navegación es del lado
      // del cliente: la automática solo contaría la primera. Las cuenta todas
      // `AnalyticsProvider` llamando a `vistaGoogleAnalytics()`.
      analytics = initializeAnalytics(app, { config: { send_page_view: false } });
    } catch {
      // Un bloqueador de anuncios hace fallar la descarga del SDK. Es lo
      // normal y no es un error de la página: no se avisa por consola ni se
      // reintenta.
      analytics = null;
    }
  })();

  return arranque;
}

/** No hace nada mientras no haya consentimiento: `analytics` sigue a `null`. */
export function eventoGoogleAnalytics(
  evento: string,
  props: Record<string, unknown> = {},
): void {
  if (!analytics) return;
  void import("firebase/analytics").then(({ logEvent }) => {
    if (analytics) logEvent(analytics, evento, sanear(props));
  });
}

export function vistaGoogleAnalytics(url: string): void {
  if (!analytics) return;
  void import("firebase/analytics").then(({ logEvent }) => {
    if (!analytics) return;
    logEvent(analytics, "page_view", {
      page_location: window.location.origin + url,
      page_path: url,
      page_title: document.title.slice(0, 100),
      entorno: entorno(),
    });
  });
}
