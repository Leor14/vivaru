// Enciende o apaga UNA bandera en UN conjunto, sin tocar la global.
//
// Existe porque faltaba, y ya se notó: la override de
// `producto-concepto-al-libro` en `conjunto-las-playas` la escribió el 22 de
// agosto de 2026 un script suelto que nunca se commiteó —quedó en el documento
// como `updatedBy: "override-cli"` y no hay forma de volver a correrlo—.
// `mover-bandera.mjs` no sirve para esto: escribe `featureFlags/<clave>`, que es
// el valor GLOBAL, y encender ahí afecta a los ocho conjuntos de staging a la vez.
//
// Mismas reglas que su hermano, y por los mismos motivos:
//   · El proyecto va como argumento SIEMPRE. El activo de gcloud es `hogaru-1`,
//     que es producción, y no puede ser el default de nada.
//   · La clave se valida contra el catálogo: un typo crearía una override que no
//     gobierna nada y que nadie encontrará.
//   · Imprime el antes y el después, para que quede leído y no supuesto.
//   · NO toca el killSwitch, y avisa si hay uno puesto — si no, se pierde el rato
//     de «la encendí y no pasa nada».
//
// Uso: node functions/scripts/mover-bandera-de-conjunto.mjs <projectId> <tenantId> <clave> <true|false>

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const [projectId, tenantId, clave, valorCrudo] = process.argv.slice(2);

// Espejo del catálogo. Es el cuarto sitio, y por eso este comentario existe:
// `functions/src/feature-flags.ts`, `src/lib/feature-flags/catalog.ts`,
// `mover-bandera.mjs` y este.
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
  "producto-pago-multiple",
  "operacion-app-check-monitor",
];

if (!projectId || !tenantId || !clave || (valorCrudo !== "true" && valorCrudo !== "false")) {
  console.error("Uso: node mover-bandera-de-conjunto.mjs <projectId> <tenantId> <clave> <true|false>");
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

// El conjunto tiene que existir. Una override sobre un id mal escrito se
// escribe igual de bien y no gobierna nada — el mismo defecto que un typo en la
// clave, por el otro lado.
const tenant = await db.collection("tenants").doc(tenantId).get();
if (!tenant.exists) {
  console.error(`\nNo existe el conjunto «${tenantId}» en ${projectId}. No se escribe nada.`);
  process.exit(1);
}

const ref = db.collection("featureFlagOverrides").doc(tenantId);
const antes = (await ref.get()).data();
const valorAntes = antes?.flags?.[clave];

console.log(`\n${projectId} · ${tenantId} · ${clave}`);
console.log(
  "  antes:  ",
  valorAntes === undefined
    ? "(sin override — resolvía por el valor global o el default del catálogo)"
    : `${valorAntes} (por ${antes?.updatedBy ?? "?"})`,
);

await ref.set(
  {
    tenantId,
    flags: { [clave]: valor },
    updatedAt: Timestamp.now(),
    updatedBy: `mover-bandera-de-conjunto:${process.env.USER ?? "cli"}`,
  },
  // `merge: true` y no `mergeFields`: la ruta de campo sería `flags.<clave>` y
  // las claves llevan guiones, que en una ruta de Firestore hay que escapar con
  // acentos graves. Con merge normal la fusión de mapas es profunda —las otras
  // banderas del conjunto se conservan— y no hay nada que escapar. El propio
  // script lo comprueba imprimiéndolas después.
  { merge: true },
);

const despues = (await ref.get()).data();
console.log("  después:", despues?.flags?.[clave]);
console.log("  otras overrides de este conjunto:", JSON.stringify(despues?.flags ?? {}));

const propia = (await db.collection("featureFlags").doc(clave).get()).data();
const maestro = (await db.collection("featureFlags").doc("_global").get()).data();
if (maestro?.killSwitch === true) {
  console.log("\n  OJO: el kill switch MAESTRO está puesto. La capacidad sigue apagada.");
} else if (propia?.killSwitch === true) {
  console.log("\n  OJO: esta bandera tiene su propio killSwitch puesto. Sigue apagada.");
}
console.log("");
