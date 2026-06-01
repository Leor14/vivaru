"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import { track } from "@/lib/marketing/analytics";
import { useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Perspectivas — tabs (journey.md §B step 5 / plan §5.6).
 *
 * Hand-rolled tab UI (not the shadcn primitive) so we can carry per-tab
 * accent colors + a framer-motion `layoutId` highlight that magic-moves
 * between tab triggers. Keyboard a11y: ArrowLeft/Right cycles, Home/End
 * jump to first/last, Enter/Space activate (native button semantics).
 *
 * Telemetry: `perspective_tab_change` fires on every switch with
 * `{ tab, from_tab }`. Initial mount does NOT count as a change.
 */

type TabKey = "admin" | "residente" | "porteria";

type TabDef = {
  key: TabKey;
  label: string;
  headline: string;
  bullets: string[];
  /** CSS classes for the right-side product shot container. */
  shotClass: string;
  shotLabel: string;
  /** Src for the product screenshot. Undefined = keep HITL placeholder. */
  shotSrc?: string;
  shotW: number;
  shotH: number;
  /** Tailwind colour utilities for this tab's accent. */
  textActive: string;
  bgActive: string;
  ringActive: string;
};

const TABS: TabDef[] = [
  {
    key: "admin",
    label: "Admin",
    headline: "Centro de control completo",
    bullets: [
      "Dashboard de cartera y KPIs en tiempo real",
      "Comunicados oficiales con lectura confirmada",
      "PQRS con plazo de respuesta",
      "Reservas con calendario visual",
    ],
    shotClass: "w-full max-w-xl",
    shotLabel: "Cartera y KPIs en tiempo real",
    shotSrc: "/product/perspectives-admin-cartera.png",
    shotW: 1440,
    shotH: 900,
    textActive: "text-white",
    bgActive: "bg-navy",
    ringActive: "ring-navy",
  },
  {
    key: "residente",
    label: "Residente",
    headline: "Autoservicio 24/7",
    bullets: [
      "Estado de cuenta y saldo en su teléfono",
      "QR pre-autorizado para visitas",
      "Comprobantes de pago desde el celular",
      "PQRS con código y semáforo",
    ],
    shotClass: "w-full max-w-[260px]",
    shotLabel: "Crear invitación de visita en Vivaru",
    shotSrc: "/product/perspectives-resident-visitor.png",
    shotW: 390,
    shotH: 844,
    textActive: "text-white",
    bgActive: "bg-brand-green-resident",
    ringActive: "ring-brand-green-resident",
  },
  {
    key: "porteria",
    label: "Portería",
    headline: "Tu portería, ordenada",
    bullets: [
      "Validación instantánea con QR",
      "Recepción de paquetes con foto y firma",
      "Calendario de reservas en lectura",
      "Bitácora digital del turno",
    ],
    shotClass: "aspect-[1024/768] w-full max-w-lg",
    shotLabel: "Panel Portería · tablet",
    shotSrc: undefined,
    shotW: 1024,
    shotH: 768,
    textActive: "text-white",
    bgActive: "bg-brand-plum-dark",
    ringActive: "ring-brand-plum-dark",
  },
];

const HEADLINE_COLOR: Record<TabKey, string> = {
  admin: "text-navy",
  residente: "text-brand-green-resident",
  porteria: "text-brand-plum-dark",
};

export function Perspectives() {
  const [tab, setTab] = React.useState<TabKey>("admin");
  const reduced = useReducedMotion();
  const triggersRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  const changeTab = React.useCallback(
    (next: TabKey) => {
      setTab((prev) => {
        if (prev !== next) {
          track("perspective_tab_change", { tab: next, from_tab: prev });
        }
        return next;
      });
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const last = TABS.length - 1;
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = currentIndex === last ? 0 : currentIndex + 1;
    else if (e.key === "ArrowLeft") nextIndex = currentIndex === 0 ? last : currentIndex - 1;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = last;
    else return;
    e.preventDefault();
    const nextKey = TABS[nextIndex].key;
    changeTab(nextKey);
    triggersRef.current[nextIndex]?.focus();
  };

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <LazyMotion features={domAnimation} strict>
    <section
      id="perspectivas"
      aria-labelledby="perspectivas-heading"
      className="bg-slate-50 scroll-mt-24"
    >
      <div className="container py-xxl">
        <h2
          id="perspectivas-heading"
          className="max-w-3xl font-display text-h2 text-navy text-balance"
        >
          Una plataforma, tres experiencias
        </h2>

        {/* Tab strip */}
        <div
          role="tablist"
          aria-label="Perspectivas por rol"
          className="mt-lg inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-brand-sm ring-1 ring-border"
        >
          {TABS.map((t, i) => {
            const isActive = t.key === tab;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  triggersRef.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`perspectives-tab-${t.key}`}
                aria-selected={isActive}
                aria-controls={`perspectives-panel-${t.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => changeTab(t.key)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "relative isolate inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors duration-fast",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive ? t.textActive : "text-slate-600 hover:text-slate-900",
                )}
              >
                {isActive && (
                  <m.span
                    layoutId="tabHighlight"
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 -z-10 rounded-full",
                      t.bgActive,
                    )}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 500, damping: 40 }
                    }
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="relative mt-xl">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={active.key}
              id={`perspectives-panel-${active.key}`}
              role="tabpanel"
              aria-labelledby={`perspectives-tab-${active.key}`}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, ease: "easeOut" }}
              className="grid items-center gap-xl lg:grid-cols-2 lg:gap-xxl"
            >
              <div>
                <h3
                  className={cn(
                    "font-display text-h2 text-balance",
                    HEADLINE_COLOR[active.key],
                  )}
                >
                  {active.headline}
                </h3>
                <ul role="list" className="mt-lg space-y-3">
                  {active.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex gap-2 text-base leading-relaxed text-slate-600"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-2.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                          active.bgActive,
                        )}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-center lg:justify-end">
                {active.shotSrc ? (
                  <Image
                    src={active.shotSrc}
                    alt={active.shotLabel}
                    width={active.shotW}
                    height={active.shotH}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className={cn(
                      "rounded-xl border border-slate-200 shadow-brand-md",
                      active.shotClass,
                    )}
                  />
                ) : (
                  // HITL H7 — pending Ronda 2 (Firestore ID + tildes en SaaS)
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-md text-center text-sm text-slate-500 shadow-brand-md",
                      active.shotClass,
                    )}
                    role="img"
                    aria-label={`Screenshot pendiente — ${active.shotLabel}`}
                  >
                    <div>
                      <p className="font-medium text-slate-600">{active.shotLabel}</p>
                      <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
                        Screenshot pendiente — H7 Ronda 2
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
    </LazyMotion>
  );
}
