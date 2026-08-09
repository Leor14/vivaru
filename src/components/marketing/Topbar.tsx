"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Info } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/marketing/ui/button";
import { Tooltip } from "@/components/marketing/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/marketing/ui/sheet";
import { DemoDialog } from "@/components/marketing/DemoDialog";
import { track } from "@/lib/marketing/analytics";
import { Flecha } from "@/components/marketing/ui/flecha";

/**
 * Topbar — Sprint 1.
 *
 * Behaviour:
 *  - Sticky top, gains shadow once the user scrolls > 8 px.
 *  - Logo (SVG, w/ PNG fallback handled by the browser via <Image>).
 *  - Desktop nav: 4 anchor links → IDs from journey.md §B.
 *  - "Iniciar sesión": real anchor if NEXT_PUBLIC_PORTAL_LOGIN_URL is set,
 *    otherwise a button with a Tooltip explaining the activation state
 *    (decision rule §C — "User clicks Iniciar sesión AND portal URL empty").
 *  - "Agenda una demo": opens DemoDialog (Calendly placeholder for now).
 *  - Mobile: hamburger → Sheet from the right with the same links + the demo
 *    CTA. A separate fixed-bottom CTA stays visible at all times so the
 *    primary action is always one tap away (journey.md §B).
 */

const NAV_LINKS = [
  { label: "Producto", href: "/#solucion" },
  { label: "Soluciones", href: "/#perspectivas" },
  { label: "Recursos", href: "/#faq" },
] as const;

const PORTAL_LOGIN_TOOLTIP =
  "Portal en activación — agenda una demo y te enviamos credenciales.";

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function VivaruLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Vivaru — Inicio"
      className={cn(
        "inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      {/*
        Por qué el logo cambió de fichero, y por qué lleva `unoptimized`.

        `vivaru-logo.png` es un lienzo de 2048×2048 SIN canal alfa: pinta un
        cuadrado blanco opaco allá donde se ponga. No se veía mientras la barra
        era blanca de borde a borde, pero la píldora es translúcida y el fondo del
        hero es gris azulado, así que el recuadro se leía. En escritorio ya salía
        así en producción.

        El SVG que hay al lado NO sirve de reemplazo: es una silueta trazada a un
        solo color (`fill="#000000"`), no el logo a color. Vale para el pie, que
        es donde se usa.

        El alfa se sacó calando el blanco CONECTADO AL BORDE con un relleno por
        inundación, no por umbral: el icono lleva blancos interiores —los detalles
        de la casa, un 0,22 % del lienzo— que un umbral plano habría perforado. Se
        conserva el lienzo cuadrado a propósito: recortarlo al contenido real
        (1758×1154) haría el logo casi el doble de alto en pantalla, que es un
        cambio de diseño y no un arreglo.

        `unoptimized` es obligatorio, y esta es la parte que cuesta encontrar. Con
        un PNG/WebP con alfa, el optimizador de Next recodifica a AVIF —Chrome lo
        negocia por `Accept`— y el alfa sale destrozado: el logo se pinta como un
        fantasma gris casi invisible. El fichero en disco está bien; lo que rompe
        es la recodificación. Solo pasa en `next dev`: como documenta
        `next.config.ts`, App Hosting fuerza `unoptimized: true` en todo el sitio,
        así que desplegado se sirve el byte de disco y se ve correcto. Sin este
        prop, desarrollo y producción muestran cosas distintas y el fallo local
        parece del asset.

        Por eso el WebP va ya a su tamaño final —256 px, el máximo real es 64 px
        CSS a 4x—, igual que `public/product/`. 1,1 MB → 15 KB.
      */}
      <Image
        src="/brand/vivaru-logo.webp"
        alt=""
        width={256}
        height={256}
        priority
        unoptimized
        className="h-14 w-auto md:h-16"
      />
    </Link>
  );
}

