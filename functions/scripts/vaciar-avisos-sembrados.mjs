// Vacía las comunicaciones que el seed le mete al conjunto de demostración,
// para poder sentar a un administrador delante de un módulo en blanco.
//
// POR QUÉ EXISTE. El piloto del Paso 2.6 mide la línea base a ciegas: los dos
// primeros avisos se escriben a mano y **sin haberle explicado antes cuáles son
// los cuatro datos** (`docs/guion-piloto-comunicaciones.md`). Tres avisos ya
// redactados en la pantalla son esa explicación, solo que en vez de dársela yo
// se la da el producto. El conjunto `tenant-palmas-cdmx` es el único sembrador
// que produce un edificio único —24 unidades, todas «Edificio A»—, que es el
// caso donde se ve el contexto del conjunto del 14 de agosto de 2026; hay que
// usar ese, así que hay que vaciarlo.
//
// BORRA POR ID EXACTO, NUNCA POR BARRIDO DE CONJUNTO. Un `where("tenantId")`
// se llevaría por delante lo que escriba el administrador en la sesión, que es
// justo la evidencia que la sesión existe para producir. Los tres ids salen de
// importar `COMMUNICATIONS_MX`, así que no pueden desviarse de lo que se
// siembra de verdad.
//
// Y COMPRUEBA EL DUEÑO ANTES DE BORRAR. `communications` es una colección de
// raíz: un id es global. Si algún día otro conjunto reusara `comm-001-mx`,
// borrarlo a ciegas sería llevarse algo ajeno. Se lee, se compara el
// `tenantId`, y solo entonces se borra.
//
// HAY QUE VOLVER A CORRERLO SI SE RESIEMBRA. `seed-tenant.mjs` escribe con
// `merge: true` sobre los mismos ids, así que un reseed los devuelve.
//
// Uso:
//   node functions/scripts/vaciar-avisos-sembrados.mjs vivaru-staging-02
//   node functions/scripts/vaciar-avisos-sembrados.mjs vivaru-staging-02 --escribir
//
// Sin `--escribir` no toca nada.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { TENANT_MX, COMMUNICATIONS_MX } from "./seed-data-mx.mjs";

const projectId = process.argv[2];
const escribir = process.argv.includes("--escribir");

if (!projectId) {
  console.error("Uso: node vaciar-avisos-sembrados.mjs <projectId> [--escribir]");
  process.exit(1);
}

// Deliberadamente NO se acepta el conjunto por parámetro. Este script existe
// para una cosa —dejar limpio el conjunto del piloto— y un parámetro invitaría
// a apuntarlo a un conjunto real, donde borrar comunicaciones es pérdida de
// datos y no preparación.
const TENANT_ID = TENANT_MX.id;
const IDS_SEMBRADOS = COMMUNICATIONS_MX.map((c) => c.id);

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function main() {
  console.log(`\n## Avisos sembrados en ${TENANT_ID} · proyecto ${projectId}\n`);

  const porBorrar = [];

  for (const id of IDS_SEMBRADOS) {
    const snap = await db.collection("communications").doc(id).get();

    if (!snap.exists) {
      console.log(`   ·  ${id.padEnd(16)} no existe`);
      continue;
    }

    const data = snap.data();

    // El dueño manda sobre el id. Un id conocido en el conjunto equivocado es
    // una coincidencia, no una autorización.
    if (data.tenantId !== TENANT_ID) {
      console.log(`   ⚠  ${id.padEnd(16)} pertenece a ${data.tenantId} — NO se toca`);
      continue;
    }

    console.log(`   →  ${id.padEnd(16)} ${(data.title ?? "").slice(0, 50)}`);
    porBorrar.push(id);
  }

  if (escribir && porBorrar.length > 0) {
    for (const id of porBorrar) {
      await db.collection("communications").doc(id).delete();
    }
    console.log(`\n   ✓ ${porBorrar.length} borrado(s).`);
  }

  // La mitad útil del informe. Lo que importa no es que se borraran tres, es
  // que al administrador el módulo le aparezca vacío: si aquí queda algo, la
  // línea base sigue contaminada y da igual lo que se haya borrado.
  const quedan = await db
    .collection("communications")
    .where("tenantId", "==", TENANT_ID)
    .select("title")
    .get();

  console.log(`\n## Lo que le quedaría al administrador en pantalla: ${quedan.size}\n`);
  for (const doc of quedan.docs) {
    console.log(`      ${doc.id.padEnd(16)} ${(doc.data().title ?? "(sin título)").slice(0, 50)}`);
  }

  if (!escribir) {
    console.log(
      porBorrar.length === 0
        ? "\nNo hay nada que borrar.\n"
        : `\nSe borrarían ${porBorrar.length}. Añade --escribir para hacerlo.\n`,
    );
    return;
  }

  if (quedan.size > 0) {
    console.log("\n⚠  Queda algo escrito. Míralo antes de la sesión: no es del seed.\n");
  } else {
    console.log("\nMódulo vacío. La línea base se puede tomar a ciegas.\n");
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
