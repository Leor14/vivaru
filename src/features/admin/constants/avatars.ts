export const ADMIN_AVATAR_OPTIONS = [
  { id: "avatar-a", label: "Ejecutivo", icon: "briefcase" },
  { id: "avatar-b", label: "Gerencia", icon: "landmark" },
  { id: "avatar-c", label: "Operativo", icon: "shield" },
  { id: "avatar-d", label: "Residencial", icon: "building" },
] as const;

export type AdminAvatarId = (typeof ADMIN_AVATAR_OPTIONS)[number]["id"];
export type AdminAvatarIconKey = (typeof ADMIN_AVATAR_OPTIONS)[number]["icon"];
