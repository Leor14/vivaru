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
        src: "/product/perspectives-admin-cartera.webp",
        alt: "Cartera e historial en Vivaru Admin",
        width: 1440,
        height: 900,
      },
      {
        src: "/product/perspectives-admin-reservations.webp",
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
        src: "/product/perspectives-resident-account.webp",
        alt: "Estado de cuenta en Portal del Residente",
        width: 390,
        height: 844,
      },
      {
        src: "/product/perspectives-resident-reservations.webp",
        alt: "Reservas con calendario en Portal del Residente",
        width: 390,
        height: 844,
      },
      {
        src: "/product/perspectives-resident-visitor.webp",
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
        src: "/product/perspectives-porteria-scanner.webp",
        alt: "Validación QR en Panel de Portería",
        width: 1024,
        height: 768,
      },
      {
        src: "/product/perspectives-porteria-packages.webp",
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
        src: "/product/perspectives-comite-tablero.webp",
        alt: "Reporte de comité — tablero ejecutivo en Vivaru",
        width: 1996,
        height: 1512,
      },
      {
        src: "/product/perspectives-comite-cartera.webp",
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

/** Tinta oscura del perfil. Sobre el fondo oscuro solo sirve encima de blanco. */
const HEADLINE_COLOR: Record<TabKey, string> = {
  admin: "text-navy",
  residente: "text-brand-green-resident",
  porteria: "text-brand-plum-dark",
  comite: "text-brand-blue",
};

/**
 * Fondo fotográfico por perfil.
 *
 * `opacidad` y `velo` NO son iguales para los cuatro, y ahí está el trabajo.
 * Con valores uniformes, la luminancia media del lado de la imagen iba de
 * 0,0065 en portería a 0,0142 en residente —más del doble—, y al cambiar de
 * pestaña se sentía como si subieran y bajaran las luces de la sala. Estos
 * salen de resolver esa igualdad con `scripts/simular-capa-perspectivas.mjs`,
 * que compone las capas exactas y mide; dejan la dispersión en 1,12×.
 *
 * `scripts/verificar-fondos-perspectivas.mjs` lo comprueba después sobre el
 * render del navegador, que es lo que cuenta.
 *
 * `base` es un color sólido bajo la foto, y no es decorativo: si la imagen
 * tarda o falla, el texto blanco sigue siendo legible. Sin él, un fallo de red
 * deja texto blanco sobre blanco.
 */
type FondoDef = {
  src: string;
  base: string;
  tinte: string;
  opacidad: number;
  /** Alfa del degradado en el extremo derecho. */
  velo: number;
  /** Acento legible SOBRE el fondo compuesto; el de marca es demasiado oscuro. */
  acento: string;
};

const FONDOS: Record<TabKey, FondoDef> = {
  admin: {
    src: "/product/perspectives-fondo-admin.webp",
    base: "#04121C",
    tinte: "#0B3C5D",
    opacidad: 0.5,
    velo: 0.14,
    acento: "text-brand-blue-light",
  },
  residente: {
    src: "/product/perspectives-fondo-residente.webp",
    base: "#04160D",
    tinte: "#1A7A45",
    opacidad: 0.2,
    velo: 0.45,
    acento: "text-brand-green-resident-light",
  },
  porteria: {
    src: "/product/perspectives-fondo-porteria.webp",
    // Base aclarada a propósito. Con el ciruela original (#12061D) esta banda
    // quedaba en 0,0085 de luminancia contra 0,0130 del resto, y ni con la foto
    // al 100 % subía: la imagen es oscura de origen. Subir la base es el único
    // mando que quedaba.
    base: "#2A1344",
    tinte: "#3D1460",
    opacidad: 1,
    velo: 0.04,
    acento: "text-brand-plum-light",
  },
  comite: {
    src: "/product/perspectives-fondo-comite.webp",
    base: "#0A0D22",
    tinte: "#4B5FD4",
    opacidad: 0.7,
    velo: 0.6,
    acento: "text-brand-blue-accent-light",
  },
};

/**
 * Un paso del escalonado del panel.
 *
 * 10 px y no un porcentaje, a diferencia del revelado por scroll: aquí los
 * elementos son líneas de texto de altura muy distinta —un ambiente de 12 px y
 * un titular de 40—, y un porcentaje haría que el titular recorriera cuatro
 * veces más que la etiqueta. En una entrada por scroll eso es deseable; dentro
 * de un panel que se sustituye, no: se lee como que cada línea va a su aire.
 */
const PASO = {
  oculto: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] as const } },
};

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * El degradado direccional: la garantía de contraste.
 *
 * No se puede confiar en que una foto sea oscura justo donde cae el texto —de
 * las cuatro, solo una respetó el encargo—, así que lo garantiza el degradado
 * con independencia de la imagen. **La meseta alta llega al 48 %** porque ahí
 * termina la columna de texto: ocupa el 42 % del `container`, que está centrado
 * a 1280 px, o sea del 17 % al 45 % de la pantalla en un viewport de 1920.
 * Acortarla deja el final de las líneas largas en la zona clara.
 *
 * Medido sobre las cuatro imágenes compuestas: 17,0:1 el peor caso. AAA.
 */
