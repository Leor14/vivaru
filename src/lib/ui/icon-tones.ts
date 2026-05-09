export type IconToneName = "sky" | "mint" | "peach" | "sand" | "lavender";

export type IconTone = {
  mutedBg: string;
  mutedFg: string;
  activeBg: string;
  activeFg: string;
};

const ICON_TONES: Record<IconToneName, IconTone> = {
  sky: {
    mutedBg: "var(--icon-sky-muted-bg)",
    mutedFg: "var(--icon-sky-muted-fg)",
    activeBg: "var(--icon-sky-active-bg)",
    activeFg: "var(--icon-sky-active-fg)",
  },
  mint: {
    mutedBg: "var(--icon-mint-muted-bg)",
    mutedFg: "var(--icon-mint-muted-fg)",
    activeBg: "var(--icon-mint-active-bg)",
    activeFg: "var(--icon-mint-active-fg)",
  },
  peach: {
    mutedBg: "var(--icon-peach-muted-bg)",
    mutedFg: "var(--icon-peach-muted-fg)",
    activeBg: "var(--icon-peach-active-bg)",
    activeFg: "var(--icon-peach-active-fg)",
  },
  sand: {
    mutedBg: "var(--icon-sand-muted-bg)",
    mutedFg: "var(--icon-sand-muted-fg)",
    activeBg: "var(--icon-sand-active-bg)",
    activeFg: "var(--icon-sand-active-fg)",
  },
  lavender: {
    mutedBg: "var(--icon-lavender-muted-bg)",
    mutedFg: "var(--icon-lavender-muted-fg)",
    activeBg: "var(--icon-lavender-active-bg)",
    activeFg: "var(--icon-lavender-active-fg)",
  },
};

export function getIconTone(name: IconToneName) {
  return ICON_TONES[name];
}

export function toneByNavigationHref(href: string): IconToneName {
  if (href.includes("reservations")) return "mint";
  if (href.includes("visitors")) return "peach";
  if (href.includes("packages")) return "sand";
  if (href.includes("billing") || href.includes("account") || href.includes("plans")) return "lavender";
  if (href.includes("communications") || href.includes("support")) return "sky";
  if (href.includes("pqrs") || href.includes("documents") || href.includes("audit")) return "sand";
  if (href.includes("settings") || href.includes("profile") || href.includes("users") || href.includes("residents")) return "sky";
  return "mint";
}