import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { combineDateAndTime, isDateTimeValid } from "./utils/datetimeValidation";
import { anonymizeExpiredVouchers, purgeExpiredAiFeedback, purgeExpiredAiUsage } from "./data-retention";
import { currencyForCountry } from "./country-currency";
import { assertStrongPassword, generateStrongPassword } from "./password-policy";
import { resendApiKey, sendAccountEmail, sendNotificationEmail, type AccountEmailVariant } from "./email";
import {
  addSupportInternalNote,
  closeSupportTicket,
  createSupportTicket as createSupportTicketImpl,
  reopenSupportTicket,
  replySupportTicket,
  updateSupportTicket as updateSupportTicketImpl,
} from "./support";
import {
  cruzarAnticipo,
  deshacerCruce,
  type CruzarAnticipoInput,
  type DeshacerCruceInput,
} from "./advances";
import {
  aplicarPago,
  esRecaudoDeCartera,
  revertirPago,
  type AplicarPagoInput,
  type RevertirPagoInput,
} from "./payments";
import {
  revocarAccesoDeResidente,
  type RevocarAccesoInput,
} from "./resident-access";
import { crearReserva, type CrearReservaInput } from "./reservations";
import { generarCorridaPorCoeficiente, type GenerarCorridaInput } from "./coefficient-billing";
import { runTrialLifecycle } from "./trial-lifecycle";
import { assertCanInviteRealPeople, assertModuleAllowed } from "./trial-modules";
import { cuentaParaConcepto } from "./plan-de-cuentas";
import { sembrarPlanDeCuentas } from "./plan-de-cuentas-siembra";
import { provisionTrialWorkspace, type CreateTrialInput } from "./trial-workspace";
import {
  resolveNotificationCopy,
  type NotificationKey,
  type NotificationOverride,
  type NotificationType,
} from "./notification-catalog";
import { callableCorsOrigins } from "./http-config";
import { getAiUsageSummary, inicioDelMes } from "./ai/usage-report";
import { clasificarTicketEnSombra, registrarDecisionEnSombra } from "./ai/sombra-pqrs";

initializeApp();

const db = getFirestore();


// NotificationType vive en ./notification-catalog (fuente única).

type NotificationInput = {
  userId: string;
  tenantId?: string;
  type: NotificationType;
  title: string;
  description: string;
  link?: string;
};

type CreateTenantInput = {
  name: string;
  city: string;
  planId: "starter" | "plus" | "premium";
  adminEmail: string;
  adminPassword: string;
  adminFullName: string;
};

type ModuleVariants = {
  visitors: "qr_full" | "registro_simple";
  packages: "con_evidencia" | "aviso_simple";
  pqrs: "con_sla" | "buzon_simple";
  communications: "canal_oficial" | "tablon_simple";
  finance: "completa" | "solo_consulta";
  governance: "formal" | "informativo";
};

// Defaults = comportamiento actual. Si el alta no envia variantes (o faltan claves), se aplican
// estos, de modo que los conjuntos quedan en el modo vigente sin requerir migracion.
const DEFAULT_MODULE_VARIANTS: ModuleVariants = {
  visitors: "qr_full",
  packages: "con_evidencia",
  pqrs: "con_sla",
  communications: "canal_oficial",
  finance: "completa",
  governance: "formal",
};

const MODULE_VARIANT_VALUES: Record<keyof ModuleVariants, readonly string[]> = {
  visitors: ["qr_full", "registro_simple"],
  packages: ["con_evidencia", "aviso_simple"],
  pqrs: ["con_sla", "buzon_simple"],
  communications: ["canal_oficial", "tablon_simple"],
  finance: ["completa", "solo_consulta"],
  governance: ["formal", "informativo"],
};

function normalizeModuleVariants(input: unknown): ModuleVariants {
  const raw = (input ?? {}) as Record<string, unknown>;
  const result = { ...DEFAULT_MODULE_VARIANTS };
  for (const key of Object.keys(MODULE_VARIANT_VALUES) as Array<keyof ModuleVariants>) {
    const value = raw[key];
    if (typeof value === "string" && MODULE_VARIANT_VALUES[key].includes(value)) {
      (result[key] as string) = value;
    }
  }
  return result;
}

// Lee la variante de Visitas del conjunto aplicando el default si falta.
async function getTenantVisitorsVariant(tenantId: string): Promise<ModuleVariants["visitors"]> {
  const snap = await db.collection("tenantSettings").doc(tenantId).get();
  const mv = (snap.data()?.moduleVariants ?? {}) as Partial<ModuleVariants>;
  const value = mv.visitors;
  return value === "registro_simple" || value === "qr_full" ? value : DEFAULT_MODULE_VARIANTS.visitors;
}

// Lee la variante de Finanzas del conjunto aplicando el default si falta.
async function getTenantFinanceVariant(tenantId: string): Promise<ModuleVariants["finance"]> {
  const snap = await db.collection("tenantSettings").doc(tenantId).get();
  const mv = (snap.data()?.moduleVariants ?? {}) as Partial<ModuleVariants>;
  const value = mv.finance;
  return value === "solo_consulta" || value === "completa" ? value : DEFAULT_MODULE_VARIANTS.finance;
}

// En modo solo_consulta no se gestionan cobros: las acciones de cartera quedan deshabilitadas.
async function assertFinanceManagementEnabled(tenantId: string) {
  if ((await getTenantFinanceVariant(tenantId)) === "solo_consulta") {
    throw new HttpsError(
      "failed-precondition",
      "La gestión de cobros está deshabilitada: este conjunto opera en modo solo consulta.",
    );
  }
}

type CreateTenantWorkspaceInput = {
  name: string;
  city: string;
  planId: string;
  /** País del conjunto. Gobierna la moneda y la tarifa; ver `country-currency.ts`. */
  country?: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
  moduleVariants?: Partial<ModuleVariants>;
};

type CreateTenantAdminInput = {
  tenantId: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  status: "active" | "inactive";
};

type UpdateTenantAdminInput = {
  uid: string;
  tenantId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
};

type CreateTenantOperationalUserInput = {
  tenantId: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: "tenant_admin" | "security_guard";
  status: "active" | "inactive";
};

type CreateVisitorPassInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  qrCodeValue: string;
  date: string;
  scheduledTime: string;
  hostResidentName?: string;
  tower?: string;
  unit?: string;
};

type RegisterWalkInVisitInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  hostResidentName?: string;
  // Fecha/hora local del cliente (la porteria). Si faltan, la funcion usa el reloj del servidor.
  date?: string;
  scheduledTime?: string;
};

type ConfirmPackageReceiptInput = {
  tenantId: string;
  packageId: string;
};

type ProvisionResidentTemporaryAccessInput = {
  tenantId: string;
  personId: string;
};

type CompleteResidentPasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

type DemoUserSeed = {
  email: string;
  password: string;
  displayName: string;
  role: "superadmin" | "tenant_admin" | "resident" | "security_guard";
  tenantId?: string;
  unitId?: string;
  unitLabel?: string;
};

function assertSuperadmin(auth: { token?: Record<string, unknown> } | undefined) {
  if (!auth || auth.token?.role !== "superadmin") {
    throw new HttpsError("permission-denied", "Solo superadmin puede ejecutar esta operacion.");
  }
}

async function assertTenantMember(tenantId: string, uid: string) {
  const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${uid}`);
  const membershipSnap = await membershipRef.get();
  if (!membershipSnap.exists) {
    throw new HttpsError("permission-denied", "El usuario no pertenece al tenant.");
  }

  return membershipSnap.data() as { role?: string; unitId?: string; fullName?: string };
}

/**
 * Estados de tenant que permiten ESCRITURA. `suspended` (cliente que dejó de
 * pagar) y `expired` (prueba vencida) quedan en solo lectura: conservan sus
 * datos y pueden consultarlos, pero no operar.
 *
 * Hasta ahora `tenants.status` era decorativo — se mostraba y filtraba en el
 * superadmin pero no bloqueaba nada, así que el botón "suspender" no tenía
 * ningún efecto real. El superadmin nunca queda bloqueado: necesita operar
 * sobre un tenant suspendido para reactivarlo o convertirlo.
 */
const WRITABLE_TENANT_STATUSES = ["active", "trial"];

async function assertTenantOperable(tenantId: string) {
  const snap = await db.collection("tenants").doc(tenantId).get();
  if (!snap.exists) return;

  const status = (snap.data() as { status?: string } | undefined)?.status;
  // Sin status explícito se asume operable (compatibilidad con datos antiguos).
  if (!status || WRITABLE_TENANT_STATUSES.includes(status)) return;

  const reason =
    status === "expired"
      ? "El período de prueba de este conjunto terminó. Contacta a un asesor de Vivaru para reactivarlo."
      : "Este conjunto está suspendido. Contacta a un asesor de Vivaru para reactivarlo.";
  throw new HttpsError("failed-precondition", reason);
}

async function assertTenantAdminOrSuper(input: { tenantId: string; uid?: string; role?: unknown }) {
  if (input.role === "superadmin") {
    return;
  }

  if (!input.uid) {
    throw new HttpsError("unauthenticated", "Debes autenticarte para ejecutar esta accion.");
  }

  const membership = await assertTenantMember(input.tenantId, input.uid);
  if (membership.role !== "tenant_admin") {
    throw new HttpsError("permission-denied", "No tienes permisos para gestionar credenciales de residentes.");
  }

  await assertTenantOperable(input.tenantId);
}

/**
 * La autoridad sobre qué conjunto puede operar un admin es SIEMPRE el
 * documento de membresía (`tenantUsers/{tenantId}_{uid}`), nunca
 * `users/{uid}.tenantId`. Ese campo es de un solo valor por diseño — "el
 * último conjunto conocido" — y antes del 21 de agosto de 2026 esta función
 * además EXIGÍA que coincidiera con el tenant pedido, lo que hacía imposible
 * que un mismo admin operara más de un conjunto aunque tuviera membresía
 * válida en ambos. PRD-V-PLAT-002 §11.2 lo llama el bloqueo real: las doce
 * comparaciones de `request.auth.token.tenantId` alrededor de este
 * llamador eran redundantes (solo actuaban si el claim estaba presente Y
 * discrepaba) y se retiraron en el mismo cambio — dejarlas habría vuelto a
 * bloquear en cuanto existiera una segunda membresía.
 *
 * Para un admin de una sola membresía esto no cambia nada: hoy nunca pide
 * un `tenantId` distinto del suyo, así que la condición retirada nunca lo
 * afectaba. El cambio es inerte hasta que exista una segunda membresía.
 */
async function assertActiveTenantAdmin(tenantId: string, uid: string) {
  const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${uid}`);
  const membershipSnap = await membershipRef.get();

  if (!membershipSnap.exists) {
    throw new HttpsError("permission-denied", "No perteneces al tenant indicado.");
  }

  const membership = membershipSnap.data() as { role?: string; status?: string; tenantId?: string };
  if (membership.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "No puedes operar sobre otro tenant.");
  }

  if (membership.role !== "tenant_admin") {
    throw new HttpsError("permission-denied", "No tienes permisos para crear usuarios operativos.");
  }

  if ((membership.status ?? "active") !== "active") {
    throw new HttpsError("failed-precondition", "Tu usuario admin se encuentra inactivo.");
  }

  const profileSnap = await db.collection("users").doc(uid).get();
  if (!profileSnap.exists) {
    throw new HttpsError("failed-precondition", "No fue posible validar tu perfil de administrador.");
  }

  // Gate de cuenta, no de tenant: confirma que el perfil sigue siendo un
  // admin activo. A qué conjunto pertenece ya lo decidió `membership` arriba.
  const profile = profileSnap.data() as { status?: string; role?: string; tenantId?: string };
  if (profile.role !== "tenant_admin") {
    throw new HttpsError("permission-denied", "No tienes permisos para crear usuarios operativos.");
  }

  if ((profile.status ?? "active") !== "active") {
    throw new HttpsError("failed-precondition", "Tu perfil administrador se encuentra inactivo.");
  }

  await assertTenantOperable(tenantId);

  return { tenantId };
}

async function writeAuditLog(tenantId: string, actorUid: string | undefined, action: string, metadata: Record<string, unknown>) {
  await db.collection("auditLogs").add({
    tenantId,
    actorUid: actorUid ?? "unknown",
    action,
    metadata,
    createdAt: Timestamp.now(),
  });
}

// A5: genera el enlace seguro de Firebase y lo envía por Resend (marca Vivaru).
// Best-effort: nunca rompe la creación del usuario; si falla, queda en logs y el
// usuario siempre puede usar "¿Olvidaste tu contraseña?" (reset nativo).
async function sendPasswordSetupEmail(email: string, fullName: string, variant: AccountEmailVariant = "welcome") {
  try {
    const link = await getAuth().generatePasswordResetLink(email);
    await sendAccountEmail({ to: email, fullName, link, variant });
  } catch (error) {
    console.warn("[email] no se pudo enviar el correo de acceso", { email, variant, error });
  }
}

// Onboarding robusto (Opción B): invitación con token PROPIO, no los oobCode de
// Firebase (que un escáner de correo puede consumir y que expiran en 1h fija).
// El enlace abre /activar?token=… (GET no consume el token); recién al enviar la
// contraseña se valida y se marca usado. TTL configurable.
const INVITE_TTL_DAYS = 7;

async function sendOnboardingInvite(
  uid: string,
  email: string,
  fullName: string,
  tenantId: string,
  role: string,
  variant: AccountEmailVariant = "welcome",
) {
  try {
    const token = randomUUID();
    const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    await db.collection("accountInvites").doc(token).set({
      uid,
      email: email.toLowerCase(),
      fullName,
      tenantId,
      role,
      usedAt: null,
      createdAt: Timestamp.now(),
      expiresAt,
    });
    await sendAccountEmail({ to: email, fullName, link: `/activar?token=${token}`, variant });
  } catch (error) {
    console.warn("[invite] no se pudo crear/enviar la invitacion de acceso", { email, error });
  }
}

async function listTenantUidsByRoles(tenantId: string, roles: string[]) {
  if (!roles.length) return [] as string[];

  const snapshot = await db
    .collection("tenantUsers")
    .where("tenantId", "==", tenantId)
    .where("role", "in", roles)
    .get();

  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as { uid?: string; status?: string };
      if (data.status && data.status !== "active") return null;
      return data.uid ?? null;
    })
    .filter((uid): uid is string => Boolean(uid));
}

async function listResidentUidsByUnit(tenantId: string, unitId: string) {
  const snapshot = await db
    .collection("tenantUsers")
    .where("tenantId", "==", tenantId)
    .where("role", "==", "resident")
    .where("unitId", "==", unitId)
    .get();

  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as { uid?: string; status?: string };
      if (data.status && data.status !== "active") return null;
      return data.uid ?? null;
    })
    .filter((uid): uid is string => Boolean(uid));
}

async function listSuperadminUids() {
  const snapshot = await db.collection("users").where("role", "==", "superadmin").get();
  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as { uid?: string; status?: string };
      if (data.status && data.status !== "active") return null;
      return data.uid ?? entry.id;
    })
    .filter((uid): uid is string => Boolean(uid));
}

