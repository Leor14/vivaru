"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { AmenityItem, ReservationItem } from "@/features/admin/services";
import { cn } from "@/lib/utils/cn";

interface ReservationsCalendarProps {
  items: ReservationItem[];
  amenities: AmenityItem[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MIN_HOUR = 6;
const MAX_HOUR = 22;
const TOTAL_MINUTES = (MAX_HOUR - MIN_HOUR) * 60;
const HOUR_LABELS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const LABEL_WIDTH_PX = 112;

type ColorSwatch = { bg: string; border: string; text: string };

const AMENITY_PALETTE: ColorSwatch[] = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" },
  { bg: "#fef9c3", border: "#fde68a", text: "#78350f" },
  { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
  { bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" },
  { bg: "#e0f2fe", border: "#7dd3fc", text: "#075985" },
];

const PENDING_COLORS: ColorSwatch = { bg: "#fef3c7", border: "#d97706", text: "#92400e" };
const FALLBACK_COLORS: ColorSwatch = { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569" };

function toMinutes(time: string): number {
  const parts = time.split(":");
  return Number(parts[0] ?? "0") * 60 + Number(parts[1] ?? "0");
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getWeekStart(offset: number): Date {
  const today = new Date();
  const dow = today.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function parseDateLabel(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const yr = parts[0] ?? new Date().getFullYear();
  const mo = (parts[1] ?? 1) - 1;
  const dy = parts[2] ?? 1;
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(yr, mo, dy));
}

export function ReservationsCalendar({
  items,
  amenities,
  selectedDate,
  onSelectDate,
}: ReservationsCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const weekDays = useMemo(() => {
    const start = getWeekStart(weekOffset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (!start || !end) return "";
    const fmtShort = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
    const monthLong = new Intl.DateTimeFormat("es-CO", { month: "long" }).format(start);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} de ${monthLong} ${start.getFullYear()}`;
    }
    return `${fmtShort.format(start)} – ${fmtShort.format(end)} ${start.getFullYear()}`;
  }, [weekDays]);

  const reservationsByDate = useMemo(() => {
    const map = new Map<string, ReservationItem[]>();
    for (const item of items) {
      if (item.status === "cancelled") continue;
      const existing = map.get(item.date) ?? [];
      existing.push(item);
      map.set(item.date, existing);
    }
    return map;
  }, [items]);

  function amenityColorFor(amenityName: string): ColorSwatch {
    const idx = amenities.findIndex((a) => a.name === amenityName);
    const safeIdx = idx >= 0 ? idx % AMENITY_PALETTE.length : 0;
    return AMENITY_PALETTE[safeIdx] ?? FALLBACK_COLORS;
  }

  const dayReservations = useMemo(
    () => (selectedDate ? (reservationsByDate.get(selectedDate) ?? []) : []),
    [reservationsByDate, selectedDate],
  );

  const dayAmenityNames = useMemo(
    () => [...new Set(dayReservations.map((r) => r.amenityName))],
    [dayReservations],
  );

  function handlePrev() {
    setWeekOffset((o) => o - 1);
    onSelectDate(null);
  }

  function handleNext() {
    setWeekOffset((o) => o + 1);
    onSelectDate(null);
  }

  return (
    <div className="mb-4 mt-4 overflow-hidden rounded-xl border border-[var(--slate-200)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--slate-200)] bg-[var(--surface-strong)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--slate-500)]" aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--slate-900)]">Disponibilidad semanal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Semana anterior"
            onClick={handlePrev}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--slate-200)] text-[var(--slate-600)] hover:bg-[var(--slate-100)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[172px] text-center text-xs text-[var(--slate-600)]">
            {weekLabel}
          </span>
          <button
            type="button"
            aria-label="Semana siguiente"
            onClick={handleNext}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--slate-200)] text-[var(--slate-600)] hover:bg-[var(--slate-100)]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Week day columns */}
      <div className="grid grid-cols-7 divide-x divide-[var(--slate-200)] border-b border-[var(--slate-200)] bg-[var(--surface-strong)]">
        {weekDays.map((day, i) => {
          const ds = toDateStr(day);
          const dayRes = reservationsByDate.get(ds) ?? [];
          const approved = dayRes.filter((r) => r.status === "approved").length;
          const pending = dayRes.filter((r) => r.status === "pending").length;
          const isSelected = ds === selectedDate;
          const isToday = ds === todayStr;

          return (
            <button
              key={ds}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : ds)}
              aria-pressed={isSelected}
              aria-label={`${DAYS_SHORT[i] ?? ""} ${day.getDate()}, ${dayRes.length} reservas`}
              className={cn(
                "flex flex-col items-center gap-1.5 px-1 py-2.5",
                isSelected ? "bg-[var(--brand-700)]" : "hover:bg-[var(--slate-100)]",
              )}
            >
              <span
                className={cn(
                  "text-[11px] leading-none",
                  isSelected ? "text-[var(--on-fill)]/60" : "text-[var(--slate-500)]",
                )}
              >
                {DAYS_SHORT[i]}
              </span>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium leading-none",
                  isSelected
                    ? "bg-[var(--on-fill)]/20 text-[var(--on-fill)]"
                    : isToday
                      ? "bg-[var(--relleno-marca)] text-[var(--on-fill)]"
                      : "text-[var(--slate-900)]",
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex min-h-[18px] flex-wrap justify-center gap-1">
                {approved > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-medium leading-none",
                      isSelected
                        ? "bg-[var(--success-500)]/20 text-[var(--success-200)]"
                        : "bg-[var(--success-50)] text-[var(--success-700)]",
                    )}
                  >
                    {approved}✓
                  </span>
                )}
                {pending > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-medium leading-none",
                      isSelected
                        ? "bg-[var(--amber-400)]/20 text-[var(--amber-200)]"
                        : "bg-[var(--amber-50)] text-[var(--amber-700)]",
                    )}
                  >
                    {pending}·
                  </span>
                )}
                {dayRes.length === 0 && (
                  <span
                    className={cn(
                      "text-xs",
                      isSelected ? "text-[var(--on-fill)]/30" : "text-[var(--slate-300)]",
                    )}
                  >
                    –
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      <div className="bg-[var(--surface-soft)] px-4 py-3">
        {!selectedDate ? (
          <p className="py-5 text-center text-sm text-[var(--slate-500)]">
            Selecciona un día para ver el detalle de reservas
          </p>
        ) : (
          <div>
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-sm font-medium capitalize text-[var(--slate-900)]">
                {parseDateLabel(selectedDate)}
              </span>
              <span className="text-xs text-[var(--slate-500)]">
                {dayReservations.length === 0
                  ? "Sin reservas"
                  : `${dayReservations.length} reserva${dayReservations.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {dayReservations.length === 0 ? (
              <p className="rounded-xl bg-[var(--surface-strong)] py-4 text-center text-sm text-[var(--slate-500)]">
                No hay reservas programadas para este día
              </p>
            ) : (
              <>
                {/* Hour axis */}
                <div
                  className="relative mb-1.5 h-4"
                  style={{ marginLeft: LABEL_WIDTH_PX }}
                >
                  {HOUR_LABELS.map((h) => {
                    const isFirst = h === MIN_HOUR;
                    const isLast = h === MAX_HOUR;
                    const pct = ((h - MIN_HOUR) / (MAX_HOUR - MIN_HOUR)) * 100;
                    return (
                      <span
                        key={h}
                        className="absolute text-[10px] text-[var(--slate-400)]"
                        style={{
                          left: `${pct}%`,
                          transform: isFirst
                            ? "none"
                            : isLast
                              ? "translateX(-100%)"
                              : "translateX(-50%)",
                        }}
                      >
                        {h}
                      </span>
                    );
                  })}
                </div>

                {/* Amenity rows */}
                {dayAmenityNames.map((amenityName) => {
                  const rowRes = dayReservations.filter(
                    (r) => r.amenityName === amenityName,
                  );
                  return (
                    <div key={amenityName} className="mb-1.5 flex items-center">
                      <span
                        title={amenityName}
                        className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap pr-2 text-[11px] text-[var(--slate-500)]"
                        style={{ width: LABEL_WIDTH_PX }}
                      >
                        {amenityName}
                      </span>
                      {/* Timeline bar */}
                      <div className="relative h-8 flex-1 overflow-hidden rounded-sm bg-[var(--surface-strong)]">
                        {/* Vertical hour guides */}
                        {HOUR_LABELS.slice(1, -1).map((h) => {
                          const pct = ((h - MIN_HOUR) / (MAX_HOUR - MIN_HOUR)) * 100;
                          return (
                            <div
                              key={h}
                              className="absolute bottom-0 top-0 w-px bg-[var(--slate-200)]"
                              style={{ left: `${pct}%` }}
                            />
                          );
                        })}
                        {/* Reservation blocks */}
                        {rowRes.map((r) => {
                          const startMin = toMinutes(r.startTime) - MIN_HOUR * 60;
                          const endMin = toMinutes(r.endTime) - MIN_HOUR * 60;
                          const leftPct = Math.max(
                            0,
                            (startMin / TOTAL_MINUTES) * 100,
                          );
                          const widthPct = Math.min(
                            100 - leftPct,
                            ((endMin - startMin) / TOTAL_MINUTES) * 100,
                          );
                          const colors =
                            r.status === "pending"
                              ? PENDING_COLORS
                              : amenityColorFor(r.amenityName);
                          const blockLabel =
                            widthPct > 10
                              ? `${r.startTime}–${r.endTime}${widthPct > 28 ? ` · ${r.reservedBy || r.unitId}` : ""}`
                              : "";

                          return (
                            <div
                              key={r.id}
                              title={`${r.amenityName} · ${r.startTime}–${r.endTime} · ${r.reservedBy} · ${r.status === "approved" ? "Aprobada" : "Pendiente"}`}
                              className="absolute bottom-1 top-1 flex items-center overflow-hidden rounded-sm px-1"
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                background: colors.bg,
                                border: `0.5px solid ${colors.border}`,
                              }}
                            >
                              <span
                                className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium leading-none"
                                style={{ color: colors.text }}
                              >
                                {blockLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--slate-200)] bg-[var(--surface-strong)] px-4 py-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--slate-500)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--success-500)]" />
          Aprobada
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--slate-500)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--amber-500)]" />
          Pendiente
        </span>
        <span className="ml-auto text-[11px] text-[var(--slate-400)]">
          Canceladas no se muestran · pasa el cursor para ver detalles
        </span>
      </div>
    </div>
  );
}
