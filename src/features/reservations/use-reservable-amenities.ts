"use client";

import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { AmenityPhoto } from "@/features/admin/services";

export interface ReservableAmenity {
  id: string;
  tenantId: string;
  name: string;
  category: "social" | "sports" | "wellness" | "business" | "other";
  status: "active" | "inactive";
  isReservable?: boolean;
  reservationSlots?: string[];
  availableWeekdays?: number[];
  blockedDates?: string[];
  unavailableDates?: string[];
  availabilityStartDate?: string;
  availabilityEndDate?: string;
  maxReservationsPerSlot?: number;
  maxReservationDurationMinutes?: number;
  maxReservationsPerUnitPerMonth?: number;
  usageRules?: string;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  slotDurationMinutes?: number;
  temporaryDisabled?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  photos?: AmenityPhoto[];
}

function debugAmenities(message: string, payload: Record<string, unknown>) {
  const enabled = process.env.NEXT_PUBLIC_DEBUG_GUARD_RESERVATIONS === "true";
  if (!enabled) return;
  console.info(message, payload);
}

function isAmenityReservable(item: ReservableAmenity) {
  if (item.status !== "active") return false;
  if (item.isReservable === false) return false;
  if (item.temporaryDisabled === true) return false;
  if (typeof item.deletedAt === "string" && item.deletedAt.trim().length > 0) return false;
  return true;
}

export function useReservableAmenities(tenantId?: string) {
  const [items, setItems] = useState<ReservableAmenity[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    debugAmenities("[resident-reservations:amenities] tenant resolved", { tenantId });
    setLoading(true);

    const unsub = subscribeTenantCollection<ReservableAmenity>(
      "amenities",
      tenantId,
      (data) => {
        const filtered = data.filter(isAmenityReservable).sort((a, b) => a.name.localeCompare(b.name, "es"));
        setItems(filtered);
        setError(null);
        setLoading(false);

        debugAmenities("[resident-reservations:amenities] loaded", {
          tenantId,
          totalFromQuery: data.length,
          reservableCount: filtered.length,
        });
      },
      (message) => {
        debugAmenities("[resident-reservations:amenities] error", { tenantId, message });
        setError(message);
        setLoading(false);
      },
      {
        equals: [{ field: "status", value: "active" }],
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  const hasAmenities = useMemo(() => items.length > 0, [items]);

  if (!tenantId) {
    return {
      items: [],
      loading: false,
      error: null,
      hasAmenities: false,
    };
  }

  if (!db) {
    return {
      items: [],
      loading: false,
      error: "Firebase no esta configurado.",
      hasAmenities: false,
    };
  }

  return {
    items,
    loading,
    error,
    hasAmenities,
  };
}