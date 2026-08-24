// Marca los conjuntos de demostración que ya están sembrados, para que dejen
// de contarse como reales.
//
// POR QUÉ EXISTE. Los seeds de demo escriben en 28 colecciones y hasta el 14 de
// agosto de 2026 ninguna llevaba marcador, así que **cualquier métrica sacada
// de producción salía inflada**. Ya mintió dos veces: la volumetría de IA daba
// 20 tickets hasta que se separó a mano por tenant y quedaron 0, y el mismo 14
// de agosto daba 26 comunicaciones cuando las reales eran 2. Los seeds ya
// marcan el conjunto al sembrarlo; esto arregla lo sembrado antes.
//
// QUÉ ESCRIBE. Un campo, `isExample: true`, en el documento del CONJUNTO. Nada
// más. No toca unidades, ni personas, ni cobros, ni ninguna otra colección: el
// marcador del conjunto es el que descuenta todo lo suyo.
//
// LA LISTA NO SE ADIVINA. Sale de importar los propios módulos de datos de los
// seeds, así que no puede desviarse de lo que se siembra de verdad. Un
// heurístico por nombre —«los que empiecen por tenant-»— podría marcar un
// conjunto real, y eso lo borraría de todas las métricas sin que nadie lo note.
//
// Uso:
//   node functions/scripts/marcar-conjuntos-de-ejemplo.mjs hogaru-1
//   node functions/scripts/marcar-conjuntos-de-ejemplo.mjs hogaru-1 --escribir
//
// Sin `--escribir` no toca nada: enseña qué haría y qué conjuntos quedan fuera
// de la lista, para poder comprobar a ojo que no falta ninguno.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { TENANT_CO } from "./seed-data-co.mjs";
import { TENANT_MX } from "./seed-data-mx.mjs";
import { TENANT_PLAYAS } from "./seed-data-playas.mjs";

const projectId = process.argv[2];
const escribir = process.argv.includes("--escribir");

if (!projectId) {
  console.error("Uso: node marcar-conjuntos-de-ejemplo.mjs <projectId> [--escribir]");
  process.exit(1);
}

/**
 * Dos grupos, y la diferencia importa al revisarlos dentro de un año.
 *
 * **Sembrados por un script.** Los tres primeros salen de importar los propios
 * módulos de datos, así que no pueden desviarse de lo que se siembra.
 * `tenant-santa-maria` va a mano solo porque `seed-demo-users.mjs` declara su
 * id como constante local y no lo exporta.
 *
 * **Internos identificados a mano.** No los creó ningún seed: los creó una
 * prueba automatizada o una persona probando. Nadie puede deducirlos del
 * código, así que van con nombre y fecha de quién decidió que no son clientes.
 * Si mañana aparece otro, se añade aquí con la misma forma — y el listado de
 * «los otros conjuntos» de más abajo existe para que se vea.
 */
const DEMO = [
  { id: TENANT_PLAYAS.id, origen: "seed-tenant.mjs --tenant=playas" },
  { id: TENANT_CO.id, origen: "seed-tenant.mjs --tenant=co" },
  { id: TENANT_MX.id, origen: "seed-tenant.mjs --tenant=mx" },
  { id: "tenant-santa-maria", origen: "seed-demo-users.mjs" },

  { id: "tenant-e2e-resident-password", origen: "prueba E2E · confirmado por David, 14 ago 2026" },
  { id: "residencial-qintilab-mx-9c1293", origen: "pruebas internas de Qintilab · confirmado por David, 14 ago 2026" },
  // Suspendido, y se llama casi igual que dos conjuntos sembrados. Era el único
  // que aportaba una comunicación «real» a la volumetría: al descontarlo, las
  // comunicaciones reales de producción pasan de 2 a 1.
  { id: "pXHEn5iWKWgX4sDF9tVp", origen: "conjunto de pruebas · confirmado por David, 14 ago 2026" },
  // **Lo que este script avisaba que podía pasar, y pasó.** Estuvo meses en «los
  // otros conjuntos» de abajo, y la documentación —el roadmap, la wiki de IA y
  // la memoria— lo daba por CLIENTE REAL: la volumetría hablaba de «dos
  // conjuntos reales» contándolo. No lo era. Con esto, producción no tiene ni
  // uno.
  { id: "6PmHBr6DB8WNVMznz8O8", origen: "Conjunto Bromelias · confirmado por David, 24 ago 2026" },
  // El último. Con este, «los otros conjuntos» de abajo se queda VACÍO: no hay
  // ni un cliente real en producción, y la lista deja de ser una aproximación.
  { id: "queretarock-229-fc4c57", origen: "Queretarock 229 · confirmado por David, 24 ago 2026" },
];

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

async function main() {
  console.log(`\nConjuntos de demostración — proyecto ${projectId}`);
  console.log(escribir ? "MODO ESCRITURA\n" : "En seco. No se escribe nada.\n");

  const conocidos = new Set(DEMO.map((d) => d.id));
  const porMarcar = [];

  console.log("## Los que la lista dice que son de demostración\n");
  for (const { id, origen } of DEMO) {
    const snap = await db.collection("tenants").doc(id).get();
    if (!snap.exists) {
      console.log(`   —  ${id.padEnd(24)} no existe en este proyecto`);
      continue;
    }
    const data = snap.data();
    const ya = data.isExample === true;
    console.log(`   ${ya ? "✓" : "→"}  ${id.padEnd(24)} ${(data.name ?? "").slice(0, 34).padEnd(36)} ${ya ? "ya marcado" : `se marcaría · ${origen}`}`);
    if (!ya) porMarcar.push(id);
  }

  // Lo que NO está en la lista se enseña entero, y es la mitad útil del informe:
  // si aquí aparece un conjunto que era de demo, la lista está incompleta y los
  // números seguirán inflados sin que nadie se entere.
  const todos = await db.collection("tenants").select("name", "status", "isExample").get();
  const fuera = todos.docs.filter((d) => !conocidos.has(d.id));

  console.log(`\n## Los otros ${fuera.length} conjuntos del proyecto — comprueba que ninguno sea de demo\n`);
  for (const doc of fuera) {
    const d = doc.data();
    const marca = d.isExample === true ? "  [marcado como ejemplo]" : "";
    console.log(`      ${doc.id.slice(0, 24).padEnd(26)} ${(d.name ?? "(sin nombre)").slice(0, 34).padEnd(36)} ${d.status ?? "—"}${marca}`);
  }

  if (porMarcar.length === 0) {
    console.log("\nNo hay nada que marcar.\n");
    return;
  }

  if (!escribir) {
    console.log(`\nSe marcarían ${porMarcar.length} conjunto(s). Añade --escribir para hacerlo.\n`);
    return;
  }

  for (const id of porMarcar) {
    await db.collection("tenants").doc(id).set({ isExample: true }, { merge: true });
    console.log(`   ✓ marcado ${id}`);
  }
  console.log(`\n${porMarcar.length} conjunto(s) marcados. Vuelve a correr la volumetría para ver el efecto.\n`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
