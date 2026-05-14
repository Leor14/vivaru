import { readFileSync } from "fs";
const cfg = JSON.parse(readFileSync(`${process.env.HOME}/.config/configstore/firebase-tools.json`, "utf8"));
const TOKEN = cfg.tokens.access_token;
const URL = "https://firestore.googleapis.com/v1/projects/hogaru-1/databases/(default)/collectionGroups/billingStatements/indexes";

for (let i = 0; i < 20; i++) {
  const res = await fetch(URL, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const d = await res.json();
  const idx = d.indexes?.find(ix => ix.fields?.some(f => f.fieldPath === "status") && ix.fields?.some(f => f.fieldPath === "dueDate"));
  const state = idx?.state ?? "NOT_FOUND";
  console.log(`[${new Date().toISOString()}] index state: ${state}`);
  if (state === "READY") { process.exit(0); }
  await new Promise(r => setTimeout(r, 15000));
}
console.log("Timeout waiting for index.");
process.exit(1);
