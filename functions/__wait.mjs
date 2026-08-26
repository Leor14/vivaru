import { GoogleAuth } from "/Users/david/Vivaru_Rep/vivaru/functions/node_modules/google-auth-library/build/src/index.js";
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const P = "vivaru-staging-02";
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const TERM = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);
for (let i = 0; i < 40; i++) {
  const client = await auth.getClient();
  let ru = `https://firebaseapphosting.googleapis.com/v1beta/projects/${P}/locations/us-central1/backends/vivaru-staging-web/rollouts?pageSize=100`;
  const all = [];
  for (;;) { const r = await client.request({ url: ru }); all.push(...(r.data.rollouts ?? [])); if (!r.data.nextPageToken) break; ru = ru.split("&pageToken=")[0] + `&pageToken=${r.data.nextPageToken}`; }
  all.sort((a,b)=>String(b.createTime).localeCompare(String(a.createTime)));
  const ro = all[0];
  if (TERM.has(ro.state)) {
    const bd = await client.request({ url: `https://firebaseapphosting.googleapis.com/v1beta/${ro.build}` });
    console.log(`${ro.name.split("/").pop()}: ${ro.state} · ${(bd.data.source?.codebase?.commitMessage ?? "—").split("\n")[0]}`);
    process.exit(0);
  }
  console.error(`[${i}] ${ro.state}`);
  await espera(25000);
}
