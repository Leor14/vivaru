"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrialWorkspace = exports.notifyPendingVisitorExits = exports.resendAccountInvite = exports.activateAccount = exports.getAccountInvite = exports.logClientError = exports.anonymizeExpiredVouchersDaily = exports.monthlyFinancialArchive = exports.retransmitVoucher = exports.onSurveyUpdated = exports.onRegulationDocumentCreated = exports.onPaymentVoucherCreated = exports.updateOverdueStatements = exports.publishScheduledCharges = exports.notifyResidentReceipt = exports.mergeUnits = exports.sendScheduledReminders = exports.sendBillingReminder = exports.notifyBillingBatch = exports.remindPackagePickup = exports.onBillingStatementCreated = exports.onTicketUpdated = exports.onTicketCreated = exports.onVisitorPassCreated = exports.onCommitteeAgreementUpdated = exports.onReservationUpdated = exports.onReservationCreated = exports.onPackageCreated = exports.onCommunicationCreated = exports.confirmPackageReceipt = exports.registerWalkInVisit = exports.createVisitorPass = exports.seedDemoData = exports.completeResidentPasswordChange = exports.provisionResidentTemporaryAccess = exports.getDocumentDownloadUrl = exports.moveDocumentFolder = exports.deleteDocumentFolder = exports.renameDocumentFolder = exports.ensureCommunicationsFolder = exports.ensureSystemFolder = exports.createDocumentFolder = exports.deleteOperationalUser = exports.updateOperationalUser = exports.setOperationalUserStatus = exports.createTenantOperationalUser = exports.updateTenantAdmin = exports.createTenantAdmin = exports.createTenantWorkspace = exports.createTenant = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const crypto_1 = require("crypto");
const XLSX = __importStar(require("xlsx"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const datetimeValidation_1 = require("./utils/datetimeValidation");
const sri_ecuador_1 = require("./sri-ecuador");
const data_retention_1 = require("./data-retention");
const password_policy_1 = require("./password-policy");
const email_1 = require("./email");
const trial_workspace_1 = require("./trial-workspace");
const notification_catalog_1 = require("./notification-catalog");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const callableCorsOrigins = [
    "https://www.grupovivaru.com",
    "https://grupovivaru.com",
    "https://vivaru--hogaru-1.us-central1.hosted.app",
    "https://hogaru-web--hogaru-1.us-central1.hosted.app", // legacy, mantener hasta confirmar 0 tráfico
    "https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app", // staging
    "http://localhost:3000",
];
// Defaults = comportamiento actual. Si el alta no envia variantes (o faltan claves), se aplican
// estos, de modo que los conjuntos quedan en el modo vigente sin requerir migracion.
const DEFAULT_MODULE_VARIANTS = {
    visitors: "qr_full",
    packages: "con_evidencia",
    pqrs: "con_sla",
    communications: "canal_oficial",
    finance: "completa",
    governance: "formal",
};
const MODULE_VARIANT_VALUES = {
    visitors: ["qr_full", "registro_simple"],
    packages: ["con_evidencia", "aviso_simple"],
    pqrs: ["con_sla", "buzon_simple"],
    communications: ["canal_oficial", "tablon_simple"],
    finance: ["completa", "solo_consulta"],
    governance: ["formal", "informativo"],
};
function normalizeModuleVariants(input) {
    const raw = (input ?? {});
    const result = { ...DEFAULT_MODULE_VARIANTS };
    for (const key of Object.keys(MODULE_VARIANT_VALUES)) {
        const value = raw[key];
        if (typeof value === "string" && MODULE_VARIANT_VALUES[key].includes(value)) {
            result[key] = value;
        }
    }
    return result;
}
// Lee la variante de Visitas del conjunto aplicando el default si falta.
async function getTenantVisitorsVariant(tenantId) {
    const snap = await db.collection("tenantSettings").doc(tenantId).get();
    const mv = (snap.data()?.moduleVariants ?? {});
    const value = mv.visitors;
    return value === "registro_simple" || value === "qr_full" ? value : DEFAULT_MODULE_VARIANTS.visitors;
}
// Lee la variante de Finanzas del conjunto aplicando el default si falta.
async function getTenantFinanceVariant(tenantId) {
    const snap = await db.collection("tenantSettings").doc(tenantId).get();
    const mv = (snap.data()?.moduleVariants ?? {});
    const value = mv.finance;
    return value === "solo_consulta" || value === "completa" ? value : DEFAULT_MODULE_VARIANTS.finance;
}
// En modo solo_consulta no se gestionan cobros: las acciones de cartera quedan deshabilitadas.
async function assertFinanceManagementEnabled(tenantId) {
    if ((await getTenantFinanceVariant(tenantId)) === "solo_consulta") {
        throw new https_1.HttpsError("failed-precondition", "La gestión de cobros está deshabilitada: este conjunto opera en modo solo consulta.");
    }
}
function assertSuperadmin(auth) {
    if (!auth || auth.token?.role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "Solo superadmin puede ejecutar esta operacion.");
    }
}
async function assertTenantMember(tenantId, uid) {
    const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${uid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "El usuario no pertenece al tenant.");
    }
    return membershipSnap.data();
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
async function assertTenantOperable(tenantId) {
    const snap = await db.collection("tenants").doc(tenantId).get();
    if (!snap.exists)
        return;
    const status = snap.data()?.status;
    // Sin status explícito se asume operable (compatibilidad con datos antiguos).
    if (!status || WRITABLE_TENANT_STATUSES.includes(status))
        return;
    const reason = status === "expired"
        ? "El período de prueba de este conjunto terminó. Contacta a un asesor de Vivaru para reactivarlo."
        : "Este conjunto está suspendido. Contacta a un asesor de Vivaru para reactivarlo.";
    throw new https_1.HttpsError("failed-precondition", reason);
}
async function assertTenantAdminOrSuper(input) {
    if (input.role === "superadmin") {
        return;
    }
    if (!input.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para ejecutar esta accion.");
    }
    const membership = await assertTenantMember(input.tenantId, input.uid);
    if (membership.role !== "tenant_admin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para gestionar credenciales de residentes.");
    }
    await assertTenantOperable(input.tenantId);
}
async function assertActiveTenantAdmin(tenantId, uid) {
    const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${uid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "No perteneces al tenant indicado.");
    }
    const membership = membershipSnap.data();
    if (membership.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes operar sobre otro tenant.");
    }
    if (membership.role !== "tenant_admin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para crear usuarios operativos.");
    }
    if ((membership.status ?? "active") !== "active") {
        throw new https_1.HttpsError("failed-precondition", "Tu usuario admin se encuentra inactivo.");
    }
    const profileSnap = await db.collection("users").doc(uid).get();
    if (!profileSnap.exists) {
        throw new https_1.HttpsError("failed-precondition", "No fue posible validar tu perfil de administrador.");
    }
    const profile = profileSnap.data();
    if (profile.tenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes operar sobre otro tenant.");
    }
    if (profile.role !== "tenant_admin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para crear usuarios operativos.");
    }
    if ((profile.status ?? "active") !== "active") {
        throw new https_1.HttpsError("failed-precondition", "Tu perfil administrador se encuentra inactivo.");
    }
    await assertTenantOperable(tenantId);
    return { tenantId };
}
async function writeAuditLog(tenantId, actorUid, action, metadata) {
    await db.collection("auditLogs").add({
        tenantId,
        actorUid: actorUid ?? "unknown",
        action,
        metadata,
        createdAt: firestore_1.Timestamp.now(),
    });
}
// A5: genera el enlace seguro de Firebase y lo envía por Resend (marca Vivaru).
// Best-effort: nunca rompe la creación del usuario; si falla, queda en logs y el
// usuario siempre puede usar "¿Olvidaste tu contraseña?" (reset nativo).
async function sendPasswordSetupEmail(email, fullName, variant = "welcome") {
    try {
        const link = await (0, auth_1.getAuth)().generatePasswordResetLink(email);
        await (0, email_1.sendAccountEmail)({ to: email, fullName, link, variant });
    }
    catch (error) {
        console.warn("[email] no se pudo enviar el correo de acceso", { email, variant, error });
    }
}
// Onboarding robusto (Opción B): invitación con token PROPIO, no los oobCode de
// Firebase (que un escáner de correo puede consumir y que expiran en 1h fija).
// El enlace abre /activar?token=… (GET no consume el token); recién al enviar la
// contraseña se valida y se marca usado. TTL configurable.
const INVITE_TTL_DAYS = 7;
async function sendOnboardingInvite(uid, email, fullName, tenantId, role, variant = "welcome") {
    try {
        const token = (0, crypto_1.randomUUID)();
        const expiresAt = firestore_1.Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
        await db.collection("accountInvites").doc(token).set({
            uid,
            email: email.toLowerCase(),
            fullName,
            tenantId,
            role,
            usedAt: null,
            createdAt: firestore_1.Timestamp.now(),
            expiresAt,
        });
        await (0, email_1.sendAccountEmail)({ to: email, fullName, link: `/activar?token=${token}`, variant });
    }
    catch (error) {
        console.warn("[invite] no se pudo crear/enviar la invitacion de acceso", { email, error });
    }
}
async function listTenantUidsByRoles(tenantId, roles) {
    if (!roles.length)
        return [];
    const snapshot = await db
        .collection("tenantUsers")
        .where("tenantId", "==", tenantId)
        .where("role", "in", roles)
        .get();
    return snapshot.docs
        .map((entry) => {
        const data = entry.data();
        if (data.status && data.status !== "active")
            return null;
        return data.uid ?? null;
    })
        .filter((uid) => Boolean(uid));
}
async function listResidentUidsByUnit(tenantId, unitId) {
    const snapshot = await db
        .collection("tenantUsers")
        .where("tenantId", "==", tenantId)
        .where("role", "==", "resident")
        .where("unitId", "==", unitId)
        .get();
    return snapshot.docs
        .map((entry) => {
        const data = entry.data();
        if (data.status && data.status !== "active")
            return null;
        return data.uid ?? null;
    })
        .filter((uid) => Boolean(uid));
}
async function listSuperadminUids() {
    const snapshot = await db.collection("users").where("role", "==", "superadmin").get();
    return snapshot.docs
        .map((entry) => {
        const data = entry.data();
        if (data.status && data.status !== "active")
            return null;
        return data.uid ?? entry.id;
    })
        .filter((uid) => Boolean(uid));
}
async function createNotifications(inputs) {
    if (inputs.length === 0)
        return;
    const batch = db.batch();
    const seen = new Set();
    for (const item of inputs) {
        const userId = item.userId?.trim();
        if (!userId)
            continue;
        const uniqueKey = `${userId}::${item.tenantId ?? "global"}::${item.type}::${item.title}::${item.description}`;
        if (seen.has(uniqueKey))
            continue;
        seen.add(uniqueKey);
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
            userId,
            tenantId: item.tenantId ?? null,
            type: item.type,
            title: item.title,
            description: item.description,
            read: false,
            createdAt: firestore_1.Timestamp.now(),
            link: item.link ?? null,
        });
    }
    await batch.commit();
}
// ── Resolución de copy de notificaciones (overrides por tenant) ───────────────
/** Lee el override de una notificación del tenant (tenantSettings.notificationTemplates). */
async function getTenantNotificationOverride(tenantId, key) {
    const snap = await db.collection("tenantSettings").doc(tenantId).get();
    const templates = snap.exists
        ? snap.data()?.notificationTemplates
        : undefined;
    return templates?.[key];
}
/** Nombre del conjunto (variable {conjunto}). */
async function getTenantName(tenantId) {
    const snap = await db.collection("tenants").doc(tenantId).get();
    return (snap.exists ? snap.data()?.name : undefined) ?? "";
}
/** Formatea un monto entero con separadores es-CO, con prefijo "$". */
function formatMoney(value) {
    return `$${Math.round(value).toLocaleString("es-CO")}`;
}
/** "2026-06-20" → "junio 2026" (variable {período} de recibos). */
function formatPeriodFromDate(value) {
    if (!value)
        return "";
    const d = new Date(`${value.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return "";
    const label = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
}
/** Correos (activos) de una lista de uids de residentes. Chunked por el límite de "in". */
async function getResidentEmails(uids) {
    const emails = [];
    for (let i = 0; i < uids.length; i += 30) {
        const chunk = uids.slice(i, i + 30);
        const snap = await db.collection("users").where("uid", "in", chunk).get();
        snap.forEach((d) => {
            const u = d.data();
            if (u.email && (!u.status || u.status === "active"))
                emails.push(u.email);
        });
    }
    return emails;
}
/**
 * Entrega una notificación a una lista de residentes: in-app siempre y, si el
 * tenant activó el correo para esa notificación, también por email (best-effort,
 * el fallo de correo nunca rompe la notificación in-app).
 */
async function deliverResidentNotifications(key, tenantId, residentUids, vars, override) {
    if (residentUids.length === 0)
        return;
    const copy = (0, notification_catalog_1.resolveNotificationCopy)(key, override, vars);
    await createNotifications(residentUids.map((uid) => ({
        userId: uid,
        tenantId,
        type: copy.type,
        title: copy.title,
        description: copy.body,
        link: copy.link,
    })));
    if (!copy.emailEnabled)
        return;
    const emails = await getResidentEmails(residentUids);
    for (const to of emails) {
        try {
            await (0, email_1.sendNotificationEmail)({ to, subject: copy.emailSubject, body: copy.emailBody, link: copy.link });
        }
        catch (e) {
            console.error(`[notif-email][${key}]`, e);
        }
    }
}
function isTodayDateString(value) {
    if (!value)
        return false;
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized))
        return false;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return normalized === `${yyyy}-${mm}-${dd}`;
}
async function upsertAuthUser(seed) {
    const authApi = (0, auth_1.getAuth)();
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
    }
    catch {
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
function assertAdminStatus(value) {
    if (value !== "active" && value !== "inactive") {
        throw new https_1.HttpsError("invalid-argument", "Estado de admin invalido.");
    }
}
function assertOperationalRole(value) {
    if (value !== "tenant_admin" && value !== "security_guard") {
        throw new https_1.HttpsError("invalid-argument", "Rol operativo invalido.");
    }
}
function normalizeText(value) {
    if (typeof value !== "string")
        return "";
    return value.trim();
}
function normalizeEmail(value) {
    return normalizeText(value).toLowerCase();
}
function assertTemporaryPasswordPolicy(input) {
    const currentPassword = normalizeText(input.currentPassword);
    const newPassword = normalizeText(input.newPassword);
    const documentNumber = normalizeText(input.documentNumber);
    if (!currentPassword || !newPassword) {
        throw new https_1.HttpsError("invalid-argument", "Debes ingresar la clave temporal y la nueva contrasena.");
    }
    if (!documentNumber) {
        throw new https_1.HttpsError("failed-precondition", "No fue posible validar el documento de la cuenta.");
    }
    if (currentPassword !== documentNumber) {
        throw new https_1.HttpsError("invalid-argument", "La clave temporal actual no coincide con tu documento.");
    }
    if (newPassword.length < 8) {
        throw new https_1.HttpsError("invalid-argument", "La nueva contrasena debe tener al menos 8 caracteres.");
    }
    if (newPassword === documentNumber) {
        throw new https_1.HttpsError("invalid-argument", "La nueva contrasena no puede ser igual al documento.");
    }
}
async function upsertResidentTemporaryAccess(input) {
    const tenantId = normalizeText(input.tenantId);
    const personId = normalizeText(input.personId);
    if (!tenantId || !personId) {
        throw new https_1.HttpsError("invalid-argument", "Debes indicar tenant y residente para restablecer el acceso.");
    }
    const personRef = db.collection("people").doc(personId);
    const personSnap = await personRef.get();
    if (!personSnap.exists) {
        throw new https_1.HttpsError("not-found", "El residente no existe.");
    }
    const personData = personSnap.data();
    const personTenantId = normalizeText(personData.tenantId);
    if (personTenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "El residente no pertenece al tenant indicado.");
    }
    const email = normalizeEmail(personData.email);
    const fullName = normalizeText(personData.fullName) || "Residente Vivaru";
    const documentNumber = normalizeText(personData.documentNumber);
    const status = normalizeText(personData.status) === "inactive" ? "inactive" : "active";
    const unitId = normalizeText(personData.unitId);
    const tower = normalizeText(personData.tower);
    if (!email) {
        throw new https_1.HttpsError("failed-precondition", "El residente no tiene correo registrado.");
    }
    // documentNumber (cedula) ya no es credencial (onboarding por enlace); deja de ser
    // obligatorio para activar acceso. Sigue requiriendose para la capa fiscal EC (SRI),
    // que lo valida al emitir el comprobante, no aqui.
    if (!unitId) {
        throw new https_1.HttpsError("failed-precondition", "El residente no tiene unidad asociada.");
    }
    // Etiqueta legible de la unidad: usa el displayName del doc de unidad (unitId = doc id).
    // El fallback NUNCA debe incrustar el docId (antes era `${tower}-${unitId}`, que se
    // denormalizaba a reservas/paquetería/notificaciones como "torre1-<idFirestore>").
    // Si no hay displayName, se usa la torre legible o "Unidad" — jamás un ID crudo.
    let unitLabel = tower || "Unidad";
    try {
        const unitSnap = await db.collection("units").doc(unitId).get();
        const displayName = unitSnap.exists ? normalizeText(unitSnap.data().displayName) : "";
        if (displayName)
            unitLabel = displayName;
    }
    catch {
        /* usa el fallback legible */
    }
    const authApi = (0, auth_1.getAuth)();
    const existingUser = await authApi
        .getUserByEmail(email)
        .then((user) => user)
        .catch((error) => {
        const code = typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string"
            ? String(error.code)
            : "";
        if (code === "auth/user-not-found")
            return null;
        throw error;
    });
    // Onboarding por enlace: la cuenta nace con una clave aleatoria que nadie conoce.
    // El residente define su contrasena via el correo de restablecimiento (sendPasswordResetEmail),
    // por lo que la cedula deja de funcionar como credencial.
    const randomPassword = (0, password_policy_1.generateStrongPassword)();
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
    const now = firestore_1.Timestamp.now();
    const batch = db.batch();
    batch.set(db.collection("users").doc(userRecord.uid), {
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
    }, { merge: true });
    batch.set(db.collection("tenantUsers").doc(`${tenantId}_${userRecord.uid}`), {
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
    }, { merge: true });
    batch.set(personRef, {
        authUid: userRecord.uid,
        updatedAt: now,
    }, { merge: true });
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
function normalizeCreateTenantAdminPayload(data) {
    const tenantId = normalizeText(data.tenantId);
    const fullName = normalizeText(data.fullName);
    const email = normalizeEmail(data.email);
    const providedPassword = normalizeText(data.temporaryPassword);
    const status = data.status;
    if (!tenantId || !fullName || !email || !status) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear admin.");
    }
    // Onboarding por enlace: si no se teclea contrasena, se genera una aleatoria que
    // nadie conoce; el usuario definira la suya via correo de restablecimiento.
    if (providedPassword) {
        (0, password_policy_1.assertStrongPassword)(providedPassword, "contrasena temporal");
    }
    const temporaryPassword = providedPassword || (0, password_policy_1.generateStrongPassword)();
    assertAdminStatus(status);
    return {
        tenantId,
        fullName,
        email,
        temporaryPassword,
        status,
    };
}
function normalizeUpdateTenantAdminPayload(data) {
    const uid = normalizeText(data.uid);
    const tenantId = normalizeText(data.tenantId);
    const fullName = normalizeText(data.fullName);
    const email = normalizeEmail(data.email);
    const status = data.status;
    if (!uid || !tenantId || !fullName || !email || !status) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para actualizar admin.");
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
function normalizeCreateTenantOperationalUserPayload(data) {
    const tenantId = normalizeText(data.tenantId);
    const fullName = normalizeText(data.fullName);
    const email = normalizeEmail(data.email);
    const temporaryPassword = normalizeText(data.temporaryPassword);
    const role = normalizeText(data.role);
    const status = data.status;
    if (!tenantId || !fullName || !email || !role || !status) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear usuario operativo.");
    }
    // Onboarding por enlace (ver normalizeCreateTenantAdminPayload).
    if (temporaryPassword) {
        (0, password_policy_1.assertStrongPassword)(temporaryPassword, "contrasena temporal");
    }
    const finalPassword = temporaryPassword || (0, password_policy_1.generateStrongPassword)();
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
function mapTenantAdminError(error, fallbackMessage) {
    if (error instanceof https_1.HttpsError)
        return error;
    const code = typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
        ? String(error.code)
        : "";
    if (code === "auth/email-already-exists") {
        return new https_1.HttpsError("already-exists", "Ya existe un usuario con ese correo.");
    }
    if (code === "auth/invalid-email") {
        return new https_1.HttpsError("invalid-argument", "El correo no tiene un formato valido.");
    }
    if (code === "auth/invalid-password" || code === "auth/weak-password") {
        return new https_1.HttpsError("invalid-argument", "La contrasena temporal no cumple la politica minima.");
    }
    if (code === "auth/user-not-found") {
        return new https_1.HttpsError("not-found", "El usuario no existe.");
    }
    if (code === "auth/uid-already-exists") {
        return new https_1.HttpsError("already-exists", "El identificador del usuario ya existe.");
    }
    return new https_1.HttpsError("internal", fallbackMessage);
}
function assertTenantStatus(value) {
    if (value !== "active" && value !== "suspended" && value !== "trial") {
        throw new https_1.HttpsError("invalid-argument", "Estado de tenant invalido.");
    }
}
function assertOnboardingStatus(value) {
    if (value !== "not_started" && value !== "in_progress" && value !== "completed") {
        throw new https_1.HttpsError("invalid-argument", "Onboarding status invalido.");
    }
}
async function upsertUserProfile(input) {
    const profileData = {
        uid: input.uid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        tenantId: input.tenantId ?? null,
        status: "active",
        updatedAt: firestore_1.Timestamp.now(),
        ...(input.unitId ? { unitId: input.unitId } : {}),
        ...(input.unitLabel ? { unitLabel: input.unitLabel } : {}),
    };
    await db.collection("users").doc(input.uid).set({
        ...profileData,
        createdAt: firestore_1.Timestamp.now(),
    }, { merge: true });
}
exports.createTenant = (0, https_1.onCall)(async (request) => {
    assertSuperadmin(request.auth);
    const data = request.data;
    if (!data.name || !data.city || !data.planId || !data.adminEmail || !data.adminPassword) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear tenant.");
    }
    const tenantRef = db.collection("tenants").doc();
    const tenantId = tenantRef.id;
    const userRecord = await (0, auth_1.getAuth)().createUser({
        email: data.adminEmail,
        password: data.adminPassword,
        displayName: data.adminFullName,
    });
    await (0, auth_1.getAuth)().setCustomUserClaims(userRecord.uid, {
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
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
            createdBy: request.auth?.uid,
        });
        tx.set(db.collection("tenantUsers").doc(`${tenantId}_${userRecord.uid}`), {
            uid: userRecord.uid,
            tenantId,
            fullName: data.adminFullName,
            email: data.adminEmail,
            role: "tenant_admin",
            status: "active",
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        });
        tx.set(db.collection("users").doc(userRecord.uid), {
            uid: userRecord.uid,
            email: data.adminEmail,
            fullName: data.adminFullName,
            role: "tenant_admin",
            tenantId,
            status: "active",
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        }, { merge: true });
        tx.set(db.collection("auditLogs").doc(), {
            tenantId,
            actorUid: request.auth?.uid,
            action: "create_tenant",
            metadata: { adminUid: userRecord.uid },
            createdAt: firestore_1.Timestamp.now(),
        });
    });
    return { tenantId, adminUid: userRecord.uid };
});
exports.createTenantWorkspace = (0, https_1.onCall)(async (request) => {
    assertSuperadmin(request.auth);
    const data = request.data;
    if (!data.name || !data.city || !data.planId) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear tenant.");
    }
    assertTenantStatus(data.status);
    assertOnboardingStatus(data.onboardingStatus);
    const now = firestore_1.Timestamp.now();
    const moduleVariants = normalizeModuleVariants(data.moduleVariants);
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
    // Inicializa tenantSettings con los modos de operacion elegidos en el alta. Hoy el alta no
    // creaba este doc; al crearlo aqui, las variantes quedan disponibles desde el primer momento.
    await db.collection("tenantSettings").doc(tenantRef.id).set({
        tenantId: tenantRef.id,
        tenantName: data.name,
        moduleVariants,
        updatedAt: now,
    }, { merge: true });
    await db.collection("auditLogs").add({
        tenantId: tenantRef.id,
        actorUid: request.auth?.uid,
        action: "create_tenant_workspace",
        metadata: {
            city: data.city,
            planId: data.planId,
            moduleVariants,
        },
        createdAt: now,
    });
    return { tenantId: tenantRef.id };
});
exports.createTenantAdmin = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [email_1.resendApiKey],
}, async (request) => {
    assertSuperadmin(request.auth);
    const operationId = `createTenantAdmin_${Date.now()}`;
    try {
        const data = normalizeCreateTenantAdminPayload(request.data);
        const tenantRef = db.collection("tenants").doc(data.tenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists) {
            throw new https_1.HttpsError("not-found", "El tenant no existe.");
        }
        const authApi = (0, auth_1.getAuth)();
        const existingUser = await authApi
            .getUserByEmail(data.email)
            .then((user) => user)
            .catch((error) => {
            const code = typeof error === "object" &&
                error !== null &&
                "code" in error &&
                typeof error.code === "string"
                ? String(error.code)
                : "";
            if (code === "auth/user-not-found")
                return null;
            throw error;
        });
        if (existingUser) {
            throw new https_1.HttpsError("already-exists", "Ya existe un usuario con ese correo.");
        }
        const userRecord = await authApi.createUser({
            email: data.email,
            password: data.temporaryPassword,
            displayName: data.fullName,
            emailVerified: true,
            disabled: data.status !== "active",
        });
        const now = firestore_1.Timestamp.now();
        const batch = db.batch();
        batch.set(db.collection("users").doc(userRecord.uid), {
            uid: userRecord.uid,
            email: data.email,
            fullName: data.fullName,
            role: "tenant_admin",
            tenantId: data.tenantId,
            status: data.status,
            createdAt: now,
            updatedAt: now,
        }, { merge: true });
        batch.set(db.collection("tenantUsers").doc(`${data.tenantId}_${userRecord.uid}`), {
            uid: userRecord.uid,
            tenantId: data.tenantId,
            fullName: data.fullName,
            email: data.email,
            role: "tenant_admin",
            status: data.status,
            createdAt: now,
            updatedAt: now,
        }, { merge: true });
        try {
            await batch.commit();
            await authApi.setCustomUserClaims(userRecord.uid, {
                role: "tenant_admin",
                tenantId: data.tenantId,
            });
        }
        catch (persistError) {
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
        }
        catch (auditError) {
            console.warn("[createTenantAdmin] audit log write failed", {
                operationId,
                tenantId: data.tenantId,
                adminUid: userRecord.uid,
                error: auditError,
            });
        }
        return { uid: userRecord.uid };
    }
    catch (error) {
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
});
exports.updateTenantAdmin = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
}, async (request) => {
    assertSuperadmin(request.auth);
    const operationId = `updateTenantAdmin_${Date.now()}`;
    try {
        const data = normalizeUpdateTenantAdminPayload(request.data);
        const tenantRef = db.collection("tenants").doc(data.tenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists) {
            throw new https_1.HttpsError("not-found", "El tenant no existe.");
        }
        const authApi = (0, auth_1.getAuth)();
        const previousUserSnap = await db.collection("users").doc(data.uid).get();
        const previousTenantId = previousUserSnap.data()?.tenantId;
        await authApi.updateUser(data.uid, {
            email: data.email,
            displayName: data.fullName,
            disabled: data.status !== "active",
        });
        await authApi.setCustomUserClaims(data.uid, {
            role: "tenant_admin",
            tenantId: data.tenantId,
        });
        const now = firestore_1.Timestamp.now();
        const batch = db.batch();
        batch.set(db.collection("users").doc(data.uid), {
            uid: data.uid,
            email: data.email,
            fullName: data.fullName,
            role: "tenant_admin",
            tenantId: data.tenantId,
            status: data.status,
            updatedAt: now,
        }, { merge: true });
        if (previousTenantId && previousTenantId !== data.tenantId) {
            batch.delete(db.collection("tenantUsers").doc(`${previousTenantId}_${data.uid}`));
        }
        batch.set(db.collection("tenantUsers").doc(`${data.tenantId}_${data.uid}`), {
            uid: data.uid,
            tenantId: data.tenantId,
            fullName: data.fullName,
            email: data.email,
            role: "tenant_admin",
            status: data.status,
            updatedAt: now,
        }, { merge: true });
        await batch.commit();
        try {
            await writeAuditLog(data.tenantId, request.auth?.uid, "update_tenant_admin", {
                adminUid: data.uid,
                previousTenantId: previousTenantId ?? null,
            });
        }
        catch (auditError) {
            console.warn("[updateTenantAdmin] audit log write failed", {
                operationId,
                tenantId: data.tenantId,
                adminUid: data.uid,
                error: auditError,
            });
        }
        return { uid: data.uid };
    }
    catch (error) {
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
});
exports.createTenantOperationalUser = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [email_1.resendApiKey],
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para crear usuarios.");
    }
    const operationId = `createTenantOperationalUser_${Date.now()}`;
    try {
        const data = normalizeCreateTenantOperationalUserPayload(request.data);
        const tokenTenantId = normalizeText(request.auth.token?.tenantId);
        if (tokenTenantId && tokenTenantId !== data.tenantId) {
            throw new https_1.HttpsError("permission-denied", "No puedes crear usuarios en otro tenant.");
        }
        const actor = await assertActiveTenantAdmin(data.tenantId, request.auth.uid);
        const targetTenantId = actor.tenantId;
        const tenantRef = db.collection("tenants").doc(targetTenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists) {
            throw new https_1.HttpsError("not-found", "El tenant no existe.");
        }
        const authApi = (0, auth_1.getAuth)();
        const existingUser = await authApi
            .getUserByEmail(data.email)
            .then((user) => user)
            .catch((error) => {
            const code = typeof error === "object" &&
                error !== null &&
                "code" in error &&
                typeof error.code === "string"
                ? String(error.code)
                : "";
            if (code === "auth/user-not-found")
                return null;
            throw error;
        });
        if (existingUser) {
            throw new https_1.HttpsError("already-exists", "Ya existe un usuario con ese correo.");
        }
        const userRecord = await authApi.createUser({
            email: data.email,
            password: data.temporaryPassword,
            displayName: data.fullName,
            emailVerified: true,
            disabled: data.status !== "active",
        });
        const now = firestore_1.Timestamp.now();
        const batch = db.batch();
        batch.set(db.collection("users").doc(userRecord.uid), {
            uid: userRecord.uid,
            email: data.email,
            fullName: data.fullName,
            role: data.role,
            tenantId: targetTenantId,
            status: data.status,
            createdAt: now,
            updatedAt: now,
        }, { merge: true });
        batch.set(db.collection("tenantUsers").doc(`${targetTenantId}_${userRecord.uid}`), {
            uid: userRecord.uid,
            tenantId: targetTenantId,
            fullName: data.fullName,
            email: data.email,
            role: data.role,
            status: data.status,
            createdAt: now,
            updatedAt: now,
        }, { merge: true });
        try {
            await batch.commit();
            await authApi.setCustomUserClaims(userRecord.uid, {
                role: data.role,
                tenantId: targetTenantId,
            });
        }
        catch (persistError) {
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
    }
    catch (error) {
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
});
exports.setOperationalUserStatus = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    }
    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    const status = request.data?.status;
    if (!tenantId || !targetUid || (status !== "active" && status !== "inactive")) {
        throw new https_1.HttpsError("invalid-argument", "tenantId, uid y status (active|inactive) son requeridos.");
    }
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
    }
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;
    // No puedes desactivarte a ti mismo (evita auto-lockout).
    if (targetUid === request.auth.uid && status === "inactive") {
        throw new https_1.HttpsError("failed-precondition", "No puedes desactivar tu propia cuenta.");
    }
    // El objetivo debe ser un usuario operativo del mismo tenant.
    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const targetRole = membershipSnap.data().role;
    if (targetRole !== "tenant_admin" && targetRole !== "security_guard") {
        throw new https_1.HttpsError("failed-precondition", "Solo puedes gestionar usuarios operativos (admin o guarda).");
    }
    // Guardrail: no dejar el tenant sin ningún admin activo.
    if (targetRole === "tenant_admin" && status === "inactive") {
        const admins = await db
            .collection("tenantUsers")
            .where("tenantId", "==", targetTenantId)
            .where("role", "==", "tenant_admin")
            .get();
        const remainingActive = admins.docs.filter((d) => {
            const data = d.data();
            return d.id !== `${targetTenantId}_${targetUid}` && (data.status ?? "active") === "active";
        }).length;
        if (remainingActive === 0) {
            throw new https_1.HttpsError("failed-precondition", "No puedes desactivar al último administrador activo del conjunto.");
        }
    }
    const now = firestore_1.Timestamp.now();
    const batch = db.batch();
    batch.set(db.collection("users").doc(targetUid), { status, updatedAt: now }, { merge: true });
    batch.set(membershipRef, { status, updatedAt: now }, { merge: true });
    await batch.commit();
    const authApi = (0, auth_1.getAuth)();
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
});
exports.updateOperationalUser = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    }
    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    const fullName = request.data?.fullName !== undefined ? normalizeText(request.data.fullName) : undefined;
    const role = request.data?.role !== undefined
        ? normalizeText(request.data.role)
        : undefined;
    if (!tenantId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y uid son requeridos.");
    }
    if (fullName === undefined && role === undefined) {
        throw new https_1.HttpsError("invalid-argument", "No hay cambios para aplicar.");
    }
    if (fullName !== undefined && !fullName) {
        throw new https_1.HttpsError("invalid-argument", "El nombre no puede estar vacío.");
    }
    if (role !== undefined) {
        assertOperationalRole(role);
    }
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
    }
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;
    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const membership = membershipSnap.data();
    const currentRole = membership.role;
    if (currentRole !== "tenant_admin" && currentRole !== "security_guard") {
        throw new https_1.HttpsError("failed-precondition", "Solo puedes editar usuarios operativos (admin o guarda).");
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
            const data = d.data();
            return d.id !== `${targetTenantId}_${targetUid}` && (data.status ?? "active") === "active";
        }).length;
        if (remainingActive === 0) {
            throw new https_1.HttpsError("failed-precondition", "No puedes cambiar el rol del último administrador activo del conjunto.");
        }
    }
    const now = firestore_1.Timestamp.now();
    const updates = { updatedAt: now };
    if (fullName !== undefined)
        updates.fullName = fullName;
    if (role !== undefined)
        updates.role = role;
    const batch = db.batch();
    batch.set(db.collection("users").doc(targetUid), updates, { merge: true });
    batch.set(membershipRef, updates, { merge: true });
    await batch.commit();
    const authApi = (0, auth_1.getAuth)();
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
});
exports.deleteOperationalUser = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    }
    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    if (!tenantId || !targetUid) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y uid son requeridos.");
    }
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes gestionar usuarios de otro tenant.");
    }
    if (targetUid === request.auth.uid) {
        throw new https_1.HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta.");
    }
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;
    const membershipRef = db.collection("tenantUsers").doc(`${targetTenantId}_${targetUid}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError("not-found", "El usuario no pertenece a este tenant.");
    }
    const membership = membershipSnap.data();
    if (membership.role !== "tenant_admin" && membership.role !== "security_guard") {
        throw new https_1.HttpsError("failed-precondition", "Solo puedes eliminar usuarios operativos (admin o guarda).");
    }
    // Solo usuarios ya desactivados (soft-delete previo obligatorio).
    if ((membership.status ?? "active") !== "inactive") {
        throw new https_1.HttpsError("failed-precondition", "Primero debes desactivar al usuario; luego podrás eliminarlo.");
    }
    const authApi = (0, auth_1.getAuth)();
    const results = await Promise.allSettled([
        db.collection("users").doc(targetUid).delete(),
        membershipRef.delete(),
        authApi.deleteUser(targetUid).catch((error) => {
            const code = typeof error === "object" && error !== null && "code" in error
                ? String(error.code)
                : "";
            if (code === "auth/user-not-found")
                return; // ya no existe en Auth: ok
            throw error;
        }),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed && failed.status === "rejected") {
        console.error("[deleteOperationalUser] partial failure", failed.reason);
        throw new https_1.HttpsError("internal", "No fue posible completar la eliminación. Reintenta.");
    }
    await writeAuditLog(targetTenantId, request.auth.uid, "delete_operational_user", {
        uid: targetUid,
        role: membership.role,
    });
    return { ok: true };
});
exports.createDocumentFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    }
    const tenantId = normalizeText(request.data?.tenantId);
    const name = normalizeText(request.data?.name);
    const parentId = request.data?.parentId ? normalizeText(request.data.parentId) : null;
    const description = request.data?.description !== undefined ? normalizeText(request.data.description) : "";
    if (!tenantId || !name) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y name son requeridos.");
    }
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No puedes crear carpetas en otro tenant.");
    }
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;
    let depth = 0;
    let parentPath = "";
    if (parentId) {
        const parentSnap = await db.collection("documentFolders").doc(parentId).get();
        if (!parentSnap.exists) {
            throw new https_1.HttpsError("not-found", "La carpeta padre no existe.");
        }
        const parent = parentSnap.data();
        if (parent.tenantId !== targetTenantId) {
            throw new https_1.HttpsError("permission-denied", "La carpeta padre es de otro tenant.");
        }
        depth = (parent.depth ?? 0) + 1;
        if (depth > 4) {
            throw new https_1.HttpsError("failed-precondition", "Máximo 4 niveles de subcarpetas bajo la carpeta madre.");
        }
        parentPath = parent.path ?? parentId;
    }
    const profileSnap = await db.collection("users").doc(request.auth.uid).get();
    const createdByName = profileSnap.data()?.fullName ?? "";
    const now = firestore_1.Timestamp.now();
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
});
// Carpetas de sistema (find-or-create). Alojan archivos de cada fuente; son
// protegidas (no se renombran/mueven/eliminan) y usan el color reservado "system".
const SYSTEM_FOLDERS = {
    communications: { name: "Comunicados", description: "Adjuntos de los comunicados publicados. Carpeta del sistema." },
    regulations: { name: "Reglamentos", description: "Reglamentos del conjunto. Carpeta del sistema." },
    committee_agreements: { name: "Acuerdos de comité", description: "Actas y acuerdos de comité. Carpeta del sistema." },
    payment_receipts: { name: "Comprobantes de pago", description: "Comprobantes de pago aprobados de los residentes. Carpeta del sistema." },
    billing_closures: { name: "Cierres de cartera", description: "Reportes de cierre de períodos de cartera. Carpeta del sistema." },
    committee_reports: { name: "Reportes de comité", description: "Reportes de comité generados por período. Carpeta del sistema." },
    cartera_history: { name: "Histórico de cartera", description: "Histórico de recaudo (esperado vs cobrado) y morosos. Carpeta del sistema." },
    ledger_history: { name: "Histórico del libro", description: "Movimientos del libro guardados por período. Carpeta del sistema." },
};
async function ensureSystemFolderImpl(tenantId, actorUid, systemKey) {
    const cfg = SYSTEM_FOLDERS[systemKey];
    if (!cfg)
        throw new https_1.HttpsError("invalid-argument", "Carpeta de sistema desconocida.");
    const existing = await db
        .collection("documentFolders")
        .where("tenantId", "==", tenantId)
        .where("systemKey", "==", systemKey)
        .limit(1)
        .get();
    if (!existing.empty) {
        const found = existing.docs[0];
        const data = found.data();
        if (data.color !== "system" || data.system !== true) {
            await found.ref.update({ color: "system", system: true, updatedAt: firestore_1.Timestamp.now() });
        }
        return found.id;
    }
    const profileSnap = await db.collection("users").doc(actorUid).get();
    const createdByName = profileSnap.data()?.fullName ?? "";
    const now = firestore_1.Timestamp.now();
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
exports.ensureSystemFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const systemKey = normalizeText(request.data?.systemKey);
    if (!tenantId || !systemKey)
        throw new https_1.HttpsError("invalid-argument", "tenantId y systemKey requeridos.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const folderId = await ensureSystemFolderImpl(actor.tenantId, request.auth.uid, systemKey);
    return { folderId };
});
// Compatibilidad: el flujo de comunicados sigue llamando este nombre.
exports.ensureCommunicationsFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    if (!tenantId)
        throw new https_1.HttpsError("invalid-argument", "tenantId requerido.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const folderId = await ensureSystemFolderImpl(actor.tenantId, request.auth.uid, "communications");
    return { folderId };
});
// Actualizar carpeta: nombre, descripción y/o color (no cambia path/depth/parent;
// integridad intacta). El nombre del callable se conserva por compatibilidad.
const FOLDER_COLORS = ["gray", "blue", "green", "amber", "purple", "teal"];
exports.renameDocumentFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    const name = request.data?.name !== undefined ? normalizeText(request.data.name) : undefined;
    const description = request.data?.description !== undefined ? normalizeText(request.data.description) : undefined;
    const color = request.data?.color !== undefined ? normalizeText(request.data.color) : undefined;
    if (!tenantId || !folderId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    }
    if (name === undefined && description === undefined && color === undefined) {
        throw new https_1.HttpsError("invalid-argument", "No hay cambios para aplicar.");
    }
    if (name !== undefined && !name)
        throw new https_1.HttpsError("invalid-argument", "El nombre no puede estar vacío.");
    if (color !== undefined && !FOLDER_COLORS.includes(color))
        throw new https_1.HttpsError("invalid-argument", "Color no permitido.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const ref = db.collection("documentFolders").doc(folderId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().tenantId !== actor.tenantId) {
        throw new https_1.HttpsError("not-found", "La carpeta no existe en este tenant.");
    }
    if (snap.data().system === true) {
        throw new https_1.HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede modificar.");
    }
    const updates = { updatedAt: firestore_1.Timestamp.now() };
    if (name !== undefined)
        updates.name = name;
    if (description !== undefined)
        updates.description = description;
    if (color !== undefined)
        updates.color = color;
    await ref.update(updates);
    await writeAuditLog(actor.tenantId, request.auth.uid, "update_document_folder", { folderId, name, color });
    return { ok: true };
});
// Eliminar carpeta: solo si está vacía (sin subcarpetas ni documentos).
exports.deleteDocumentFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    if (!tenantId || !folderId)
        throw new https_1.HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const ref = db.collection("documentFolders").doc(folderId);
    const snap = await ref.get();
    if (!snap.exists || snap.data().tenantId !== actor.tenantId) {
        throw new https_1.HttpsError("not-found", "La carpeta no existe en este tenant.");
    }
    if (snap.data().system === true) {
        throw new https_1.HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede eliminar.");
    }
    const subs = await db
        .collection("documentFolders")
        .where("tenantId", "==", actor.tenantId)
        .where("parentId", "==", folderId)
        .limit(1)
        .get();
    if (!subs.empty)
        throw new https_1.HttpsError("failed-precondition", "La carpeta tiene subcarpetas. Vacíala antes de eliminar.");
    const docs = await db
        .collection("documents")
        .where("tenantId", "==", actor.tenantId)
        .where("folderId", "==", folderId)
        .limit(1)
        .get();
    if (!docs.empty)
        throw new https_1.HttpsError("failed-precondition", "La carpeta tiene documentos. Muévelos o elimínalos antes.");
    await ref.delete();
    await writeAuditLog(actor.tenantId, request.auth.uid, "delete_document_folder", { folderId });
    return { ok: true };
});
// Mover carpeta a otra carpeta (o a la raíz). Re-parenta la carpeta y recalcula
// path/depth de todo su subárbol; valida ciclos y que no supere los 4 niveles.
exports.moveDocumentFolder = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const folderId = normalizeText(request.data?.folderId);
    const targetParentId = request.data?.targetParentId ? normalizeText(request.data.targetParentId) : null;
    if (!tenantId || !folderId)
        throw new https_1.HttpsError("invalid-argument", "tenantId y folderId son requeridos.");
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const targetTenantId = actor.tenantId;
    const snap = await db.collection("documentFolders").where("tenantId", "==", targetTenantId).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const folder = all.find((f) => f.id === folderId);
    if (!folder)
        throw new https_1.HttpsError("not-found", "La carpeta no existe en este tenant.");
    if (folder.system === true) {
        throw new https_1.HttpsError("failed-precondition", "Es una carpeta del sistema y no se puede mover.");
    }
    const target = targetParentId ? all.find((f) => f.id === targetParentId) : null;
    if (targetParentId && !target)
        throw new https_1.HttpsError("not-found", "La carpeta destino no existe.");
    if (targetParentId === folderId)
        throw new https_1.HttpsError("failed-precondition", "No puedes mover una carpeta dentro de sí misma.");
    const oldPath = folder.path || folder.id;
    if (target && (target.id === folder.id || (target.path || target.id).startsWith(`${oldPath}/`))) {
        throw new https_1.HttpsError("failed-precondition", "No puedes mover una carpeta dentro de una de sus subcarpetas.");
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
        throw new https_1.HttpsError("failed-precondition", "El movimiento superaría los 4 niveles de subcarpetas.");
    }
    const newPath = target ? `${target.path || target.id}/${folderId}` : folderId;
    const depthDelta = newDepth - folderDepth;
    const now = firestore_1.Timestamp.now();
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
});
// Enlace de descarga: verifica admin, audita la descarga y emite una URL firmada de
// corta duración (10 min). Si el service account no puede firmar, cae al fileUrl.
exports.getDocumentDownloadUrl = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const documentId = normalizeText(request.data?.documentId);
    if (!documentId)
        throw new https_1.HttpsError("invalid-argument", "documentId requerido.");
    const snap = await db.collection("documents").doc(documentId).get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Documento no encontrado.");
    const docData = snap.data();
    if (!docData.tenantId)
        throw new https_1.HttpsError("failed-precondition", "Documento sin tenant.");
    await assertActiveTenantAdmin(docData.tenantId, request.auth.uid);
    await writeAuditLog(docData.tenantId, request.auth.uid, "download_document", {
        documentId,
        fileName: docData.fileName ?? null,
    });
    let url = docData.fileUrl ?? "";
    if (docData.storagePath) {
        try {
            const [signed] = await (0, storage_1.getStorage)()
                .bucket()
                .file(docData.storagePath)
                .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60 * 1000 });
            url = signed;
        }
        catch (error) {
            console.warn("[getDocumentDownloadUrl] firma no disponible; se usa fileUrl", error);
        }
    }
    if (!url)
        throw new https_1.HttpsError("internal", "No fue posible generar el enlace.");
    return { url };
});
exports.provisionResidentTemporaryAccess = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
    secrets: [email_1.resendApiKey],
}, async (request) => {
    const tenantId = normalizeText(request.data?.tenantId);
    const personId = normalizeText(request.data?.personId);
    if (!tenantId || !personId) {
        throw new https_1.HttpsError("invalid-argument", "Debes indicar tenant y residente para restablecer la clave.");
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
    }
    catch (error) {
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        console.error("[provisionResidentTemporaryAccess] failed", {
            actorUid: request.auth?.uid,
            tenantId,
            personId,
            error,
        });
        throw new https_1.HttpsError("internal", "No fue posible restablecer la clave temporal del residente.");
    }
});
exports.completeResidentPasswordChange = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesion para cambiar la contrasena.");
    }
    const uid = request.auth.uid;
    const currentPassword = normalizeText(request.data?.currentPassword);
    const newPassword = normalizeText(request.data?.newPassword);
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError("not-found", "No se encontro el perfil del residente.");
    }
    const profile = userSnap.data();
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
        throw new https_1.HttpsError("permission-denied", "Solo residentes pueden ejecutar este flujo.");
    }
    if (!mustChangePassword) {
        throw new https_1.HttpsError("failed-precondition", "Tu cuenta ya no requiere cambio de clave temporal.");
    }
    assertTemporaryPasswordPolicy({
        currentPassword,
        newPassword,
        documentNumber,
    });
    const authApi = (0, auth_1.getAuth)();
    await authApi.updateUser(uid, {
        password: newPassword,
        disabled: false,
    });
    const now = firestore_1.Timestamp.now();
    const batch = db.batch();
    batch.set(userRef, {
        mustChangePassword: false,
        temporaryPassword: false,
        passwordStatus: "updated",
        passwordChangedAt: now,
        updatedAt: now,
    }, { merge: true });
    if (tenantId) {
        batch.set(db.collection("tenantUsers").doc(`${tenantId}_${uid}`), {
            mustChangePassword: false,
            temporaryPassword: false,
            passwordStatus: "updated",
            updatedAt: now,
        }, { merge: true });
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
});
exports.seedDemoData = (0, https_1.onCall)(async (request) => {
    assertSuperadmin(request.auth);
    // Blindaje go-live: el seed crea cuentas con contrasenas conocidas (Demo1234*).
    // Solo se permite en el emulador o si se habilita explicitamente por env, nunca por accidente en prod.
    if (process.env.FUNCTIONS_EMULATOR !== "true" && process.env.ALLOW_DEMO_SEED !== "true") {
        throw new https_1.HttpsError("failed-precondition", "El seed de demo esta deshabilitado en este entorno.");
    }
    const now = firestore_1.Timestamp.now();
    const tenantId = "tenant-santa-maria";
    await db.collection("tenants").doc(tenantId).set({
        name: "Conjunto Residencial Santa Maria",
        city: "Bogota",
        status: "active",
        planId: "plus",
        onboardingStatus: "completed",
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.collection("communications").doc("com-1").set({
        tenantId,
        title: "Mantenimiento de ascensores",
        body: "Intervencion preventiva programada.",
        audience: "all",
        publishedAt: now,
    }, { merge: true });
    await db.collection("plans").doc("plus").set({
        id: "plus",
        limits: {
            users: 600,
            reservationsPerMonth: 1500,
        },
        updatedAt: now,
    }, { merge: true });
    const demoUsers = [
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
            await db.collection("tenantUsers").doc(`${demoUser.tenantId}_${userRecord.uid}`).set(tenantUserData, { merge: true });
        }
    }
    return {
        ok: true,
        seededUsers: demoUsers.map((user) => ({ email: user.email, role: user.role })),
        tenantId,
    };
});
exports.createVisitorPass = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para crear visitantes.");
    }
    const data = request.data;
    if (!data.tenantId ||
        !data.unitId ||
        !data.unitLabel ||
        !data.visitorName ||
        !data.documentNumber ||
        !data.qrCodeValue ||
        !data.date ||
        !data.scheduledTime) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear visitante.");
    }
    const membership = await assertTenantMember(data.tenantId, request.auth.uid);
    const role = membership.role;
    if (role !== "tenant_admin" && role !== "resident" && request.auth.token.role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para crear visitantes.");
    }
    if (role === "resident" && membership.unitId !== data.unitId) {
        throw new https_1.HttpsError("permission-denied", "Residente solo puede crear visitantes para su unidad.");
    }
    const scheduledDateTime = (0, datetimeValidation_1.combineDateAndTime)(data.date, data.scheduledTime);
    if (!scheduledDateTime || !(0, datetimeValidation_1.isDateTimeValid)(scheduledDateTime, "visitor")) {
        throw new https_1.HttpsError("failed-precondition", "INVALID_DATETIME");
    }
    const [towerValue, unitValue] = data.unitLabel.split("-");
    const hostResidentName = typeof data.hostResidentName === "string" && data.hostResidentName.trim().length > 0
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
        createdAt: firestore_1.Timestamp.now(),
        updatedAt: firestore_1.Timestamp.now(),
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
exports.registerWalkInVisit = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para registrar visitas.");
    }
    const data = request.data;
    if (!data.tenantId || !data.unitId || !data.unitLabel || !data.visitorName || !data.documentNumber) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para registrar la visita.");
    }
    const membership = await assertTenantMember(data.tenantId, request.auth.uid);
    const role = membership.role;
    const isGuard = role === "security_guard" || role === "security";
    if (!isGuard && role !== "tenant_admin" && request.auth.token.role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para registrar visitas.");
    }
    const variant = await getTenantVisitorsVariant(data.tenantId);
    if (variant !== "registro_simple") {
        throw new https_1.HttpsError("failed-precondition", "El registro simple de visitas no esta habilitado para este conjunto.");
    }
    const now = firestore_1.Timestamp.now();
    const serverDate = now.toDate();
    const date = typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)
        ? data.date
        : serverDate.toISOString().slice(0, 10);
    const scheduledTime = typeof data.scheduledTime === "string" && /^\d{2}:\d{2}/.test(data.scheduledTime)
        ? data.scheduledTime.slice(0, 5)
        : `${String(serverDate.getUTCHours()).padStart(2, "0")}:${String(serverDate.getUTCMinutes()).padStart(2, "0")}`;
    const [towerValue, unitValue] = data.unitLabel.split("-");
    const hostResidentName = typeof data.hostResidentName === "string" && data.hostResidentName.trim().length > 0
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
        await createNotifications(residentUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "visitor",
            title: "Visita registrada",
            description: `La porteria registro el ingreso de ${data.visitorName} a tu unidad.`,
            link: "/resident/visitors",
        })));
    }
    await writeAuditLog(data.tenantId, request.auth.uid, "register_walk_in_visit", {
        visitorPassId: createdRef.id,
        unitId: data.unitId,
    });
    return { visitorPassId: createdRef.id };
});
exports.confirmPackageReceipt = (0, https_1.onCall)(async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte para confirmar paquetes.");
    }
    const data = request.data;
    if (!data.tenantId || !data.packageId) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para confirmar paquete.");
    }
    const membership = await assertTenantMember(data.tenantId, request.auth.uid);
    if (membership.role !== "resident" && membership.role !== "tenant_admin" && request.auth.token.role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No tienes permisos para confirmar paquetes.");
    }
    const packageRef = db.collection("packages").doc(data.packageId);
    const packageSnap = await packageRef.get();
    if (!packageSnap.exists) {
        throw new https_1.HttpsError("not-found", "Paquete no encontrado.");
    }
    const pkg = packageSnap.data();
    if (pkg.tenantId !== data.tenantId) {
        throw new https_1.HttpsError("permission-denied", "El paquete no pertenece al tenant indicado.");
    }
    if (membership.role === "resident" && membership.unitId !== pkg.unitId) {
        throw new https_1.HttpsError("permission-denied", "Solo puedes confirmar paquetes de tu unidad.");
    }
    if (pkg.status === "delivered") {
        return { packageId: data.packageId, alreadyDelivered: true };
    }
    await packageRef.update({
        status: "delivered",
        receivedBy: request.auth.uid,
        receivedAt: firestore_1.Timestamp.now(),
        updatedBy: request.auth.uid,
        updatedAt: firestore_1.Timestamp.now(),
    });
    await writeAuditLog(data.tenantId, request.auth.uid, "confirm_package_receipt", {
        packageId: data.packageId,
    });
    return { packageId: data.packageId, alreadyDelivered: false };
});
exports.onCommunicationCreated = (0, firestore_2.onDocumentCreated)("communications/{communicationId}", async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId)
        return;
    const residentUids = await listTenantUidsByRoles(data.tenantId, ["resident"]);
    await createNotifications(residentUids.map((uid) => ({
        userId: uid,
        tenantId: data.tenantId,
        type: "communication",
        title: data.title?.trim() || "Nuevo comunicado",
        description: "La administracion publico un nuevo comunicado.",
        link: "/resident/communications",
    })));
});
exports.onPackageCreated = (0, firestore_2.onDocumentCreated)("packages/{packageId}", async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId || !data?.unitId)
        return;
    const residentUids = await listResidentUidsByUnit(data.tenantId, data.unitId);
    const guardUids = await listTenantUidsByRoles(data.tenantId, ["security_guard", "security"]);
    const payload = [
        ...residentUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "package",
            title: "Nuevo paquete registrado",
            description: `Se registro un paquete para tu unidad ${data.unitLabel ?? ""}.`.trim(),
            link: "/resident/packages",
        })),
    ];
    if ((data.status ?? "pending") === "pending") {
        payload.push(...guardUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "package",
            title: "Paquete pendiente de entrega",
            description: `Nuevo paquete pendiente ${data.unitLabel ? `(${data.unitLabel})` : ""}.`.trim(),
            link: "/guard/packages",
        })));
    }
    await createNotifications(payload);
});
exports.onReservationCreated = (0, firestore_2.onDocumentCreated)("reservations/{reservationId}", async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId)
        return;
    const adminUids = await listTenantUidsByRoles(data.tenantId, ["tenant_admin"]);
    const superadminUids = await listSuperadminUids();
    await createNotifications([
        ...adminUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "reservation",
            title: "Nueva reserva creada",
            description: `${data.amenity ?? "Amenidad"} ${data.unitLabel ? `- ${data.unitLabel}` : ""}`.trim(),
            link: "/admin/reservations",
        })),
        ...superadminUids.map((uid) => ({
            userId: uid,
            type: "reservation",
            title: "Nueva reserva en tenant",
            description: `Tenant ${data.tenantId} registro una nueva reserva.`,
            link: "/superadmin/analytics",
        })),
    ]);
});
exports.onReservationUpdated = (0, firestore_2.onDocumentUpdated)({ document: "reservations/{reservationId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after?.tenantId || !after?.createdBy)
        return;
    if (before?.status === after.status)
        return;
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
    if ((after.status === "cancelled" || after.status === "rejected") &&
        after.updatedBy &&
        after.updatedBy !== after.createdBy) {
        const [override, conjunto] = await Promise.all([
            getTenantNotificationOverride(after.tenantId, "reservation_rejected"),
            getTenantName(after.tenantId),
        ]);
        await deliverResidentNotifications("reservation_rejected", after.tenantId, [after.createdBy], { amenidad: after.amenity ?? "", conjunto }, override);
    }
});
// Notifica a los residentes en alcance cuando un acuerdo de comité se manda a
// firma / se publica (transición a "enviado").
exports.onCommitteeAgreementUpdated = (0, firestore_2.onDocumentUpdated)({ document: "committee_agreements/{agreementId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after?.tenantId)
        return;
    // Solo al transicionar a "enviado" (no en otras actualizaciones).
    if (before?.status === "enviado" || after.status !== "enviado")
        return;
    const tenantId = after.tenantId;
    const isInformativo = after.signatureMode === "informativo";
    let residentUids;
    if (after.signerScope === "selected" && Array.isArray(after.signerUnitIds) && after.signerUnitIds.length > 0) {
        const lists = await Promise.all(after.signerUnitIds.map((unitId) => listResidentUidsByUnit(tenantId, unitId)));
        residentUids = Array.from(new Set(lists.flat()));
    }
    else {
        residentUids = await listTenantUidsByRoles(tenantId, ["resident"]);
    }
    const key = isInformativo ? "agreement_info" : "agreement_signature";
    const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(tenantId, key),
        getTenantName(tenantId),
    ]);
    await deliverResidentNotifications(key, tenantId, residentUids, { fecha: after.sessionDate ?? "", conjunto }, override);
});
exports.onVisitorPassCreated = (0, firestore_2.onDocumentCreated)("visitorPasses/{visitorPassId}", async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId)
        return;
    const guardUids = await listTenantUidsByRoles(data.tenantId, ["security_guard", "security"]);
    const notifications = [
        ...guardUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "visitor",
            title: "Nuevo visitante registrado",
            description: `${data.visitorName ?? "Visitante"} ${data.unitLabel ? `para ${data.unitLabel}` : ""}`.trim(),
            link: "/guard/visitors",
        })),
    ];
    if (isTodayDateString(data.date)) {
        notifications.push(...guardUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "visitor",
            title: "Visitante programado para hoy",
            description: `${data.visitorName ?? "Visitante"} tiene ingreso programado hoy.`,
            link: "/guard/visitors",
        })));
    }
    await createNotifications(notifications);
});
exports.onTicketCreated = (0, firestore_2.onDocumentCreated)("tickets/{ticketId}", async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId)
        return;
    const adminUids = await listTenantUidsByRoles(data.tenantId, ["tenant_admin"]);
    const superadminUids = await listSuperadminUids();
    await createNotifications([
        ...adminUids.map((uid) => ({
            userId: uid,
            tenantId: data.tenantId,
            type: "ticket",
            title: "Nuevo PQRS recibido",
            description: data.subject?.trim() || "Se registro un nuevo ticket.",
            link: "/admin/pqrs",
        })),
        ...superadminUids.map((uid) => ({
            userId: uid,
            type: "ticket",
            title: "Nuevo PQRS en tenant",
            description: `Tenant ${data.tenantId} registro un nuevo PQRS.`,
            link: "/superadmin/analytics",
        })),
    ]);
});
// PQRS respondido: notifica al residente la primera vez que la administración responde.
exports.onTicketUpdated = (0, firestore_2.onDocumentUpdated)({ document: "tickets/{ticketId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after?.tenantId || !after?.residentId)
        return;
    const wasAnswered = before?.status === "responded" || before?.status === "resolved" || Boolean(before?.response);
    const isAnswered = after.status === "responded" || after.status === "resolved" || Boolean(after.response);
    if (wasAnswered || !isAnswered)
        return; // solo la primera vez que se responde.
    const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(after.tenantId, "ticket_answered"),
        getTenantName(after.tenantId),
    ]);
    await deliverResidentNotifications("ticket_answered", after.tenantId, [after.residentId], { asunto: after.subject ?? "", conjunto }, override);
});
// ── F2 · Notificaciones de cartera al residente ───────────────────────────────
const BILLING_CONCEPT_LABELS = {
    administracion: "Mantenimiento y Administración",
    extraordinaria: "Cuota extraordinaria",
    multa: "Multa / sanción",
    reparacion: "Reparación / daño",
    interes_mora: "Interés de mora",
    parqueadero: "Parqueadero / amenidad",
    otro: "Otro",
};
// Cobro nuevo individual. Los cobros de una importación masiva (source="import")
// se agrupan en un solo aviso vía el callable notifyBillingBatch.
exports.onBillingStatementCreated = (0, firestore_2.onDocumentCreated)({ document: "billingStatements/{statementId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId || !data?.unitId)
        return;
    if (data.source === "import")
        return; // el lote lo agrupa el callable.
    if ((data.balance ?? 0) <= 0)
        return; // sin saldo por cobrar, no se notifica.
    const residentUids = await listResidentUidsByUnit(data.tenantId, data.unitId);
    if (residentUids.length === 0)
        return;
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
exports.remindPackagePickup = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    const tenantId = request.data?.tenantId;
    const packageId = request.data?.packageId;
    if (!tenantId || !packageId) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y packageId son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    const snap = await db.collection("packages").doc(packageId).get();
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId) {
        throw new https_1.HttpsError("not-found", "Paquete no encontrado.");
    }
    if ((data?.status ?? "pending") !== "pending") {
        throw new https_1.HttpsError("failed-precondition", "El paquete ya fue entregado.");
    }
    const residentUids = await listResidentUidsByUnit(tenantId, data?.unitId ?? "");
    if (residentUids.length === 0)
        return { ok: true, notified: 0 };
    await createNotifications(residentUids.map((uid) => ({
        userId: uid,
        tenantId,
        type: "package",
        title: "Recordatorio: paquete en portería",
        description: `Tienes un paquete pendiente de recoger${data?.unitLabel ? ` (${data.unitLabel})` : ""}.`,
        link: "/resident/packages",
    })));
    return { ok: true, notified: residentUids.length };
});
// Aviso agrupado tras una importación masiva de cartera: 1 notificación por
// residente de las unidades afectadas (lo invoca el front al terminar el import).
exports.notifyBillingBatch = (0, https_1.onCall)({ cors: callableCorsOrigins, secrets: [email_1.resendApiKey] }, async (request) => {
    const tenantId = request.data?.tenantId;
    const period = request.data?.period ?? "";
    const unitIds = request.data?.unitIds ?? [];
    if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y unitIds son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    await assertFinanceManagementEnabled(tenantId);
    const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(tenantId, "billing_batch"),
        getTenantName(tenantId),
    ]);
    const lists = await Promise.all(unitIds.map((unitId) => listResidentUidsByUnit(tenantId, unitId)));
    const residentUids = Array.from(new Set(lists.flat()));
    if (residentUids.length === 0)
        return { ok: true, notified: 0 };
    await deliverResidentNotifications("billing_batch", tenantId, residentUids, { período: period, conjunto }, override);
    return { ok: true, notified: residentUids.length };
});
// Recordatorio de pago: reenvía un aviso a los residentes de las unidades indicadas
// (una unidad o todas las morosas). Lo dispara el admin manualmente.
exports.sendBillingReminder = (0, https_1.onCall)({ cors: callableCorsOrigins, secrets: [email_1.resendApiKey] }, async (request) => {
    const tenantId = request.data?.tenantId;
    const unitIds = request.data?.unitIds ?? [];
    if (!tenantId || !Array.isArray(unitIds) || unitIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "tenantId y unitIds son requeridos.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    await assertFinanceManagementEnabled(tenantId);
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
});
// Recordatorios programados: al dispararse, RECALCULA los pendientes de la campaña en ese
// momento y los notifica (no congela la lista al programar).
exports.sendScheduledReminders = (0, scheduler_1.onSchedule)({ schedule: "0 9 * * *", secrets: [email_1.resendApiKey] }, async () => {
    const now = new Date();
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    const snap = await db.collection("billingReminderJobs").where("status", "==", "scheduled").get();
    for (const docSnap of snap.docs) {
        const job = docSnap.data();
        if (!job.tenantId || !job.scheduledFor || job.scheduledFor > today)
            continue;
        // Pendientes actuales de la campaña.
        let pendingStmts = [];
        if (job.campaignId) {
            const s = await db
                .collection("billingStatements")
                .where("tenantId", "==", job.tenantId)
                .where("campaignId", "==", job.campaignId)
                .get();
            pendingStmts = s.docs.filter((d) => (d.data().balance ?? 0) > 0);
        }
        const unitIds = Array.from(new Set(pendingStmts.map((d) => d.data().unitId).filter(Boolean)));
        if (unitIds.length > 0) {
            const lists = await Promise.all(unitIds.map((u) => listResidentUidsByUnit(job.tenantId, u)));
            const residentUids = Array.from(new Set(lists.flat()));
            if (residentUids.length > 0) {
                const [override, conjunto] = await Promise.all([
                    getTenantNotificationOverride(job.tenantId, "billing_reminder"),
                    getTenantName(job.tenantId),
                ]);
                await deliverResidentNotifications("billing_reminder", job.tenantId, residentUids, { conjunto }, override);
                for (let i = 0; i < pendingStmts.length; i += 400) {
                    const batch = db.batch();
                    for (const d of pendingStmts.slice(i, i + 400))
                        batch.update(d.ref, { reminderCount: firestore_1.FieldValue.increment(1) });
                    await batch.commit();
                }
            }
        }
        await docSnap.ref.update({ status: "sent", sentAt: firestore_1.Timestamp.now(), notifiedUnits: unitIds.length });
    }
});
// Colecciones que referencian una unidad por su doc id (campo a re-apuntar al fusionar).
const UNIT_REF_FIELDS = [
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
exports.mergeUnits = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    const tenantId = normalizeText(request.data?.tenantId);
    const survivorId = normalizeText(request.data?.survivorId);
    const duplicateIds = (request.data?.duplicateIds ?? []).map((x) => normalizeText(x)).filter(Boolean);
    if (!tenantId || !survivorId || duplicateIds.length === 0) {
        throw new https_1.HttpsError("invalid-argument", "tenantId, survivorId y duplicateIds son requeridos.");
    }
    if (duplicateIds.includes(survivorId)) {
        throw new https_1.HttpsError("invalid-argument", "La unidad que se conserva no puede estar en las duplicadas.");
    }
    await assertTenantAdminOrSuper({ tenantId, uid: request.auth?.uid, role: request.auth?.token?.role });
    const survivorSnap = await db.collection("units").doc(survivorId).get();
    if (!survivorSnap.exists || survivorSnap.data().tenantId !== tenantId) {
        throw new https_1.HttpsError("not-found", "La unidad que se conserva no existe en este conjunto.");
    }
    const dupSnaps = await Promise.all(duplicateIds.map((id) => db.collection("units").doc(id).get()));
    for (const ds of dupSnaps) {
        if (!ds.exists || ds.data().tenantId !== tenantId) {
            throw new https_1.HttpsError("not-found", "Una de las unidades duplicadas no existe en este conjunto.");
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
                if (++n >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    n = 0;
                }
            }
            if (n > 0)
                await batch.commit();
        }
        // tenantUsers + su perfil en users/{uid}.
        const tuSnap = await db.collection("tenantUsers").where("tenantId", "==", tenantId).where("unitId", "==", dupId).get();
        let tuBatch = db.batch();
        let tn = 0;
        for (const d of tuSnap.docs) {
            tuBatch.update(d.ref, { unitId: survivorId });
            const uid = d.data().uid;
            if (uid)
                tuBatch.set(db.collection("users").doc(uid), { unitId: survivorId }, { merge: true });
            repointed++;
            tn += 2;
            if (tn >= 400) {
                await tuBatch.commit();
                tuBatch = db.batch();
                tn = 0;
            }
        }
        if (tn > 0)
            await tuBatch.commit();
    }
    // billingSchedules.targets[] (arrays): re-mapear y deduplicar.
    const schedSnap = await db.collection("billingSchedules").where("tenantId", "==", tenantId).where("status", "==", "scheduled").get();
    for (const d of schedSnap.docs) {
        const targets = d.data().targets ?? [];
        if (!targets.some((t) => duplicateIds.includes(t.unitId)))
            continue;
        const seen = new Set();
        const remapped = [];
        for (const t of targets) {
            const id = duplicateIds.includes(t.unitId) ? survivorId : t.unitId;
            if (seen.has(id))
                continue;
            seen.add(id);
            remapped.push({ ...t, unitId: id });
        }
        await d.ref.update({ targets: remapped });
    }
    // Fusionar listas de personas en la superviviente y borrar las duplicadas.
    const sData = survivorSnap.data();
    const owners = new Set(sData.ownerIds ?? []);
    const residents = new Set(sData.residentIds ?? []);
    for (const ds of dupSnaps) {
        const dd = ds.data();
        (dd.ownerIds ?? []).forEach((x) => owners.add(x));
        (dd.residentIds ?? []).forEach((x) => residents.add(x));
    }
    await db.collection("units").doc(survivorId).update({
        ownerIds: Array.from(owners),
        residentIds: Array.from(residents),
        updatedAt: firestore_1.Timestamp.now(),
    });
    const delBatch = db.batch();
    for (const id of duplicateIds)
        delBatch.delete(db.collection("units").doc(id));
    await delBatch.commit();
    await writeAuditLog(tenantId, request.auth?.uid, "units.merge", { survivorId, duplicateIds, repointed });
    return { ok: true, merged: duplicateIds.length, repointed };
});
// Notifica al residente el resultado de la revisión de su comprobante: aceptado con
// ajuste de monto, o no aceptado (con motivo). Lo dispara el admin desde la revisión.
exports.notifyResidentReceipt = (0, https_1.onCall)({ cors: callableCorsOrigins, secrets: [email_1.resendApiKey] }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const unitId = normalizeText(request.data?.unitId);
    const kind = request.data?.kind;
    if (!tenantId || !unitId || (kind !== "adjusted" && kind !== "rejected")) {
        throw new https_1.HttpsError("invalid-argument", "tenantId, unitId y kind son requeridos.");
    }
    const tokenTenantId = normalizeText(request.auth.token?.tenantId);
    if (tokenTenantId && tokenTenantId !== tenantId)
        throw new https_1.HttpsError("permission-denied", "Tenant incorrecto.");
    await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const residentUids = await listResidentUidsByUnit(tenantId, unitId);
    if (residentUids.length === 0)
        return { ok: true, notified: 0 };
    const conjunto = await getTenantName(tenantId);
    if (kind === "adjusted") {
        const override = await getTenantNotificationOverride(tenantId, "payment_adjusted");
        await deliverResidentNotifications("payment_adjusted", tenantId, residentUids, { monto: formatMoney(request.data?.amount ?? 0), conjunto }, override);
    }
    else {
        const override = await getTenantNotificationOverride(tenantId, "payment_rejected");
        await deliverResidentNotifications("payment_rejected", tenantId, residentUids, { motivo: normalizeText(request.data?.reason) || "el monto no coincide con el comprobante", conjunto }, override);
    }
    return { ok: true, notified: residentUids.length };
});
// Runs every day at 07:00 UTC (02:00 Colombia)
// Publica los cobros programados cuya fecha llegó: crea los billingStatements por unidad
// y notifica (agrupado si es lote, individual vía trigger si es una sola unidad).
exports.publishScheduledCharges = (0, scheduler_1.onSchedule)({ schedule: "0 8 * * *", secrets: [email_1.resendApiKey] }, async () => {
    const now = new Date();
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    const snap = await db.collection("billingSchedules").where("status", "==", "scheduled").get();
    for (const docSnap of snap.docs) {
        const s = docSnap.data();
        if (!s.tenantId || !s.scheduledFor || s.scheduledFor > today)
            continue;
        const targets = (s.targets ?? []).filter((t) => t && t.unitId);
        if (targets.length === 0) {
            await docSnap.ref.update({ status: "published", publishedAt: firestore_1.Timestamp.now() });
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
        let campaignId = null;
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
                sentAt: firestore_1.Timestamp.now(),
                status: "vigente",
                createdBy: actor,
                createdAt: firestore_1.Timestamp.now(),
                updatedAt: firestore_1.Timestamp.now(),
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
                createdAt: firestore_1.Timestamp.now(),
                updatedAt: firestore_1.Timestamp.now(),
            });
        }
        await batch.commit();
        // Lote: aviso agrupado. Individual (source "manual"): lo notifica onBillingStatementCreated.
        if (isBatch && amount > 0) {
            const lists = await Promise.all(targets.map((t) => listResidentUidsByUnit(s.tenantId, t.unitId)));
            const residentUids = Array.from(new Set(lists.flat()));
            if (residentUids.length > 0) {
                const [override, conjunto] = await Promise.all([
                    getTenantNotificationOverride(s.tenantId, "billing_batch"),
                    getTenantName(s.tenantId),
                ]);
                await deliverResidentNotifications("billing_batch", s.tenantId, residentUids, { período: period, conjunto }, override);
            }
        }
        await docSnap.ref.update({ status: "published", publishedAt: firestore_1.Timestamp.now() });
    }
});
exports.updateOverdueStatements = (0, scheduler_1.onSchedule)({ schedule: "0 7 * * *", secrets: [email_1.resendApiKey] }, async () => {
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
    const overdueByTenant = new Map(); // tenantId -> (unitId -> unitLabel)
    for (const doc of docs) {
        const d = doc.data();
        if (!d.tenantId || !d.unitId)
            continue;
        const units = overdueByTenant.get(d.tenantId) ?? new Map();
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
exports.onPaymentVoucherCreated = (0, firestore_2.onDocumentCreated)({ document: "paymentVouchers/{voucherId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const data = event.data?.data();
    if (!data)
        return;
    // Recibo disponible: notifica al residente de la unidad pagadora (cualquier país).
    if (data.tenantId && data.payerUnitId) {
        const residentUids = await listResidentUidsByUnit(data.tenantId, data.payerUnitId);
        if (residentUids.length > 0) {
            const [override, conjunto] = await Promise.all([
                getTenantNotificationOverride(data.tenantId, "billing_receipt"),
                getTenantName(data.tenantId),
            ]);
            await deliverResidentNotifications("billing_receipt", data.tenantId, residentUids, { período: formatPeriodFromDate(data.issueDate), conjunto }, override);
        }
    }
    // Transmisión al SRI (Ecuador) — comportamiento existente.
    if (data.issuerCountry !== "EC" || data.fiscalStatus !== "pending")
        return;
    await (0, sri_ecuador_1.transmitVoucher)(db, event.params.voucherId, sri_ecuador_1.stubSriTransport);
});
// ── F4 · Notificaciones de publicaciones del admin ────────────────────────────
// Reglamento nuevo: al subir un documento de categoría "reglamento" (el flujo de
// carga lo deja activo), notifica a todos los residentes para que lo firmen.
exports.onRegulationDocumentCreated = (0, firestore_2.onDocumentCreated)({ document: "documents/{documentId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const data = event.data?.data();
    if (!data?.tenantId || data.category !== "reglamento")
        return;
    const residentUids = await listTenantUidsByRoles(data.tenantId, ["resident"]);
    if (residentUids.length === 0)
        return;
    const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(data.tenantId, "regulation_new"),
        getTenantName(data.tenantId),
    ]);
    await deliverResidentNotifications("regulation_new", data.tenantId, residentUids, { conjunto }, override);
});
// Encuesta nueva: las encuestas se crean en borrador y se publican por update;
// notifica a los residentes al transicionar a "published". (El portal del
// residente filtra la visibilidad por audiencia; aquí avisamos a todos.)
exports.onSurveyUpdated = (0, firestore_2.onDocumentUpdated)({ document: "surveys/{surveyId}", secrets: [email_1.resendApiKey] }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after?.tenantId)
        return;
    if (before?.status === "published" || after.status !== "published")
        return;
    const residentUids = await listTenantUidsByRoles(after.tenantId, ["resident"]);
    if (residentUids.length === 0)
        return;
    const [override, conjunto] = await Promise.all([
        getTenantNotificationOverride(after.tenantId, "survey_new"),
        getTenantName(after.tenantId),
    ]);
    await deliverResidentNotifications("survey_new", after.tenantId, residentUids, { conjunto }, override);
});
// Reenvío / reintento manual de la transmisión (admin del tenant o superadmin).
exports.retransmitVoucher = (0, https_1.onCall)(async (request) => {
    const voucherId = request.data?.voucherId;
    if (!voucherId) {
        throw new https_1.HttpsError("invalid-argument", "voucherId requerido.");
    }
    const snap = await db.collection("paymentVouchers").doc(voucherId).get();
    if (!snap.exists) {
        throw new https_1.HttpsError("not-found", "Comprobante no encontrado.");
    }
    const voucher = snap.data();
    await assertTenantAdminOrSuper({
        tenantId: voucher.tenantId,
        uid: request.auth?.uid,
        role: request.auth?.token?.role,
    });
    await (0, sri_ecuador_1.transmitVoucher)(db, voucherId, sri_ecuador_1.stubSriTransport);
    return { ok: true };
});
// ── P4 · Archivo mensual automático: reporte de comité + histórico de cartera ──
const ARCHIVE_PATH = {
    cartera_history: "cartera-history",
    committee_reports: "committee-reports",
};
// Sube un buffer a Storage (con token de descarga) y lo registra en la carpeta de sistema.
async function archiveBuffer(input) {
    const token = (0, crypto_1.randomUUID)();
    const path = `tenants/${input.tenantId}/${ARCHIVE_PATH[input.systemKey]}/${input.sourceId}-${Date.now()}.${input.ext}`;
    const bucket = (0, storage_1.getStorage)().bucket();
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
        createdAt: firestore_1.Timestamp.now(),
        updatedAt: firestore_1.Timestamp.now(),
    });
}
// Construye un .xlsx server-side y lo archiva.
async function archiveXlsx(input) {
    const wb = XLSX.utils.book_new();
    for (const s of input.sheets) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31));
    }
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
    await archiveBuffer({
        ...input, ext: "xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer,
    });
}
// Construye un PDF simple (texto) a partir de pares etiqueta/valor.
function buildSummaryPdf(title, subtitle, rows) {
    return new Promise((resolve, reject) => {
        const docpdf = new pdfkit_1.default({ size: "A4", margin: 48 });
        const chunks = [];
        docpdf.on("data", (c) => chunks.push(c));
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
exports.monthlyFinancialArchive = (0, scheduler_1.onSchedule)({ schedule: "0 6 1 * *", timeoutSeconds: 540, memory: "512MiB" }, async () => {
    const now = new Date();
    const prev = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
    const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const stamp = now.toISOString().slice(0, 10);
    const tenants = await db.collection("tenants").get();
    for (const tDoc of tenants.docs) {
        const tenantId = tDoc.id;
        const status = tDoc.data().status;
        if (status && status !== "active" && status !== "trial")
            continue;
        try {
            const bsSnap = await db.collection("billingStatements").where("tenantId", "==", tenantId).get();
            if (bsSnap.empty)
                continue;
            const stmts = bsSnap.docs.map((d) => d.data());
            // ── Histórico de cartera (recaudo por período + morosos) ──
            const byPeriod = new Map();
            for (const s of stmts) {
                const k = s.period ?? "";
                if (!k)
                    continue;
                const e = byPeriod.get(k) ?? { f: 0, r: 0, p: 0 };
                e.f += s.amount ?? 0;
                e.r += s.paymentAmount ?? 0;
                e.p += s.balance ?? 0;
                byPeriod.set(k, e);
            }
            const periodRows = Array.from(byPeriod.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
                .map(([k, v]) => [k, v.f, v.r, v.f > 0 ? `${Math.round((v.r / v.f) * 100)}%` : "0%", v.p]);
            const byUnit = new Map();
            for (const s of stmts) {
                if ((s.balance ?? 0) <= 0)
                    continue;
                const id = s.unitId ?? "";
                const e = byUnit.get(id) ?? { label: s.unitLabel ?? id, deuda: 0, periodos: new Set() };
                e.deuda += s.balance ?? 0;
                if (s.period)
                    e.periodos.add(s.period);
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
            const monthLed = ledSnap.docs.map((d) => d.data()).filter((e) => (e.date ?? "").slice(0, 7) === prevMonth);
            const ingresosOtros = monthLed.filter((e) => e.type === "ingreso" && e.category !== "alicuota").reduce((a, e) => a + (e.amount ?? 0), 0);
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
        }
        catch (e) {
            console.error(`[monthly-archive][${tenantId}]`, e);
        }
    }
    console.log(`[monthly-archive] Procesados ${tenants.size} tenant(s) para ${prevMonth}.`);
});
// ── F2/G4 · Retención: anonimiza datos sensibles de comprobantes vencidos ─────
// Corre a diario; respeta el período por conjunto (default 12 meses).
exports.anonymizeExpiredVouchersDaily = (0, scheduler_1.onSchedule)("every day 03:00", async () => {
    const count = await (0, data_retention_1.anonymizeExpiredVouchers)(db);
    console.log(`[data-retention] Anonimizados ${count} comprobante(s).`);
});
exports.logClientError = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    const message = normalizeText(request.data?.message).slice(0, 2000);
    if (!message)
        return { ok: false };
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
// ── Onboarding por invitación (Opción B) ──────────────────────────────────────
// Público (sin auth): la página /activar los llama antes de tener sesión.
// Valida el token SIN consumirlo (GET de la página). Devuelve el estado para
// pintar el formulario o el mensaje de invitación inválida/expirada/usada.
exports.getAccountInvite = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    const token = normalizeText(request.data?.token);
    if (!token)
        return { status: "invalid" };
    const snap = await db.collection("accountInvites").doc(token).get();
    if (!snap.exists)
        return { status: "invalid" };
    const data = snap.data();
    if (data.usedAt)
        return { status: "used" };
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now())
        return { status: "expired" };
    return { status: "valid", email: data.email ?? "", fullName: data.fullName ?? "" };
});
// Consume el token (transaccional, un solo uso) y fija la contraseña. Solo aquí
// se invalida la invitación, por eso un escáner que hace GET no la rompe.
exports.activateAccount = (0, https_1.onCall)({ cors: callableCorsOrigins }, async (request) => {
    const token = normalizeText(request.data?.token);
    const password = typeof request.data?.password === "string" ? request.data.password : "";
    if (!token)
        throw new https_1.HttpsError("invalid-argument", "Falta el token de activación.");
    (0, password_policy_1.assertStrongPassword)(password, "contraseña");
    const ref = db.collection("accountInvites").doc(token);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new https_1.HttpsError("not-found", "La invitación no existe.");
        const data = snap.data();
        if (data.usedAt)
            throw new https_1.HttpsError("failed-precondition", "Esta invitación ya fue usada.");
        if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
            throw new https_1.HttpsError("failed-precondition", "La invitación expiró. Pide un nuevo enlace de acceso.");
        }
        if (!data.uid)
            throw new https_1.HttpsError("failed-precondition", "Invitación inválida.");
        tx.update(ref, { usedAt: firestore_1.Timestamp.now() });
        return { uid: data.uid };
    });
    await (0, auth_1.getAuth)().updateUser(result.uid, { password });
    await db.collection("users").doc(result.uid).set({ onboardingStatus: "completed", mustChangePassword: false, updatedAt: firestore_1.Timestamp.now() }, { merge: true });
    return { ok: true };
});
// Reenvía el acceso a un usuario operativo del mismo tenant (regenera invitación).
exports.resendAccountInvite = (0, https_1.onCall)({ cors: callableCorsOrigins, secrets: [email_1.resendApiKey] }, async (request) => {
    if (!request.auth?.uid)
        throw new https_1.HttpsError("unauthenticated", "Debes autenticarte.");
    const tenantId = normalizeText(request.data?.tenantId);
    const targetUid = normalizeText(request.data?.uid);
    if (!tenantId || !targetUid)
        throw new https_1.HttpsError("invalid-argument", "tenantId y uid son requeridos.");
    const actor = await assertActiveTenantAdmin(tenantId, request.auth.uid);
    const membershipSnap = await db.collection("tenantUsers").doc(`${actor.tenantId}_${targetUid}`).get();
    if (!membershipSnap.exists)
        throw new https_1.HttpsError("not-found", "El usuario no pertenece a este tenant.");
    const role = membershipSnap.data().role ?? "security_guard";
    const userSnap = await db.collection("users").doc(targetUid).get();
    const userData = userSnap.data();
    const authUser = await (0, auth_1.getAuth)().getUser(targetUid).catch(() => null);
    const email = userData?.email ?? authUser?.email ?? "";
    const fullName = userData?.fullName ?? authUser?.displayName ?? "";
    if (!email)
        throw new https_1.HttpsError("failed-precondition", "El usuario no tiene correo registrado.");
    await sendOnboardingInvite(targetUid, email, fullName, actor.tenantId, role, "welcome");
    await writeAuditLog(actor.tenantId, request.auth.uid, "resend_account_invite", { uid: targetUid });
    return { ok: true };
});
// ── Visitas sin salida registrada ─────────────────────────────────────────────
// Avisa a los guardias cuando una visita sigue "inside" y su fecha esperada de
// salida (validUntil para larga duración, date para puntual) ya pasó. Marca cada
// pase con exitAlertNotifiedAt para notificar una sola vez por pase (sin spam).
exports.notifyPendingVisitorExits = (0, scheduler_1.onSchedule)("0 8 * * *", async () => {
    const n = new Date();
    const todayStr = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
    // Igualdad simple (sin índice compuesto); se filtra el resto en código.
    const snap = await db.collection("visitorPasses").where("status", "==", "inside").get();
    const byTenant = new Map();
    const markBatch = db.batch();
    let pendingCount = 0;
    for (const doc of snap.docs) {
        const p = doc.data();
        if (p.exitAlertNotifiedAt)
            continue; // ya avisado
        if (!p.tenantId)
            continue;
        const expected = p.authorizationType === "larga_duracion" && p.validUntil ? p.validUntil : p.date;
        if (!expected || expected >= todayStr)
            continue; // aún no vencida
        byTenant.set(p.tenantId, (byTenant.get(p.tenantId) ?? 0) + 1);
        markBatch.update(doc.ref, { exitAlertNotifiedAt: firestore_1.Timestamp.now() });
        pendingCount += 1;
    }
    if (pendingCount === 0) {
        console.log("[visitor-exits] sin visitas pendientes de salida.");
        return;
    }
    await markBatch.commit();
    for (const [tenantId, count] of byTenant) {
        const guardUids = await listTenantUidsByRoles(tenantId, ["security_guard", "security"]);
        if (guardUids.length === 0)
            continue;
        await createNotifications(guardUids.map((uid) => ({
            userId: uid,
            tenantId,
            type: "visitor",
            title: "Visitas sin salida registrada",
            description: `${count} visita(s) siguen marcadas como “Dentro” y su fecha ya pasó. Revisa y registra la salida.`,
            link: "/guard/visitors",
        })));
    }
    console.log(`[visitor-exits] notificadas ${byTenant.size} comunidad(es), ${pendingCount} pase(s).`);
});
// ── Self-service: provisión del ambiente de prueba (Fase 1) ──────────────────
// Pública a propósito: la llama el registro del landing. La contención del
// abuso es rate limiting + verificación de correo del lado del llamador, y el
// "un correo = un trial" que valida provisionTrialWorkspace.
exports.createTrialWorkspace = (0, https_1.onCall)({ cors: callableCorsOrigins, invoker: "public", secrets: [email_1.resendApiKey] }, async (request) => {
    const d = request.data;
    if (!d?.email?.trim() || !d?.nombre?.trim() || !d?.conjunto?.trim() || !d?.ciudad?.trim()) {
        throw new https_1.HttpsError("invalid-argument", "Nombre, correo, conjunto y ciudad son obligatorios.");
    }
    const result = await (0, trial_workspace_1.provisionTrialWorkspace)(d);
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
});
