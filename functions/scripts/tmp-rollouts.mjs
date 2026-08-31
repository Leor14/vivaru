// SOLO LEE. Rollouts de un backend de App Hosting.
// DOS trampas que este script existe para no repetir: la lista viene PAGINADA
// (hay que seguir `nextPageToken`, o se lee una página arbitraria y se cree que
// es el final) y SIN ORDENAR (se ordena aquí, por fecha de creación).
import { GoogleAuth } from "google-auth-library";
const [, , project, backend, location = "us-central1"] = process.argv;
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const base = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${location}/backends/${backend}/rollouts`;
let token, todos = [], paginas = 0;
do {
  const url = `${base}?pageSize=100${token ? `&pageToken=${token}` : ""}`;
  const { data } = await client.request({ url });
  todos.push(...(data.rollouts ?? []));
  token = data.nextPageToken;
  paginas += 1;
} while (token && paginas < 50);
todos.sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)));
console.log(`\n${todos.length} rollouts en ${backend} (${paginas} páginas)\n`);
for (const r of todos.slice(0, 8)) {
  console.log(`${r.name.split("/").pop().padEnd(26)} ${String(r.state).padEnd(12)} ${r.createTime}  build=${String(r.build ?? "").split("/").pop()}`);
}
console.log();
