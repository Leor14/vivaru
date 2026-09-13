// El motor de la semilla: el contexto que comparten los escritores, crear-si-falta con la guarda
// del conjunto, el manifiesto y las marcas de tiempo históricas.
//
// **Crear si falta, y nunca pisar a otro conjunto.** Un id que ya existe con el mismo `tenantId` se
// da por sembrado (la corrida es idempotente); uno que existe con OTRO `tenantId` aborta: es la
// trampa de los ids globales (El Nogal) y `sembrar-demo-finanzas.mjs` la tenía sin guarda.
//
// **El manifiesto** (`semillas/{tenantId}`) apunta cada documento, cuenta y archivo que la corrida
// crea, para que `--limpiar` borre por id exacto y nunca por barrido de conjunto
// (`vaciar-avisos-sembrados.mjs`). Nadie lo lee desde la app: no tiene regla, así que el cliente no
// puede ni verlo.

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { instante } from "./reloj.mjs";

/** La marca de tiempo de un día y hora locales de Puebla. */
export const marcaDe = (dia, hora = "12:00") => Timestamp.fromDate(instante(dia, hora));

export class Manifiesto {
  constructor(db, tenantId, historia) {
    this.ref = db.collection("semillas").doc(tenantId);
    this.tenantId = tenantId;
    this.historia = historia;
    this.docs = new Map();
    this.usuarios = new Set();
    this.archivos = new Set();
  }

  anotar(coleccion, id) {
    if (!this.docs.has(coleccion)) this.docs.set(coleccion, new Set());
    this.docs.get(coleccion).add(id);
  }

  anotarUsuario(uid) {
    this.usuarios.add(uid);
  }

  anotarArchivo(ruta) {
    this.archivos.add(ruta);
  }

  /** Guarda lo apuntado desde la última vez, acumulando (arrayUnion). */
  async guardar() {
    const docs = {};
    for (const [c, ids] of this.docs) if (ids.size) docs[c] = FieldValue.arrayUnion(...ids);
    const datos = { tenantId: this.tenantId, historia: this.historia, actualizadoEn: FieldValue.serverTimestamp() };
    if (Object.keys(docs).length) datos.docs = docs;
    if (this.usuarios.size) datos.usuarios = FieldValue.arrayUnion(...this.usuarios);
    if (this.archivos.size) datos.archivos = FieldValue.arrayUnion(...this.archivos);
    await this.ref.set(datos, { merge: true });
    this.docs.clear();
    this.usuarios.clear();
    this.archivos.clear();
  }
}

export function crearContexto({ db, auth, bucket, tenantId, adminUid, escribir, historia }) {
  const conteo = new Map();
  return {
    db,
    auth,
    bucket,
    tenantId,
    adminUid,
    escribir,
    manifiesto: new Manifiesto(db, tenantId, historia),
    /** uid de cada cuenta de la historia, por su clave (`res-encinos-03`, `porteria`). */
    uids: new Map(),
    /** `que`: creado, existe o crearia; o cualquier otro texto, que se imprime tal cual. */
    cuenta(coleccion, que) {
      if (!conteo.has(coleccion)) conteo.set(coleccion, { creado: 0, existe: 0, crearia: 0 });
      const c = conteo.get(coleccion);
      c[que] = (c[que] ?? 0) + 1;
    },
    conteo,
  };
}

/**
 * Crea `coleccion/id` con `tenantId` y los datos, solo si no existe. Si existe y es de este
 * conjunto, lo da por sembrado; si es de otro, aborta.
 */
export async function crearSiFalta(ctx, coleccion, id, datos) {
  const ref = ctx.db.collection(coleccion).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const suyo = snap.data()?.tenantId;
    if (suyo !== ctx.tenantId) {
      throw new Error(`${coleccion}/${id} ya existe y es del conjunto «${suyo}»: no se pisa.`);
    }
    ctx.cuenta(coleccion, "existe");
    return { ref, creado: false, datos: snap.data() };
  }
  if (!ctx.escribir) {
    ctx.cuenta(coleccion, "crearia");
    return { ref, creado: false, simulado: true };
  }
  await ref.create({ tenantId: ctx.tenantId, ...datos });
  ctx.manifiesto.anotar(coleccion, id);
  ctx.cuenta(coleccion, "creado");
  return { ref, creado: true };
}

/**
 * Apunta en el manifiesto documentos que creó un escritor del PRODUCTO y reescribe sus marcas
 * técnicas (`createdAt`, `sentAt`…) al momento histórico, por id exacto y en lotes. Solo para
 * colecciones sin disparador de `update` (plan §12.3).
 */
export async function fechar(ctx, coleccion, ids, campos) {
  const lista = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < lista.length; i += 400) {
    const lote = ctx.db.batch();
    for (const id of lista.slice(i, i + 400)) {
      lote.update(ctx.db.collection(coleccion).doc(id), campos);
      ctx.manifiesto.anotar(coleccion, id);
    }
    await lote.commit();
  }
}

/** Las carpetas de sistema de `ensureSystemFolderImpl` (functions/src/index.ts), con sus nombres. */
const CARPETAS_DE_SISTEMA = {
  regulations: { name: "Reglamentos", description: "Reglamentos del conjunto. Carpeta del sistema." },
  committee_agreements: { name: "Acuerdos de comité", description: "Actas y acuerdos de comité. Carpeta del sistema." },
  payment_receipts: { name: "Comprobantes de pago", description: "Comprobantes de pago aprobados de los residentes. Carpeta del sistema." },
};

/**
 * La carpeta de sistema, como `ensureSystemFolderImpl`: la que ya tenga el conjunto, o una nueva con
 * id prefijado y la fecha histórica, pedida por `actor` (la administración, salvo que se diga).
 */
export async function carpetaDeSistema(ctx, systemKey, marca, actor = { uid: ctx.adminUid, nombre: ctx.adminNombre ?? "" }) {
  const existente = await ctx.db.collection("documentFolders").where("tenantId", "==", ctx.tenantId).where("systemKey", "==", systemKey).limit(1).get();
  if (!existente.empty) return existente.docs[0].id;
  const id = `${ctx.tenantId}--carpeta-${systemKey}`;
  await crearSiFalta(ctx, "documentFolders", id, {
    ...CARPETAS_DE_SISTEMA[systemKey], parentId: null, path: id, depth: 0, color: "system", system: true, systemKey,
    createdBy: actor.uid, createdByName: actor.nombre, createdAt: marca, updatedAt: marca,
  });
  return id;
}

/** La firma de alta que pone `createTenantDocument`: quién y cuándo, con la fecha histórica. */
export function firma(ctx, marca, uid = ctx.adminUid) {
  return { createdBy: uid, updatedBy: uid, createdAt: marca, updatedAt: marca };
}

export function imprimirConteo(ctx) {
  const filas = [...ctx.conteo.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [c, n] of filas) {
    const partes = [];
    if (n.creado) partes.push(`${n.creado} creados`);
    if (n.crearia) partes.push(`${n.crearia} se crearían`);
    if (n.existe) partes.push(`${n.existe} ya estaban`);
    for (const [k, v] of Object.entries(n)) if (!["creado", "existe", "crearia"].includes(k)) partes.push(`${v} ${k}`);
    console.log(`  ${c.padEnd(28)} ${partes.join(" · ")}`);
  }
}
