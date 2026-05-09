import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const email = "superadmin@hogaru.co";
const password = "Demo1234*";
const displayName = "Superadmin Hogaru";

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId });
}

async function upsertSuperadmin() {
  const auth = admin.auth();
  let user;

  try {
    const existing = await auth.getUserByEmail(email);
    user = await auth.updateUser(existing.uid, {
      email,
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      user = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });
    } else {
      throw error;
    }
  }

  await auth.setCustomUserClaims(user.uid, {
    role: "superadmin",
    tenantId: null,
  });

  return user;
}

async function run() {
  initAdmin();

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const user = await upsertSuperadmin();

  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      fullName: displayName,
      role: "superadmin",
      tenantId: null,
      status: "active",
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );

  console.log(`Superadmin listo: ${email}`);
  console.log(`UID: ${user.uid}`);
}

run().catch((error) => {
  console.error("No fue posible crear/actualizar superadmin:", error);
  process.exitCode = 1;
});
