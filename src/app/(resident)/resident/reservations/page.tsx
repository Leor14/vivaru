"use client";

import { Tabs } from "@/components/ui/tabs";
import { useTabParam } from "@/lib/navigation/use-tab-param";
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
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MudanzaWizard } from "@/components/features/reservations/MudanzaWizard";
import { AmenityPhotoGallery } from "@/components/features/reservations/AmenityPhotoGallery";
import { useAuth } from "@/features/auth/auth-context";
import { useReservableAmenities, type ReservableAmenity } from "@/features/reservations/use-reservable-amenities";
import {
  cancelReservation,
  createReservation,
  useReservations,
} from "@/features/reservations/use-reservations";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { reservationMatchesAmenity } from "@/features/reservations/amenity-match";
import { checkReservationEligibility } from "@/features/reservations/eligibility";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
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
  if (!parsed) return "Fecha no válida";
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function getStatusBadgeClass(status: Reservation["status"]) {
  if (status === "approved") return "bg-[var(--success-100)] text-[var(--success-700)]";
  if (status === "pending") return "bg-[var(--amber-100)] text-[var(--amber-800)]";
  if (status === "cancelled") return "bg-[var(--danger-100)] text-[var(--danger-700)]";
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

/** Nivel de módulo: la lista de claves tiene que ser estable entre renders. */
const TIPOS_DE_RESERVA = [
  { key: "amenity", label: "Zona común" },
  { key: "mudanza", label: "Mudanza" },
] as const;
const CLAVES_TIPO_RESERVA = TIPOS_DE_RESERVA.map((tipo) => tipo.key);

export default function ResidentReservationsPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const tenantId = user?.tenantId;
  const { items, loading } = useReservations(tenantId, user?.unitId);
  const {
    items: amenities,
    loading: amenitiesLoading,
    error: amenitiesError,
    hasAmenities,
  } = useReservableAmenities(tenantId);

  const [selectedAmenityId, setSelectedAmenityId] = useState("");
  const [selectedAmenityDetail, setSelectedAmenityDetail] = useState<ReservableAmenity | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [exclusiveUse, setExclusiveUse] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; amountDue: number } | null>(null);
  const [galleryAmenity, setGalleryAmenity] = useState<ReservableAmenity | null>(null);
  const [monthlyUsageCount, setMonthlyUsageCount] = useState<number | null>(null);
  const reservasEnServidor = useFeatureFlag("producto-reservas-servidor");

  useEffect(() => {
    if (!tenantId || !user?.unitId) return;
    checkReservationEligibility(tenantId, user.unitId)
      .then((result) => setEligibility(result))
      .catch(() => setEligibility({ eligible: true, amountDue: 0 }));
  }, [tenantId, user?.unitId]);

  useEffect(() => {
    if (!tenantId || !user?.unitId || !selectedAmenityDetail) {
      setMonthlyUsageCount(null);
      return;
    }
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    if (!db) return;
    const reservationsRef = collection(db, "tenants", tenantId, "reservations");
    const q = query(
      reservationsRef,
      where("amenityId", "==", selectedAmenityDetail.id),
      where("unitId", "==", user.unitId),
      where("date", ">=", firstOfMonth),
      where("status", "!=", "cancelled"),
    );
    getCountFromServer(q)
      .then((snap) => setMonthlyUsageCount(snap.data().count))
      .catch(() => setMonthlyUsageCount(null));
  }, [tenantId, user?.unitId, selectedAmenityDetail]);

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

  // Slot mode: amenity has pre-defined booking slots (e.g. "08:00 - 09:00")
  const useSlotMode = Boolean(selectedAmenity?.reservationSlots && selectedAmenity.reservationSlots.length > 0);

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
      return reservationMatchesAmenity(reservation, selectedAmenity);
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

    if (useSlotMode) {
      return (selectedAmenity?.reservationSlots ?? []).some((slotLabel) => {
        const range = parseSlotRange(slotLabel);
        if (!range) return false;
        if (minStartMinute !== null && range.start < minStartMinute) return false;
        return isRangeAvailable({
          candidate: range,
          existing: existingRanges,
          maxConcurrent: maxReservationsPerSlot,
          stepMinutes: SLOT_GRANULARITY_MINUTES,
        });
      });
    }

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
      return { selectable: false, reason: "Día bloqueado" };
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

  const slotOptions = useMemo(() => {
    if (!useSlotMode || !selectedDate) return [];
    const slots = selectedAmenity?.reservationSlots ?? [];
    // Use fresh Date() inside the memo so stale renders don't show expired slots as available.
    const freshMinStartMinute = (() => {
      const parsed = parseDateKey(selectedDate);
      if (!parsed) return null;
      const freshNow = new Date();
      if (!isSameDay(parsed, freshNow)) return null;
      const minDt = getMinAllowedDateTime("reservation", freshNow);
      return minDt.getHours() * 60 + minDt.getMinutes();
    })();

    return slots
      .map((slotLabel) => {
        const range = parseSlotRange(slotLabel);
        if (!range) return null;
        const pastToday = freshMinStartMinute !== null && range.start < freshMinStartMinute;
        const available =
          !pastToday &&
          isRangeAvailable({
            candidate: range,
            existing: rangesForSelectedDate,
            maxConcurrent: maxReservationsPerSlot,
            stepMinutes: SLOT_GRANULARITY_MINUTES,
          });
        return {
          label: slotLabel,
          start: formatClockTime(range.start),
          end: formatClockTime(range.end),
          durationMinutes: range.end - range.start,
          available,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [
    useSlotMode,
    selectedDate,
    selectedAmenity,
    rangesForSelectedDate,
    maxReservationsPerSlot,
  ]);

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
      return "El formato de hora no es válido.";
    }

    if (end <= start) {
      return "La hora de fin debe ser mayor que la hora de inicio.";
    }

    const candidate = { start, end };
    if (!rangeInsideWindow(candidate, amenityWindows)) {
      return "El rango seleccionado está fuera del horario permitido de la amenidad.";
    }

    const duration = end - start;
    if (maxReservationDurationMinutes !== null && duration > maxReservationDurationMinutes) {
      return `La duración máxima permitida es de ${maxReservationDurationMinutes} minutos.`;
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
      toast.error("No fue posible identificar tu unidad para reservar. Cierra sesión e inicia nuevamente.");
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
      toast.error("La reserva requiere al menos 30 minutos de anticipación.");
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
        viaServidor: reservasEnServidor,
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

  function handleCancelReservation(reservation: Reservation) {
    if (!tenantId || !user?.uid) {
      toast.error("No se pudo identificar tu sesión para cancelar la reserva.");
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

    setCancelTarget(reservation);
  }

  async function confirmCancelReservation() {
    if (!cancelTarget || !tenantId || !user?.uid) return;
    try {
      setCancellingId(cancelTarget.id);
      await cancelReservation({
        reservationId: cancelTarget.id,
        tenantId,
        userId: user.uid,
      });
      toast.success("Reserva cancelada correctamente.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setCancellingId(null);
      setCancelTarget(null);
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
      <Card className="relative overflow-hidden border-[var(--slate-200)] bg-gradient-to-br from-[var(--surface-strong)] via-[var(--tinte-neutro-fondo-7)] to-[var(--tinte-neutro-fondo-5)] p-0">
        {eligibility !== null && !eligibility.eligible ? (
          <div className="flex flex-wrap items-start gap-3 border-b border-[var(--danger-600)]/20 bg-[var(--danger-50)] px-5 py-3.5 sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--danger-700)]">
                Tu unidad tiene un saldo vencido de{" "}
                <span className="font-semibold">
                  {formatAmount(eligibility.amountDue)}
                </span>
                . Regulariza tu pago para poder hacer nuevas reservas.
              </p>
            </div>
            <a
              href="/resident/account"
              className="shrink-0 text-sm font-medium text-[var(--danger-700)] underline underline-offset-2 hover:text-[var(--danger-600)]"
            >
              Ver estado de cuenta
            </a>
          </div>
        ) : null}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--halo-marca)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[var(--halo-exito)]" />

        <div className="relative p-5 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl text-[var(--slate-900)]">Mis reservas</CardTitle>
              <CardDescription className="mt-1">
                Elige amenidad, fecha y rango horario con disponibilidad en tiempo real.
              </CardDescription>
            </div>
            <Badge className="bg-[var(--brand-50)] text-[var(--brand-800)]">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Reservas inteligentes
            </Badge>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <section className="order-2 rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)]/85 p-4 shadow-[var(--sombra-media-2)] lg:order-1 sm:p-5">
              <h4 className="text-sm font-semibold text-[var(--slate-900)]">Formulario de reserva</h4>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="amenity-select" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                    Amenidad
                  </label>

                  {amenitiesLoading ? (
                    <p className="text-sm text-[var(--slate-500)]">Cargando amenidades...</p>
                  ) : !hasAmenities ? (
                    <p className="text-sm text-[var(--slate-500)]">No hay amenidades disponibles.</p>
                  ) : selectedAmenityDetail ? (
                    <AmenityDetailView
                      amenity={selectedAmenityDetail}
                      monthlyUsageCount={monthlyUsageCount}
                      onReserve={() => {
                        setSelectedAmenityId(selectedAmenityDetail.id);
                        setSelectedStartTime("");
                        setSelectedEndTime("");
                        setExclusiveUse(false);
                        setSelectedAmenityDetail(null);
                      }}
                      onBack={() => setSelectedAmenityDetail(null)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {amenities.map((item) => {
                        const cover = item.photos?.find((p) => p.order === 0) ?? item.photos?.[0];
                        const isSelected = selectedAmenityId === item.id;
                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedAmenityId(item.id);
                              setSelectedAmenityDetail(item);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setSelectedAmenityId(item.id);
                                setSelectedAmenityDetail(item);
                              }
                            }}
                            className={`cursor-pointer overflow-hidden rounded-xl border-2 transition-colors ${
                              isSelected
                                ? "border-[var(--brand-700)] shadow-sm"
                                : "border-[var(--slate-200)] hover:border-[var(--slate-300)]"
                            }`}
                          >
                            {cover ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover.url}
                                alt={item.name}
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-video w-full items-center justify-center bg-[var(--slate-100)]">
                                <span className="text-xs text-[var(--slate-400)]">{item.name}</span>
                              </div>
                            )}
                            <div className="px-2.5 pb-2.5 pt-2">
                              <p className="line-clamp-2 text-xs font-semibold leading-tight text-[var(--slate-900)]">
                                {item.name}
                              </p>
                              {(item.photos ?? []).length > 0 ? (
                                <button
                                  type="button"
                                  aria-label={`Ver fotos de ${item.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGalleryAmenity(item);
                                  }}
                                  className="mt-1 text-[11px] text-[var(--slate-400)] hover:text-[var(--brand-700)] hover:underline"
                                >
                                  Ver fotos
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

                {useSlotMode ? (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-[var(--slate-700)]">Horario disponible</p>
                    {!selectedDate ? (
                      <p className="text-sm text-[var(--slate-500)]">Selecciona una fecha primero.</p>
                    ) : slotOptions.length === 0 ? (
                      <p className="text-sm text-[var(--slate-500)]">No hay horarios disponibles para este día.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {slotOptions.map((slot) => {
                          const isSelected = selectedStartTime === slot.start && selectedEndTime === slot.end;
                          return (
                            <button
                              key={slot.label}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedStartTime("");
                                  setSelectedEndTime("");
                                } else {
                                  setSelectedStartTime(slot.start);
                                  setSelectedEndTime(slot.end);
                                }
                              }}
                              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                                isSelected
                                  ? "border-[var(--brand-700)] bg-[var(--relleno-marca)] text-[var(--on-fill)]"
                                  : slot.available
                                    ? "border-[var(--slate-200)] bg-[var(--surface-strong)] text-[var(--slate-800)] hover:border-[var(--brand-300)] hover:bg-[var(--brand-50)]"
                                    : "cursor-not-allowed border-[var(--slate-100)] bg-[var(--slate-50)] text-[var(--slate-400)]"
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {selectedStartTime && selectedEndTime ? (
                      <p className="mt-2 text-xs text-[var(--slate-600)]">
                        Duración: {(parseClockTime(selectedEndTime) ?? 0) - (parseClockTime(selectedStartTime) ?? 0)} minutos
                      </p>
                    ) : slotOptions.length > 0 ? (
                      <p className="mt-2 text-xs text-[var(--slate-500)]">Selecciona un horario disponible.</p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="start-time-select" className="mb-1.5 block text-sm font-medium text-[var(--slate-700)]">
                        Hora de inicio
                      </label>
                      <select
                        id="start-time-select"
                        className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]"
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
                        className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)] disabled:bg-[var(--surface-soft)]"
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
                  </>
                )}

                <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded-sm border-[var(--slate-300)] text-[var(--brand-700)] focus:ring-[var(--brand-200)]"
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

            <section className="order-1 rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)]/85 p-4 shadow-[var(--sombra-media-2)] lg:order-2 sm:p-5">
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
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-100)] px-2.5 py-1 text-[var(--success-700)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--success-500)]" />
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
                  const isWeekdayBlocked =
                    cell.inCurrentMonth && !availableWeekdays.has(cell.date.getDay());
                  const isDisabled = !cell.inCurrentMonth || !availability.selectable;

                  const baseClass =
                    "h-10 rounded-lg border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]";
                  const visualClass = !cell.inCurrentMonth
                    ? "border-transparent bg-transparent text-[var(--slate-300)]"
                    : isSelected
                      ? "border-[var(--brand-700)] bg-[var(--relleno-marca)] text-[var(--on-fill)]"
                      : isWeekdayBlocked
                        ? "border-transparent bg-transparent text-[var(--slate-400)] opacity-30 cursor-not-allowed pointer-events-none"
                        : availability.selectable
                          ? "border-[var(--success-200)] bg-[var(--success-50)] text-[var(--success-700)] hover:bg-[var(--success-100)]"
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
                    : "Aún no seleccionas una fecha"}
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
              description="Tu administración aún no ha publicado amenidades activas para reservas en este tenant."
            />
          ) : null}

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-5 w-40 rounded-sm" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-4 w-36 rounded-sm" />
                    <Skeleton className="h-4 w-28 rounded-sm" />
                    <Skeleton className="h-4 w-32 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {!loading && displayedReservations.length === 0 ? (
            <EmptyState
              title="Sin reservas"
              description="Aún no tienes reservas activas. Puedes crear una reserva desde este panel."
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
                  className="rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-4 shadow-[var(--sombra-media-3)]"
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

      {galleryAmenity ? (
        <AmenityPhotoGallery
          photos={galleryAmenity.photos ?? []}
          amenityName={galleryAmenity.name}
          open={Boolean(galleryAmenity)}
          onClose={() => setGalleryAmenity(null)}
        />
      ) : null}

      <Dialog open={cancelTarget !== null} onClose={() => setCancelTarget(null)} className="max-w-sm p-6">
        <h2 className="text-base font-semibold text-[var(--slate-900)]">Cancelar reserva</h2>
        <p className="mt-2 text-sm text-[var(--slate-600)]">
          ¿Confirmas la cancelación de tu reserva en{" "}
          <span className="font-medium">{cancelTarget?.amenity}</span> el{" "}
          <span className="font-medium">{cancelTarget ? longDateLabel(cancelTarget.date) : ""}</span>?
          Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancellingId !== null}>
            Volver
          </Button>
          <Button
            variant="danger"
            onClick={() => void confirmCancelReservation()}
            disabled={cancellingId !== null}
          >
            {cancellingId !== null ? "Cancelando..." : "Cancelar reserva"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  social: "Social",
  sports: "Deportes",
  wellness: "Bienestar",
  business: "Negocios",
  other: "Otro",
};

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function AmenityDetailView({
  amenity,
  monthlyUsageCount,
  onReserve,
  onBack,
}: {
  amenity: ReservableAmenity;
  monthlyUsageCount: number | null;
  onReserve: () => void;
  onBack: () => void;
}) {
  const photos = amenity.photos ?? [];
  const monthlyLimit = amenity.maxReservationsPerUnitPerMonth;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-[var(--slate-600)] hover:text-[var(--slate-900)]"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Volver a amenidades
      </button>

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[...photos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={amenity.name}
              className="h-24 w-36 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-xl bg-[var(--slate-100)]">
          <span className="text-xs text-[var(--slate-400)]">Sin fotos</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-[var(--slate-900)]">{amenity.name}</p>
        <Badge className="bg-[var(--slate-100)] text-[var(--slate-600)] text-xs">
          {CATEGORY_LABEL[amenity.category] ?? amenity.category}
        </Badge>
      </div>

      <dl className="space-y-2 text-xs text-[var(--slate-700)]">
        {amenity.operatingHoursStart && amenity.operatingHoursEnd ? (
          <div className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-[var(--brand-700)]" />
            <dd>Horario: {amenity.operatingHoursStart} – {amenity.operatingHoursEnd}</dd>
          </div>
        ) : null}

        {amenity.availableWeekdays && amenity.availableWeekdays.length > 0 ? (
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-700)]" />
            <dd>Días: {amenity.availableWeekdays.map((d) => WEEKDAY_LABEL[d]).join(", ")}</dd>
          </div>
        ) : null}

        {amenity.maxReservationsPerSlot ? (
          <div className="flex items-center gap-2">
            <ConciergeBell className="h-3.5 w-3.5 shrink-0 text-[var(--brand-700)]" />
            <dd>Aforo por franja: {amenity.maxReservationsPerSlot}</dd>
          </div>
        ) : null}

        {monthlyLimit ? (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--brand-700)]" />
            <dd>
              Cuota mensual:{" "}
              {monthlyUsageCount !== null ? (
                <span className={monthlyUsageCount >= monthlyLimit ? "font-semibold text-[var(--danger-700)]" : "font-semibold text-[var(--success-700)]"}>
                  {monthlyUsageCount} / {monthlyLimit} usados
                </span>
              ) : (
                <span>{monthlyLimit} por unidad/mes</span>
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      {amenity.usageRules ? (
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="mb-1 text-xs font-medium text-[var(--slate-800)]">Reglas de uso</p>
          <p className="whitespace-pre-line text-xs text-[var(--slate-700)]">{amenity.usageRules}</p>
        </div>
      ) : null}

      <Button
        className="h-10 w-full"
        onClick={onReserve}
        disabled={Boolean(monthlyLimit && monthlyUsageCount !== null && monthlyUsageCount >= monthlyLimit)}
      >
        Reservar esta amenidad
      </Button>
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
  const [mode, setMode] = useTabParam("tipo", CLAVES_TIPO_RESERVA, "amenity");
  return (
    <div className="space-y-3">
      <Tabs items={TIPOS_DE_RESERVA} value={mode} onChange={setMode} ariaLabel="Tipo de reserva" variant="pill" />
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
