"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FULL_SERVICE_PLAN_ID = exports.TRIAL_PLAN_ID = exports.TRIAL_DAYS = void 0;
exports.provisionTrialWorkspace = provisionTrialWorkspace;
const node_crypto_1 = require("node:crypto");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const email_1 = require("./email");
const trial_seed_1 = require("./trial-seed");
/**
 * Provisión del ambiente de prueba (Fase 1 del self-service).
 *
 * Hace en UNA operación lo que hoy son dos pasos manuales de superadmin
 * (`createTenantWorkspace` + `createTenantAdmin`), y además crea las cuentas de
 * prueba del administrador y siembra el ambiente.
 *
 * Ver `docs/plan-self-service-trial.md`. Decisiones que este archivo
 * materializa y que NO deben cambiarse sin revisar el plan:
 * - El trial es un tenant REAL con `status:"trial"` — convertirlo a cliente es
 *   cambiar un flag, sin migrar datos.
 * - Se crean 2 cuentas de prueba (residente y portería) como cuentas TÉCNICAS
 *   del propio admin, para que vea ambos portales sin escribirle a terceros.
 */
/** Perezoso: `initializeApp()` corre en index.ts y los imports se evalúan antes. */
function getDb() {
    return (0, firestore_1.getFirestore)();
}
exports.TRIAL_DAYS = 15;
exports.TRIAL_PLAN_ID = "trial";
/**
 * Plan de un cliente contratado. Vivaru NO se vende por planes ni por módulos
 * sueltos: la contratación es del servicio completo. Este valor existe solo
 * para marcar el tenant como cliente en la consola interna.
 */
exports.FULL_SERVICE_PLAN_ID = "completo";
/** Dominio de las cuentas de prueba: no son correos reales de nadie. */
const DEMO_ACCOUNT_DOMAIN = "ejemplo.vivaru.app";
/**
 * Buzón comercial. Igual que en el front, **staging nunca le escribe**: un
 * trial de prueba no debe aparecer como prospecto real en la bandeja de ventas.
 * En functions el ambiente se deduce del proyecto en el que corre.
 */
const COMMERCIAL_INBOX = "comercial@qintilab.com";
const DEV_INBOX = "dev@qintilab.com";
function isProductionProject() {
    return (process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "") === "hogaru-1";
}
function notifyInbox() {
    return isProductionProject() ? COMMERCIAL_INBOX : DEV_INBOX;
}
function envSubjectTag() {
    return isProductionProject() ? "" : "[STAGING] ";
}
/** Slug legible y único a partir del nombre del conjunto. */
function buildTenantId(conjunto) {
    const base = conjunto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // quita diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "conjunto";
    // Sufijo aleatorio: dos prospectos con el mismo nombre no deben colisionar.
    return `${base}-${(0, node_crypto_1.randomUUID)().slice(0, 6)}`;
}
/** Contraseña legible para mostrarla al admin en "Mis cuentas de prueba". */
function demoPassword() {
    return `Demo${(0, node_crypto_1.randomUUID)().slice(0, 4).toUpperCase()}*`;
}
/**
 * Crea el ambiente de prueba completo. El llamador es responsable de haber
 * verificado el correo del prospecto y de aplicar rate limiting.
 */
