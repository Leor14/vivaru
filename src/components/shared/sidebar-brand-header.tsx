import { Home } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type SidebarBrandHeaderProps = {
  tenantName?: string;
  className?: string;
  rightSlot?: React.ReactNode;
};

const ICON_COLOR = "#1D9E75";
const ICON_BG = "#0F3D33";

export function SidebarBrandHeader({ tenantName, className, rightSlot }: SidebarBrandHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2.5", className)}>
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: ICON_BG,
          color: ICON_COLOR,
        }}
      >
        <Home className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p
          className="truncate text-white"
          style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.04em" }}
        >
          VIVARU
        </p>
        {tenantName ? (
          <p
            className="truncate"
            style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}
          >
            {tenantName}
          </p>
        ) : null}
      </div>
      {rightSlot ? <span className="ml-1 shrink-0">{rightSlot}</span> : null}
    </div>
  );
}
