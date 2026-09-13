// El inventario del conjunto, derivado de los DATOS: todo documento raíz con su `tenantId`. El
// producto no escribe subcolecciones (medido con grep sobre functions/src el 13 sep), así que las
// colecciones raíz son todas.
//
// Sirve para tres cosas, y ninguna es borrar por barrido:
//   · la LÍNEA BASE, que la primera corrida guarda en el manifiesto: lo que había antes de sembrar,
//     y que `--limpiar` nunca toca;
//   · completar el manifiesto al final de cada corrida con lo que crearon los escritores del
//     producto sin que la semilla lo apuntara (recibos, operaciones, casos…), por id exacto;
//   · comprobar, después de `--limpiar`, que no queda nada fuera de la línea base.
// «El inventario se deriva de los datos»: una lista escrita de colecciones se queda corta en
// silencio, y esto no.

import { FieldPath, FieldValue } from "firebase-admin/firestore";

const FUERA = new Set(["semillas"]);

export async function barrer(db, tenantId) {
  const mapa = new Map();
  for (const coleccion of await db.listCollections()) {
    if (FUERA.has(coleccion.id)) continue;
    const snap = await coleccion.where("tenantId", "==", tenantId).select().get();
    if (!snap.empty) mapa.set(coleccion.id, new Set(snap.docs.map((d) => d.id)));
  }
  return mapa;
}

const aObjeto = (mapa) => Object.fromEntries([...mapa].map(([c, ids]) => [c, [...ids]]));
const aMapa = (obj = {}) => new Map(Object.entries(obj).map(([c, ids]) => [c, new Set(ids)]));
const contar = (mapa) => [...mapa.values()].reduce((s, ids) => s + ids.size, 0);

export async function lineaBaseGuardada(ctx) {
  const m = (await ctx.manifiesto.ref.get()).data();
  return m?.lineaBase ? aMapa(m.lineaBase) : null;
}

/** La primera corrida que escribe guarda lo que había; las siguientes la reutilizan. */
export async function asegurarLineaBase(ctx) {
  const guardada = await lineaBaseGuardada(ctx);
  if (guardada) return guardada;
  const base = await barrer(ctx.db, ctx.tenantId);
  await ctx.manifiesto.ref.set({ tenantId: ctx.tenantId, historia: ctx.manifiesto.historia, lineaBase: aObjeto(base) }, { merge: true });
  console.log(`  línea base: ${contar(base)} documentos que ya estaban (${[...base.keys()].sort().join(", ")})`);
  return base;
}

/** Apunta en el manifiesto lo del conjunto que no es de la línea base ni estaba apuntado. */
export async function completarManifiesto(ctx, base) {
  const apuntados = aMapa((await ctx.manifiesto.ref.get()).data()?.docs);
  for (const [c, ids] of ctx.manifiesto.docs) for (const id of ids) (apuntados.get(c) ?? apuntados.set(c, new Set()).get(c)).add(id);
  const nuevos = new Map();
  for (const [c, ids] of await barrer(ctx.db, ctx.tenantId)) {
    for (const id of ids) {
      if (base.get(c)?.has(id) || apuntados.get(c)?.has(id)) continue;
      ctx.manifiesto.anotar(c, id);
      nuevos.set(c, (nuevos.get(c) ?? 0) + 1);
    }
  }
  if (nuevos.size) {
    const lista = [...nuevos].sort(([a], [b]) => a.localeCompare(b)).map(([c, n]) => `${c} ${n}`).join(" · ");
    console.log(`  apuntados por barrido (los crearon escritores del producto o disparadores): ${lista}`);
  }
}

/**
 * `--limpiar`: borra por id exacto lo del manifiesto (y solo si es de este conjunto), las cuentas
 * de Auth con el claim del conjunto y los archivos; devuelve los ajustes y la guía a como estaban; y
 * comprueba que no queda nada fuera de la línea base. Sin `--escribir`, solo cuenta.
 */