async function createNotifications(inputs: NotificationInput[]) {
  if (inputs.length === 0) return;

  const batch = db.batch();
  const seen = new Set<string>();

  for (const item of inputs) {
    const userId = item.userId?.trim();
    if (!userId) continue;

    const uniqueKey = `${userId}::${item.tenantId ?? "global"}::${item.type}::${item.title}::${item.description}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);

    const ref = db.collection("notifications").doc();
    batch.set(ref, {
      userId,
      tenantId: item.tenantId ?? null,
      type: item.type,
      title: item.title,
      description: item.description,
      read: false,
      createdAt: Timestamp.now(),
      link: item.link ?? null,
    });
  }

  await batch.commit();
}

// ── Resolución de copy de notificaciones (overrides por tenant) ───────────────

/** Lee el override de una notificación del tenant (tenantSettings.notificationTemplates). */
async function getTenantNotificationOverride(
  tenantId: string,
  key: NotificationKey,
): Promise<NotificationOverride | undefined> {
  const snap = await db.collection("tenantSettings").doc(tenantId).get();
  const templates = snap.exists
    ? (snap.data()?.notificationTemplates as Record<string, NotificationOverride> | undefined)
    : undefined;
  return templates?.[key];
}

/** Nombre del conjunto (variable {conjunto}). */
async function getTenantName(tenantId: string): Promise<string> {
  const snap = await db.collection("tenants").doc(tenantId).get();
  return (snap.exists ? (snap.data()?.name as string | undefined) : undefined) ?? "";
}

/** Formatea un monto entero con separadores es-CO, con prefijo "$". */
function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

/** "2026-06-20" → "junio 2026" (variable {período} de recibos). */
function formatPeriodFromDate(value: string | undefined): string {
  if (!value) return "";
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const label = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Correos (activos) de una lista de uids de residentes. Chunked por el límite de "in". */
async function getResidentEmails(uids: string[]): Promise<string[]> {
  const emails: string[] = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const snap = await db.collection("users").where("uid", "in", chunk).get();
    snap.forEach((d) => {
      const u = d.data() as { email?: string; status?: string };
      if (u.email && (!u.status || u.status === "active")) emails.push(u.email);
    });
  }
  return emails;
}

/**
 * Entrega una notificación a una lista de residentes: in-app siempre y, si el
 * tenant activó el correo para esa notificación, también por email (best-effort,
 * el fallo de correo nunca rompe la notificación in-app).
 */
async function deliverResidentNotifications(
  key: NotificationKey,
  tenantId: string,
  residentUids: string[],
  vars: Record<string, string>,
  override: NotificationOverride | undefined,
): Promise<void> {
  if (residentUids.length === 0) return;
  const copy = resolveNotificationCopy(key, override, vars);

  await createNotifications(
    residentUids.map((uid) => ({
      userId: uid,
      tenantId,
      type: copy.type,
      title: copy.title,
      description: copy.body,
      link: copy.link,
    })),
  );

  if (!copy.emailEnabled) return;
  const emails = await getResidentEmails(residentUids);
  for (const to of emails) {
    try {
      await sendNotificationEmail({ to, subject: copy.emailSubject, body: copy.emailBody, link: copy.link });
    } catch (e) {
      console.error(`[notif-email][${key}]`, e);
    }
  }
}

function isTodayDateString(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return normalized === `${yyyy}-${mm}-${dd}`;
}

async function upsertAuthUser(seed: DemoUserSeed) {
  const authApi = getAuth();
  let userRecord;

  try {
    userRecord = await authApi.getUserByEmail(seed.email);
    userRecord = await authApi.updateUser(userRecord.uid, {
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch {
    userRecord = await authApi.createUser({
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await authApi.setCustomUserClaims(userRecord.uid, {
    role: seed.role,
    tenantId: seed.tenantId,
  });

  return userRecord;
}

function assertAdminStatus(value: string) {
  if (value !== "active" && value !== "inactive") {
    throw new HttpsError("invalid-argument", "Estado de admin invalido.");
  }
}

function assertOperationalRole(value: string) {
  if (value !== "tenant_admin" && value !== "security_guard") {
    throw new HttpsError("invalid-argument", "Rol operativo invalido.");
  }
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function assertTemporaryPasswordPolicy(input: { currentPassword: string; newPassword: string; documentNumber: string }) {
  const currentPassword = normalizeText(input.currentPassword);
  const newPassword = normalizeText(input.newPassword);
  const documentNumber = normalizeText(input.documentNumber);

  if (!currentPassword || !newPassword) {
    throw new HttpsError("invalid-argument", "Debes ingresar la clave temporal y la nueva contrasena.");
  }

  if (!documentNumber) {
    throw new HttpsError("failed-precondition", "No fue posible validar el documento de la cuenta.");
  }

  if (currentPassword !== documentNumber) {
    throw new HttpsError("invalid-argument", "La clave temporal actual no coincide con tu documento.");
  }

  if (newPassword.length < 8) {
    throw new HttpsError("invalid-argument", "La nueva contrasena debe tener al menos 8 caracteres.");
  }

  if (newPassword === documentNumber) {
    throw new HttpsError("invalid-argument", "La nueva contrasena no puede ser igual al documento.");
  }
}

async function upsertResidentTemporaryAccess(input: {
  tenantId: string;
  personId: string;
  actorUid?: string;
}) {
  const tenantId = normalizeText(input.tenantId);
  const personId = normalizeText(input.personId);

  if (!tenantId || !personId) {
    throw new HttpsError("invalid-argument", "Debes indicar tenant y residente para restablecer el acceso.");
  }

  const personRef = db.collection("people").doc(personId);
  const personSnap = await personRef.get();
  if (!personSnap.exists) {
    throw new HttpsError("not-found", "El residente no existe.");
  }

  const personData = personSnap.data() as Record<string, unknown>;
  const personTenantId = normalizeText(personData.tenantId);
  if (personTenantId !== tenantId) {
    throw new HttpsError("permission-denied", "El residente no pertenece al tenant indicado.");
  }

  const email = normalizeEmail(personData.email);
  const fullName = normalizeText(personData.fullName) || "Residente Vivaru";
  const documentNumber = normalizeText(personData.documentNumber);
  const status = normalizeText(personData.status) === "inactive" ? "inactive" : "active";
  const unitId = normalizeText(personData.unitId);
  const tower = normalizeText(personData.tower);

  if (!email) {
    throw new HttpsError("failed-precondition", "El residente no tiene correo registrado.");
  }

  // documentNumber (cedula) ya no es credencial (onboarding por enlace); deja de ser
  // obligatorio para activar acceso. Sigue requiriendose para la capa fiscal EC (SRI),
  // que lo valida al emitir el comprobante, no aqui.

  if (!unitId) {
    throw new HttpsError("failed-precondition", "El residente no tiene unidad asociada.");
  }

  // Etiqueta legible de la unidad: usa el displayName del doc de unidad (unitId = doc id).
  // El fallback NUNCA debe incrustar el docId (antes era `${tower}-${unitId}`, que se
  // denormalizaba a reservas/paquetería/notificaciones como "torre1-<idFirestore>").
  // Si no hay displayName, se usa la torre legible o "Unidad" — jamás un ID crudo.
  let unitLabel = tower || "Unidad";
  try {
    const unitSnap = await db.collection("units").doc(unitId).get();
    const displayName = unitSnap.exists ? normalizeText((unitSnap.data() as Record<string, unknown>).displayName) : "";
    if (displayName) unitLabel = displayName;
  } catch {
    /* usa el fallback legible */
  }

  const authApi = getAuth();
  const existingUser = await authApi
    .getUserByEmail(email)
    .then((user) => user)
    .catch((error: unknown) => {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? String((error as { code: string }).code)
          : "";
      if (code === "auth/user-not-found") return null;
      throw error;
    });

  // Onboarding por enlace: la cuenta nace con una clave aleatoria que nadie conoce.
  // El residente define su contrasena via el correo de restablecimiento (sendPasswordResetEmail),
  // por lo que la cedula deja de funcionar como credencial.
  const randomPassword = generateStrongPassword();

  const userRecord = existingUser
    ? await authApi.updateUser(existingUser.uid, {
        email,
        displayName: fullName,
        password: randomPassword,
        disabled: status !== "active",
      })
    : await authApi.createUser({
        email,
        displayName: fullName,
        password: randomPassword,
        emailVerified: true,
        disabled: status !== "active",
      });

  await authApi.setCustomUserClaims(userRecord.uid, {
    role: "resident",
    tenantId,
  });

  const now = Timestamp.now();
  const batch = db.batch();

  batch.set(
    db.collection("users").doc(userRecord.uid),
    {
      uid: userRecord.uid,
      email,
      fullName,
      role: "resident",
      tenantId,
      unitId,
      unitLabel,
      documentNumber,
      status,
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
      temporaryPasswordUpdatedAt: now,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  batch.set(
    db.collection("tenantUsers").doc(`${tenantId}_${userRecord.uid}`),
    {
      uid: userRecord.uid,
      tenantId,
      fullName,
      email,
      role: "resident",
      status,
      unitId,
      unitLabel,
      mustChangePassword: false,
      passwordStatus: "updated",
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  batch.set(
    personRef,
    {
      authUid: userRecord.uid,
      updatedAt: now,
    },
    { merge: true },
  );

  await batch.commit();

  await writeAuditLog(tenantId, input.actorUid, "provision_resident_temporary_access", {
    personId,
    residentUid: userRecord.uid,
    email,
  });

  return {
    uid: userRecord.uid,
    email,
    fullName,
    isNewUser: !existingUser,
  };
}

function normalizeCreateTenantAdminPayload(data: CreateTenantAdminInput) {
  const tenantId = normalizeText(data.tenantId);
  const fullName = normalizeText(data.fullName);
  const email = normalizeEmail(data.email);
  const providedPassword = normalizeText(data.temporaryPassword);
  const status = data.status;

  if (!tenantId || !fullName || !email || !status) {
    throw new HttpsError("invalid-argument", "Datos incompletos para crear admin.");
  }

  // Onboarding por enlace: si no se teclea contrasena, se genera una aleatoria que
  // nadie conoce; el usuario definira la suya via correo de restablecimiento.
  if (providedPassword) {
    assertStrongPassword(providedPassword, "contrasena temporal");
  }
  const temporaryPassword = providedPassword || generateStrongPassword();

  assertAdminStatus(status);

  return {
    tenantId,
    fullName,
    email,
    temporaryPassword,
    status,
  };
}

function normalizeUpdateTenantAdminPayload(data: UpdateTenantAdminInput) {
  const uid = normalizeText(data.uid);
  const tenantId = normalizeText(data.tenantId);
  const fullName = normalizeText(data.fullName);
  const email = normalizeEmail(data.email);
  const status = data.status;

  if (!uid || !tenantId || !fullName || !email || !status) {
    throw new HttpsError("invalid-argument", "Datos incompletos para actualizar admin.");
  }

  assertAdminStatus(status);

  return {
    uid,
    tenantId,
    fullName,
    email,
    status,
  };
}

function normalizeCreateTenantOperationalUserPayload(data: CreateTenantOperationalUserInput) {
  const tenantId = normalizeText(data.tenantId);
  const fullName = normalizeText(data.fullName);
  const email = normalizeEmail(data.email);
  const temporaryPassword = normalizeText(data.temporaryPassword);
  const role = normalizeText(data.role) as "tenant_admin" | "security_guard";
  const status = data.status;

  if (!tenantId || !fullName || !email || !role || !status) {
    throw new HttpsError("invalid-argument", "Datos incompletos para crear usuario operativo.");
  }

  // Onboarding por enlace (ver normalizeCreateTenantAdminPayload).
  if (temporaryPassword) {
    assertStrongPassword(temporaryPassword, "contrasena temporal");
  }
  const finalPassword = temporaryPassword || generateStrongPassword();

  assertAdminStatus(status);
  assertOperationalRole(role);

  return {
    tenantId,
    fullName,
    email,
    temporaryPassword: finalPassword,
    role,
    status,
  };
}

function mapTenantAdminError(error: unknown, fallbackMessage: string) {
  if (error instanceof HttpsError) return error;

  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? String((error as { code: string }).code)
      : "";

  if (code === "auth/email-already-exists") {
    return new HttpsError("already-exists", "Ya existe un usuario con ese correo.");
  }

  if (code === "auth/invalid-email") {
    return new HttpsError("invalid-argument", "El correo no tiene un formato valido.");
  }

  if (code === "auth/invalid-password" || code === "auth/weak-password") {
    return new HttpsError("invalid-argument", "La contrasena temporal no cumple la politica minima.");
  }

  if (code === "auth/user-not-found") {
    return new HttpsError("not-found", "El usuario no existe.");
  }

  if (code === "auth/uid-already-exists") {
    return new HttpsError("already-exists", "El identificador del usuario ya existe.");
  }

  return new HttpsError("internal", fallbackMessage);
}

function assertTenantStatus(value: string) {
  if (value !== "active" && value !== "suspended" && value !== "trial") {
    throw new HttpsError("invalid-argument", "Estado de tenant invalido.");
  }
}

function assertOnboardingStatus(value: string) {
  if (value !== "not_started" && value !== "in_progress" && value !== "completed") {
    throw new HttpsError("invalid-argument", "Onboarding status invalido.");
  }
}

async function upsertUserProfile(input: {
  uid: string;
  email: string;
  fullName: string;
  role: DemoUserSeed["role"];
  tenantId?: string;
  unitId?: string;
  unitLabel?: string;
}) {
  const profileData = {
    uid: input.uid,
    email: input.email,
    fullName: input.fullName,
    role: input.role,
    tenantId: input.tenantId ?? null,
    status: "active",
    updatedAt: Timestamp.now(),
    ...(input.unitId ? { unitId: input.unitId } : {}),
    ...(input.unitLabel ? { unitLabel: input.unitLabel } : {}),
  };

  await db.collection("users").doc(input.uid).set(
    {
      ...profileData,
      createdAt: Timestamp.now(),
    },
    { merge: true },
  );
}

export const createTenant = onCall<CreateTenantInput>(async (request) => {
  assertSuperadmin(request.auth);

  const data = request.data;
  if (!data.name || !data.city || !data.planId || !data.adminEmail || !data.adminPassword) {
    throw new HttpsError("invalid-argument", "Datos incompletos para crear tenant.");
  }

  const tenantRef = db.collection("tenants").doc();
  const tenantId = tenantRef.id;

  const userRecord = await getAuth().createUser({
    email: data.adminEmail,
    password: data.adminPassword,
    displayName: data.adminFullName,
  });

  await getAuth().setCustomUserClaims(userRecord.uid, {
    role: "tenant_admin",
    tenantId,
  });

  await db.runTransaction(async (tx) => {
    tx.set(tenantRef, {
      name: data.name,
      city: data.city,
      status: "active",
      planId: data.planId,
      onboardingStatus: "not_started",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: request.auth?.uid,
    });

    tx.set(db.collection("tenantUsers").doc(`${tenantId}_${userRecord.uid}`), {
      uid: userRecord.uid,
      tenantId,
      fullName: data.adminFullName,
      email: data.adminEmail,
      role: "tenant_admin",
      status: "active",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    tx.set(
      db.collection("users").doc(userRecord.uid),
      {
        uid: userRecord.uid,
        email: data.adminEmail,
        fullName: data.adminFullName,
        role: "tenant_admin",
        tenantId,
        status: "active",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );

    tx.set(db.collection("auditLogs").doc(), {
      tenantId,
      actorUid: request.auth?.uid,
      action: "create_tenant",
      metadata: { adminUid: userRecord.uid },
      createdAt: Timestamp.now(),
    });
  });

  return { tenantId, adminUid: userRecord.uid };
});

export const createTenantWorkspace = onCall<CreateTenantWorkspaceInput>(async (request) => {
  assertSuperadmin(request.auth);

  const data = request.data;
  if (!data.name || !data.city || !data.planId) {
    throw new HttpsError("invalid-argument", "Datos incompletos para crear tenant.");
  }

  assertTenantStatus(data.status);
  assertOnboardingStatus(data.onboardingStatus);

  const now = Timestamp.now();
  const moduleVariants = normalizeModuleVariants(data.moduleVariants);
  const tenantRef = db.collection("tenants").doc();

  // `country` y `currency` se escriben aquí desde el 19 de agosto de 2026, y su
  // ausencia era un defecto silencioso: esta función tiene lista blanca de
  // campos, el formulario de la consola SÍ recogía la moneda, y aquí se perdía.
  // Como la lectura la defaultea a "COP", **todo conjunto creado desde la
  // consola nacía colombiano** — un conjunto en México mostraba pesos
  // colombianos y nadie lo notaba, porque el defecto se tapaba a sí mismo.
  //
  // La moneda se DERIVA del país en vez de aceptarse del cliente: así no puede
  // existir el par imposible (país México, moneda COP). Es lo que el camino del
  // trial ya hacía bien; esto solo lo alcanza.
  const country = normalizeText(data.country).toUpperCase() || "MX";
  await tenantRef.set({
    name: data.name,
    city: data.city,
    country,
    currency: currencyForCountry(country),
    status: data.status,
    planId: data.planId,
    onboardingStatus: data.onboardingStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: request.auth?.uid,
  });

  // Inicializa tenantSettings con los modos de operacion elegidos en el alta. Hoy el alta no
  // creaba este doc; al crearlo aqui, las variantes quedan disponibles desde el primer momento.
  await db.collection("tenantSettings").doc(tenantRef.id).set(
    {
      tenantId: tenantRef.id,
      tenantName: data.name,
      moduleVariants,
      updatedAt: now,
    },
    { merge: true },
  );

  // R1 de PRD-V-PLAT-003: todo conjunto nuevo nace con el plan estandar
  // sembrado. Va SIN bandera y a proposito: las cuentas son inertes hasta que
  // alguien las lea, y `producto-concepto-al-libro` no puede encenderse sobre un
  // conjunto que no tiene plan. Sembrar detras de la misma bandera que las usa
  // seria dejar a los conjuntos creados con la bandera apagada sin plan para
  // siempre, porque el alta no se repite.
  const siembra = await sembrarPlanDeCuentas(db, tenantRef.id, request.auth?.uid);

  await db.collection("auditLogs").add({
    tenantId: tenantRef.id,
    actorUid: request.auth?.uid,
    action: "create_tenant_workspace",
    metadata: {
      city: data.city,
      country,
      planId: data.planId,
      moduleVariants,
      cuentasSembradas: siembra.creadas,
    },
    createdAt: now,
  });

  return { tenantId: tenantRef.id };
});

export const createTenantAdmin = onCall<CreateTenantAdminInput>(
  {
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [resendApiKey],
  },
  async (request) => {
  assertSuperadmin(request.auth);

  const operationId = `createTenantAdmin_${Date.now()}`;

  try {
    const data = normalizeCreateTenantAdminPayload(request.data);

    const tenantRef = db.collection("tenants").doc(data.tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw new HttpsError("not-found", "El tenant no existe.");
    }

    const authApi = getAuth();
    const existingUser = await authApi
      .getUserByEmail(data.email)
      .then((user) => user)
      .catch((error: unknown) => {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "string"
            ? String((error as { code: string }).code)
            : "";
        if (code === "auth/user-not-found") return null;
        throw error;
      });

    if (existingUser) {
      throw new HttpsError("already-exists", "Ya existe un usuario con ese correo.");
    }

    const userRecord = await authApi.createUser({
      email: data.email,
      password: data.temporaryPassword,
      displayName: data.fullName,
      emailVerified: true,
      disabled: data.status !== "active",
    });

    const now = Timestamp.now();
    const batch = db.batch();

    batch.set(
      db.collection("users").doc(userRecord.uid),
      {
        uid: userRecord.uid,
        email: data.email,
        fullName: data.fullName,
        role: "tenant_admin",
        tenantId: data.tenantId,
        status: data.status,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    batch.set(
      db.collection("tenantUsers").doc(`${data.tenantId}_${userRecord.uid}`),
      {
        uid: userRecord.uid,
        tenantId: data.tenantId,
        fullName: data.fullName,
        email: data.email,
        role: "tenant_admin",
        status: data.status,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    try {
      await batch.commit();

      await authApi.setCustomUserClaims(userRecord.uid, {
        role: "tenant_admin",
        tenantId: data.tenantId,
      });
    } catch (persistError) {
      await Promise.allSettled([
        db.collection("users").doc(userRecord.uid).delete(),
        db.collection("tenantUsers").doc(`${data.tenantId}_${userRecord.uid}`).delete(),
        authApi.deleteUser(userRecord.uid),
      ]);
      throw persistError;
    }

    await sendOnboardingInvite(userRecord.uid, data.email, data.fullName, data.tenantId, "tenant_admin");

    try {
      await writeAuditLog(data.tenantId, request.auth?.uid, "create_tenant_admin", {
        adminUid: userRecord.uid,
        email: data.email,
      });
    } catch (auditError) {
      console.warn("[createTenantAdmin] audit log write failed", {
        operationId,
        tenantId: data.tenantId,
        adminUid: userRecord.uid,
        error: auditError,
      });
    }

    return { uid: userRecord.uid };
  } catch (error) {
    console.error("[createTenantAdmin] failed", {
      operationId,
      actorUid: request.auth?.uid,
      payload: {
        tenantId: request.data?.tenantId,
        email: request.data?.email,
        status: request.data?.status,
      },
      error,
    });
    throw mapTenantAdminError(error, "No fue posible crear el admin de tenant.");
  }
  },
);

export const updateTenantAdmin = onCall<UpdateTenantAdminInput>(
  {
    cors: callableCorsOrigins,
    invoker: "public",
  },
  async (request) => {
  assertSuperadmin(request.auth);

  const operationId = `updateTenantAdmin_${Date.now()}`;

  try {
    const data = normalizeUpdateTenantAdminPayload(request.data);

    const tenantRef = db.collection("tenants").doc(data.tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
      throw new HttpsError("not-found", "El tenant no existe.");
    }

    const authApi = getAuth();
    const previousUserSnap = await db.collection("users").doc(data.uid).get();
    const previousTenantId = (previousUserSnap.data() as { tenantId?: string } | undefined)?.tenantId;

    await authApi.updateUser(data.uid, {
      email: data.email,
      displayName: data.fullName,
      disabled: data.status !== "active",
    });

    await authApi.setCustomUserClaims(data.uid, {
      role: "tenant_admin",
      tenantId: data.tenantId,
    });

    const now = Timestamp.now();
    const batch = db.batch();

    batch.set(
      db.collection("users").doc(data.uid),
      {
        uid: data.uid,
        email: data.email,
        fullName: data.fullName,
        role: "tenant_admin",
        tenantId: data.tenantId,
        status: data.status,
        updatedAt: now,
      },
      { merge: true },
    );

    if (previousTenantId && previousTenantId !== data.tenantId) {
      batch.delete(db.collection("tenantUsers").doc(`${previousTenantId}_${data.uid}`));
    }

    batch.set(
      db.collection("tenantUsers").doc(`${data.tenantId}_${data.uid}`),
      {
        uid: data.uid,
        tenantId: data.tenantId,
        fullName: data.fullName,
        email: data.email,
        role: "tenant_admin",
        status: data.status,
        updatedAt: now,
      },
      { merge: true },
    );

    await batch.commit();

    try {
      await writeAuditLog(data.tenantId, request.auth?.uid, "update_tenant_admin", {
        adminUid: data.uid,
        previousTenantId: previousTenantId ?? null,
      });
    } catch (auditError) {
      console.warn("[updateTenantAdmin] audit log write failed", {
        operationId,
        tenantId: data.tenantId,
        adminUid: data.uid,
        error: auditError,
      });
    }

    return { uid: data.uid };
  } catch (error) {
    console.error("[updateTenantAdmin] failed", {
      operationId,
      actorUid: request.auth?.uid,
      payload: {
        uid: request.data?.uid,
        tenantId: request.data?.tenantId,
        email: request.data?.email,
        status: request.data?.status,
      },
      error,
    });
    throw mapTenantAdminError(error, "No fue posible actualizar el admin de tenant.");
  }
  },
);

export const createTenantOperationalUser = onCall<CreateTenantOperationalUserInput>(
  {
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [resendApiKey],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte para crear usuarios.");
    }

    const operationId = `createTenantOperationalUser_${Date.now()}`;

    try {
      const data = normalizeCreateTenantOperationalUserPayload(request.data);

      const actor = await assertActiveTenantAdmin(data.tenantId, request.auth.uid);
      const targetTenantId = actor.tenantId;

      const tenantRef = db.collection("tenants").doc(targetTenantId);
      const tenantSnap = await tenantRef.get();
      if (!tenantSnap.exists) {
        throw new HttpsError("not-found", "El tenant no existe.");
      }

      const authApi = getAuth();
      const existingUser = await authApi
        .getUserByEmail(data.email)
        .then((user) => user)
        .catch((error: unknown) => {
          const code =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof (error as { code?: unknown }).code === "string"
              ? String((error as { code: string }).code)
              : "";
          if (code === "auth/user-not-found") return null;
          throw error;
        });

      if (existingUser) {
        throw new HttpsError("already-exists", "Ya existe un usuario con ese correo.");
      }

      const userRecord = await authApi.createUser({
        email: data.email,
        password: data.temporaryPassword,
        displayName: data.fullName,
        emailVerified: true,
        disabled: data.status !== "active",
      });

      const now = Timestamp.now();
      const batch = db.batch();

      batch.set(
        db.collection("users").doc(userRecord.uid),
        {
          uid: userRecord.uid,
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          tenantId: targetTenantId,
          status: data.status,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      batch.set(
        db.collection("tenantUsers").doc(`${targetTenantId}_${userRecord.uid}`),
        {
          uid: userRecord.uid,
          tenantId: targetTenantId,
          fullName: data.fullName,
          email: data.email,
          role: data.role,
          status: data.status,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      try {
        await batch.commit();

        await authApi.setCustomUserClaims(userRecord.uid, {
          role: data.role,
          tenantId: targetTenantId,
        });
      } catch (persistError) {
        await Promise.allSettled([
          db.collection("users").doc(userRecord.uid).delete(),
          db.collection("tenantUsers").doc(`${targetTenantId}_${userRecord.uid}`).delete(),
          authApi.deleteUser(userRecord.uid),
        ]);
        throw persistError;
      }

      await sendOnboardingInvite(userRecord.uid, data.email, data.fullName, targetTenantId, data.role);

      await writeAuditLog(targetTenantId, request.auth.uid, "create_tenant_operational_user", {
        uid: userRecord.uid,
        email: data.email,
        role: data.role,
      });

      return {
        uid: userRecord.uid,
        tenantId: targetTenantId,
        role: data.role,
        email: data.email,
      };
    } catch (error) {
      console.error("[createTenantOperationalUser] failed", {
        operationId,
        actorUid: request.auth?.uid,
        payload: {
          tenantId: request.data?.tenantId,
          email: request.data?.email,
          role: request.data?.role,
          status: request.data?.status,
        },
        error,
      });
      throw mapTenantAdminError(error, "No fue posible crear el usuario operativo.");
    }
  },
);

// ── Gestión de usuarios operativos: baja / reactivación ───────────────────────
// Cambia el estado de un usuario operativo (admin/guarda) del mismo tenant. Baja
// correcta: status en users + tenantUsers, deshabilita Auth y revoca la sesión.
type SetOperationalUserStatusInput = { tenantId: string; uid: string; status: "active" | "inactive" };

export const setOperationalUserStatus = onCall<SetOperationalUserStatusInput>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte.");
    }

    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    const status = request.data?.status;
    if (!tenantId || !targetUid || (status !== "active" && status !== "inactive")) {
      throw new HttpsError("invalid-argument", "tenantId, uid y status (active|inactive) son requeridos.");
    }

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;

    // No puedes desactivarte a ti mismo (evita auto-lockout).
    if (targetUid === request.auth.uid && status === "inactive") {
      throw new HttpsError("failed-precondition", "No puedes desactivar tu propia cuenta.");
    }

    // El objetivo debe ser un usuario operativo del mismo tenant.
    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      throw new HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const targetRole = (membershipSnap.data() as { role?: string }).role;
    if (targetRole !== "tenant_admin" && targetRole !== "security_guard") {
      throw new HttpsError("failed-precondition", "Solo puedes gestionar usuarios operativos (admin o guarda).");
    }

    // Guardrail: no dejar el tenant sin ningún admin activo.
    if (targetRole === "tenant_admin" && status === "inactive") {
      const admins = await db
        .collection("tenantUsers")
        .where("tenantId", "==", targetTenantId)
        .where("role", "==", "tenant_admin")
        .get();
      const remainingActive = admins.docs.filter((d) => {
        const data = d.data() as { status?: string };
        return d.id !== `${targetTenantId}_${targetUid}` && (data.status ?? "active") === "active";
      }).length;
      if (remainingActive === 0) {
        throw new HttpsError("failed-precondition", "No puedes desactivar al último administrador activo del conjunto.");
      }
    }

    const now = Timestamp.now();
    const batch = db.batch();
    batch.set(db.collection("users").doc(targetUid), { status, updatedAt: now }, { merge: true });
    batch.set(membershipRef, { status, updatedAt: now }, { merge: true });
    await batch.commit();

    const authApi = getAuth();
    await authApi.updateUser(targetUid, { disabled: status === "inactive" });
    if (status === "inactive") {
      await authApi.revokeRefreshTokens(targetUid);
    }

    await writeAuditLog(targetTenantId, request.auth.uid, "set_operational_user_status", {
      uid: targetUid,
      role: targetRole,
      status,
    });

    return { ok: true, status };
  },
);

// Edita nombre y/o rol de un usuario operativo. Si cambia el rol, actualiza los
// custom claims y revoca tokens para que el nuevo permiso tome efecto.
type UpdateOperationalUserInput = {
  tenantId: string;
  uid: string;
  fullName?: string;
  role?: "tenant_admin" | "security_guard";
};

export const updateOperationalUser = onCall<UpdateOperationalUserInput>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte.");
    }

    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    const fullName = request.data?.fullName !== undefined ? normalizeText(request.data.fullName) : undefined;
    const role =
      request.data?.role !== undefined
        ? (normalizeText(request.data.role) as "tenant_admin" | "security_guard")
        : undefined;

    if (!tenantId || !targetUid) {
      throw new HttpsError("invalid-argument", "tenantId y uid son requeridos.");
    }
    if (fullName === undefined && role === undefined) {
      throw new HttpsError("invalid-argument", "No hay cambios para aplicar.");
    }
    if (fullName !== undefined && !fullName) {
      throw new HttpsError("invalid-argument", "El nombre no puede estar vacío.");
    }
    if (role !== undefined) {
      assertOperationalRole(role);
    }

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;

    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      throw new HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const membership = membershipSnap.data() as { role?: string; status?: string };
    const currentRole = membership.role;
    if (currentRole !== "tenant_admin" && currentRole !== "security_guard") {
      throw new HttpsError("failed-precondition", "Solo puedes editar usuarios operativos (admin o guarda).");
    }

    const roleChanged = role !== undefined && role !== currentRole;

    // Guardrail: no degradar al último admin activo a guarda.
    if (roleChanged && currentRole === "tenant_admin" && role === "security_guard") {
      const admins = await db
        .collection("tenantUsers")
        .where("tenantId", "==", targetTenantId)
        .where("role", "==", "tenant_admin")
        .get();
      const remainingActive = admins.docs.filter((d) => {
        const data = d.data() as { status?: string };
        return d.id !== `${targetTenantId}_${targetUid}` && (data.status ?? "active") === "active";
      }).length;
      if (remainingActive === 0) {
        throw new HttpsError("failed-precondition", "No puedes cambiar el rol del último administrador activo del conjunto.");
      }
    }

    const now = Timestamp.now();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (fullName !== undefined) updates.fullName = fullName;
    if (role !== undefined) updates.role = role;

    const batch = db.batch();
    batch.set(db.collection("users").doc(targetUid), updates, { merge: true });
    batch.set(membershipRef, updates, { merge: true });
    await batch.commit();

    const authApi = getAuth();
    if (fullName !== undefined) {
      await authApi.updateUser(targetUid, { displayName: fullName });
    }
    if (roleChanged && role !== undefined) {
      await authApi.setCustomUserClaims(targetUid, { role, tenantId: targetTenantId });
      await authApi.revokeRefreshTokens(targetUid); // fuerza refresco del nuevo claim
    }

    await writeAuditLog(targetTenantId, request.auth.uid, "update_operational_user", {
      uid: targetUid,
      fullName: fullName ?? null,
      role: role ?? null,
      roleChanged,
    });

    return { ok: true };
  },
);

// Baja definitiva (irreversible) de un usuario operativo: borra Auth + docs. Solo
// se permite sobre usuarios YA inactivos (desactivar primero corta el acceso y es
// reversible; este paso purga).
type DeleteOperationalUserInput = { tenantId: string; uid: string };

export const deleteOperationalUser = onCall<DeleteOperationalUserInput>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte.");
    }

    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    if (!tenantId || !targetUid) {
      throw new HttpsError("invalid-argument", "tenantId y uid son requeridos.");
    }

    if (targetUid === request.auth.uid) {
      throw new HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta.");
    }

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;

    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
      throw new HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const membership = membershipSnap.data() as { role?: string; status?: string };
    if (membership.role !== "tenant_admin" && membership.role !== "security_guard") {
      throw new HttpsError("failed-precondition", "Solo puedes eliminar usuarios operativos (admin o guarda).");
    }
    // Solo usuarios ya desactivados (soft-delete previo obligatorio).
    if ((membership.status ?? "active") !== "inactive") {
      throw new HttpsError("failed-precondition", "Primero debes desactivar al usuario; luego podrás eliminarlo.");
    }

    const authApi = getAuth();
    const results = await Promise.allSettled([
      db.collection("users").doc(targetUid).delete(),
      membershipRef.delete(),
      authApi.deleteUser(targetUid).catch((error: unknown) => {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (code === "auth/user-not-found") return; // ya no existe en Auth: ok
        throw error;
      }),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed && failed.status === "rejected") {
      console.error("[deleteOperationalUser] partial failure", failed.reason);
      throw new HttpsError("internal", "No fue posible completar la eliminación. Reintenta.");
    }

    await writeAuditLog(targetTenantId, request.auth.uid, "delete_operational_user", {
      uid: targetUid,
      role: membership.role,
    });

    return { ok: true };
  },
);

// ── Revocar el acceso de un residente al borrarlo ────────────────────────────
//
// La lógica vive en `resident-access.ts`; aquí solo se expone, se valida que
// quien llama sea administrador activo del conjunto, y se deja el rastro.
//
// **Se llama ANTES de borrar la ficha, no después.** Si esto falla, el borrado
// se aborta y la persona sigue listada — que es molesto pero honesto. Al revés
// —ficha borrada, acceso vivo— es exactamente el defecto que esta función cierra,
// y encima con el diálogo prometiendo lo contrario.
export const revokeResidentAccess = onCall<RevocarAccesoInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte.");
    }

    const tenantId = normalizeText(request.data?.tenantId);
    if (!tenantId) {
      throw new HttpsError("invalid-argument", "tenantId es requerido.");
    }

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);

    const resultado = await revocarAccesoDeResidente(
      { tenantId: actor.tenantId, personId: normalizeText(request.data?.personId) },
      request.auth.uid,
    );

    // Solo se audita cuando de verdad había una cuenta que cerrar: anotar los
    // residentes sin acceso llenaría el registro de ruido y escondería lo que
    // importa.
    if (resultado.revoked) {
      await writeAuditLog(actor.tenantId, request.auth.uid, "revoke_resident_access", {
        personId: normalizeText(request.data?.personId),
        uid: resultado.uid,
        accion: resultado.accion,
        motivo: resultado.motivo,
      });
    }

    return resultado;
  },
);

// ── Repositorio documental: carpetas (sistema tipo Drive, solo admin) ──────────
// Crea una carpeta validando el límite de profundidad como fuente de verdad:
// carpeta madre (depth 0) + hasta 4 niveles de subcarpetas (depth máx 4).
type CreateDocumentFolderInput = { tenantId: string; name: string; parentId?: string | null; description?: string };

export const createDocumentFolder = onCall<CreateDocumentFolderInput>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes autenticarte.");
    }
    const tenantId = normalizeText(request.data?.tenantId);
    const name = normalizeText(request.data?.name);
    const parentId = request.data?.parentId ? normalizeText(request.data.parentId) : null;
    const description = request.data?.description !== undefined ? normalizeText(request.data.description) : "";
    if (!tenantId || !name) {
      throw new HttpsError("invalid-argument", "tenantId y name son requeridos.");
    }

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;

    let depth = 0;
    let parentPath = "";
    if (parentId) {
      const parentSnap = await db.collection("documentFolders").doc(parentId).get();
      if (!parentSnap.exists) {
        throw new HttpsError("not-found", "La carpeta padre no existe.");
      }
      const parent = parentSnap.data() as { tenantId?: string; depth?: number; path?: string };
      if (parent.tenantId !== targetTenantId) {
        throw new HttpsError("permission-denied", "La carpeta padre es de otro tenant.");
      }
      depth = (parent.depth ?? 0) + 1;
      if (depth > 4) {
        throw new HttpsError("failed-precondition", "Máximo 4 niveles de subcarpetas bajo la carpeta madre.");
      }
      parentPath = parent.path ?? parentId;
    }

    const profileSnap = await db.collection("users").doc(request.auth.uid).get();
    const createdByName = (profileSnap.data() as { fullName?: string } | undefined)?.fullName ?? "";

    const now = Timestamp.now();
    const ref = db.collection("documentFolders").doc();
    const path = parentId ? `${parentPath}/${ref.id}` : ref.id;
    await ref.set({
      tenantId: targetTenantId,
      name,
      description,
      parentId,
      path,
      depth,
      createdBy: request.auth.uid,
      createdByName,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog(targetTenantId, request.auth.uid, "create_document_folder", {
      folderId: ref.id,
      parentId,
      depth,
    });

    return { ok: true, folderId: ref.id, depth, path };
  },
);

// Carpetas de sistema (find-or-create). Alojan archivos de cada fuente; son
// protegidas (no se renombran/mueven/eliminan) y usan el color reservado "system".
const SYSTEM_FOLDERS: Record<string, { name: string; description: string }> = {
  communications: { name: "Comunicados", description: "Adjuntos de los comunicados publicados. Carpeta del sistema." },
  regulations: { name: "Reglamentos", description: "Reglamentos del conjunto. Carpeta del sistema." },
  committee_agreements: { name: "Acuerdos de comité", description: "Actas y acuerdos de comité. Carpeta del sistema." },
  payment_receipts: { name: "Comprobantes de pago", description: "Comprobantes de pago aprobados de los residentes. Carpeta del sistema." },
  billing_closures: { name: "Cierres de cartera", description: "Reportes de cierre de períodos de cartera. Carpeta del sistema." },
  committee_reports: { name: "Reportes de comité", description: "Reportes de comité generados por período. Carpeta del sistema." },
  cartera_history: { name: "Histórico de cartera", description: "Histórico de recaudo (esperado vs cobrado) y morosos. Carpeta del sistema." },
  ledger_history: { name: "Histórico del libro", description: "Movimientos del libro guardados por período. Carpeta del sistema." },
};

async function ensureSystemFolderImpl(tenantId: string, actorUid: string, systemKey: string): Promise<string> {
  const cfg = SYSTEM_FOLDERS[systemKey];
  if (!cfg) throw new HttpsError("invalid-argument", "Carpeta de sistema desconocida.");

  const existing = await db
    .collection("documentFolders")
    .where("tenantId", "==", tenantId)
    .where("systemKey", "==", systemKey)
    .limit(1)
    .get();
  if (!existing.empty) {
    const found = existing.docs[0];
    const data = found.data() as { color?: string; system?: boolean };
    if (data.color !== "system" || data.system !== true) {
      await found.ref.update({ color: "system", system: true, updatedAt: Timestamp.now() });
    }
    return found.id;
  }

  const profileSnap = await db.collection("users").doc(actorUid).get();
  const createdByName = (profileSnap.data() as { fullName?: string } | undefined)?.fullName ?? "";
  const now = Timestamp.now();
  const ref = db.collection("documentFolders").doc();
  await ref.set({
    tenantId,
    name: cfg.name,
    description: cfg.description,
    parentId: null,
    path: ref.id,
    depth: 0,
    color: "system",
    system: true,
    systemKey,
    createdBy: actorUid,
    createdByName,
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditLog(tenantId, actorUid, "ensure_system_folder", { folderId: ref.id, systemKey });
  return ref.id;
}

export const ensureSystemFolder = onCall<{ tenantId: string; systemKey: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const systemKey = normalizeText(request.data?.systemKey);
    if (!tenantId || !systemKey) throw new HttpsError("invalid-argument", "tenantId y systemKey requeridos.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const folderId = await ensureSystemFolderImpl(actor.tenantId, request.auth.uid, systemKey);
    return { folderId };
  },
);

// Compatibilidad: el flujo de comunicados sigue llamando este nombre.
export const ensureCommunicationsFolder = onCall<{ tenantId: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    if (!tenantId) throw new HttpsError("invalid-argument", "tenantId requerido.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const folderId = await ensureSystemFolderImpl(actor.tenantId, request.auth.uid, "communications");
    return { folderId };
  },
);

// Actualizar carpeta: nombre, descripción y/o color (no cambia path/depth/parent;
// integridad intacta). El nombre del callable se conserva por compatibilidad.
const FOLDER_COLORS = ["gray", "blue", "green", "amber", "purple", "teal"];
export const renameDocumentFolder = onCall<{
  tenantId: string;
  folderId: string;
  name?: string;
  description?: string;
  color?: string;
}>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    const name = request.data?.name !== undefined ? normalizeText(request.data.name) : undefined;
    const description = request.data?.description !== undefined ? normalizeText(request.data.description) : undefined;
    const color = request.data?.color !== undefined ? normalizeText(request.data.color) : undefined;
    if (!tenantId || !folderId) {
      throw new HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    }
    if (name === undefined && description === undefined && color === undefined) {
      throw new HttpsError("invalid-argument", "No hay cambios para aplicar.");
    }
    if (name !== undefined && !name) throw new HttpsError("invalid-argument", "El nombre no puede estar vacío.");
    if (color !== undefined && !FOLDER_COLORS.includes(color)) throw new HttpsError("invalid-argument", "Color no permitido.");

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const ref = db.collection("documentFolders").doc(folderId);
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as { tenantId?: string }).tenantId !== actor.tenantId) {
      throw new HttpsError("not-found", "La carpeta no existe en este tenant.");
    }
    if ((snap.data() as { system?: boolean }).system === true) {
      throw new HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede modificar.");
    }
    const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    await ref.update(updates);
    await writeAuditLog(actor.tenantId, request.auth.uid, "update_document_folder", { folderId, name, color });
    return { ok: true };
  },
);

// Eliminar carpeta: solo si está vacía (sin subcarpetas ni documentos).
export const deleteDocumentFolder = onCall<{ tenantId: string; folderId: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    if (!tenantId || !folderId) throw new HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const ref = db.collection("documentFolders").doc(folderId);
    const snap = await ref.get();
    if (!snap.exists || (snap.data() as { tenantId?: string }).tenantId !== actor.tenantId) {
      throw new HttpsError("not-found", "La carpeta no existe en este tenant.");
    }
    if ((snap.data() as { system?: boolean }).system === true) {
      throw new HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede eliminar.");
    }
    const subs = await db
      .collection("documentFolders")
      .where("tenantId", "==", actor.tenantId)
      .where("parentId", "==", folderId)
      .limit(1)
      .get();
    if (!subs.empty) throw new HttpsError("failed-precondition", "La carpeta tiene subcarpetas. Vacíala antes de eliminar.");
    const docs = await db
      .collection("documents")
      .where("tenantId", "==", actor.tenantId)
      .where("folderId", "==", folderId)
      .limit(1)
      .get();
    if (!docs.empty) throw new HttpsError("failed-precondition", "La carpeta tiene documentos. Muévelos o elimínalos antes.");

    await ref.delete();
    await writeAuditLog(actor.tenantId, request.auth.uid, "delete_document_folder", { folderId });
    return { ok: true };
  },
);

// Mover carpeta a otra carpeta (o a la raíz). Re-parenta la carpeta y recalcula
// path/depth de todo su subárbol; valida ciclos y que no supere los 4 niveles.
export const moveDocumentFolder = onCall<{ tenantId: string; folderId: string; targetParentId?: string | null }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    const targetParentId = request.data?.targetParentId ? normalizeText(request.data.targetParentId) : null;
    if (!tenantId || !folderId) throw new HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;

    const snap = await db.collection("documentFolders").where("tenantId", "==", targetTenantId).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { parentId?: string | null; path?: string; depth?: number }) }));
    const folder = all.find((f) => f.id === folderId);
    if (!folder) throw new HttpsError("not-found", "La carpeta no existe en este tenant.");
    if ((folder as { system?: boolean }).system === true) {
      throw new HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede mover.");
    }

    const target = targetParentId ? all.find((f) => f.id === targetParentId) : null;
    if (targetParentId && !target) throw new HttpsError("not-found", "La carpeta destino no existe.");
    if (targetParentId === folderId) throw new HttpsError("failed-precondition", "No puedes mover una carpeta dentro de sí misma.");

    const oldPath = folder.path || folder.id;
    if (target && (target.id === folder.id || (target.path || target.id).startsWith(`${oldPath}/`))) {
      throw new HttpsError("failed-precondition", "No puedes mover una carpeta dentro de una de sus subcarpetas.");
    }
    if ((folder.parentId ?? null) === (targetParentId ?? null)) {
      return { ok: true }; // ya está en ese destino
    }

    const folderDepth = folder.depth ?? 0;
    const newDepth = target ? (target.depth ?? 0) + 1 : 0;
    const descendants = all.filter((f) => (f.path || f.id).startsWith(`${oldPath}/`));
    const subtreeMaxDepth = descendants.reduce((m, f) => Math.max(m, f.depth ?? 0), folderDepth);
    const height = subtreeMaxDepth - folderDepth;
    if (newDepth + height > 4) {
      throw new HttpsError("failed-precondition", "El movimiento superaría los 4 niveles de subcarpetas.");
    }

    const newPath = target ? `${target.path || target.id}/${folderId}` : folderId;
    const depthDelta = newDepth - folderDepth;
    const now = Timestamp.now();
    const batch = db.batch();
    batch.update(db.collection("documentFolders").doc(folderId), {
      parentId: targetParentId ?? null,
      path: newPath,
      depth: newDepth,
      updatedAt: now,
    });
    for (const d of descendants) {
      batch.update(db.collection("documentFolders").doc(d.id), {
        path: newPath + (d.path || "").slice(oldPath.length),
        depth: (d.depth ?? 0) + depthDelta,
        updatedAt: now,
      });
    }
    await batch.commit();
    await writeAuditLog(targetTenantId, request.auth.uid, "move_document_folder", { folderId, targetParentId, moved: descendants.length + 1 });
    return { ok: true };
  },
);

// Enlace de descarga: verifica admin, audita la descarga y emite una URL firmada de
// corta duración (10 min). Si el service account no puede firmar, cae al fileUrl.
export const getDocumentDownloadUrl = onCall<{ documentId: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const documentId = normalizeText(request.data?.documentId);
    if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido.");

    const snap = await db.collection("documents").doc(documentId).get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado.");
    const docData = snap.data() as { tenantId?: string; storagePath?: string; fileUrl?: string; fileName?: string };
    if (!docData.tenantId) throw new HttpsError("failed-precondition", "Documento sin tenant.");

    await assertActiveTenantAdmin(docData.tenantId, request.auth.uid);
    await writeAuditLog(docData.tenantId, request.auth.uid, "download_document", {
      documentId,
      fileName: docData.fileName ?? null,
    });

    let url = docData.fileUrl ?? "";
    if (docData.storagePath) {
      try {
        const [signed] = await getStorage()
          .bucket()
          .file(docData.storagePath)
          .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000 });
        url = signed;
      } catch (error) {
        console.warn("[getDocumentDownloadUrl] firma no disponible; se usa fileUrl", error);
      }
    }
    if (!url) throw new HttpsError("internal", "No fue posible generar el enlace.");
    return { url };
  },
);

export const provisionResidentTemporaryAccess = onCall<ProvisionResidentTemporaryAccessInput>(
  {
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [resendApiKey],
  },
  async (request) => {
    const tenantId = normalizeText(request.data?.tenantId);
    const personId = normalizeText(request.data?.personId);

    if (!tenantId || !personId) {
      throw new HttpsError("invalid-argument", "Debes indicar tenant y residente para restablecer la clave.");
    }

    await assertTenantAdminOrSuper({
      tenantId,
      uid: request.auth?.uid,
      role: request.auth?.token?.role,
    });
    // Regla B: en prueba no se invita a personas reales.
    await assertCanInviteRealPeople(tenantId);

    try {
      const { isNewUser, ...result } = await upsertResidentTemporaryAccess({
        tenantId,
        personId,
        actorUid: request.auth?.uid,
      });

      // Cuenta nueva → bienvenida; reenvío de acceso a residente existente → restablecimiento.
      await sendPasswordSetupEmail(result.email, result.fullName, isNewUser ? "welcome" : "reset");

      return {
        ...result,
        temporaryPasswordSource: "resetLink",
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("[provisionResidentTemporaryAccess] failed", {
        actorUid: request.auth?.uid,
        tenantId,
        personId,
        error,
      });
      throw new HttpsError("internal", "No fue posible restablecer la clave temporal del residente.");
    }
  },
);

export const completeResidentPasswordChange = onCall<CompleteResidentPasswordChangeInput>(
  {
    cors: callableCorsOrigins,
    invoker: "public",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion para cambiar la contrasena.");
    }

    const uid = request.auth.uid;
    const currentPassword = normalizeText(request.data?.currentPassword);
    const newPassword = normalizeText(request.data?.newPassword);

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "No se encontro el perfil del residente.");
    }

    const profile = userSnap.data() as Record<string, unknown>;
    const role = normalizeText(profile.role);
    const tenantId = normalizeText(profile.tenantId);
    const documentNumber = normalizeText(profile.documentNumber);
    const mustChangePassword = Boolean(profile.mustChangePassword);

    console.info("[completeResidentPasswordChange] before", {
      uid,
      tenantId,
      role,
      mustChangePassword,
      passwordStatus: normalizeText(profile.passwordStatus),
      temporaryPassword: Boolean(profile.temporaryPassword),
    });

    if (role !== "resident") {
      throw new HttpsError("permission-denied", "Solo residentes pueden ejecutar este flujo.");
    }

    if (!mustChangePassword) {
      throw new HttpsError("failed-precondition", "Tu cuenta ya no requiere cambio de clave temporal.");
    }

    assertTemporaryPasswordPolicy({
      currentPassword,
      newPassword,
      documentNumber,
    });

    const authApi = getAuth();
    await authApi.updateUser(uid, {
      password: newPassword,
      disabled: false,
    });

    const now = Timestamp.now();
    const batch = db.batch();

    batch.set(
      userRef,
      {
        mustChangePassword: false,
        temporaryPassword: false,
        passwordStatus: "updated",
        passwordChangedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    if (tenantId) {
      batch.set(
        db.collection("tenantUsers").doc(`${tenantId}_${uid}`),
        {
          mustChangePassword: false,
          temporaryPassword: false,
          passwordStatus: "updated",
          updatedAt: now,
        },
        { merge: true },
      );
    }

    await batch.commit();

    if (tenantId) {
      await writeAuditLog(tenantId, uid, "resident_password_change_completed", {
        residentUid: uid,
      });
    }

    console.info("[completeResidentPasswordChange] after", {
      uid,
      tenantId,
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
    });

    return {
      ok: true,
      mustChangePassword: false,
    };
  },
);

export const seedDemoData = onCall(async (request) => {
  assertSuperadmin(request.auth);

  // Blindaje go-live: el seed crea cuentas con contrasenas conocidas (Demo1234*).
  // Solo se permite en el emulador o si se habilita explicitamente por env, nunca por accidente en prod.
  if (process.env.FUNCTIONS_EMULATOR !== "true" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new HttpsError("failed-precondition", "El seed de demo esta deshabilitado en este entorno.");
  }

  const now = Timestamp.now();
  const tenantId = "tenant-santa-maria";

  await db.collection("tenants").doc(tenantId).set(
    {
      name: "Conjunto Residencial Santa Maria",
      city: "Bogota",
      status: "active",
      planId: "plus",
      onboardingStatus: "completed",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await db.collection("communications").doc("com-1").set(
    {
      tenantId,
      title: "Mantenimiento de ascensores",
      body: "Intervencion preventiva programada.",
      audience: "all",
      publishedAt: now,
    },
    { merge: true },
  );

  await db.collection("plans").doc("plus").set(
    {
      id: "plus",
      limits: {
        users: 600,
        reservationsPerMonth: 1500,
      },
      updatedAt: now,
    },
    { merge: true },
  );

  const demoUsers: DemoUserSeed[] = [
    {
      email: "superadmin@hogaru.co",
      password: "Demo1234*",
      displayName: "Paula Sierra",
      role: "superadmin",
    },
    {
      email: "admin@santamaria.co",
      password: "Demo1234*",
      displayName: "Carlos Ramirez",
      role: "tenant_admin",
      tenantId,
    },
    {
      email: "residente@santamaria.co",
      password: "Demo1234*",
      displayName: "Ana Lucia Perez",
      role: "resident",
      tenantId,
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
    },
  ];

  for (const demoUser of demoUsers) {
    const userRecord = await upsertAuthUser(demoUser);

    await upsertUserProfile({
      uid: userRecord.uid,
      email: demoUser.email,
      fullName: demoUser.displayName,
      role: demoUser.role,
      tenantId: demoUser.tenantId,
      unitId: demoUser.unitId,
      unitLabel: demoUser.unitLabel,
    });

    if (demoUser.tenantId) {
      const tenantUserData = {
        uid: userRecord.uid,
        tenantId: demoUser.tenantId,
        fullName: demoUser.displayName,
        email: demoUser.email,
        role: demoUser.role,
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...(demoUser.unitId ? { unitId: demoUser.unitId } : {}),
        ...(demoUser.unitLabel ? { unitLabel: demoUser.unitLabel } : {}),
      };

      await db.collection("tenantUsers").doc(`${demoUser.tenantId}_${userRecord.uid}`).set(
        tenantUserData,
        { merge: true },
      );
    }
  }

  return {
    ok: true,
    seededUsers: demoUsers.map((user) => ({ email: user.email, role: user.role })),
    tenantId,
  };
});

export const createVisitorPass = onCall<CreateVisitorPassInput>(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes autenticarte para crear visitantes.");
  }

  const data = request.data;
  if (
    !data.tenantId ||
    !data.unitId ||
    !data.unitLabel ||
    !data.visitorName ||
    !data.documentNumber ||
    !data.qrCodeValue ||
    !data.date ||
    !data.scheduledTime
  ) {
    throw new HttpsError("invalid-argument", "Datos incompletos para crear visitante.");
  }

  const membership = await assertTenantMember(data.tenantId, request.auth.uid);
  const role = membership.role;

  if (role !== "tenant_admin" && role !== "resident" && request.auth.token.role !== "superadmin") {
    throw new HttpsError("permission-denied", "No tienes permisos para crear visitantes.");
  }

  if (role === "resident" && membership.unitId !== data.unitId) {
    throw new HttpsError("permission-denied", "Residente solo puede crear visitantes para su unidad.");
  }

  const scheduledDateTime = combineDateAndTime(data.date, data.scheduledTime);
  if (!scheduledDateTime || !isDateTimeValid(scheduledDateTime, "visitor")) {
    throw new HttpsError("failed-precondition", "INVALID_DATETIME");
  }

  const [towerValue, unitValue] = data.unitLabel.split("-");
  const hostResidentName =
    typeof data.hostResidentName === "string" && data.hostResidentName.trim().length > 0
      ? data.hostResidentName.trim()
      : typeof membership.fullName === "string"
        ? membership.fullName
        : "";

  const createdRef = await db.collection("visitorPasses").add({
    tenantId: data.tenantId,
    unitId: data.unitId,
    unitLabel: data.unitLabel,
    visitorName: data.visitorName,
    documentNumber: data.documentNumber,
    qrCodeValue: data.qrCodeValue,
    hostResidentName,
    tower: typeof data.tower === "string" && data.tower.trim().length > 0 ? data.tower.trim() : towerValue?.trim() || "-",
    unit: typeof data.unit === "string" && data.unit.trim().length > 0 ? data.unit.trim() : unitValue?.trim() || data.unitLabel,
    date: data.date,
    eventDate: typeof data.date === "string" ? data.date.slice(0, 10) : data.date,
    scheduledTime: data.scheduledTime,
    status: "scheduled",
    checkInAt: null,
    checkOutAt: null,
    createdBy: request.auth.uid,
    createdByName: typeof membership.fullName === "string" ? membership.fullName : "",
    residentName: hostResidentName,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog(data.tenantId, request.auth.uid, "create_visitor_pass", {
    visitorPassId: createdRef.id,
    unitId: data.unitId,
  });

  return { visitorPassId: createdRef.id };
});

/**
 * Registro simple de visita por porteria (modo `registro_simple`). La porteria registra una
 * visita que ya llego: el pase nace en estado "inside" (sin QR) y se notifica a los residentes
 * de la unidad. Solo disponible cuando la variante de Visitas del conjunto es `registro_simple`.
 */
export const registerWalkInVisit = onCall<RegisterWalkInVisitInput>(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes autenticarte para registrar visitas.");
  }

  const data = request.data;
  if (!data.tenantId || !data.unitId || !data.unitLabel || !data.visitorName || !data.documentNumber) {
    throw new HttpsError("invalid-argument", "Datos incompletos para registrar la visita.");
  }

  const membership = await assertTenantMember(data.tenantId, request.auth.uid);
  const role = membership.role;
  const isGuard = role === "security_guard" || role === "security";
  if (!isGuard && role !== "tenant_admin" && request.auth.token.role !== "superadmin") {
    throw new HttpsError("permission-denied", "No tienes permisos para registrar visitas.");
  }

  const variant = await getTenantVisitorsVariant(data.tenantId);
  if (variant !== "registro_simple") {
    throw new HttpsError(
      "failed-precondition",
      "El registro simple de visitas no esta habilitado para este conjunto.",
    );
  }

  const now = Timestamp.now();
  const serverDate = now.toDate();
  const date =
    typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ? data.date
      : serverDate.toISOString().slice(0, 10);
  const scheduledTime =
    typeof data.scheduledTime === "string" && /^\d{2}:\d{2}/.test(data.scheduledTime)
      ? data.scheduledTime.slice(0, 5)
      : `${String(serverDate.getUTCHours()).padStart(2, "0")}:${String(serverDate.getUTCMinutes()).padStart(2, "0")}`;

  const [towerValue, unitValue] = data.unitLabel.split("-");
  const hostResidentName =
    typeof data.hostResidentName === "string" && data.hostResidentName.trim().length > 0
      ? data.hostResidentName.trim()
      : "";

  const createdRef = await db.collection("visitorPasses").add({
    tenantId: data.tenantId,
    unitId: data.unitId,
    unitLabel: data.unitLabel,
    visitorName: data.visitorName,
    documentNumber: data.documentNumber,
    qrCodeValue: "",
    hostResidentName,
    tower: towerValue?.trim() || "-",
    unit: unitValue?.trim() || data.unitLabel,
    date,
    eventDate: date,
    scheduledTime,
    status: "inside",
    checkInAt: now,
    checkOutAt: null,
    registeredByGuard: true,
    createdBy: request.auth.uid,
    createdByName: typeof membership.fullName === "string" ? membership.fullName : "",
    residentName: hostResidentName,
    createdAt: now,
    updatedAt: now,
  });

  // Notifica a los residentes de la unidad anfitriona.
  const residentUids = await listResidentUidsByUnit(data.tenantId, data.unitId);
  if (residentUids.length > 0) {
    await createNotifications(
      residentUids.map((uid) => ({
        userId: uid,
        tenantId: data.tenantId,
        type: "visitor" as const,
        title: "Visita registrada",
        description: `La porteria registro el ingreso de ${data.visitorName} a tu unidad.`,
        link: "/resident/visitors",
      })),
    );
  }

  await writeAuditLog(data.tenantId, request.auth.uid, "register_walk_in_visit", {
    visitorPassId: createdRef.id,
    unitId: data.unitId,
  });

  return { visitorPassId: createdRef.id };
});

export const confirmPackageReceipt = onCall<ConfirmPackageReceiptInput>(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes autenticarte para confirmar paquetes.");
  }

  const data = request.data;
  if (!data.tenantId || !data.packageId) {
    throw new HttpsError("invalid-argument", "Datos incompletos para confirmar paquete.");
  }

  const membership = await assertTenantMember(data.tenantId, request.auth.uid);
  if (membership.role !== "resident" && membership.role !== "tenant_admin" && request.auth.token.role !== "superadmin") {
    throw new HttpsError("permission-denied", "No tienes permisos para confirmar paquetes.");
  }

  const packageRef = db.collection("packages").doc(data.packageId);
  const packageSnap = await packageRef.get();
  if (!packageSnap.exists) {
    throw new HttpsError("not-found", "Paquete no encontrado.");
  }

  const pkg = packageSnap.data() as { tenantId?: string; unitId?: string; status?: string };
  if (pkg.tenantId !== data.tenantId) {
    throw new HttpsError("permission-denied", "El paquete no pertenece al tenant indicado.");
  }

  if (membership.role === "resident" && membership.unitId !== pkg.unitId) {
    throw new HttpsError("permission-denied", "Solo puedes confirmar paquetes de tu unidad.");
  }

  if (pkg.status === "delivered") {
    return { packageId: data.packageId, alreadyDelivered: true };
  }

  await packageRef.update({
    status: "delivered",
    receivedBy: request.auth.uid,
    receivedAt: Timestamp.now(),
    updatedBy: request.auth.uid,
    updatedAt: Timestamp.now(),
  });

  await writeAuditLog(data.tenantId, request.auth.uid, "confirm_package_receipt", {
    packageId: data.packageId,
  });

  return { packageId: data.packageId, alreadyDelivered: false };
});

export const onCommunicationCreated = onDocumentCreated("communications/{communicationId}", async (event) => {
  const data = event.data?.data() as
    | { tenantId?: string; title?: string; notificationSummary?: string }
    | undefined;
  if (!data?.tenantId) return;

  // Hasta agosto de 2026 esto decía «La administracion publico un nuevo
  // comunicado» para TODOS los comunicados, siempre. El residente recibía un
  // aviso que no le decía nada y tenía que entrar para saber si le afectaba.
  //
  // `notificationSummary` es opcional a propósito: los comunicados escritos a
  // mano pueden no traerlo, y los anteriores a esa fecha no lo traen. Cuando
  // falta se cae a la frase de siempre — nunca se inventa un resumen ni se
  // recorta el mensaje por su cuenta, que sería adivinar qué es lo importante.
  const resumen = data.notificationSummary?.trim();

  const residentUids = await listTenantUidsByRoles(data.tenantId, ["resident"]);
  await createNotifications(
    residentUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "communication",
      title: data.title?.trim() || "Nuevo comunicado",
      description: resumen || "La administracion publico un nuevo comunicado.",
      link: "/resident/communications",
    })),
  );
});

export const onPackageCreated = onDocumentCreated("packages/{packageId}", async (event) => {
  const data = event.data?.data() as { tenantId?: string; unitId?: string; status?: string; unitLabel?: string } | undefined;
  if (!data?.tenantId || !data?.unitId) return;

  const residentUids = await listResidentUidsByUnit(data.tenantId, data.unitId);
  const guardUids = await listTenantUidsByRoles(data.tenantId, ["security_guard", "security"]);

  const payload: NotificationInput[] = [
    ...residentUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "package" as const,
      title: "Nuevo paquete registrado",
      description: `Se registro un paquete para tu unidad ${data.unitLabel ?? ""}.`.trim(),
      link: "/resident/packages",
    })),
  ];

  if ((data.status ?? "pending") === "pending") {
    payload.push(
      ...guardUids.map((uid) => ({
        userId: uid,
        tenantId: data.tenantId,
        type: "package" as const,
        title: "Paquete pendiente de entrega",
        description: `Nuevo paquete pendiente ${data.unitLabel ? `(${data.unitLabel})` : ""}.`.trim(),
        link: "/guard/packages",
      })),
    );
  }

  await createNotifications(payload);
});

export const onReservationCreated = onDocumentCreated("reservations/{reservationId}", async (event) => {
  const data = event.data?.data() as { tenantId?: string; amenity?: string; createdBy?: string; unitLabel?: string } | undefined;
  if (!data?.tenantId) return;

  const adminUids = await listTenantUidsByRoles(data.tenantId, ["tenant_admin"]);
  const superadminUids = await listSuperadminUids();

  await createNotifications([
    ...adminUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "reservation" as const,
      title: "Nueva reserva creada",
      description: `${data.amenity ?? "Amenidad"} ${data.unitLabel ? `- ${data.unitLabel}` : ""}`.trim(),
      link: "/admin/reservations",
    })),
    ...superadminUids.map((uid) => ({
      userId: uid,
      type: "reservation" as const,
      title: "Nueva reserva en tenant",
      description: `Tenant ${data.tenantId} registro una nueva reserva.`,
      link: "/superadmin/analytics",
    })),
  ]);
});

export const onReservationUpdated = onDocumentUpdated({ document: "reservations/{reservationId}", secrets: [resendApiKey] }, async (event) => {
  const before = event.data?.before.data() as { status?: string } | undefined;
  const after = event.data?.after.data() as
    | { status?: string; tenantId?: string; createdBy?: string; updatedBy?: string; amenity?: string }
    | undefined;
  if (!after?.tenantId || !after?.createdBy) return;
  if (before?.status === after.status) return;

  if (after.status === "approved") {
    await createNotifications([
      {
        userId: after.createdBy,
        tenantId: after.tenantId,
        type: "reservation",
        title: "Reserva aprobada",
        description: `Tu reserva de ${after.amenity ?? "amenidad"} fue aprobada.`,
        link: "/resident/reservations",
      },
    ]);
    return;
  }

  // Rechazo por la administración: cancelled/rejected hecho por alguien distinto al
  // creador (evita falsos positivos cuando el residente cancela su propia reserva).
  if (
    (after.status === "cancelled" || after.status === "rejected") &&
    after.updatedBy &&
    after.updatedBy !== after.createdBy
  ) {
    const [override, conjunto] = await Promise.all([
      getTenantNotificationOverride(after.tenantId, "reservation_rejected"),
      getTenantName(after.tenantId),
    ]);
    await deliverResidentNotifications(
      "reservation_rejected",
      after.tenantId,
      [after.createdBy],
      { amenidad: after.amenity ?? "", conjunto },
      override,
    );
  }
});

// Notifica a los residentes en alcance cuando un acuerdo de comité se manda a
// firma / se publica (transición a "enviado").
export const onCommitteeAgreementUpdated = onDocumentUpdated({ document: "committee_agreements/{agreementId}", secrets: [resendApiKey] }, async (event) => {
  const before = event.data?.before.data() as { status?: string } | undefined;
  const after = event.data?.after.data() as
    | {
        status?: string;
        tenantId?: string;
        sessionDate?: string;
        signatureMode?: string;
        signerScope?: string;
        signerUnitIds?: string[];
      }
    | undefined;
  if (!after?.tenantId) return;
  // Solo al transicionar a "enviado" (no en otras actualizaciones).
  if (before?.status === "enviado" || after.status !== "enviado") return;

  const tenantId = after.tenantId;
  const isInformativo = after.signatureMode === "informativo";

  let residentUids: string[];
  if (after.signerScope === "selected" && Array.isArray(after.signerUnitIds) && after.signerUnitIds.length > 0) {
    const lists = await Promise.all(after.signerUnitIds.map((unitId) => listResidentUidsByUnit(tenantId, unitId)));
    residentUids = Array.from(new Set(lists.flat()));
  } else {
    residentUids = await listTenantUidsByRoles(tenantId, ["resident"]);
  }

  const key: NotificationKey = isInformativo ? "agreement_info" : "agreement_signature";
  const [override, conjunto] = await Promise.all([
    getTenantNotificationOverride(tenantId, key),
    getTenantName(tenantId),
  ]);
  await deliverResidentNotifications(key, tenantId, residentUids, { fecha: after.sessionDate ?? "", conjunto }, override);
});

export const onVisitorPassCreated = onDocumentCreated("visitorPasses/{visitorPassId}", async (event) => {
  const data = event.data?.data() as { tenantId?: string; visitorName?: string; date?: string; unitLabel?: string } | undefined;
  if (!data?.tenantId) return;

  const guardUids = await listTenantUidsByRoles(data.tenantId, ["security_guard", "security"]);

  const notifications: NotificationInput[] = [
    ...guardUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "visitor" as const,
      title: "Nuevo visitante registrado",
      description: `${data.visitorName ?? "Visitante"} ${data.unitLabel ? `para ${data.unitLabel}` : ""}`.trim(),
      link: "/guard/visitors",
    })),
  ];

  if (isTodayDateString(data.date)) {
    notifications.push(
      ...guardUids.map((uid) => ({
        userId: uid,
        tenantId: data.tenantId,
        type: "visitor" as const,
        title: "Visitante programado para hoy",
        description: `${data.visitorName ?? "Visitante"} tiene ingreso programado hoy.`,
        link: "/guard/visitors",
      })),
    );
  }

  await createNotifications(notifications);
});

export const onTicketCreated = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const data = event.data?.data() as { tenantId?: string; subject?: string } | undefined;
  if (!data?.tenantId) return;

  const adminUids = await listTenantUidsByRoles(data.tenantId, ["tenant_admin"]);
  const superadminUids = await listSuperadminUids();

  await createNotifications([
    ...adminUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "ticket" as const,
      title: "Nuevo PQRS recibido",
      description: data.subject?.trim() || "Se registro un nuevo ticket.",
      link: "/admin/pqrs",
    })),
    ...superadminUids.map((uid) => ({
      userId: uid,
      type: "ticket" as const,
      title: "Nuevo PQRS en tenant",
      description: `Tenant ${data.tenantId} registro un nuevo PQRS.`,
      link: "/superadmin/analytics",
    })),
  ]);
});

// PQRS respondido: notifica al residente la primera vez que la administración responde.
export const onTicketUpdated = onDocumentUpdated({ document: "tickets/{ticketId}", secrets: [resendApiKey] }, async (event) => {
  const before = event.data?.before.data() as { status?: string; response?: string } | undefined;
  const after = event.data?.after.data() as
    | { status?: string; response?: string; tenantId?: string; residentId?: string; subject?: string }
    | undefined;
  if (!after?.tenantId || !after?.residentId) return;

  const wasAnswered = before?.status === "responded" || before?.status === "resolved" || Boolean(before?.response);
  const isAnswered = after.status === "responded" || after.status === "resolved" || Boolean(after.response);
  if (wasAnswered || !isAnswered) return; // solo la primera vez que se responde.

  const [override, conjunto] = await Promise.all([
    getTenantNotificationOverride(after.tenantId, "ticket_answered"),
    getTenantName(after.tenantId),
  ]);
  await deliverResidentNotifications(
    "ticket_answered",
    after.tenantId,
    [after.residentId],
    { asunto: after.subject ?? "", conjunto },
    override,
  );
});

// ── F2 · Notificaciones de cartera al residente ───────────────────────────────

const BILLING_CONCEPT_LABELS: Record<string, string> = {
  administracion: "Mantenimiento y Administración",
  extraordinaria: "Cuota extraordinaria",
  multa: "Multa / sanción",
  reparacion: "Reparación / daño",
  interes_mora: "Interés de mora",
  parqueadero: "Parqueadero / amenidad",
  vigilancia: "Vigilancia / seguridad",
  otro: "Otro",
};

// Cobro nuevo individual. Los cobros de una importación masiva (source="import")
// se agrupan en un solo aviso vía el callable notifyBillingBatch.
export const onBillingStatementCreated = onDocumentCreated({ document: "billingStatements/{statementId}", secrets: [resendApiKey] }, async (event) => {
  const data = event.data?.data() as
    | {
        tenantId?: string;
        unitId?: string;
        unitLabel?: string;
        period?: string;
        concept?: string;
        amount?: number;
        balance?: number;
        source?: string;
      }
    | undefined;
  if (!data?.tenantId || !data?.unitId) return;
  if (data.source === "import") return; // el lote lo agrupa el callable.
  if ((data.balance ?? 0) <= 0) return; // sin saldo por cobrar, no se notifica.

  const residentUids = await listResidentUidsByUnit(data.tenantId, data.unitId);
  if (residentUids.length === 0) return;

  const [override, conjunto] = await Promise.all([
    getTenantNotificationOverride(data.tenantId, "billing_new"),
    getTenantName(data.tenantId),
  ]);
  const vars = {
    período: data.period ?? "",
    concepto: BILLING_CONCEPT_LABELS[data.concept ?? "administracion"] ?? "Mantenimiento y Administración",
    monto: formatMoney(data.amount ?? data.balance ?? 0),
    unidad: data.unitLabel ?? "",
    conjunto,
  };
  await deliverResidentNotifications("billing_new", data.tenantId, residentUids, vars, override);
});

// Recordatorio de paquete en bodega: el admin reenvía el aviso in-app al
// residente desde el módulo de Paquetería (VIV-901).
export const remindPackagePickup = onCall<{ tenantId: string; packageId: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    const tenantId = request.data?.tenantId;
    const packageId = request.data?.packageId;
    if (!tenantId || !packageId) {
      throw new HttpsError("invalid-argument", "tenantId y packageId son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });

    const snap = await db.collection("packages").doc(packageId).get();
    const data = snap.data() as { tenantId?: string; unitId?: string; unitLabel?: string; status?: string } | undefined;
    if (!snap.exists || data?.tenantId !== tenantId) {
      throw new HttpsError("not-found", "Paquete no encontrado.");
    }
    if ((data?.status ?? "pending") !== "pending") {
      throw new HttpsError("failed-precondition", "El paquete ya fue entregado.");
    }

    const residentUids = await listResidentUidsByUnit(tenantId, data?.unitId ?? "");
    if (residentUids.length === 0) return { ok: true, notified: 0 };

    await createNotifications(
      residentUids.map((uid) => ({
        userId: uid,
        tenantId,
        type: "package" as const,
        title: "Recordatorio: paquete en portería",
        description: `Tienes un paquete pendiente de recoger${data?.unitLabel ? ` (${data.unitLabel})` : ""}.`,
        link: "/resident/packages",
      })),
    );
    return { ok: true, notified: residentUids.length };
  },
);

// Aviso agrupado tras una importación masiva de cartera: 1 notificación por
// residente de las unidades afectadas (lo invoca el front al terminar el import).
export const notifyBillingBatch = onCall<{ tenantId: string; period: string; unitIds: string[] }>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    const tenantId = request.data?.tenantId;
    const period = request.data?.period ?? "";
    const unitIds = request.data?.unitIds ?? [];
    if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0) {
      throw new HttpsError("invalid-argument", "tenantId y unitIds son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    await assertFinanceManagementEnabled(tenantId);
    // Durante la prueba, Cartera es solo vista previa: se ve, no se opera.
    await assertModuleAllowed(tenantId, "billing");

    const [override, conjunto] = await Promise.all([
      getTenantNotificationOverride(tenantId, "billing_batch"),
      getTenantName(tenantId),
    ]);
    const lists = await Promise.all(unitIds.map((unitId) => listResidentUidsByUnit(tenantId, unitId)));
    const residentUids = Array.from(new Set(lists.flat()));
    if (residentUids.length === 0) return { ok: true, notified: 0 };

    await deliverResidentNotifications("billing_batch", tenantId, residentUids, { período: period, conjunto }, override);
    return { ok: true, notified: residentUids.length };
  },
);

// Recordatorio de pago: reenvía un aviso a los residentes de las unidades indicadas
// (una unidad o todas las morosas). Lo dispara el admin manualmente.
export const sendBillingReminder = onCall<{ tenantId: string; unitIds: string[] }>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    const tenantId = request.data?.tenantId;
    const unitIds = request.data?.unitIds ?? [];
    if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0) {
      throw new HttpsError("invalid-argument", "tenantId y unitIds son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    await assertFinanceManagementEnabled(tenantId);
    // Durante la prueba, Cartera es solo vista previa: se ve, no se opera.
    await assertModuleAllowed(tenantId, "billing");

    const [override, conjunto] = await Promise.all([
      getTenantNotificationOverride(tenantId, "billing_reminder"),
      getTenantName(tenantId),
    ]);
    const lists = await Promise.all(unitIds.map((unitId) => listResidentUidsByUnit(tenantId, unitId)));
    const residentUids = Array.from(new Set(lists.flat()));
    const unitsWithoutRecipient = lists.filter((l) => l.length === 0).length;
    if (residentUids.length === 0) {
      return { ok: true, notified: 0, units: unitIds.length, unitsWithoutRecipient };
    }

    await deliverResidentNotifications("billing_reminder", tenantId, residentUids, { conjunto }, override);
    return { ok: true, notified: residentUids.length, units: unitIds.length, unitsWithoutRecipient };
  },
);

// Recordatorios programados: al dispararse, RECALCULA los pendientes de la campaña en ese
// momento y los notifica (no congela la lista al programar).
export const sendScheduledReminders = onSchedule({ schedule: "0 9 * * *", secrets: [resendApiKey] }, async () => {
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const snap = await db.collection("billingReminderJobs").where("status", "==", "scheduled").get();
  for (const docSnap of snap.docs) {
    const job = docSnap.data() as { tenantId?: string; campaignId?: string | null; scheduledFor?: string };
    if (!job.tenantId || !job.scheduledFor || job.scheduledFor > today) continue;

    // Pendientes actuales de la campaña.
    let pendingStmts: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    if (job.campaignId) {
      const s = await db
        .collection("billingStatements")
        .where("tenantId", "==", job.tenantId)
        .where("campaignId", "==", job.campaignId)
        .get();
      pendingStmts = s.docs.filter((d) => ((d.data() as { balance?: number }).balance ?? 0) > 0);
    }
    const unitIds = Array.from(
      new Set(pendingStmts.map((d) => (d.data() as { unitId?: string }).unitId).filter(Boolean) as string[]),
    );

    if (unitIds.length > 0) {
      const lists = await Promise.all(unitIds.map((u) => listResidentUidsByUnit(job.tenantId as string, u)));
      const residentUids = Array.from(new Set(lists.flat()));
      if (residentUids.length > 0) {
        const [override, conjunto] = await Promise.all([
          getTenantNotificationOverride(job.tenantId, "billing_reminder"),
          getTenantName(job.tenantId),
        ]);
        await deliverResidentNotifications("billing_reminder", job.tenantId, residentUids, { conjunto }, override);
        for (let i = 0; i < pendingStmts.length; i += 400) {
          const batch = db.batch();
          for (const d of pendingStmts.slice(i, i + 400)) batch.update(d.ref, { reminderCount: FieldValue.increment(1) });
          await batch.commit();
        }
      }
    }
    await docSnap.ref.update({ status: "sent", sentAt: Timestamp.now(), notifiedUnits: unitIds.length });
  }
});

// Colecciones que referencian una unidad por su doc id (campo a re-apuntar al fusionar).
const UNIT_REF_FIELDS: { collection: string; field: string }[] = [
  { collection: "people", field: "unitId" },
  { collection: "billingStatements", field: "unitId" },
  { collection: "paymentReceipts", field: "unitId" },
  { collection: "reservations", field: "unitId" },
  { collection: "tickets", field: "unitId" },
  { collection: "visitorAuthorizations", field: "unitId" },
  { collection: "visitorPasses", field: "unitId" },
  { collection: "services", field: "unitId" },
  { collection: "paymentVouchers", field: "payerUnitId" },
];

// Fusiona unidades duplicadas (mismo nombre, distinto doc): re-apunta TODAS las referencias
// de las duplicadas a la superviviente y borra las duplicadas. Server-side por atomicidad y
// porque tenantUsers es de escritura restringida en reglas.
export const mergeUnits = onCall<{ tenantId: string; survivorId: string; duplicateIds: string[] }>(
  { cors: callableCorsOrigins },
  async (request) => {
    const tenantId = normalizeText(request.data?.tenantId);
    const survivorId = normalizeText(request.data?.survivorId);
    const duplicateIds = (request.data?.duplicateIds ?? []).map((x) => normalizeText(x)).filter(Boolean);
    if (!tenantId || !survivorId || duplicateIds.length === 0) {
      throw new HttpsError("invalid-argument", "tenantId, survivorId y duplicateIds son requeridos.");
    }
    if (duplicateIds.includes(survivorId)) {
      throw new HttpsError("invalid-argument", "La unidad que se conserva no puede estar en las duplicadas.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });

    const survivorSnap = await db.collection("units").doc(survivorId).get();
    if (!survivorSnap.exists || (survivorSnap.data() as { tenantId?: string }).tenantId !== tenantId) {
      throw new HttpsError("not-found", "La unidad que se conserva no existe en este conjunto.");
    }
    const dupSnaps = await Promise.all(duplicateIds.map((id) => db.collection("units").doc(id).get()));
    for (const ds of dupSnaps) {
      if (!ds.exists || (ds.data() as { tenantId?: string }).tenantId !== tenantId) {
        throw new HttpsError("not-found", "Una de las unidades duplicadas no existe en este conjunto.");
      }
    }

    let repointed = 0;

    for (const dupId of duplicateIds) {
      // Referencias simples (colección/campo).
      for (const { collection, field } of UNIT_REF_FIELDS) {
        const snap = await db.collection(collection).where("tenantId", "==", tenantId).where(field, "==", dupId).get();
        let batch = db.batch();
        let n = 0;
        for (const d of snap.docs) {
          batch.update(d.ref, { [field]: survivorId });
          repointed++;
          if (++n >= 400) { await batch.commit(); batch = db.batch(); n = 0; }
        }
        if (n > 0) await batch.commit();
      }
      // tenantUsers + su perfil en users/{uid}.
      const tuSnap = await db.collection("tenantUsers").where("tenantId", "==", tenantId).where("unitId", "==", dupId).get();
      let tuBatch = db.batch();
      let tn = 0;
      for (const d of tuSnap.docs) {
        tuBatch.update(d.ref, { unitId: survivorId });
        const uid = (d.data() as { uid?: string }).uid;
        if (uid) tuBatch.set(db.collection("users").doc(uid), { unitId: survivorId }, { merge: true });
        repointed++;
        tn += 2;
        if (tn >= 400) { await tuBatch.commit(); tuBatch = db.batch(); tn = 0; }
      }
      if (tn > 0) await tuBatch.commit();
    }

    // billingSchedules.targets[] (arrays): re-mapear y deduplicar.
    const schedSnap = await db.collection("billingSchedules").where("tenantId", "==", tenantId).where("status", "==", "scheduled").get();
    for (const d of schedSnap.docs) {
      const targets = (d.data() as { targets?: { unitId: string; unitLabel: string }[] }).targets ?? [];
      if (!targets.some((t) => duplicateIds.includes(t.unitId))) continue;
      const seen = new Set<string>();
      const remapped: { unitId: string; unitLabel: string }[] = [];
      for (const t of targets) {
        const id = duplicateIds.includes(t.unitId) ? survivorId : t.unitId;
        if (seen.has(id)) continue;
        seen.add(id);
        remapped.push({ ...t, unitId: id });
      }
      await d.ref.update({ targets: remapped });
    }

    // Fusionar listas de personas en la superviviente y borrar las duplicadas.
    const sData = survivorSnap.data() as { ownerIds?: string[]; residentIds?: string[] };
    const owners = new Set(sData.ownerIds ?? []);
    const residents = new Set(sData.residentIds ?? []);
    for (const ds of dupSnaps) {
      const dd = ds.data() as { ownerIds?: string[]; residentIds?: string[] };
      (dd.ownerIds ?? []).forEach((x) => owners.add(x));
      (dd.residentIds ?? []).forEach((x) => residents.add(x));
    }
    await db.collection("units").doc(survivorId).update({
      ownerIds: Array.from(owners),
      residentIds: Array.from(residents),
      updatedAt: Timestamp.now(),
    });
    const delBatch = db.batch();
    for (const id of duplicateIds) delBatch.delete(db.collection("units").doc(id));
    await delBatch.commit();

    await writeAuditLog(tenantId, request.auth?.uid, "units.merge", { survivorId, duplicateIds, repointed });

    return { ok: true, merged: duplicateIds.length, repointed };
  },
);

// Notifica al residente el resultado de la revisión de su comprobante: aceptado con
// ajuste de monto, o no aceptado (con motivo). Lo dispara el admin desde la revisión.
export const notifyResidentReceipt = onCall<{
  tenantId: string;
  unitId: string;
  kind: "adjusted" | "rejected";
  amount?: number;
  reason?: string;
}>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const unitId = normalizeText(request.data?.unitId);
    const kind = request.data?.kind;
    if (!tenantId || !unitId || (kind !== "adjusted" && kind !== "rejected")) {
      throw new HttpsError("invalid-argument", "tenantId, unitId y kind son requeridos.");
    }
    await assertActiveTenantAdmin(tenantId, request.auth.uid);

    const residentUids = await listResidentUidsByUnit(tenantId, unitId);
    if (residentUids.length === 0) return { ok: true, notified: 0 };
    const conjunto = await getTenantName(tenantId);

    if (kind === "adjusted") {
      const override = await getTenantNotificationOverride(tenantId, "payment_adjusted");
      await deliverResidentNotifications(
        "payment_adjusted",
        tenantId,
        residentUids,
        { monto: formatMoney(request.data?.amount ?? 0), conjunto },
        override,
      );
    } else {
      const override = await getTenantNotificationOverride(tenantId, "payment_rejected");
      await deliverResidentNotifications(
        "payment_rejected",
        tenantId,
        residentUids,
        { motivo: normalizeText(request.data?.reason) || "el monto no coincide con el comprobante", conjunto },
        override,
      );
    }
    return { ok: true, notified: residentUids.length };
  },
);

// Runs every day at 07:00 UTC (02:00 Colombia)
// Publica los cobros programados cuya fecha llegó: crea los billingStatements por unidad
// y notifica (agrupado si es lote, individual vía trigger si es una sola unidad).
export const publishScheduledCharges = onSchedule({ schedule: "0 8 * * *", secrets: [resendApiKey] }, async () => {
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const snap = await db.collection("billingSchedules").where("status", "==", "scheduled").get();
  for (const docSnap of snap.docs) {
    const s = docSnap.data() as {
      tenantId?: string;
      concept?: string;
      amount?: number;
      period?: string;
      dueDate?: string | null;
      scheduledFor?: string;
      isBatch?: boolean;
      targets?: { unitId: string; unitLabel: string }[];
      createdBy?: string;
    };
    if (!s.tenantId || !s.scheduledFor || s.scheduledFor > today) continue;

    const targets = (s.targets ?? []).filter((t) => t && t.unitId);
    if (targets.length === 0) {
      await docSnap.ref.update({ status: "published", publishedAt: Timestamp.now() });
      continue;
    }

    const amount = s.amount ?? 0;
    const period = s.period ?? today.slice(0, 7);
    const dueDate = s.dueDate ?? null;
    const status = amount <= 0 ? "paid" : dueDate && dueDate < today ? "overdue" : "pending";
    const isBatch = Boolean(s.isBatch) && targets.length > 1;
    const source = isBatch ? "import" : "manual";
    const actor = s.createdBy ?? "system";

    const batch = db.batch();
    // Lote programado → crea la campaña y liga los cobros (C1).
    let campaignId: string | null = null;
    if (isBatch) {
      const campRef = db.collection("billingCampaigns").doc();
      campaignId = campRef.id;
      batch.set(campRef, {
        tenantId: s.tenantId,
        concept: s.concept ?? "administracion",
        period,
        unitAmount: amount,
        dueDate,
        source: "scheduled",
        unitCount: targets.length,
        sentAt: Timestamp.now(),
        status: "vigente",
        createdBy: actor,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    for (const t of targets) {
      const ref = db.collection("billingStatements").doc();
      batch.set(ref, {
        tenantId: s.tenantId,
        unitId: t.unitId,
        unitLabel: t.unitLabel,
        period,
        concept: s.concept ?? "administracion",
        // §7.2 — la cuenta del cargo, resuelta al generarlo. Este es uno de los
        // CUATRO sitios que crean cargos; los otros son el alta manual del front,
        // el reparto por coeficiente y la semilla del trial. Que fueran cuatro y
        // no uno es lo que hacía falta contar antes de escribir nada.
        accountCode: cuentaParaConcepto(s.concept).code,
        campaignId,
        amount,
        paymentAmount: 0,
        balance: amount,
        dueDate,
        source,
        status,
        lastPaymentAt: null,
        createdBy: actor,
        updatedBy: actor,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    await batch.commit();

    // Lote: aviso agrupado. Individual (source "manual"): lo notifica onBillingStatementCreated.
    if (isBatch && amount > 0) {
      const lists = await Promise.all(targets.map((t) => listResidentUidsByUnit(s.tenantId as string, t.unitId)));
      const residentUids = Array.from(new Set(lists.flat()));
      if (residentUids.length > 0) {
        const [override, conjunto] = await Promise.all([
          getTenantNotificationOverride(s.tenantId, "billing_batch"),
          getTenantName(s.tenantId),
        ]);
        await deliverResidentNotifications("billing_batch", s.tenantId, residentUids, { período: period, conjunto }, override);
      }
    }

    await docSnap.ref.update({ status: "published", publishedAt: Timestamp.now() });
  }
});

export const updateOverdueStatements = onSchedule({ schedule: "0 7 * * *", secrets: [resendApiKey] }, async () => {
  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const snapshot = await db
    .collection("billingStatements")
    .where("status", "==", "pending")
    .where("dueDate", "<=", todayStr)
    .get();

  if (snapshot.empty) {
    console.log("[updateOverdueStatements] No pending overdue statements found.");
    return;
  }

  const BATCH_SIZE = 500;
  const docs = snapshot.docs;
  let updated = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.update(doc.ref, { status: "overdue" });
    }
    await batch.commit();
    updated += chunk.length;
  }

  // Notifica la mora a los residentes afectados, agrupado por tenant (dedup unidad).
  const overdueByTenant = new Map<string, Map<string, string>>(); // tenantId -> (unitId -> unitLabel)
  for (const doc of docs) {
    const d = doc.data() as { tenantId?: string; unitId?: string; unitLabel?: string };
    if (!d.tenantId || !d.unitId) continue;
    const units = overdueByTenant.get(d.tenantId) ?? new Map<string, string>();
    units.set(d.unitId, d.unitLabel ?? "");
    overdueByTenant.set(d.tenantId, units);
  }
  for (const [tenantId, units] of overdueByTenant) {
    const [override, conjunto] = await Promise.all([
      getTenantNotificationOverride(tenantId, "billing_overdue"),
      getTenantName(tenantId),
    ]);
    for (const [unitId, unitLabel] of units) {
      const residentUids = await listResidentUidsByUnit(tenantId, unitId);
      await deliverResidentNotifications("billing_overdue", tenantId, residentUids, { unidad: unitLabel, conjunto }, override);
    }
  }

  console.log(`[updateOverdueStatements] Marked ${updated} statement(s) as overdue.`);
});

// ── F2/G1 · Transmisión del comprobante de alícuota al SRI (Ecuador) ──────────
// Dispara al crear un comprobante de emisor Ecuador en estado "pending".
// El transporte real (firma + endpoint SRI) se implementa en G3; aquí usa stub.
export const onPaymentVoucherCreated = onDocumentCreated({ document: "paymentVouchers/{voucherId}", secrets: [resendApiKey] }, async (event) => {
  const data = event.data?.data();
  if (!data) return;

  // Recibo disponible: notifica al residente de la unidad pagadora (cualquier país).
  if (data.tenantId && data.payerUnitId) {
    const residentUids = await listResidentUidsByUnit(data.tenantId, data.payerUnitId);
    if (residentUids.length > 0) {
      const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(data.tenantId, "billing_receipt"),
        getTenantName(data.tenantId),
      ]);
      await deliverResidentNotifications(
        "billing_receipt",
        data.tenantId,
        residentUids,
        { período: formatPeriodFromDate(data.issueDate), conjunto },
        override,
      );
    }
  }
});

// ── F4 · Notificaciones de publicaciones del admin ────────────────────────────

// Reglamento nuevo: al subir un documento de categoría "reglamento" (el flujo de
// carga lo deja activo), notifica a todos los residentes para que lo firmen.
export const onRegulationDocumentCreated = onDocumentCreated({ document: "documents/{documentId}", secrets: [resendApiKey] }, async (event) => {
  const data = event.data?.data() as { tenantId?: string; category?: string } | undefined;
  if (!data?.tenantId || data.category !== "reglamento") return;

  const residentUids = await listTenantUidsByRoles(data.tenantId, ["resident"]);
  if (residentUids.length === 0) return;

  const [override, conjunto] = await Promise.all([
    getTenantNotificationOverride(data.tenantId, "regulation_new"),
    getTenantName(data.tenantId),
  ]);
  await deliverResidentNotifications("regulation_new", data.tenantId, residentUids, { conjunto }, override);
});

// Encuesta nueva: las encuestas se crean en borrador y se publican por update;
// notifica a los residentes al transicionar a "published". (El portal del
// residente filtra la visibilidad por audiencia; aquí avisamos a todos.)
export const onSurveyUpdated = onDocumentUpdated({ document: "surveys/{surveyId}", secrets: [resendApiKey] }, async (event) => {
  const before = event.data?.before.data() as { status?: string } | undefined;
  const after = event.data?.after.data() as { status?: string; tenantId?: string } | undefined;
  if (!after?.tenantId) return;
  if (before?.status === "published" || after.status !== "published") return;

  const residentUids = await listTenantUidsByRoles(after.tenantId, ["resident"]);
  if (residentUids.length === 0) return;

  const [override, conjunto] = await Promise.all([
    getTenantNotificationOverride(after.tenantId, "survey_new"),
    getTenantName(after.tenantId),
  ]);
  await deliverResidentNotifications("survey_new", after.tenantId, residentUids, { conjunto }, override);
});


// ── P4 · Archivo mensual automático: reporte de comité + histórico de cartera ──

const ARCHIVE_PATH: Record<string, string> = {
  cartera_history: "cartera-history",
  committee_reports: "committee-reports",
};

// Sube un buffer a Storage (con token de descarga) y lo registra en la carpeta de sistema.
async function archiveBuffer(input: {
  tenantId: string;
  systemKey: "cartera_history" | "committee_reports";
  fileName: string;
  ext: string;
  contentType: string;
  buffer: Buffer;
  description: string;
  source: string;
  sourceId: string;
  category: string;
}): Promise<void> {
  const token = randomUUID();
  const path = `tenants/${input.tenantId}/${ARCHIVE_PATH[input.systemKey]}/${input.sourceId}-${Date.now()}.${input.ext}`;
  const bucket = getStorage().bucket();
  await bucket.file(path).save(input.buffer, { metadata: { contentType: input.contentType, metadata: { firebaseStorageDownloadTokens: token } } });
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;

  const folderId = await ensureSystemFolderImpl(input.tenantId, "system", input.systemKey);
  await db.collection("documents").add({
    tenantId: input.tenantId,
    fileName: input.fileName,
    description: input.description,
    fileUrl,
    storagePath: path,
    uploadedBy: "system",
    uploadedByName: "Automático",
    category: input.category,
    folderId,
    fileSize: input.buffer.length,
    contentType: input.contentType,
    source: input.source,
    sourceId: input.sourceId,
    createdBy: "system",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

// Construye un .xlsx server-side y lo archiva.
async function archiveXlsx(input: {
  tenantId: string;
  systemKey: "cartera_history" | "committee_reports";
  fileName: string;
  sheets: { name: string; rows: (string | number)[][] }[];
  description: string;
  source: string;
  sourceId: string;
  category: string;
}): Promise<void> {
  const wb = XLSX.utils.book_new();
  for (const s of input.sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
  }
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
  await archiveBuffer({
    ...input, ext: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
}

// Construye un PDF simple (texto) a partir de pares etiqueta/valor.
function buildSummaryPdf(title: string, subtitle: string, rows: [string, string][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docpdf = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];
    docpdf.on("data", (c: Buffer) => chunks.push(c));
    docpdf.on("end", () => resolve(Buffer.concat(chunks)));
    docpdf.on("error", reject);
    docpdf.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text(title);
    docpdf.moveDown(0.3);
    docpdf.font("Helvetica").fontSize(11).fillColor("#475569").text(subtitle);
    docpdf.moveDown(1);
    for (const [label, value] of rows) {
      const y = docpdf.y;
      docpdf.font("Helvetica").fontSize(10).fillColor("#475569").text(label, 48, y);
      docpdf.font("Helvetica-Bold").fillColor("#0f172a").text(value, 48, y, { align: "right" });
      docpdf.moveDown(0.4);
    }
    docpdf.end();
  });
}

// Día 1 de cada mes (06:00 UTC): por cada conjunto, archiva el histórico de cartera y el
// resumen mensual del comité (núcleo financiero) en sus carpetas de sistema.
export const monthlyFinancialArchive = onSchedule({ schedule: "0 6 1 * *", timeoutSeconds: 540, memory: "512MiB" }, async () => {
  const now = new Date();
  const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const stamp = now.toISOString().slice(0, 10);

  const tenants = await db.collection("tenants").get();
  for (const tDoc of tenants.docs) {
    const tenantId = tDoc.id;
    const status = (tDoc.data() as { status?: string }).status;
    if (status && status !== "active" && status !== "trial") continue;

    try {
    const bsSnap = await db.collection("billingStatements").where("tenantId", "==", tenantId).get();
    if (bsSnap.empty) continue;
    const stmts = bsSnap.docs.map((d) => d.data() as { period?: string; amount?: number; paymentAmount?: number; balance?: number; status?: string; unitId?: string; unitLabel?: string });

    // ── Histórico de cartera (recaudo por período + morosos) ──
    const byPeriod = new Map<string, { f: number; r: number; p: number }>();
    for (const s of stmts) {
      const k = s.period ?? "";
      if (!k) continue;
      const e = byPeriod.get(k) ?? { f: 0, r: 0, p: 0 };
      e.f += s.amount ?? 0; e.r += s.paymentAmount ?? 0; e.p += s.balance ?? 0;
      byPeriod.set(k, e);
    }
    const periodRows = Array.from(byPeriod.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, v]) => [k, v.f, v.r, v.f > 0 ? `${Math.round((v.r / v.f) * 100)}%` : "0%", v.p]);
    const byUnit = new Map<string, { label: string; deuda: number; periodos: Set<string> }>();
    for (const s of stmts) {
      if ((s.balance ?? 0) <= 0) continue;
      const id = s.unitId ?? "";
      const e = byUnit.get(id) ?? { label: s.unitLabel ?? id, deuda: 0, periodos: new Set<string>() };
      e.deuda += s.balance ?? 0; if (s.period) e.periodos.add(s.period);
      byUnit.set(id, e);
    }
    const morososRows = Array.from(byUnit.values()).sort((a, b) => b.deuda - a.deuda).map((m) => [m.label, m.deuda, m.periodos.size]);
    await archiveXlsx({
      tenantId, systemKey: "cartera_history", fileName: `Historico-cartera-${stamp}.xlsx`,
      sheets: [
        { name: "Recaudo por período", rows: [["Período", "Facturado (esperado)", "Recaudado", "% recaudo", "Pendiente"], ...periodRows] },
        { name: "Morosos", rows: [["Unidad", "Deuda total", "# períodos"], ...morososRows] },
      ],
      description: `Histórico de cartera al ${stamp} (automático)`, source: "cartera_history", sourceId: stamp, category: "financiero",
    });

    // ── Reporte de comité: resumen financiero del mes anterior ──
    const bsMonth = stmts.filter((s) => s.period === prevMonth);
    const facturado = bsMonth.reduce((a, s) => a + (s.amount ?? 0), 0);
    const recaudado = bsMonth.reduce((a, s) => a + (s.paymentAmount ?? 0), 0);
    const billedAll = stmts.reduce((a, s) => a + (s.amount ?? 0), 0);
    const overdueAmt = stmts.filter((s) => s.status === "overdue").reduce((a, s) => a + (s.balance ?? 0), 0);
    const ledSnap = await db.collection("ledgerEntries").where("tenantId", "==", tenantId).get();
    const monthLed = ledSnap.docs.map((d) => d.data() as { type?: string; category?: string; sourceType?: string; reversedSourceType?: string; date?: string; amount?: number }).filter((e) => (e.date ?? "").slice(0, 7) === prevMonth);
    // R12/R13: se descuenta por ORIGEN, no por categoría. Hasta el 23 de agosto
    // de 2026 esto preguntaba `category !== "alicuota"` y **contaba dos veces**
    // todo cargo que no fuera la cuota: `recaudado` ya lo trae de Cartera. Ver
    // `esRecaudoDeCartera` en `payments.ts`, que es su espejo de `src/`.
    const ingresosOtros = monthLed.filter((e) => e.type === "ingreso" && !esRecaudoDeCartera(e)).reduce((a, e) => a + (e.amount ?? 0), 0);
    const egresos = monthLed.filter((e) => e.type === "egreso").reduce((a, e) => a + (e.amount ?? 0), 0);
    const ingresos = recaudado + ingresosOtros;
    await archiveXlsx({
      tenantId, systemKey: "committee_reports", fileName: `Reporte-Comite-${prevMonth}.xlsx`,
      sheets: [{ name: "Resumen", rows: [
        ["Reporte de comité — Resumen mensual (automático)", prevMonth],
        [],
        ["Facturado del mes", facturado],
        ["Recaudado del mes", recaudado],
        ["% de recaudo", facturado > 0 ? `${Math.round((recaudado / facturado) * 100)}%` : "0%"],
        ["Índice de morosidad (monto, acum.)", billedAll > 0 ? `${Math.round((overdueAmt / billedAll) * 100)}%` : "0%"],
        ["Ingresos del mes", ingresos],
        ["Egresos del mes", egresos],
        ["Resultado neto del mes", ingresos - egresos],
      ] }],
      description: `Reporte de comité ${prevMonth} (automático, resumen financiero)`, source: "committee_report", sourceId: prevMonth, category: "reporte",
    });

    // Mismo resumen como PDF.
    await archiveBuffer({
      tenantId, systemKey: "committee_reports", fileName: `Reporte-Comite-${prevMonth}.pdf`,
      ext: "pdf", contentType: "application/pdf",
      buffer: await buildSummaryPdf("Reporte de comité — Resumen mensual", `${prevMonth} · generado automáticamente`, [
        ["Facturado del mes", formatMoney(facturado)],
        ["Recaudado del mes", formatMoney(recaudado)],
        ["% de recaudo", facturado > 0 ? `${Math.round((recaudado / facturado) * 100)}%` : "0%"],
        ["Índice de morosidad (monto, acum.)", billedAll > 0 ? `${Math.round((overdueAmt / billedAll) * 100)}%` : "0%"],
        ["Ingresos del mes", formatMoney(ingresos)],
        ["Egresos del mes", formatMoney(egresos)],
        ["Resultado neto del mes", formatMoney(ingresos - egresos)],
      ]),
      description: `Reporte de comité ${prevMonth} (automático, resumen financiero)`, source: "committee_report", sourceId: prevMonth, category: "reporte",
    });
    } catch (e) {
      console.error(`[monthly-archive][${tenantId}]`, e);
    }
  }
  console.log(`[monthly-archive] Procesados ${tenants.size} tenant(s) para ${prevMonth}.`);
});

// ── F2/G4 · Retención: anonimiza datos sensibles de comprobantes vencidos ─────
// Corre a diario; respeta el período por conjunto (default 12 meses).
export const anonymizeExpiredVouchersDaily = onSchedule("every day 03:00", async () => {
  const count = await anonymizeExpiredVouchers(db);
  console.log(`[data-retention] Anonimizados ${count} comprobante(s).`);

  // Telemetría de IA vencida (12 meses, regla del Paso 0). Va en el mismo cron
  // porque es la misma tarea: cumplir las retenciones que están declaradas.
  const purgadas = await purgeExpiredAiUsage(db);
  console.log(`[data-retention] Purgadas ${purgadas} fila(s) de aiUsage.`);

  const feedback = await purgeExpiredAiFeedback(db);
  console.log(`[data-retention] Purgadas ${feedback} fila(s) de aiFeedback.`);
});

// ── G4 · Observabilidad: captura de errores no controlados del cliente ────────
// El front llama este callable (best-effort) ante un error no manejado. Escribe
// en errorLogs (solo lectura para superadmin). Degrada en silencio si falta el
// mensaje; nunca debe romper el flujo del usuario.
type LogClientErrorInput = {
  message?: string;
  stack?: string;
  context?: string;
  url?: string;
  severity?: "error" | "warning";
};

export const logClientError = onCall<LogClientErrorInput>(
  { cors: callableCorsOrigins },
  async (request) => {
    const message = normalizeText(request.data?.message).slice(0, 2000);
    if (!message) return { ok: false };

    const severity = request.data?.severity === "warning" ? "warning" : "error";
    await db.collection("errorLogs").add({
      message,
      stack: normalizeText(request.data?.stack).slice(0, 8000) || null,
      context: normalizeText(request.data?.context).slice(0, 500) || null,
      url: normalizeText(request.data?.url).slice(0, 500) || null,
      severity,
      uid: request.auth?.uid ?? null,
      tenantId: normalizeText(request.auth?.token?.tenantId) || null,
      role: normalizeText(request.auth?.token?.role) || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true };
  },
);

// ── Onboarding por invitación (Opción B) ──────────────────────────────────────
// Público (sin auth): la página /activar los llama antes de tener sesión.

// Valida el token SIN consumirlo (GET de la página). Devuelve el estado para
// pintar el formulario o el mensaje de invitación inválida/expirada/usada.
export const getAccountInvite = onCall<{ token?: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    const token = normalizeText(request.data?.token);
    if (!token) return { status: "invalid" as const };
    const snap = await db.collection("accountInvites").doc(token).get();
    if (!snap.exists) return { status: "invalid" as const };
    const data = snap.data() as { email?: string; fullName?: string; usedAt?: unknown; expiresAt?: Timestamp };
    if (data.usedAt) return { status: "used" as const };
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) return { status: "expired" as const };
    return { status: "valid" as const, email: data.email ?? "", fullName: data.fullName ?? "" };
  },
);

// Consume el token (transaccional, un solo uso) y fija la contraseña. Solo aquí
// se invalida la invitación, por eso un escáner que hace GET no la rompe.
export const activateAccount = onCall<{ token?: string; password?: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    const token = normalizeText(request.data?.token);
    const password = typeof request.data?.password === "string" ? request.data.password : "";
    if (!token) throw new HttpsError("invalid-argument", "Falta el token de activación.");
    assertStrongPassword(password, "contraseña");

    const ref = db.collection("accountInvites").doc(token);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError("not-found", "La invitación no existe.");
      const data = snap.data() as { uid?: string; usedAt?: unknown; expiresAt?: Timestamp };
      if (data.usedAt) throw new HttpsError("failed-precondition", "Esta invitación ya fue usada.");
      if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
        throw new HttpsError("failed-precondition", "La invitación expiró. Pide un nuevo enlace de acceso.");
      }
      if (!data.uid) throw new HttpsError("failed-precondition", "Invitación inválida.");
      tx.update(ref, { usedAt: Timestamp.now() });
      return { uid: data.uid };
    });

    await getAuth().updateUser(result.uid, { password });
    await db.collection("users").doc(result.uid).set(
      { onboardingStatus: "completed", mustChangePassword: false, updatedAt: Timestamp.now() },
      { merge: true },
    );
    return { ok: true as const };
  },
);

// Reenvía el acceso a un usuario operativo del mismo tenant (regenera invitación).
export const resendAccountInvite = onCall<{ tenantId?: string; uid?: string }>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    if (!tenantId || !targetUid) throw new HttpsError("invalid-argument", "tenantId y uid son requeridos.");

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const membershipSnap = await db.collection("tenantUsers").doc(`${actor.tenantId}_${targetUid}`).get();
    if (!membershipSnap.exists) throw new HttpsError("not-found", "El usuario no pertenece a este tenant.");
    const role = (membershipSnap.data() as { role?: string }).role ?? "security_guard";

    const userSnap = await db.collection("users").doc(targetUid).get();
    const userData = userSnap.data() as { email?: string; fullName?: string } | undefined;
    const authUser = await getAuth().getUser(targetUid).catch(() => null);
    const email = userData?.email ?? authUser?.email ?? "";
    const fullName = userData?.fullName ?? authUser?.displayName ?? "";
    if (!email) throw new HttpsError("failed-precondition", "El usuario no tiene correo registrado.");

    await sendOnboardingInvite(targetUid, email, fullName, actor.tenantId, role, "welcome");
    await writeAuditLog(actor.tenantId, request.auth.uid, "resend_account_invite", { uid: targetUid });
    return { ok: true as const };
  },
);

// ── Visitas sin salida registrada ─────────────────────────────────────────────
// Avisa a los guardias cuando una visita sigue "inside" y su fecha esperada de
// salida (validUntil para larga duración, date para puntual) ya pasó. Marca cada
// pase con exitAlertNotifiedAt para notificar una sola vez por pase (sin spam).
export const notifyPendingVisitorExits = onSchedule("0 8 * * *", async () => {
  const n = new Date();
  const todayStr = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;

  // Igualdad simple (sin índice compuesto); se filtra el resto en código.
  const snap = await db.collection("visitorPasses").where("status", "==", "inside").get();

  const byTenant = new Map<string, number>();
  const markBatch = db.batch();
  let pendingCount = 0;

  for (const doc of snap.docs) {
    const p = doc.data() as {
      tenantId?: string;
      authorizationType?: string;
      validUntil?: string;
      date?: string;
      exitAlertNotifiedAt?: unknown;
    };
    if (p.exitAlertNotifiedAt) continue; // ya avisado
    if (!p.tenantId) continue;
    const expected = p.authorizationType === "larga_duracion" && p.validUntil ? p.validUntil : p.date;
    if (!expected || expected >= todayStr) continue; // aún no vencida

    byTenant.set(p.tenantId, (byTenant.get(p.tenantId) ?? 0) + 1);
    markBatch.update(doc.ref, { exitAlertNotifiedAt: Timestamp.now() });
    pendingCount += 1;
  }

  if (pendingCount === 0) {
    console.log("[visitor-exits] sin visitas pendientes de salida.");
    return;
  }

  await markBatch.commit();

  for (const [tenantId, count] of byTenant) {
    const guardUids = await listTenantUidsByRoles(tenantId, ["security_guard", "security"]);
    if (guardUids.length === 0) continue;
    await createNotifications(
      guardUids.map((uid) => ({
        userId: uid,
        tenantId,
        type: "visitor" as const,
        title: "Visitas sin salida registrada",
        description: `${count} visita(s) siguen marcadas como “Dentro” y su fecha ya pasó. Revisa y registra la salida.`,
        link: "/guard/visitors",
      })),
    );
  }

  console.log(`[visitor-exits] notificadas ${byTenant.size} comunidad(es), ${pendingCount} pase(s).`);
});

// ── Self-service: provisión del ambiente de prueba (Fase 1) ──────────────────
// Pública a propósito: la llama el registro del landing. La contención del
// abuso es rate limiting + verificación de correo del lado del llamador, y el
// "un correo = un trial" que valida provisionTrialWorkspace.
export const createTrialWorkspace = onCall<CreateTrialInput>(
  { cors: callableCorsOrigins, invoker: "public", secrets: [resendApiKey] },
  async (request) => {
    const d = request.data;
    if (!d?.email?.trim() || !d?.nombre?.trim() || !d?.conjunto?.trim() || !d?.ciudad?.trim()) {
      throw new HttpsError("invalid-argument", "Nombre, correo, conjunto y ciudad son obligatorios.");
    }

    const result = await provisionTrialWorkspace(d);

    // Enlace de activación: es también la verificación del correo — sin acceso
    // al buzón no se entra al ambiente. Reutiliza el flujo probado de
    // accountInvites + /activar, sin tocarlo.
    await sendOnboardingInvite(
      result.adminUid,
      d.email.trim().toLowerCase(),
      d.nombre.trim(),
      result.tenantId,
      "tenant_admin",
    );

    await writeAuditLog(result.tenantId, undefined, "create_trial_workspace", {
      email: d.email.trim().toLowerCase(),
      conjunto: d.conjunto.trim(),
      trialEndsAt: result.trialEndsAt,
      seeded: result.seeded,
    });

    // Las credenciales de prueba NO se devuelven al cliente en claro por esta
    // vía: el admin las ve dentro del portal, ya autenticado.
    return {
      tenantId: result.tenantId,
      trialEndsAt: result.trialEndsAt,
      seeded: result.seeded,
    };
  },
);

// ── Ciclo de vida de los ambientes de prueba (Fase 4 del self-service) ───────
// Diario a las 10:00 UTC. Avisa en los días 7/3/1, pasa a `expired` al vencer
// (SIN borrar nada) y reporta los vencidos que superaron la retención.
export const trialLifecycleDaily = onSchedule(
  { schedule: "0 10 * * *", secrets: [resendApiKey], timeoutSeconds: 540 },
  async () => {
    const report = await runTrialLifecycle();
    console.log("[trial-lifecycle]", JSON.stringify(report));
    if (report.purgaPendiente.length > 0) {
      // La purga automática está apagada a propósito (ver AUTO_PURGE_ENABLED):
      // borrar datos de un prospecto es irreversible y se decide con la vista
      // puesta en datos reales, no por defecto.
      console.warn(
        `[trial-lifecycle] ${report.purgaPendiente.length} ambiente(s) superaron la retención y NO se purgaron:`,
        report.purgaPendiente.join(", "),
      );
    }
  },
);

// ── Alta de cliente desde un lead (self-service, ajuste 1) ──────────────────
// Cuando ya se acordó la suscripción, el superadmin convierte el lead en un
// ambiente REAL: nace `active`, sin vencimiento y con los módulos
// desbloqueados. Para un lead que YA tiene ambiente de prueba, la acción
// correcta es "Convertir a cliente" en la consola de ambientes (no crea nada).
export const createTenantFromLead = onCall<{
  leadId: string;
  planId?: string;
  seedExamples?: boolean;
  /** Quién vendió (REVOPS-001E). Id en `salesReps`. */
  vendedorId?: string;
}>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    assertSuperadmin(request.auth);

    const leadId = request.data?.leadId?.trim();
    if (!leadId) throw new HttpsError("invalid-argument", "leadId es requerido.");

    const leadSnap = await db.collection("leads").doc(leadId).get();
    if (!leadSnap.exists) throw new HttpsError("not-found", "No se encontró el lead.");

    const lead = leadSnap.data() as {
      nombre?: string; email?: string; telefono?: string; empresa?: string;
      ciudad?: string; pais?: string; unidadesEstimadas?: string | number; tenantId?: string;
    };

    if (lead.tenantId) {
      throw new HttpsError(
        "failed-precondition",
        "Este lead ya tiene un ambiente. Conviértelo a cliente desde la consola de ambientes.",
      );
    }
    if (!lead.email || !lead.nombre) {
      throw new HttpsError("failed-precondition", "El lead no tiene nombre o correo para crear el ambiente.");
    }

    // El vendedor se valida contra el catálogo: un id suelto que no existe
    // atribuiría la venta a nadie, que es justo lo que esta ficha cierra.
    const vendedorId = request.data?.vendedorId?.trim() || undefined;
    if (vendedorId) {
      const repSnap = await db.collection("salesReps").doc(vendedorId).get();
      if (!repSnap.exists) {
        throw new HttpsError("invalid-argument", "El vendedor indicado no está en el catálogo de comerciales.");
      }
    }

    const unidades = Number(lead.unidadesEstimadas);
    const result = await provisionTrialWorkspace({
      nombre: lead.nombre,
      email: lead.email,
      telefono: lead.telefono,
      conjunto: lead.empresa?.trim() || lead.nombre,
      ciudad: lead.ciudad?.trim() || "-",
      pais: lead.pais,
      unidadesEstimadas: Number.isFinite(unidades) ? unidades : undefined,
      leadId,
      asCustomer: true,
      planId: request.data?.planId,
      seedExamples: request.data?.seedExamples,
      vendedorId,
    });

    // El admin define su contraseña por el enlace de siempre.
    await sendOnboardingInvite(
      result.adminUid,
      lead.email.trim().toLowerCase(),
      lead.nombre,
      result.tenantId,
      "tenant_admin",
    );

    await writeAuditLog(result.tenantId, request.auth?.uid, "create_tenant_from_lead", {
      leadId,
      planId: request.data?.planId ?? "starter",
      ...(vendedorId ? { vendedorId } : {}),
    });

    return { tenantId: result.tenantId };
  },
);

// ── Solicitud de contacto comercial desde el portal (ajuste 2) ──────────────
// Reemplaza el mailto: recoge el mensaje y los datos de contacto, avisa al
// equipo con el contexto del ambiente y marca el lead como CALIFICADO — que
// es el evento más valioso del funnel.
export const requestAdvisorContact = onCall<{
  tenantId: string;
  motivo: string;
  mensaje?: string;
  telefono?: string;
  horarioPreferido?: string;
  /** Único dato que no tenemos ya del registro: quién es esta persona. */
  cargo?: string;
}>(
  { cors: callableCorsOrigins, secrets: [resendApiKey] },
  async (request) => {
    const tenantId = request.data?.tenantId;
    const uid = request.auth?.uid;
    if (!tenantId || !uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para solicitar contacto.");
    }
    await assertTenantMember(tenantId, uid);

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenant = tenantSnap.data() as
      | { name?: string; city?: string; country?: string; status?: string; trialEndsAt?: string; leadId?: string }
      | undefined;
    const userSnap = await db.collection("users").doc(uid).get();
    const solicitante = userSnap.data() as { fullName?: string; email?: string } | undefined;

    // Contexto que ya existe y no hace falta volver a pedirle: el lead guarda
    // lo que declaró al registrarse, y tenantOnboarding cuánto avanzó. Ese
    // avance es la señal comercial más útil del correo — quien va 6 de 7 está
    // enganchado; quien va 0 necesita una mano, no un guion de venta.
    const [leadSnap, onboardingSnap] = await Promise.all([
      tenant?.leadId ? db.collection("leads").doc(tenant.leadId).get() : Promise.resolve(null),
      db.collection("tenantOnboarding").doc(tenantId).get(),
    ]);
    const lead = leadSnap?.data() as
      | { telefono?: string | null; unidadesEstimadas?: number | null; pais?: string; cargo?: string }
      | undefined;
    const avance = onboardingSnap.data() as
      | { activationDone?: number; activationTotal?: number; discoveryDone?: number }
      | undefined;

    const motivo = request.data?.motivo?.trim() || "Quiere contratar Vivaru";
    const mensaje = request.data?.mensaje?.trim() || "";
    const telefono = request.data?.telefono?.trim() || "";
    const horario = request.data?.horarioPreferido?.trim() || "";
    const cargo = request.data?.cargo?.trim() || lead?.cargo || "";
    // Si no reescribió el teléfono, vale el que dejó al registrarse.
    const telefonoFinal = telefono || (lead?.telefono ?? "");

    // El lead pasa a CALIFICADO: pidió hablar tras probar el producto.
    if (tenant?.leadId) {
      await db.collection("leads").doc(tenant.leadId).set(
        {
          status: "calificado",
          ...(cargo ? { cargo } : {}),
          ...(telefonoFinal ? { telefono: telefonoFinal } : {}),
          solicitudAsesor: {
            motivo,
            mensaje,
            telefono: telefonoFinal,
            horario,
            cargo,
            solicitadoAt: new Date().toISOString(),
          },
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    }

    const isProd = (process.env.GCLOUD_PROJECT ?? "") === "hogaru-1";
    const ubicacion = [tenant?.city, lead?.pais ?? tenant?.country].filter(Boolean).join(", ") || "-";
    const activacion = avance?.activationTotal
      ? `${avance.activationDone ?? 0} de ${avance.activationTotal}` +
        (avance.discoveryDone ? ` · ${avance.discoveryDone} módulos recorridos` : "")
      : "sin datos";

    const cuerpo = [
      `${solicitante?.fullName ?? "Un administrador"} solicitó hablar con un asesor.`,
      "",
      "— QUIÉN —",
      `Nombre:    ${solicitante?.fullName ?? "-"}`,
      `Correo:    ${solicitante?.email ?? "-"}`,
      cargo ? `Cargo:     ${cargo}` : "",
      telefonoFinal ? `Teléfono:  ${telefonoFinal}` : "",
      horario ? `Prefiere:  ${horario}` : "",
      "",
      "— QUÉ PIDE —",
      `Motivo:    ${motivo}`,
      mensaje ? `Mensaje:   ${mensaje}` : "",
      "",
      "— SU CONJUNTO —",
      `Conjunto:  ${tenant?.name ?? tenantId}`,
      `Ubicación: ${ubicacion}`,
      lead?.unidadesEstimadas ? `Tamaño:    ${lead.unidadesEstimadas} unidades declaradas` : "",
      `Estado:    ${tenant?.status ?? "-"}${tenant?.trialEndsAt ? ` · vence ${tenant.trialEndsAt.slice(0, 10)}` : ""}`,
      `Activación: ${activacion}`,
      `Ambiente:  ${tenantId}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await sendNotificationEmail({
        to: isProd ? "comercial@qintilab.com" : "dev@qintilab.com",
        subject: `${isProd ? "" : "[STAGING] "}🔥 [Quiere contratar] ${tenant?.name ?? tenantId}`,
        body: cuerpo,
        link: "/superadmin/leads",
      });
    } catch (error) {
      console.error("[advisor-request] correo falló", { tenantId, error });
    }

    await writeAuditLog(tenantId, uid, "request_advisor_contact", { motivo, cargo });
    return { ok: true };
  },
);


