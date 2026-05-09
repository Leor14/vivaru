"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onTicketCreated = exports.onVisitorPassCreated = exports.onReservationUpdated = exports.onReservationCreated = exports.onPackageCreated = exports.onCommunicationCreated = exports.confirmPackageReceipt = exports.createVisitorPass = exports.seedDemoData = exports.completeResidentPasswordChange = exports.provisionResidentTemporaryAccess = exports.createTenantOperationalUser = exports.updateTenantAdmin = exports.createTenantAdmin = exports.createTenantWorkspace = exports.createTenant = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const callableCorsOrigins = [
    "https://hogaru-web--hogaru-1.us-central1.hosted.app",
    "http://localhost:3000",
];
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
    const fullName = normalizeText(personData.fullName) || "Residente HOGARU";
    const documentNumber = normalizeText(personData.documentNumber);
    const status = normalizeText(personData.status) === "inactive" ? "inactive" : "active";
    const unitId = normalizeText(personData.unitId);
    const tower = normalizeText(personData.tower);
    if (!email) {
        throw new https_1.HttpsError("failed-precondition", "El residente no tiene correo registrado.");
    }
    if (!documentNumber) {
        throw new https_1.HttpsError("failed-precondition", "El residente no tiene documento registrado.");
    }
    if (!unitId) {
        throw new https_1.HttpsError("failed-precondition", "El residente no tiene unidad asociada.");
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
    const userRecord = existingUser
        ? await authApi.updateUser(existingUser.uid, {
            email,
            displayName: fullName,
            password: documentNumber,
            disabled: status !== "active",
        })
        : await authApi.createUser({
            email,
            displayName: fullName,
            password: documentNumber,
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
        unitLabel: tower ? `${tower}-${unitId}` : unitId,
        documentNumber,
        status,
        mustChangePassword: true,
        temporaryPassword: true,
        passwordStatus: "temporary",
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
        unitLabel: tower ? `${tower}-${unitId}` : unitId,
        mustChangePassword: true,
        passwordStatus: "temporary",
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
    };
}
function normalizeCreateTenantAdminPayload(data) {
    const tenantId = normalizeText(data.tenantId);
    const fullName = normalizeText(data.fullName);
    const email = normalizeEmail(data.email);
    const temporaryPassword = normalizeText(data.temporaryPassword);
    const status = data.status;
    if (!tenantId || !fullName || !email || !temporaryPassword || !status) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear admin.");
    }
    if (temporaryPassword.length < 8) {
        throw new https_1.HttpsError("invalid-argument", "La contrasena temporal debe tener minimo 8 caracteres.");
    }
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
    if (!tenantId || !fullName || !email || !temporaryPassword || !role || !status) {
        throw new https_1.HttpsError("invalid-argument", "Datos incompletos para crear usuario operativo.");
    }
    if (temporaryPassword.length < 8) {
        throw new https_1.HttpsError("invalid-argument", "La contrasena temporal debe tener minimo 8 caracteres.");
    }
    assertAdminStatus(status);
    assertOperationalRole(role);
    return {
        tenantId,
        fullName,
        email,
        temporaryPassword,
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
exports.createTenantAdmin = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
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
exports.provisionResidentTemporaryAccess = (0, https_1.onCall)({
    cors: callableCorsOrigins,
    invoker: "public",
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
        const result = await upsertResidentTemporaryAccess({
            tenantId,
            personId,
            actorUid: request.auth?.uid,
        });
        return {
            ...result,
            temporaryPasswordSource: "documentNumber",
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
exports.onReservationUpdated = (0, firestore_2.onDocumentUpdated)("reservations/{reservationId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after?.tenantId || !after?.createdBy)
        return;
    if (before?.status === after.status)
        return;
    if (after.status !== "approved")
        return;
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