/**
 * Acceso al portal para quien ya es cliente.
 *
 * Tamaño y variante se reciben porque los dos sitios donde vive piden cosas
 * distintas: en la barra de escritorio tiene que igualar la altura y la
 * tipografía de los otros dos CTA, y en el menú móvil el ancho completo de la
 * lista apilada. Estaba fijo en `size="default"` (h-10, texto de 14 normal)
 * junto a botones `xl` (h-12, 16 semibold) y `lg`, y se leía como un descuido.
 */
function LoginAction({
  portalUrl,
  size = "xl",
  variant = "ghost",
  className,
}: {
  portalUrl?: string;
  size?: "default" | "lg" | "xl";
  variant?: "ghost" | "outline";
  className?: string;
}) {
  if (portalUrl) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        render={
          <a
            href={portalUrl}
            onClick={() => track("cta_login_click")}
            rel="noopener"
          />
        }
      >
        Iniciar sesión
      </Button>
    );
  }
  // HITL H2 default — portal URL pending. Disabled-ish button with tooltip.
  return (
    <Tooltip label={PORTAL_LOGIN_TOOLTIP}>
      <Button
        variant={variant}
        size={size}
        className={className}
        type="button"
        onClick={() => track("cta_login_click", { state: "portal_pending" })}
      >
        Iniciar sesión
        <Info aria-hidden="true" className="ml-1 h-4 w-4 opacity-70" />
      </Button>
    </Tooltip>
  );
}

