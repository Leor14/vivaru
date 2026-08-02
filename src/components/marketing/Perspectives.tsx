"use client";

import * as React from "react";
import { AssetSlot, type AssetDef } from "@/components/marketing/ui/asset-slot";
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
 * Los huecos sin `src` los pinta `AssetSlot` respetando la proporción final,
 * y se convierten en imagen al soltar el PNG en /public/product/. Ese helper
 * nació aquí y ahora lo comparten las 8 secciones del rediseño del landing
 * (docs/plan-rediseno-landing.md).
 */

type TabKey = "admin" | "residente" | "porteria" | "comite";

/** El contrato vive en `AssetSlot`: mismo hueco en las 8 secciones del rediseño. */
type ShotDef = AssetDef;

type TabDef = {
  key: TabKey;
  label: string;
  /** Capa 1: el problema en la voz del perfil. */
  problem: string;
  headline: string;
  /** Tres pasos EN ORDEN. Sustituyen a la lista de features y a la caja de
      «en la práctica», que decían lo mismo dos veces. El orden importa: es la
      secuencia real del mes, no una enumeración. */
  steps: string[];
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
    headline: "Tu mes, de principio a fin",
    steps: [
      "Lanzas la cuota del mes a las 120 unidades de una sola vez.",
      "El sistema le recuerda a quien no ha pagado; tú solo apruebas los comprobantes que van llegando.",
      "Cierras el período y el reporte queda archivado, listo para la asamblea.",
    ],
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
    headline: "Todo desde su teléfono",
    steps: [
      "Entra y ve cuánto debe y cuándo vence, sin preguntarle a nadie.",
      "Sube el comprobante y recibe la confirmación cuando lo apruebas.",
      "Genera un QR para su visita y en portería la dejan entrar.",
    ],
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
    headline: "El turno, ordenado",
    steps: [
      "Escanea el QR del visitante y la entrada queda autorizada y registrada.",
      "Recibe el paquete con foto y firma de quien lo entrega.",
      "Cierra el turno y la bitácora le llega al administrador.",
    ],
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
    headline: "Llegas a la asamblea con evidencia",
    steps: [
      "Abres el reporte del trimestre con la cartera y su antigüedad.",
      "Registras los acuerdos de la junta y quedan firmados.",
      "Exportas el informe a PDF y lo repartes.",
    ],
        shots: [
      {
        src: "/product/perspectives-comite-tablero.png",
        alt: "Reporte de comité — tablero ejecutivo en Vivaru",
        width: 1996,
        height: 1512,
      },
      {
        src: "/product/perspectives-comite-cartera.png",
        alt: "Antigüedad de cartera y mayores deudores en Vivaru",
        width: 1984,
        height: 1520,
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

// ─── Composite layouts ───────────────────────────────────────────────────────

/**
 * Admin — desktop primary + desktop secondary overlaid bottom-right.
 * pb/pr on the container create room for the overlay to extend outside.
 */
function AdminComposite({ shots }: { shots: ShotDef[] }) {
  // Sin `max-w-*`: globals.css tiene overrides `.marketing-theme .max-w-lg`
  // con más especificidad que cualquier variante responsive, así que un
  // `lg:max-w-none` encima no gana nunca (ver tailwind-v4-spacing-fix).
  // El ancho lo pone la columna de la rejilla, que es donde debe estar.
  return (
    <div className="relative w-full pb-8 pr-7">
      <AssetSlot
        asset={shots[0]}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="w-full rounded-xl border border-slate-200 shadow-brand-md"
      />
      {shots[1] && (
        <AssetSlot
          asset={shots[1]}
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
          <AssetSlot
            asset={shots[0]}
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
          <AssetSlot
            asset={shots[1]}
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
          <AssetSlot
            asset={shots[2]}
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
    <div className="relative w-full pb-7 pr-6">
      <AssetSlot
        asset={shots[0]}
        sizes="(max-width: 1024px) 100vw, 45vw"
        className="w-full rounded-xl border border-slate-200 shadow-brand-md"
      />
      {shots[1] && (
        <AssetSlot
          asset={shots[1]}
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
        className="overflow-x-clip bg-slate-50 scroll-mt-24"
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
                initial={reduced ? false : { opacity: 0, scale: 0.99, filter: "blur(2px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.99, filter: "blur(2px)" }}
                transition={{ duration: reduced ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="grid items-center gap-xl lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-xxl"
              >
                {/*
                  Antes eran tres capas: el problema, una lista de features y
                  una caja de «en la práctica» que repetía la lista en prosa.
                  Dos de ellas decían lo mismo.

                  Ahora son dos movimientos: cómo es hoy, en la voz del perfil,
                  y qué pasa con Vivaru en tres pasos EN ORDEN. Es un `<ol>` a
                  propósito: la numeración no decora, es la secuencia real del
                  mes y el lector la sigue como tal.
                */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Hoy
                  </p>
                  <p className="mt-1 text-lg italic leading-snug text-slate-500 text-balance">
                    “{active.problem}”
                  </p>

                  <h3
                    className={cn(
                      "mt-lg font-display text-h2 text-balance",
                      HEADLINE_COLOR[active.key],
                    )}
                  >
                    {active.headline}
                  </h3>

                  <ol className="mt-md space-y-4">
                    {active.steps.map((paso, i) => (
                      <li key={paso} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            active.bgActive,
                            active.textActive,
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="text-base leading-relaxed text-slate-600">
                          {paso}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/*
                  Composite. Se ensancha y se sale por el borde derecho, como
                  en la sección de North de Cohere: da sensación de producto
                  grande sin pedir más alto a la sección.

                  El sangrado se hace con margen negativo y NO con `scale`.
                  Escalar agranda también en vertical, y `overflow-x-clip`
                  recorta solo en horizontal: el excedente de alto se habría
                  montado sobre la sección siguiente. Con margen negativo el
                  layout sigue siendo honesto y solo sobra lo que se recorta.
                */}
                <div className="flex justify-center lg:-mr-16 lg:justify-start xl:-mr-32">
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
