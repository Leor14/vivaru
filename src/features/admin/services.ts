import {
  type FirestoreError,
  Timestamp,
  arrayRemove,
  arrayUnion,
  addDoc,
  collection,
  deleteDoc,
  doc,
  deleteField,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import { combineDateAndTime, isDateTimeValid } from "@/utils/datetimeValidation";
import type { FiscalProfile } from "@/types/domain";

export type UnitItem = {
  id: string;
  tenantId: string;
  unitId: string;
  displayName: string;
  tower: string;
  type: "apartment" | "house" | "office" | "other";
  status: "active" | "inactive";
  ownerIds: string[];
  residentIds: string[];
  createdAt: string;
  updatedAt: string;
  reservationExempt?: boolean;
};

export type PersonItem = {
  id: string;
  tenantId: string;
  fullName: string;
  email: string;
  phone: string;
  documentNumber?: string;
  roleType: "owner_occupant" | "tenant" | "investor" | "other";
  occupancyType: "owner_occupant" | "tenant" | "investor" | "other";
  unitId: string;
  tower: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type PersonRole = PersonItem["roleType"];

function normalizeRoleType(role: unknown): PersonRole {
  if (role === "owner" || role === "resident") return "owner_occupant";
  if (role === "owner_occupant" || role === "tenant" || role === "investor" || role === "other") return role;
  return "other";
}

function shouldAttachToOwners(role: PersonRole) {
  return role === "owner_occupant" || role === "investor";
}

function shouldAttachToResidents(role: PersonRole) {
  return role === "tenant" || role === "other";
}

export type CommunicationItem = {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  status: "published" | "draft" | "archived" | "scheduled" | "expired";
  startsAt?: string;
  endsAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceItem = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: "resident_offer" | "third_party";
  serviceType: string;
  providerName: string;
  providerContact: string;
  unitId?: string;
  imageUrl?: string;
  imagePath?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentPath?: string;
  status: "active" | "inactive";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ReservationItem = {
  id: string;
  tenantId: string;
  amenityName: string;
  unitId: string;
  reservedBy: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "approved" | "cancelled";
  paymentConfirmed?: boolean;
  cancellationReason?: string;
  createdAt: string;
};

export type AmenityPhoto = {
  id: string;
  url: string;
  storagePath: string;
  order: number;
};

export type AmenityItem = {
  id: string;
  tenantId: string;
  name: string;
  category: "social" | "sports" | "wellness" | "business" | "other";
  status: "active" | "inactive";
  photos?: AmenityPhoto[];
  // Reservation config
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  slotDurationMinutes?: number;
  reservationSlots?: string[];
  availableWeekdays?: number[];
  maxReservationsPerSlot?: number;
  maxReservationDurationMinutes?: number;
  maxReservationsPerUnitPerMonth?: number;
  usageRules?: string;
  createdAt: string;
  updatedAt: string;
};

export type VisitorItem = {
  id: string;
  tenantId: string;
  visitorName: string;
  visitorDocument: string;
  qrCode: string;
  authorizationType: "puntual" | "larga_duracion";
  visitorCategory: "familiar" | "servicio" | "otro";
  unitId: string;
  authorizedBy: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime?: string;
  notes?: string;
  status: "active" | "expired" | "cancelled";
  createdAt: string;
};

export type DocumentItem = {
  id: string;
  tenantId: string;
  fileName: string;
  description: string;
  fileUrl: string;
  storagePath: string;
  uploadedBy: string;
  createdAt: string;
  // F0 (carpetas): clasificación y metadatos. Opcionales para compatibilidad con
  // documentos existentes.
  folderId?: string | null;
  category?: DocumentCategory;
  uploadedByName?: string;
  fileSize?: number;
  contentType?: string;
};

/** Taxonomía de categorías de documento (ver plan-documentos-carpetas). */
export type DocumentCategory =
  | "asamblea"
  | "contrato"
  | "plano"
  | "memoria"
  | "financiero"
  | "legal"
  | "otro";

/** Carpeta del repositorio documental (estilo Drive). Solo admin. */
export type DocumentFolder = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  /** null = carpeta madre (raíz del tenant). */
  parentId: string | null;
  /** Ruta materializada de ids, p. ej. "rootId/childId". Habilita breadcrumb/subárbol. */
  path: string;
  /** 0 = madre … máx 4 (madre + 4 niveles de subcarpetas). */
  depth: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ResidentModules = {
  reservations: boolean;
  services: boolean;
  surveys: boolean;
  regulations: boolean;
};

export const DEFAULT_RESIDENT_MODULES: ResidentModules = {
  reservations: true,
  services: true,
  surveys: true,
  regulations: true,
};

export type TenantSettingsItem = {
  tenantId: string;
  tenantName: string;
  tenantDisplayName?: string;
  logoUrl?: string;
  logoPath?: string;
  brandColor: string;
  updatedAt: string;
  reservationPolicy?: {
    blockOnDebt: boolean;
  };
  residentModules?: ResidentModules;
  fiscalProfile?: FiscalProfile;
  adminProfile?: {
    uid: string;
    fullName: string;
    avatarId: "avatar-a" | "avatar-b" | "avatar-c" | "avatar-d";
  };
};

function assertDb() {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  return db;
}

function assertStorage() {
  if (!storage) {
    throw new Error("Firebase Storage no esta configurado en este entorno.");
  }

  return storage;
}

function toIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function mapDoc<T>(snapshotId: string, raw: Record<string, unknown>) {
  return {
    id: snapshotId,
    ...raw,
    createdAt: toIso(raw.createdAt),
    updatedAt: toIso(raw.updatedAt),
  } as T;
}

function isMissingIndexError(error: FirestoreError) {
  return error.code === "failed-precondition" && /requires an index/i.test(error.message);
}

function toRealtimeUserError(error: FirestoreError) {
  if (error.code === "permission-denied") {
    return "No tienes permisos para operar este modulo en el tenant actual.";
  }

  if (error.code === "unauthenticated") {
    return "Tu sesion expiro. Inicia sesion nuevamente.";
  }

  if (isMissingIndexError(error)) {
    return "Este listado requiere un indice de Firestore en despliegue. Intenta nuevamente en unos minutos.";
  }

  if (error.code === "invalid-argument") {
    return "Hay datos invalidos en la solicitud. Verifica la informacion ingresada.";
  }

  return "No fue posible cargar la informacion de este modulo. Intenta nuevamente.";
}

function toMutationUserError(error: unknown, fallbackMessage: string) {
  const firestoreError = error as FirestoreError;
  if (firestoreError?.code === "permission-denied") {
    return "No tienes permisos para ejecutar esta accion en el tenant actual.";
  }
  if (firestoreError?.code === "unauthenticated") {
    return "Tu sesion expiro. Inicia sesion nuevamente para continuar.";
  }
  if (firestoreError?.code === "invalid-argument") {
    return "No se pudo procesar la accion por datos invalidos.";
  }
  if (firestoreError?.code === "failed-precondition" && /requires an index/i.test(firestoreError.message)) {
    return "Esta accion depende de un indice de Firestore aun no desplegado.";
  }

  return fallbackMessage;
}

function toDateTimeMutationError(error: unknown, fallbackMessage: string, bufferMinutes: number) {
  const firestoreError = error as FirestoreError;
  if (firestoreError?.code === "permission-denied" || firestoreError?.code === "failed-precondition") {
    return `Fecha y hora invalidas. Debe ser una programacion futura con al menos ${bufferMinutes} minutos de anticipacion.`;
  }

  return toMutationUserError(error, fallbackMessage);
}

function subscribeTenant<T>(
  collectionName: string,
  tenantId: string,
  onData: (items: T[]) => void,
  onError: (message: string) => void,
  orderByField = "createdAt",
) {
  const firestore = assertDb();
  const constraints: QueryConstraint[] = [where("tenantId", "==", tenantId), orderBy(orderByField, "desc")];

  return onSnapshot(
    query(collection(firestore, collectionName), ...constraints),
    (snapshot) => {
      const items = snapshot.docs.map((item) => mapDoc<T>(item.id, item.data() as Record<string, unknown>));
      onData(items);
    },
    (error) => {
      const firestoreError = error as FirestoreError;
      console.error("[firestore][subscribeTenant] query failed", {
        collectionName,
        tenantId,
        orderByField,
        code: firestoreError.code,
        message: firestoreError.message,
      });
      onError(toRealtimeUserError(firestoreError));
    },
  );
}

export function watchUnits(tenantId: string, onData: (items: UnitItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  return onSnapshot(
    query(collection(firestore, "units"), where("tenantId", "==", tenantId)),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => mapDoc<UnitItem>(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onData(items);
    },
    (error) => {
      const firestoreError = error as FirestoreError;
      console.error("[firestore][watchUnits] query failed", {
        collectionName: "units",
        tenantId,
        where: "tenantId == <tenantId>",
        code: firestoreError.code,
        message: firestoreError.message,
      });
      onError(toRealtimeUserError(firestoreError));
    },
  );
}

export async function createUnit(
  tenantId: string,
  userId: string,
  payload: {
    displayName: string;
    tower: string;
    type: UnitItem["type"];
    status: UnitItem["status"];
  },
): Promise<{ id: string; unitId: string; displayName: string }> {
  const firestore = assertDb();
  const unitId = payload.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const created = await addDoc(collection(firestore, "units"), {
    tenantId,
    unitId,
    displayName: payload.displayName,
    tower: payload.tower,
    type: payload.type,
    status: payload.status,
    ownerIds: [],
    residentIds: [],
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: created.id, unitId, displayName: payload.displayName };
}

/**
 * Importación masiva de unidades desde CSV.
 * Escribe en lotes de 450 (límite Firestore: 500 ops/batch) para garantizar
 * atomicidad por lote. Si un lote falla, los anteriores ya fueron confirmados
 * — esto es aceptable para importaciones de datos iniciales.
 */
export async function bulkCreateUnits(
  tenantId: string,
  userId: string,
  rows: Array<{
    displayName: string;
    tower: string;
    type: UnitItem["type"];
    status: UnitItem["status"];
  }>,
): Promise<number> {
  const firestore = assertDb();
  const CHUNK = 450;
  let created = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const batch = writeBatch(firestore);

    for (const row of chunk) {
      const unitId = row.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const ref = doc(collection(firestore, "units"));
      batch.set(ref, {
        tenantId,
        unitId,
        displayName: row.displayName,
        tower: row.tower,
        type: row.type,
        status: row.status,
        ownerIds: [],
        residentIds: [],
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    }

    await batch.commit();
  }

  return created;
}

export async function updateUnit(
  id: string,
  userId: string,
  payload: {
    displayName: string;
    tower: string;
    type: UnitItem["type"];
    status: UnitItem["status"];
  },
) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "units", id), {
    ...payload,
    unitId: payload.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUnit(id: string) {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "units", id));
}

export function watchPeople(tenantId: string, onData: (items: PersonItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  return onSnapshot(
    query(collection(firestore, "people"), where("tenantId", "==", tenantId)),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => {
          const mapped = mapDoc<PersonItem>(item.id, item.data() as Record<string, unknown>);
          const roleType = normalizeRoleType(mapped.roleType);
          return {
            ...mapped,
            roleType,
            occupancyType: normalizeRoleType(mapped.occupancyType ?? mapped.roleType),
          };
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      onData(items);
    },
    (error) => {
      const firestoreError = error as FirestoreError;
      console.error("[firestore][watchPeople] query failed", {
        collectionName: "people",
        tenantId,
        where: "tenantId == <tenantId>",
        code: firestoreError.code,
        message: firestoreError.message,
      });
      onError(toRealtimeUserError(firestoreError));
    },
  );
}

export async function createPerson(
  tenantId: string,
  userId: string,
  payload: Omit<PersonItem, "id" | "tenantId" | "createdAt" | "updatedAt">,
) {
  const firestore = assertDb();
  const created = await addDoc(collection(firestore, "people"), {
    ...payload,
    tenantId,
    createdBy: userId,
    updatedBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (shouldAttachToOwners(payload.roleType)) {
    await updateDoc(doc(firestore, "units", payload.unitId), {
      ownerIds: arrayUnion(created.id),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  if (shouldAttachToResidents(payload.roleType)) {
    await updateDoc(doc(firestore, "units", payload.unitId), {
      residentIds: arrayUnion(created.id),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  return created.id;
}

export async function updatePerson(id: string, userId: string, payload: Partial<PersonItem>) {
  const firestore = assertDb();
  const personRef = doc(firestore, "people", id);
  const previousSnap = await getDoc(personRef);
  const previous = previousSnap.exists() ? (previousSnap.data() as Partial<PersonItem>) : null;

  await updateDoc(doc(firestore, "people", id), {
    ...payload,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });

  const previousUnitId = previous?.unitId;
  const previousRole = normalizeRoleType(previous?.roleType);
  const nextUnitId = payload.unitId ?? previousUnitId;
  const nextRole = normalizeRoleType(payload.roleType ?? previousRole);

  if (previousUnitId) {
    const removePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (shouldAttachToOwners(previousRole)) {
      removePayload.ownerIds = arrayRemove(id);
    }
    if (shouldAttachToResidents(previousRole)) {
      removePayload.residentIds = arrayRemove(id);
    }
    try {
      await updateDoc(doc(firestore, "units", previousUnitId), removePayload);
    } catch (unitUpdateError) {
      console.warn("[updatePerson] no se pudo desvincular de la unidad anterior", unitUpdateError);
    }
  }

  if (nextUnitId) {
    const addPayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (shouldAttachToOwners(nextRole)) {
      addPayload.ownerIds = arrayUnion(id);
    }
    if (shouldAttachToResidents(nextRole)) {
      addPayload.residentIds = arrayUnion(id);
    }
    try {
      await updateDoc(doc(firestore, "units", nextUnitId), addPayload);
    } catch (unitUpdateError) {
      console.warn("[updatePerson] no se pudo vincular a la unidad nueva", unitUpdateError);
    }
  }
}

export async function deletePerson(id: string) {
  const firestore = assertDb();
  const personRef = doc(firestore, "people", id);
  const personSnap = await getDoc(personRef);
  const person = personSnap.exists() ? (personSnap.data() as Partial<PersonItem>) : null;

  if (person?.unitId && person.roleType) {
    const roleType = normalizeRoleType(person.roleType);
    const removePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (shouldAttachToOwners(roleType)) {
      removePayload.ownerIds = arrayRemove(id);
    }
    if (shouldAttachToResidents(roleType)) {
      removePayload.residentIds = arrayRemove(id);
    }
    // Best-effort: si la unidad referenciada no existe (p. ej. registros antiguos
    // cuyo unitId era un slug), no bloquear la eliminación de la persona.
    try {
      await updateDoc(doc(firestore, "units", person.unitId), removePayload);
    } catch (unitUpdateError) {
      console.warn("[deletePerson] no se pudo desvincular de la unidad (continuo con el borrado)", unitUpdateError);
    }
  }

  await deleteDoc(doc(firestore, "people", id));
}

export function watchCommunications(tenantId: string, onData: (items: CommunicationItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  // Hotfix: avoid relying on composite index (tenantId + createdAt) for production consistency.
  return onSnapshot(
    query(collection(firestore, "communications"), where("tenantId", "==", tenantId)),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => mapDoc<CommunicationItem>(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => {
          const aTime = a.createdAt || a.updatedAt || "";
          const bTime = b.createdAt || b.updatedAt || "";
          return bTime.localeCompare(aTime);
        });
      onData(items);
    },
    (error) => onError(error.message),
  );
}

export async function listCommunicationsOnce(tenantId: string) {
  const firestore = assertDb();
  const snapshot = await getDocs(query(collection(firestore, "communications"), where("tenantId", "==", tenantId)));
  return snapshot.docs
    .map((item) => mapDoc<CommunicationItem>(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => {
      const aTime = a.createdAt || a.updatedAt || "";
      const bTime = b.createdAt || b.updatedAt || "";
      return bTime.localeCompare(aTime);
    });
}

export async function createCommunication(
  tenantId: string,
  userId: string,
  payload: Pick<CommunicationItem, "title" | "message" | "status" | "startsAt" | "endsAt" | "attachmentUrl" | "attachmentName">,
) {
  const firestore = assertDb();
  await addDoc(collection(firestore, "communications"), {
    ...payload,
    tenantId,
    createdBy: userId,
    publishedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCommunication(id: string, userId: string, payload: Partial<CommunicationItem>) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "communications", id), {
    ...payload,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunication(id: string) {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "communications", id));
}

export async function uploadCommunicationAttachment(input: { tenantId: string; file: File }) {
  const appStorage = assertStorage();
  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/communications/${Date.now()}-${cleanName}`;
  const storageRef = ref(appStorage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || "application/pdf" });
  const fileUrl = await getDownloadURL(storageRef);
  return { fileUrl, fileName: input.file.name, storagePath };
}

export function watchServices(tenantId: string, onData: (items: ServiceItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  return onSnapshot(
    query(collection(firestore, "services"), where("tenantId", "==", tenantId)),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => mapDoc<ServiceItem>(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => {
          const aTime = a.createdAt || a.updatedAt || "";
          const bTime = b.createdAt || b.updatedAt || "";
          return bTime.localeCompare(aTime);
        });
      onData(items);
    },
    (error) => onError(error.message),
  );
}

/** Resident-safe query — only returns active services (matches Firestore rule for 'resident' role). */
export function watchActiveServices(tenantId: string, onData: (items: ServiceItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  return onSnapshot(
    query(
      collection(firestore, "services"),
      where("tenantId", "==", tenantId),
      where("status", "==", "active"),
    ),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => mapDoc<ServiceItem>(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => {
          const aTime = a.createdAt || a.updatedAt || "";
          const bTime = b.createdAt || b.updatedAt || "";
          return bTime.localeCompare(aTime);
        });
      onData(items);
    },
    (error) => onError(error.message),
  );
}

export async function createService(
  tenantId: string,
  userId: string,
  payload: Pick<ServiceItem, "title" | "description" | "category" | "serviceType" | "providerName" | "providerContact" | "status"> &
    Partial<Pick<ServiceItem, "unitId" | "imageUrl" | "imagePath" | "attachmentUrl" | "attachmentName" | "attachmentPath">>,
) {
  const firestore = assertDb();
  // Strip undefined optional fields — Firestore rejects undefined values
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  await addDoc(collection(firestore, "services"), {
    ...clean,
    tenantId,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateService(id: string, userId: string, payload: Partial<ServiceItem>) {
  const firestore = assertDb();
  // Strip undefined optional fields — Firestore rejects undefined values
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  await updateDoc(doc(firestore, "services", id), {
    ...clean,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteService(id: string) {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "services", id));
}

export async function uploadServiceImage(input: { tenantId: string; serviceId: string; file: File }) {
  const appStorage = assertStorage();
  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/services/${input.serviceId}/cover-${cleanName}`;
  const storageRef = ref(appStorage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || "image/jpeg" });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, storagePath };
}

export async function uploadServiceAttachment(input: { tenantId: string; serviceId: string; file: File }) {
  const appStorage = assertStorage();
  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/services/${input.serviceId}/attachment-${cleanName}`;
  const storageRef = ref(appStorage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type || "application/octet-stream" });
  const attachmentUrl = await getDownloadURL(storageRef);
  return { attachmentUrl, attachmentName: input.file.name, storagePath };
}

export function watchReservations(tenantId: string, onData: (items: ReservationItem[]) => void, onError: (message: string) => void) {
  return subscribeTenant<ReservationItem>("reservations", tenantId, onData, onError, "date");
}

export async function createReservation(
  tenantId: string,
  userId: string,
  payload: Omit<ReservationItem, "id" | "tenantId" | "createdAt">,
) {
  const reservationDateTime = combineDateAndTime(payload.date, payload.startTime);
  if (!reservationDateTime) {
    throw new Error("Debes seleccionar una hora futura.");
  }

  if (!isDateTimeValid(reservationDateTime, "reservation")) {
    throw new Error("La reserva requiere al menos 30 minutos de anticipacion.");
  }

  const firestore = assertDb();
  await addDoc(collection(firestore, "reservations"), {
    ...payload,
    tenantId,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateReservation(id: string, userId: string, payload: Partial<ReservationItem>) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "reservations", id), {
    ...payload,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteReservation(id: string) {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "reservations", id));
}

export function watchAmenities(tenantId: string, onData: (items: AmenityItem[]) => void, onError: (message: string) => void) {
  return subscribeTenant<AmenityItem>("amenities", tenantId, onData, onError);
}

export function generateReservationSlots(start: string, end: string, durationMinutes: number): string[] {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startTotal = (startH ?? 0) * 60 + (startM ?? 0);
  const endTotal = (endH ?? 0) * 60 + (endM ?? 0);
  const slots: string[] = [];
  for (let t = startTotal; t + durationMinutes <= endTotal; t += durationMinutes) {
    const fromH = String(Math.floor(t / 60)).padStart(2, "0");
    const fromM = String(t % 60).padStart(2, "0");
    const toH = String(Math.floor((t + durationMinutes) / 60)).padStart(2, "0");
    const toM = String((t + durationMinutes) % 60).padStart(2, "0");
    slots.push(`${fromH}:${fromM} - ${toH}:${toM}`);
  }
  return slots;
}

export async function createAmenity(
  tenantId: string,
  userId: string,
  payload: Pick<AmenityItem, "name" | "category" | "status"> & Partial<Pick<AmenityItem,
    "operatingHoursStart" | "operatingHoursEnd" | "slotDurationMinutes" |
    "availableWeekdays" | "maxReservationsPerSlot" | "maxReservationDurationMinutes" |
    "maxReservationsPerUnitPerMonth" | "usageRules">>,
) {
  if (!tenantId?.trim()) {
    throw new Error("No se pudo identificar el tenant para crear la amenidad.");
  }

  const firestore = assertDb();
  const { operatingHoursStart, operatingHoursEnd, slotDurationMinutes, ...rest } = payload;
  const reservationSlots =
    operatingHoursStart && operatingHoursEnd && slotDurationMinutes
      ? generateReservationSlots(operatingHoursStart, operatingHoursEnd, slotDurationMinutes)
      : undefined;
  try {
    const docRef = await addDoc(collection(firestore, "amenities"), {
      ...rest,
      ...(operatingHoursStart !== undefined && { operatingHoursStart }),
      ...(operatingHoursEnd !== undefined && { operatingHoursEnd }),
      ...(slotDurationMinutes !== undefined && { slotDurationMinutes }),
      ...(reservationSlots !== undefined && { reservationSlots }),
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    throw new Error(toMutationUserError(error, "No fue posible crear la amenidad."));
  }
}

export async function updateAmenity(id: string, userId: string, payload: Partial<AmenityItem>) {
  const firestore = assertDb();
  try {
    const { operatingHoursStart, operatingHoursEnd, slotDurationMinutes, ...rest } = payload;
    const reservationSlots =
      operatingHoursStart && operatingHoursEnd && slotDurationMinutes
        ? generateReservationSlots(operatingHoursStart, operatingHoursEnd, slotDurationMinutes)
        : undefined;
    await updateDoc(doc(firestore, "amenities", id), {
      ...rest,
      ...(operatingHoursStart !== undefined && { operatingHoursStart }),
      ...(operatingHoursEnd !== undefined && { operatingHoursEnd }),
      ...(slotDurationMinutes !== undefined && { slotDurationMinutes }),
      reservationSlots: reservationSlots ?? deleteField(),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(toMutationUserError(error, "No fue posible actualizar la amenidad."));
  }
}

export async function deleteAmenity(id: string) {
  const firestore = assertDb();
  try {
    await deleteDoc(doc(firestore, "amenities", id));
  } catch (error) {
    throw new Error(toMutationUserError(error, "No fue posible eliminar la amenidad."));
  }
}

// ─── Helpers (private) ───────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

async function compressImageFile(file: File, maxWidth = 800, quality = 0.8): Promise<Blob> {
  if (typeof window === "undefined") return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => { resolve(blob ?? file); }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ─── Amenity photos ───────────────────────────────────────────────────────────

export async function uploadAmenityPhoto(
  tenantId: string,
  amenityId: string,
  file: File,
): Promise<AmenityPhoto> {
  const appStorage = assertStorage();
  const compressed = await compressImageFile(file);
  const cleanName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${tenantId}/amenity-photos/${amenityId}/${Date.now()}-${cleanName}`;
  const storageRef = ref(appStorage, storagePath);
  await uploadBytes(storageRef, compressed, { contentType: "image/jpeg" });
  const url = await getDownloadURL(storageRef);
  return { id: genId(), url, storagePath, order: 0 };
}

export async function deleteAmenityPhoto(
  amenityId: string,
  photo: AmenityPhoto,
  remainingPhotos: AmenityPhoto[],
): Promise<void> {
  const firestore = assertDb();
  const appStorage = assertStorage();
  try {
    await deleteObject(ref(appStorage, photo.storagePath));
  } catch {
    // If file was already deleted in Storage, continue to clean Firestore
  }
  const renumbered = remainingPhotos.map((p, i) => ({ ...p, order: i }));
  await updateDoc(doc(firestore, "amenities", amenityId), {
    photos: renumbered,
    updatedAt: serverTimestamp(),
  });
}

export async function reorderAmenityPhotos(
  amenityId: string,
  photos: AmenityPhoto[],
): Promise<void> {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "amenities", amenityId), {
    photos,
    updatedAt: serverTimestamp(),
  });
}

export async function disableAmenityAndCancelFutureReservations(input: {
  amenityName: string;
  amenityId: string;
  tenantId: string;
  userId: string;
}) {
  const firestore = assertDb();
  const today = new Date().toISOString().slice(0, 10);

  await updateAmenity(input.amenityId, input.userId, { status: "inactive" });

  const futureReservations = await getDocs(
    query(
      collection(firestore, "reservations"),
      where("tenantId", "==", input.tenantId),
      where("amenityName", "==", input.amenityName),
      where("date", ">=", today),
    ),
  );

  const batch = writeBatch(firestore);
  futureReservations.docs.forEach((reservationDoc) => {
    batch.update(reservationDoc.ref, {
      status: "cancelled",
      cancellationReason: "Amenidad deshabilitada por administración",
      updatedBy: input.userId,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  return { affectedReservations: futureReservations.size };
}

export function watchVisitors(tenantId: string, onData: (items: VisitorItem[]) => void, onError: (message: string) => void) {
  return subscribeTenant<VisitorItem>("visitorAuthorizations", tenantId, onData, onError);
}

export async function createVisitor(
  tenantId: string,
  userId: string,
  payload: Omit<VisitorItem, "id" | "tenantId" | "createdAt">,
) {
  const visitorDateTime = combineDateAndTime(payload.startDate, payload.startTime);
  if (!visitorDateTime) {
    throw new Error("Debes seleccionar una hora futura.");
  }

  if (!isDateTimeValid(visitorDateTime, "visitor")) {
    throw new Error("La visita debe registrarse con al menos 15 minutos de anticipacion.");
  }

  try {
    const firestore = assertDb();
    const createdAuthorization = await addDoc(collection(firestore, "visitorAuthorizations"), {
      ...payload,
      tenantId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const unitLabel = payload.unitId;
    const [towerValue, unitValue] = unitLabel.split("-");
    await addDoc(collection(firestore, "visitorPasses"), {
      tenantId,
      unitId: payload.unitId,
      unitLabel,
      visitorName: payload.visitorName,
      documentNumber: payload.visitorDocument,
      qrCodeValue: payload.qrCode,
      hostResidentName: payload.authorizedBy,
      tower: towerValue?.trim() || "-",
      unit: unitValue?.trim() || unitLabel,
      date: payload.startDate,
      scheduledTime: `${payload.startDate}T${payload.startTime}:00`,
      status: "scheduled",
      checkInAt: null,
      checkOutAt: null,
      sourceAuthorizationId: createdAuthorization.id,
      createdBy: userId,
      createdByName: payload.authorizedBy,
      residentName: payload.authorizedBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw new Error(toDateTimeMutationError(error, "No fue posible crear el visitante.", 15));
  }
}

export async function updateVisitor(id: string, userId: string, payload: Partial<VisitorItem>) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "visitorAuthorizations", id), {
    ...payload,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVisitor(id: string) {
  const firestore = assertDb();
  await deleteDoc(doc(firestore, "visitorAuthorizations", id));
}

export function watchDocuments(tenantId: string, onData: (items: DocumentItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();
  return onSnapshot(
    query(collection(firestore, "documents"), where("tenantId", "==", tenantId)),
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => mapDoc<DocumentItem>(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      onData(items);
    },
    (error) => {
      const firestoreError = error as FirestoreError;
      onError(toRealtimeUserError(firestoreError));
    },
  );
}

export async function uploadDocumentForTenant(input: {
  tenantId: string;
  userId: string;
  file: File;
  description: string;
}) {
  const firestore = assertDb();
  const appStorage = assertStorage();

  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/documents/${Date.now()}-${cleanName}`;
  const storageRef = ref(appStorage, storagePath);

  await uploadBytes(storageRef, input.file);
  const fileUrl = await getDownloadURL(storageRef);

  await addDoc(collection(firestore, "documents"), {
    tenantId: input.tenantId,
    fileName: input.file.name,
    description: input.description,
    fileUrl,
    storagePath,
    uploadedBy: input.userId,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocumentItem(input: { documentId: string; storagePath: string }) {
  const firestore = assertDb();
  const appStorage = assertStorage();

  await deleteDoc(doc(firestore, "documents", input.documentId));
  if (input.storagePath) {
    await deleteObject(ref(appStorage, input.storagePath));
  }
}

export function watchTenantSettings(
  tenantId: string,
  onData: (item: TenantSettingsItem | null) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();
  return onSnapshot(
    doc(firestore, "tenantSettings", tenantId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const data = snapshot.data() as Record<string, unknown>;
      const rawModules = typeof data.residentModules === "object" && data.residentModules
        ? (data.residentModules as Record<string, unknown>)
        : null;
      onData({
        tenantId,
        tenantName: typeof data.tenantName === "string" ? data.tenantName : "",
        tenantDisplayName: typeof data.tenantDisplayName === "string" ? data.tenantDisplayName : undefined,
        logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : undefined,
        logoPath: typeof data.logoPath === "string" ? data.logoPath : undefined,
        brandColor: typeof data.brandColor === "string" ? data.brandColor : "#0b3c5d",
        updatedAt: toIso(data.updatedAt),
        residentModules: rawModules
          ? {
              reservations: rawModules.reservations !== false,
              services: rawModules.services !== false,
              surveys: rawModules.surveys !== false,
              regulations: rawModules.regulations !== false,
            }
          : undefined,
        fiscalProfile:
          typeof data.fiscalProfile === "object" && data.fiscalProfile
            ? (() => {
                const fp = data.fiscalProfile as Record<string, unknown>;
                const country = fp.country;
                return {
                  taxId: typeof fp.taxId === "string" ? fp.taxId : undefined,
                  legalName: typeof fp.legalName === "string" ? fp.legalName : undefined,
                  address: typeof fp.address === "string" ? fp.address : undefined,
                  country:
                    country === "EC" || country === "CO" || country === "MX" ? country : undefined,
                  voucherSeriesPrefix:
                    typeof fp.voucherSeriesPrefix === "string" ? fp.voucherSeriesPrefix : undefined,
                  dataRetentionMonths:
                    typeof fp.dataRetentionMonths === "number" ? fp.dataRetentionMonths : undefined,
                };
              })()
            : undefined,
        adminProfile:
          typeof data.adminProfile === "object" && data.adminProfile
            ? {
                uid: String((data.adminProfile as Record<string, unknown>).uid ?? ""),
                fullName: String((data.adminProfile as Record<string, unknown>).fullName ?? ""),
                avatarId:
                  ((data.adminProfile as Record<string, unknown>).avatarId as
                    | "avatar-a"
                    | "avatar-b"
                    | "avatar-c"
                    | "avatar-d") ?? "avatar-a",
              }
            : undefined,
      });
    },
    (error) => onError(error.message),
  );
}

export async function uploadTenantLogo(input: { tenantId: string; file: File }) {
  const appStorage = assertStorage();
  const ext = input.file.name.split(".").pop()?.toLowerCase() ?? "png";
  const storagePath = `tenants/${input.tenantId}/branding/logo.${ext}`;
  const storageRef = ref(appStorage, storagePath);
  await uploadBytes(storageRef, input.file);
  const fileUrl = await getDownloadURL(storageRef);
  return { fileUrl, storagePath };
}

export function validateTenantLogoFile(file: File) {
  const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const maxBytes = 1_200_000;

  if (!allowedMimeTypes.includes(file.type)) {
    return "Formato invalido. Usa PNG, JPG, JPEG o WEBP.";
  }

  if (file.size > maxBytes) {
    return "El archivo supera 1.2MB. Elige un logo mas liviano.";
  }

  return null;
}

export async function deleteTenantLogoByPath(storagePath: string) {
  const appStorage = assertStorage();
  await deleteObject(ref(appStorage, storagePath));
}

export async function saveTenantSettings(
  tenantId: string,
  userId: string,
  payload: {
    tenantName: string;
    tenantDisplayName?: string;
    logoUrl?: string | null;
    logoPath?: string | null;
    brandColor: string;
  },
) {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, "tenantSettings", tenantId),
    {
      tenantId,
      ...payload,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveFiscalProfile(
  tenantId: string,
  userId: string,
  profile: FiscalProfile,
) {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, "tenantSettings", tenantId),
    {
      tenantId,
      fiscalProfile: {
        taxId: profile.taxId?.trim() || null,
        legalName: profile.legalName?.trim() || null,
        address: profile.address?.trim() || null,
        country: profile.country ?? null,
        voucherSeriesPrefix: profile.voucherSeriesPrefix?.trim() || null,
        dataRetentionMonths:
          typeof profile.dataRetentionMonths === "number" ? profile.dataRetentionMonths : null,
      },
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function seedTenantOperationalData(tenantId: string, userId: string) {
  const firestore = assertDb();
  const batch = writeBatch(firestore);

  const units = [
    { id: "u-t1-101", displayName: "T1-101", tower: "T1", type: "apartment" as const },
    { id: "u-t1-102", displayName: "T1-102", tower: "T1", type: "apartment" as const },
    { id: "u-t2-503", displayName: "T2-503", tower: "T2", type: "apartment" as const },
  ];

  for (const unit of units) {
    batch.set(
      doc(firestore, "units", unit.id),
      {
        tenantId,
        unitId: unit.id,
        displayName: unit.displayName,
        tower: unit.tower,
        type: unit.type,
        status: "active",
        ownerIds: [],
        residentIds: [],
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  const people = [
    {
      id: "p-owner-1",
      fullName: "Marta Velasquez",
      email: "marta.owner@demo.co",
      phone: "3001112233",
      roleType: "owner_occupant",
      occupancyType: "owner_occupant",
      unitId: "u-t1-101",
      tower: "T1",
    },
    {
      id: "p-resident-1",
      fullName: "Jorge Pardo",
      email: "jorge.resident@demo.co",
      phone: "3002223344",
      roleType: "other",
      occupancyType: "other",
      unitId: "u-t1-101",
      tower: "T1",
    },
    {
      id: "p-tenant-1",
      fullName: "Laura Melo",
      email: "laura.tenant@demo.co",
      phone: "3003334455",
      roleType: "tenant",
      occupancyType: "tenant",
      unitId: "u-t2-503",
      tower: "T2",
    },
  ] as const;

  for (const person of people) {
    batch.set(
      doc(firestore, "people", person.id),
      {
        tenantId,
        fullName: person.fullName,
        email: person.email,
        phone: person.phone,
        roleType: person.roleType,
        unitId: person.unitId,
        tower: person.tower,
        status: "active",
        createdBy: userId,
        updatedBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  batch.set(
    doc(firestore, "communications", "com-seed-1"),
    {
      tenantId,
      title: "Inspeccion de red hidraulica",
      message: "El viernes de 8:00 a.m. a 12:00 m. habra inspeccion en torres T1 y T2.",
      status: "published",
      createdBy: userId,
      publishedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(firestore, "reservations", "res-seed-1"),
    {
      tenantId,
      amenityName: "Salon social",
      unitId: "u-t1-101",
      reservedBy: "Jorge Pardo",
      date: "2026-03-25",
      startTime: "18:00",
      endTime: "21:00",
      status: "approved",
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(firestore, "visitorAuthorizations", "vis-seed-1"),
    {
      tenantId,
      visitorName: "Carlos Ortega",
      authorizationType: "puntual",
      visitorCategory: "familiar",
      unitId: "u-t1-101",
      authorizedBy: "Jorge Pardo",
      startDate: "2026-03-13",
      endDate: "2026-03-13",
      status: "active",
      notes: "Ingreso por porteria 1",
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(firestore, "documents", "doc-seed-1"),
    {
      tenantId,
      fileName: "Reglamento-Convivencia-2026.pdf",
      description: "Version actualizada aprobada en consejo de administración.",
      fileUrl: "https://example.com/reglamento-convivencia.pdf",
      storagePath: "",
      uploadedBy: userId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    doc(firestore, "tenantSettings", tenantId),
    {
      tenantId,
      tenantName: "Conjunto Residencial Santa Maria",
      tenantDisplayName: "Santa Maria",
      brandColor: "#0b3c5d",
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}
