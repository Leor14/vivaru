import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "vivaru-staging-02" });
const db = getFirestore();
// Fechas de vencimiento DESORDENADAS a proposito y creadas al reves, para que
// el orden que salga en pantalla solo pueda venir de R7 y no del orden de
// lectura de Firestore.
for (const [period, amount, dueDate] of [
  ["2026-09", 300, "2026-09-30"],
  ["2026-05", 100, "2026-05-30"],
  ["2026-07", 200, "2026-07-30"],
]) {
  const ref = await db.collection("billingStatements").add({
    tenantId: "conjunto-las-playas", unitId: "t2-205", unitLabel: "T2-205",
    period, concept: "administracion", amount, paymentAmount: 0, balance: amount,
    status: "pending", dueDate,
    createdBy: "prueba-r7", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  console.log("cargo", period, amount, "vence", dueDate, "->", ref.id);
}
