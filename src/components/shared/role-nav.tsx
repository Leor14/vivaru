"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Grid3X3, Building2, FileText, ShieldCheck, Home, MessageSquare, Package, CalendarCheck, Users, Wallet } from "lucide-react";

import { roleNavigation } from "@/lib/constants/navigation";
import { resolveActiveNavHref } from "@/lib/navigation/active-item";
import type { AppRole } from "@/lib/constants/roles";
import { getIconTone, toneByNavigationHref } from "@/lib/ui/icon-tones";
import { cn } from "@/lib/utils/cn";

const iconByHref: Record<string, ComponentType<{ className?: string }>> = {
  "/superadmin": ShieldCheck,
  "/superadmin/tenants": Building2,
  "/superadmin/plans": Wallet,
  "/superadmin/support": MessageSquare,
  "/superadmin/audit": FileText,
  "/admin": Grid3X3,
  "/admin/users": Users,
  "/admin/residents": Users,
  "/admin/communications": MessageSquare,
  "/admin/billing": Wallet,
  "/admin/reservations": CalendarCheck,
  "/admin/visitors": Users,
  "/admin/packages": Package,
  "/admin/pqrs": FileText,
  "/admin/documents": FileText,
  "/admin/settings": Building2,
  "/resident": Home,
  "/resident/account": Wallet,
  "/resident/reservations": CalendarCheck,
  "/resident/visitors": Users,
  "/resident/communications": MessageSquare,
  "/resident/packages": Package,
  "/resident/pqrs": FileText,
  "/resident/profile": Users,
  "/guard": Home,
  "/guard/reservations": CalendarCheck,
  "/guard/visitors": Users,
  "/guard/packages/new": Package,
  "/guard/packages": Package,
};

export function RoleNav({ role, mobile = false, drawer = false }: { role: AppRole; mobile?: boolean; drawer?: boolean }) {
  const pathname = usePathname();
  const items = roleNavigation[role] ?? [];

  const activeHref = resolveActiveNavHref(pathname, items.map((item) => item.href));

  function isItemActive(href: string) {
    return href === activeHref;
  }

  if (mobile) {
    const compactItems = items.slice(0, 5);
    return (
      <nav className="grid grid-cols-5 gap-1 rounded-2xl border border-[var(--slate-200)] bg-white p-1 shadow-[0_8px_24px_rgba(4,22,44,0.12)]">
        {compactItems.map((item) => {
          const active = isItemActive(item.href);
          const Icon = iconByHref[item.href] ?? Home;
          const tone = getIconTone(toneByNavigationHref(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium",
                active ? "bg-[var(--brand-700)] text-white" : "text-[var(--slate-600)]",
              )}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.26)" : tone.mutedBg,
                  color: active ? "#ffffff" : tone.mutedFg,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  if (drawer) {
    return (
      <nav className="grid gap-2">
        {items.map((item) => {
          const active = isItemActive(item.href);
          const Icon = iconByHref[item.href] ?? Home;
          const tone = getIconTone(toneByNavigationHref(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                active
                  ? "border-[var(--brand-700)] bg-[var(--brand-50)] text-[var(--brand-900)]"
                  : "border-[var(--slate-200)] bg-white text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
              )}
            >
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: active ? tone.activeBg : tone.mutedBg,
                  color: active ? tone.activeFg : tone.mutedFg,
                }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
      {items.map((item) => {
        const active = isItemActive(item.href);
        const Icon = iconByHref[item.href] ?? Home;
        const tone = getIconTone(toneByNavigationHref(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm whitespace-nowrap transition md:w-full",
              active
                ? "border-[var(--brand-700)] bg-[var(--brand-50)] text-[var(--brand-900)]"
                : "border-[var(--slate-200)] bg-white text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
            )}
          >
            <span
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: active ? tone.activeBg : tone.mutedBg,
                color: active ? tone.activeFg : tone.mutedFg,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
