/**
 * censar-tipos-de-unidad.mjs — cuenta qué dice de verdad el campo `type` de
 * cada unidad, en un proyecto.
 *
 * POR QUÉ EXISTE: `src/lib/units/tipos.ts` declara seis tipos válidos, pero el
 * mapa de rótulos de la página de residentes tolera además `commercial` y
 * `local`, que el esquema RECHAZA. Antes de tocar ese mapa hay que saber si esos
 * valores existen en los datos: si existen, borrar la tolerancia deja una
 * unidad que se ve bien en la tabla y **falla al editarla**.
 *
 * NO consulta por `type == "local"`. Un `where` es sensible a mayúsculas y
 * espacios, y `formatUnitType` normaliza (minúsculas + trim) ANTES de buscar el
 * rótulo — así que «Local» y «LOCAL» son casos vivos que una consulta directa
 * no vería. Aquí se leen TODAS las unidades y se tabula el valor crudo.
 *
 * Es de solo lectura por construcción: no hay ninguna escritura en este fichero.
 *
 *   node scripts/censar-tipos-de-unidad.mjs hogaru-1
 *   node scripts/censar-tipos-de-unidad.mjs vivaru-staging-02
 */
import { initializeApp, applicationDefault, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId] = process.argv.slice(2);
if (!projectId) {
  console.error("Falta el proyecto. Ej: node scripts/censar-tipos-de-unidad.mjs hogaru-1");
  process.exit(1);
}

// Copia deliberada del catálogo: este script corre en Node sin el alias `@/`,
// y su trabajo es comparar los DATOS contra lo que el esquema acepta.
const TIPOS_VALIDOS = ["apartment", "house", "office", "parking", "storage", "other"];
// Lo que el mapa de rótulos tolera de más — el objeto de este censo.
const TOLERADOS_DE_MAS = ["commercial", "local"];

const app = initializeApp({ credential: applicationDefault(), projectId }, `censo-${projectId}`);
const db = getFirestore(app);

console.log(`Proyecto: ${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""}\n`);

const snap = await db.collection("units").get();
const total = snap.size;

// El denominador se enseña siempre. Un «cero encontrados» sobre cero unidades
// leídas no verifica nada: es una puerta que se abre sobre un conjunto vacío.
console.log(`Unidades leídas: ${total}`);
if (total === 0) {
  console.log("\n⚠️  CERO unidades. Este censo no dice nada sobre el vocabulario.");
  await deleteApp(app);
  process.exit(0);
}

const porValor = new Map();
for (const d of snap.docs) {
  const crudo = d.data().type;
  const clave = crudo === undefined ? "(sin campo)" : crudo === null ? "(null)" : String(crudo);
  if (!porValor.has(clave)) porValor.set(clave, []);
  porValor.get(clave).push({ id: d.id, tenantId: d.data().tenantId, nombre: d.data().displayName });
}

const filas = [...porValor.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`\nValores distintos de \`type\`: ${filas.length}\n`);
console.log("  cuenta  valor (entre « » para que se vea el espacio)   ¿lo acepta el esquema?");
for (const [valor, docs] of filas) {
  const valido = TIPOS_VALIDOS.includes(valor);
  const normalizado = valor.trim().toLowerCase();
  let veredicto;
  if (valido) veredicto = "sí";
  else if (TOLERADOS_DE_MAS.includes(normalizado)) veredicto = "NO — y el mapa de rótulos lo tolera";
  else if (TIPOS_VALIDOS.includes(normalizado)) veredicto = `NO — pero normalizado sería «${normalizado}»`;
  else veredicto = "NO";
  console.log(`  ${String(docs.length).padStart(6)}  «${valor}»`.padEnd(56) + veredicto);
}

// El detalle de los que importan, para poder decidir con nombres delante.
const problematicos = filas.filter(([v]) => !TIPOS_VALIDOS.includes(v));
if (problematicos.length === 0) {
  console.log("\n✅ Todas las unidades llevan un tipo que el esquema acepta.");
} else {
  console.log("\n⚠️  Unidades con un tipo que el esquema RECHAZA (fallan al editarlas):");
  for (const [valor, docs] of problematicos) {
    console.log(`\n  «${valor}» — ${docs.length}:`);
    for (const u of docs.slice(0, 25)) {
      console.log(`    ${u.id}  tenant=${u.tenantId ?? "(sin tenantId)"}  ${u.nombre ?? "(sin nombre)"}`);
    }
    if (docs.length > 25) console.log(`    … y ${docs.length - 25} más`);
  }
}

await deleteApp(app);
