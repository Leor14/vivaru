import {
  Timestamp,
  collection,
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

function normalizeTenantStatus(value: unknown): "active" | "suspended" | "trial" {
  if (value === "active" || value === "suspended" || value === "trial") return value;
  return "trial";
}

export interface TenantWorkspaceItem {
  id: string;
  name: string;
  city: string;
  planId: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
  currency: "COP" | "MXN" | "USD";
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
    status: "active" | "suspended" | "trial";
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

export async function setTenantStatus(tenantId: string, status: "active" | "suspended" | "trial") {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", tenantId), {
    status,
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
