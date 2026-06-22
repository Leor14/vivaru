import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { combineDateAndTime, isDateTimeValid } from "./utils/datetimeValidation";
import { stubSriTransport, transmitVoucher } from "./sri-ecuador";
import { anonymizeExpiredVouchers } from "./data-retention";
import { assertStrongPassword, generateStrongPassword } from "./password-policy";
import { resendApiKey, sendAccountEmail, sendNotificationEmail, type AccountEmailVariant } from "./email";
import {
  resolveNotificationCopy,
  type NotificationKey,
  type NotificationOverride,
  type NotificationType,
} from "./notification-catalog";

initializeApp();

const db = getFirestore();

const callableCorsOrigins = [
  "https://www.grupovivaru.com",
  "https://grupovivaru.com",
  "https://vivaru--hogaru-1.us-central1.hosted.app",
  "https://hogaru-web--hogaru-1.us-central1.hosted.app", // legacy, mantener hasta confirmar 0 tráfico
  "http://localhost:3000",
];

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

type CreateTenantWorkspaceInput = {
  name: string;
  city: string;
  planId: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
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
}

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

  const profile = profileSnap.data() as { status?: string; role?: string; tenantId?: string };
  if (profile.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "No puedes operar sobre otro tenant.");
  }

  if (profile.role !== "tenant_admin") {
    throw new HttpsError("permission-denied", "No tienes permisos para crear usuarios operativos.");
  }

  if ((profile.status ?? "active") !== "active") {
    throw new HttpsError("failed-precondition", "Tu perfil administrador se encuentra inactivo.");
  }

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
  // Fallback compatible con datos antiguos donde unitId pudiera ser un slug.
  let unitLabel = tower ? `${tower}-${unitId}` : unitId;
  try {
    const unitSnap = await db.collection("units").doc(unitId).get();
    const displayName = unitSnap.exists ? normalizeText((unitSnap.data() as Record<string, unknown>).displayName) : "";
    if (displayName) unitLabel = displayName;
  } catch {
    /* usa el fallback */
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
  const tenantRef = db.collection("tenants").doc();

  await tenantRef.set({
    name: data.name,
    city: data.city,
    status: data.status,
    planId: data.planId,
    onboardingStatus: data.onboardingStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: request.auth?.uid,
  });

  await db.collection("auditLogs").add({
    tenantId: tenantRef.id,
    actorUid: request.auth?.uid,
    action: "create_tenant_workspace",
    metadata: {
      city: data.city,
      planId: data.planId,
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

    await sendPasswordSetupEmail(data.email, data.fullName);

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

      const tokenTenantId = normalizeText(request.auth.token?.tenantId);
      if (tokenTenantId && tokenTenantId !== data.tenantId) {
        throw new HttpsError("permission-denied", "No puedes crear usuarios en otro tenant.");
      }

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

      await sendPasswordSetupEmail(data.email, data.fullName);

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

    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
      throw new HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
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

    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
      throw new HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
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

    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
      throw new HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
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

    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
      throw new HttpsError("permission-denied", "No puedes crear carpetas en otro tenant.");
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

// Carpeta de sistema "Comunicados" (find-or-create). Aloja los adjuntos de los
// comunicados; es protegida (no se renombra/mueve/elimina).
export const ensureCommunicationsFolder = onCall<{ tenantId: string }>(
  { cors: callableCorsOrigins },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    if (!tenantId) throw new HttpsError("invalid-argument", "tenantId requerido.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) throw new HttpsError("permission-denied", "Tenant incorrecto.");

    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const tid = actor.tenantId;

    const existing = await db
      .collection("documentFolders")
      .where("tenantId", "==", tid)
      .where("systemKey", "==", "communications")
      .limit(1)
      .get();
    if (!existing.empty) return { folderId: existing.docs[0].id };

    const profileSnap = await db.collection("users").doc(request.auth.uid).get();
    const createdByName = (profileSnap.data() as { fullName?: string } | undefined)?.fullName ?? "";
    const now = Timestamp.now();
    const ref = db.collection("documentFolders").doc();
    await ref.set({
      tenantId: tid,
      name: "Comunicados",
      description: "Adjuntos de los comunicados publicados. Carpeta del sistema.",
      parentId: null,
      path: ref.id,
      depth: 0,
      color: "blue",
      system: true,
      systemKey: "communications",
      createdBy: request.auth.uid,
      createdByName,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog(tid, request.auth.uid, "ensure_communications_folder", { folderId: ref.id });
    return { folderId: ref.id };
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

    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) throw new HttpsError("permission-denied", "Tenant incorrecto.");

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
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) throw new HttpsError("permission-denied", "Tenant incorrecto.");

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
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) throw new HttpsError("permission-denied", "Tenant incorrecto.");

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
  const data = event.data?.data() as { tenantId?: string; title?: string } | undefined;
  if (!data?.tenantId) return;

  const residentUids = await listTenantUidsByRoles(data.tenantId, ["resident"]);
  await createNotifications(
    residentUids.map((uid) => ({
      userId: uid,
      tenantId: data.tenantId,
      type: "communication",
      title: data.title?.trim() || "Nuevo comunicado",
      description: "La administracion publico un nuevo comunicado.",
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

// Cobro nuevo individual. Los cobros de una importación masiva (source="import")
// se agrupan en un solo aviso vía el callable notifyBillingBatch.
export const onBillingStatementCreated = onDocumentCreated({ document: "billingStatements/{statementId}", secrets: [resendApiKey] }, async (event) => {
  const data = event.data?.data() as
    | {
        tenantId?: string;
        unitId?: string;
        unitLabel?: string;
        period?: string;
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
    monto: formatMoney(data.amount ?? data.balance ?? 0),
    unidad: data.unitLabel ?? "",
    conjunto,
  };
  await deliverResidentNotifications("billing_new", data.tenantId, residentUids, vars, override);
});

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

// Runs every day at 07:00 UTC (02:00 Colombia)
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

  // Transmisión al SRI (Ecuador) — comportamiento existente.
  if (data.issuerCountry !== "EC" || data.fiscalStatus !== "pending") return;
  await transmitVoucher(db, event.params.voucherId, stubSriTransport);
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

// Reenvío / reintento manual de la transmisión (admin del tenant o superadmin).
export const retransmitVoucher = onCall<{ voucherId: string }>(async (request) => {
  const voucherId = request.data?.voucherId;
  if (!voucherId) {
    throw new HttpsError("invalid-argument", "voucherId requerido.");
  }
  const snap = await db.collection("paymentVouchers").doc(voucherId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Comprobante no encontrado.");
  }
  const voucher = snap.data() as { tenantId: string };
  await assertTenantAdminOrSuper({
    tenantId: voucher.tenantId,
    uid: request.auth?.uid,
    role: request.auth?.token?.role,
  });
  await transmitVoucher(db, voucherId, stubSriTransport);
  return { ok: true };
});

// ── F2/G4 · Retención: anonimiza datos sensibles de comprobantes vencidos ─────
// Corre a diario; respeta el período por conjunto (default 12 meses).
export const anonymizeExpiredVouchersDaily = onSchedule("every day 03:00", async () => {
  const count = await anonymizeExpiredVouchers(db);
  console.log(`[data-retention] Anonimizados ${count} comprobante(s).`);
});
