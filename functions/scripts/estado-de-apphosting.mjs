// Qué sirve HOY un backend de App Hosting, de qué commit salió, y QUÉ LO
// DESPLIEGA. SOLO LEE — no crea rollouts ni toca configuración.
//
// POR QUÉ EXISTE. Este CLI no tiene `apphosting:rollouts:list`, así que lo
// desplegado se lee por la API, y por el camino hay TRES trampas que ya costaron
// tiempo:
//
//   1. **La política de despliegue automático NO vive en `codebase`.** Vive en el
//      recurso `traffic`, en `rolloutPolicy.codebaseBranch`. El 27 de agosto de
//      2026 se miró `codebase`, se vio que no traía campo `branch` y se concluyó
//      que «ningún backend vigila una rama, así que empujar no despliega». Es
//      falso: los DOS vigilan una rama —producción `master`, staging `develop`—
//      y el campo mirado nunca llevó esa información. Medido el 30 de agosto,
//      empujando a `master` y viendo nacer el rollout cinco segundos después.
//
//   2. **La lista de rollouts está PAGINADA y SIN ORDENAR.** Pedir una página y
//      ordenarla da una respuesta con pinta de correcta: son 598 en staging y la
//      primera página trae 100 cualesquiera. Aquí se siguen todos los
//      `nextPageToken` y se ordena al final.
//
//   3. **«Creado» no es «sirviendo».** Un rollout puede estar `QUEUED` mientras
//      el tráfico sigue en el build anterior, así que lo que manda es
//      `traffic.current`, y su procedencia se comprueba contra el commit.
//
// Uso: node functions/scripts/estado-de-apphosting.mjs <projectId> <backend> [cuántos]
//   node functions/scripts/estado-de-apphosting.mjs hogaru-1 vivaru
//   node functions/scripts/estado-de-apphosting.mjs vivaru-staging-02 vivaru-staging-web

import { GoogleAuth } from "google-auth-library";

const [, , project, backend, cuantosArg] = process.argv;
if (!project || !backend) {
  console.error("Uso: node functions/scripts/estado-de-apphosting.mjs <projectId> <backend> [cuántos]");
  process.exit(1);
}
const cuantos = Number(cuantosArg ?? 8);
const location = "us-central1";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const base = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${location}/backends/${backend}`;
const get = async (ruta) => (await client.request({ url: `${base}${ruta}` })).data;

const traffic = await get("/traffic");
const rama = traffic.rolloutPolicy?.codebaseBranch;
const sirviendo = traffic.current?.splits?.[0]?.build?.split("/").pop();

console.log(`\n=== ${project} / ${backend} ===\n`);
console.log(`Se despliega solo al empujar a:  ${rama ? `\`${rama}\`` : "NADA (sin política automática)"}`);
console.log(`Build que sirve ahora mismo:     ${sirviendo ?? "—"}`);

if (sirviendo) {
  const b = await get(`/builds/${sirviendo}`);
  const c = b.source?.codebase ?? {};
  console.log(`  estado:  ${b.state}`);
  console.log(`  rama:    ${c.branch ?? "—"}`);
  console.log(`  commit:  ${String(c.uri ?? "").split("/").pop() || "—"}`);
  console.log(`  mensaje: ${String(c.commitMessage ?? "").split("\n")[0]}`);
}

// Todas las páginas, y ordenadas aquí: ver la trampa 2 de la cabecera.
let token, todos = [], paginas = 0;
do {
  const data = await get(`/rollouts?pageSize=100${token ? `&pageToken=${token}` : ""}`);
  todos.push(...(data.rollouts ?? []));
  token = data.nextPageToken;
  paginas += 1;
} while (token && paginas < 50);
todos.sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)));

console.log(`\nÚltimos ${Math.min(cuantos, todos.length)} rollouts de ${todos.length} (${paginas} páginas):\n`);
for (const r of todos.slice(0, cuantos)) {
  const nombre = r.name.split("/").pop();
  const build = String(r.build ?? "").split("/").pop();
  const marca = build === sirviendo ? "  ← SIRVIENDO" : "";
  console.log(`  ${nombre.padEnd(26)} ${String(r.state).padEnd(12)} ${r.createTime}  ${build}${marca}`);
}
console.log();