// ── Soporte al cliente (PRD-V-FEAT-001) ──────────────────────────────────────
// Toda escritura de tickets pasa por aquí y ninguna por el cliente: mandan
// correo, sellan campos que el cliente no debe poder falsificar, el hilo es
// append-only y hay límites por conjunto que exigen contar antes de escribir.
// La lógica vive en `support.ts`; aquí solo se expone y se valida la sesión.

function supportAuth(auth: { uid?: string; token?: Record<string, unknown> } | undefined) {
  const uid = auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  return { uid, role: auth?.token?.role };
}

export const createSupportTicket = onCall<{
  tenantId: string;
  category: string;
  subject: string;
  description: string;
}>({ cors: callableCorsOrigins, invoker: "public", secrets: [resendApiKey] }, async (request) => {
  const { uid, role } = supportAuth(request.auth);
  const result = await createSupportTicketImpl(request.data, uid, role);
  await writeAuditLog(request.data?.tenantId ?? "", uid, "create_support_ticket", {
    ticketId: result.ticketId,
    category: request.data?.category,
  });
  return result;
});

// ── FIX-001 · reservas con las reglas en el servidor ─────────────────────────
//
// La lógica vive en `reservations.ts`; aquí se valida la sesión y la
// membresía. Entrega 1: comportamiento idéntico al del cliente de hoy, pero
// decidido donde el cliente no puede mentir. La regla de Firestore que aún
// permite la escritura directa del residente se cierra en el paso 4 del
// despliegue (PRD-V-FIX-001 §13), NUNCA antes de verificar que la interfaz ya
// usa esta vía.
export const createReservationRequest = onCall<CrearReservaInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const data = request.data;
    if (!data?.tenantId || !data.unitId || !data.amenityId || !data.date || !data.startTime || !data.endTime) {
      throw new HttpsError("invalid-argument", "Datos incompletos para crear la reserva.");
    }

    const membership = await assertTenantMember(data.tenantId, uid);
    const role = membership.role;
    const isAdmin = role === "tenant_admin" || role === "admin_tenant" || request.auth?.token?.role === "superadmin";

    if (!isAdmin && role !== "resident") {
      throw new HttpsError("permission-denied", "No tienes permisos para reservar.");
    }
    // El residente solo reserva para SU unidad — la misma condición que la
    // regla `residentOwnUnit`. El administrador puede reservar para cualquiera.
    if (!isAdmin && membership.unitId !== data.unitId) {
      throw new HttpsError("permission-denied", "Solo puedes reservar para tu unidad.");
    }

    await assertTenantOperable(data.tenantId);

    return crearReserva(
      {
        tenantId: data.tenantId,
        unitId: data.unitId,
        unitLabel: normalizeText(data.unitLabel),
        amenityId: data.amenityId,
        date: normalizeText(data.date),
        startTime: normalizeText(data.startTime),
        endTime: normalizeText(data.endTime),
        exclusiveUse: data.exclusiveUse === true,
        createdByName:
          normalizeText(data.createdByName) ||
          (typeof membership.fullName === "string" ? membership.fullName : ""),
      },
      uid,
    );
  },
);

