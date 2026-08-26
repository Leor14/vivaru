// El informe de `PRD-V-FIX-002` — **antes de tocar nada** (§4·2, CA1, CA2).
//
// POR QUÉ EXISTE. El campo que ata una persona con su unidad está escrito de dos
// formas en los mismos conjuntos: el **id del documento** de la unidad y su campo
// `unitId`, que es un slug. `residentOwnUnit` compara una sola de las dos, así que
// todo documento escrito con la otra queda fuera del alcance de su propio dueño
// **sin ningún error**: las reglas rechazan, no filtran, y el residente ve una
// lista vacía o un total corto.
//
// LO QUE HACE. Recorre las DIECIOCHO colecciones que llevan clave de unidad y, por
// conjunto y por unidad, cuenta cuántos documentos hay de cada convención, cuántos
// son huérfanos y cuántos ambiguos. Y dice **cuánta deuda se vuelve visible** si se
// migra, que es la nota que el administrador necesita antes que el residente (§9).
//
// **NO ESCRIBE NADA. NUNCA.** No tiene bandera para escribir. Lo que escribe es
// `migrar-claves-de-unidad.mjs`, y esa exige un informe de este.
//
// Uso:
//   node functions/scripts/informe-claves-de-unidad.mjs <projectId> [tenantId]
//     ... --json <ruta>   guarda el informe (lo EXIGE la migración, CF4)
//     ... --detalle       enumera huérfanos y ambiguos uno a uno

import { writeFileSync } from "node:fs";

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { dinero, listarConjuntos, radiografiarConjunto } from "./lib/claves-de-unidad.mjs";

const [, , projectId, ...resto] = process.argv;

/** `--json <ruta>` consume el siguiente argumento; el suelto que quede es el conjunto. */
const banderas = new Set();
const sueltos = [];
let rutaJson = null;
for (let i = 0; i < resto.length; i++) {
  if (resto[i] === "--json") rutaJson = resto[++i] ?? null;
  else if (resto[i].startsWith("--")) banderas.add(resto[i]);
  else sueltos.push(resto[i]);
}
const tenantPedido = sueltos[0];
const detalle = banderas.has("--detalle");

if (!projectId) {
  console.error("Uso: node informe-claves-de-unidad.mjs <projectId> [tenantId] [--json <ruta>] [--detalle]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const conjuntos = await listarConjuntos(db, tenantPedido);
if (conjuntos.length === 0) {
  console.error(tenantPedido ? `No existe el conjunto ${tenantPedido}.` : "No hay conjuntos.");
  process.exit(1);
}

console.log(`\nINFORME DE CLAVES DE UNIDAD · ${projectId} · ${conjuntos.length} conjunto(s)`);
console.log("Este informe NO escribe nada.\n");

const informe = { proyecto: projectId, generadoEn: new Date().toISOString(), conjuntos: [] };
const resumen = [];

for (const c of conjuntos) {
  const r = await radiografiarConjunto(db, c.tenantId);
  informe.conjuntos.push({ ...r, estadoComercial: c.estadoComercial, nombre: c.nombre });

  const partidas = r.porUnidad.filter((u) => u.partida).length;
  const fuera = r.porUnidad.reduce((a, u) => a + u.fueraDeConvencion, 0);
  resumen.push({
    conjunto: c.tenantId,
    comercial: c.estadoComercial,
    estado: r.estado,
    unidades: r.unidades,
    partidas,
    fueraDeConvencion: fuera,
    huerfanos: r.huerfanos.length,
    archivados: r.archivados.length,
    ambiguos: r.ambiguos.length,
  });

  console.log(`── ${c.tenantId} (${c.estadoComercial}) → ${r.estado.toUpperCase()}`);
  console.log(
    `   ${r.unidades} unidades · ${r.totales.canonica} docs en convención · ` +
      `${r.totales.migrable} migrables · ${r.huerfanos.length} huérfanos · ${r.ambiguos.length} ambiguos` +
      (r.archivados.length ? ` · ${r.archivados.length} archivados` : ""),
  );

  const sucias = r.porUnidad.filter((u) => u.fueraDeConvencion > 0);
  for (const u of sucias) {
    const claves = Object.entries(u.claves).map(([k, n]) => `${k}=${n}`).join(" · ");
    const sube = u.deudaDespues - u.deudaAntes;
    console.log(
      `   ${u.partida ? "PARTIDA " : "FUERA   "} ${u.etiqueta ?? "?"} [${u.unidad}] → ${claves}` +
        (sube > 0 ? `  ·  deuda visible ${dinero(u.deudaAntes)} → ${dinero(u.deudaDespues)} (+${dinero(sube)})` : ""),
    );
  }

  if (r.huerfanos.length || r.ambiguos.length) {
    const saldoHuerfano = r.huerfanos.reduce((a, h) => a + (h.saldo ?? 0), 0);
    console.log(
      `   Sin dueño: ${r.huerfanos.length} huérfanos` +
        (saldoHuerfano ? ` (${dinero(saldoHuerfano)} en cartera)` : "") +
        ` · ${r.ambiguos.length} ambiguos`,
    );
    for (const g of r.gruposDeHuerfanos) {
      console.log(
        `      «${g.valor}» → ${g.docs} doc(s) en ${g.colecciones.join(", ")}` +
          (g.saldo ? ` · ${dinero(g.saldo)} en cartera` : "") +
          (g.hermanosResuelvenA
            ? `  ·  sus hermanos CON etiqueta resuelven a ${g.hermanosResuelvenA} — decisión humana, R2 no los toca`
            : ""),
      );
    }
    if (detalle) {
      for (const h of [...r.huerfanos, ...r.ambiguos]) {
        console.log(
          `      · ${h.coleccion}/${h.docId} unitId=«${h.valor}» etiqueta=«${h.etiqueta ?? "—"}»` +
            (h.candidatos?.length ? ` candidatos=${h.candidatos.join(",")}` : ""),
        );
      }
    }
  }
  console.log("");
}

console.log("RESUMEN");
console.table(resumen);

const totalFuera = resumen.reduce((a, r) => a + r.fueraDeConvencion, 0);
const totalAmbiguos = resumen.reduce((a, r) => a + r.ambiguos, 0);
const totalArchivados = resumen.reduce((a, r) => a + r.archivados, 0);
console.log(
  `\n${totalFuera} documento(s) fuera de convención · ` +
    `${resumen.reduce((a, r) => a + r.huerfanos, 0)} huérfano(s) sin decidir · ${totalAmbiguos} ambiguo(s)` +
    (totalArchivados ? ` · ${totalArchivados} archivado(s)` : ""),
);
if (totalFuera === 0) console.log("CERO documentos fuera de convención: no hay nada que migrar aquí.");

if (rutaJson) {
  writeFileSync(rutaJson, JSON.stringify(informe, null, 2));
  console.log(`\nInforme guardado en ${rutaJson} — es el que exige la migración (CF4).`);
}

process.exit(0);
