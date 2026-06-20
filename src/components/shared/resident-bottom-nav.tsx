"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Package, Users, Wallet } from "lucide-react";

import { cn } from "@/lib/utils/cn";

// ─── Nav items ────────────────────────────────────────────────────────────────
// Solo rutas nunca bloqueadas por residentModules (reservations/services/surveys/
// regulations son los toggleables — estos 5 no lo son).

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const ITEMS: NavItem[] = [
  { href: "/resident",           label: "Inicio",     icon: Home     },
  { href: "/resident/account",   label: "Cuenta",     icon: Wallet   },
  { href: "/resident/visitors",  label: "Visitantes", icon: Users    },
  { href: "/resident/packages",  label: "Paquetes",   icon: Package  },
  { href: "/resident/pqrs",      label: "PQRS",       icon: FileText },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ResidentBottomNav() {
  const pathname = usePathname();

  // Si la ruta actual no pertenece a ningún ítem, ninguno queda activo
  const activeHref = ITEMS.find((item) =>
    item.href === "/resident"
      ? pathname === "/resident"
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  )?.href ?? null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 bg-white md:hidden"
      aria-label="Navegación principal"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch border-t border-[var(--slate-200)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === activeHref;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
                "transition-colors duration-150",
                "active:scale-95 motion-reduce:active:scale-100",
                isActive ? "text-[var(--brand-700)]" : "text-[var(--slate-400)] hover:text-[var(--slate-600)]",
              )}
            >
              {/* Pill de fondo cuando está activo */}
              <span
                className={cn(
                  "absolute top-1.5 h-8 w-12 rounded-full",
                  "transition-all duration-200 motion-reduce:transition-none",
                  isActive
                    ? "bg-[var(--brand-50,#eff6ff)] opacity-100 scale-100"
                    : "opacity-0 scale-75",
                )}
                aria-hidden="true"
              />

              {/* Icono con scale al activarse */}
              <span
                className={cn(
                  "relative z-10 transition-transform duration-200 motion-reduce:transition-none",
                  isActive ? "scale-110" : "scale-100",
                )}
              >
                <Icon
                  className={cn("nav-icon h-5 w-5 shrink-0", isActive && "nav-icon--active")}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
              </span>

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 transition-all duration-150 motion-reduce:transition-none",
                  isActive ? "font-semibold" : "font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
