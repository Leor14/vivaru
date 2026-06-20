import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { combineDateAndTime, isDateTimeValid } from "./utils/datetimeValidation";
import { stubSriTransport, transmitVoucher } from "./sri-ecuador";
import { anonymizeExpiredVouchers } from "./data-retention";
import { assertStrongPassword, generateStrongPassword } from "./password-policy";
import { resendApiKey, sendAccountEmail, type AccountEmailVariant } from "./email";

initializeApp();

const db = getFirestore();

const callableCorsOrigins = [
  "https://www.grupovivaru.com",
  "https://grupovivaru.com",
  "https://vivaru--hogaru-1.us-central1.hosted.app",
  "https://hogaru-web--hogaru-1.us-central1.hosted.app", // legacy, mantener hasta confirmar 0 tráfico
  "http://localhost:3000",
];

type NotificationType = "package" | "communication" | "reservation" | "visitor" | "ticket" | "system";

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

export const onReservationUpdated = onDocumentUpdated("reservations/{reservationId}", async (event) => {
  const before = event.data?.before.data() as { status?: string } | undefined;
  const after = event.data?.after.data() as { status?: string; tenantId?: string; createdBy?: string; amenity?: string } | undefined;
  if (!after?.tenantId || !after?.createdBy) return;

  if (before?.status === after.status) return;
  if (after.status !== "approved") return;

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

// Runs every day at 07:00 UTC (02:00 Colombia)
export const updateOverdueStatements = onSchedule("0 7 * * *", async () => {
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

  console.log(`[updateOverdueStatements] Marked ${updated} statement(s) as overdue.`);
});

// ── F2/G1 · Transmisión del comprobante de alícuota al SRI (Ecuador) ──────────
// Dispara al crear un comprobante de emisor Ecuador en estado "pending".
// El transporte real (firma + endpoint SRI) se implementa en G3; aquí usa stub.
export const onPaymentVoucherCreated = onDocumentCreated("paymentVouchers/{voucherId}", async (event) => {
  const data = event.data?.data();
  if (!data || data.issuerCountry !== "EC" || data.fiscalStatus !== "pending") return;
  await transmitVoucher(db, event.params.voucherId, stubSriTransport);
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
