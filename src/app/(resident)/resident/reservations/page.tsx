"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ConciergeBell,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MudanzaWizard } from "@/components/features/reservations/MudanzaWizard";
import { useAuth } from "@/features/auth/auth-context";
import { useReservableAmenities } from "@/features/reservations/use-reservable-amenities";
import {
  cancelReservation,
  createReservation,
  useReservations,
} from "@/features/reservations/use-reservations";
import { checkReservationEligibility } from "@/features/reservations/eligibility";
import {
  buildTimeMarks,
  formatClockTime,
  formatRangeLabel,
  isRangeAvailable,
  normalizeAmenityWindows,
  parseClockTime,
  parseSlotRange,
  SLOT_GRANULARITY_MINUTES,
  type TimeRange,
} from "@/features/reservations/time-range";
import { combineDateAndTime, getMinAllowedDateTime, isDateTimeValid, isSameDay } from "@/utils/datetimeValidation";
import { getStatusLabel } from "@/utils/statusMapper";
import type { Reservation } from "@/types/domain";

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function debugResidentReservations(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(message, payload);
}

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(date);
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

function getStatusBadgeClass(status: Reservation["status"]) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "pending") return "bg-amber-100 text-amber-700";
  if (status === "cancelled") return "bg-rose-100 text-rose-700";
  return "bg-[var(--slate-200)] text-[var(--slate-700)]";
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

function formatReservationTime(reservation: Reservation) {
  if (reservation.startTime && reservation.endTime) {
    return `${reservation.startTime} - ${reservation.endTime}`;
  }

  return reservation.slot ?? "Horario no definido";
}

