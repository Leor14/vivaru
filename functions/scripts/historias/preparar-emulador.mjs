// Prepara el EMULADOR para ensayar la semilla: un conjunto como Lomas de Sayilbedra (activo, de
// ejemplo, México, sin cliente detrás), sus ajustes, su plan de cuentas —con la función compilada
// del alta, no con una copia—, TODAS las banderas fijadas por override tal como resuelven en Lomas
// tras D4 y D5, y una administradora con cuenta.
//
// Se niega a correr fuera del emulador: no tiene nada que hacer en un proyecto real.
//
// Uso (con FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST puestos):
//   node functions/scripts/historias/preparar-emulador.mjs <proyecto demo-*> <tenantId>

import { createRequire } from "node:module";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const require = createRequire(import.meta.url);
const [proyecto, tenantId] = process.argv.slice(2);

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Esto solo corre contra el emulador: faltan FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST.");
  process.exit(1);
}
if (!proyecto?.startsWith("demo-") || !tenantId) {
  console.error("Uso: preparar-emulador.mjs <proyecto demo-*> <tenantId>");
  process.exit(1);
}

initializeApp({ projectId: proyecto });
const db = getFirestore();
const auth = getAuth();
const { sembrarPlanDeCuentas } = require("../../lib/plan-de-cuentas-siembra.js");
const { FEATURE_FLAG_DEFAULTS } = require("../../lib/feature-flags.js");

// Como resuelven en Lomas de Sayilbedra en producción tras D4 y D5 (medido el 13 sep, plan §12.8).
const ENCENDIDAS = new Set([
  "ai-gateway", "ai-pqrs-shadow", "ia-proveedor-real", "operacion-app-check-monitor",
  "producto-anticipos", "producto-calendario-de-cobranza", "producto-cobro-por-coeficiente",
  "producto-concepto-al-libro", "producto-egresos-en-cuotas", "producto-entrega-de-correo",
  "producto-estado-de-cuenta", "producto-importacion-masiva", "producto-informe-mensual",
  "producto-modo-oscuro", "producto-multiconjunto", "producto-pago-multiple", "producto-plan-de-cuentas",
  "producto-prorrateo-de-gastos", "producto-registro-proveedores", "producto-reservas-servidor",
  "producto-presupuesto-anual", "producto-medicion-de-consumos", "producto-tesoreria",
  "producto-rol-consejo", "producto-puerta-de-buzones",
]);

const ahora = Timestamp.now();
const NOMBRE = "Lomas de Sayilbedra (emulador)";

await db.collection("tenants").doc(tenantId).set({
  name: NOMBRE,
  city: "Puebla",
  country: "MX",
  currency: "MXN",
  status: "active",
  planId: "completo",
  onboardingStatus: "in_progress",
  onboardingTrack: "cliente",
  isExample: true,
  sinClienteDetras: true,
  createdAt: ahora,
  updatedAt: ahora,
});
await db.collection("tenantSettings").doc(tenantId).set(
  {
    tenantId,
    tenantName: NOMBRE,
    moduleVariants: {
      visitors: "qr_full",
      packages: "con_evidencia",
      pqrs: "con_sla",
      communications: "canal_oficial",
      finance: "completa",
      governance: "formal",
    },
    updatedAt: ahora,
  },
  { merge: true },
);
const siembra = await sembrarPlanDeCuentas(db, tenantId, "preparar-emulador");

const flags = Object.fromEntries(Object.keys(FEATURE_FLAG_DEFAULTS).map((k) => [k, ENCENDIDAS.has(k)]));
await db.collection("featureFlagOverrides").doc(tenantId).set({ tenantId, flags, updatedAt: ahora, updatedBy: "preparar-emulador" });

const email = "admin.emulador@ejemplo.vivaru.app";
const usuario = await auth.getUserByEmail(email).catch(() => null);
const uid = usuario?.uid ?? (await auth.createUser({ email, displayName: "Administración (emulador)", emailVerified: true })).uid;
await auth.setCustomUserClaims(uid, { role: "tenant_admin", tenantId });
const perfil = { uid, email, fullName: "Administración (emulador)", role: "tenant_admin", tenantId, status: "active", createdAt: ahora, updatedAt: ahora };
await db.collection("users").doc(uid).set(perfil, { merge: true });
await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set(perfil, { merge: true });

console.log(`Emulador ${proyecto}: conjunto ${tenantId} listo · plan de cuentas ${JSON.stringify(siembra)} · ${ENCENDIDAS.size} banderas encendidas por override · admin ${uid}`);
