#!/usr/bin/env node

/**
 * Limpieza segura de datos demo en Firestore
 *
 * Requisitos:
 * - Node 18+
 * - firebase-admin instalado
 *
 * Uso:
 * 1) Simulacion:
 *    node functions/scripts/clean-demo-data.js
 *
 * 2) Borrado real:
 *    DRY_RUN=false node functions/scripts/clean-demo-data.js
 *
 * Variables opcionales:
 * - GOOGLE_APPLICATION_CREDENTIALS=/ruta/service-account.json
 */

const admin = require("firebase-admin");

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "hogaru-1";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN !== "false";
const CONFIRM_DELETE = process.env.CONFIRM_DELETE === "YES_I_UNDERSTAND";

/**
 * Colecciones candidatas de datos demo/seed.
 * Incluye nombres actuales y legacy para no dejar residuos.
 */
const COLLECTIONS = [
  "tenants",
  "users",
  "tenantUsers",
  "units",
  "people",
  "residents",
  "familyMembers",
  "wallets",
  "ledger",
  "communications",
  "reservations",
  "amenities",
  "visitorAuthorizations",
  "visitors",
  "packages",
  "pqrs",
  "documents",
  "dashboardBlocks",
];

/**
 * Criterios de demo / seed
 */
const DEMO_TENANT_IDS = ["demo-tenant", "tenant-demo", "santamaria-demo", "hogaru-demo"];

const DEMO_TENANT_SLUGS = ["demo", "santamaria", "hogaru-demo", "home4u-demo"];

const DEMO_EMAILS = [
  "superadmin@hogaru.co",
  "admin@santamaria.co",
  "residente@santamaria.co",
  "demo@home4u.co",
  "marta.owner@demo.co",
  "jorge.resident@demo.co",
  "laura.tenant@demo.co",
];

/**
 * IDs seed conocidos para limpieza puntual
 */
const KNOWN_SEED_DOC_IDS = [
  "u-t1-101",
  "u-t1-102",
  "u-t2-503",
  "p-owner-1",
  "p-resident-1",
  "p-tenant-1",
  "com-seed-1",
  "res-seed-1",
  "vis-seed-1",
];

async function deleteDocs(docRefs) {
  if (!docRefs.length) return 0;

  let batch = db.batch();
  let count = 0;

  for (let i = 0; i < docRefs.length; i++) {
    batch.delete(docRefs[i]);
    count++;

    if ((i + 1) % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  return count;
}

async function getDocRefs(query) {
  const snap = await query.get();
  return snap.docs.map((d) => d.ref);
}

async function collectDemoRefs(collectionName) {
  const col = db.collection(collectionName);
  const refsMap = new Map();

  const safeAdd = (refs) => {
    for (const ref of refs) refsMap.set(ref.path, ref);
  };

  const attempts = [
    () => getDocRefs(col.where("isDemo", "==", true)),
    () => getDocRefs(col.where("isSeed", "==", true)),
  ];

  for (const tenantId of DEMO_TENANT_IDS) {
    attempts.push(() => getDocRefs(col.where("tenantId", "==", tenantId)));
  }

  for (const tenantSlug of DEMO_TENANT_SLUGS) {
    attempts.push(() => getDocRefs(col.where("tenantSlug", "==", tenantSlug)));
  }

  for (const email of DEMO_EMAILS) {
    attempts.push(() => getDocRefs(col.where("email", "==", email)));
  }

  for (const run of attempts) {
    try {
      const refs = await run();
      safeAdd(refs);
    } catch (err) {
      // Algunas colecciones no tendran esos campos o requeriran index.
      console.warn(
        `[WARN] ${collectionName}: no se pudo consultar un criterio -> ${err.message}`
      );
    }
  }

  // Intento adicional por IDs seed conocidos.
  for (const docId of KNOWN_SEED_DOC_IDS) {
    try {
      const ref = col.doc(docId);
      const snap = await ref.get();
      if (snap.exists) refsMap.set(ref.path, ref);
    } catch (err) {
      console.warn(`[WARN] ${collectionName}: no se pudo consultar ID ${docId} -> ${err.message}`);
    }
  }

  return [...refsMap.values()];
}

async function main() {
  console.log("\nIniciando limpieza de datos demo");
  console.log(`Proyecto: ${PROJECT_ID}`);
  console.log(`Modo: ${DRY_RUN ? "SIMULACION (no borra)" : "BORRADO REAL"}\n`);

  if (!DRY_RUN && !CONFIRM_DELETE) {
    console.error("Falta confirmacion explicita para borrado real.");
    console.error("Ejecuta con: DRY_RUN=false y CONFIRM_DELETE=YES_I_UNDERSTAND");
    process.exit(1);
  }

  // Validacion temprana para evitar falsos "0 registros" cuando no hay auth.
  try {
    await db.collection("healthcheck").limit(1).get();
  } catch (err) {
    console.error("No se pudo autenticar contra Firestore. Verifica ADC o service account.");
    console.error(`Detalle: ${err.message}`);
    process.exit(1);
  }

  let totalFound = 0;
  let totalDeleted = 0;

  for (const collectionName of COLLECTIONS) {
    try {
      const refs = await collectDemoRefs(collectionName);
      totalFound += refs.length;

      if (!refs.length) {
        console.log(`- ${collectionName}: sin registros demo detectados`);
        continue;
      }

      console.log(`- ${collectionName}: ${refs.length} registro(s) detectado(s)`);
      refs.forEach((ref) => console.log(`   - ${ref.path}`));

      if (!DRY_RUN) {
        const deleted = await deleteDocs(refs);
        totalDeleted += deleted;
        console.log(`   eliminados: ${deleted}`);
      }
    } catch (err) {
      console.error(`Error en coleccion ${collectionName}: ${err.message}`);
    }
  }

  console.log("\nResumen:");
  console.log(`- Detectados: ${totalFound}`);
  console.log(`- Eliminados: ${DRY_RUN ? 0 : totalDeleted}`);
  console.log(`- Estado: ${DRY_RUN ? "sin cambios" : "limpieza completada"}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error general:", err);
    process.exit(1);
  });
