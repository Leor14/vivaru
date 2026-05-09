import type { ReactNode } from "react";

import { getIconTone, type IconToneName } from "@/lib/ui/icon-tones";
import { cn } from "@/lib/utils/cn";

export function IconBadge({
  tone = "sky",
  active = false,
  size = "sm",
  className,
  children,
}: {
  tone?: IconToneName;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  const token = getIconTone(tone);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg",
        size === "md" ? "h-7 w-7" : "h-6 w-6",
        className,
      )}
      style={{
        backgroundColor: active ? token.activeBg : token.mutedBg,
        color: active ? token.activeFg : token.mutedFg,
      }}
    >
      {children}
    </span>
  );
}