export function Topbar() {
  const scrolled = useScrolled(20);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  // H2 resolved: defaults to /login (same SaaS app). Override via env var if needed.
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_LOGIN_URL || '/login';
  const pathname = usePathname();
  // /diagnostico is a focused lead-magnet flow — the fixed mobile CTA would
  // compete with the page's own primary action. Suppress it there.
  const showMobileBottomCta = pathname !== "/diagnostico";

  return (
    <>
      {/*
        Un solo tratamiento en todos los anchos: píldora flotante que se contrae
        al bajar y pasa por encima del contenido.

        Antes eran dos. Móvil llevaba una barra sólida de borde a borde y solo
        escritorio tenía la píldora. El argumento era que en 390 px la píldora
        aprieta el logo contra el menú y que un segundo elemento flotante compite
        con el CTA fijo de abajo. Ninguna de las dos cosas resultó cierta al
        medirla: dentro de la píldora solo viven el logo y la hamburguesa, y el
        CTA de abajo está anclado al lado opuesto de la pantalla.

        Lo que sí costaba el tratamiento doble era la coherencia — el gesto que
        define la barra en escritorio, deslizarse por todo el sitio y compactarse,
        simplemente no existía en el móvil.

        El gesto se adapta, no se copia: en escritorio la píldora contrae su
        `max-width` de 80rem a 62rem, que en 390 px no significa nada. Aquí lo que
        se contrae es el margen lateral, de 1rem a 1,5rem, más el mismo salto de
        sombra. La proporción es equivalente y la propiedad animada, la misma.

        El ancho vive en el contenedor interno, no en el header, para que el fondo
        y el de la píldora nunca peleen en la cascada.

        Se dejó de usar la utilidad `container` aquí: define `max-width: 1280px`
        con la misma especificidad que `md:max-w-*`, así que cuál gana dependía
        del orden de generación del CSS. El padding va explícito.
      */}
      <header className="sticky top-0 z-sticky w-full pt-2 md:pt-3">
        <div
          className={cn(
            "mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 md:h-[68px] lg:px-8",
            "rounded-full border border-border/70 bg-white/90 md:px-6",
            "supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md",
            // Solo `max-width` y `box-shadow`: ninguna propiedad de layout.
            "transition-[max-width,box-shadow] duration-[420ms] [transition-timing-function:var(--ease-in-out)]",
            "motion-reduce:transition-none",
            // Un solo `min()` en vez de base + variante `md:`. El primer término
            // manda el margen lateral (1rem → 1,5rem) y el segundo el tope de
            // ancho (80rem → 62rem); gana el que sea menor, así que la regla es
            // continua y no hay ningún ancho donde el gesto desaparezca.
            //
            // Con `md:max-w-[80rem]` a secas, entre 768 y 1280 px ganaba el ancho
            // de la ventana: la píldora iba de borde a borde, con las esquinas
            // redondeadas pegadas al filo de la pantalla, y entre 768 y 992 px
            // encima no se contraía nada. Ya pasaba antes de tocar el móvil.
            //
            // De 1312 px en adelante manda el tope y el comportamiento de
            // escritorio es idéntico al de siempre: 1280 → 992 px.
            scrolled
              ? "max-w-[min(calc(100%-3rem),62rem)] shadow-brand-lg"
              : "max-w-[min(calc(100%-2rem),80rem)] shadow-brand-sm",
          )}
        >
          <VivaruLogo />

          {/* Desktop nav — hidden until content exists for each anchor */}
          <nav
            aria-label="Navegación principal"
            className="hidden"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-fast hover:bg-muted hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <LoginAction portalUrl={portalUrl} />
            </div>

            {/* Desktop CTAs.
                La flecha se la queda el trial porque es el camino principal
                del self-service; la demo es la vía asistida (ver
                docs/plan-self-service-trial.md §4). El Button ya centra su
                contenido, así que al quitarle la flecha el texto queda
                centrado solo. */}
            <div className="hidden md:block">
              <DemoDialog section="topbar">
                <Button size="xl" variant="outline">
                  Agenda una demo
                </Button>
              </DemoDialog>
            </div>

            <div className="hidden md:block">
              <Button
                size="xl"
                variant="default"
                render={
                  <Link
                    href="/registro"
                    onClick={() =>
                      track("cta_primary_click", { section: "topbar", cta: "trial" })
                    }
                  />
                }
              >
                Prueba gratis 15 días{" "}
                <Flecha />
              </Button>
            </div>

            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    aria-label="Abrir navegación"
                    className="md:hidden"
                  />
                }
              >
                <Menu aria-hidden="true" />
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] sm:max-w-sm">
                <div className="flex flex-col gap-6 p-6 pt-12">
                  <SheetTitle className="font-display text-h3 text-slate-900">
                    Menú
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Enlaces del sitio y acciones principales.
                  </SheetDescription>
                  <nav
                    aria-label="Navegación móvil"
                    className="hidden"
                  >
                    {NAV_LINKS.map((link) => (
                      <SheetClose
                        key={link.href}
                        render={
                          <Link
                            href={link.href}
                            className="rounded-md px-3 py-3 text-base font-medium text-slate-900 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        }
                      >
                        {link.label}
                      </SheetClose>
                    ))}
                  </nav>
                  <div className="mt-2 flex flex-col gap-3 border-t border-border pt-6">
                    <DemoDialog section="topbar">
                      <Button size="lg" variant="default" className="w-full">
                        Agenda una demo
                      </Button>
                    </DemoDialog>
                    <LoginAction
                      portalUrl={portalUrl}
                      size="lg"
                      variant="outline"
                      className="w-full"
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

      </header>

      {/* Mobile-only fixed bottom CTA — always reachable. */}
      {showMobileBottomCta ? (
      <div
        className="fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(15,23,42,0.06)] supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-md md:hidden"
        role="region"
        aria-label="Acción principal"
      >
        {/* El mismo primario que en escritorio. Era "Agenda una demo", que
            dejaba al móvil ofreciendo como acción siempre visible una distinta
            de la que la barra ancha considera principal. La demo sigue a un
            toque, dentro del menú. */}
        <Button
          size="lg"
          variant="default"
          className="w-full"
          render={
            <Link
              href="/registro"
              onClick={() =>
                track("cta_primary_click", {
                  section: "mobile_bottom",
                  cta: "trial",
                })
              }
            />
          }
        >
          Prueba gratis 15 días{" "}
          <Flecha />
        </Button>
      </div>
      ) : null}
    </>
  );
}