export default function ResidentReservationsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const { items, loading } = useReservations(tenantId, user?.unitId);
  const {
    items: amenities,
    loading: amenitiesLoading,
    error: amenitiesError,
    hasAmenities,
  } = useReservableAmenities(tenantId);

  const [selectedAmenityId, setSelectedAmenityId] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [exclusiveUse, setExclusiveUse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; amountDue: number } | null>(null);

  useEffect(() => {
    if (!tenantId || !user?.unitId) return;
    checkReservationEligibility(tenantId, user.unitId)
      .then((result) => setEligibility(result))
      .catch(() => setEligibility({ eligible: true, amountDue: 0 }));
  }, [tenantId, user?.unitId]);

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

  const reservationsForAmenity = useMemo(() => {
    if (!selectedAmenity) return [];

    return items.filter((reservation) => {
      if (reservation.status === "cancelled" || reservation.status === "rejected") return false;
      if (reservation.amenityId) {
        return reservation.amenityId === selectedAmenity.id;
      }
      return reservation.amenity.trim().toLowerCase() === selectedAmenity.name.trim().toLowerCase();
    });
  }, [items, selectedAmenity]);

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

  const nowDateTime = new Date();
  const todayStart = new Date(nowDateTime.getFullYear(), nowDateTime.getMonth(), nowDateTime.getDate());
  const minReservationDateTime = getMinAllowedDateTime("reservation", nowDateTime);

  const getMinimumStartMinuteForDate = (dateKey: string) => {
    const parsed = parseDateKey(dateKey);
    if (!parsed) return null;
    if (!isSameDay(parsed, nowDateTime)) return null;
    return minReservationDateTime.getHours() * 60 + minReservationDateTime.getMinutes();
  };

  const hasAnyRangeForDate = (dateKey: string) => {
    const existingRanges = reservationRangesByDate.get(dateKey) ?? [];
    const minStartMinute = getMinimumStartMinuteForDate(dateKey);

    for (const start of amenityTimeMarks) {
      if (minStartMinute !== null && start < minStartMinute) continue;
      for (const end of amenityTimeMarks) {
        if (end <= start) continue;
        const candidate = { start, end };

        if (!rangeInsideWindow(candidate, amenityWindows)) continue;

        const duration = end - start;
        if (maxReservationDurationMinutes !== null && duration > maxReservationDurationMinutes) {
          continue;
        }

        const available = isRangeAvailable({
          candidate,
          existing: existingRanges,
          maxConcurrent: maxReservationsPerSlot,
          stepMinutes: SLOT_GRANULARITY_MINUTES,
        });

        if (available) {
          return true;
        }
      }
    }

    return false;
  };

  const getDateAvailability = (date: Date) => {
    if (!selectedAmenity) {
      return { selectable: false, reason: "Selecciona una amenidad" };
    }

    const atStartOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (atStartOfDay < todayStart) {
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
      return { selectable: false, reason: "Sin cupos" };
    }

    return { selectable: true, reason: "Disponible" };
  };

  const selectableDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const cell of chunkCalendarDays(visibleMonth)) {
      if (!cell.inCurrentMonth) continue;
      const availability = getDateAvailability(cell.date);
      if (availability.selectable) {
        keys.add(toDateKey(cell.date));
      }
    }
    return keys;
  }, [
    visibleMonth,
    nowDateTime,
    selectedAmenity,
    availableWeekdays,
    blockedDates,
    amenityTimeMarks,
    amenityWindows,
    maxReservationDurationMinutes,
    reservationRangesByDate,
    maxReservationsPerSlot,
  ]);

  const rangesForSelectedDate = useMemo(
    () => reservationRangesByDate.get(selectedDate) ?? [],
    [reservationRangesByDate, selectedDate],
  );

  const startTimeOptions = useMemo(() => {
    if (!selectedDate || !selectableDateKeys.has(selectedDate)) return [];
    const minStartMinute = getMinimumStartMinuteForDate(selectedDate);

    return amenityTimeMarks
      .filter((minute) => {
        if (minStartMinute !== null && minute < minStartMinute) return false;
        return amenityTimeMarks.some((endMinute) => {
          if (endMinute <= minute) return false;

          const candidate = { start: minute, end: endMinute };
          if (!rangeInsideWindow(candidate, amenityWindows)) return false;

          const duration = endMinute - minute;
          if (maxReservationDurationMinutes !== null && duration > maxReservationDurationMinutes) return false;

          return isRangeAvailable({
            candidate,
            existing: rangesForSelectedDate,
            maxConcurrent: maxReservationsPerSlot,
            stepMinutes: SLOT_GRANULARITY_MINUTES,
          });
        });
      })
      .map((minute) => formatClockTime(minute));
  }, [
    amenityTimeMarks,
    selectedDate,
    nowDateTime,
    selectableDateKeys,
    amenityWindows,
    maxReservationDurationMinutes,
    rangesForSelectedDate,
    maxReservationsPerSlot,
  ]);

  const endTimeOptions = useMemo(() => {
    if (!selectedDate || !selectedStartTime) return [];

    const start = parseClockTime(selectedStartTime);
    if (start === null) return [];

    return amenityTimeMarks
      .filter((minute) => minute > start)
      .filter((minute) => {
        const candidate = { start, end: minute };

        if (!rangeInsideWindow(candidate, amenityWindows)) return false;

        const duration = minute - start;
        if (maxReservationDurationMinutes !== null && duration > maxReservationDurationMinutes) return false;

        return isRangeAvailable({
          candidate,
          existing: rangesForSelectedDate,
          maxConcurrent: maxReservationsPerSlot,
          stepMinutes: SLOT_GRANULARITY_MINUTES,
        });
      })
      .map((minute) => formatClockTime(minute));
  }, [
    amenityTimeMarks,
    selectedDate,
    selectedStartTime,
    amenityWindows,
    maxReservationDurationMinutes,
    rangesForSelectedDate,
    maxReservationsPerSlot,
  ]);

  const selectedDateAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const parsed = parseDateKey(selectedDate);
    if (!parsed) return null;
    return getDateAvailability(parsed);
  }, [
    selectedDate,
    nowDateTime,
    selectedAmenity,
    availableWeekdays,
    blockedDates,
    amenityTimeMarks,
    amenityWindows,
    maxReservationDurationMinutes,
    reservationRangesByDate,
    maxReservationsPerSlot,
  ]);

  const rangeValidationMessage = useMemo(() => {
    if (!selectedDate) return "Selecciona una fecha en el calendario.";
    if (!selectedStartTime) return "Selecciona la hora de inicio.";
    if (!selectedEndTime) return "Selecciona la hora de fin.";

    const start = parseClockTime(selectedStartTime);
    const end = parseClockTime(selectedEndTime);

    if (start === null || end === null) {
      return "El formato de hora no es valido.";
    }

    if (end <= start) {
      return "La hora de fin debe ser mayor que la hora de inicio.";
    }

    const candidate = { start, end };
    if (!rangeInsideWindow(candidate, amenityWindows)) {
      return "El rango seleccionado esta fuera del horario permitido de la amenidad.";
    }

    const duration = end - start;
    if (maxReservationDurationMinutes !== null && duration > maxReservationDurationMinutes) {
      return `La duracion maxima permitida es de ${maxReservationDurationMinutes} minutos.`;
    }

    const available = isRangeAvailable({
      candidate,
      existing: rangesForSelectedDate,
      maxConcurrent: maxReservationsPerSlot,
      stepMinutes: SLOT_GRANULARITY_MINUTES,
    });

    if (!available) {
      return "El rango se cruza con otra reserva existente.";
    }

    return null;
  }, [
    selectedDate,
    selectedStartTime,
    selectedEndTime,
    amenityWindows,
    maxReservationDurationMinutes,
    rangesForSelectedDate,
    maxReservationsPerSlot,
  ]);

  const displayedReservations = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = parseDateKey(a.date)?.getTime() ?? 0;
      const dateB = parseDateKey(b.date)?.getTime() ?? 0;
      return dateA - dateB;
    });
  }, [items]);

  useEffect(() => {
    if (!tenantId) return;
    debugResidentReservations("[resident-reservations] tenant resolved", {
      tenantId,
      amenitiesLoaded: amenities.length,
      selectedAmenityId: selectedAmenityId || null,
      selectableDatesInView: selectableDateKeys.size,
    });
  }, [tenantId, amenities.length, selectedAmenityId, selectableDateKeys.size]);

  useEffect(() => {
    if (!selectedAmenity) {
      setSelectedDate("");
      setSelectedStartTime("");
      setSelectedEndTime("");
      setExclusiveUse(false);
      return;
    }

    if (!selectedDate || !selectableDateKeys.has(selectedDate)) {
      const firstAvailable = Array.from(selectableDateKeys).sort()[0] ?? "";
      setSelectedDate(firstAvailable);
      setSelectedStartTime("");
      setSelectedEndTime("");
      return;
    }
  }, [selectedAmenity, selectableDateKeys, selectedDate]);

  useEffect(() => {
    if (!selectedDate) {
      setSelectedStartTime("");
      setSelectedEndTime("");
      return;
    }

    if (selectedStartTime && !startTimeOptions.includes(selectedStartTime)) {
      setSelectedStartTime("");
      setSelectedEndTime("");
      return;
    }

    if (selectedEndTime && !endTimeOptions.includes(selectedEndTime)) {
      setSelectedEndTime("");
    }
  }, [selectedDate, selectedStartTime, selectedEndTime, startTimeOptions, endTimeOptions]);

  async function handleCreateReservation() {
    if (submitting) return;

    if (!tenantId || !selectedAmenity || !selectedDate || !user?.tenantName || !user?.uid) {
      toast.error("No hay amenidades disponibles para reservar en tu tenant.");
      return;
    }

    if (!user.unitId) {
      toast.error("No fue posible identificar tu unidad para reservar. Cierra sesion e inicia nuevamente.");
      return;
    }

    debugResidentReservations("[resident-reservations] create:start", {
      tenantId,
      uid: user.uid,
      unitId: user.unitId,
      selectedAmenityId: selectedAmenity.id,
      selectedAmenityName: selectedAmenity.name,
      selectedDate,
      selectedStartTime,
      selectedEndTime,
      exclusiveUse,
    });

    if (rangeValidationMessage) {
      toast.error(rangeValidationMessage);
      return;
    }

    const selectedDateTime = combineDateAndTime(selectedDate, selectedStartTime);
    if (!selectedDateTime || !isDateTimeValid(selectedDateTime, "reservation")) {
      toast.error("La reserva requiere al menos 30 minutos de anticipacion.");
      return;
    }

    try {
      setSubmitting(true);
      await createReservation({
        tenantId,
        userId: user.uid,
        createdByName: user.fullName,
        unitId: user.unitId,
        amenityId: selectedAmenity.id,
        amenity: selectedAmenity.name,
        unitLabel: user.unitLabel ?? "Unidad no definida",
        date: selectedDate,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        exclusiveUse,
      });

      toast.success("Reserva creada en estado pendiente.");
      debugResidentReservations("[resident-reservations] create:success", {
        tenantId,
        uid: user.uid,
        amenityId: selectedAmenity.id,
        selectedDate,
      });
      setSelectedStartTime("");
      setSelectedEndTime("");
      setExclusiveUse(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible crear la reserva.";
      debugResidentReservations("[resident-reservations] create:failed", {
        tenantId,
        uid: user.uid,
        unitId: user.unitId,
        amenityId: selectedAmenity.id,
        selectedDate,
        selectedStartTime,
        selectedEndTime,
        message,
      });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelReservation(reservation: Reservation) {
    if (!tenantId || !user?.uid) {
      toast.error("No se pudo identificar tu sesion para cancelar la reserva.");
      return;
    }

    if (reservation.createdBy !== user.uid) {
      toast.error("Solo puedes cancelar reservas creadas por tu usuario.");
      return;
    }

    if (reservation.status === "cancelled") {
      toast.error("Esta reserva ya fue cancelada.");
      return;
    }

    const confirmed = window.confirm("¿Seguro que deseas cancelar esta reserva?");
    if (!confirmed) return;

    try {
      setCancellingId(reservation.id);
      await cancelReservation({
        reservationId: reservation.id,
        tenantId,
        userId: user.uid,
      });
      toast.success("Reserva cancelada correctamente.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setCancellingId(null);
    }
  }

  const calendarCells = useMemo(() => chunkCalendarDays(visibleMonth), [visibleMonth]);
  const canSubmit =
    Boolean(selectedAmenity && selectedDate && selectedStartTime && selectedEndTime) &&
    !submitting &&
    !rangeValidationMessage &&
    Boolean(selectedDateAvailability?.selectable);

  return (
    <div className="space-y-5">
      <ReservationModeToggleAndWizard
        tenantId={user?.tenantId ?? ""}
        userId={user?.uid ?? ""}
        createdByName={user?.fullName}
        unitId={user?.unitId ?? ""}
        unitLabel={user?.unitLabel ?? "Unidad no definida"}
      />
      <Card className="relative overflow-hidden border-[var(--slate-200)] bg-gradient-to-br from-white via-[#f8fbff] to-[#f2f8ff] p-0">
        {eligibility !== null && !eligibility.eligible ? (
          <div className="flex flex-wrap items-start gap-3 border-b border-[var(--danger-600)]/20 bg-red-50 px-5 py-3.5 sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--danger-700)]">
                Tu unidad tiene un saldo vencido de{" "}
                <span className="font-semibold">
                  {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(eligibility.amountDue)}
                </span>
                . Regulariza tu pago para poder hacer nuevas reservas.
              </p>
            </div>
            <a
              href="/resident/billing"
              className="shrink-0 text-sm font-medium text-[var(--danger-700)] underline underline-offset-2 hover:text-[var(--danger-600)]"
            >
              Ver estado de cuenta
            </a>
          </div>
        ) : null}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(11,60,93,0.14)_0%,rgba(11,60,93,0)_68%)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.14)_0%,rgba(16,185,129,0)_68%)]" />

        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-[var(--slate-900)]">Mis reservas</CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                Elige amenidad, fecha y rango horario con disponibilidad en tiempo real para tu tenant.
              </CardDescription>
            </div>
            <Badge className="bg-[var(--brand-50)] text-[var(--brand-800)]">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Reservas inteligentes
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-[var(--slate-200)] bg-white/85 p-4 shadow-[0_10px_25px_rgba(8,36,58,0.07)] sm:p-5">
              <h4 className="text-sm font-semibold text-[var(--slate-900)]">Formulario de reserva</h4>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="amenity-select" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                    Amenidad
                  </label>
                  <select
                    id="amenity-select"
                    className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
                    value={selectedAmenityId}
                    onChange={(event) => {
                      setSelectedAmenityId(event.target.value);
                      setSelectedStartTime("");
                      setSelectedEndTime("");
                      setExclusiveUse(false);
                    }}
                    disabled={amenitiesLoading || !hasAmenities}
                  >
                    <option value="" disabled>
                      {amenitiesLoading ? "Cargando amenidades..." : "Selecciona una amenidad"}
                    </option>
                    {amenities.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="date-selected" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                    Fecha
                  </label>
                  <div
                    id="date-selected"
                    className="flex min-h-11 items-center rounded-xl border border-[var(--slate-300)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--slate-900)]"
                    aria-live="polite"
                  >
                    {selectedDate ? longDateLabel(selectedDate) : "Selecciona una fecha disponible en el calendario"}
                  </div>
                </div>

                <div>
                  <label htmlFor="start-time-select" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                    Hora de inicio
                  </label>
                  <select
                    id="start-time-select"
                    className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
                    value={selectedStartTime}
                    onChange={(event) => {
                      setSelectedStartTime(event.target.value);
                      setSelectedEndTime("");
                    }}
                    disabled={startTimeOptions.length === 0}
                  >
                    {startTimeOptions.length === 0 ? (
                      <option value="">Sin horas disponibles</option>
                    ) : (
                      <option value="">Selecciona hora de inicio</option>
                    )}
                    {startTimeOptions.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>
                        {timeValue}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="end-time-select" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                    Hora de fin
                  </label>
                  <select
                    id="end-time-select"
                    className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] disabled:bg-[var(--surface-soft)]"
                    value={selectedEndTime}
                    onChange={(event) => setSelectedEndTime(event.target.value)}
                    disabled={endTimeOptions.length === 0 || !selectedStartTime}
                  >
                    {!selectedStartTime ? <option value="">Selecciona primero una hora de inicio</option> : null}
                    {selectedStartTime && endTimeOptions.length === 0 ? <option value="">Sin horas de fin disponibles</option> : null}
                    {selectedStartTime && endTimeOptions.length > 0 ? <option value="">Selecciona hora de fin</option> : null}
                    {endTimeOptions.map((timeValue) => (
                      <option key={timeValue} value={timeValue}>
                        {timeValue}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedStartTime && selectedEndTime ? (
                  <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--slate-700)]">
                    <p className="font-medium text-[var(--slate-800)]">Rango seleccionado</p>
                    <p className="mt-1">{formatRangeLabel(parseClockTime(selectedStartTime) ?? 0, parseClockTime(selectedEndTime) ?? 0)}</p>
                  </div>
                ) : null}

                {rangeValidationMessage ? (
                  <p className="text-xs text-[var(--danger-700)]" role="status" aria-live="polite">
                    {rangeValidationMessage}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--slate-600)]" role="status" aria-live="polite">
                    Selecciona inicio y fin. Validamos cruces en tiempo real antes de reservar.
                  </p>
                )}

                <div className="rounded-xl border border-[var(--slate-200)] bg-white p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-[var(--slate-300)] text-[var(--brand-700)] focus:ring-[var(--brand-200)]"
                      checked={exclusiveUse}
                      onChange={(event) => setExclusiveUse(event.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-[var(--slate-800)]">Solicitar uso exclusivo</span>
                      <span className="mt-0.5 block text-xs text-[var(--slate-600)]">
                        Opcional. Sujeto a las reglas de administración de la amenidad.
                      </span>
                    </span>
                  </label>
                </div>

                <Button
                  className="mt-1 h-11 w-full"
                  onClick={() => void handleCreateReservation()}
                  disabled={!canSubmit || amenitiesLoading}
                  aria-disabled={!canSubmit || amenitiesLoading}
                >
                  {submitting ? "Reservando..." : "Reservar zona"}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--slate-200)] bg-white/85 p-4 shadow-[0_10px_25px_rgba(8,36,58,0.07)] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[var(--slate-900)]">Disponibilidad</h4>
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
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
                  const isSelected = selectedDate === key;
                  const availability = getDateAvailability(cell.date);
                  const isDisabled = !cell.inCurrentMonth || !availability.selectable;

                  const baseClass =
                    "h-10 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]";
                  const visualClass = !cell.inCurrentMonth
                    ? "border-transparent bg-transparent text-[var(--slate-300)]"
                    : isSelected
                      ? "border-[var(--brand-700)] bg-[var(--brand-700)] text-white"
                      : availability.selectable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-[var(--slate-200)] bg-[var(--slate-100)] text-[var(--slate-400)] cursor-not-allowed";

                  return (
                    <button
                      key={`${key}-${cell.inCurrentMonth ? "m" : "x"}`}
                      type="button"
                      className={`${baseClass} ${visualClass}`}
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedDate(key);
                        setSelectedStartTime("");
                        setSelectedEndTime("");
                      }}
                      aria-label={`${longDateLabel(key)} - ${availability.reason}`}
                      title={availability.reason}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--slate-700)]">
                <p className="font-medium text-[var(--slate-800)]">Resumen de fecha seleccionada</p>
                <p className="mt-1">
                  {selectedDate
                    ? `${longDateLabel(selectedDate)} · ${selectedDateAvailability?.reason ?? "Sin estado"}`
                    : "Aun no seleccionas una fecha"}
                </p>
              </div>
            </section>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Historial de reservas</CardTitle>
            <CardDescription className="mt-1">Consulta tus reservas con estado, fecha y rango horario.</CardDescription>
          </div>
          <Badge className="bg-[var(--slate-100)] text-[var(--slate-700)]">{displayedReservations.length} registros</Badge>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {amenitiesLoading ? <p className="text-[var(--slate-600)]">Cargando amenidades disponibles...</p> : null}
          {!amenitiesLoading && amenitiesError ? <p className="text-[var(--danger-700)]">Amenidades: {amenitiesError}</p> : null}
          {!amenitiesLoading && !amenitiesError && !hasAmenities ? (
            <EmptyState
              title="Sin amenidades disponibles"
              description="Tu administración aun no ha publicado amenidades activas para reservas en este tenant."
            />
          ) : null}

          {loading ? <p className="text-[var(--slate-600)]">Cargando reservas...</p> : null}
          {!loading && displayedReservations.length === 0 ? (
            <EmptyState
              title="Sin reservas"
              description="Aun no tienes reservas activas. Puedes crear una reserva desde este panel."
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {displayedReservations.map((reservation) => {
              const canCancelOwnReservation =
                reservation.createdBy === user?.uid && (reservation.status === "pending" || reservation.status === "approved");
              const isCancelling = cancellingId === reservation.id;

              return (
                <article
                  key={reservation.id}
                  className="rounded-2xl border border-[var(--slate-200)] bg-white p-4 shadow-[0_10px_20px_rgba(10,38,62,0.06)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-medium text-[var(--slate-900)]">{reservation.amenity}</p>
                    <Badge className={getStatusBadgeClass(reservation.status)}>{getStatusLabel(reservation.status)}</Badge>
                  </div>

                  <dl className="mt-3 space-y-2 text-xs text-[var(--slate-700)]">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-[var(--brand-700)]" />
                      <dd>{longDateLabel(reservation.date)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-[var(--brand-700)]" />
                      <dd>{formatReservationTime(reservation)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <ConciergeBell className="h-3.5 w-3.5 text-[var(--brand-700)]" />
                      <dd>{reservation.unitLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <dd className="text-[var(--slate-600)]">
                        {reservation.exclusiveUse ? "Uso exclusivo solicitado" : "Uso exclusivo no solicitado"}
                      </dd>
                    </div>
                  </dl>

                  {canCancelOwnReservation ? (
                    <Button
                      variant="outline"
                      className="mt-3 h-9 w-full border-[var(--danger-300)] text-[var(--danger-700)] hover:bg-[var(--danger-50)]"
                      onClick={() => void handleCancelReservation(reservation)}
                      disabled={isCancelling || submitting}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      {isCancelling ? "Cancelando..." : "Cancelar reserva"}
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReservationModeToggleAndWizard(props: {
  tenantId: string;
  userId: string;
  createdByName?: string;
  unitId: string;
  unitLabel: string;
}) {
  const [mode, setMode] = useState<"amenity" | "mudanza">("amenity");
  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Tipo de reserva"
        className="inline-flex items-center gap-1 rounded-xl border border-[var(--slate-200)] bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "amenity"}
          onClick={() => setMode("amenity")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "amenity"
              ? "bg-[var(--brand-700)] text-white"
              : "text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
          }`}
        >
          Reserva de zona comun
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "mudanza"}
          onClick={() => setMode("mudanza")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "mudanza"
              ? "bg-[var(--brand-700)] text-white"
              : "text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
          }`}
        >
          Mudanza
        </button>
      </div>
      {mode === "mudanza" && props.tenantId && props.userId && props.unitId ? (
        <MudanzaWizard
          tenantId={props.tenantId}
          userId={props.userId}
          createdByName={props.createdByName}
          unitId={props.unitId}
          unitLabel={props.unitLabel}
          onSuccess={() => setMode("amenity")}
        />
      ) : null}
    </div>
  );
}
