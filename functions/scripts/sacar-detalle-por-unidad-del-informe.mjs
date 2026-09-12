// `PRD-V-FLOW-007` `K2` — saca `receivables.byUnit` del documento del informe mensual a su
// documento aparte, `monthlyReportReceivables/{mismo id}`, que solo lee la administración.
//
// POR QUÉ. El consejo lee los informes emitidos y una regla concede el documento entero:
// con el detalle dentro, quién debe y cuánto llegaba a su navegador aunque la pantalla
// pintara solo totales. Desde el 12 sep 2026 el servidor lo escribe ya partido; esto parte
// los informes que se escribieron antes.
//
// EN SECO por defecto: dice qué haría y no escribe. Con `--aplicar`, UN lote por informe:
// escribe el detalle y borra el campo del informe en la misma escritura atómica, y después
// relee los dos documentos para comprobarlo.
//
// No toca las cifras ni el estado del informe: el total se queda, y el detalle se conserva
// entero en su documento. Si ya existe un detalle aparte DISTINTO, lo avisa y no toca ese
// informe.
//
// Uso: node functions/scripts/sacar-detalle-por-unidad-del-informe.mjs <projectId> [--aplicar]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [, , projectId, bandera] = process.argv;
if (!projectId) {
  console.error("Uso: node functions/scripts/sacar-detalle-por-unidad-del-informe.mjs <projectId> [--aplicar]");
  process.exit(1);
}
const aplicar = bandera === "--aplicar";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const DETALLE = "monthlyReportReceivables";

console.log(`\nProyecto: ${projectId} — ${aplicar ? "APLICANDO" : "en seco (no escribe nada)"}\n`);

const informes = await db.collection("monthlyReports").get();
let yaPartidos = 0;
let porPartir = 0;
let conflictos = 0;
let partidosAhora = 0;

for (const d of informes.docs) {
  const x = d.data();
  const byUnit = x?.receivables?.byUnit;
  if (!Array.isArray(byUnit)) {
    yaPartidos++;
    console.log(`  ${d.id}: ya partido`);
    continue;
  }
  porPartir++;

  const ref = db.collection(DETALLE).doc(d.id);
  const previo = await ref.get();
  if (previo.exists && JSON.stringify(previo.get("byUnit")) !== JSON.stringify(byUnit)) {
    conflictos++;
    process.exitCode = 1;
    console.log(`  ${d.id}: ALTO — ya tiene un detalle aparte DISTINTO; no se toca`);
    continue;
  }

  console.log(`  ${d.id}: ${x.status} · ${byUnit.length} unidad(es) → ${DETALLE}/${d.id}`);
  if (!aplicar) continue;

  const lote = db.batch();
  lote.set(
    ref,
    {
      tenantId: x.tenantId,
      period: x.period,
      byUnit,
      migradoEn: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  lote.update(d.ref, { "receivables.byUnit": FieldValue.delete() });
  await lote.commit();

  const [informe, detalle] = await Promise.all([d.ref.get(), ref.get()]);
  const cuadra =
    !Array.isArray(informe.get("receivables.byUnit")) &&
    informe.get("receivables.total") === x.receivables.total &&
    JSON.stringify(detalle.get("byUnit")) === JSON.stringify(byUnit);
  console.log(
    `    ${cuadra ? "comprobado" : "¡NO CUADRA!"}: el informe conserva el total ${informe.get("receivables.total")}; ` +
      `el detalle tiene ${detalle.get("byUnit")?.length ?? 0} fila(s)`,
  );
  if (cuadra) partidosAhora++;
  else process.exitCode = 1;
}

console.log(
  `\nInformes: ${informes.size} · ya partidos: ${yaPartidos} · por partir: ${porPartir} · conflictos: ${conflictos}` +
    (aplicar ? ` · partidos ahora: ${partidosAhora}` : "") +
    "\n",
);
