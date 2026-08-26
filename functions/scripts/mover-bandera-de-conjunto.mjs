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

// Espejo del catálogo. Y son CINCO sitios, no cuatro: este comentario decía
// «el cuarto» y el de `seed-feature-flags.mjs` también, cada uno contando una
// lista distinta. `producto-multiconjunto` se añadió el 25 de agosto de 2026
// tocando los otros cuatro y se quedó fuera de aquí — es decir, se pudo
// encender global pero NO por conjunto, que es la vía del canario con la que se
// encendió el lote entero de Habitanto. Los cinco:
//   1. `src/lib/feature-flags/catalog.ts`          — el cliente
//   2. `functions/src/feature-flags.ts`            — el servidor
//   3. `functions/scripts/seed-feature-flags.mjs`  — crea los documentos
//   4. `functions/scripts/mover-bandera.mjs`       — enciende y apaga GLOBAL
//   5. este                                        — enciende y apaga POR CONJUNTO
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
  "producto-prorrateo-de-gastos",
  "producto-estado-de-cuenta",
  "operacion-app-check-monitor",
];

if (!projectId || !tenantId || !clave || (valorCrudo !== "true" && valorCrudo !== "false")) {
  console.error("Uso: node mover-bandera-de-conjunto.mjs <projectId> <tenantId> <clave> <true|false>");
  console.error("Claves:", CLAVES.join(", "));
  process.exit(1);
}

/**
 * **Banderas que SOLO se mueven en global, y por qué no basta con advertirlo.**
 *
 * `producto-multiconjunto` gobierna el selector de conjunto, que es un control
 * de NAVEGACIÓN — y un control de navegación no puede desaparecer como
 * consecuencia de navegar. La bandera se resuelve contra el conjunto ACTIVO
 * (`src/lib/feature-flags/provider.tsx:59`), así que apagarla en uno solo deja a
 * quien salte ahí **sin selector y sin forma de volver**: al reentrar,
 * `lastActiveTenantId` lo devuelve al mismo sitio.
 *
 * El catálogo del cliente ya lo advertía en su `alApagar` desde que nació, y
 * este script la aceptaba igual. **Advertido no es impedido**, y una advertencia
 * que no impide se lee el día que se escribe y ninguno más.
 */
const SOLO_GLOBAL = {
  "producto-multiconjunto":
    "gobierna el selector de conjunto. Apagarla en UNO deja encerrado a quien esté parado ahí: pierde el selector y no puede volver a los demás sin cerrar sesión.",
};

if (SOLO_GLOBAL[clave]) {
  console.error(`«${clave}» NO se mueve por conjunto: ${SOLO_GLOBAL[clave]}`);
  console.error(`Usa el movedor global:  node functions/scripts/mover-bandera.mjs ${projectId} ${clave} ${valorCrudo}`);
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
