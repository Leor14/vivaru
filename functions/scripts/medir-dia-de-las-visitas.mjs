// Mide, conjunto por conjunto, el DÍA que guarda cada pase de visita frente al día
// local de su hora. SOLO LEE — no escribe nada. Requiere ADC.
//
// POR QUÉ EXISTE. La lista de hoy de la portería (`GuardDashboard`) comparaba con el
// día UTC, y las invitaciones del residente (`src/features/visitors/invitations.ts`)
// guardaban `date` y `eventDate` con el día UTC de su hora de inicio: desde las 18:00
// de México (19:00 en Colombia y Ecuador) eso ya es el día siguiente. Arreglar la
// comparación y la escritura no corrige lo ya escrito, así que antes hay que contarlo.
//
// QUIÉN ESCRIBIÓ CADA PASE se lee en la forma de `scheduledTime`, no en un campo:
//   - ISO con zona («…Z» o «±hh:mm») → invitación del residente: su `date` salía de
//     `toISOString()`, así que es el ÚNICO escritor que puede llevar el día corrido.
//   - ISO sin zona («2026-09-10T19:00:00») → autorización del administrador, con el
//     día del formulario.
//   - «HH:mm» → callable `createVisitorPass` o visita de portería, con el día local
//     que manda el cliente.
//
// La zona sale del `country` del conjunto; México tiene varias y aquí se usa la de la
// capital, que es la misma que usa el navegador de quien opera en la mayoría de los casos.
//
// Uso (el proyecto es OBLIGATORIO: sin él no se lee nada, porque el CLI apunta a
// producción por defecto y eso ya confundió una vez):
//   node functions/scripts/medir-dia-de-las-visitas.mjs hogaru-1
//   node functions/scripts/medir-dia-de-las-visitas.mjs vivaru-staging-02

import admin from "firebase-admin";

const [, , projectId] = process.argv;
if (!projectId) {
  console.error("Uso: node functions/scripts/medir-dia-de-las-visitas.mjs <projectId>");
  process.exit(1);
}

const ZONA_POR_PAIS = { MX: "America/Mexico_City", CO: "America/Bogota", EC: "America/Guayaquil" };
const ZONA_SUPUESTA = "America/Mexico_City";

function diaLocal(instante, zona) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

function escritor(scheduledTime) {
  const s = typeof scheduledTime === "string" ? scheduledTime : "";
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(s)) return "invitacion";
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return "administrador";
  if (/^\d{2}:\d{2}/.test(s)) return "callable-o-porteria";
  return "sin-hora";
}

admin.initializeApp({ projectId });
const db = admin.firestore();

const [tenants, pases] = await Promise.all([db.collection("tenants").get(), db.collection("visitorPasses").get()]);
const conjuntos = new Map(tenants.docs.map((d) => [d.id, d.data()]));

const porConjunto = new Map();
for (const doc of pases.docs) {
  const p = doc.data();
  const clave = p.tenantId ?? "(sin tenantId)";
  if (!porConjunto.has(clave)) porConjunto.set(clave, []);
  porConjunto.get(clave).push({ id: doc.id, ...p });
}

console.log(`\n=== ${projectId} — ${pases.size} pases de visita en ${porConjunto.size} conjuntos ===`);

const totales = { invitaciones: 0, dateCorrido: 0, eventDateCorrido: 0, sinEventDate: 0 };
const sinEventDatePorEscritor = {};

for (const [tenantId, lista] of [...porConjunto].sort((a, b) => b[1].length - a[1].length)) {
  const t = conjuntos.get(tenantId) ?? {};
  const zona = ZONA_POR_PAIS[t.country] ?? ZONA_SUPUESTA;
  const conteo = {};
  const corridos = [];

  for (const p of lista) {
    const quien = escritor(p.scheduledTime);
    conteo[quien] = (conteo[quien] ?? 0) + 1;
    if (!p.eventDate) {
      totales.sinEventDate += 1;
      sinEventDatePorEscritor[quien] = (sinEventDatePorEscritor[quien] ?? 0) + 1;
    }
    if (quien !== "invitacion") continue;

    totales.invitaciones += 1;
    const local = diaLocal(new Date(p.scheduledTime), zona);
    const dateMal = p.date !== local;
    const eventDateMal = p.eventDate !== local;
    if (dateMal) totales.dateCorrido += 1;
    if (eventDateMal) totales.eventDateCorrido += 1;
    if (dateMal || eventDateMal) {
      corridos.push({ id: p.id, date: p.date, eventDate: p.eventDate, diaLocal: local, scheduledTime: p.scheduledTime });
    }
  }

  const nombre = t.displayName ?? t.name ?? tenantId;
  const pais = t.country ? `${t.country} → ${zona}` : `sin país → ${zona} SUPUESTA`;
  console.log(`\n${nombre} (${tenantId}) · ${pais}`);
  console.log(`  pases: ${lista.length} · por escritor: ${JSON.stringify(conteo)}`);
  if (corridos.length > 0) {
    console.log(`  invitaciones con el día CORRIDO: ${corridos.length}`);
    for (const c of corridos) console.log(`    ${JSON.stringify(c)}`);
  }
}

console.log(`\n--- TOTAL ${projectId}`);
console.log(`  invitaciones del residente:        ${totales.invitaciones}`);
console.log(`  con \`date\` distinto del día local:  ${totales.dateCorrido}`);
console.log(`  con \`eventDate\` distinto:           ${totales.eventDateCorrido}`);
console.log(`  pases sin \`eventDate\` (de cualquier escritor): ${totales.sinEventDate} ${JSON.stringify(sinEventDatePorEscritor)}`);
