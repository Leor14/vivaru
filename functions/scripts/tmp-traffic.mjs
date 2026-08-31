// SOLO LEE. La política de rollout automático de App Hosting no vive en
// `codebase.branch` sino en el recurso `traffic` del backend.
import { GoogleAuth } from "google-auth-library";
const [, , project, backend, location = "us-central1"] = process.argv;
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const url = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${location}/backends/${backend}/traffic`;
try {
  const { data } = await client.request({ url });
  console.log(`\n--- ${project} / ${backend} · traffic ---`);
  console.log(JSON.stringify({ rolloutPolicy: data.rolloutPolicy, target: data.target, current: data.current?.splits?.map((s) => s.build?.split("/").pop()) }, null, 2));
} catch (e) {
  console.log(`\n--- ${project} / ${backend} ---  ERROR: ${e.message}`);
}
