"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Menu, X } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSidebar, type AdminSidebarBadges, type AdminSidebarGroup } from "@/components/shared/admin-sidebar";
import { buildAdminSidebarGroups, buildRoleSidebarGroups, profileHrefForRole } from "@/lib/navigation/role-sidebar-groups";
import { getModuleVariant, type FinanceVariant } from "@/lib/config/module-variants";
import { TopbarActions } from "@/components/shared/topbar-actions";
import { TrialBanner } from "@/components/shared/trial-banner";
import { DemoEnvironmentNotice } from "@/components/shared/demo-environment-notice";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import { isModuleLocked, moduleForPath } from "@/lib/config/trial-modules";
import { useAuth } from "@/features/auth/auth-context";
import { usePackages } from "@/features/packages/use-packages";
import { isTicketPending } from "@/features/pqrs/ticket-status";
import { useTickets } from "@/features/pqrs/use-tickets";
import { canAccessPath, routeByRole } from "@/lib/auth/routing";
import { ROLE_LABEL, type AppRole } from "@/lib/constants/roles";
import { db } from "@/lib/firebase/client";
import { cn } from "@/lib/utils/cn";

import { type ResidentModules, DEFAULT_RESIDENT_MODULES } from "@/features/admin/services";
import { ResidentBottomNav } from "@/components/shared/resident-bottom-nav";
import { GuardBottomNav } from "@/components/shared/guard-bottom-nav";

type TenantBranding = {
  brandColor: string;
  tenantDisplayName?: string;
  tenantName?: string;
  logoUrl?: string;
  residentModules?: ResidentModules;
  financeVariant?: FinanceVariant;
};

const DEFAULT_BRAND_COLOR = "#0b3c5d";
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

