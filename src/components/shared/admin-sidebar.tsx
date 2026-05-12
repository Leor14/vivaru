"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  Grid3X3,
  Home,
  LogOut,
  MessageSquare,
  Package,
  ScrollText,
  Users,
  Wallet,
} from "lucide-react";

import { NotificationsBell } from "@/components/shared/notifications-bell";
import { SidebarBrandHeader } from "@/components/shared/sidebar-brand-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AppRole } from "@/lib/constants/roles";
import { resolveActiveNavHref } from "@/lib/navigation/active-item";
import { cn } from "@/lib/utils/cn";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

export type AdminSidebarItem = {
  href: string;
  label: string;
  icon: IconComponent;
};

export type AdminSidebarGroup = {
  label?: string;
  items: AdminSidebarItem[];
};

const GROUPS: AdminSidebarGroup[] = [
  {
    items: [{ href: "/admin", label: "Panel de Control", icon: Grid3X3 }],
  },
  {
    label: "COMUNIDAD",
    items: [
      { href: "/admin/residents", label: "Residentes y unidades", icon: Users },
      { href: "/admin/visitors", label: "Visitantes", icon: Users },
      { href: "/admin/communications", label: "Comunicaciones", icon: MessageSquare },
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
    items: [{ href: "/admin/billing", label: "Cartera", icon: Wallet }],
  },
  {
    label: "CONFIGURACIÓN",
    items: [
      { href: "/admin/users", label: "Usuarios", icon: Users },
      { href: "/admin/documents", label: "Documentos", icon: FileText },
      { href: "/admin/settings", label: "Perfil del edificio", icon: Building2 },
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
  backgroundColor: "rgba(255,255,255,0.07)",
  margin: "6px 0",
} as const;

const GROUP_LABEL_STYLE = {
  fontSize: 10,
  letterSpacing: "0.1em",
  color: "rgba(255,255,255,0.3)",
  padding: "12px 14px 4px",
} as const;

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
      className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none"
      style={{
        backgroundColor: palette.bg,
        color: palette.color,
        height: 18,
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
  const effectiveGroups = groups ?? GROUPS;
  const effectiveHrefs = effectiveGroups.flatMap((group) => group.items.map((item) => item.href));
  const activeHref = resolveActiveNavHref(pathname, effectiveHrefs);
  const profilePath = profileHref ?? "/admin/settings";

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
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Navegacion principal">
        {effectiveGroups.map((group, groupIndex) => {
          const isFirst = groupIndex === 0;
          return (
            <div key={group.label ?? `group-${groupIndex}`}>
              {!isFirst ? <div role="separator" style={SEPARATOR_STYLE} /> : null}
              {group.label ? (
                <p
                  className="uppercase"
                  style={GROUP_LABEL_STYLE}
                >
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
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
                          "group flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition",
                          active
                            ? "text-white"
                            : "text-[rgba(255,255,255,0.7)] hover:text-white",
                        )}
                        style={{
                          backgroundColor: active
                            ? "rgba(255,255,255,0.10)"
                            : "transparent",
                        }}
                        onMouseEnter={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor =
                              "rgba(255,255,255,0.06)";
                          }
                        }}
                        onMouseLeave={(event) => {
                          if (!active) {
                            event.currentTarget.style.backgroundColor = "transparent";
                          }
                        }}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="truncate">{item.label}</span>
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
            className="flex items-center gap-2.5 text-white/90 hover:text-white"
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
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {user.fullName}
            </span>
          </Link>
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 inline-flex items-center gap-2 hover:text-white"
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
