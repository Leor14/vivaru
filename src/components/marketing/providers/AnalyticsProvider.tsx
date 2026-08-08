'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import {
  iniciarGoogleAnalytics,
  vistaGoogleAnalytics,
} from '@/lib/marketing/google-analytics';

/**
 * Vivaru — puerta de consentimiento de la analítica (solo rutas de marketing).
 *
 * Se llamaba `PostHogProvider`. Dejó de ser cierto en agosto de 2026, cuando
 * pasó a gobernar dos destinos: PostHog y Google Analytics 4 vía Firebase. Un
 * componente llamado `PostHogProvider` que arranca Google Analytics es
 * exactamente el tipo de deriva que confunde a quien llegue después.
 *
 * Consentimiento (HITL H9 / LFPDPPP básico):
 *   - NADA se inicializa hasta que la persona acepta cookies:
 *     `localStorage["vivaru.consent"] === "accepted"`, o el `CookieBanner`
 *     dispara el evento de ventana `vivaru:init_analytics`.
 *   - Hasta entonces el proveedor deja pasar a los hijos y no carga ningún
 *     SDK ni envía ninguna medición. En el caso de Google Analytics eso
 *     significa además **cero bytes descargados**: el SDK de Firebase entra
 *     por `import()` dinámico dentro de `iniciarGoogleAnalytics()`.
 *
 * Los dos destinos son independientes a propósito. Hoy PostHog no está
 * configurado en ninguna de las dos ramas —`NEXT_PUBLIC_POSTHOG_KEY` no
 * aparece en ningún `apphosting.yaml`—, así que el sitio funciona solo con
 * Google Analytics. Que uno falte no puede apagar al otro.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

const CONSENT_KEY = 'vivaru.consent';
const INIT_EVENT = 'vivaru:init_analytics';

let initialised = false;

function initPosthog() {
  if (initialised || typeof window === 'undefined' || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    persistence: 'localStorage+cookie',
    respect_dnt: true,
    autocapture: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug(false);
    },
  });
  initialised = true;
}

function hasConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Cuenta la vista en los dos destinos.
 *
 * Va montado siempre que haya consentimiento, no solo cuando PostHog esté
 * configurado: antes vivía dentro del árbol de `PHProvider` y con PostHog
 * ausente no llegaba a montarse nunca, así que Google Analytics no habría
 * contado ni una sola vista.
 *
 * En Google Analytics la vista automática está desactivada
 * (`send_page_view: false`): en el App Router la navegación es del lado del
 * cliente y la automática solo contaría la primera página.
 */
function ContadorDeVistas() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url =
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    if (POSTHOG_KEY && initialised) {
      posthog.capture('page_view_landing', {
        $current_url: url,
        referrer: document.referrer || null,
        device_type: window.matchMedia('(max-width: 767px)').matches
          ? 'mobile'
          : 'desktop',
      });
    }

    vistaGoogleAnalytics(url);
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [consentido, setConsentido] = useState(false);

  useEffect(() => {
    const arrancar = () => {
      initPosthog();
      void iniciarGoogleAnalytics();
      setConsentido(true);
    };

    if (hasConsent()) {
      arrancar();
      return;
    }
    window.addEventListener(INIT_EVENT, arrancar);
    return () => window.removeEventListener(INIT_EVENT, arrancar);
  }, []);

  if (!consentido) return <>{children}</>;

  // `PHProvider` solo envuelve si PostHog existe. El contador de vistas va
  // fuera de esa condición porque también alimenta a Google Analytics.
  const arbol = (
    <>
      <ContadorDeVistas />
      {children}
    </>
  );

  return POSTHOG_KEY ? <PHProvider client={posthog}>{arbol}</PHProvider> : arbol;
}
