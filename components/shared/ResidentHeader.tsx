"use client";
import { useEffect, useState } from "react";
import { getTenantBranding, TenantBranding } from "../../features/tenants/services";

interface Props {
  tenantId: string;
  tenantName?: string;
}

export function ResidentHeader({ tenantId, tenantName }: Props) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    getTenantBranding(tenantId).then((b) => {
      setBranding(b);
      setLoading(false);
    });
  }, [tenantId]);

  const color = branding?.color || "#0f172a";
  const name = branding?.name || tenantName || tenantId;
  const logoUrl = branding?.logoUrl;

  return (
    <header
      className="mb-4 flex w-full items-center gap-3 rounded-2xl px-4 py-3 md:mb-6"
      style={{ background: color, color: "#fff", minHeight: 64 }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-10 w-10 shrink-0 rounded bg-white object-contain" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white text-lg font-bold text-brand-700">
          {name[0]}
        </div>
      )}
      <span className="truncate text-base font-semibold md:text-lg">{name}</span>
    </header>
  );
}
