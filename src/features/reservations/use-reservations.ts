"use client";

import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import { normalizeFirebaseError } from "@/lib/utils/error-handler";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import {
  formatRangeLabel,
  isRangeAvailable,
  parseClockTime,
  parseSlotRange,
  type TimeRange,
} from "@/features/reservations/time-range";
import type { Reservation } from "@/types/domain";
import { combineDateAndTime, isDateTimeValid } from "@/utils/datetimeValidation";
import { checkReservationEligibility } from "@/features/reservations/eligibility";
import { createReservationRequestCallable } from "@/lib/firebase/callables";

function debugReservations(message: string, payload: Record<string, unknown>) {
  const enabled = process.env.NEXT_PUBLIC_DEBUG_GUARD_RESERVATIONS === "true";
  if (!enabled) return;
  console.info(message, payload);
}

function normalizeReservationCreateError(error: unknown) {
  if (error instanceof Error && error.message === "RESERVATION_INELIGIBLE") {
    return "Tu unidad tiene un saldo pendiente. Regulariza tu pago para hacer reservas.";
  }

  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return "No tienes permisos para reservar esta amenidad o la fecha/hora no cumple la anticipacion minima de 30 minutos.";
    }

    if (error.code === "failed-precondition") {
      return "La reserva no pudo procesarse por validacion de horario. Verifica que no este en pasado y tenga 30 minutos de anticipacion.";
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "No fue posible crear la reserva en este momento.";
}