// ── PLAT-001 · corrida de cobro por coeficiente ──────────────────────────────
//
// La lógica y la aritmética del reparto viven en `coefficient-billing.ts`;
// aquí solo se valida la sesión. La MISMA callable sirve la vista previa
// (`dryRun: true`, no escribe nada) y la generación: así el reparto no vive
// duplicado entre cliente y servidor.
export const generateCoefficientCampaign = onCall<GenerarCorridaInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const data = request.data;
    if (!data?.tenantId || !data.period || typeof data.totalAmount !== "number" || !data.operationKey) {
      throw new HttpsError("invalid-argument", "Datos incompletos para generar la corrida.");
    }

    await assertActiveTenantAdmin(data.tenantId, uid);

    const resultado = await generarCorridaPorCoeficiente(
      {
        tenantId: data.tenantId,
        totalAmount: data.totalAmount,
        period: normalizeText(data.period),
        concept: normalizeText(data.concept) || undefined,
        dueDate: normalizeText(data.dueDate) || undefined,
        dryRun: data.dryRun === true,
        operationKey: normalizeText(data.operationKey),
      },
      uid,
    );

    // Solo se audita lo que escribió de verdad: ni la vista previa ni el
    // reintento idempotente dejan rastro doble.
    if (!resultado.dryRun && resultado.created) {
      await writeAuditLog(data.tenantId, uid, "generate_coefficient_campaign", {
        campaignId: resultado.campaignId,
        period: data.period,
        totalDistributed: resultado.total,
        unitCount: resultado.lines.length,
      });
    }

    return resultado;
  },
);

