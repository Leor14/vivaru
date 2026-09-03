import { cn } from "@/lib/utils/cn";

export type SidebarBrandHeaderProps = {
  tenantName?: string;
  className?: string;
  rightSlot?: React.ReactNode;
};

export function SidebarBrandHeader({ tenantName, className, rightSlot }: SidebarBrandHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2.5", className)}>
      <img
        src="/images/vivaru.jpeg"
        alt="Vivaru"
        aria-hidden="true"
        className="shrink-0 rounded-md object-contain"
        style={{ width: 28, height: 28 }}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <p
          className="truncate text-[var(--on-fill)]"
          style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.04em" }}
        >
          VIVARU
        </p>
        {tenantName ? (
          <p
            className="truncate"
            style={{ fontSize: 11, color: "rgba(255,255,255,0.62)" }}
          >
            {tenantName}
          </p>
        ) : null}
      </div>
      {rightSlot ? <span className="ml-1 shrink-0">{rightSlot}</span> : null}
    </div>
  );
}