export function useReservations(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      return;
    }

    debugReservations("[reservations] tenant resolved", { tenantId, unitId: unitId ?? null });

    const unsub = subscribeTenantCollection<Reservation>(
      "reservations",
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
        debugReservations("[reservations] loaded", { tenantId, unitId: unitId ?? null, count: data.length });
      },
      (message) => {
        console.error("[admin-dashboard:reservations]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      {
        orderByField: "date",
        orderDirection: "asc",
        equals: unitId ? [{ field: "unitId", value: unitId }] : undefined,
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  if (!tenantId) {
    return { items: [], loading: false, error: null };
  }

  if (!db) return { items: [], loading: false, error: "Firebase no esta configurado." };

  return { items, loading, error };
}

export async function createReservation(input: {
  tenantId: string;
  userId: string;
  createdByName?: string;
  unitId: string;
  amenityId: string;
  amenity: string;
  unitLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  exclusiveUse?: boolean;
  /**
   * Bandera `producto-reservas-servidor` (PRD-V-FIX-001 entrega 1). Encendida,
   * la reserva la decide y la escribe el servidor — mora, cupo, aforo y
   * solapamiento verificados contra TODAS las unidades, no solo la propia.
   * Apagada, se conserva la escritura directa de siempre. El parámetro viene
   * del llamador porque esto no es un hook y no puede leer la bandera.
   */
  viaServidor?: boolean;
}) {
  if (input.viaServidor) {
    // El mensaje del servidor ya nombra la regla incumplida (R7) y
    // `executeCallable` lo deja pasar limpio: no se re-normaliza aquí.
    await createReservationRequestCallable({
      tenantId: input.tenantId,
      unitId: input.unitId,
      unitLabel: input.unitLabel,
      amenityId: input.amenityId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      exclusiveUse: input.exclusiveUse,
      createdByName: input.createdByName,
    });
    return;
  }

  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  if (!input.amenityId.trim()) {
    throw new Error("Selecciona una amenidad valida para crear la reserva.");
  }

  if (!input.amenity.trim()) {
    throw new Error("Selecciona una amenidad valida para crear la reserva.");
  }

  if (!input.unitId.trim()) {
    throw new Error("No fue posible identificar tu unidad. Cierra sesion e inicia nuevamente.");
  }

  const startMinutes = parseClockTime(input.startTime);
  const endMinutes = parseClockTime(input.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error("Selecciona un rango horario valido para continuar.");
  }

  const selectedStartDateTime = combineDateAndTime(input.date, input.startTime);
  if (!selectedStartDateTime) {
    throw new Error("Debes seleccionar una hora futura.");
  }

  if (!isDateTimeValid(selectedStartDateTime, "reservation")) {
    throw new Error("La reserva requiere al menos 30 minutos de anticipacion.");
  }

  const eligibility = await checkReservationEligibility(input.tenantId, input.unitId);
  if (!eligibility.eligible) {
    throw new Error("RESERVATION_INELIGIBLE");
  }

  const reservationPayload = {
    tenantId: input.tenantId,
    createdBy: input.userId,
    createdByName: input.createdByName?.trim() || "",
    residentName: input.createdByName?.trim() || "",
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unitId: input.unitId,
    amenityId: input.amenityId,
    amenity: input.amenity,
    amenityName: input.amenity,
    unitLabel: input.unitLabel,
    reservedBy: input.createdByName?.trim() || "",
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    startAt: Timestamp.fromDate(selectedStartDateTime),
    slot: formatRangeLabel(startMinutes, endMinutes),
    exclusiveUse: input.exclusiveUse === true,
    status: "pending" as const,
  };

  debugReservations("[reservations:create] payload", {
    collection: "reservations",
    operation: "create",
    tenantId: reservationPayload.tenantId,
    userId: reservationPayload.createdBy,
    unitId: reservationPayload.unitId,
    amenityId: reservationPayload.amenityId,
    date: reservationPayload.date,
    startTime: reservationPayload.startTime,
    endTime: reservationPayload.endTime,
    exclusiveUse: reservationPayload.exclusiveUse,
  });

  try {
    const reservationsRef = collection(db, "reservations");
    const candidateRange: TimeRange = { start: startMinutes, end: endMinutes };

    // Resident rules only allow reading reservations from their own unit.
    const existingSnapshot = await getDocs(
      query(
        reservationsRef,
        where("tenantId", "==", input.tenantId),
        where("amenityId", "==", input.amenityId),
        where("date", "==", input.date),
        where("unitId", "==", input.unitId),
      ),
    );

    debugReservations("[reservations:create] precheck-query", {
      collection: "reservations",
      operation: "query",
      tenantId: input.tenantId,
      amenityId: input.amenityId,
      date: input.date,
      unitId: input.unitId,
      resultCount: existingSnapshot.size,
    });

    const existingRanges = existingSnapshot.docs
      .map((reservationDoc) => reservationDoc.data() as Reservation)
      .filter((reservation) => reservation.status !== "cancelled" && reservation.status !== "rejected")
      .map((reservation) => {
        if (reservation.startTime && reservation.endTime) {
          const start = parseClockTime(reservation.startTime);
          const end = parseClockTime(reservation.endTime);
          if (start !== null && end !== null && end > start) {
            return { start, end } satisfies TimeRange;
          }
        }

        if (reservation.slot) {
          return parseSlotRange(reservation.slot);
        }

        return null;
      })
      .filter((value): value is TimeRange => value !== null);

    const hasAvailability = isRangeAvailable({
      candidate: candidateRange,
      existing: existingRanges,
      maxConcurrent: 1,
    });

    if (!hasAvailability) {
      throw new Error("Ese rango ya no esta disponible. Selecciona otro horario.");
    }

    const createdDoc = await addDoc(reservationsRef, reservationPayload);
    debugReservations("[reservations:create] success", {
      collection: "reservations",
      operation: "create",
      reservationId: createdDoc.id,
      tenantId: input.tenantId,
    });
  } catch (error) {
    debugReservations("[reservations:create] failed", {
      collection: "reservations",
      operation: "query+create",
      tenantId: input.tenantId,
      amenityId: input.amenityId,
      date: input.date,
      unitId: input.unitId,
      errorCode: error instanceof FirebaseError ? error.code : null,
      errorMessage: normalizeFirebaseError(error),
    });
    throw new Error(normalizeReservationCreateError(error));
  }
}

export async function cancelReservation(input: {
  reservationId: string;
  tenantId: string;
  userId: string;
  reason?: string;
}) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  await updateDoc(doc(db, "reservations", input.reservationId), {
    tenantId: input.tenantId,
    status: "cancelled",
    cancellationReason: input.reason?.trim() || "Cancelada por residente",
    cancelledAt: serverTimestamp(),
    updatedBy: input.userId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Creates a "Mudanza" (move-in/out) reservation request. Mudanzas reuse the
 * `reservations` collection but carry `kind: 'mudanza'` plus extra metadata
 * (deposit, elevator, notes, receipt) so administrators can review them
 * separately from common-area bookings.
 */
export async function createMudanzaReservation(input: {
  tenantId: string;
  userId: string;
  createdByName?: string;
  unitId: string;
  unitLabel: string;
  date: string;
  startTime: string;
  endTime: string;
  requiresElevator: boolean;
  depositPaid: boolean;
  depositAmount?: number;
  receiptUrl?: string;
  receiptName?: string;
  additionalNotes?: string;
}) {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  if (!input.unitId.trim()) {
    throw new Error("No fue posible identificar tu unidad. Cierra sesion e inicia nuevamente.");
  }

  const startMinutes = parseClockTime(input.startTime);
  const endMinutes = parseClockTime(input.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new Error("Selecciona un rango horario valido para continuar.");
  }

  const selectedStartDateTime = combineDateAndTime(input.date, input.startTime);
  if (!selectedStartDateTime) {
    throw new Error("Debes seleccionar una hora futura.");
  }
  if (!isDateTimeValid(selectedStartDateTime, "reservation")) {
    throw new Error("La mudanza requiere al menos 30 minutos de anticipacion.");
  }

  const mudanzaPayload: Record<string, unknown> = {
    requiresElevator: input.requiresElevator,
    depositPaid: input.depositPaid,
  };
  if (input.depositAmount != null) mudanzaPayload.depositAmount = input.depositAmount;
  if (input.receiptUrl) mudanzaPayload.receiptUrl = input.receiptUrl;
  if (input.receiptName) mudanzaPayload.receiptName = input.receiptName;
  if (input.additionalNotes?.trim()) mudanzaPayload.additionalNotes = input.additionalNotes.trim();

  const payload = {
    tenantId: input.tenantId,
    createdBy: input.userId,
    createdByName: input.createdByName?.trim() || "",
    residentName: input.createdByName?.trim() || "",
    updatedBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    unitId: input.unitId,
    amenityId: "mudanza",
    amenity: "Mudanza",
    amenityName: "Mudanza",
    unitLabel: input.unitLabel,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    slot: formatRangeLabel(startMinutes, endMinutes),
    exclusiveUse: true,
    kind: "mudanza" as const,
    mudanza: mudanzaPayload,
    status: "pending" as const,
  };

  try {
    const reservationsRef = collection(db, "reservations");
    await addDoc(reservationsRef, payload);
  } catch (error) {
    throw new Error(normalizeReservationCreateError(error));
  }
}