// ── FLOW-002 · anticipos ─────────────────────────────────────────────────────
//
// La lógica vive en `advances.ts`. Las dos van por callable y no por escritura
// directa porque tocan tres colecciones a la vez dentro de una transacción, y
// porque las reglas de Firestore no dejan al cliente escribir ni una de ellas:
// es dinero.
export const applyAdvance = onCall<CruzarAnticipoInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const resultado = await cruzarAnticipo(
      request.data,
      uid,
      request.auth?.token?.role,
      request.auth?.token?.tenantId,
    );

    // Solo se audita lo que de verdad ocurrió: un reintento idempotente no
    // genera una segunda entrada. Misma regla que `applyPayment`.
    if (resultado.applied) {
      await writeAuditLog(request.data?.tenantId ?? "", uid, "apply_advance", {
        advanceId: request.data?.advanceId,
        statementId: request.data?.statementId,
        // Lo APLICADO, no lo pedido: §5.3 lo limita al saldo del cargo, y la
        // auditoría tiene que decir lo que pasó, no lo que se intentó.
        appliedAmount: resultado.appliedAmount,
        applicationId: resultado.applicationId,
      });
    }
    return resultado;
  },
);

export const undoAdvanceApplication = onCall<DeshacerCruceInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const resultado = await deshacerCruce(
      request.data,
      uid,
      request.auth?.token?.role,
      request.auth?.token?.tenantId,
    );

    if (resultado.reversed) {
      await writeAuditLog(request.data?.tenantId ?? "", uid, "undo_advance_application", {
        applicationId: request.data?.applicationId,
        reason: request.data?.reason,
        remaining: resultado.remaining,
      });
    }
    return resultado;
  },
);

