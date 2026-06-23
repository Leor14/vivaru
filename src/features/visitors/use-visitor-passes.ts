"use client";

import { useEffect, useRef, useState } from "react";
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { createVisitorPassCallable } from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
import { createTenantDocument } from "@/lib/firebase/realtime-helpers";
import type { VisitorPass } from "@/types/domain";
import { getVisitorSortTimestamp } from "@/features/visitors/guard-qr-validation";
import { combineDateAndTime, isDateTimeValid } from "@/utils/datetimeValidation";
import { toDateKeyLocal } from "@/utils/date";

function splitTowerUnit(unitLabel: string) {
  const [tower, unit] = unitLabel.split("-");
  return {
    tower: tower?.trim() || "-",
    unit: unit?.trim() || unitLabel,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asTimestampIso(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "object" && value !== null && "seconds" in value && typeof (value as { seconds?: number }).seconds === "number") {
    return new Date(((value as { seconds: number }).seconds) * 1000).toISOString();
  }
  return "";
}

function asStatus(value: unknown): VisitorPass["status"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (["inside", "dentro", "en_porteria", "en porteria", "checked_in"].includes(normalized)) {
    return "inside";
  }

  if (["completed", "finalizado", "finalizada", "salio", "salió", "expired"].includes(normalized)) {
    return "completed";
  }

  if (["scheduled", "programado", "programada", "pending", "activo", "activa"].includes(normalized)) {
    return "scheduled";
  }

  return "scheduled";
}

function normalizeVisitorPass(id: string, raw: DocumentData): VisitorPass {
  const unitLabel = asString(raw.unitLabel);
  const parsedUnit = splitTowerUnit(unitLabel || "-");
  const date = asString(raw.date) || toDateKeyLocal(raw.visitDate);
  const scheduledTime = asString(raw.scheduledTime) || asString(raw.visitDate);
  const hostResidentName =
    asString(raw.hostResidentName) ||
    asString(raw.createdByName) ||
    asString(raw.residentName) ||
    "Residente por confirmar";

  return {
    id,
    tenantId: asString(raw.tenantId),
    unitId: asString(raw.unitId),
    unitLabel,
    visitorName: asString(raw.visitorName),
    documentNumber: asString(raw.documentNumber) || asString(raw.visitorDocument) || asString(raw.visitorIdentification),
    qrCodeValue: asString(raw.qrCodeValue) || asString(raw.qrCode) || asString(raw.qrToken) || asString(raw.invitationCode),
    hostResidentName,
    tower: asString(raw.tower) || parsedUnit.tower,
    unit: asString(raw.unit) || parsedUnit.unit,
    date,
    scheduledTime,
    status: asStatus(raw.status),
    authorizationType: raw.authorizationType === "larga_duracion" ? "larga_duracion" : raw.authorizationType === "puntual" ? "puntual" : undefined,
    validFrom: asString(raw.validFrom) || undefined,
    validUntil: asString(raw.validUntil) || undefined,
    checkInAt: asTimestampIso(raw.checkInAt) || undefined,
    checkOutAt: asTimestampIso(raw.checkOutAt) || undefined,
    visitDate: asString(raw.visitDate) || undefined,
    residentName: asString(raw.residentName) || undefined,
    createdBy: asString(raw.createdBy) || undefined,
    createdByName: asString(raw.createdByName) || undefined,
    guardNotes: Array.isArray(raw.guardNotes)
      ? (raw.guardNotes as Array<Record<string, unknown>>).map((n) => ({
          text: String(n.text ?? ""),
          createdAt: asTimestampIso(n.createdAt) || new Date().toISOString(),
          guardId: String(n.guardId ?? ""),
          guardName: n.guardName ? String(n.guardName) : undefined,
          imageUrl: n.imageUrl ? String(n.imageUrl) : undefined,
          storagePath: n.storagePath ? String(n.storagePath) : undefined,
        }))
      : undefined,
  };
}

export function useVisitorPasses(tenantId?: string, unitId?: string) {
  const [items, setItems] = useState<VisitorPass[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);
  const hasSuccessfulSnapshotRef = useRef(false);
  const latestCountRef = useRef(0);
  const lastStateSourceRef = useRef("init");

  const setVisitorsFromSource = (source: string, nextItems: VisitorPass[]) => {
    lastStateSourceRef.current = source;
    latestCountRef.current = nextItems.length;
    console.debug("[guard:visitors] visitors:setState", {
      source,
      count: nextItems.length,
    });
    setItems(nextItems);
  };

  useEffect(() => {
    if (!tenantId || !db) {
      // Keep last good data while auth/tenant context settles to avoid flicker to empty/error.
      console.debug("[guard:visitors] visitors:setState source", {
        source: "missing-tenant-or-db",
        tenantId: tenantId ?? null,
        hasSuccessfulSnapshot: hasSuccessfulSnapshotRef.current,
        previousCount: latestCountRef.current,
      });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    console.debug("[guard:visitors] subscribing", { tenantId, unitId: unitId ?? null });

    const constraints = [where("tenantId", "==", tenantId)];
    if (unitId) {
      constraints.push(where("unitId", "==", unitId));
    }
    const visitorsQuery = query(collection(db, "visitorPasses"), ...constraints);

    const unsub = onSnapshot(
      visitorsQuery,
      (snapshot) => {
        const snapshotDocs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        console.debug("[guard:visitors] snapshot:rawCount", {
          tenantId,
          rawCount: snapshotDocs.length,
          snapshotDocs,
        });

        const mapped = snapshot.docs.map((item) => normalizeVisitorPass(item.id, item.data()));
        console.debug("[guard:visitors] snapshot:mappedCount", {
          tenantId,
          mappedCount: mapped.length,
        });

        const afterTenantFilter = mapped.filter((item) => item.tenantId === tenantId);
        console.debug("[guard:visitors] visitors:afterTenantFilter", {
          tenantId,
          count: afterTenantFilter.length,
        });

        const afterStatusFilter = afterTenantFilter.filter((item) =>
          item.status === "scheduled" || item.status === "inside" || item.status === "completed",
        );
        console.debug("[guard:visitors] visitors:afterStatusFilter", {
          tenantId,
          count: afterStatusFilter.length,
          statuses: afterStatusFilter.map((item) => ({ id: item.id, status: item.status })),
        });

        // Keep all valid records; date is logged for traceability but not used to exclude records.
        const afterDateFilter = afterStatusFilter;
        console.debug("[guard:visitors] visitors:afterDateFilter", {
          tenantId,
          count: afterDateFilter.length,
        });

        const finalItems = [...afterDateFilter].sort((a, b) => getVisitorSortTimestamp(b) - getVisitorSortTimestamp(a));
        console.debug("[guard:visitors] visitors:finalCount", {
          tenantId,
          count: finalItems.length,
          withoutDateField: finalItems.filter((item) => !item.date).map((item) => item.id),
        });

        console.debug("[guard:visitors] snapshot", {
          tenantId,
          total: finalItems.length,
          changes: snapshot.docChanges().map((change) => ({
            type: change.type,
            id: change.doc.id,
            status: change.doc.data().status,
          })),
        });

        hasSuccessfulSnapshotRef.current = true;
        setVisitorsFromSource("snapshot-success", finalItems);
        setError(null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("[guard:visitors] realtime error", { tenantId, message: snapshotError.message });

        if (hasSuccessfulSnapshotRef.current || latestCountRef.current > 0) {
          // Do not override good data with empty/error when issue is transient.
          console.debug("[guard:visitors] visitors:errorState", {
            tenantId,
            mode: "non-blocking",
            latestCount: latestCountRef.current,
            lastStateSource: lastStateSourceRef.current,
            message: snapshotError.message,
          });
          setError(null);
          setLoading(false);
          return;
        }

        console.debug("[guard:visitors] visitors:errorState", {
          tenantId,
          mode: "blocking",
          latestCount: latestCountRef.current,
          lastStateSource: lastStateSourceRef.current,
          message: snapshotError.message,
        });
        setError("No fue posible cargar visitantes en tiempo real.");
        setLoading(false);
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  if (!db) return { items: [], loading: false, error: "Firebase no esta configurado." };

  return { items, loading, error };
}

export async function createVisitorPass(input: {
  tenantId: string;
  userId: string;
  createdByName?: string;
  unitId?: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  qrCodeValue: string;
  date: string;
  scheduledTime: string;
  hostResidentName?: string;
}) {
  const selectedVisitDateTime = combineDateAndTime(input.date, input.scheduledTime);
  if (!selectedVisitDateTime) {
    throw new Error("Debes seleccionar una hora futura.");
  }

  if (!isDateTimeValid(selectedVisitDateTime, "visitor")) {
    throw new Error("La visita debe registrarse con al menos 15 minutos de anticipacion.");
  }

  const derivedUnitId =
    input.unitId ??
    `unit-${input.unitLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

  const isLocalHost =
    typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const allowClientFallback = process.env.NODE_ENV !== "production" && isLocalHost;

  try {
    await createVisitorPassCallable({
      tenantId: input.tenantId,
      unitId: derivedUnitId,
      unitLabel: input.unitLabel,
      visitorName: input.visitorName,
      documentNumber: input.documentNumber,
      qrCodeValue: input.qrCodeValue,
      date: input.date,
      scheduledTime: input.scheduledTime,
      hostResidentName: input.hostResidentName,
    });
    return;
  } catch (error) {
    if (error instanceof Error && /INVALID_DATETIME/i.test(error.message)) {
      throw new Error("La visita debe registrarse con al menos 15 minutos de anticipacion.");
    }

    if (!allowClientFallback) {
      throw new Error(
        "No fue posible crear el visitante desde el servicio seguro. Intenta nuevamente en unos minutos.",
      );
    }

    // Local-only fallback for environments without functions emulator.
  }

  await createTenantDocument("visitorPasses", input.tenantId, input.userId, {
    unitId: derivedUnitId,
    unitLabel: input.unitLabel,
    visitorName: input.visitorName,
    documentNumber: input.documentNumber,
    qrCodeValue: input.qrCodeValue,
    hostResidentName: input.hostResidentName || input.createdByName?.trim() || "",
    tower: splitTowerUnit(input.unitLabel).tower,
    unit: splitTowerUnit(input.unitLabel).unit,
    date: input.date,
    eventDate: input.date,
    scheduledTime: input.scheduledTime,
    status: "scheduled",
    checkInAt: null,
    checkOutAt: null,
    createdByName: input.createdByName?.trim() || "",
    residentName: input.createdByName?.trim() || "",
  });
}

export async function markVisitorAsInside(input: { visitorId: string; tenantId: string; previousStatus: VisitorPass["status"] }) {
  if (!db) throw new Error("Firebase no esta configurado.");
  if (input.previousStatus !== "scheduled") {
    throw new Error("Solo se puede registrar ingreso para visitantes programados.");
  }

  console.debug("[guard:visitors] update status", {
    tenantId: input.tenantId,
    visitorId: input.visitorId,
    from: input.previousStatus,
    to: "inside",
  });

  await updateDoc(doc(db, "visitorPasses", input.visitorId), {
    status: "inside",
    checkInAt: serverTimestamp(),
  });
}

export async function markVisitorAsCompleted(input: {
  visitorId: string;
  tenantId: string;
  previousStatus: VisitorPass["status"];
  /** Si la autorización sigue vigente (larga duración), el pase vuelve a "scheduled"
   * para permitir ingresos repetidos en lugar de cerrarse. */
  reentrable?: boolean;
}) {
  if (!db) throw new Error("Firebase no esta configurado.");
  if (input.previousStatus !== "inside") {
    throw new Error("Solo se puede registrar salida para visitantes en estado Dentro.");
  }

  const nextStatus = input.reentrable ? "scheduled" : "completed";
  console.debug("[guard:visitors] update status", {
    tenantId: input.tenantId,
    visitorId: input.visitorId,
    from: input.previousStatus,
    to: nextStatus,
  });

  await updateDoc(doc(db, "visitorPasses", input.visitorId), {
    status: nextStatus,
    checkOutAt: serverTimestamp(),
  });
}

export async function addGuardNote(
  passId: string,
  note: { text: string; guardId: string; guardName?: string; imageUrl?: string; storagePath?: string },
): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado.");
  await updateDoc(doc(db, "visitorPasses", passId), {
    guardNotes: arrayUnion({
      text: note.text,
      createdAt: Timestamp.now(),
      guardId: note.guardId,
      guardName: note.guardName ?? null,
      imageUrl: note.imageUrl ?? null,
      storagePath: note.storagePath ?? null,
    }),
  });
}
