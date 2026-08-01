import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from "firebase/firestore";

import {
  createTenantAdminCallable,
  createTenantWorkspaceCallable,
  updateTenantAdminCallable,
} from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
import type { ModuleVariants } from "@/lib/config/module-variants";
import type { TenantStatus } from "@/types/domain";

function assertDb() {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }

  return db;
}

function toIsoString(value: unknown) {
  if (!value) return "";
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function normalizeOnboarding(value: unknown): "not_started" | "in_progress" | "completed" {
  if (value === "in_progress" || value === "completed") return value;
  return "not_started";
}

function normalizeTenantStatus(value: unknown): TenantStatus {
  if (value === "active" || value === "suspended" || value === "trial" || value === "expired") return value;
  return "trial";
}

export interface TenantWorkspaceItem {
  id: string;
  name: string;
  city: string;
  planId: string;
  status: TenantStatus;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  currency: "COP" | "MXN" | "USD";
  /** Ciclo de vida del trial (ver docs/plan-self-service-trial.md). */
  trialEndsAt?: string;
  leadId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanWorkspaceItem {
  id: string;
  name: string;
  description: string;
  maxUnits: number;
  maxNotificationsPerMonth: number;
  slaLabel: string;
  isActive: boolean;
  featuresEnabled: string[];
  updatedAt: string;
}

export interface AdminWorkspaceItem {
  uid: string;
  fullName: string;
  email: string;
  role: "tenant_admin";
  tenantId: string;
  status: "active" | "inactive";
  lastLoginAt?: string;
  updatedAt: string;
}

export function watchTenants(
  onData: (items: TenantWorkspaceItem[]) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();

  return onSnapshot(
    query(collection(firestore, "tenants"), orderBy("createdAt", "desc"), limit(150)),
    (snapshot) => {
      const items = snapshot.docs.map((docItem) => {
        const data = docItem.data() as Record<string, unknown>;
        return {
          id: docItem.id,
          name: typeof data.name === "string" ? data.name : "Tenant sin nombre",
          city: typeof data.city === "string" ? data.city : "-",
          planId: typeof data.planId === "string" ? data.planId : "starter",
          status: normalizeTenantStatus(data.status),
          onboardingStatus: normalizeOnboarding(data.onboardingStatus),
          currency: (data.currency === "COP" || data.currency === "MXN" || data.currency === "USD") ? data.currency : "COP",
          trialEndsAt: typeof data.trialEndsAt === "string" ? data.trialEndsAt : undefined,
          leadId: typeof data.leadId === "string" ? data.leadId : undefined,
          convertedAt: typeof data.convertedAt === "string" ? data.convertedAt : undefined,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        } as TenantWorkspaceItem;
      });

      onData(items);
    },
    (error) => onError(error.message),
  );
}

export async function createTenantWorkspace(input: {
  name: string;
  city: string;
  planId: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
  currency: "COP" | "MXN" | "USD";
  moduleVariants?: ModuleVariants;
}) {
  return createTenantWorkspaceCallable(input);
}

export async function updateTenantWorkspace(
  tenantId: string,
  input: {
    name: string;
    city: string;
    planId: string;
    status: TenantStatus;
    onboardingStatus: "not_started" | "in_progress" | "completed";
    currency: "COP" | "MXN" | "USD";
  },
) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", tenantId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function setTenantStatus(tenantId: string, status: TenantStatus) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", tenantId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Convierte un ambiente de prueba (o uno ya vencido) en cliente.
 *
 * Es la acción central de la consola: **no migra un solo documento.** Cambia el
 * estado, asigna el plan negociado y quita el vencimiento — todo lo que el
 * prospecto configuró se conserva tal cual. Por eso funciona igual para
 * rescatar un ambiente que ya venció.
 */
export async function convertTenantToCustomer(input: {
  tenantId: string;
  planId: string;
  convertedByUid: string;
}) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", input.tenantId), {
    status: "active",
    planId: input.planId,
    trialEndsAt: deleteField(),
    convertedAt: new Date().toISOString(),
    convertedBy: input.convertedByUid,
    // Al convertir cambia la misión, y con ella el recorrido: quien ya probó
    // el producto ahora tiene que invitar a su comunidad y emitir el primer
    // cobro. Los pasos compartidos se conservan hechos, así que no arranca de
    // cero — pasa de "7 de 7" a algo como "7 de 10", que invita a seguir.
    onboardingTrack: "cliente",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Marca un ambiente de prueba como perdido, con motivo. Alimenta el aprendizaje
 * comercial: sin el motivo no se sabe POR QUÉ se pierden los trials.
 */
export async function markTrialAsLost(input: { tenantId: string; leadId?: string; motivo: string }) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", input.tenantId), {
    lostAt: new Date().toISOString(),
    lostReason: input.motivo,
    updatedAt: serverTimestamp(),
  });
  if (input.leadId) {
    await updateDoc(doc(firestore, "leads", input.leadId), {
      status: "perdido",
      lostReason: input.motivo,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }
}

/** Extiende la prueba N días desde hoy (negociaciones en curso). */
export async function extendTrial(tenantId: string, days: number) {
  const firestore = assertDb();
  const next = new Date();
  next.setDate(next.getDate() + days);
  await updateDoc(doc(firestore, "tenants", tenantId), {
    status: "trial",
    trialEndsAt: next.toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export function watchPlans(onData: (items: PlanWorkspaceItem[]) => void, onError: (message: string) => void) {
  const firestore = assertDb();

  return onSnapshot(
    query(collection(firestore, "plans"), orderBy("name", "asc")),
    (snapshot) => {
      const items = snapshot.docs.map((docItem) => {
        const data = docItem.data() as Record<string, unknown>;
        return {
          id: docItem.id,
          name: typeof data.name === "string" ? data.name : docItem.id,
          description: typeof data.description === "string" ? data.description : "Sin descripcion",
          maxUnits: typeof data.maxUnits === "number" ? data.maxUnits : 0,
          maxNotificationsPerMonth: typeof data.maxNotificationsPerMonth === "number" ? data.maxNotificationsPerMonth : 0,
          slaLabel: typeof data.slaLabel === "string" ? data.slaLabel : "-",
          isActive: Boolean(data.isActive ?? true),
          featuresEnabled: Array.isArray(data.featuresEnabled) ? data.featuresEnabled.map((item) => String(item)) : [],
          updatedAt: toIsoString(data.updatedAt),
        } as PlanWorkspaceItem;
      });
      onData(items);
    },
    (error) => onError(error.message),
  );
}

export async function createPlanWorkspace(input: {
  id: string;
  name: string;
  description: string;
  maxUnits: number;
  maxNotificationsPerMonth: number;
  slaLabel: string;
  isActive: boolean;
  featuresEnabled: string[];
}) {
  const firestore = assertDb();

  await setDoc(doc(firestore, "plans", input.id), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePlanWorkspace(
  planId: string,
  input: {
    name: string;
    description: string;
    maxUnits: number;
    maxNotificationsPerMonth: number;
    slaLabel: string;
    isActive: boolean;
    featuresEnabled: string[];
  },
) {
  const firestore = assertDb();

  await updateDoc(doc(firestore, "plans", planId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function listTenantAdmins(tenantId?: string) {
  const firestore = assertDb();

  const constraints: QueryConstraint[] = [where("role", "==", "tenant_admin"), limit(250)];
  if (tenantId) {
    constraints.push(where("tenantId", "==", tenantId));
  }

  const snapshot = await getDocs(query(collection(firestore, "users"), ...constraints));
  return snapshot.docs.map((docItem) => {
    const data = docItem.data() as Record<string, unknown>;
    return {
      uid: docItem.id,
      fullName: typeof data.fullName === "string" ? data.fullName : "Sin nombre",
      email: typeof data.email === "string" ? data.email : "",
      role: "tenant_admin",
      tenantId: typeof data.tenantId === "string" ? data.tenantId : "",
      status: data.status === "inactive" ? "inactive" : "active",
      lastLoginAt: toIsoString(data.lastLoginAt) || undefined,
      updatedAt: toIsoString(data.updatedAt),
    } as AdminWorkspaceItem;
  });
}

export async function createTenantAdminWorkspace(input: {
  tenantId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
}) {
  return createTenantAdminCallable(input);
}

export async function updateTenantAdminWorkspace(input: {
  uid: string;
  tenantId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
}) {
  return updateTenantAdminCallable(input);
}
