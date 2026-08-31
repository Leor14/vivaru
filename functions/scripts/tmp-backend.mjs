// SOLO LEE. ¿Vigila una rama este backend de App Hosting? Es el campo que
// decide si empujar despliega, y CLAUDE.md lo da por ausente en los dos.
import { GoogleAuth } from "google-auth-library";
const [, , project, backend, location = "us-central1"] = process.argv;
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const url = `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/${location}/backends/${backend}`;
const { data } = await client.request({ url });
console.log(`\n--- ${project} / ${backend} ---`);
console.log("codebase:", JSON.stringify(data.codebase ?? null, null, 2));
console.log("updateTime:", data.updateTime);
