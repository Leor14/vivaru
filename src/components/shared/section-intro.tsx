"use client";

import { ChevronDown, Info } from "lucide-react";
import * as React from "react";

import { getIconTone, type IconToneName } from "@/lib/ui/icon-tones";
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
  /** Icono del apartado. Por defecto el de información. */
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Tono del chip, del sistema pastel del producto (`--icon-*`). */
  tone?: IconToneName;
  className?: string;
};

const KEY_PREFIX = "vivaru:section-intro:";

/**
 * Banner explicativo colapsable que encabeza un apartado: para qué sirve y cómo
 * funciona. El admin puede colapsarlo y la preferencia se recuerda por apartado.
 * Copy neutral por país (no afirma marcos legales específicos de CO/MX/EC).
 *
 * Comparte lenguaje visual con la banda del recorrido guiado
 * (`guided-step-banner.tsx`): mismo chip de icono, mismo degradado, mismos
 * encabezados "Para qué sirve / Cómo funciona". No es decoración: cuando el
 * administrador llega aquí desde la guía, la ayuda que ya venía leyendo y la
 * de la sección tienen que verse como la misma voz, no como dos productos.
 */
export function SectionIntro({
  storageKey,
  title,
  purpose,
  how,
  icon: Icon = Info,
  tone = "sky",
  className,
}: SectionIntroProps) {
  const storageId = `${KEY_PREFIX}${storageKey}`;
  const bodyId = `section-intro-${storageKey}`;
  const [collapsed, setCollapsed] = React.useState(false);
  const token = getIconTone(tone);

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
        "rounded-2xl border border-[var(--brand-200)]/70 bg-gradient-to-br from-white via-[var(--brand-50)]/70 to-[var(--sky-50)] px-4 py-4 shadow-[0_4px_16px_rgba(12,33,53,0.05)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
            style={{ backgroundColor: token.mutedBg, color: token.mutedFg }}
            aria-hidden
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          <h2 className="truncate text-base font-semibold tracking-tight text-[var(--brand-900)]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--brand-700)] [transition:background-color_150ms_var(--ease-out),transform_140ms_var(--ease-out)] hover:bg-white/80 active:scale-95"
        >
          {collapsed ? "Cómo funciona" : "Ocultar"}
          <ChevronDown
            className={cn(
              "h-4 w-4 [transition-property:transform] duration-200 ease-[var(--ease-out)]",
              collapsed ? "" : "rotate-180",
            )}
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
