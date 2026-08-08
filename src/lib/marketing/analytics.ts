/**
 * Vivaru Landing — Analytics helpers
 *
 * Thin wrapper over PostHog so component code stays decoupled from the
 * vendor. The 14 events below mirror plan §9 exactly; do NOT rename keys
 * without updating the funnels documented in journey.md.
 */
import posthog from 'posthog-js';
import { eventoGoogleAnalytics } from '@/lib/marketing/google-analytics';

export type LandingEvent =
  | 'page_view_landing'
  | 'cta_primary_view'
  | 'cta_primary_click'
  | 'cta_secondary_click'
  | 'cta_login_click'
  | 'lead_magnet_start'
  | 'lead_magnet_step_complete'
  | 'lead_magnet_complete'
  | 'pricing_view'
  | 'pricing_tier_hover'
  | 'perspective_tab_change'
  | 'faq_open'
  | 'demo_booked'
  | 'scroll_depth';

/**
 * Reparte el evento entre los destinos que estén configurados.
 *
 * OJO con el orden de las guardas. Antes esto era una sola condición:
 *
 *     if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
 *
 * Con PostHog sin configurar —que es la situación real hoy: la variable no
 * está en el `apphosting.yaml` de ninguna de las dos ramas— esa línea
 * silenciaba el evento entero. Al añadir Google Analytics habría silenciado
 * también el destino nuevo, y el síntoma sería «GA no recibe nada» sin
 * ninguna pista de por qué. Cada destino se comprueba por separado.
 */
export function track(
  event: LandingEvent,
  properties: Record<string, unknown> = {},
) {
  if (typeof window === 'undefined') return;

  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties);
  }

  eventoGoogleAnalytics(event, properties);
}
