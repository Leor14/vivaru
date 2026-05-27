"use client";

import * as React from "react";
import { Button } from "@/components/marketing/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * Cookie Banner — HITL H9 (copy + lógica a validar con Legal).
 *
 * Behaviour:
 *   - Mounts in a hidden state, shows itself after 1s on first page view
 *     if localStorage["vivaru.consent"] is not "accepted".
 *   - "Aceptar" stores "accepted" and dispatches the
 *     `vivaru:init_analytics` window event consumed by PostHogProvider.
 *   - "Más información" links to the Política de Privacidad (URL pending
 *     HITL H3 — currently aria-disabled).
 *
 * Stacking: positioned bottom-left on desktop, full-width on mobile
 * stacked above the fixed mobile bottom CTA (`bottom-24` accounts for
 * the ~64px CTA + ~16px breathing room).
 */

const CONSENT_KEY = "vivaru.consent";
const INIT_EVENT = "vivaru:init_analytics";

export function CookieBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(CONSENT_KEY) === "accepted") return;
    } catch {
      /* localStorage disabled — show banner anyway, the user can dismiss */
    }
    const t = window.setTimeout(() => setVisible(true), 1000);
    return () => window.clearTimeout(t);
  }, []);

  const accept = React.useCallback(() => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {
      /* no-op */
    }
    window.dispatchEvent(new Event(INIT_EVENT));
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    /* Cookie banner — copy approved by Legal 2026-05-21 */
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className={cn(
        "fixed left-0 right-0 z-modal px-4",
        // Sit above the mobile fixed bottom CTA on small screens.
        "bottom-24 md:bottom-4 md:left-4 md:right-auto md:max-w-md",
      )}
      style={{
        // Honor iOS safe area when no mobile CTA is present below us.
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="rounded-xl border border-border bg-background p-md shadow-brand-lg">
        <p
          id="cookie-banner-title"
          className="font-display text-base font-semibold text-navy"
        >
          Cookies y privacidad
        </p>
        <p
          id="cookie-banner-desc"
          className="mt-1 text-sm leading-relaxed text-slate-600"
        >
          Usamos cookies para mejorar tu experiencia y analizar el uso del
          sitio. Al continuar navegando aceptas nuestra Política de
          Privacidad.
        </p>
        <div className="mt-md flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={accept}>
            Aceptar
          </Button>
          <a
            href="/legal/privacidad"
            className="rounded-md px-2 py-1 text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
          >
            Más información
          </a>
        </div>
      </div>
    </div>
  );
}
