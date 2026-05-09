import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const now = admin.firestore.Timestamp.now();
const tenantId = "tenant-santa-maria";

const demoUsers = [
  {
    email: "superadmin@hogaru.co",
    password: "Demo1234*",
    displayName: "Paula Sierra",
    role: "superadmin",
  },
  {
    email: "admin@santamaria.co",
    password: "Demo1234*",
    displayName: "Carlos Ramirez",
    role: "tenant_admin",
    tenantId,
  },
  {
    email: "residente@santamaria.co",
    password: "Demo1234*",
    displayName: "Ana Lucia Perez",
    role: "resident",
    tenantId,
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
  },
];

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId });
}

async function upsertAuthUser(seed) {
  const auth = admin.auth();
  let user;
  try {
    user = await auth.getUserByEmail(seed.email);
    user = await auth.updateUser(user.uid, {
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch {
    user = await auth.createUser({
      email: seed.email,
      password: seed.password,
      displayName: seed.displayName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: seed.role,
    tenantId: seed.tenantId,
  });

  return user;
}

async function run() {
  initAdmin();

  const db = admin.firestore();
  await db.collection("tenants").doc(tenantId).set(
    {
      name: "Conjunto Residencial Santa Maria",
      city: "Bogota",
      status: "active",
      planId: "plus",
      onboardingStatus: "completed",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  for (const seed of demoUsers) {
    const user = await upsertAuthUser(seed);

    await db.collection("users").doc(user.uid).set(
      {
        uid: user.uid,
        email: seed.email,
        fullName: seed.displayName,
        role: seed.role,
        tenantId: seed.tenantId ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...(seed.unitId ? { unitId: seed.unitId } : {}),
        ...(seed.unitLabel ? { unitLabel: seed.unitLabel } : {}),
      },
      { merge: true },
    );

    if (seed.tenantId) {
      const tenantUserData = {
        uid: user.uid,
        tenantId: seed.tenantId,
        fullName: seed.displayName,
        email: seed.email,
        role: seed.role,
        status: "active",
        createdAt: now,
        updatedAt: now,
        ...(seed.unitId ? { unitId: seed.unitId } : {}),
        ...(seed.unitLabel ? { unitLabel: seed.unitLabel } : {}),
      };

      await db.collection("tenantUsers").doc(`${seed.tenantId}_${user.uid}`).set(
        tenantUserData,
        { merge: true },
      );
    }

    console.log(`Seeded ${seed.role}: ${seed.email}`);
  }

  console.log("Demo tenant and users seeded successfully.");
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