// ── FIN-001 · aplicación de pagos ────────────────────────────────────────────
//
// La lógica vive en `payments.ts`; aquí solo se expone, se valida la sesión y se
// deja el rastro de auditoría. Es la ÚNICA vía por la que un pago toca la
// cartera y el libro: las dos rutas del cliente —cobro manual y aprobación del
// comprobante del residente— llaman aquí.
export const applyPayment = onCall<AplicarPagoInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const role = request.auth?.token?.role;
    const tokenTenant = request.auth?.token?.tenantId;

    const resultado = await aplicarPago(request.data, uid, role, tokenTenant);

    // Solo se audita lo que de verdad ocurrió: un reintento idempotente no
    // genera una segunda entrada, que si no el registro contaría dos cobros.
    if (resultado.applied) {
      await writeAuditLog(request.data?.tenantId ?? "", uid, "apply_payment", {
        statementId: request.data?.statementId,
        amount: request.data?.amount,
        source: request.data?.source,
        ledgerEntryId: resultado.ledgerEntryId,
      });
    }
    return resultado;
  },
);

/**
 * `FIN-001` — revierte un pago ya aplicado.
 *
 * Se audita **siempre que la reversión ocurra**, y se registra si el pago
 * original había emitido comprobante fiscal: quien lea la auditoría tiene que
 * poder saber que hay una nota de crédito pendiente sin ir a buscarlo.
 */