async function provisionTrialWorkspace(input) {
    const db = getDb();
    const email = input.email.trim().toLowerCase();
    const authApi = (0, auth_1.getAuth)();
    // Un correo = un trial. Evita que alguien levante ambientes en serie.
    const existing = await authApi.getUserByEmail(email).catch(() => null);
    if (existing) {
        throw new https_1.HttpsError("already-exists", "Ya existe una cuenta con ese correo. Inicia sesión o contacta a un asesor.");
    }
    const tenantId = buildTenantId(input.conjunto);
    const now = firestore_1.Timestamp.now();
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + exports.TRIAL_DAYS * 24 * 60 * 60 * 1000);
    // ── 1. Tenant en estado trial ─────────────────────────────────────────────
    await db.collection("tenants").doc(tenantId).set({
        name: input.conjunto.trim(),
        city: input.ciudad.trim(),
        country: input.pais ?? "MX",
        currency: input.pais === "CO" ? "COP" : "MXN",
        status: input.asCustomer ? "active" : "trial",
        planId: input.asCustomer ? (input.planId?.trim() || exports.FULL_SERVICE_PLAN_ID) : exports.TRIAL_PLAN_ID,
        onboardingStatus: "not_started",
        // Un cliente no lleva vigencia de prueba.
        ...(input.asCustomer
            ? { convertedAt: startedAt.toISOString(), convertedBy: "superadmin" }
            : { trialStartedAt: startedAt.toISOString(), trialEndsAt: endsAt.toISOString() }),
        ...(input.leadId ? { leadId: input.leadId } : {}),
        branding: { primaryColor: "#0B3C5D", accentColor: "#1A7A45" },
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.collection("tenantSettings").doc(tenantId).set({ tenantId, tenantName: input.conjunto.trim(), brandColor: "#0B3C5D", updatedAt: now }, { merge: true });
    // ── 2. Administrador (el prospecto) ───────────────────────────────────────
    const adminUser = await authApi.createUser({
        email,
        displayName: input.nombre.trim(),
        emailVerified: true,
        password: (0, node_crypto_1.randomUUID)(), // se reemplaza al activar por enlace
    });
    const batch = db.batch();
    const adminProfile = {
        uid: adminUser.uid,
        email,
        fullName: input.nombre.trim(),
        role: "tenant_admin",
        tenantId,
        status: "active",
        createdAt: now,
        updatedAt: now,
    };
    batch.set(db.collection("users").doc(adminUser.uid), adminProfile, { merge: true });
    batch.set(db.collection("tenantUsers").doc(`${tenantId}_${adminUser.uid}`), adminProfile, { merge: true });
    // ── 3. Cuentas de prueba del admin (residente y portería) ─────────────────
    // Son cuentas técnicas, no correos de personas reales: así el admin recorre
    // ambos portales sin invitar a nadie ni compartir su contraseña.
    const demoAccounts = [];
    const demoSpecs = [
        { role: "resident", label: "Residente de prueba", local: "residente" },
        { role: "security_guard", label: "Portería de prueba", local: "porteria" },
    ];
    for (const spec of demoSpecs) {
        const demoEmail = `${spec.local}.${tenantId}@${DEMO_ACCOUNT_DOMAIN}`;
        const password = demoPassword();
        const demoUser = await authApi.createUser({
            email: demoEmail,
            displayName: spec.label,
            emailVerified: true,
            password,
        });
        const demoProfile = {
            uid: demoUser.uid,
            email: demoEmail,
            fullName: spec.label,
            role: spec.role,
            tenantId,
            status: "active",
            isDemoAccount: true,
            createdAt: now,
            updatedAt: now,
        };
        // El residente necesita unidad para ver su portal con datos.
        if (spec.role === "resident") {
            demoProfile.unitId = `${tenantId}--t1-101`;
            demoProfile.unitLabel = "T1-101";
        }
        batch.set(db.collection("users").doc(demoUser.uid), demoProfile, { merge: true });
        batch.set(db.collection("tenantUsers").doc(`${tenantId}_${demoUser.uid}`), demoProfile, { merge: true });
        await authApi.setCustomUserClaims(demoUser.uid, { role: spec.role, tenantId });
        demoAccounts.push({ role: spec.role, email: demoEmail, password });
    }
    await batch.commit();
    await authApi.setCustomUserClaims(adminUser.uid, { role: "tenant_admin", tenantId });
    // ── 4. Siembra (IDs prefijados por tenant) ────────────────────────────────
    // Por defecto se siembra en las pruebas (los módulos en vista previa deben
    // verse llenos) y NO en un alta de cliente, que carga sus datos reales.
    const shouldSeed = input.seedExamples ?? !input.asCustomer;
    const seeded = shouldSeed
        ? await (0, trial_seed_1.seedTrialWorkspace)(tenantId, input.pais === "CO" ? "COP" : "MXN")
        : {};
    // Las credenciales de prueba van en su PROPIA colección, no en tenantSettings:
    // ese doc lo puede leer cualquier miembro del tenant (incluidos residentes) y
    // aquí hay contraseñas en claro. `tenantDemoAccounts` solo lo lee el admin.
    await db.collection("tenantDemoAccounts").doc(tenantId).set({ tenantId, demoAccounts, updatedAt: now }, { merge: true });
    // ── 5. Lead: el ambiente queda atribuido a su origen comercial ────────────
    const leadId = input.leadId ?? (0, node_crypto_1.randomUUID)();
    await db.collection("leads").doc(leadId).set({
        origen: "trial",
        nombre: input.nombre.trim(),
        email,
        emailDomain: email.split("@")[1] ?? "",
        telefono: input.telefono ?? null,
        empresa: input.conjunto.trim(),
        ciudad: input.ciudad.trim(),
        pais: input.pais ?? "MX",
        unidadesEstimadas: input.unidadesEstimadas ?? null,
        tenantId,
        status: input.asCustomer ? "convertido" : "nuevo",
        appEnv: isProductionProject() ? "production" : "staging",
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await db.collection("tenants").doc(tenantId).set({ leadId, updatedAt: now }, { merge: true });
    // ── 6. Aviso al equipo — best-effort, nunca tumba la provisión ────────────
    try {
        await notifyTeamOfNewTrial({
            tenantId,
            trialEndsAt: endsAt.toISOString(),
            input: { ...input, email },
            seeded,
        });
    }
    catch (error) {
        console.error("[trial] aviso al equipo falló", { tenantId, error });
    }
    return {
        tenantId,
        adminUid: adminUser.uid,
        trialEndsAt: endsAt.toISOString(),
        demoAccounts,
        seeded,
    };
}
/**
 * Avisa al equipo comercial de un ambiente de prueba nuevo. Mismo criterio que
 * los formularios del landing: el correo es best-effort y nunca penaliza la
 * operación principal, y fuera de producción va al buzón interno.
 */
async function notifyTeamOfNewTrial(args) {
    const { tenantId, trialEndsAt, input } = args;
    const vence = trialEndsAt.slice(0, 10);
    const unidades = input.unidadesEstimadas ? `${input.unidadesEstimadas} unidades` : "unidades no declaradas";
    const body = [
        `${input.nombre.trim()} levantó un ambiente de prueba.`,
        "",
        `Conjunto:  ${input.conjunto.trim()}`,
        `Ubicación: ${input.ciudad.trim()}, ${input.pais ?? "MX"}`,
        `Tamaño:    ${unidades}`,
        `Correo:    ${input.email}`,
        `Teléfono:  ${input.telefono?.trim() || "no declarado"}`,
        "",
        `Ambiente:  ${tenantId}`,
        `Vence:     ${vence} (${exports.TRIAL_DAYS} días)`,
    ].join("\n");
    await (0, email_1.sendNotificationEmail)({
        to: notifyInbox(),
        subject: `${envSubjectTag()}[Trial] ${input.nombre.trim()} · ${input.conjunto.trim()} · ${input.ciudad.trim()}`,
        body,
        link: "/superadmin/ambientes",
    });
}
