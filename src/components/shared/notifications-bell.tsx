"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck, ClipboardList, Dot, Loader2, MessageSquare, Package, Receipt, ScrollText, ShieldCheck, Ticket, UserRoundCheck, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UI_TEXT } from "@/constants/uiText";
import { useAuth } from "@/features/auth/auth-context";
import { useNotifications } from "@/features/notifications/use-notifications";

type NotificationKind = "package" | "communication" | "reservation" | "visitor" | "ticket" | "system" | "billing" | "regulation" | "survey";

const NOTIFICATION_TYPE_UI: Record<NotificationKind, { label: string; Icon: LucideIcon; chipClassName: string }> = {
  package: {
    label: "Paquete",
    Icon: Package,
    chipClassName: "bg-amber-100 text-amber-800",
  },
  reservation: {
    label: "Reserva",
    Icon: UserRoundCheck,
    chipClassName: "bg-blue-100 text-blue-800",
  },
  communication: {
    label: "Comunicación",
    Icon: MessageSquare,
    chipClassName: "bg-indigo-100 text-indigo-800",
  },
  visitor: {
    label: "Visitante",
    Icon: ShieldCheck,
    chipClassName: "bg-emerald-100 text-emerald-800",
  },
  ticket: {
    label: "PQRS",
    Icon: Ticket,
    chipClassName: "bg-rose-100 text-rose-800",
  },
  system: {
    label: "Sistema",
    Icon: Bell,
    chipClassName: "bg-slate-100 text-slate-800",
  },
  billing: {
    label: "Cartera",
    Icon: Receipt,
    chipClassName: "bg-teal-100 text-teal-800",
  },
  regulation: {
    label: "Reglamento",
    Icon: ScrollText,
    chipClassName: "bg-violet-100 text-violet-800",
  },
  survey: {
    label: "Encuesta",
    Icon: ClipboardList,
    chipClassName: "bg-cyan-100 text-cyan-800",
  },
};

function formatRelativeDate(value?: string) {
  if (!value) return "Ahora";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ahora";

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

function buildFallbackDescription(type: NotificationKind) {
  if (type === "package") return "Nuevo paquete recibido";
  if (type === "reservation") return "Reserva aprobada";
  if (type === "communication") return "Nueva comunicación";
  if (type === "visitor") return "Hay una novedad en visitantes.";
  if (type === "ticket") return "Se registró una novedad de PQRS.";
  if (type === "billing") return "Tienes un movimiento en tu cartera.";
  if (type === "regulation") return "Hay una novedad de reglamento.";
  if (type === "survey") return "Hay una nueva encuesta disponible.";
  return "Tienes una nueva notificación.";
}

export function NotificationsBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const { items, loading, error, unreadCount, markAsRead, markAllAsRead } = useNotifications({
    userId: user?.uid,
    tenantId: user?.tenantId,
    limitCount: 25,
  });

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return null;
    if (unreadCount > 9) return "9+";
    return String(unreadCount);
  }, [unreadCount]);

  const latestSummary = useMemo(() => {
    if (items.length === 0) return "Sin notificaciones";
    const latest = items[0];
    const ui = NOTIFICATION_TYPE_UI[(latest.type as NotificationKind) ?? "system"];
    return `${ui.label}: ${latest.title}`;
  }, [items]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Notificaciones"
        title={latestSummary}
        className="relative px-2"
        aria-expanded={open}
        onClick={() => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const panelWidth = Math.min(0.92 * window.innerWidth, 360);
            const rawRight = window.innerWidth - rect.right;
            setDropdownPos({ top: rect.bottom + 8, right: Math.max(8, Math.min(rawRight, window.innerWidth - panelWidth - 8)) });
          }
          setOpen((prev) => !prev);
        }}
      >
          <Bell className="h-5 w-5 text-current" />
          {unreadLabel ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger-600)] px-1 text-[10px] font-semibold text-white">
              {unreadLabel}
            </span>
          ) : null}
      </Button>

      {open ? (
      <div
        className="z-50 w-[min(92vw,360px)] rounded-2xl border border-[var(--slate-200)] bg-white p-3 shadow-xl"
        style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--slate-900)]">Notificaciones</p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => {
              void markAllAsRead();
            }}
          >
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            {UI_TEXT.notifications.markAllRead}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--slate-200)] p-3 text-xs text-[var(--slate-600)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando notificaciones...
          </div>
        ) : null}

        {error ? <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3 text-xs text-[var(--danger-700)]">{error}</p> : null}

        {!loading && !error && items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--slate-300)] p-4 text-center text-xs text-[var(--slate-500)]">
            Sin notificaciones por ahora.
          </p>
        ) : null}

        {!loading && !error && items.length > 0 ? (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  title={`${NOTIFICATION_TYPE_UI[(item.type as NotificationKind) ?? "system"].label}: ${item.title}`}
                  onClick={async () => {
                    await markAsRead(item.id);
                    setOpen(false);
                    if (item.link) {
                      router.push(item.link);
                    }
                  }}
                  className="w-full rounded-xl border border-[var(--slate-200)] p-3 text-left transition-colors hover:bg-[var(--slate-50)]"
                >
                  {(() => {
                    const ui = NOTIFICATION_TYPE_UI[(item.type as NotificationKind) ?? "system"];
                    const TypeIcon = ui.Icon;
                    return (
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ui.chipClassName}`}>
                          <TypeIcon className="h-3 w-3" />
                          {ui.label}
                        </span>
                        {!item.read ? <Dot className="h-4 w-4 text-[var(--danger-600)]" /> : null}
                      </div>
                    );
                  })()}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--slate-900)]">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--slate-600)]">{item.description || buildFallbackDescription((item.type as NotificationKind) ?? "system")}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--slate-500)]">
                    <span>{formatRelativeDate(item.createdAt)}</span>
                    {item.link ? (
                      <span className="font-medium text-[var(--brand-700)]">
                        Abrir
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 border-t border-[var(--slate-200)] pt-2 text-right">
          <Link href={user?.role === "superadmin" ? "/superadmin" : user?.role === "resident" ? "/resident" : user?.role === "security_guard" || user?.role === "security" ? "/guard" : "/admin"}>
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>{UI_TEXT.notifications.close}</Button>
          </Link>
        </div>
      </div>
      ) : null}
    </div>
  );
}