export const revertPayment = onCall<RevertirPagoInput>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const role = request.auth?.token?.role;
    const tokenTenant = request.auth?.token?.tenantId;

    const resultado = await revertirPago(request.data, uid, role, tokenTenant);

    if (resultado.reversed) {
      await writeAuditLog(request.data?.tenantId ?? "", uid, "revert_payment", {
        operationKey: request.data?.operationKey,
        reason: request.data?.reason,
        reversalEntryId: resultado.reversalEntryId,
        // Qué recibo se anuló, en vez de si hacía falta una nota de crédito:
        // ahora la anulación ocurre, así que la auditoría registra un hecho y
        // no un recordatorio.
        voucherAnuladoId: resultado.voucherAnuladoId ?? null,
      });
    }
    return resultado;
  },
);

export const replyToSupportTicket = onCall<{ ticketId: string; message: string }>(
  { cors: callableCorsOrigins, invoker: "public", secrets: [resendApiKey] },
  async (request) => {
    const { uid, role } = supportAuth(request.auth);
    return replySupportTicket(request.data, uid, role);
  },
);

export const updateSupportTicketStatus = onCall<{
  ticketId: string;
  status?: string;
  priority?: string;
}>({ cors: callableCorsOrigins, invoker: "public", secrets: [resendApiKey] }, async (request) => {
  const { uid, role } = supportAuth(request.auth);
  return updateSupportTicketImpl(request.data, uid, role);
});