export async function limpiar(ctx, { auth, bucket }) {
  const db = ctx.db;
  const t = ctx.tenantId;
  const m = (await ctx.manifiesto.ref.get()).data();
  if (!m) return console.log("\nNo hay manifiesto: no hay nada sembrado que limpiar.\n");
  if (m.tenantId !== t) throw new Error(`El manifiesto es del conjunto «${m.tenantId}»: no se toca.`);
  const docs = aMapa(m.docs);
  const usuarios = m.usuarios ?? [];
  const archivos = m.archivos ?? [];
  console.log(`\nManifiesto: ${contar(docs)} documentos en ${docs.size} colecciones · ${usuarios.length} cuentas · ${archivos.length} archivos`);
  for (const [c, ids] of [...docs].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${c.padEnd(32)} ${ids.size}`);
  if (!ctx.escribir) return console.log("\nSimulación: no se borró nada. Añade --escribir.\n");

  let borrados = 0;
  for (const [c, ids] of docs) {
    const lista = [...ids];
    for (let i = 0; i < lista.length; i += 300) {
      const snaps = await db.getAll(...lista.slice(i, i + 300).map((id) => db.collection(c).doc(id)));
      const lote = db.batch();
      let n = 0;
      for (const s of snaps) {
        if (!s.exists) continue;
        if (s.data()?.tenantId !== t) {
          console.warn(`  ⚠ ${c}/${s.id} es de otro conjunto: no se borra`);
          continue;
        }
        lote.delete(s.ref);
        n += 1;
      }
      if (n) await lote.commit();
      borrados += n;
    }
  }
  let cuentas = 0;
  for (let i = 0; i < usuarios.length; i += 100) {
    const { users } = await auth.getUsers(usuarios.slice(i, i + 100).map((uid) => ({ uid })));
    const delConjunto = users.filter((u) => u.customClaims?.tenantId === t).map((u) => u.uid);
    if (delConjunto.length) await auth.deleteUsers(delConjunto);
    cuentas += delConjunto.length;
  }
  for (const ruta of archivos) await bucket.file(ruta).delete({ ignoreNotFound: true });

  if (m.ajustesPrevios) {
    const parche = Object.fromEntries(Object.entries(m.ajustesPrevios).map(([k, v]) => [k, v === null ? FieldValue.delete() : v]));
    await db.collection("tenantSettings").doc(t).update(parche);
  }
  // La guía: si el documento ya existía, se quitan solo las marcas que puso la semilla (si no
  // existía, el barrido lo apuntó y ya se borró arriba).
  const onboarding = db.collection("tenantOnboarding").doc(t);
  if (m.onboardingPrevio?.existia && (await onboarding.get()).exists) {
    for (const k of m.onboardingPrevio.faltaban ?? []) await onboarding.update(new FieldPath("seen", k), FieldValue.delete());
  }
  console.log(`\nBorrados: ${borrados} documentos · ${cuentas} cuentas · ${archivos.length} archivos. Ajustes y guía, como estaban.`);

  const base = aMapa(m.lineaBase);
  const sobrantes = [];
  for (const [c, ids] of await barrer(db, t)) for (const id of ids) if (!base.get(c)?.has(id)) sobrantes.push(`${c}/${id}`);
  if (sobrantes.length) {
    // El manifiesto se queda (sin lo ya borrado) para que la próxima corrida use la misma línea base.
    await ctx.manifiesto.ref.update({ docs: FieldValue.delete(), usuarios: FieldValue.delete(), archivos: FieldValue.delete() });
    console.log(`✗ Quedan ${sobrantes.length} documentos fuera de la línea base:\n    ${sobrantes.slice(0, 20).join("\n    ")}\n`);
    return;
  }
  await ctx.manifiesto.ref.delete();
  console.log("✓ El conjunto quedó como estaba: nada fuera de la línea base. Manifiesto borrado.\n");
}
