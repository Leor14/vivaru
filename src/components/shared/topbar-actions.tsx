"use client";

import Link from "next/link";
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

      <details className="relative md:hidden">
        <summary className="list-none">
          <Button type="button" variant="outline" size="sm" className="px-2" aria-label="Abrir acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </summary>
        <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-[var(--slate-200)] bg-white p-2 shadow-lg">
          <p className="mb-2 truncate px-2 text-xs text-[var(--slate-600)]">{userName}</p>
          <Link href={profilePath}>
            <Button type="button" variant="ghost" className="w-full justify-start">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-[var(--slate-200)]">
                <UserAvatar role={role} photoURL={photoURL} avatarId={avatarId} fullName={userName} size={24} />
              </span>
              Perfil
            </Button>
          </Link>
          <div className="px-2 py-1">
            <NotificationsBell />
          </div>
          <Button type="button" variant="ghost" className="w-full justify-start text-[var(--danger-700)]" onClick={onLogout}>
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-lg" style={{ backgroundColor: logoutTone.mutedBg, color: logoutTone.mutedFg }}>
              <LogOut className="h-4 w-4" />
            </span>
            Cerrar sesion
          </Button>
        </div>
      </details>
    </>
  );
}
