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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 bg-white md:hidden"
      aria-label="Navegación principal"
      /* Safe area para iPhone home indicator */
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch border-t border-[var(--slate-200)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          // Inicio: coincidencia exacta para no marcar activo en todo el portal
          const isActive =
            item.href === "/resident"
              ? pathname === "/resident"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium",
                "[transition:color_120ms_ease-out]",
                isActive ? "text-[var(--brand-700)]" : "text-[var(--slate-500)]",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  "[transition:color_120ms_ease-out]",
                  isActive ? "text-[var(--brand-700)]" : "text-[var(--slate-400)]",
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
