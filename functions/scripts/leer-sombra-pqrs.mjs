// SOLO LECTURA: en qué anda la sombra de PQRS (Fase 4 de PRD-VAI-FEAT-002).
//
// Contesta tres preguntas que de otro modo hay que mirar a ojo en la consola,
// que es justo lo que este programa dejó de hacer: si la sombra está encendida,
// cuántos tickets ha visto y en qué estado quedaron, y cuántos pares
// sugerencia/decisión hay ya listos para medir G7.
//
// NO imprime contenido de ningún documento. `aiAssistance` guarda el resumen y
// el borrador propuestos —es el único sitio del programa donde eso se
// persiste—, y un script de diagnóstico no es motivo para sacarlos a una
// terminal. Solo salen estados, conteos y ejes de clasificación, que son
// catálogos cerrados.
//
// La sombra exige DOS banderas encendidas, y por eso se imprimen las dos:
// `ai-gateway` (el kill switch maestro tiene que poder apagarla como apaga todo)
// y `ai-pqrs-shadow`. A propósito NO exige `ai-pqrs-suggestions`, que es la que
// hace visible la sugerencia: atarlas sería lo contrario de F4.
//
// Uso: node functions/scripts/leer-sombra-pqrs.mjs <projectId>
//      node functions/scripts/leer-sombra-pqrs.mjs vivaru-staging-02
//
// OJO: el proyecto va SIEMPRE explícito. El activo de gcloud es `hogaru-1`, que
// es producción.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node leer-sombra-pqrs.mjs <projectId>");
  console.error("     node leer-sombra-pqrs.mjs vivaru-staging-02");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/** Misma precedencia que `resolveFeatureFlag` en functions/src/feature-flags.ts. */
async function leerBandera(key) {
  const [global, propia] = await Promise.all([
    db.collection("featureFlags").doc("_global").get(),
    db.collection("featureFlags").doc(key).get(),
  ]);
  if (global.data()?.killSwitch === true) return { enabled: false, origen: "kill_switch_maestro" };
  if (propia.data()?.killSwitch === true) return { enabled: false, origen: "kill_switch_bandera" };
  const valor = propia.data()?.enabled;
  if (typeof valor === "boolean") return { enabled: valor, origen: "valor_global" };
  return { enabled: false, origen: "default_catalogo (nace apagada)" };
}

console.log(`\n=== Sombra de PQRS · ${projectId} ===\n`);

console.log("Banderas (globales; un conjunto puede tener override propio):");
for (const key of ["ai-gateway", "ai-pqrs-shadow", "ai-pqrs-suggestions", "ia-proveedor-real"]) {
  const { enabled, origen } = await leerBandera(key);
  const nota = key === "ai-pqrs-suggestions" ? "  (la sombra NO la exige)" : "";
  console.log(`  ${enabled ? "ENCENDIDA" : "apagada  "}  ${key}  [${origen}]${nota}`);
}

const snap = await db.collection("aiAssistance").get();
console.log(`\nFilas de aiAssistance: ${snap.size}`);

if (snap.empty) {
  console.log("  (ninguna todavía — la sombra solo dispara al CREAR un ticket,");
  console.log("   así que los tickets que ya existían no la disparan)\n");
  process.exit(0);
}

const porEstado = {};
const porConjunto = {};
let conDecision = 0;
let congeladas = 0;

snap.forEach((doc) => {
  const d = doc.data();
  porEstado[d.estado ?? "sin_estado"] = (porEstado[d.estado ?? "sin_estado"] ?? 0) + 1;
  porConjunto[d.tenantId ?? "sin_conjunto"] = (porConjunto[d.tenantId ?? "sin_conjunto"] ?? 0) + 1;
  if (d.decisionActualizadaEn) conDecision += 1;
  if (d.decisionCongeladaEn) congeladas += 1;
});

console.log("\nPor estado:");
for (const [estado, n] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
  // `en_curso` en reposo NO es normal: significa que una función murió entre la
  // reserva y la respuesta del modelo, y ese ticket no se reintenta.
  const alarma = estado === "en_curso" ? "   <-- una función se cayó a mitad" : "";
  console.log(`  ${String(n).padStart(4)}  ${estado}${alarma}`);
}
if (porEstado.omitida) {
  const motivos = {};
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.estado === "omitida") motivos[d.motivo ?? "sin_motivo"] = (motivos[d.motivo ?? "sin_motivo"] ?? 0) + 1;
  });
  console.log("    motivos de omisión:", motivos);
}

console.log("\nPor conjunto:");
for (const [tenant, n] of Object.entries(porConjunto).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${tenant}`);
}

console.log(`\nPares para G7:`);
console.log(`  ${conDecision} con decisión anotada`);
console.log(`  ${congeladas} congeladas (el ticket llegó a resuelto o cerrado) <-- son las que miden G7`);

// Los tres ejes, solo de las que tienen las dos mitades. Catálogos cerrados: no
// hay texto del conjunto en esta comparación.
const pares = [];
snap.forEach((doc) => {
  const d = doc.data();
  if (d.estado !== "sugerida" || !d.decisionActualizadaEn) return;
  pares.push({
    sugerida: {
      category: d.sugerencia?.suggestedCategory ?? null,
      type: d.sugerencia?.suggestedType ?? null,
      priority: d.sugerencia?.suggestedPriority ?? null,
    },
    decidida: {
      category: d.decision?.category ?? null,
      type: d.decision?.type ?? null,
      // Ausente significa «no decidió este eje», y se distingue de un valor.
      priority: d.decision?.priority ?? null,
    },
  });
});

if (pares.length) {
  console.log(`\nCoincidencia sugerida/decidida (${pares.length} pares):`);
  for (const eje of ["category", "type", "priority"]) {
    const evaluables = pares.filter((p) => p.decidida[eje] !== null);
    if (!evaluables.length) {
      console.log(`  ${eje.padEnd(9)} — sin decisiones en este eje todavía`);
      continue;
    }
    const aciertos = evaluables.filter((p) => p.sugerida[eje] === p.decidida[eje]).length;
    const pct = ((aciertos / evaluables.length) * 100).toFixed(1);
    console.log(`  ${eje.padEnd(9)} ${aciertos}/${evaluables.length}  (${pct}%)`);
  }
}

console.log("");
