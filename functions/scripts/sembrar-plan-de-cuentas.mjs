// Siembra el plan de cuentas estándar en UN conjunto que ya existe.
//
// `PRD-V-PLAT-003` R1 dice que todo conjunto NUEVO nace con su plan, y así es
// desde 1b-ii: lo hacen las dos altas (`createTenantWorkspace` y
// `provisionTrialWorkspace`). Pero **los conjuntos anteriores a esa capacidad se
// quedaron sin plan**, y la semilla no se repite. Esto es lo que los alcanza.
//
// **No reimplementa la semilla: importa la compilada.** `functions/lib/` sale de
// `functions/src/`, así que esto corre EXACTAMENTE el mismo código que el alta.
// Copiar las 18 cuentas aquí habría creado la quinta copia de algo que ya vive
// en un sitio, que es el defecto que este repositorio tiene catalogado tres
// veces. Si `lib/` está sin recompilar, el script lo dice y se para.
//
// **Es idempotente y no pisa nada.** `sembrarPlanDeCuentas` lee primero y solo
// escribe las que faltan, para no borrar el nombre que un administrador le haya
// puesto a una cuenta —que es justo lo que R3 permite cambiar—.
//
// OJO CON EL ALCANCE, que es una decisión y no un detalle: sembrar un conjunto
// **congela sus renombres y sus renúmeros**, porque una segunda pasada no los
// pisa. Lo que NO congela son las altas: una cuenta añadida a la semilla más
// tarde SÍ entra al volver a correr esto. Por eso sembrar en staging para poder
// mirar la pantalla es barato, y sembrar en producción antes de cerrar la
// semilla no lo es.
//
// Uso: node functions/scripts/sembrar-plan-de-cuentas.mjs <projectId> <tenantId> [--escribir]
//      Sin `--escribir` solo cuenta lo que haría.

import { existsSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, tenantId, ...resto] = process.argv.slice(2);
const escribir = resto.includes("--escribir");

if (!projectId || !tenantId) {
  console.error("Uso: node sembrar-plan-de-cuentas.mjs <projectId> <tenantId> [--escribir]");
  process.exit(1);
}

const compilado = new URL("../lib/plan-de-cuentas-siembra.js", import.meta.url);
if (!existsSync(compilado)) {
  console.error("\nFalta `functions/lib/`. Corre antes: npm --prefix functions run build");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const tenant = await db.collection("tenants").doc(tenantId).get();
if (!tenant.exists) {
  console.error(`\nNo existe el conjunto «${tenantId}» en ${projectId}. No se escribe nada.`);
  process.exit(1);
}

const { sembrarPlanDeCuentas } = await import(compilado.href);
const { SEMILLA_PLAN_DE_CUENTAS } = await import(new URL("../lib/plan-de-cuentas.js", import.meta.url).href);

const antes = await db.collection("chartOfAccounts").where("tenantId", "==", tenantId).get();
console.log(`\n${projectId} · ${tenantId}`);
console.log(`  semilla actual: ${SEMILLA_PLAN_DE_CUENTAS.length} cuentas`);
console.log(`  antes:          ${antes.size} en la base`);

if (!escribir) {
  const existentes = new Set(antes.docs.map((d) => d.id));
  const faltan = SEMILLA_PLAN_DE_CUENTAS.filter((c) => !existentes.has(`${tenantId}_${c.code}`));
  console.log(`  escribiría:     ${faltan.length} (${faltan.map((c) => c.code).join(", ") || "ninguna"})`);
  console.log("\n  Simulación. Vuelve a correrlo con --escribir para hacerlo.\n");
  process.exit(0);
}

const resultado = await sembrarPlanDeCuentas(db, tenantId, "sembrar-plan-de-cuentas-cli");

// Releer, no fiarse del retorno: es la única forma de saber qué quedó escrito.
const despues = await db.collection("chartOfAccounts").where("tenantId", "==", tenantId).get();
console.log(`  creadas:        ${resultado.creadas} (respetadas ${resultado.existentes})`);
console.log(`  después:        ${despues.size} en la base, releído`);

const conSystemKey = despues.docs.filter((d) => d.data().systemKey).length;
console.log(`  con systemKey:  ${conSystemKey}  ← CA1 pide 18, y 20 documentos en total`);
console.log("");
