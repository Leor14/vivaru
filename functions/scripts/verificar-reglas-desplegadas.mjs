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
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  // **Diff de SECUENCIA, con `diff -u`, y no de conjuntos.** Hasta el 11 de septiembre de
  // 2026 esto listaba «las líneas de un lado que no están en el otro» con `includes`, y una
  // línea quitada que existiera IGUAL en otro sitio del fichero no salía nunca. Pasó con la
  // única línea de regla de un despliegue —`esConsejo(resource.data.tenantId) ||` en
  // `documents`, gemela de la de `clearanceCertificates`—: el informe enseñó solo comentarios
  // y la regla que cambiaba de verdad no aparecía. Un medidor que calla la línea que importa
  // da un resultado plausible, no uno cierto.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reglas-"));
  const desplegado = path.join(dir, "desplegado.rules");
  const repositorio = path.join(dir, "repositorio.rules");
  fs.writeFileSync(desplegado, `${normalizar(vivo)}\n`);
  fs.writeFileSync(repositorio, `${normalizar(repo)}\n`);
  const salida = spawnSync("diff", ["-u", desplegado, repositorio], { encoding: "utf8" }).stdout ?? "";
  fs.rmSync(dir, { recursive: true, force: true });

  const lineas = salida.split("\n").filter((l) => /^[-+@]/.test(l) && !/^(---|\+\+\+) /.test(l));
  const cambiadas = lineas.filter((l) => !l.startsWith("@@")).length;
  console.log(`\ndiff desplegado → repositorio (${cambiadas} líneas; «-» solo en lo desplegado, «+» solo en el repo):`);
  for (const l of lineas.slice(0, 120)) console.log(`  ${l}`);
  if (lineas.length > 120) console.log(`  … y ${lineas.length - 120} más`);
  process.exitCode = 1;
}
