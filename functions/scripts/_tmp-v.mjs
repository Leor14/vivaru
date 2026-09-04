import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "vivaru-staging-02" });
const db = getFirestore();
const T="tenant-santa-maria";
const e = (await db.collection("expenses").where("tenantId","==",T).get()).docs[0];
const v = e.data();
console.log("=== el egreso ===");
console.log("  status:", v.status, "· paidAmount:", v.paidAmount);
const pag = v.installments.filter(c=>c.status==="pagada");
const pen = v.installments.filter(c=>c.status==="pendiente");
console.log("  cuotas: pagadas", pag.length, "· pendientes", pen.length);
console.log("  la pagada:", JSON.stringify({n:pag[0].number, paidAt:pag[0].paidAt, paidBy:pag[0].paidBy, asiento:pag[0].ledgerEntryId}));
console.log("  DEUDA (cuotas vivas):", pen.reduce((a,c)=>a+c.amount,0));
console.log("\n=== el asiento del libro ===");
const a = (await db.collection("ledgerEntries").doc(pag[0].ledgerEntryId).get()).data();
for (const k of ["type","date","amount","concept","category","accountCode","sourceType","sourceId","installmentNumber","reconciled"])
  console.log(`  ${k.padEnd(18)}: ${JSON.stringify(a[k])}`);
