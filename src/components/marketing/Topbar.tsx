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
  { label: "Producto", href: "/mx#solucion" },
  { label: "Soluciones", href: "/mx#perspectivas" },
  { label: "Precios", href: "/mx#precios" },
  { label: "Recursos", href: "/mx#faq" },
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
      href="/mx"
      aria-label="Vivaru — Inicio"
      className={cn(
        "inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Image
        src="/brand/vivaru-logo.png"
        alt=""
        width={120}
        height={120}
        priority
        className="h-12 w-auto"
      />
    </Link>
  );
}

function LoginAction({ portalUrl }: { portalUrl?: string }) {
  if (portalUrl) {
    return (
      <Button
        variant="outline"
        size="default"
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
        variant="outline"
        size="default"
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
      <header
        className={cn(
          "sticky top-0 z-sticky w-full border-b border-transparent transition-[box-shadow,background-color] duration-[200ms] ease-out-brand",
          scrolled
            ? "border-border/60 shadow-sm bg-white/95 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur-sm"
            : "bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md"
        )}
      >
        <div className="container flex h-16 items-center justify-between gap-4 md:h-[72px]">
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

            {/* Desktop primary CTA */}
            <div className="hidden md:block">
              <DemoDialog section="topbar">
                <Button size="xl" variant="default">
                  Agenda una demo{" "}
                  <span aria-hidden="true" className="ml-0.5">
                    →
                  </span>
                </Button>
              </DemoDialog>
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
                    <LoginAction portalUrl={portalUrl} />
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
        <DemoDialog section="mobile_bottom">
          <Button size="lg" variant="default" className="w-full">
            Agenda una demo
          </Button>
        </DemoDialog>
      </div>
      ) : null}
    </>
  );
}
