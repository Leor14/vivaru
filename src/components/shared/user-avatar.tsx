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