export const reopenSupportTicketCallable = onCall<{ ticketId: string; message: string }>(
  { cors: callableCorsOrigins, invoker: "public", secrets: [resendApiKey] },
  async (request) => {
    const { uid, role } = supportAuth(request.auth);
    return reopenSupportTicket(request.data, uid, role);
  },
);

export const closeSupportTicketCallable = onCall<{ ticketId: string }>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const { uid, role } = supportAuth(request.auth);
    return closeSupportTicket(request.data, uid, role);
  },
);

export const addSupportNote = onCall<{ ticketId: string; note: string }>(
  { cors: callableCorsOrigins, invoker: "public" },
  async (request) => {
    const { uid, role } = supportAuth(request.auth);
    return addSupportInternalNote(request.data, uid, role);
  },
);

// ─── Plataforma de IA ────────────────────────────────────────────────────────
// Punto de entrada único de las operaciones asistidas (Pasos 1.2 a 1.4 de
// docs/hoja-de-ruta-ia.md): autentica, resuelve el conjunto desde la sesión,
// comprueba rol y banderas, valida entrada y salida contra el catálogo, y deja
// rastro en `aiUsage`. El proveedor es simulado hasta que se cierren la región
// y el tope de gasto.
export { aiInvoke } from "./ai/gateway";
export { registrarFeedbackIa } from "./ai/feedback-gateway";
// Asistencia de PQRS (Fase 3 de PRD-VAI-FEAT-002). Puerta propia y no `aiInvoke`
// porque su entrada la puebla el SERVIDOR: el cliente manda un `ticketId` y el
// servidor lee el ticket y resuelve la variante. Si la mandara el navegador,
// `variante` —lo que decide la puerta dura de nulls en `buzon_simple`— la
// estaría afirmando el cliente.
export { asistirTicketPqrs } from "./ai/pqrs-gateway";
export { registrarImportacion } from "./import/gateway";

/**
 * Modo sombra de PQRS — Fase 4 de `PRD-VAI-FEAT-002`.
 *
 * **Dos triggers propios y no un añadido a `onTicketCreated`/`onTicketUpdated`.**
 * Aquellos mandan las notificaciones y el correo al residente, y son lo que no
 * puede fallar: una llamada al modelo tarda hasta 20 segundos y puede caerse, y
 * la notificación de un PQRS no puede depender de que conteste Vertex. Aparte
 * hay otras dos ganancias: se despliegan solas —como se desplegó
 * `asistirTicketPqrs` el 17 de agosto, para no arrastrar funciones con
 * secretos— y se apagan solas.
 *
 * Sin reintentos (el default de v2), y a propósito: un reintento automático es
 * otra llamada al modelo, es decir dinero, por algo que nadie está esperando en
 * pantalla. La entrega doble la para la reserva de `clasificarTicketEnSombra`.
 *
 * **Solo al crear, no al editar.** Las reglas dejan al residente actualizar su
 * ticket, así que el mensaje puede cambiar después; reclasificar cada edición
 * multiplicaría el gasto y mediría otra cosa. Lo que la sombra guarda es la
 * clasificación del ticket TAL COMO LLEGÓ, que es lo mismo que el administrador
 * tuvo delante. Es un límite conocido, no un olvido.
 */
export const sombraPqrsAlCrearTicket = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  try {
    await clasificarTicketEnSombra(event.params.ticketId, data);
  } catch (error) {
    // Nunca propaga: el ticket del residente ya está escrito y notificado, y un
    // fallo de la sombra no puede convertirse en un reintento de la plataforma.
    logger.error("sombra-pqrs: fallo al clasificar", {
      ticketId: event.params.ticketId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * La otra mitad del par: qué decidió el administrador.
 *
 * Sin esto la sombra guardaría sugerencias contra un hueco y las dos puertas de
 * G7 seguirían sin poder medirse — es la misma razón por la que en F3 hubo que
 * construir el editor de clasificación antes que nada.
 */
export const sombraPqrsAlActualizarTicket = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const antes = event.data?.before.data();
  const despues = event.data?.after.data();
  if (!antes || !despues) return;
  try {
    await registrarDecisionEnSombra(event.params.ticketId, antes, despues);
  } catch (error) {
    logger.error("sombra-pqrs: fallo al registrar la decisión", {
      ticketId: event.params.ticketId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Resumen de consumo de IA (Paso 1.5). Contesta la pregunta del criterio:
 * cuánto gastó cada conjunto en el período, cuántas llamadas y cuántas
 * fallaron. Solo superadmin: son datos de todos los conjuntos a la vez.
 */
export const getAiUsage = onCall<{ from?: string; to?: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    assertSuperadmin(request.auth);

    const desde = request.data?.from ? new Date(request.data.from) : inicioDelMes();
    const hasta = request.data?.to ? new Date(request.data.to) : new Date();

    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
      throw new HttpsError("invalid-argument", "Las fechas del período no son válidas.");
    }
    if (desde >= hasta) {
      throw new HttpsError("invalid-argument", "La fecha inicial debe ser anterior a la final.");
    }

    return {
      from: desde.toISOString(),
      to: hasta.toISOString(),
      ...(await getAiUsageSummary(desde, hasta)),
    };
  },
);
