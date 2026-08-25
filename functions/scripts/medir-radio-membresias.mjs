// Mide, SOLO LEYENDO, cuántas personas perderían acceso al desplegar el cambio
// de autoridad de `PLAT-002`: claim → documento de membresía.
//
// POR QUÉ EXISTE. El radio anotado en la documentación es «39 de 39 tienen su
// documento de membresía», y ese conteo es MÁS LAXO que el predicado real
// (`functions/src/tenant-membership.ts`). Este script replica el predicado
// exacto, incluida la forma del id y el acuerdo entre el id y el campo, que es
// justo lo que un documento heredado puede tener mal sin que nadie lo note.
//
// NO ESCRIBE NADA.
//
// Uso: node functions/scripts/medir-radio-membresias.mjs <projectId>

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [, , projectId] = process.argv;
if (!projectId) {
  console.error("Uso: node functions/scripts/medir-radio-membresias.mjs <projectId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const ROLES_ADMIN = new Set(["tenant_admin", "admin_tenant"]);

// Réplica literal de `esAdminActivoDelConjunto` / `esMiembroDelConjunto`.
function evaluar(snap, tenantId, exigirAdmin) {
  if (!snap.exists) return "sin documento";
  const m = snap.data() ?? {};
  if (m.tenantId !== tenantId) return `campo tenantId = «${m.tenantId ?? "—"}» ≠ id`;
  if (exigirAdmin && !ROLES_ADMIN.has(m.role)) return `role = «${m.role ?? "—"}»`;
  if ((m.status ?? "active") !== "active") return `status = «${m.status}»`;
  return null;
}

console.log(`\nProyecto: ${projectId}\n`);

const usuarios = await db.collection("users").get();
console.log(`users: ${usuarios.size} documentos\n`);

const fallos = [];
let admins = 0;
let miembros = 0;
let sinConjunto = 0;

for (const u of usuarios.docs) {
  const perfil = u.data() ?? {};
  const tenantId = perfil.tenantId;
  if (typeof tenantId !== "string" || !tenantId) {
    sinConjunto += 1;
    continue;
  }
  const esAdmin = ROLES_ADMIN.has(perfil.role);
  const snap = await db.collection("tenantUsers").doc(`${tenantId}_${u.id}`).get();
  const motivo = evaluar(snap, tenantId, esAdmin);
  if (esAdmin) admins += 1;
  else miembros += 1;
  if (motivo) {
    fallos.push({
      uid: u.id,
      email: perfil.email ?? "—",
      rol: perfil.role ?? "—",
      tenantId,
      motivo,
      camino: esAdmin ? "RUTA DEL DINERO" : "miembro",
    });
  }
}

console.log(`Con conjunto:   ${admins + miembros}  (${admins} admin · ${miembros} otros roles)`);
console.log(`Sin conjunto:   ${sinConjunto}  (superadmin — no pasa por este predicado)\n`);

if (fallos.length === 0) {
  console.log("RADIO = 0. Nadie pierde acceso con el predicado exacto.\n");
} else {
  console.log(`RADIO = ${fallos.length}. Estas personas PIERDEN acceso:\n`);
  for (const f of fallos) {
    console.log(`  [${f.camino}] ${f.email} (${f.rol}) · ${f.tenantId}`);
    console.log(`      uid ${f.uid} → ${f.motivo}`);
  }
  console.log("");
}

// La trampa aparte: documentos de membresía cuyo id no casa con su propio campo.
// El barrido de arriba solo los ve si además hay un `users` que apunte ahí.
const todas = await db.collection("tenantUsers").get();
const desalineados = todas.docs.filter((d) => {
  const m = d.data() ?? {};
  return typeof m.tenantId !== "string" || typeof m.uid !== "string" || d.id !== `${m.tenantId}_${m.uid}`;
});

console.log(`tenantUsers: ${todas.size} documentos · ${desalineados.length} con el id desalineado del campo`);
for (const d of desalineados.slice(0, 20)) {
  const m = d.data() ?? {};
  console.log(`  ${d.id}  →  tenantId=«${m.tenantId ?? "—"}» uid=«${m.uid ?? "—"}»`);
}
console.log("");
