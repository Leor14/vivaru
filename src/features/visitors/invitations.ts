import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";

import { db } from "@/lib/firebase/client";
import { createTenantDocument } from "@/lib/firebase/realtime-helpers";
import { isDateTimeValid } from "@/utils/datetimeValidation";
import type { VisitorInvitation, VisitorInvitationStatus } from "features/visitors/types";

export type CreateInvitationInput = {
  tenantId: string;
  unitId: string;
  unitLabel?: string;
  residentUserId: string;
  authorizedByName: string;
  visitorName: string;
  visitorIdentification: string;
  plate?: string;
  visitReason: string;
  adultsCount: number;
  childrenCount: number;
  allowedUses: number;
  startAt: Date;
  endAt: Date;
};

const VALID_STATUSES: VisitorInvitationStatus[] = ["active", "cancelled", "expired", "used_up"];

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function asOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const candidate = value as { toDate: () => Date };
    return candidate.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function asStatus(value: unknown): VisitorInvitationStatus {
  if (typeof value === "string" && VALID_STATUSES.includes(value as VisitorInvitationStatus)) {
    return value as VisitorInvitationStatus;
  }
  return "active";
}

function normalizeInvitationMutationError(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "La invitacion debe programarse en futuro con al menos 15 minutos de anticipacion.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "No fue posible crear la invitacion.";
}

function mapInvitation(snapshot: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData }): VisitorInvitation {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    tenantId: asString(data.tenantId),
    unitId: asString(data.unitId),
    residentUserId: asString(data.residentUserId),
    authorizedByName: asString(data.authorizedByName),
    visitorName: asString(data.visitorName),
    visitorIdentification: asString(data.visitorIdentification),
    plate: asOptionalString(data.plate),
    visitReason: asString(data.visitReason),
    adultsCount: asNumber(data.adultsCount, 0),
    childrenCount: asNumber(data.childrenCount, 0),
    allowedUses: asNumber(data.allowedUses, 1),
    startAt: asDate(data.startAt),
    endAt: asDate(data.endAt),
    status: asStatus(data.status),
    qrToken: asString(data.qrToken),
    invitationCode: asString(data.invitationCode),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    cancelledAt: data.cancelledAt ? asDate(data.cancelledAt) : undefined,
  };
}

export function subscribeResidentInvitations(
  tenantId: string,
  unitId: string,
  onData: (invitations: VisitorInvitation[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  if (!db) {
    throw new Error("Firestore no esta inicializado.");
  }

  const invitationsQuery = query(
    collection(db, "visitorInvitations"),
    where("tenantId", "==", tenantId),
    where("unitId", "==", unitId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    invitationsQuery,
    (snapshot) => {
      const invitations = snapshot.docs.map((docSnapshot) => mapInvitation(docSnapshot));
      onData(invitations);
    },
    (error) => {
      onError(error.message || "No fue posible cargar invitaciones.");
    },
  );
}

export async function createResidentInvitation(input: CreateInvitationInput) {
  if (!db) {
    throw new Error("Firestore no esta inicializado.");
  }

  if (!(input.startAt instanceof Date) || Number.isNaN(input.startAt.getTime())) {
    throw new Error("La fecha y hora de inicio no son validas.");
  }

  if (!(input.endAt instanceof Date) || Number.isNaN(input.endAt.getTime())) {
    throw new Error("La fecha y hora de fin no son validas.");
  }

  if (!isDateTimeValid(input.startAt, "visitor")) {
    throw new Error("La invitacion debe registrarse con al menos 15 minutos de anticipacion.");
  }

  if (input.endAt <= input.startAt) {
    throw new Error("La fecha y hora de fin debe ser posterior al inicio.");
  }

  try {
    const invitationCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const qrToken = crypto.randomUUID();

    const docRef = await addDoc(collection(db, "visitorInvitations"), {
      tenantId: input.tenantId,
      unitId: input.unitId,
      residentUserId: input.residentUserId,
      authorizedByName: input.authorizedByName,
      visitorName: input.visitorName,
      visitorIdentification: input.visitorIdentification,
      plate: input.plate ?? "",
      visitReason: input.visitReason,
      adultsCount: input.adultsCount,
      childrenCount: input.childrenCount,
      allowedUses: input.allowedUses,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "active",
      qrToken,
      invitationCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const normalizedUnitLabel = input.unitLabel?.trim() || input.unitId;
    const [towerValue, unitValue] = normalizedUnitLabel.split("-");
    await createTenantDocument("visitorPasses", input.tenantId, input.residentUserId, {
      unitId: input.unitId,
      unitLabel: normalizedUnitLabel,
      visitorName: input.visitorName,
      documentNumber: input.visitorIdentification,
      qrCodeValue: qrToken,
      hostResidentName: input.authorizedByName,
      tower: towerValue?.trim() || "-",
      unit: unitValue?.trim() || normalizedUnitLabel,
      date: input.startAt.toISOString().slice(0, 10),
      eventDate: input.startAt.toISOString().slice(0, 10),
      scheduledTime: input.startAt.toISOString(),
      status: "scheduled",
      checkInAt: null,
      checkOutAt: null,
      residentName: input.authorizedByName,
      createdByName: input.authorizedByName,
    });

    return docRef.id;
  } catch (error) {
    throw new Error(normalizeInvitationMutationError(error));
  }
}

export async function getResidentInvitationById(id: string) {
  if (!db) {
    throw new Error("Firestore no esta inicializado.");
  }

  const invitationRef = doc(db, "visitorInvitations", id);
  const snapshot = await getDoc(invitationRef);

  if (!snapshot.exists()) {
    return null;
  }

  return mapInvitation(snapshot);
}

export async function cancelResidentInvitation(id: string) {
  if (!db) {
    throw new Error("Firestore no esta inicializado.");
  }

  const invitationRef = doc(db, "visitorInvitations", id);
  await updateDoc(invitationRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}