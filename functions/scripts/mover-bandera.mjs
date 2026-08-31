// Enciende o apaga UNA bandera de funcionalidad en UN proyecto.
//
// Existe porque faltaba: `seed-feature-flags.mjs` es idempotente y NO
// destructivo a propósito —crea lo que falte y no toca un campo existente, para
// que correrlo dos veces no reencienda algo que alguien apagó a mano—, así que
// no sirve para mover nada. La única otra vía era `/superadmin/flags`, y no
// siempre se tiene la consola delante.
//
// Deliberadamente aburrido y explícito:
//   · El proyecto va como argumento, SIEMPRE. El activo de gcloud es `hogaru-1`,
//     que es producción, y `hogaru-1` no puede ser el default de nada.
//   · La clave se valida contra el catálogo: un typo no crea una bandera nueva
//     que no gobierna nada y que nadie encontrará.
//   · Imprime el antes y el después, para que quede leído y no supuesto.
//   · NO toca `killSwitch`. Si un kill switch está puesto, esto avisa y no
//     miente diciendo que la capacidad quedó encendida.
//
// Uso: node functions/scripts/mover-bandera.mjs <projectId> <clave> <true|false>
//      node functions/scripts/mover-bandera.mjs hogaru-1 ai-pqrs-shadow true

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const [projectId, clave, valorCrudo] = process.argv.slice(2);

// Espejo del catálogo (`functions/src/feature-flags.ts` y
// `src/lib/feature-flags/catalog.ts`). Es el tercer sitio, como el sembrador.
const CLAVES = [
  "ai-gateway",
  "ai-communications-draft",
  "ai-pqrs-shadow",
  "ai-pqrs-suggestions",
  "ai-onboarding-column-mapping",
  "ai-receipts-extraction",
  "ia-proveedor-real",
  "producto-importacion-masiva",
  "producto-reservas-servidor",
  "producto-cobro-por-coeficiente",
  "producto-registro-proveedores",
  "producto-plan-de-cuentas",
  "producto-concepto-al-libro",
  "producto-anticipos",
  "producto-expediente-conciliacion",
  "producto-notificaciones-push",
  "producto-padron-sin-duplicados",
  "producto-pago-multiple",
  "producto-multiconjunto",
  "producto-prorrateo-de-gastos",
  "producto-estado-de-cuenta",
  "producto-entrega-de-correo",
  "producto-calendario-de-cobranza",
  "operacion-app-check-monitor",
];

if (!projectId || !clave || (valorCrudo !== "true" && valorCrudo !== "false")) {
  console.error("Uso: node mover-bandera.mjs <projectId> <clave> <true|false>");
  console.error("Claves:", CLAVES.join(", "));
  process.exit(1);
}

if (!CLAVES.includes(clave)) {
  console.error(`«${clave}» no está en el catálogo. Claves válidas:`);
  console.error("  " + CLAVES.join("\n  "));
  process.exit(1);
}

const valor = valorCrudo === "true";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const ref = db.collection("featureFlags").doc(clave);

const antes = (await ref.get()).data();
console.log(`\n${projectId} · ${clave}`);
console.log("  antes:  ", antes ? `enabled=${antes.enabled} killSwitch=${antes.killSwitch} (por ${antes.updatedBy ?? "?"})` : "(sin documento — resolvía por el default del catálogo)");

await ref.set(
  { enabled: valor, updatedAt: Timestamp.now(), updatedBy: `mover-bandera:${process.env.USER ?? "cli"}` },
  { merge: true },
);

const despues = (await ref.get()).data();
console.log("  después:", `enabled=${despues.enabled} killSwitch=${despues.killSwitch}`);

// El kill switch gana sobre `enabled`, así que decirlo aquí evita el rato de
// «la encendí y no pasa nada».
const maestro = (await db.collection("featureFlags").doc("_global").get()).data();
if (maestro?.killSwitch === true) {
  console.log("\n  OJO: el kill switch MAESTRO está puesto. La capacidad sigue apagada.");
} else if (despues.killSwitch === true) {
  console.log("\n  OJO: esta bandera tiene su propio killSwitch puesto. Sigue apagada.");
}
console.log("");
