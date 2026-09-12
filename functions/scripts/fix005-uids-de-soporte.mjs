// `PRD-V-FIX-005` · H3 — saca el uid del equipo de Vivaru del documento de cada ticket.
//
// El administrador del conjunto lee el documento entero de su ticket. Este script mueve a
// `supportTickets/{id}/equipo` —que solo lee el superadmin— el `authorUid` de cada respuesta
// del equipo en el hilo (`equipo/respuesta-{idDelMensaje}`) y el `assignedTo`
// (`equipo/asignacion`), y los quita del documento. La ruta de un adjunto del equipo
// (`support/{uid}/…`) NO la toca: es la rebanada H3c de la ficha.
//
// En seco por defecto; escribe solo con `--escribir`. El proyecto es obligatorio.
//   node functions/scripts/fix005-uids-de-soporte.mjs vivaru-staging-02
//   node functions/scripts/fix005-uids-de-soporte.mjs vivaru-staging-02 --escribir
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const projectId = process.argv[2];
const escribir = process.argv.includes("--escribir");
if (!projectId || projectId.startsWith("--")) {
  console.error("Uso: node functions/scripts/fix005-uids-de-soporte.mjs <projectId> [--escribir]");
  process.exit(1);
}

admin.initializeApp({ projectId });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const esDelEquipoConUid = (m) => m?.role === "vivaru" && typeof m.authorUid === "string" && m.authorUid !== "";

const snap = await db.collection("supportTickets").get();
let tickets = 0;
let respuestas = 0;
let asignaciones = 0;

for (const d of snap.docs) {
  const t = d.data();
  const delEquipo = (Array.isArray(t.thread) ? t.thread : []).filter(esDelEquipoConUid);
  if (!delEquipo.length && !t.assignedTo) continue;
  tickets++;
  respuestas += delEquipo.length;
  if (t.assignedTo) asignaciones++;
  console.log(
    `${d.id} (${t.tenantId}): ${delEquipo.length} respuesta(s) del equipo con uid` +
      `${t.assignedTo ? " · assignedTo" : ""}${escribir ? "" : " — en seco"}`,
  );
  if (!escribir) continue;

  // Transacción por ticket: se relee dentro, por si alguien respondió mientras tanto.
  await db.runTransaction(async (tx) => {
    const actual = (await tx.get(d.ref)).data() ?? {};
    const hilo = Array.isArray(actual.thread) ? actual.thread : [];
    for (const m of hilo.filter(esDelEquipoConUid)) {
      tx.set(d.ref.collection("equipo").doc(`respuesta-${m.id}`), {
        uid: m.authorUid,
        createdAt: m.createdAt ?? null,
        migradoPor: "fix005-uids-de-soporte",
      });
    }
    if (actual.assignedTo) {
      tx.set(d.ref.collection("equipo").doc("asignacion"), {
        uid: actual.assignedTo,
        updatedAt: actual.assignedAt ?? null,
        migradoPor: "fix005-uids-de-soporte",
      });
    }
    const hiloSinUid = hilo.map((m) => {
      if (!esDelEquipoConUid(m)) return m;
      const { authorUid: _quitado, ...resto } = m;
      return resto;
    });
    tx.update(d.ref, { thread: hiloSinUid, assignedTo: FieldValue.delete() });
  });
}

console.log(
  `${projectId}: ${tickets} ticket(s) · ${respuestas} respuesta(s) del equipo · ${asignaciones} asignación(es)` +
    (escribir ? " — ESCRITO" : " — en seco, no se escribió nada"),
);
