import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const tenantId = process.env.VALIDATION_TENANT_ID || "tenant-santa-maria";
const prefix = "qa-resident-communications";

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId });
}

function toDateOnly(offsetDays) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function upsertValidationCommunications() {
  initAdmin();
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const validDocId = `${prefix}-valid`;
  const expiredDocId = `${prefix}-expired`;
  const scheduledDocId = `${prefix}-scheduled`;

  await db.collection("communications").doc(validDocId).set(
    {
      tenantId,
      title: "[QA] Comunicado vigente residente",
      message: "Este es el detalle completo del comunicado vigente para validacion manual.",
      status: "published",
      startsAt: toDateOnly(-1),
      endsAt: toDateOnly(7),
      publishedAt: now,
      attachmentName: "Manual de convivencia.pdf",
      attachmentUrl: "https://example.com/manual-convivencia.pdf",
      createdAt: now,
      updatedAt: now,
      createdBy: "qa-script",
      updatedBy: "qa-script",
    },
    { merge: true },
  );

  await db.collection("communications").doc(expiredDocId).set(
    {
      tenantId,
      title: "[QA] Comunicado vencido residente",
      message: "No deberia aparecer porque ya esta vencido.",
      status: "published",
      startsAt: toDateOnly(-10),
      endsAt: toDateOnly(-1),
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: "qa-script",
      updatedBy: "qa-script",
    },
    { merge: true },
  );

  await db.collection("communications").doc(scheduledDocId).set(
    {
      tenantId,
      title: "[QA] Comunicado programado residente",
      message: "No deberia aparecer porque su vigencia inicia en el futuro.",
      status: "scheduled",
      startsAt: toDateOnly(2),
      endsAt: toDateOnly(10),
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: "qa-script",
      updatedBy: "qa-script",
    },
    { merge: true },
  );

  console.log("Validation communications seeded:", {
    tenantId,
    validDocId,
    expiredDocId,
    scheduledDocId,
  });
}

upsertValidationCommunications().catch((error) => {
  console.error("Seed validation communications failed:", error);
  process.exitCode = 1;
});
