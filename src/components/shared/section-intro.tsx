"use client";

import { ChevronDown, Info } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

type SectionIntroProps = {
  /** Clave estable para recordar si el admin colapsó este banner (localStorage). */
  storageKey: string;
  /** Título corto del apartado, p. ej. "Cartera". */
  title: string;
  /** Qué resuelve el apartado. */
  purpose: React.ReactNode;
  /** Cómo se usa / de dónde salen y a dónde van los datos. */
  how: React.ReactNode;
  className?: string;
};

const KEY_PREFIX = "vivaru:section-intro:";

/**
 * Banner explicativo colapsable que encabeza cada apartado del módulo Financiero.
 * Explica "para qué sirve" y "cómo funciona" el apartado. El admin puede colapsarlo
 * y la preferencia se recuerda por apartado en localStorage. Copy neutral por país
 * (no afirma marcos legales específicos de CO/MX/EC). Ver wiki: layout-patterns.
 */
export function SectionIntro({ storageKey, title, purpose, how, className }: SectionIntroProps) {
  const storageId = `${KEY_PREFIX}${storageKey}`;
  const bodyId = `section-intro-${storageKey}`;
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(storageId) === "1") setCollapsed(true);
    } catch {
      // localStorage no disponible (modo privado / SSR): se queda expandido.
    }
  }, [storageId]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageId, next ? "1" : "0");
      } catch {
        // sin persistencia: el toggle igual funciona en la sesión actual.
      }
      return next;
    });
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-[var(--brand-700)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[var(--brand-900)]">{title}</h2>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] hover:bg-[var(--brand-200)]/40"
        >
          {collapsed ? "Cómo funciona" : "Ocultar"}
          <ChevronDown
            className={cn("h-4 w-4 [transition-property:transform] duration-200", collapsed ? "" : "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>

      {!collapsed ? (
        <dl id={bodyId} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Para qué sirve
            </dt>
            <dd className="mt-1 text-sm text-[var(--slate-700)]">{purpose}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Cómo funciona
            </dt>
            <dd className="mt-1 text-sm text-[var(--slate-700)]">{how}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