function normalizeBrandColor(value: unknown) {
  if (typeof value !== "string") return DEFAULT_BRAND_COLOR;
  const normalized = value.trim();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : DEFAULT_BRAND_COLOR;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function AppShell({
  role,
  title,
  children,
}: {
  role: AppRole;
  title: string;
  children: React.ReactNode;
}) {
  const { user, loading, logout, status, error, isConfigured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [brandingReady, setBrandingReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [headerMinimized, setHeaderMinimized] = useState(false);
  const lastScrollY = useRef(0);
  const forcedPasswordPath = "/resident/change-password-required";

  useEffect(() => {
    function onScroll() {
      // window.scrollY returns 0 on iOS Safari when body has overflow-x:hidden.
      // document.documentElement.scrollTop is reliable across all mobile browsers.
      const currentY =
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        window.scrollY ||
        0;
      if (currentY < 60) {
        setHeaderMinimized(false);
      } else if (currentY > lastScrollY.current) {
        setHeaderMinimized(true);   // scrolling down → shrink
      } else {
        setHeaderMinimized(false);  // scrolling up → expand
      }
      lastScrollY.current = currentY;
    }
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  const isAdminRole = role === "tenant_admin" || role === "admin_tenant";
  const navTenantId = isAdminRole ? user?.tenantId : undefined;
  const trial = useTenantTrial(user?.tenantId);

  /** Marca con candado los módulos que en la prueba son solo vista previa. */
  const markLocked = useCallback(
    (groups: AdminSidebarGroup[]): AdminSidebarGroup[] =>
      groups.map((group) => ({
        ...group,
        items: group.items.map((item) => {
          const key = moduleForPath(item.href);
          return key && isModuleLocked(trial.status, key) ? { ...item, locked: true } : item;
        }),
      })),
    [trial.status],
  );
  const { items: tickets } = useTickets(navTenantId);
  const { items: packages } = usePackages(navTenantId);

  const sidebarBadges: AdminSidebarBadges = useMemo(() => {
    // Misma definición de "pendiente" que el Dashboard (open + in_progress).
    const openTickets = tickets.filter((ticket) => isTicketPending(ticket.status)).length;
    const pendingPackages = packages.filter((entry) => entry.status === "pending").length;
    return {
      "/admin/pqrs": openTickets > 0 ? { count: openTickets, tone: "red" } : undefined,
      "/admin/packages": pendingPackages > 0 ? { count: pendingPackages, tone: "amber" } : undefined,
    };
  }, [tickets, packages]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.tenantId || !db) {
      return;
    }

    const unsub = onSnapshot(
      doc(db, "tenantSettings", user.tenantId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setBranding(null);
          setBrandingReady(true);
          return;
        }

        try {
          const data = snapshot.data() as Record<string, unknown>;
          const rawModules =
            typeof data.residentModules === "object" && data.residentModules
              ? (data.residentModules as Record<string, unknown>)
              : null;
          setBranding({
            brandColor: normalizeBrandColor(data.brandColor),
            tenantDisplayName: normalizeOptionalText(data.tenantDisplayName),
            tenantName: normalizeOptionalText(data.tenantName),
            logoUrl: normalizeOptionalText(data.logoUrl),
            residentModules: rawModules
              ? {
                  reservations: rawModules.reservations !== false,
                  services: rawModules.services !== false,
                  surveys: rawModules.surveys !== false,
                  regulations: rawModules.regulations !== false,
                }
              : undefined,
            financeVariant: getModuleVariant(data, "finance"),
          });
        } catch (parseError) {
          console.error("[app-shell] invalid tenant branding payload", parseError);
          setBranding(null);
        }
        setBrandingReady(true);
      },
      () => {
        setBranding(null);
        setBrandingReady(true);
      },
    );

    return () => unsub();
  }, [user?.tenantId]);

  useEffect(() => {
    if (status === "misconfigured" || !isConfigured) {
      const reason = error ? `?reason=${encodeURIComponent(error)}` : "";
      router.replace(`/setup-error${reason}`);
      return;
    }

    if (status === "profile_error") {
      router.replace("/unauthorized?reason=profile");
      return;
    }

    if (!loading && status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (!loading && user && !canAccessPath(user.role, pathname)) {
      router.replace(routeByRole(user.role));
      return;
    }

    if (!loading && user?.role === "resident" && user.mustChangePassword === true && pathname !== forcedPasswordPath) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[app-shell.guard] redirect:force-password-change", {
          pathname,
          mustChangePassword: user.mustChangePassword,
        });
      }
      router.replace(forcedPasswordPath);
      return;
    }

    if (!loading && user?.role === "resident" && user.mustChangePassword !== true && pathname === forcedPasswordPath) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[app-shell.guard] redirect:resident-home", {
          pathname,
          mustChangePassword: user.mustChangePassword,
        });
      }
      router.replace("/resident");
    }
  }, [loading, user, router, status, isConfigured, error, pathname]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <Skeleton className="h-10 w-52 rounded-2xl" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[240px_1fr]">
          <Skeleton className="hidden h-80 rounded-2xl md:block" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (status === "profile_error") {
    return (
      <main className="mx-auto max-w-xl p-4 pt-12 md:p-8">
        <section className="rounded-2xl border border-[var(--danger-600)]/20 bg-white p-6">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--danger-700)]">
            <AlertTriangle className="h-4 w-4" /> Perfil inconsistente
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--slate-900)]">No fue posible cargar tu workspace</h2>
          <p className="mt-2 text-sm text-[var(--slate-700)]">{error ?? "Tu perfil no contiene rol o tenant valido."}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/unauthorized">
              <Button variant="outline">Ver detalle</Button>
            </Link>
            <Button onClick={() => void logout()}>Cerrar sesion</Button>
          </div>
        </section>
      </main>
    );
  }

  if (!user) return null;

  const isTenantLayout = role === "tenant_admin" || role === "admin_tenant";
  const shellRole: AppRole = isTenantLayout && (user.role === "security_guard" || user.role === "security" || user.role === "committee") ? user.role : role;
  const shellTitle = user.role === "security_guard" || user.role === "security" ? "Panel de Porteria" : title;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffffff_4%,#edf4fb_42%,#e4ecf6_100%)]">
      {!isAdminRole && (shellRole === "tenant_admin" || shellRole === "admin_tenant") ? (
        <div className="border-b border-white/10" style={{ backgroundColor: brandingReady ? branding?.brandColor ?? DEFAULT_BRAND_COLOR : DEFAULT_BRAND_COLOR }}>
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-white md:px-8">
            <div className="flex items-center gap-2 text-sm font-medium">
              {brandingReady && branding?.logoUrl ? <img src={branding.logoUrl} alt="Logo tenant" className="h-7 w-7 rounded-md object-cover" /> : null}
              <span>{branding?.tenantDisplayName ?? branding?.tenantName ?? user.tenantName ?? "HOGARU"}</span>
            </div>
          </div>
        </div>
      ) : null}

      {isAdminRole ? (
        <header
          className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--slate-200)] bg-white/90 px-4 backdrop-blur md:hidden"
          style={{
            paddingTop: headerMinimized ? "4px" : "8px",
            paddingBottom: headerMinimized ? "4px" : "8px",
            transition: "padding-top 220ms ease-in-out, padding-bottom 220ms ease-in-out",
          }}
        >
          <Button type="button" variant="outline" size="sm" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menú">
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-subheading min-w-0 flex-1 truncate text-[var(--slate-900)]">{shellTitle}</h1>
          <TopbarActions role={shellRole} userName={user.fullName} photoURL={user.photoURL} avatarId={user.avatarId} onLogout={() => void logout()} />
        </header>
      ) : (
        <header className="fixed inset-x-0 top-0 z-30 border-b border-[var(--slate-200)] bg-white/90 backdrop-blur md:sticky md:inset-x-auto">
          <div
            className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 md:px-8"
            style={{
              paddingTop: headerMinimized ? "4px" : "8px",
              paddingBottom: headerMinimized ? "4px" : "8px",
              transition: "padding-top 220ms ease-in-out, padding-bottom 220ms ease-in-out",
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-label hidden text-[var(--slate-500)] md:block">{ROLE_LABEL[user.role]}</p>
                <h1 className="truncate text-base font-medium text-[var(--slate-900)] md:text-display">{shellTitle}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden truncate text-sm text-[var(--slate-600)] md:inline md:max-w-none">{user.fullName}</span>
              <TopbarActions role={shellRole} userName={user.fullName} photoURL={user.photoURL} avatarId={user.avatarId} onLogout={() => void logout()} />
            </div>
          </div>
        </header>
      )}

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navegacion principal">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Cerrar menu"
          />
          <aside
            className="relative h-full w-[84%] max-w-xs overflow-y-auto p-3 shadow-xl"
            style={isAdminRole ? { backgroundColor: "#0f172a" } : undefined}
          >
            {isAdminRole ? (
              <>
                <div className="mb-2 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <AdminSidebar
                  tenantName={branding?.tenantDisplayName ?? branding?.tenantName ?? user.tenantName}
                  brandColor={branding?.brandColor}
                  groups={markLocked(buildAdminSidebarGroups(branding?.financeVariant))}
                  badges={sidebarBadges}
                  onItemClick={() => setMobileNavOpen(false)}
                  user={{ fullName: user.fullName, role: shellRole, photoURL: user.photoURL, avatarId: user.avatarId }}
                  onLogout={() => void logout()}
                  showNotifications
                />
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <AdminSidebar
                  tenantName={branding?.tenantDisplayName ?? branding?.tenantName ?? user.tenantName}
                  brandColor={branding?.brandColor}
                  groups={buildRoleSidebarGroups(shellRole, branding?.residentModules ?? DEFAULT_RESIDENT_MODULES, trial.isTrial || trial.isExpired)}
                  profileHref={profileHrefForRole(shellRole)}
                  onItemClick={() => setMobileNavOpen(false)}
                  user={{ fullName: user.fullName, role: shellRole, photoURL: user.photoURL, avatarId: user.avatarId }}
                  onLogout={() => void logout()}
                />
              </>
            )}
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto grid gap-4 px-4 pb-24 md:px-8 md:pt-6",
          isAdminRole
            ? "max-w-none pt-4 md:grid-cols-[240px_1fr]"
            : "max-w-7xl pt-[57px] md:grid-cols-[248px_1fr]",
        )}
      >
        <aside className="hidden md:block">
          {isAdminRole ? (
            <AdminSidebar
              className="sticky top-4 h-[calc(100vh-2rem)]"
              tenantName={branding?.tenantDisplayName ?? branding?.tenantName ?? user.tenantName}
              brandColor={branding?.brandColor}
              groups={markLocked(buildAdminSidebarGroups(branding?.financeVariant))}
              badges={sidebarBadges}
              user={{ fullName: user.fullName, role: shellRole, photoURL: user.photoURL, avatarId: user.avatarId }}
              onLogout={() => void logout()}
              showNotifications
            />
          ) : (
            <AdminSidebar
              className="sticky top-4 h-[calc(100vh-2rem)]"
              tenantName={branding?.tenantDisplayName ?? branding?.tenantName ?? user.tenantName}
              brandColor={branding?.brandColor}
              groups={buildRoleSidebarGroups(shellRole, branding?.residentModules ?? DEFAULT_RESIDENT_MODULES, trial.isTrial || trial.isExpired)}
              profileHref={profileHrefForRole(shellRole)}
              user={{ fullName: user.fullName, role: shellRole, photoURL: user.photoURL, avatarId: user.avatarId }}
              onLogout={() => void logout()}
            />
          )}
        </aside>
        <main className="min-w-0">
          {/* El CTA comercial es solo para el admin (es quien decide y compra);
              residentes y portería ven una nota informativa, sin venta. */}
          {isAdminRole ? <TrialBanner trial={trial} /> : <DemoEnvironmentNotice />}
          {children}
        </main>
      </div>

      <footer className={cn("mx-auto hidden px-8 pb-8 text-xs text-[var(--slate-500)] md:block", isAdminRole ? "max-w-none" : "max-w-7xl")}>
        <p>Tenant: {branding?.tenantName ?? user.tenantName ?? "HOGARU"}</p>
      </footer>

      {/* Bottom nav — portal residente y guardia, solo mobile */}
      {shellRole === "resident" && <ResidentBottomNav />}
      {(shellRole === "security_guard" || shellRole === "security") && <GuardBottomNav />}
    </div>
  );
}
