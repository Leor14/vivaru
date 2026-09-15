/**
 * rellenar-audiencia-de-comunicados.mjs — pone `audience: "all"` a los comunicados que no la tienen.
 *
 * POR QUÉ EXISTE: `D-2b` (lote «Análisis de la plataforma», 15 sep 2026). La regla nueva de
 * `communications` deja al residente leer solo los comunicados de `audience: "all"` o los dirigidos
 * a su unidad, y su consulta filtra por esos campos. Un comunicado SIN `audience` —26 en producción
 * y 16 en staging, medidos el 15 sep; los anteriores a la audiencia (VIV-401) y los de semillas que
 * no la ponían— **dejaría de verlo el residente** el día que suba la regla. Este relleno va ANTES
 * de la regla. Ninguno de los que existen hoy es dirigido: todos son para el conjunto entero.
 *
 * QUÉ HACE. A cada comunicado sin `audience` le escribe `audience: "all"`, y `audienceTowers: []` y
 * `audienceUnitIds: []` si tampoco los tiene, más `audienceRellenadaEn` con la fecha, que es lo que
 * permite deshacerlo. No toca los que ya tienen `audience`.
 *
 *     node functions/scripts/rellenar-audiencia-de-comunicados.mjs <projectId>
 *     ... sin más            SECO: enseña qué escribiría, documento a documento
 *     ... --escribir         aplica
 *     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`
 *     ... --revertir         deshace lo que hizo este script (seco por defecto; con --escribir aplica)
 *
 * Credenciales: ADC (`gcloud auth application-default login`). Si falla por credenciales, la
 * reautenticación la hace David.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const [, , projectId, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
if (!projectId) {
  console.error("Uso: node functions/scripts/rellenar-audiencia-de-comunicados.mjs <projectId> [--escribir] [--si-produccion] [--revertir]");
  process.exit(1);
}
const escribir = banderas.has("--escribir");
const revertir = banderas.has("--revertir");
if (escribir && projectId === "hogaru-1" && !banderas.has("--si-produccion")) {
  console.error("Esto es PRODUCCIÓN. Para escribir hace falta además --si-produccion.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const snap = await db.collection("communications").get();

const objetivo = snap.docs.filter((d) => {
  const x = d.data();
  return revertir ? "audienceRellenadaEn" in x : !("audience" in x);
});

console.log(`${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""} — ${snap.size} comunicados; ${objetivo.length} ${revertir ? "rellenados por este script" : "sin audience"}\n`);
for (const d of objetivo) {
  const x = d.data();
  console.log(`  ${d.id.padEnd(28)} ${String(x.tenantId).padEnd(32)} ${String(x.title ?? "").slice(0, 50)}`);
}

if (!escribir) {
  console.log(`\n  En seco. Añade --escribir para aplicar${projectId === "hogaru-1" ? " (y --si-produccion)" : ""}.\n`);
  process.exit(0);
}

let batch = db.batch();
let ops = 0;
for (const d of objetivo) {
  const x = d.data();
  const cambio = revertir
    ? {
        audience: FieldValue.delete(),
        audienceRellenadaEn: FieldValue.delete(),
        // Solo se quitan las listas si este script las puso vacías.
        ...(Array.isArray(x.audienceTowers) && x.audienceTowers.length === 0 ? { audienceTowers: FieldValue.delete() } : {}),
        ...(Array.isArray(x.audienceUnitIds) && x.audienceUnitIds.length === 0 ? { audienceUnitIds: FieldValue.delete() } : {}),
      }
    : {
        audience: "all",
        ...("audienceTowers" in x ? {} : { audienceTowers: [] }),
        ...("audienceUnitIds" in x ? {} : { audienceUnitIds: [] }),
        audienceRellenadaEn: FieldValue.serverTimestamp(),
      };
  batch.update(d.ref, cambio);
  ops += 1;
  if (ops % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
if (ops % 400 !== 0) await batch.commit();
console.log(`\n  Escritos: ${ops}.\n`);
