import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const tenantId = "tenant-e2e-resident-password";
const residentEmail = "e2e.resident.forced@hogaru.co";
const residentName = "E2E Resident Forced Password";
const documentNumber = "900100200";
const temporaryPassword = documentNumber;
const newPassword = "CambioSeguro2026*";

const firebaseDefaults = JSON.stringify({
  config: {
    projectId: "hogaru-1",
    appId: "1:1047056648517:web:a76ad8d0cb2138c3d9d62c",
    storageBucket: "hogaru-1.firebasestorage.app",
    apiKey: "AIzaSyDRvUIFC9SiODRNaBJkN5rNXRm3bYu4JxA",
    authDomain: "hogaru-1.firebaseapp.com",
    messagingSenderId: "1047056648517",
    measurementId: "G-L1XRDSMWBG",
    projectNumber: "1047056648517",
    version: "2",
  },
});

let appPort = 3005;

function appBaseUrl() {
  return `http://127.0.0.1:${appPort}`;
}

function createRuntimeEnv(extra = {}) {
  return {
    ...process.env,
    __FIREBASE_DEFAULTS__: firebaseDefaults,
    ...extra,
  };
}

async function getAvailablePort(preferredPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => {
      server.listen(0);
    });
    server.listen(preferredPort, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : preferredPort;
      server.close(() => resolve(port));
    });
  });
}

function now() {
  return admin.firestore.Timestamp.now();
}

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId });
}

async function ensureTenant(db) {
  await db.collection("tenants").doc(tenantId).set(
    {
      name: "Tenant E2E Resident Password",
      city: "Bogota",
      status: "active",
      planId: "plus",
      onboardingStatus: "completed",
      updatedAt: now(),
      createdAt: now(),
    },
    { merge: true },
  );
}

async function setupResidentFixture() {
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  await ensureTenant(db);

  let user;
  try {
    user = await auth.getUserByEmail(residentEmail);
    user = await auth.updateUser(user.uid, {
      email: residentEmail,
      password: temporaryPassword,
      displayName: residentName,
      emailVerified: true,
      disabled: false,
    });
  } catch {
    user = await auth.createUser({
      email: residentEmail,
      password: temporaryPassword,
      displayName: residentName,
      emailVerified: true,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(user.uid, {
    role: "resident",
    tenantId,
  });

  const timestamp = now();

  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email: residentEmail,
      fullName: residentName,
      role: "resident",
      tenantId,
      status: "active",
      unitId: "unit-e2e-501",
      unitLabel: "E2E-501",
      documentNumber,
      mustChangePassword: true,
      temporaryPassword: true,
      passwordStatus: "temporary",
      updatedAt: timestamp,
      createdAt: timestamp,
    },
    { merge: true },
  );

  await db.collection("tenantUsers").doc(`${tenantId}_${user.uid}`).set(
    {
      uid: user.uid,
      tenantId,
      fullName: residentName,
      email: residentEmail,
      role: "resident",
      status: "active",
      unitId: "unit-e2e-501",
      unitLabel: "E2E-501",
      documentNumber,
      mustChangePassword: true,
      temporaryPassword: true,
      passwordStatus: "temporary",
      updatedAt: timestamp,
      createdAt: timestamp,
    },
    { merge: true },
  );

  return { uid: user.uid };
}

async function cleanupResidentFixture(uid) {
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  try {
    await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).delete();
  } catch (error) {
    console.warn("[e2e.cleanup] tenantUsers delete warning", error);
  }

  try {
    await db.collection("users").doc(uid).delete();
  } catch (error) {
    console.warn("[e2e.cleanup] users delete warning", error);
  }

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    console.warn("[e2e.cleanup] auth delete warning", error);
  }
}

function runPlaywright() {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? [
          "/d",
          "/s",
          "/c",
          "npx playwright test tests/resident-forced-password-change.spec.ts --project=chromium",
        ]
      : ["playwright", "test", "tests/resident-forced-password-change.spec.ts", "--project=chromium"];
    const child = spawn(
      command,
      args,
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: createRuntimeEnv({
          PLAYWRIGHT_BASE_URL: appBaseUrl(),
          E2E_RESIDENT_EMAIL: residentEmail,
          E2E_RESIDENT_TEMP_PASSWORD: temporaryPassword,
          E2E_RESIDENT_NEW_PASSWORD: newPassword,
        }),
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Playwright exited with code ${code ?? "unknown"}.`));
    });
  });
}

function runNpmScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const commandLine = `npm run ${scriptName}${args.length ? ` -- ${args.join(" ")}` : ""}`;
    const spawnArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", commandLine]
      : ["run", scriptName, ...(args.length ? ["--", ...args] : [])];

    const child = spawn(command, spawnArgs, {
      cwd: process.cwd(),
      stdio: "inherit",
      env: createRuntimeEnv(),
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run ${scriptName} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function waitForHttpReady(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms.`);
}

function startAppServer() {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const commandLine = `npm run start -- --port ${appPort}`;
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", commandLine]
    : ["run", "start", "--", "--port", String(appPort)];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: createRuntimeEnv(),
  });

  return child;
}

async function main() {
  let fixture;
  let server;
  try {
    const nextDevLock = path.join(process.cwd(), ".next", "dev", "lock");
    await rm(nextDevLock, { force: true });

    appPort = await getAvailablePort(3005);

    console.info("[e2e.build] building application");
    await runNpmScript("build");

    console.info(`[e2e.server] starting app server on ${appPort}`);
    server = startAppServer();
    await waitForHttpReady(`${appBaseUrl()}/login`);
    console.info("[e2e.server] app server ready");

    console.info("[e2e.setup] preparing resident forced-password fixture");
    fixture = await setupResidentFixture();
    console.info("[e2e.setup] fixture ready", fixture);

    console.info("[e2e.run] executing playwright scenario");
    await runPlaywright();
    console.info("[e2e.run] scenario passed");
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
    if (fixture?.uid) {
      console.info("[e2e.cleanup] deleting fixture", fixture);
      await cleanupResidentFixture(fixture.uid);
      console.info("[e2e.cleanup] completed");
    }
  }
}

main().catch((error) => {
  console.error("[e2e] failed", error);
  process.exitCode = 1;
});
