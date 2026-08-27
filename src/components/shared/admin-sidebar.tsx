"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  BarChart2,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  LifeBuoy,
  Grid3X3,
  Home,
  Lock,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  Scale,
  ScrollText,
  Store,
  Users,
  Wallet,
} from "lucide-react";

import { NotificationsBell } from "@/components/shared/notifications-bell";
import { SidebarBrandHeader } from "@/components/shared/sidebar-brand-header";
import { TenantSwitcher } from "@/components/shared/tenant-switcher";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AppRole } from "@/lib/constants/roles";
import { resolveActiveNavHref } from "@/lib/navigation/active-item";
import { debePlegarse, pendientesDelGrupo } from "@/lib/navigation/sidebar-collapse";
import { cn } from "@/lib/utils/cn";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: IconComponent;
  /** Módulo en vista previa durante la prueba: se marca con candado. */
  locked?: boolean;
};

export type AdminSidebarGroup = {
  label?: string;
  items: AdminSidebarItem[];
};

export const ADMIN_SIDEBAR_GROUPS: AdminSidebarGroup[] = [
  {
    items: [{ href: "/admin", label: "Panel de Control", icon: Grid3X3 }],
  },
  {
    label: "COMUNIDAD",
    items: [
      { href: "/admin/residents", label: "Residentes y unidades", icon: Users },
      { href: "/admin/visitors", label: "Visitantes", icon: Users },
      { href: "/admin/communications", label: "Comunicaciones", icon: MessageSquare },
      { href: "/admin/services", label: "Servicios", icon: Store },
      { href: "/admin/surveys", label: "Encuestas", icon: ClipboardList },
      { href: "/admin/regulations", label: "Reglamento", icon: ScrollText },
    ],
  },
  {
    label: "OPERATIVO",
    items: [
      { href: "/admin/reservations", label: "Reservas", icon: CalendarCheck },
      { href: "/admin/packages", label: "Paquetería", icon: Package },
      { href: "/admin/pqrs", label: "PQRS", icon: FileText },
    ],
  },
  {
    label: "FINANCIERO",
    items: [
      { href: "/admin/billing", label: "Cartera", icon: Wallet },
      { href: "/admin/finanzas/egresos", label: "Egresos", icon: Receipt },
      { href: "/admin/finanzas", label: "Libro y fondos", icon: BookOpen },
      { href: "/admin/finanzas/conciliacion", label: "Conciliación", icon: Scale },
    ],
  },
  {
    label: "REPORTES",
    items: [{ href: "/admin/reports", label: "Reporte de Comité", icon: BarChart2 }],
  },
  {
    label: "CONFIGURACIÓN",
    items: [
      { href: "/admin/users", label: "Usuarios", icon: Users },
      { href: "/admin/documents", label: "Documentos", icon: FileText },
      { href: "/admin/settings", label: "Perfil del edificio", icon: Building2 },
      // Entrada propia y no una pestaña dentro de Configuración: quien busca
      // ayuda está frustrado y con prisa, y un tercer nivel no se encuentra
      // en ese estado (PRD-V-FEAT-001).
      { href: "/admin/soporte", label: "Soporte", icon: LifeBuoy },
    ],
  },
];

const FALLBACK_ICON: IconComponent = Home;

export type AdminSidebarBadge = {
  count: number;
  tone: "red" | "amber";
};

export type AdminSidebarBadges = {
  /** keyed by href */
  [href: string]: AdminSidebarBadge | undefined;
};

export type AdminSidebarProps = {
  tenantName?: string;
  /** Brand background color for the sidebar surface. Defaults to slate-900. */
  brandColor?: string;
  badges?: AdminSidebarBadges;
  /** Fired when an item is clicked. Useful to close the mobile drawer. */
  onItemClick?: () => void;
  className?: string;
  /** Footer + notifications integration. When provided, renders an avatar/name footer
   *  and a notifications bell next to the brand header. */
  user?: {
    fullName: string;
    role: AppRole;
    photoURL?: string;
    avatarId?: string;
  };
  onLogout?: () => void;
  showNotifications?: boolean;
  /** Override the default admin GROUPS to render a sidebar for any role. */
  groups?: AdminSidebarGroup[];
  /** Where to navigate when clicking the user footer. Defaults to /admin/settings. */
  profileHref?: string;
};

