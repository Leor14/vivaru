// Lo que comparten el informe y la migración de `PRD-V-FIX-002`.
//
// **Está aparte a propósito.** Si el informe midiera de una forma y la migración
// de otra, «el informe posterior da cero» (R5/CA4) no probaría nada: estaría
// midiendo con la regla equivocada. Aquí vive la lectura y la agregación; la
// clasificación de cada valor vive en `functions/src/clave-de-unidad.ts`, que es
// el resolvedor único, y ninguno de los dos scripts la reimplementa.
//
// Este módulo **no escribe**. Lo que escribe es la migración, y solo ella.

import { createHash } from "node:crypto";

import {
  COLECCIONES_CON_CLAVE_DE_UNIDAD,
  construirCatalogo,
  estaArchivado,
  estadoDelConjunto,
  planificarDocumento,
} from "../../lib/clave-de-unidad.js";

export { COLECCIONES_CON_CLAVE_DE_UNIDAD };

/** Los conjuntos, con su estado comercial. §5.2: se migran TODOS, esté como esté. */
export async function listarConjuntos(db, tenantPedido) {
  const snap = await db.collection("tenants").get();
  return snap.docs
    .filter((d) => !tenantPedido || d.id === tenantPedido)
    .map((d) => ({ tenantId: d.id, estadoComercial: d.data().status ?? "sin-estado", nombre: d.data().name ?? d.id }))
    .sort((a, b) => a.tenantId.localeCompare(b.tenantId, "es-CO"));
}

async function leerUnidades(db, tenantId) {
  const snap = await db.collection("units").where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => ({
    id: d.id,
    slug: d.data().unitId ?? null,
    displayName: d.data().displayName ?? null,
    status: d.data().status ?? null,
  }));
}

/** El saldo de un cargo. Sin `balance` numérico no suma: no se inventa. */
function saldoDe(datos) {
  return typeof datos.balance === "number" ? datos.balance : 0;
}

/**
 * Recorre UN conjunto y devuelve el plan completo. **No escribe nada.**
 *
 * Lo hace el informe y lo hace la migración, y por eso el resultado lleva una
 * `huella`: si el dato se movió entre que se miró y que se escribió, la
 * migración se planta en vez de aplicar un plan que ya no describe la realidad.
 */
