import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
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
import { isDateTimeValid, toDateInputValue } from "@/utils/datetimeValidation";
import type { VisitorInvitation, VisitorInvitationStatus } from "features/visitors/types";
import {
  MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE,
  esCategoriaDeVisitante,
  normalizarHorario,
  ultimoDiaPermitidoDelResidente,
  type HorarioDeIngreso,
} from "@/features/visitors/frecuente";

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
  /**
   * `L-08b` (18 sep 2026): **el residente crea su propio frecuente.** Sin esto es una visita de UN
   * día; con esto, un pase `larga_duracion` que vale de `startAt` a `endAt` (días enteros, tope de
   * 12 meses) en los días y la franja del horario.
   */
  frecuente?: {
    categoria: "familiar" | "servicio" | "otro";
    horario?: HorarioDeIngreso;
  };
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
    // `L-08b`: este normalizador arma la invitación campo por campo; lo que no se nombra aquí no
    // llega a la pantalla aunque esté guardado.
    tipo: data.tipo === "frecuente" ? "frecuente" : "visita",
    visitorCategory: esCategoriaDeVisitante(data.visitorCategory) ? data.visitorCategory : undefined,
    horario: normalizarHorario(data.horario),
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

  const diaDeInicio = toDateInputValue(input.startAt);
  const diaDeFin = toDateInputValue(input.endAt);
  // `L-08b`: una visita es de UN día. La invitación de varios días creaba un pase que solo valía el
  // primero, así que se prohíbe por construcción: lo de varios días es un frecuente.
  if (!input.frecuente && diaDeFin !== diaDeInicio) {
    throw new Error("Una visita es de un solo día. Para varios días, crea un visitante frecuente.");
  }
  if (input.frecuente && diaDeFin > ultimoDiaPermitidoDelResidente(diaDeInicio)) {
    throw new Error(`Un visitante frecuente puede autorizarse hasta por ${MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE} meses.`);
  }
  const horario = input.frecuente ? normalizarHorario(input.frecuente.horario) : undefined;

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
      tipo: input.frecuente ? "frecuente" : "visita",
      ...(input.frecuente ? { visitorCategory: input.frecuente.categoria } : {}),
      ...(horario ? { horario } : {}),
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
      // El día LOCAL de la visita, como el resto de escritores de `visitorPasses`. Salía de
      // `toISOString()`, que es el de UTC: una visita a las 19:30 en México quedaba guardada
      // al día siguiente, y la lista de hoy de la portería y el panel la ponían en mañana.
      date: diaDeInicio,
      eventDate: diaDeInicio,
      scheduledTime: input.startAt.toISOString(),
      status: "scheduled",
      // `L-08b`: la portería solo recibía el primer día. Ahora el pase lleva su vigencia entera.
      authorizationType: input.frecuente ? "larga_duracion" : "puntual",
      validFrom: diaDeInicio,
      validUntil: input.frecuente ? diaDeFin : diaDeInicio,
      ...(input.frecuente ? { visitorCategory: input.frecuente.categoria } : {}),
      ...(horario ? { horario } : {}),
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

/**
 * Cancela la invitación **y revoca su pase** (`L-08b`, 18 sep 2026).
 *
 * Antes solo escribía la invitación: la portería lee `visitorPasses`, así que el visitante
 * cancelado seguía entrando. Con un frecuente eso es dejar pasar durante meses a alguien revocado.
 *
 * El pase se encuentra por su QR (`qrCodeValue == qrToken`), que ya enlazaba los dos documentos
 * desde siempre: sirve también para los pases anteriores a esta fecha. Un pase que está DENTRO no
 * cambia de estado —la persona está en el conjunto y la portería tiene que poder registrar su
 * salida—, pero queda marcado con `cancelledAt` y **al salir ya no vuelve a quedar habilitado**.
 */
export async function cancelResidentInvitation(id: string, cancelledBy?: string) {
  if (!db) {
    throw new Error("Firestore no esta inicializado.");
  }

  const invitationRef = doc(db, "visitorInvitations", id);
  const snapshot = await getDoc(invitationRef);
  await updateDoc(invitationRef, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const data = snapshot.exists() ? snapshot.data() : null;
  const qrToken = asString(data?.qrToken);
  if (!data || !qrToken) return;

  const pases = await getDocs(
    query(
      collection(db, "visitorPasses"),
      where("tenantId", "==", asString(data.tenantId)),
      where("unitId", "==", asString(data.unitId)),
      where("qrCodeValue", "==", qrToken),
    ),
  );
  await Promise.all(
    pases.docs
      .filter((pase) => pase.data().status !== "completed" && pase.data().status !== "cancelled")
      .map((pase) =>
        updateDoc(pase.ref, {
          ...(pase.data().status === "inside" ? {} : { status: "cancelled" }),
          cancelledAt: serverTimestamp(),
          ...(cancelledBy ? { cancelledBy } : {}),
          updatedAt: serverTimestamp(),
        }),
      ),
  );
}