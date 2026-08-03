"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ReservationsCalendar } from "@/components/features/reservations/ReservationsCalendar";
import type { AmenityItem, ReservationItem } from "@/features/admin/services";
import { useReservableAmenities } from "@/features/reservations/use-reservable-amenities";
import {
  buildTimeMarks,
  formatRangeLabel,
  isRangeAvailable,
  normalizeAmenityWindows,
  parseClockTime,
  parseSlotRange,
  SLOT_GRANULARITY_MINUTES,
  type TimeRange,
} from "@/features/reservations/time-range";
import { useReservations } from "@/features/reservations/use-reservations";
import { useResidentDirectory } from "@/features/security-guard/use-resident-directory";
import type { Reservation } from "@/types/domain";
import { getStatusLabel } from "@/utils/statusMapper";
import { reservationMatchesAmenity } from "@/features/reservations/amenity-match";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function padDate(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${padDate(date.getMonth() + 1)}-${padDate(date.getDate())}`;
}

function parseDateKey(input: string) {
  const [yearRaw, monthRaw, dayRaw] = input.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function longDateLabel(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "Fecha no valida";
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(date);
}

function chunkCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];
  const previousMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({
      date: new Date(month.getFullYear(), month.getMonth() - 1, previousMonthDays - i),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: new Date(month.getFullYear(), month.getMonth(), day),
      inCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({
      date: new Date(month.getFullYear(), month.getMonth() + 1, nextDay),
      inCurrentMonth: false,
    });
  }

  return cells;
}

function toReservationRange(reservation: Reservation): TimeRange | null {
  if (reservation.startTime && reservation.endTime) {
    const start = parseClockTime(reservation.startTime);
    const end = parseClockTime(reservation.endTime);
    if (start !== null && end !== null && end > start) {
      return { start, end };
    }
  }

  if (reservation.slot) {
    return parseSlotRange(reservation.slot);
  }

  return null;
}

function rangeInsideWindow(range: TimeRange, windows: TimeRange[]) {
  return windows.some((window) => range.start >= window.start && range.end <= window.end);
}

function mergeAdjacentRanges(ranges: TimeRange[]) {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

function splitTowerUnit(unitLabel: string) {
  const label = unitLabel ?? "";
  const [tower, unit] = label.split("-");
  return {
    tower: tower?.trim() || "-",
    unit: unit?.trim() || label,
  };
}

function debugGuardReservations(message: string, payload: Record<string, unknown>) {
  const enabled = process.env.NEXT_PUBLIC_DEBUG_GUARD_RESERVATIONS === "true";
  if (!enabled) return;
  console.info(message, payload);
}

// ─── Mapping Reservation → ReservationItem ────────────────────────────────────

function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toReservationItems(reservations: Reservation[]): ReservationItem[] {
  return reservations
    .filter((r) => r.status !== "cancelled" && r.status !== "rejected")
    .map((r) => {
      let startTime = r.startTime ?? "";
      let endTime = r.endTime ?? "";

      if ((!startTime || !endTime) && r.slot) {
        const range = parseSlotRange(r.slot);
        if (range) {
          startTime = minutesToClock(range.start);
          endTime = minutesToClock(range.end);
        }
      }

      const status: ReservationItem["status"] =
        r.status === "approved" ? "approved" :
        r.status === "pending" ? "pending" :
        "cancelled";

      const reservedBy =
        [r.createdByName, r.residentName]
          .find((v) => typeof v === "string" && v.trim().length > 0)
          ?.trim() ?? r.unitLabel ?? r.unitId;

      return {
        id: r.id,
        tenantId: r.tenantId,
        amenityName: r.amenity,
        unitId: r.unitId,
        reservedBy,
        date: r.date,
        startTime,
        endTime,
        status,
        createdAt: r.createdAt ?? "",
      };
    });
}

export function GuardReservations({ tenantId }: { tenantId?: string }) {
  const { items, loading, error } = useReservations(tenantId);
  const { residentNamesByUnit, error: residentDirectoryError } = useResidentDirectory(tenantId);
  const { items: amenities, loading: amenitiesLoading, error: amenitiesError } = useReservableAmenities(tenantId);

  const [selectedAmenityId, setSelectedAmenityId] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    debugGuardReservations("[guard-reservations] tenant resolved", { tenantId: tenantId ?? null });
  }, [tenantId]);

  useEffect(() => {
    if (amenities.length === 0) {
      setSelectedAmenityId("");
      return;
    }

    setSelectedAmenityId((current) => {
      const exists = amenities.some((item) => item.id === current);
      return exists ? current : amenities[0].id;
    });
  }, [amenities]);

  const selectedAmenity = useMemo(
    () => amenities.find((item) => item.id === selectedAmenityId) ?? null,
    [amenities, selectedAmenityId],
  );

  useEffect(() => {
    debugGuardReservations("[guard-reservations] amenities loaded", {
      tenantId: tenantId ?? null,
      count: amenities.length,
      amenityIds: amenities.map((item) => item.id),
      amenityNames: amenities.map((item) => item.name),
    });
  }, [tenantId, amenities]);

  useEffect(() => {
    debugGuardReservations("[guard-reservations] selected amenity", {
      tenantId: tenantId ?? null,
      selectedAmenityId,
      selectedAmenityName: selectedAmenity?.name ?? null,
    });
  }, [tenantId, selectedAmenityId, selectedAmenity]);

  const availableWeekdays = useMemo(() => {
    if (!selectedAmenity?.availableWeekdays || selectedAmenity.availableWeekdays.length === 0) {
      return new Set([0, 1, 2, 3, 4, 5, 6]);
    }
    return new Set(selectedAmenity.availableWeekdays);
  }, [selectedAmenity]);

  const blockedDates = useMemo(() => {
    const dates = [...(selectedAmenity?.blockedDates ?? []), ...(selectedAmenity?.unavailableDates ?? [])];
    return new Set(dates);
  }, [selectedAmenity]);

  const reservationStartDate = selectedAmenity?.availabilityStartDate
    ? parseDateKey(selectedAmenity.availabilityStartDate)
    : null;
  const reservationEndDate = selectedAmenity?.availabilityEndDate
    ? parseDateKey(selectedAmenity.availabilityEndDate)
    : null;

  const maxReservationsPerSlot =
    selectedAmenity?.maxReservationsPerSlot && selectedAmenity.maxReservationsPerSlot > 0
      ? selectedAmenity.maxReservationsPerSlot
      : 1;

  const maxReservationDurationMinutes =
    selectedAmenity?.maxReservationDurationMinutes && selectedAmenity.maxReservationDurationMinutes > 0
      ? selectedAmenity.maxReservationDurationMinutes
      : null;

  const amenityWindows = useMemo(
    () => normalizeAmenityWindows(selectedAmenity?.reservationSlots),
    [selectedAmenity],
  );

  const amenityTimeMarks = useMemo(
    () => buildTimeMarks(amenityWindows, SLOT_GRANULARITY_MINUTES),
    [amenityWindows],
  );

  const amenityTimeMarkSet = useMemo(() => new Set(amenityTimeMarks), [amenityTimeMarks]);

  const reservationsForAmenity = useMemo(() => {
    if (!selectedAmenity) return [];

    return items.filter((reservation) => {
      if (reservation.status === "cancelled" || reservation.status === "rejected") return false;
      return reservationMatchesAmenity(reservation, selectedAmenity);
    });
  }, [items, selectedAmenity]);

  useEffect(() => {
    debugGuardReservations("[guard-reservations] reservations used for availability", {
      tenantId: tenantId ?? null,
      totalTenantReservations: items.length,
      reservationsForAmenity: reservationsForAmenity.length,
      selectedAmenityId,
      selectedAmenityName: selectedAmenity?.name ?? null,
    });
  }, [tenantId, items.length, reservationsForAmenity.length, selectedAmenityId, selectedAmenity]);

  const reservationRangesByDate = useMemo(() => {
    const map = new Map<string, TimeRange[]>();

    reservationsForAmenity.forEach((reservation) => {
      const dateKey = reservation.date;
      const range = toReservationRange(reservation);
      if (!dateKey || !range) return;

      const current = map.get(dateKey) ?? [];
      current.push(range);
      map.set(dateKey, current);
    });

    return map;
  }, [reservationsForAmenity]);

  const now = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const computeAvailableSegmentsForDate = (dateKey: string) => {
    const existingRanges = reservationRangesByDate.get(dateKey) ?? [];
    const availableSegments: TimeRange[] = [];

    for (const start of amenityTimeMarks) {
      const end = start + SLOT_GRANULARITY_MINUTES;
      if (!amenityTimeMarkSet.has(end)) continue;

      const candidate = { start, end };
      if (!rangeInsideWindow(candidate, amenityWindows)) continue;

      const available = isRangeAvailable({
        candidate,
        existing: existingRanges,
        maxConcurrent: maxReservationsPerSlot,
        stepMinutes: SLOT_GRANULARITY_MINUTES,
      });

      if (available) {
        availableSegments.push(candidate);
      }
    }

    return mergeAdjacentRanges(availableSegments);
  };

  const availableSegmentsByDate = useMemo(() => {
    const map = new Map<string, TimeRange[]>();
    const currentMonthCells = chunkCalendarDays(visibleMonth).filter((cell) => cell.inCurrentMonth);

    currentMonthCells.forEach((cell) => {
      const key = toDateKey(cell.date);
      map.set(key, computeAvailableSegmentsForDate(key));
    });

    if (selectedDate && !map.has(selectedDate)) {
      map.set(selectedDate, computeAvailableSegmentsForDate(selectedDate));
    }

    return map;
  }, [
    visibleMonth,
    selectedDate,
    amenityTimeMarks,
    amenityTimeMarkSet,
    amenityWindows,
    reservationRangesByDate,
    maxReservationsPerSlot,
  ]);

  useEffect(() => {
    const summary = Array.from(availableSegmentsByDate.entries()).map(([date, ranges]) => ({
      date,
      rangesCount: ranges.length,
      labels: ranges.map((range) => formatRangeLabel(range.start, range.end)),
    }));

    debugGuardReservations("[guard-reservations] availability map by date", {
      tenantId: tenantId ?? null,
      selectedAmenityId,
      selectedAmenityName: selectedAmenity?.name ?? null,
      visibleMonth: monthLabel(visibleMonth),
      datesCount: summary.length,
      summary,
    });
  }, [tenantId, selectedAmenityId, selectedAmenity, visibleMonth, availableSegmentsByDate]);

  const hasAnyRangeForDate = (dateKey: string) => {
    const segments = availableSegmentsByDate.get(dateKey) ?? computeAvailableSegmentsForDate(dateKey);
    return segments.length > 0;
  };

  const getDateAvailability = (date: Date) => {
    if (!selectedAmenity) {
      return { selectable: false, reason: "Selecciona una amenidad para consultar disponibilidad" };
    }

    const atStartOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (atStartOfDay < now) {
      return { selectable: false, reason: "Fecha pasada" };
    }

    if (reservationStartDate && atStartOfDay < reservationStartDate) {
      return { selectable: false, reason: "Fuera de rango" };
    }

    if (reservationEndDate && atStartOfDay > reservationEndDate) {
      return { selectable: false, reason: "Fuera de rango" };
    }

    if (!availableWeekdays.has(atStartOfDay.getDay())) {
      return { selectable: false, reason: "Dia bloqueado" };
    }

    const key = toDateKey(atStartOfDay);
    if (blockedDates.has(key)) {
      return { selectable: false, reason: "Bloqueo administrativo" };
    }

    if (!hasAnyRangeForDate(key)) {
      return { selectable: false, reason: "Sin horarios disponibles" };
    }

    return { selectable: true, reason: "Disponible" };
  };

  const selectedDateAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const parsed = parseDateKey(selectedDate);
    if (!parsed) return null;
    return getDateAvailability(parsed);
  }, [
    selectedDate,
    selectedAmenity,
    availableWeekdays,
    blockedDates,
    amenityTimeMarks,
    amenityTimeMarkSet,
    amenityWindows,
    reservationRangesByDate,
    maxReservationsPerSlot,
    visibleMonth,
    availableSegmentsByDate,
  ]);

  const selectedDateAvailableSegments = useMemo(() => {
    if (!selectedAmenity || !selectedDate) return [];
    if (!selectedDateAvailability?.selectable) return [];
    return availableSegmentsByDate.get(selectedDate) ?? computeAvailableSegmentsForDate(selectedDate);
  }, [selectedAmenity, selectedDate, selectedDateAvailability, availableSegmentsByDate]);

  useEffect(() => {
    debugGuardReservations("[guard-reservations] slots for selected date", {
      tenantId: tenantId ?? null,
      selectedAmenityId,
      selectedAmenityName: selectedAmenity?.name ?? null,
      selectedDate: selectedDate || null,
      slotsCount: selectedDateAvailableSegments.length,
      slots: selectedDateAvailableSegments.map((range) => formatRangeLabel(range.start, range.end)),
    });
  }, [tenantId, selectedAmenityId, selectedAmenity, selectedDate, selectedDateAvailableSegments]);

  useEffect(() => {
    setSelectedDate("");
  }, [selectedAmenityId]);

  const resolveResidentName = (item: Reservation) => {
    const denormalizedName = [item.createdByName, item.residentName]
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim();

    if (denormalizedName) {
      return denormalizedName;
    }

    const byUnit = residentNamesByUnit.get(item.unitId) ?? [];
    if (byUnit.length === 0) {
      return "Residente por confirmar";
    }

    return byUnit.join(", ");
  };

  const getStatusClass = (status: Reservation["status"]) => {
    if (status === "approved") return "bg-emerald-100 text-emerald-700";
    if (status === "pending") return "bg-amber-100 text-amber-700";
    if (status === "rejected") return "bg-rose-100 text-rose-700";
    return "bg-[var(--slate-200)] text-[var(--slate-700)]";
  };

  const formatTimeRange = (item: Reservation) => {
    if (item.startTime && item.endTime) {
      return `${item.startTime} - ${item.endTime}`;
    }
    return item.slot ?? "Horario no definido";
  };

  const rows = useMemo(
    () =>
      items
        .filter((item) => item.status !== "cancelled")
        .map((item) => {
          const parsed = splitTowerUnit(item.unitLabel);
          return {
            ...item,
            residentName: resolveResidentName(item),
            timeRange: formatTimeRange(item),
            tower: parsed.tower,
            unit: parsed.unit,
          };
        }),
    [items, residentNamesByUnit],
  );

  const calendarCells = useMemo(() => chunkCalendarDays(visibleMonth), [visibleMonth]);

  // Items and amenities shaped for ReservationsCalendar
  const calendarItems = useMemo(() => toReservationItems(items), [items]);
  const calendarAmenities = useMemo(
    () => amenities.map((a) => ({ ...a, createdAt: a.createdAt ?? "" })) as AmenityItem[],
    [amenities],
  );

  return (
    <div className="space-y-5">

      {/* ── Weekly reservations calendar (read-only) ────────────────────────── */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Reservas por día</CardTitle>
            <CardDescription className="mt-1">
              Vista semanal de reservas programadas. Selecciona un día para ver el detalle.
            </CardDescription>
          </div>
          <Badge className="bg-[var(--brand-50)] text-[var(--brand-800)]">Solo lectura</Badge>
        </div>

        <ReservationsCalendar
          items={calendarItems}
          amenities={calendarAmenities}
          selectedDate={calendarSelectedDate}
          onSelectDate={setCalendarSelectedDate}
        />
      </Card>

      {/* ── Monthly availability + operational table ─────────────────────────── */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Disponibilidad de amenidades</CardTitle>
            <CardDescription className="mt-1">Consulta de disponibilidad activa de zonas comunes.</CardDescription>
          </div>
          <Badge className="bg-[var(--brand-50)] text-[var(--brand-800)]">Calendario solo lectura</Badge>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--slate-200)] bg-white p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            <section>
              <label htmlFor="guard-amenity-readonly" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                Amenidad
              </label>
              <select
                id="guard-amenity-readonly"
                className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
                value={selectedAmenityId}
                onChange={(event) => setSelectedAmenityId(event.target.value)}
                disabled={amenitiesLoading || amenities.length === 0}
              >
                <option value="" disabled>
                  {amenitiesLoading
                    ? "Cargando amenidades..."
                    : amenities.length === 0
                      ? "No hay amenidades disponibles"
                      : "Selecciona una amenidad"}
                </option>
                {amenities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--slate-700)]">
                <p className="font-medium text-[var(--slate-800)]">Uso de esta vista</p>
                <p className="mt-1">Consulta informativa de disponibilidad. No permite reservar ni editar.</p>
              </div>

              {amenitiesError ? <p className="mt-2 text-xs text-[var(--danger-700)]">{amenitiesError}</p> : null}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[var(--slate-900)]">Disponibilidad de amenidad</h4>
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    type="button"
                    onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    type="button"
                    onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="mt-1 text-sm font-medium capitalize text-[var(--slate-800)]">{monthLabel(visibleMonth)}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Disponible
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--slate-100)] px-2.5 py-1 text-[var(--slate-600)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--slate-400)]" />
                  No disponible
                </span>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-[var(--slate-500)]">
                {DAY_NAMES.map((dayName) => (
                  <span key={dayName}>{dayName}</span>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const key = toDateKey(cell.date);
                  const availability = getDateAvailability(cell.date);
                  const isSelected = selectedDate === key;
                  const noAmenitySelected = !selectedAmenity;

                  const baseClass =
                    "h-10 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]";
                  const visualClass = !cell.inCurrentMonth
                    ? "border-transparent bg-transparent text-[var(--slate-300)]"
                    : noAmenitySelected
                      ? isSelected
                        ? "border-[var(--slate-500)] bg-[var(--slate-100)] text-[var(--slate-700)]"
                        : "border-[var(--slate-200)] bg-white text-[var(--slate-500)]"
                      : availability.selectable
                        ? isSelected
                          ? "border-emerald-700 bg-emerald-100 text-emerald-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : isSelected
                          ? "border-[var(--slate-500)] bg-[var(--slate-200)] text-[var(--slate-700)]"
                          : "border-[var(--slate-200)] bg-[var(--slate-100)] text-[var(--slate-500)]";

                  return (
                    <button
                      key={`${key}-${cell.inCurrentMonth ? "m" : "x"}`}
                      type="button"
                      className={`${baseClass} ${visualClass}`}
                      disabled={!cell.inCurrentMonth}
                      onClick={() => setSelectedDate(key)}
                      aria-label={`${longDateLabel(key)} - ${availability.reason}`}
                      title={availability.reason}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--slate-700)]">
                <p className="font-medium text-[var(--slate-800)]">Resumen de fecha</p>
                <p className="mt-1">
                  {!selectedAmenity
                    ? "Selecciona una amenidad para visualizar fechas y horarios disponibles."
                    : selectedDate
                      ? `${longDateLabel(selectedDate)} · ${selectedDateAvailability?.selectable ? "Disponible para consulta" : "No disponible"} · ${selectedAmenity.name}`
                      : `Selecciona una fecha para consultar disponibilidad de ${selectedAmenity.name}.`}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-white p-3 text-xs text-[var(--slate-700)]">
                <p className="font-medium text-[var(--slate-900)]">Horarios disponibles</p>
                {!selectedAmenity ? <p className="mt-1">Selecciona una amenidad para consultar horarios disponibles.</p> : null}
                {selectedAmenity && !selectedDate ? <p className="mt-1">Selecciona una fecha para consultar horarios disponibles.</p> : null}
                {selectedAmenity && selectedDate && selectedDateAvailableSegments.length === 0 ? (
                  <p className="mt-1">No hay horarios disponibles para la fecha seleccionada.</p>
                ) : null}

                {selectedDateAvailableSegments.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedDateAvailableSegments.map((range) => {
                      const rangeLabel = formatRangeLabel(range.start, range.end);
                      return (
                        <span
                          key={rangeLabel}
                          className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700"
                        >
                          {rangeLabel}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <CardTitle>Listado operativo de reservas</CardTitle>
        <CardDescription className="mt-1">Nombres legibles por residente, unidad y estado.</CardDescription>

        {error ? <p className="mt-3 text-sm text-[var(--danger-700)]">{error}</p> : null}
        {residentDirectoryError ? <p className="mt-2 text-sm text-[var(--danger-700)]">{residentDirectoryError}</p> : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
              <tr>
                <th className="px-3 py-2">Amenidad</th>
                <th className="px-3 py-2">Residente</th>
                <th className="px-3 py-2">Torre</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Horario</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--slate-600)]" colSpan={7}>Cargando reservas...</td>
                </tr>
              ) : null}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--slate-600)]" colSpan={7}>No hay reservas registradas.</td>
                </tr>
              ) : null}

              {rows.map((item) => (
                <tr key={item.id} className="border-t border-[var(--slate-200)]">
                  <td className="px-3 py-2 font-medium text-[var(--slate-900)]">{item.amenity}</td>
                  <td className="px-3 py-2">{item.residentName}</td>
                  <td className="px-3 py-2">{item.tower}</td>
                  <td className="px-3 py-2">{item.unit}</td>
                  <td className="px-3 py-2">{item.date}</td>
                  <td className="px-3 py-2">{item.timeRange}</td>
                  <td className="px-3 py-2">
                    <Badge className={getStatusClass(item.status)}>{getStatusLabel(item.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