export async function radiografiarConjunto(db, tenantId) {
  const unidades = await leerUnidades(db, tenantId);
  const catalogo = construirCatalogo(unidades);
  const etiquetaDe = new Map(unidades.map((u) => [u.id, u.displayName ?? u.id]));

  const totales = { canonica: 0, migrable: 0, ambiguo: 0, huerfano: 0, archivado: 0, sinClave: 0 };
  const porColeccion = {};
  const escrituras = [];
  const huerfanos = [];
  /** Huérfanos con la decisión ya tomada y escrita. No cuentan como pendientes. */
  const archivados = [];
  const ambiguos = [];
  /** unidad canónica → { clave usada → nº de documentos } */
  const clavesPorUnidad = new Map();
  /** unidad canónica → { antes, despues } de deuda visible */
  const deudaPorUnidad = new Map();

  const anota = (unidadCanonica, claveUsada) => {
    const m = clavesPorUnidad.get(unidadCanonica) ?? new Map();
    m.set(claveUsada, (m.get(claveUsada) ?? 0) + 1);
    clavesPorUnidad.set(unidadCanonica, m);
  };
  const anotaDeuda = (unidadCanonica, saldo, yaVisible) => {
    const d = deudaPorUnidad.get(unidadCanonica) ?? { antes: 0, despues: 0 };
    if (yaVisible) d.antes += saldo;
    d.despues += saldo;
    deudaPorUnidad.set(unidadCanonica, d);
  };

  for (const coleccion of COLECCIONES_CON_CLAVE_DE_UNIDAD) {
    const snap = await db.collection(coleccion.nombre).where("tenantId", "==", tenantId).get();
    const cuenta = { docs: snap.size, canonica: 0, migrable: 0, ambiguo: 0, huerfano: 0, archivado: 0, sinClave: 0 };

    for (const d of snap.docs) {
      const datos = d.data();
      const accion = planificarDocumento(coleccion, { id: d.id, datos }, catalogo);
      const esCartera = coleccion.nombre === "billingStatements";

      if (accion.accion === "sin-clave") {
        cuenta.sinClave += 1;
        totales.sinClave += 1;
      } else if (accion.accion === "ya-canonica") {
        cuenta.canonica += 1;
        totales.canonica += 1;
        anota(accion.clave, accion.clave);
        if (esCartera) anotaDeuda(accion.clave, saldoDe(datos), true);
      } else if (accion.accion === "escribir") {
        cuenta.migrable += 1;
        totales.migrable += 1;
        escrituras.push(accion);
        anota(accion.a, accion.de);
        if (esCartera) anotaDeuda(accion.a, saldoDe(datos), false);
      } else if (accion.motivo === "ambiguo") {
        cuenta.ambiguo += 1;
        totales.ambiguo += 1;
        ambiguos.push({ ...accion, saldo: esCartera ? saldoDe(datos) : null });
      } else if (estaArchivado(datos)) {
        cuenta.archivado = (cuenta.archivado ?? 0) + 1;
        totales.archivado += 1;
        archivados.push({ ...accion, saldo: esCartera ? saldoDe(datos) : null });
      } else {
        cuenta.huerfano += 1;
        totales.huerfano += 1;
        huerfanos.push({ ...accion, saldo: esCartera ? saldoDe(datos) : null });
      }
    }

    porColeccion[coleccion.nombre] = cuenta;
  }

  const porUnidad = [...clavesPorUnidad.entries()]
    .map(([unidad, claves]) => {
      const deuda = deudaPorUnidad.get(unidad) ?? { antes: 0, despues: 0 };
      return {
        unidad,
        etiqueta: etiquetaDe.get(unidad) ?? null,
        claves: Object.fromEntries([...claves.entries()].sort()),
        /** Nombrada por más de una clave a la vez: el caso de T1-101. */
        partida: claves.size > 1,
        /** Documentos suyos que hoy NO están bajo su clave canónica. */
        fueraDeConvencion: [...claves.entries()].filter(([k]) => k !== unidad).reduce((a, [, n]) => a + n, 0),
        deudaAntes: deuda.antes,
        deudaDespues: deuda.despues,
      };
    })
    .sort((a, b) => b.fueraDeConvencion - a.fueraDeConvencion || a.unidad.localeCompare(b.unidad, "es-CO"));

  // **Los huérfanos, agrupados por el valor que llevan.** Uno a uno son ruido:
  // en `tenant-santa-maria` son 31 líneas y VEINTIOCHO son la misma clave, la de
  // una unidad que ya no existe. Agrupados se ve lo único que importa para
  // decidir: cuántos son, cuánto dinero arrastran, y si algún documento HERMANO
  // con el mismo valor sí se pudo resolver — que es la pista de a quién eran.
  // **Agrupar no es reasignar**: R2 no se toca, y estos siguen sin migrarse.
  const pistaPorValor = new Map();
  for (const e of escrituras) pistaPorValor.set(e.de, e.a);
  const gruposDeHuerfanos = [...huerfanos.reduce((m, h) => {
    const g = m.get(h.valor) ?? { valor: h.valor, docs: 0, saldo: 0, colecciones: new Set() };
    g.docs += 1;
    g.saldo += h.saldo ?? 0;
    g.colecciones.add(h.coleccion);
    return m.set(h.valor, g);
  }, new Map()).values()]
    .map((g) => ({
      ...g,
      colecciones: [...g.colecciones].sort(),
      /** A qué unidad resolvieron sus hermanos con etiqueta, si es que alguno lo hizo. */
      hermanosResuelvenA: pistaPorValor.get(g.valor) ?? null,
    }))
    .sort((a, b) => b.docs - a.docs);

  // §6 · el estado sale del módulo puro, que es donde se puede probar.
  const estado = estadoDelConjunto({
    unidades: catalogo.total,
    migrables: escrituras.length,
    huerfanos: huerfanos.length,
    ambiguos: ambiguos.length,
  });

  return {
    tenantId,
    estado,
    unidades: catalogo.total,
    totales,
    porColeccion,
    porUnidad,
    huerfanos,
    archivados,
    gruposDeHuerfanos,
    ambiguos,
    escrituras,
    huella: huellaDe(escrituras),
  };
}

/**
 * La huella de un plan: qué documento, de qué clave, a cuál. **No incluye la
 * fecha**, así que dos informes seguidos sobre un dato quieto dan la misma — que
 * es justo lo que la migración necesita comprobar antes de escribir.
 */
export function huellaDe(escrituras) {
  const lineas = escrituras
    .map((e) => `${e.coleccion}/${e.docId}:${e.campoClave}:${e.de}->${e.a}`)
    .sort();
  return createHash("sha1").update(lineas.join("\n")).digest("hex");
}

export function dinero(n) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n ?? 0);
}