function degradadoAncho(f: FondoDef) {
  return `linear-gradient(100deg, ${rgba(f.base, 0.93)} 0%, ${rgba(f.base, 0.86)} 48%, ${rgba(f.base, f.velo + 0.22)} 70%, ${rgba(f.base, f.velo)} 100%)`;
}

/** En móvil la rejilla se apila y el texto cruza todo el ancho: el velo gira. */
function degradadoAlto(f: FondoDef) {
  return `linear-gradient(to bottom, ${rgba(f.base, 0.91)} 0%, ${rgba(f.base, 0.82)} 55%, ${rgba(f.base, 0.62)} 100%)`;
}

/**
 * Las cuatro capas apiladas; solo cambia la opacidad.
 *
 * No se montan y desmontan a propósito: eso parpadearía y volvería a
 * decodificar la imagen en cada cambio de pestaña.
 *
 * Cruzan en 450 ms, más lento que los 200 ms del panel. Si van a la vez, la
 * sección entera pestañea; desfasados, el texto cambia y el ambiente lo
 * alcanza después.
 */
function Fondos({ activo, cargados }: { activo: TabKey; cargados: Set<TabKey> }) {
  return (
    // `overflow-clip` y NO `overflow-hidden`. `hidden` crea un contenedor de
    // desplazamiento, y `animation-timeline: view()` resuelve contra el
    // scrollport MÁS CERCANO: con `hidden` el progreso se queda clavado porque
    // ese contenedor nunca se desplaza. `clip` recorta igual sin crearlo.
    // Es la misma trampa que tuvo el sticky del header con `body`.
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-clip">
      {(Object.keys(FONDOS) as TabKey[]).map((k) => {
        const f = FONDOS[k];
        const visible = k === activo;
        return (
          <div
            key={k}
            className={cn(
              "absolute inset-0 transition-opacity duration-[450ms] ease-out",
              "motion-reduce:transition-none",
              visible ? "opacity-100" : "opacity-0",
            )}
            style={{ backgroundColor: f.base }}
          >
            {/* Solo se descarga la del perfil que se ha visitado. Las cuatro
                están dentro del viewport cuando la sección entra, así que
                `loading="lazy"` no bastaría: las pediría todas igual. */}
            {cargados.has(k) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.src}
                alt=""
                // 130 % de alto y desplazada hacia arriba: el paralaje mueve la
                // imagen dentro de ese margen, y sin él asomaría el borde.
                className="paralaje absolute -top-[15%] left-0 h-[130%] w-full object-cover"
                style={{ opacity: f.opacidad }}
                decoding="async"
                fetchPriority={visible ? "auto" : "low"}
              />
            ) : null}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: f.tinte, opacity: 0.34 }}
            />
            <div
              className="absolute inset-0 lg:hidden"
              style={{ backgroundImage: degradadoAlto(f) }}
            />
            <div
              className="absolute inset-0 hidden lg:block"
              style={{ backgroundImage: degradadoAncho(f) }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Composite layouts ───────────────────────────────────────────────────────

/**
 * Admin — desktop primary + desktop secondary overlaid bottom-right.
 * pb/pr on the container create room for the overlay to extend outside.
 */
/**
 * Entrada de una captura al cambiar de pestaña.
 *
 * El escalonado del panel arreglaba la COLUMNA DE TEXTO; las capturas seguían
 * entrando de golpe con el panel, y son lo que más ocupa la pantalla: por eso
 * el cambio se seguía leyendo como un pantallazo aunque ya no hubiera hueco
 * en blanco.
 *
 * Tres cosas a la vez, y ninguna sobra:
 *
 *  - `opacity`, para que aparezca.
 *  - `scale` desde 0,96 —nunca desde 0: nada en el mundo real aparece de la
 *    nada, y arrancar de cero se lee como un salto.
 *  - `y` de 14 px, que es lo que convierte «apareció» en «llegó».
 *
 * Y un `blur` de salida de 4 px: durante el cruce se ven DOS composiciones
 * superpuestas, y sin desenfoque el ojo las distingue como dos objetos
 * distintos en vez de leerlo como una transformación.
 */
const PASO_CAPTURA = {
  oculto: { opacity: 0, scale: 0.96, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] as const },
  },
};

/**
 * Envoltorio que reparte la entrada de las capturas.
 *
 * `delayChildren` de 0,1 s: las capturas entran DESPUÉS del texto, no a la vez.
 * El orden importa — primero se lee de quién va la pestaña y luego llegan sus
 * pantallas.
 */
function Capturas({ children, reducido }: { children: React.ReactNode; reducido: boolean }) {
  return (
    <m.div
      initial={reducido ? false : "oculto"}
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: reducido ? 0 : 0.09,
            delayChildren: reducido ? 0 : 0.1,
          },
        },
      }}
      className="contents"
    >
      {children}
    </m.div>
  );
}