const SEPARATOR_STYLE = {
  height: 0.5,
  backgroundColor: "rgba(255,255,255,0.08)",
  margin: "8px 0",
} as const;

const GROUP_LABEL_STYLE = {
  fontSize: 11,
  letterSpacing: "0.09em",
  color: "rgba(255,255,255,0.42)",
  // Antes 14px arriba y 14px a los lados. Apretado, porque de las diecinueve
  // entradas solo cabían SIETE a 671 px de alto útil.
  padding: "9px 12px 4px",
} as const;

/** Prefijo del estado plegado de cada grupo. Mismo patrón que `SectionIntro`. */
const GROUP_STORAGE_PREFIX = "vivaru:sidebar-group:";

const BADGE_TONES: Record<AdminSidebarBadge["tone"], { bg: string; color: string }> = {
  red: { bg: "#DC2626", color: "#ffffff" },
  amber: { bg: "#F59E0B", color: "#1F1300" },
};

function NavBadge({ badge }: { badge: AdminSidebarBadge }) {
  if (!badge.count || badge.count <= 0) return null;
  const palette = BADGE_TONES[badge.tone];
  return (
    <span
      aria-label={`${badge.count} pendientes`}
      className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none"
      style={{
        backgroundColor: palette.bg,
        color: palette.color,
        height: 20,
      }}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

export function AdminSidebar({
  tenantName,
  brandColor,
  badges,
  onItemClick,
  className,
  user,
  onLogout,
  showNotifications,
  groups,
  profileHref,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const effectiveGroups = groups ?? ADMIN_SIDEBAR_GROUPS;
  const effectiveHrefs = effectiveGroups.flatMap((group) => group.items.map((item) => item.href));
  const activeHref = resolveActiveNavHref(pathname, effectiveHrefs);
  const profilePath = profileHref ?? "/admin/settings";

  /**
   * **Grupos plegables (pasada 2).** A 671 px de alto útil —un portátil
   * corriente— de las diecinueve entradas del admin solo se veían SIETE, y la
   * lateral tiene su propio scroll anidado sin nada que avise de que hay más
   * abajo: Financiero, Reportes y Configuración quedaban fuera de la vista.
   *
   * Se pliega por grupo y se recuerda. Arranca todo abierto —el comportamiento
   * de hoy— y `localStorage` se lee después, con el mismo patrón que
   * `SectionIntro`: en modo privado el toggle sigue funcionando, solo no
   * persiste.
   */
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const groupKey = effectiveGroups.map((group) => group.label ?? "").join("|");

  useEffect(() => {
    try {
      const guardado: Record<string, boolean> = {};
      for (const group of effectiveGroups) {
        if (!group.label) continue;
        guardado[group.label] = window.localStorage.getItem(`${GROUP_STORAGE_PREFIX}${group.label}`) === "1";
      }
      setCollapsedGroups(guardado);
    } catch {
      // Sin localStorage: todos abiertos, que es exactamente como estaba antes.
    }
    // `groupKey` resume los grupos: cambia cuando cambia la lista (variante de
    // finanzas, módulos del residente), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKey]);

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        window.localStorage.setItem(`${GROUP_STORAGE_PREFIX}${label}`, next[label] ? "1" : "0");
      } catch {
        // Sin persistencia: el plegado igual funciona en esta sesión.
      }
      return next;
    });
  }

  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: brandColor || "#0f172a" }}
    >
      <div className="px-2 pt-3 pb-2">
        <SidebarBrandHeader
          tenantName={tenantName}
          rightSlot={
            showNotifications ? (
              <span className="inline-flex items-center justify-center text-white/70 hover:text-white">
                <NotificationsBell />
              </span>
            ) : null
          }
        />
        {/* Solo se pinta con dos membresías o más; con una devuelve `null` y la
            cabecera queda exactamente como hoy (CA1). */}
        <TenantSwitcher className="mt-1 px-0.5" />
      </div>

      {/* `relative` + `min-h-0` para que el degradado de abajo se ancle al hueco
          del scroll y no al documento. */}
      <div className="relative min-h-0 flex-1">
      <nav className="h-full overflow-y-auto px-2 pb-3" aria-label="Navegacion principal">
        {effectiveGroups.map((group, groupIndex) => {
          const isFirst = groupIndex === 0;
          const contieneActivo = group.items.some((item) => item.href === activeHref);
          // Las dos reglas viven en `sidebar-collapse.ts` para poder probarlas.
          const plegado = debePlegarse(group.label, contieneActivo, collapsedGroups);
          const pendientes = pendientesDelGrupo(group, badges);
          const idContenido = `sidebar-group-${groupIndex}`;
          return (
            <div key={group.label ?? `group-${groupIndex}`}>
              {!isFirst ? <div role="separator" style={SEPARATOR_STYLE} /> : null}
              {group.label ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label!)}
                  aria-expanded={!plegado}
                  aria-controls={idContenido}
                  className="flex w-full items-center gap-1.5 rounded-lg uppercase transition-colors duration-150 hover:text-[rgba(255,255,255,0.7)]"
                  style={GROUP_LABEL_STYLE}
                >
                  <span className="truncate">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 shrink-0 opacity-70 [transition-property:transform] duration-150",
                      plegado && "-rotate-90",
                    )}
                    aria-hidden="true"
                  />
                  {plegado && pendientes.count > 0 ? <NavBadge badge={pendientes} /> : null}
                </button>
              ) : null}
              <ul id={idContenido} className="space-y-0.5" hidden={plegado}>
                {group.items.map((item) => {
                  const Icon = item.icon ?? FALLBACK_ICON;
                  const active = item.href === activeHref;
                  const badge = badges?.[item.href];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onItemClick}
                        className={cn(
                          // `py-2.5` y no `py-3`: son 19 entradas y cada píxel de
                          // fila cuesta una entrada visible en una ventana baja.
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors duration-150",
                          active
                            ? "text-white"
                            : "text-[rgba(255,255,255,0.75)] hover:text-white",
                        )}
                        style={{
                          backgroundColor: active
                            ? "rgba(255,255,255,0.12)"
                            : "transparent",
                        }}
                        onMouseEnter={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor =
                              "rgba(255,255,255,0.07)";
                          }
                        }}
                        onMouseLeave={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        <Icon className={cn("nav-icon h-[18px] w-[18px] shrink-0", active && "nav-icon--active")} strokeWidth={1.75} />
                        <span className="truncate">{item.label}</span>
                        {item.locked ? (
                          <Lock
                            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70"
                            aria-label="Disponible con tu plan"
                          />
                        ) : null}
                        {badge ? <NavBadge badge={badge} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      {/* **Que se vea que hay más abajo.** El scroll de la lateral es anidado y
          no tenía ninguna señal: a 671 px de alto la lista se cortaba en seco en
          mitad de un grupo y parecía que ahí se acababa el producto. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
        style={{ background: `linear-gradient(to top, ${brandColor || "#0f172a"}, transparent)` }}
      />
      </div>

      {user ? (
        <div
          className="mt-auto border-t"
          style={{
            borderColor: "rgba(255,255,255,0.07)",
            padding: "12px 14px",
          }}
        >
          <Link
            href={profilePath}
            onClick={onItemClick}
            className="flex items-center gap-3 text-white/90 hover:text-white"
          >
            <span className="inline-flex shrink-0 rounded-full ring-1 ring-white/10">
              <UserAvatar
                role={user.role}
                photoURL={user.photoURL}
                avatarId={user.avatarId}
                fullName={user.fullName}
                size={28}
              />
            </span>
            <span
              className="truncate"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {user.fullName}
            </span>
          </Link>
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 inline-flex items-center gap-2 hover:text-white"
              style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Cerrar sesión</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
