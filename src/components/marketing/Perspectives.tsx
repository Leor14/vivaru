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
 * Each tab now supports multiple product screenshots via `shots[]`.
 * Three composite layouts:
 *   - AdminComposite    — desktop primary + desktop secondary (bottom-right overlay)
 *   - ResidenteComposite — 3 phones staggered (left/right lower, center taller)
 *   - PorteriaComposite  — tablet primary + tablet secondary (bottom-right overlay)
 *
 * Shots with `src: undefined` render as styled placeholders matching the
 * correct aspect ratio — they flip to real images once PNGs are dropped in
 * /public/product/ (Phase 2 of the screenshot capture sprint).
 */

type TabKey = "admin" | "residente" | "porteria" | "comite";

type ShotDef = {
  /** Undefined while screenshot is pending. */
  src?: string;
  alt: string;
  /** Intrinsic pixel dimensions for next/image (also used for placeholder aspect ratio). */
  width: number;
  height: number;
};

type TabDef = {
  key: TabKey;
  label: string;
  /** Capa 1: el problema en la voz del perfil. */
  problem: string;
  headline: string;
  bullets: string[];
  /** Capa 3: un caso de uso concreto en una línea. */
  inPractice: string;
  shots: ShotDef[];
  textActive: string;
  bgActive: string;
  ringActive: string;
};

const TABS: TabDef[] = [
  {
    key: "admin",
    label: "Admin",
    problem:
      "Llevo la cartera en Excel, persigo los pagos por WhatsApp y armo el reporte a mano. Nunca sé con certeza quién pagó.",
    headline: "Centro de control completo",
    bullets: [
      "Cobra en lote y recuerda a morosos automáticamente",
      "Aprueba comprobantes y concilia en un clic",
      "Comunicados oficiales con lectura confirmada",
      "Cierra el mes y archiva el reporte",
    ],
    inPractice:
      "Lanzas la cuota de junio a 120 unidades, el sistema notifica, apruebas los comprobantes en un clic y cierras el mes con el reporte listo.",
    shots: [
      {
        src: "/product/perspectives-admin-cartera.png",
        alt: "Cartera e historial en Vivaru Admin",
        width: 1440,
        height: 900,
      },
      {
        src: "/product/perspectives-admin-reservations.png",
        alt: "Calendario de reservas en Vivaru Admin",
        width: 1440,
        height: 900,
      },
    ],
    textActive: "text-white",
    bgActive: "bg-navy",
    ringActive: "ring-navy",
  },
  {
    key: "residente",
    label: "Residente",
    problem:
      "No sé cuánto debo, pago y nadie me confirma, y me entero tarde de lo del conjunto. Para una visita tengo que llamar a portería.",
    headline: "Autoservicio 24/7",
    bullets: [
      "Estado de cuenta y saldo en su teléfono",
      "QR pre-autorizado para visitas",
      "Comprobantes de pago desde el celular",
      "PQRS con código y semáforo",
    ],
    inPractice:
      "Ves tu saldo, subes el comprobante y recibes la confirmación; generas un QR y tu invitado entra sin llamadas.",
    shots: [
      {
        src: "/product/perspectives-resident-account.png",
        alt: "Estado de cuenta en Portal del Residente",
        width: 390,
        height: 844,
      },
      {
        src: "/product/perspectives-resident-reservations.png",
        alt: "Reservas con calendario en Portal del Residente",
        width: 390,
        height: 844,
      },
      {
        src: "/product/perspectives-resident-visitor.png",
        alt: "Crear invitación de visita en Portal del Residente",
        width: 390,
        height: 844,
      },
    ],
    textActive: "text-white",
    bgActive: "bg-brand-green-resident",
    ringActive: "ring-brand-green-resident",
  },
  {
    key: "porteria",
    label: "Portería",
    problem:
      "Autorizo visitas por llamada, anoto los paquetes en un cuaderno y del turno no queda registro.",
    headline: "Tu portería, ordenada",
    bullets: [
      "Validación instantánea con QR",
      "Recepción de paquetes con foto y firma",
      "Calendario de reservas en lectura",
      "Bitácora digital del turno",
    ],
    inPractice:
      "Escaneas el QR y la visita entra autorizada, registras el paquete con foto y firma, y dejas una nota con evidencia que el admin ve al instante.",
    shots: [
      {
        src: "/product/perspectives-porteria-scanner.png",
        alt: "Validación QR en Panel de Portería",
        width: 1024,
        height: 768,
      },
      {
        src: "/product/perspectives-porteria-packages.png",
        alt: "Recepción de paquetes en Panel de Portería",
        width: 1024,
        height: 768,
      },
    ],
    textActive: "text-white",
    bgActive: "bg-brand-plum-dark",
    ringActive: "ring-brand-plum-dark",
  },
  {
    key: "comite",
    label: "Comité",
    problem:
      "Llego a la asamblea sin datos duros, las decisiones no quedan documentadas y no sé si las finanzas del conjunto están sanas.",
    headline: "Gobierna con evidencia",
    bullets: [
      "Reporte de comité: tablero ejecutivo y comparativo",
      "Antigüedad de cartera (aging) y alertas tempranas",
      "Acuerdos con aprobación y firma",
      "Informe exportable a PDF y Excel",
    ],
    inPractice:
      "Generas el reporte del trimestre, registras los acuerdos firmados en la junta y exportas el informe a PDF para la asamblea.",
    shots: [
      {
        src: "/product/perspectives-comite-reporte.png",
        alt: "Reporte de comité — tablero ejecutivo",
        width: 1440,
        height: 900,
      },
      {
        src: "/product/perspectives-comite-acuerdos.png",
        alt: "Antigüedad de cartera y acuerdos firmados",
        width: 1440,
        height: 900,
      },
    ],
    textActive: "text-white",
    bgActive: "bg-brand-blue",
    ringActive: "ring-brand-blue",
  },
];