function AdminComposite({ shots }: { shots: ShotDef[] }) {
  // Sin `max-w-*`: globals.css tiene overrides `.marketing-theme .max-w-lg`
  // con más especificidad que cualquier variante responsive, así que un
  // `lg:max-w-none` encima no gana nunca (ver tailwind-v4-spacing-fix).
  // El ancho lo pone la columna de la rejilla, que es donde debe estar.
  return (
    <div className="relative w-full pb-8 pr-7">
      <m.div variants={PASO_CAPTURA}>
        <AssetSlot
          asset={shots[0]}
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="w-full rounded-xl border border-slate-200 shadow-brand-md"
        />
      </m.div>
      {shots[1] && (
        <m.div
          variants={PASO_CAPTURA}
          className="absolute bottom-0 right-0 z-10 w-[56%]"
        >
          <AssetSlot
            asset={shots[1]}
            sizes="(max-width: 1024px) 55vw, 25vw"
            className="w-full rounded-xl border border-slate-200 shadow-brand-lg"
          />
        </m.div>
      )}
    </div>
  );
}

/**
 * Residente — tres teléfonos escalonados: el del centro más alto y alineado
 * arriba, los laterales más estrechos y alineados abajo.
 *
 * Medidas en PORCENTAJE, no en píxeles. Estaban fijas en 420×360 con teléfonos
 * de 126 y 148 px, lo que daba dos problemas: en la columna ancha del rediseño
 * se veían diminutos, y 420 px ya no cabían en un móvil de 375. Con
 * `aspect-ratio` y anchos relativos, la composición se conserva exacta a
 * cualquier tamaño y el contenedor manda.
 *
 * Proporciones (teléfono 390×844, ~9:19.4):
 *   centro    35,4 % del ancho, alineado arriba
 *   laterales 30 % del ancho, alineados abajo
 */
