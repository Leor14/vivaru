// Lee el ruleset VIVO por la API de Rules y lo diferencia contra el repo. Solo lee.
import { GoogleAuth } from "google-auth-library";
import fs from "node:fs";
const proyecto = process.argv[2];
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/firebase"] });
const c = await auth.getClient();
const api = "https://firebaserules.googleapis.com/v1";
const rels = await c.request({ url: `${api}/projects/${proyecto}/releases` });
const rel = (rels.data.releases ?? []).find((r) => r.name.endsWith("cloud.firestore"));
const rs = await c.request({ url: `${api}/${rel.rulesetName}` });
const vivo = rs.data.source.files.find((f) => f.name.includes("firestore.rules")).content;
const repo = fs.readFileSync("firestore.rules", "utf8");
console.log("proyecto        :", proyecto);
console.log("ruleset servido :", rel.rulesetName.split("/").pop());
console.log("creado          :", rs.data.createTime);
console.log("idéntico al repo:", vivo.trim() === repo.trim() ? "SÍ" : "NO");
console.log("monthlyReports  :", vivo.includes("match /monthlyReports/{docId}") ? "PRESENTE" : "AUSENTE");
fs.writeFileSync("/tmp/rules-vivo.txt", vivo);