const HEADLINE_COLOR: Record<TabKey, string> = {
  admin: "text-navy",
  residente: "text-brand-green-resident",
  porteria: "text-brand-plum-dark",
  comite: "text-brand-blue",
};

// ─── Shot helper ─────────────────────────────────────────────────────────────

/**
 * Renders a next/image when src is present, or a styled placeholder that
 * preserves the correct aspect ratio while screenshots are pending.
 */
function Shot({
  shot,
  className,
  sizes = "(max-width: 1024px) 100vw, 50vw",
}: {
  shot: ShotDef;
  className?: string;
  sizes?: string;
}) {
  if (shot.src) {
    return (
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes={sizes}
        className={cn("h-auto", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-slate-100 text-center",
        className,
      )}
      style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
      role="img"
      aria-label={shot.alt}
    >
      <div className="p-3">
        <p className="text-[11px] font-medium leading-snug text-slate-500">
          {shot.alt}
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-widest text-slate-400">
          Pendiente
        </p>
      </div>
    </div>
  );
}

// ─── Composite layouts ───────────────────────────────────────────────────────

/**
 * Admin — desktop primary + desktop secondary overlaid bottom-right.
 * pb/pr on the container create room for the overlay to extend outside.
 */
function AdminComposite({ shots }: { shots: ShotDef[] }) {
  return (
    <div className="relative w-full max-w-lg pb-8 pr-7">
      <Shot
        shot={shots[0]}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="w-full rounded-xl border border-slate-200 shadow-brand-md"
      />
      {shots[1] && (
        <Shot
          shot={shots[1]}
          sizes="(max-width: 1024px) 55vw, 25vw"
          className="absolute bottom-0 right-0 z-10 w-[56%] rounded-xl border border-slate-200 shadow-brand-lg"
        />
      )}
    </div>
  );
}

/**
 * Residente — 3 phones in staggered composition.
 * Center phone is taller (top-aligned); left and right phones are
 * bottom-aligned and slightly narrower, flanking the center.
 *
 * Container is 420 × 360 px (explicit) so absolute children don't collapse it.
 * Phone dimensions (390 × 844 aspect ~9:19.4):
 *   center: 148 px wide → ~320 px tall
 *   sides:  126 px wide → ~273 px tall
 * Stagger: center top at 0, sides top at 360 - 273 = 87 px → 87 px lower.
 */
function ResidenteComposite({ shots }: { shots: ShotDef[] }) {
  return (
    <div
      className="relative mx-auto"
      style={{ width: 420, height: 360 }}
      aria-label="Portal del Residente en tres pantallas"
    >
      {/* Left phone — cuenta/estado */}
      {shots[0] && (
        <div
          className="absolute bottom-0 left-0 overflow-hidden rounded-[28px] border border-slate-200 shadow-brand-md"
          style={{ width: 126 }}
        >
          <Shot
            shot={shots[0]}
            sizes="126px"
            className="block w-full"
          />
        </div>
      )}

      {/* Center phone — reservas (protagonist) */}
      {shots[1] && (
        <div
          className="absolute top-0 left-1/2 z-10 overflow-hidden rounded-[30px] border border-slate-200 shadow-brand-lg"
          style={{ width: 148, transform: "translateX(-50%)" }}
        >
          <Shot
            shot={shots[1]}
            sizes="148px"
            className="block w-full"
          />
        </div>
      )}

      {/* Right phone — QR visita */}
      {shots[2] && (
        <div
          className="absolute bottom-0 right-0 overflow-hidden rounded-[28px] border border-slate-200 shadow-brand-md"
          style={{ width: 126 }}
        >
          <Shot
            shot={shots[2]}
            sizes="126px"
            className="block w-full"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Portería — tablet primary + tablet secondary overlaid bottom-right.
 * Same structure as Admin but with 4:3 tablet aspect ratio.
 */
function PorteriaComposite({ shots }: { shots: ShotDef[] }) {
  return (
    <div className="relative w-full max-w-lg pb-7 pr-6">
      <Shot
        shot={shots[0]}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="w-full rounded-xl border border-slate-200 shadow-brand-md"
      />
      {shots[1] && (
        <Shot
          shot={shots[1]}
          sizes="(max-width: 1024px) 55vw, 25vw"
          className="absolute bottom-0 right-0 z-10 w-[52%] rounded-xl border border-slate-200 shadow-brand-lg"
        />
      )}
    </div>
  );
}

function TabComposite({ tab }: { tab: TabDef }) {
  // Comité reusa el layout desktop del Admin (primario + secundario).
  if (tab.key === "admin" || tab.key === "comite") return <AdminComposite shots={tab.shots} />;
  if (tab.key === "residente") return <ResidenteComposite shots={tab.shots} />;
  return <PorteriaComposite shots={tab.shots} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

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
            Una plataforma, cuatro experiencias
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
                {/* Copy — 3 capas: problema → solución → en la práctica */}
                <div>
                  {/* Capa 1 — el problema, en la voz del perfil */}
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    El problema
                  </p>
                  <p className="mt-1 text-lg italic leading-snug text-slate-500 text-balance">
                    “{active.problem}”
                  </p>

                  {/* Capa 2 — la solución */}
                  <h3
                    className={cn(
                      "mt-lg font-display text-h2 text-balance",
                      HEADLINE_COLOR[active.key],
                    )}
                  >
                    {active.headline}
                  </h3>
                  <ul role="list" className="mt-md space-y-3">
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

                  {/* Capa 3 — en la práctica (caso de uso) */}
                  <div className="mt-lg rounded-xl bg-white p-4 shadow-brand-sm ring-1 ring-border">
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-[0.14em]",
                        HEADLINE_COLOR[active.key],
                      )}
                    >
                      En la práctica
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {active.inPractice}
                    </p>
                  </div>
                </div>

                {/* Composite */}
                <div className="flex justify-center lg:justify-end">
                  <TabComposite tab={active} />
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