function ResidenteComposite({ shots }: { shots: ShotDef[] }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[42rem]"
      style={{ aspectRatio: "700 / 600" }}
      aria-label="Portal del Residente en tres pantallas"
    >
      {/* Izquierda — estado de cuenta */}
      {shots[0] && (
        <m.div variants={PASO_CAPTURA} className="absolute bottom-0 left-0 w-[30%] overflow-hidden rounded-[8%] border border-slate-200 shadow-brand-md">
          <AssetSlot asset={shots[0]} sizes="(max-width: 1024px) 30vw, 15vw" className="block w-full" />
        </m.div>
      )}

      {/* Centro — reservas (protagonista) */}
      {shots[1] && (
        <m.div variants={PASO_CAPTURA} className="absolute left-1/2 top-0 z-10 w-[35.4%] -translate-x-1/2 overflow-hidden rounded-[8%] border border-slate-200 shadow-brand-lg">
          <AssetSlot asset={shots[1]} sizes="(max-width: 1024px) 36vw, 18vw" className="block w-full" />
        </m.div>
      )}

      {/* Derecha — QR de visita */}
      {shots[2] && (
        <m.div variants={PASO_CAPTURA} className="absolute bottom-0 right-0 w-[30%] overflow-hidden rounded-[8%] border border-slate-200 shadow-brand-md">
          <AssetSlot asset={shots[2]} sizes="(max-width: 1024px) 30vw, 15vw" className="block w-full" />
        </m.div>
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
      <m.div variants={PASO_CAPTURA}>
        <AssetSlot
          asset={shots[0]}
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="w-full rounded-xl border border-slate-200 shadow-brand-md"
        />
      </m.div>
      {shots[1] && (
        <m.div
          variants={PASO_CAPTURA}
          className="absolute bottom-0 right-0 z-10 w-[52%]"
        >
          <AssetSlot
            asset={shots[1]}
            sizes="(max-width: 1024px) 55vw, 25vw"
            className="w-full rounded-xl border border-slate-200 shadow-brand-lg"
          />
        </m.div>
      )}
    </div>
  );
}

function TabComposite({ tab, reducido }: { tab: TabDef; reducido: boolean }) {
  // Comité reusa el layout desktop del Admin (primario + secundario).
  const composite =
    tab.key === "admin" || tab.key === "comite" ? (
      <AdminComposite shots={tab.shots} />
    ) : tab.key === "residente" ? (
      <ResidenteComposite shots={tab.shots} />
    ) : (
      <PorteriaComposite shots={tab.shots} />
    );

  return <Capturas reducido={reducido}>{composite}</Capturas>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Perspectives() {
  const [tab, setTab] = React.useState<TabKey>("admin");
  const reduced = useReducedMotion();
  const triggersRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * Qué fondos se han pedido ya. Arranca solo con el activo.
   *
   * Los cuatro suman 268 KB, sobre una página que ya carga 1,3 MB de vídeo. Sin
   * esto, entrar en la sección los descarga todos aunque nadie toque una
   * pestaña. `precalentar` los pide al pasar el ratón o el foco, así que para
   * cuando el clic llega la imagen suele estar.
   */
  const [cargados, setCargados] = React.useState<Set<TabKey>>(() => new Set<TabKey>(["admin"]));
  const precalentar = React.useCallback((k: TabKey) => {
    setCargados((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  }, []);

  const changeTab = React.useCallback(
    (next: TabKey) => {
      precalentar(next);
      setTab((prev) => {
        if (prev !== next) {
          track("perspective_tab_change", { tab: next, from_tab: prev });
        }
        return next;
      });
    },
    [precalentar],
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
        className="relative isolate overflow-x-clip scroll-mt-24"
      >
        <Fondos activo={tab} cargados={cargados} />
        <div className="container py-xxl">
          <h2
            id="perspectivas-heading"
            className="max-w-3xl font-display text-h2 text-white text-balance"
          >
            Una plataforma, cuatro experiencias
          </h2>

          {/* Tab strip */}
          <div
            role="tablist"
            aria-label="Perspectivas por rol"
            className="mt-lg inline-flex flex-wrap gap-1 rounded-full bg-white/10 p-1 ring-1 ring-white/15 backdrop-blur-sm"
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
                  onMouseEnter={() => precalentar(t.key)}
                  onFocus={() => precalentar(t.key)}
                  className={cn(
                    // `transition-colors` no incluye transform, asi que la pastilla no acusaba
                    // la pulsacion. El 0.97 y los 150 ms salen de la referencia: alli el
                    // transform vive en 150 ms y solo se usa para responder, nunca para revelar.
                    "relative isolate inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium",
                    "transition-[color,background-color,transform] duration-fast ease-out-brand",
                    "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? HEADLINE_COLOR[t.key]
                      : "text-white/70 hover:text-white",
                  )}
                >
                  {isActive && (
                    <m.span
                      layoutId="tabHighlight"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-full bg-white"
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
          {/* Rejilla de UNA celda: los dos paneles ocupan la misma y se apilan,
              que es lo que permite el fundido sin que el layout salte. */}
          <div className="relative mt-xl grid">
            {/*
              FUNDIDO CRUZADO, no `mode="wait"`.

              Con `mode="wait"` AnimatePresence espera a que el panel saliente
              termine su animación ANTES de montar el entrante: 0,2 s de salida
              más 0,2 s de entrada, y a mitad de camino **no hay nada en
              pantalla**. Ese hueco vacío es el «pantallazo» que se notaba al
              cambiar de pestaña. No era que la transición fuese fea; era un
              parpadeo en blanco en medio.

              Sin `mode`, los dos paneles conviven durante la transición. El
              saliente se saca del flujo con `position:absolute` para que no
              empuje el layout mientras se va.

              El desenfoque por fin sirve para algo: fundir dos estados que se
              solapan. Con `wait` no había nada con lo que fundirse.
            */}
            <AnimatePresence initial={false}>
              <m.div
                key={active.key}
                id={`perspectives-panel-${active.key}`}
                role="tabpanel"
                aria-labelledby={`perspectives-tab-${active.key}`}
                initial={reduced ? false : { opacity: 0, filter: "blur(3px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }}
                transition={{ duration: reduced ? 0 : 0.28, ease: [0.23, 1, 0.32, 1] }}
                style={{ gridArea: "1 / 1" }}
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
                {/*
                  El contenido entra ESCALONADO, no en bloque.

                  Antes el panel era una losa: los cuatro bloques aparecían a la
                  vez. Con 45 ms entre uno y otro se lee como que la información
                  llega, no como que la pantalla se sustituye. Es el mismo
                  escalonado que usa el resto de la página (`revelado.ts`), así
                  que no introduce un gesto nuevo.
                */}
                <m.div
                  initial={reduced ? false : "oculto"}
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: reduced ? 0 : 0.045, delayChildren: reduced ? 0 : 0.06 } } }}
                >
                  {/* El color del perfil se muda aquí y a los números: sobre el
                      fondo oscuro ya no puede vivir en el titular. */}
                  <m.p
                    variants={PASO}
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.14em]",
                      FONDOS[active.key].acento,
                    )}
                  >
                    Hoy
                  </m.p>
                  <m.p
                    variants={PASO}
                    className="mt-1 text-lg italic leading-snug text-white/75 text-balance"
                  >
                    “{active.problem}”
                  </m.p>

                  <m.h3
                    variants={PASO}
                    className="mt-lg font-display text-h2 text-balance text-white"
                  >
                    {active.headline}
                  </m.h3>

                  <m.ol variants={PASO} className="mt-md space-y-4">
                    {active.steps.map((paso, i) => (
                      <li key={paso} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                            "bg-white/10 ring-1 ring-white/20",
                            FONDOS[active.key].acento,
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="text-base leading-relaxed text-white/80">
                          {paso}
                        </span>
                      </li>
                    ))}
                  </m.ol>
                </m.div>

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
                  <TabComposite tab={active} reducido={reduced} />
                </div>
              </m.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
