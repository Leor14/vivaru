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
  setTenantAdminAccessCallable,
  updateTenantAdminCallable,
} from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
import { currencyForCountry } from "@/lib/currency";
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
  country?: string;
  status: TenantStatus;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  currency: "COP" | "MXN" | "USD";
  /** Ciclo de vida del trial (ver docs/plan-self-service-trial.md). */
  trialEndsAt?: string;
  leadId?: string;
  convertedAt?: string;
  /** Quién vendió este conjunto (REVOPS-001E). Id en `salesReps`. */
  vendedorId?: string;
  /** Administradora del conjunto (`PLAT-002` §7.2). Ausente = conjunto suelto. */
  managementCompanyId?: string;
  managementCompanyName?: string;
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
  /** `users.tenantId`: el conjunto espejo, «el último conocido». */
  tenantId: string;
  /** `PLAT-002` entrega 2: TODOS los conjuntos donde es admin, leídos de sus membresías. */
  tenantIds: string[];
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
          country: typeof data.country === "string" ? data.country : undefined,
          status: normalizeTenantStatus(data.status),
          onboardingStatus: normalizeOnboarding(data.onboardingStatus),
          currency: (data.currency === "COP" || data.currency === "MXN" || data.currency === "USD") ? data.currency : "COP",
          trialEndsAt: typeof data.trialEndsAt === "string" ? data.trialEndsAt : undefined,
          leadId: typeof data.leadId === "string" ? data.leadId : undefined,
          convertedAt: typeof data.convertedAt === "string" ? data.convertedAt : undefined,
          vendedorId: typeof data.vendedorId === "string" ? data.vendedorId : undefined,
          managementCompanyId: typeof data.managementCompanyId === "string" ? data.managementCompanyId : undefined,
          managementCompanyName: typeof data.managementCompanyName === "string" ? data.managementCompanyName : undefined,
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
  /** La moneda NO viaja: la deriva el servidor a partir de esto. */
  country: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
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
    country: string;
    status: TenantStatus;
    onboardingStatus: "not_started" | "in_progress" | "completed";
  },
) {
  const firestore = assertDb();
  const country = input.country.trim().toUpperCase();
  await updateDoc(doc(firestore, "tenants", tenantId), {
    ...input,
    country,
    // Derivada, nunca recibida: el par imposible (país México, moneda COP) deja
    // de ser representable.
    currency: currencyForCountry(country),
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
  /** Quién VENDIÓ (REVOPS-001E) — no quién ejecutó la conversión, que es
   *  `convertedBy`. La diferencia es la comisión de una persona concreta. */
  vendedorId?: string;
}) {
  const firestore = assertDb();
  await updateDoc(doc(firestore, "tenants", input.tenantId), {
    status: "active",
    planId: input.planId,
    trialEndsAt: deleteField(),
    convertedAt: new Date().toISOString(),
    convertedBy: input.convertedByUid,
    ...(input.vendedorId ? { vendedorId: input.vendedorId } : {}),
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

export interface ManagementCompanyItem {
  id: string;
  name: string;
  taxId: string | null;
  country: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: "active" | "inactive";
}

/**
 * Las administradoras. **Solo el superadmin puede leer esta colección**
 * (`PLAT-002` §7.1): lleva identificación fiscal y contacto de la empresa, y no
 * es para todo el que tenga sesión. Lo que ven los miembros del conjunto es el
 * NOMBRE, desnormalizado en `tenants.managementCompanyName`.
 *
 * Se ordena en memoria y no con `orderBy`: un `orderBy` DESCARTA en silencio
 * los documentos que no traen el campo, y ya costó una pantalla vacía con ocho
 * documentos dentro.
 */
export function watchManagementCompanies(
  onData: (items: ManagementCompanyItem[]) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();
  return onSnapshot(
    collection(firestore, "managementCompanies"),
    (snapshot) => {
      const items = snapshot.docs
        .map((docItem) => {
          const data = docItem.data() as Record<string, unknown>;
          return {
            id: docItem.id,
            name: typeof data.name === "string" ? data.name : docItem.id,
            taxId: typeof data.taxId === "string" ? data.taxId : null,
            country: typeof data.country === "string" ? data.country : "—",
            contactEmail: typeof data.contactEmail === "string" ? data.contactEmail : null,
            contactPhone: typeof data.contactPhone === "string" ? data.contactPhone : null,
            status: data.status === "inactive" ? ("inactive" as const) : ("active" as const),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es-CO"));
      onData(items);
    },
    (error) => onError(error.message),
  );
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

  // `PLAT-002` entrega 2: una persona puede administrar VARIOS conjuntos, así que la fila
  // lleva todos —leídos de las membresías, que son la autoridad— y el filtro busca por
  // membresía. Filtrar por `users.tenantId` escondía al admin en sus otros conjuntos.
  const constraints: QueryConstraint[] = [where("role", "==", "tenant_admin"), limit(250)];
  const [perfiles, membresias] = await Promise.all([
    getDocs(query(collection(firestore, "users"), ...constraints)),
    getDocs(query(collection(firestore, "tenantUsers"), where("role", "in", ["tenant_admin", "admin_tenant"]), limit(2000))),
  ]);

  const conjuntosDe = new Map<string, string[]>();
  for (const membresia of membresias.docs) {
    const data = membresia.data() as Record<string, unknown>;
    const uid = typeof data.uid === "string" ? data.uid : "";
    const conjunto = typeof data.tenantId === "string" ? data.tenantId : "";
    if (!uid || !conjunto) continue;
    conjuntosDe.set(uid, [...(conjuntosDe.get(uid) ?? []), conjunto]);
  }

  const items = perfiles.docs.map((docItem) => {
    const data = docItem.data() as Record<string, unknown>;
    return {
      uid: docItem.id,
      fullName: typeof data.fullName === "string" ? data.fullName : "Sin nombre",
      email: typeof data.email === "string" ? data.email : "",
      role: "tenant_admin",
      tenantId: typeof data.tenantId === "string" ? data.tenantId : "",
      tenantIds: conjuntosDe.get(docItem.id) ?? [],
      status: data.status === "inactive" ? "inactive" : "active",
      lastLoginAt: toIsoString(data.lastLoginAt) || undefined,
      updatedAt: toIsoString(data.updatedAt),
    } as AdminWorkspaceItem;
  });
  return tenantId ? items.filter((admin) => admin.tenantIds.includes(tenantId)) : items;
}

export async function createTenantAdminWorkspace(input: {
  tenantIds: string[];
  fullName: string;
  email: string;
  status: "active" | "inactive";
}) {
  // `tenantId` va también, con el primero: el servidor de antes solo conoce ése.
  return createTenantAdminCallable({ ...input, tenantId: input.tenantIds[0] ?? "" });
}

/** Nombre, correo y estado. **Ya no cambia de conjunto**: eso es `setTenantAdminAccessWorkspace`. */
export async function updateTenantAdminWorkspace(input: {
  uid: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
}) {
  return updateTenantAdminCallable(input);
}

export type CuentaPorCorreo = { uid: string; role: string; tenantId: string; fullName: string };

/**
 * `PLAT-002` entrega 2 · antes de crear, la consola mira si el correo ya tiene cuenta:
 * un admin recibe los conjuntos marcados, un residente pasa por el aviso, y portería o
 * superadmin se rechazan. Sin esto, crear con un correo existente era un rechazo seco.
 */
export async function buscarCuentaPorCorreo(email: string): Promise<CuentaPorCorreo | null> {
  const firestore = assertDb();
  const snap = await getDocs(query(collection(firestore, "users"), where("email", "==", email.trim().toLowerCase()), limit(1)));
  const docItem = snap.docs[0];
  if (!docItem) return null;
  const data = docItem.data() as Record<string, unknown>;
  return {
    uid: docItem.id,
    role: typeof data.role === "string" ? data.role : "",
    tenantId: typeof data.tenantId === "string" ? data.tenantId : "",
    fullName: typeof data.fullName === "string" ? data.fullName : "",
  };
}

/** Da y quita conjuntos de admin. Con `simular`, devuelve el plan y su aviso sin tocar nada. */
export async function setTenantAdminAccessWorkspace(input: Parameters<typeof setTenantAdminAccessCallable>[0]) {
  return setTenantAdminAccessCallable(input);
}

/**
 * Los conjuntos donde `uid` es admin HOY, leídos de sus membresías. Al crear con el correo
 * de un admin que ya existe, lo marcado se SUMA a esto: sacarlo de la lista de la pantalla
 * fallaría con un filtro puesto, y el plan le quitaría sus conjuntos sin que nadie lo pidiera.
 */
export async function conjuntosDeAdministrador(uid: string): Promise<string[]> {
  const firestore = assertDb();
  const snap = await getDocs(query(collection(firestore, "tenantUsers"), where("uid", "==", uid)));
  return snap.docs
    .map((docItem) => docItem.data() as Record<string, unknown>)
    .filter((m) => m.role === "tenant_admin" || m.role === "admin_tenant")
    .map((m) => (typeof m.tenantId === "string" ? m.tenantId : ""))
    .filter(Boolean);
}
