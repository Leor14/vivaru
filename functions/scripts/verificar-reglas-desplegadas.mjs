/**
 * Lee el ruleset de Firestore **que está sirviendo** y lo diferencia contra
 * `firestore.rules` del repositorio. **Solo lee: no despliega ni escribe nada.**
 *
 *   node functions/scripts/verificar-reglas-desplegadas.mjs hogaru-1
 *   node functions/scripts/verificar-reglas-desplegadas.mjs vivaru-staging-02
 *
 * ## Por qué hace falta
 *
 * **`master` NO es el registro de lo desplegado salvo para el front.** Las reglas
 * salen del árbol de trabajo con `firebase deploy`, no de una rama, así que
 * `git diff` entre ramas no dice qué está vigente. Y **«Deploy complete» tampoco
 * lo prueba**: este repositorio ya vio un despliegue con salida 0, log truncado y
 * funciones en el código viejo.
 *
 * El CLI no trae un comando para esto, así que se lee por la **API de Firebase
 * Rules** con la ADC. Si la ADC diera `invalid_rapt`, eso es un desafío de
 * reautenticación, **no** una credencial caducada: ejercítala antes de darla por
 * muerta (`gcloud auth application-default print-access-token`).
 *
 * Salida: qué ruleset sirve, cuándo se creó, y **el diff contra el repositorio**.
 * Cero líneas de diff es la única prueba de que lo desplegado es lo que se lee.
 */
import { GoogleAuth } from "google-auth-library";
import fs from "node:fs";

const proyecto = process.argv[2];
if (!proyecto) {
  console.error("uso: node functions/scripts/verificar-reglas-desplegadas.mjs <projectId>");
  process.exit(1);
}

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/firebase"] });
const cliente = await auth.getClient();
const api = "https://firebaserules.googleapis.com/v1";

const releases = await cliente.request({ url: `${api}/projects/${proyecto}/releases` });
const release = (releases.data.releases ?? []).find((r) => r.name.endsWith("cloud.firestore"));
if (!release) {
  console.error(`No hay release de cloud.firestore en ${proyecto}.`);
  process.exit(1);
}

const ruleset = await cliente.request({ url: `${api}/${release.rulesetName}` });
const vivo = ruleset.data.source.files.find((f) => f.name.includes("firestore.rules")).content;
const repo = fs.readFileSync("firestore.rules", "utf8");

const normalizar = (t) => t.replace(/[ \t]+$/gm, "").trim();
const iguales = normalizar(vivo) === normalizar(repo);

console.log(`proyecto        : ${proyecto}`);
console.log(`ruleset servido : ${release.rulesetName.split("/").pop()}`);
console.log(`creado          : ${ruleset.data.createTime}`);
console.log(`idéntico al repo: ${iguales ? "SÍ" : "NO"}`);

if (!iguales) {
  const a = normalizar(vivo).split("\n");
  const b = normalizar(repo).split("\n");
  const enVivoNoEnRepo = a.filter((l) => !b.includes(l));
  const enRepoNoEnVivo = b.filter((l) => !a.includes(l));
  console.log(`\nlíneas solo en lo DESPLEGADO (${enVivoNoEnRepo.length}):`);
  for (const l of enVivoNoEnRepo.slice(0, 40)) console.log("  -", l);
  console.log(`\nlíneas solo en el REPOSITORIO (${enRepoNoEnVivo.length}):`);
  for (const l of enRepoNoEnVivo.slice(0, 40)) console.log("  +", l);
  process.exitCode = 1;
}
