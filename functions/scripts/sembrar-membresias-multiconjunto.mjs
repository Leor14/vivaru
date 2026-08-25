// Da a UNA persona membresía de administrador en VARIOS conjuntos, para poder
// validar el selector de `PRD-V-PLAT-002` entrega 2.
//
// POR QUÉ EXISTE. El selector solo se pinta con dos membresías o más, y **no
// hay ninguna persona con dos** en ninguno de los dos ambientes: los diez
// administradores de staging tienen exactamente una, y los de producción
// también. Sin esto, la funcionalidad no se puede mirar por pantalla — solo
// razonar sobre ella, que es justo lo que en este repo ya ha fallado siete
// veces.
//
// QUÉ ESCRIBE. Un documento por conjunto en `tenantUsers/{tenantId}_{uid}`, con
// `role: "tenant_admin"`. Nada más: ni toca `users/{uid}`, ni el claim, ni
// `lastActiveTenantId` — ese último se deja ausente A PROPÓSITO, para que el
// primer inicio de sesión recorra el camino de «no hay último usado».
//
// NO CLOBBERA. Si ya existe una membresía en ese conjunto se salta, diga lo que
// diga: pisar la de un residente con una de administrador le daría acceso a la
// administración del conjunto sin que nadie lo pidiera.
//
// SE DESHACE. `--retirar` borra exactamente los documentos que esto crea, y
// nunca la membresía de origen de la persona.
//
// Uso:
//   node functions/scripts/sembrar-membresias-multiconjunto.mjs <projectId> <uid> <tenantId...>
//   ... --escribir      aplica (sin esto solo enseña qué haría)
//   ... --retirar       quita las membresías en esos conjuntos
//
// Producción exige `--si-produccion` además de `--escribir`. No es simetría con
// staging: conceder acceso cruzado entre conjuntos de clientes distintos es la
// operación más delicada de esta PRD, y no puede quedar a una tecla de
// distancia.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [, , projectId, uid, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
const tenantIds = resto.filter((a) => !a.startsWith("--"));

const escribir = banderas.has("--escribir");
const retirar = banderas.has("--retirar");
const siProduccion = banderas.has("--si-produccion");

if (!projectId || !uid || tenantIds.length === 0) {
  console.error("Uso: node sembrar-membresias-multiconjunto.mjs <projectId> <uid> <tenantId...> [--escribir] [--retirar]");
  process.exit(1);
}

if (projectId === "hogaru-1" && escribir && !siProduccion) {
  console.error("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const perfilSnap = await db.collection("users").doc(uid).get();
if (!perfilSnap.exists) {
  console.error(`No existe users/${uid} en ${projectId}.`);
  process.exit(1);
}
const perfil = perfilSnap.data();

if (perfil.role !== "tenant_admin" && perfil.role !== "admin_tenant") {
  console.error(`users/${uid} tiene rol «${perfil.role}». Esto solo da membresías de ADMINISTRADOR.`);
  process.exit(1);
}

console.log(`\nProyecto: ${projectId}`);
console.log(`Persona:  ${perfil.email ?? "—"} (${perfil.fullName ?? "—"})`);
console.log(`Origen:   ${perfil.tenantId ?? "—"}   ← su conjunto de siempre, nunca se toca`);
console.log(`Modo:     ${retirar ? "RETIRAR" : "SEMBRAR"}${escribir ? " · ESCRIBIENDO" : " · simulación"}\n`);

let hechas = 0;
let saltadas = 0;

for (const tenantId of tenantIds) {
  const ref = db.collection("tenantUsers").doc(`${tenantId}_${uid}`);
  const [tenantSnap, membresiaSnap] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    ref.get(),
  ]);

  if (!tenantSnap.exists) {
    console.log(`  ✗ ${tenantId.padEnd(36)} el conjunto no existe — se salta`);
    saltadas += 1;
    continue;
  }
  const estado = tenantSnap.data().status ?? "—";

  if (retirar) {
    if (tenantId === perfil.tenantId) {
      console.log(`  · ${tenantId.padEnd(36)} es su conjunto de origen — NO se retira`);
      saltadas += 1;
      continue;
    }
    if (!membresiaSnap.exists) {
      console.log(`  · ${tenantId.padEnd(36)} no tenía membresía — nada que retirar`);
      saltadas += 1;
      continue;
    }
    console.log(`  ← ${tenantId.padEnd(36)} se BORRA la membresía  (conjunto ${estado})`);
    if (escribir) await ref.delete();
    hechas += 1;
    continue;
  }

  if (membresiaSnap.exists) {
    const yaEs = membresiaSnap.data().role;
    console.log(`  · ${tenantId.padEnd(36)} ya tiene membresía «${yaEs}» — se salta, no se pisa`);
    saltadas += 1;
    continue;
  }

  console.log(`  → ${tenantId.padEnd(36)} se CREA tenant_admin  (conjunto ${estado})`);
  if (escribir) {
    await ref.set({
      uid,
      tenantId,
      role: "tenant_admin",
      fullName: perfil.fullName ?? "",
      email: perfil.email ?? "",
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Marcador para saber, dentro de un año, que esto no lo dio de alta
      // nadie: lo sembró la validación del selector.
      seededBy: "sembrar-membresias-multiconjunto",
    });
  }
  hechas += 1;
}

// Se releen para no dar por buena la escritura: es el mismo motivo por el que
// el sembrador del plan de cuentas contaba 189 en vez de fiarse del batch.
const todas = await db.collection("tenantUsers").where("uid", "==", uid).get();
const admin = todas.docs
  .map((d) => d.data())
  .filter((m) => m.role === "tenant_admin" || m.role === "admin_tenant");

console.log(`\n${hechas} ${retirar ? "retiradas" : "creadas"}, ${saltadas} saltadas.`);
console.log(`Membresías de administrador RELEÍDAS para ${perfil.email}: ${admin.length}`);
for (const m of admin) console.log(`    ${m.tenantId}  (${m.status ?? "active"})`);
if (!escribir) console.log("\nSimulación: no se escribió nada. Añade --escribir.");
