"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/shared/notifications-bell";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AppRole } from "@/lib/constants/roles";
import { getIconTone } from "@/lib/ui/icon-tones";

function profilePathByRole(role: AppRole) {
  if (role === "resident") return "/resident/profile";
  if (role === "tenant_admin" || role === "admin_tenant") return "/admin/settings";
  if (role === "security_guard" || role === "security") return "/guard";
  return "/superadmin";
}

export function TopbarActions({
  role,
  userName,
  photoURL,
  avatarId,
  onLogout,
}: {
  role: AppRole;
  userName: string;
  photoURL?: string;
  avatarId?: string;
  onLogout: () => void;
}) {
  const profilePath = profilePathByRole(role);
  const logoutTone = getIconTone("peach");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={profilePath} aria-label="Perfil de usuario" className="hidden md:inline-flex">
          <span className="inline-flex rounded-full ring-1 ring-[var(--slate-200)] transition-shadow hover:ring-[var(--brand-300)]">
            <UserAvatar role={role} photoURL={photoURL} avatarId={avatarId} fullName={userName} size={36} />
          </span>
        </Link>
        <NotificationsBell />
        <Button type="button" variant="outline" size="sm" onClick={onLogout} className="hidden md:inline-flex">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: logoutTone.mutedBg, color: logoutTone.mutedFg }}>
            <LogOut className="h-4 w-4" />
          </span>
          Cerrar sesion
        </Button>
      </div>

      {/* Mobile "..." menu */}
      <div ref={menuRef} className="relative md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="px-2"
          aria-label="Abrir acciones"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>

        {menuOpen ? (
          <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-2 shadow-lg">
            <p className="mb-2 truncate px-2 text-xs text-[var(--slate-600)]">{userName}</p>
            <Link href={profilePath} onClick={() => setMenuOpen(false)}>
              <Button type="button" variant="ghost" className="w-full justify-start">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-[var(--slate-200)]">
                  <UserAvatar role={role} photoURL={photoURL} avatarId={avatarId} fullName={userName} size={24} />
                </span>
                Perfil
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-[var(--danger-700)]"
              onClick={() => { setMenuOpen(false); onLogout(); }}
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: logoutTone.mutedBg, color: logoutTone.mutedFg }}>
                <LogOut className="h-4 w-4" />
              </span>
              Cerrar sesion
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
