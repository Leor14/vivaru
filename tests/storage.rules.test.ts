import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

// Rutas sembradas con reglas desactivadas para luego probar la LECTURA.
const TENANT_A_DOC = "tenants/tenant-a/documents/acta.txt";
const TENANT_B_DOC = "tenants/tenant-b/documents/acta.txt";
const FUERA_DE_TENANT = "uploads/suelto.txt";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    storage: {
      rules: fs.readFileSync(path.resolve("storage.rules"), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });

  await testEnv.clearStorage();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const storage = context.storage();
    await uploadString(ref(storage, TENANT_A_DOC), "acta del conjunto A");
    await uploadString(ref(storage, TENANT_B_DOC), "acta del conjunto B");
    await uploadString(ref(storage, FUERA_DE_TENANT), "archivo suelto");
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe("Storage Rules - Vivaru", () => {
  // ── Lectura: aislamiento multi-tenant (regresion del fix jun 2026) ──────────

  it("permite a un residente leer archivos de su propio tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getBytes(ref(resident.storage(), TENANT_A_DOC)));
  });

  it("permite a un admin leer archivos de su propio tenant", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getBytes(ref(admin.storage(), TENANT_A_DOC)));
  });

  it("BLOQUEA leer archivos de OTRO tenant (fuga cross-tenant cerrada)", async () => {
    const intruso = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getBytes(ref(intruso.storage(), TENANT_A_DOC)));
  });

  it("bloquea leer a un admin de otro tenant", async () => {
    const adminB = testEnv.authenticatedContext("admin-2", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getBytes(ref(adminB.storage(), TENANT_A_DOC)));
  });

  it("bloquea leer a un usuario sin autenticar", async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(anon.storage(), TENANT_A_DOC)));
  });

  it("permite al superadmin leer cualquier tenant", async () => {
    const superadmin = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getBytes(ref(superadmin.storage(), TENANT_A_DOC)));
    await assertSucceeds(getBytes(ref(superadmin.storage(), TENANT_B_DOC)));
  });

  // ── Escritura: solo el propio tenant o superadmin ───────────────────────────

  it("permite a un admin subir archivos a su propio tenant", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      uploadString(ref(admin.storage(), "tenants/tenant-a/documents/nuevo.txt"), "nuevo documento"),
    );
  });

  it("bloquea subir archivos al tenant de otro conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      uploadString(ref(admin.storage(), "tenants/tenant-b/documents/intruso.txt"), "no permitido"),
    );
  });

  it("permite al superadmin subir a cualquier tenant", async () => {
    const superadmin = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(
      uploadString(ref(superadmin.storage(), "tenants/tenant-b/documents/super.txt"), "ok"),
    );
  });

  // ── Default-deny fuera de tenants/ ──────────────────────────────────────────

  it("bloquea leer rutas fuera de tenants/ aun autenticado", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getBytes(ref(resident.storage(), FUERA_DE_TENANT)));
  });

  it("bloquea escribir rutas fuera de tenants/", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(uploadString(ref(admin.storage(), "uploads/otro.txt"), "no permitido"));
  });
});
