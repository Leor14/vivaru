// SOLO LEE. Detalle de un rollout y del build que sirve.
import { GoogleAuth } from "google-auth-library";
const [, , project, backend, rolloutId, location = "us-central1"] = process.argv;
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const base = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${location}/backends/${backend}`;
const { data: r } = await client.request({ url: `${base}/rollouts/${rolloutId}` });
console.log("rollout:", r.name.split("/").pop(), "| estado:", r.state, "| creado:", r.createTime);
const buildId = String(r.build ?? "").split("/").pop();
console.log("build:", buildId);
if (buildId) {
  const { data: b } = await client.request({ url: `${base}/builds/${buildId}` });
  const s = b.source?.codebase ?? {};
  console.log("  estado build:", b.state);
  console.log("  rama:", s.branch, "| commit:", s.commit);
  console.log("  uri:", s.uri);
  console.log("  autor:", s.author?.displayName ?? "—");
  console.log("  primera línea del mensaje:", String(s.commitMessage ?? "").split("\n")[0]);
}
