// Prueba la sombra de PQRS de punta a punta creando UN ticket, y sabe borrarse.
//
// Existe porque la sombra no se puede comprobar mirando: no muestra nada a
// nadie, y hasta que no nace un ticket no ha corrido nunca. Verla funcionar es
// crear uno y leer la fila.
//
// ## Dos modos, y la diferencia importa
//
// · Por defecto el ticket va marcado `isExample: true`. La sombra lo OMITE con
//   motivo `sembrado` ANTES de llamar al modelo: prueba que el trigger dispara,
//   que lee las banderas y el conjunto, y que escribe la fila. **Cuesta USD 0.**
//   Y la fila no ensucia el conjunto de evaluación de G7, porque `sembrado` está
//   excluido por diseño.
//
// · Con `--real` el ticket va sin marcar y la sombra lo clasifica de verdad:
//   USD 0,0009 y es lo único que prueba que **el proveedor responde en ESTE
//   proyecto**. A cambio mete un ticket falso en un conjunto real y una fila en
//   el dataset. Por eso el script imprime siempre el comando de borrado.
//
// ## Efecto secundario que conviene saber
//
// Crear un ticket dispara también `onTicketCreated`, que **notifica a los
// administradores del conjunto y a los superadministradores**. En un conjunto de
// demo da igual; en uno real, alguien verá un aviso.
//
// Uso:
//   node functions/scripts/probar-sombra.mjs <projectId> <tenantId>
//   node functions/scripts/probar-sombra.mjs <projectId> <tenantId> --real
//   node functions/scripts/probar-sombra.mjs <projectId> --borrar <ticketId>
//
// El proyecto va SIEMPRE explícito: el activo de gcloud es `hogaru-1`, que es
// producción.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectId = args[0];
const real = args.includes("--real");
const iBorrar = args.indexOf("--borrar");

if (!projectId || (iBorrar === -1 && !args[1])) {
  console.error("Uso: node probar-sombra.mjs <projectId> <tenantId> [--real]");
  console.error("     node probar-sombra.mjs <projectId> --borrar <ticketId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// ── Borrado ──────────────────────────────────────────────────────────────────
if (iBorrar !== -1) {
  const ticketId = args[iBorrar + 1];
  if (!ticketId) {
    console.error("Falta el id del ticket tras --borrar");
    process.exit(1);
  }
  // Se borran las DOS cosas. Dejar la fila sin su ticket es peor que dejar las
  // dos: queda un caso en el dataset que ya no se puede volver a mirar.
  await db.collection("aiAssistance").doc(ticketId).delete();
  await db.collection("tickets").doc(ticketId).delete();
  console.log(`\nBorrados en ${projectId}: tickets/${ticketId} y aiAssistance/${ticketId}\n`);
  process.exit(0);
}

// ── Creación ─────────────────────────────────────────────────────────────────
const tenantId = args[1];

const tenant = await db.collection("tenants").doc(tenantId).get();
if (!tenant.exists) {
  console.error(`El conjunto «${tenantId}» no existe en ${projectId}.`);
  process.exit(1);
}

const settings = await db.collection("tenantSettings").doc(tenantId).get();
const variante = settings.data()?.moduleVariants?.pqrs ?? "con_sla (por defecto)";
const conjuntoEjemplo = tenant.data()?.isExample === true;

console.log(`\n=== Prueba de la sombra · ${projectId} ===`);
console.log(`  conjunto: ${tenantId}  (isExample=${conjuntoEjemplo})`);
console.log(`  variante de pqrs: ${variante}`);
console.log(`  modo: ${real ? "REAL — llama al modelo, cuesta ~USD 0,0009" : "gratuito — el ticket va marcado, la sombra omite sin llamar"}`);

if (real && conjuntoEjemplo) {
  console.log("\n  AVISO: el CONJUNTO está marcado como ejemplo, así que la sombra");
  console.log("  omitirá igual y --real no probará el modelo. Usa un conjunto real.\n");
}

const nowIso = new Date().toISOString();
const ref = await db.collection("tickets").add({
  tenantId,
  unitId: "prueba-sombra",
  unitLabel: "PRUEBA",
  residentName: "Prueba de sombra",
  category: "pqrs",
  subject: "Prueba de la sombra de PQRS",
  message:
    "Ticket creado por functions/scripts/probar-sombra.mjs para comprobar que el modo sombra dispara y escribe su fila. Se puede borrar.",
  status: "open",
  radicado: `PQRS-PRUEBA-${nowIso.slice(11, 19).replace(/:/g, "")}`,
  radicationDate: nowIso,
  eventDate: nowIso.slice(0, 10),
  createdAt: nowIso,
  updatedAt: nowIso,
  // Marcado salvo en modo real: es lo que hace la prueba gratuita y lo que
  // mantiene la fila fuera del conjunto de evaluación de G7.
  ...(real ? {} : { isExample: true }),
});

console.log(`\n  ticket creado: ${ref.id}`);
process.stdout.write("  esperando a la sombra");

const fila = db.collection("aiAssistance").doc(ref.id);
let datos = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const snap = await fila.get();
  datos = snap.exists ? snap.data() : null;
  if (datos && datos.estado !== "en_curso") break;
  process.stdout.write(".");
}
console.log("");

if (!datos) {
  console.log("\n  NO se escribió ninguna fila en 2 minutos.");
  console.log("  Comprueba las banderas: node functions/scripts/leer-sombra-pqrs.mjs " + projectId);
} else {
  console.log(`\n  estado: ${datos.estado}${datos.motivo ? ` · motivo: ${datos.motivo}` : ""}`);
  if (datos.variante) console.log(`  variante leída por el servidor: ${datos.variante}`);
  if (datos.proveedor) console.log(`  proveedor: ${datos.proveedor}`);
  if (datos.sugerencia) {
    const s = datos.sugerencia;
    console.log(`  clasificó: ${s.suggestedCategory} / ${s.suggestedType} / ${s.suggestedPriority}`);
    console.log(`  needsHumanReview: ${s.needsHumanReview}`);
  }
  if (datos.estado === "omitida" && datos.motivo === "sembrado") {
    console.log("\n  CORRECTO: el trigger disparó, leyó banderas y conjunto, y escribió la fila");
    console.log("  sin llamar al modelo. La fontanería funciona y no costó nada.");
  }
  if (datos.estado === "fallo") {
    console.log("\n  La sombra corrió pero el proveedor falló. La cuota se devolvió.");
  }
}

console.log(`\n  Para borrar el rastro:`);
console.log(`  node functions/scripts/probar-sombra.mjs ${projectId} --borrar ${ref.id}\n`);
