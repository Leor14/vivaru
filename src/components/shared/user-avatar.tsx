"use client";

import { BriefcaseBusiness, Building2, Crown, Home, Landmark, Settings, ShieldCheck, UserCircle } from "lucide-react";

import type { AppRole } from "@/lib/constants/roles";

const RESIDENT_EMOJI_BY_AVATAR_ID: Record<string, string> = {
  emoji1: "😀",
  emoji2: "🦁",
  emoji3: "🐧",
  emoji4: "🦉",
  emoji5: "🐸",
  emoji6: "🐼",
  emoji7: "🦊",
  emoji8: "🐵",
  emoji9: "🦄",
  emoji10: "🐶",
  emoji11: "🐱",
  emoji12: "🦜",
};

const ADMIN_ICON_BY_AVATAR_ID = {
  "avatar-a": BriefcaseBusiness,
  "avatar-b": Landmark,
  "avatar-c": ShieldCheck,
  "avatar-d": Building2,
} as const;

function roleTone(role: AppRole) {
  if (role === "resident") return { bg: "#eaf2ff", fg: "#2b5db8" };
  if (role === "security_guard" || role === "security") return { bg: "#e8f8ef", fg: "#1f7a45" };
  if (role === "tenant_admin" || role === "admin_tenant") return { bg: "#e8eef8", fg: "#2f4f7f" };
  if (role === "superadmin") return { bg: "#fff5d9", fg: "#9a6a00" };
  return { bg: "#edf2f7", fg: "#475569" };
}

function RoleGlyph({ role }: { role: AppRole }) {
  if (role === "resident") return <Home className="h-4 w-4" />;
  if (role === "security_guard" || role === "security") return <ShieldCheck className="h-4 w-4" />;
  if (role === "tenant_admin" || role === "admin_tenant") return <Settings className="h-4 w-4" />;
  if (role === "superadmin") return <Crown className="h-4 w-4" />;
  return <UserCircle className="h-4 w-4" />;
}

/** Paleta procedural para avatares de iniciales (tonos sobrios de la marca). */
const INITIALS_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#e8eef8", fg: "#2f4f7f" },
  { bg: "#eaf3de", fg: "#3b6d11" },
  { bg: "#f3e8f8", fg: "#6b2f7f" },
  { bg: "#faeeda", fg: "#8a5a06" },
  { bg: "#e6f1fb", fg: "#0c447c" },
  { bg: "#f0e8e0", fg: "#6b4f2f" },
];

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toLocaleUpperCase("es-CO") || "?";
}

function paletteFor(fullName: string) {
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) hash = (hash * 31 + fullName.charCodeAt(i)) | 0;
  return INITIALS_PALETTE[Math.abs(hash) % INITIALS_PALETTE.length];
}

function InitialsAvatar({ fullName, size }: { fullName: string; size: number }) {
  const palette = paletteFor(fullName);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: palette.bg,
        color: palette.fg,
        fontSize: Math.max(10, Math.floor(size * 0.4)),
        letterSpacing: "0.02em",
      }}
      aria-label={`Avatar de ${fullName}`}
      title={fullName}
    >
      {initialsOf(fullName)}
    </span>
  );
}

const STAFF_ROLES: ReadonlyArray<AppRole> = ["tenant_admin", "admin_tenant", "superadmin", "security_guard", "security"];

export function UserAvatar({
  role,
  photoURL,
  avatarId,
  fullName,
  size = 36,
}: {
  role: AppRole;
  photoURL?: string;
  avatarId?: string;
  fullName: string;
  size?: number;
}) {
  const tone = roleTone(role);

  if (photoURL && photoURL.trim().length > 0) {
    return (
      <img
        src={photoURL}
        alt={`Avatar de ${fullName}`}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  // Roles de operación/administración: iniciales con color procedural, nunca
  // emoji — un admin no debe aparecer como "🐸 Carlos" en registros (VIV-1802).
  if (STAFF_ROLES.includes(role) && fullName.trim()) {
    return <InitialsAvatar fullName={fullName} size={size} />;
  }

  const selectedEmoji = avatarId ? RESIDENT_EMOJI_BY_AVATAR_ID[avatarId] : undefined;
  if (selectedEmoji) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: "#f1f5f9", color: "#0f172a", fontSize: Math.max(16, Math.floor(size * 0.52)) }}
        aria-label={`Avatar de ${fullName}`}
        title={fullName}
      >
        {selectedEmoji}
      </span>
    );
  }

  const AdminIcon = avatarId ? ADMIN_ICON_BY_AVATAR_ID[avatarId as keyof typeof ADMIN_ICON_BY_AVATAR_ID] : undefined;
  if (AdminIcon) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: "#e2e8f0", color: "#1e293b" }}
        aria-label={`Avatar de ${fullName}`}
        title={fullName}
      >
        <AdminIcon className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: tone.bg, color: tone.fg }}
      aria-label={`Avatar de ${fullName}`}
      title={fullName}
    >
      <RoleGlyph role={role} />
    </span>
  );
}
