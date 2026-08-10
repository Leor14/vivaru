import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";

/**
 * Fecha futura para las reservas. La regla exige `startAt` treinta minutos por
 * delante, así que una fecha fija se pudre: este test llevaba meses sin poder
 * pasar, y no se veía porque el emulador no corría.
 */
const manana = () => Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
import { afterAll, beforeAll, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: {
      rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "tenantUsers", "tenant-a_admin-1"), {
      uid: "admin-1",
      tenantId: "tenant-a",
      role: "tenant_admin",
      status: "active",
      email: "admin-1@hogaru.test",
      unitId: "unit-admin",
      unitLabel: "ADMIN",
    });

    await setDoc(doc(db, "users", "admin-1"), {
      uid: "admin-1",
      tenantId: "tenant-a",
      role: "tenant_admin",
      fullName: "Admin Uno",
      avatarId: "emoji1",
      email: "admin-1@hogaru.test",
      status: "active",
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
      temporaryPasswordUpdatedAt: null,
      passwordChangedAt: null,
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_admin-legacy"), {
      uid: "admin-legacy",
      tenantId: "tenant-a",
      role: "admin_tenant",
      status: "active",
      email: "admin-legacy@hogaru.test",
      unitId: "unit-admin",
      unitLabel: "ADMIN",
    });

    await setDoc(doc(db, "users", "admin-legacy"), {
      uid: "admin-legacy",
      tenantId: "tenant-a",
      role: "admin_tenant",
      fullName: "Admin Legacy",
      avatarId: "emoji2",
      email: "admin-legacy@hogaru.test",
      status: "active",
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
      temporaryPasswordUpdatedAt: null,
      passwordChangedAt: null,
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_admin-missing-flags"), {
      uid: "admin-missing-flags",
      tenantId: "tenant-a",
      role: "tenant_admin",
      status: "active",
      email: "admin-missing-flags@hogaru.test",
      unitId: "unit-admin",
      unitLabel: "ADMIN",
    });

    await setDoc(doc(db, "users", "admin-missing-flags"), {
      uid: "admin-missing-flags",
      tenantId: "tenant-a",
      role: "tenant_admin",
      fullName: "Admin Missing Flags",
      avatarId: "emoji4",
      email: "admin-missing-flags@hogaru.test",
      status: "active",
      updatedAt: "2026-03-10T10:00:00.000Z",
      createdAt: "2026-03-10T10:00:00.000Z",
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_resident-1"), {
      uid: "resident-1",
      tenantId: "tenant-a",
      role: "resident",
      unitId: "unit-t2-503",
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_resident-2"), {
      uid: "resident-2",
      tenantId: "tenant-a",
      role: "resident",
      unitId: "unit-t1-101",
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_guard-1"), {
      uid: "guard-1",
      tenantId: "tenant-a",
      role: "security_guard",
      unitId: "porteria",
    });

    await setDoc(doc(db, "tenantUsers", "tenant-b_resident-3"), {
      uid: "resident-3",
      tenantId: "tenant-b",
      role: "resident",
      unitId: "unit-b-701",
    });

    await setDoc(doc(db, "users", "admin-noncanonical"), {
      uid: "admin-noncanonical",
      tenantId: "tenant-a",
      role: "tenant_admin",
      fullName: "Admin Non Canonical",
      avatarId: "emoji3",
      email: "admin-noncanonical@hogaru.test",
      status: "active",
      mustChangePassword: false,
      temporaryPassword: false,
      passwordStatus: "updated",
      temporaryPasswordUpdatedAt: null,
      passwordChangedAt: null,
    });

    await setDoc(doc(db, "tenantUsers", "legacy-admin-profile-doc"), {
      uid: "admin-noncanonical",
      tenantId: "tenant-a",
      role: "tenant_admin",
      status: "active",
      email: "admin-noncanonical@hogaru.test",
      unitId: "unit-admin",
      unitLabel: "ADMIN",
    });

    await setDoc(doc(db, "tenants", "tenant-a"), {
      name: "Hogaru A",
      status: "active",
    });

    // Conjuntos que NO deben poder operar: un cliente que dejó de pagar y una
    // prueba vencida. Conservan sus datos y pueden consultarlos; no escribir.
    await setDoc(doc(db, "tenants", "tenant-susp"), { name: "Suspendido", status: "suspended" });
    await setDoc(doc(db, "tenants", "tenant-venc"), { name: "Vencido", status: "expired" });

    for (const [tenantId, uid] of [
      ["tenant-susp", "admin-susp"],
      ["tenant-venc", "admin-venc"],
    ]) {
      await setDoc(doc(db, "tenantUsers", `${tenantId}_${uid}`), {
        uid,
        tenantId,
        role: "tenant_admin",
        status: "active",
        email: `${uid}@hogaru.test`,
        unitId: "unit-admin",
        unitLabel: "ADMIN",
      });
      await setDoc(doc(db, "units", `unit-${tenantId}`), {
        tenantId,
        unitId: `u-${tenantId}`,
        displayName: "101",
        tower: "Principal",
        type: "apartment",
        status: "active",
      });
    }

    await setDoc(doc(db, "communications", "com-1"), {
      tenantId: "tenant-a",
      title: "Prueba",
      body: "Contenido",
      audience: "all",
      authorName: "Admin",
      publishedAt: "2026-03-10T10:00:00.000Z",
      createdBy: "admin-1",
    });

    await setDoc(doc(db, "packages", "pkg-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      reference: "PK-1001",
      status: "pending",
      createdBy: "admin-1",
    });

    // Soporte al cliente (PRD-V-FEAT-001). Se siembra ya creado porque el alta
    // real va por callable: las reglas solo tienen que gobernar la lectura.
    await setDoc(doc(db, "supportTickets", "sup-1"), {
      tenantId: "tenant-a",
      tenantName: "Hogaru A",
      createdBy: "admin-1",
      createdByName: "Admin Uno",
      createdByEmail: "admin-1@hogaru.test",
      category: "tecnico",
      subject: "No cargan los cobros",
      description: "Al abrir cartera queda girando.",
      priority: "media",
      status: "abierto",
      thread: [],
      lastActivityAt: "2026-08-01T10:00:00.000Z",
    });
    await setDoc(doc(db, "supportTickets", "sup-1", "internal", "n-1"), {
      note: "El conjunto tiene 400 unidades; puede ser paginación.",
      createdBy: "super-1",
    });
    // Un ticket de OTRO conjunto, para probar el aislamiento.
    await setDoc(doc(db, "supportTickets", "sup-b"), {
      tenantId: "tenant-b",
      tenantName: "Hogaru B",
      createdBy: "admin-b",
      createdByName: "Admin B",
      createdByEmail: "admin-b@hogaru.test",
      category: "otro",
      subject: "Consulta",
      description: "Texto",
      priority: "media",
      status: "abierto",
      thread: [],
      lastActivityAt: "2026-08-01T10:00:00.000Z",
    });

    await setDoc(doc(db, "tickets", "tic-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      category: "pqrs",
      subject: "Ruido",
      status: "open",
      createdBy: "resident-1",
      updatedAt: "2026-03-10T10:00:00.000Z",
    });

    await setDoc(doc(db, "visitorPasses", "vis-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      visitorName: "Camila Suarez",
      visitDate: "2026-03-12",
      status: "scheduled",
      createdBy: "resident-1",
    });

    await setDoc(doc(db, "visitorPasses", "vis-guard-checkin"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      visitorName: "Daniel Acosta",
      documentNumber: "1010123456",
      qrCodeValue: "QR-GUARD-FLOW",
      hostResidentName: "Residente Demo",
      tower: "T2",
      unit: "503",
      date: "2026-03-21",
      scheduledTime: "2026-03-21T09:30:00.000Z",
      status: "scheduled",
      checkInAt: null,
      checkOutAt: null,
      createdBy: "resident-1",
    });

    await setDoc(doc(db, "visitorPasses", "vis-guard-checkout"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      visitorName: "Luisa Marin",
      documentNumber: "1099988877",
      qrCodeValue: "QR-GUARD-CHECKOUT",
      hostResidentName: "Residente Demo",
      tower: "T2",
      unit: "503",
      date: "2026-03-21",
      scheduledTime: "2026-03-21T11:00:00.000Z",
      status: "scheduled",
      checkInAt: null,
      checkOutAt: null,
      createdBy: "resident-1",
    });

    await setDoc(doc(db, "billingStatements", "bill-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      period: "2026-03",
      balance: 120000,
      status: "pending",
      createdBy: "admin-1",
    });

    await setDoc(doc(db, "documents", "doc-1"), {
      tenantId: "tenant-a",
      title: "Reglamento interno.pdf",
      category: "reglamento",
      audience: "all",
      uploadedAt: "2026-03-10T10:00:00.000Z",
      createdBy: "admin-1",
    });

    await setDoc(doc(db, "amenities", "am-1"), {
      tenantId: "tenant-a",
      name: "Salon social",
      category: "social",
      status: "active",
      isReservable: true,
      createdBy: "admin-1",
      updatedBy: "admin-1",
    });

    await setDoc(doc(db, "amenities", "am-inactive"), {
      tenantId: "tenant-a",
      name: "Terraza BBQ",
      category: "social",
      status: "inactive",
      isReservable: true,
      createdBy: "admin-1",
      updatedBy: "admin-1",
    });

    await setDoc(doc(db, "amenities", "am-b-1"), {
      tenantId: "tenant-b",
      name: "Sala de juntas",
      category: "business",
      status: "active",
      isReservable: true,
      createdBy: "admin-2",
      updatedBy: "admin-2",
    });

    await setDoc(doc(db, "reservations", "res-own-cancel"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      amenityId: "am-1",
      amenity: "Salon social",
      date: "2026-03-25",
      startTime: "18:00",
      endTime: "19:00",
      slot: "18:00 - 19:00",
      exclusiveUse: false,
      status: "pending",
      createdBy: "resident-1",
      updatedBy: "resident-1",
    });

    await setDoc(doc(db, "reservations", "res-other-owner"), {
      tenantId: "tenant-a",
      unitId: "unit-t1-101",
      unitLabel: "T1-101",
      amenityId: "am-1",
      amenity: "Salon social",
      date: "2026-03-26",
      startTime: "18:00",
      endTime: "19:00",
      slot: "18:00 - 19:00",
      exclusiveUse: false,
      status: "pending",
      createdBy: "resident-2",
      updatedBy: "resident-2",
    });
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe("Firestore Rules - HOGARU", () => {
  it("bloquea lectura cross-tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(resident.firestore(), "communications", "com-1")));
  });

  it("permite lectura al residente de su tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "communications", "com-1")));
  });

  it("permite confirmar paquete al residente con receivedBy propio", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(resident.firestore(), "packages", "pkg-1"), {
        status: "delivered",
        receivedBy: "resident-1",
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
      }),
    );
  });

  it("bloquea confirmar paquete para otro usuario", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(resident.firestore(), "packages", "pkg-1"), {
        status: "delivered",
        receivedBy: "resident-999",
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
      }),
    );
  });

  it("bloquea update de ticket por residente que no lo creo", async () => {
    const resident = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(resident.firestore(), "tickets", "tic-1"), {
        status: "resolved",
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
      }),
    );
  });

  it("bloquea lectura de paquete de otra unidad en mismo tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "packages", "pkg-1")));
  });

  it("bloquea lectura de visitante de otra unidad en mismo tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "visitorPasses", "vis-1")));
  });

  it("permite create de visitante al residente para su propia unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(resident.firestore(), "visitorPasses", "vis-2"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        visitorName: "Luis Mejia",
        visitDate: "2026-03-15",
        status: "scheduled",
        createdBy: "resident-1",
      }),
    );
  });

  it("bloquea create de visitante al residente para otra unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(resident.firestore(), "visitorPasses", "vis-3"), {
        tenantId: "tenant-a",
        unitId: "unit-t1-101",
        unitLabel: "T1-101",
        visitorName: "Invitado externo",
        visitDate: "2026-03-16",
        status: "scheduled",
        createdBy: "resident-1",
      }),
    );
  });

  it("permite update de visitante al creador de la misma unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(resident.firestore(), "visitorPasses", "vis-1"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        visitorName: "Camila Suarez",
        visitDate: "2026-03-12",
        status: "checked_in",
        createdBy: "resident-1",
      }),
    );
  });

  it("bloquea delete de visitante a residente de otra unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(resident.firestore(), "visitorPasses", "vis-1")));
  });

  it("permite lectura de billing de su unidad al residente", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "billingStatements", "bill-1")));
  });

  it("permite lectura de documentos del tenant al residente", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "documents", "doc-1")));
  });

  // ── Recorrido guiado (tenantOnboarding) ─────────────────────────────────────
  // Vive fuera de `tenants` a propósito: ese documento guarda `status` y
  // `trialEndsAt`, y dar escritura al admin para palomear un checklist le
  // abriría la puerta a extenderse la prueba solo.

  it("permite a tenant_admin registrar su avance del recorrido guiado", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "tenantOnboarding", "tenant-a"), {
        tenantId: "tenant-a",
        seen: { "portal-residente": "2026-08-01T10:00:00.000Z" },
        activationDone: 5,
        activationTotal: 7,
      }),
    );
  });

  it("bloquea a un residente leer el avance del recorrido de su conjunto", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "tenantOnboarding", "tenant-a")));
  });

  it("bloquea a un residente escribir el avance del recorrido", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(resident.firestore(), "tenantOnboarding", "tenant-a"), {
        tenantId: "tenant-a",
        activationDone: 7,
      }),
    );
  });

  it("bloquea a un admin tocar el avance de otro tenant", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "tenantOnboarding", "tenant-b"), {
        tenantId: "tenant-b",
        activationDone: 0,
      }),
    );
  });

  it("bloquea escribir un avance cuyo tenantId no coincide con el documento", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "tenantOnboarding", "tenant-a"), {
        tenantId: "tenant-b",
        activationDone: 7,
      }),
    );
  });

  // ── Soporte al cliente (PRD-V-FEAT-001) ───────────────────────────────────
  // La escritura va SIEMPRE por callable, así que aquí solo se gobierna quién
  // puede leer. Los casos que deben fallar son el contrato de seguridad.

  it("permite al admin del conjunto leer los tickets de soporte de SU conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "supportTickets", "sup-1")));
  });

  it("permite al superadmin leer cualquier ticket de soporte", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "supportTickets", "sup-b")));
  });

  it("bloquea al admin leer un ticket de soporte de OTRO conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "supportTickets", "sup-b")));
  });

  it("bloquea al RESIDENTE leer tickets de soporte", async () => {
    // Su canal es PQRS, con su administración. Si pudiera escribir a Vivaru,
    // Vivaru sería primera línea de los problemas del conjunto.
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "supportTickets", "sup-1")));
  });

  it("bloquea a PORTERÍA leer tickets de soporte", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "supportTickets", "sup-1")));
  });

  it("bloquea al admin CREAR un ticket directamente — el alta es por callable", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "supportTickets", "sup-falso"), {
        tenantId: "tenant-a",
        tenantName: "Hogaru A",
        createdBy: "admin-1",
        category: "tecnico",
        subject: "Directo",
        description: "Sin pasar por la callable",
        priority: "alta",
        status: "abierto",
        thread: [],
      }),
    );
  });

  it("bloquea al admin cambiar el estado o la prioridad de su ticket", async () => {
    // La prioridad la asigna Vivaru; el estado lo mueve el flujo, no el cliente.
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "supportTickets", "sup-1"), { status: "resuelto", priority: "alta" }),
    );
  });

  it("bloquea al SUPERADMIN escribir directamente — también él pasa por callable", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(updateDoc(doc(sa.firestore(), "supportTickets", "sup-1"), { status: "en_proceso" }));
  });

  it("bloquea el borrado de un ticket a cualquier rol", async () => {
    // Un ticket cerrado es historial de la relación comercial.
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(sa.firestore(), "supportTickets", "sup-1")));
    await assertFails(deleteDoc(doc(admin.firestore(), "supportTickets", "sup-1")));
  });

  it("bloquea al admin leer las NOTAS INTERNAS de su propio ticket", async () => {
    // Es la única información asimétrica del modelo. Vive en subcolección
    // justamente porque las reglas no filtran campos: en el mismo documento,
    // el admin la recibiría entera al leer el ticket.
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "supportTickets", "sup-1", "internal", "n-1")));
  });

  it("permite al superadmin leer las notas internas", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "supportTickets", "sup-1", "internal", "n-1")));
  });

  it("un conjunto SUSPENDIDO conserva la lectura de soporte", async () => {
    // Excepción deliberada a tenantOperable: es el canal por el que un cliente
    // suspendido deja de estarlo. Bloquearlo sería encerrarlo fuera.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "supportTickets", "sup-susp"), {
        tenantId: "tenant-susp",
        tenantName: "Suspendido",
        createdBy: "admin-susp",
        createdByName: "Admin Susp",
        createdByEmail: "admin-susp@hogaru.test",
        category: "facturacion",
        subject: "Quiero reactivar",
        description: "Texto",
        priority: "alta",
        status: "abierto",
        thread: [],
        lastActivityAt: "2026-08-01T10:00:00.000Z",
      });
    });
    const admin = testEnv.authenticatedContext("admin-susp", { role: "tenant_admin", tenantId: "tenant-susp" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "supportTickets", "sup-susp")));
  });

  // ── Ambientes en solo lectura (tenantOperable) ────────────────────────────
  // `suspended` (cliente que dejó de pagar) y `expired` (prueba vencida)
  // conservan sus datos y pueden consultarlos, pero no operar. Antes esto solo
  // lo hacían las Cloud Functions; lo que la app escribe DIRECTO a Firestore
  // —crear una unidad, registrar una persona— se colaba por las reglas.

  for (const [etiqueta, tenantId, uid] of [
    ["suspendido", "tenant-susp", "admin-susp"],
    ["vencido", "tenant-venc", "admin-venc"],
  ] as const) {
    it(`permite a un conjunto ${etiqueta} LEER sus unidades`, async () => {
      const admin = testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId });
      await assertSucceeds(getDoc(doc(admin.firestore(), "units", `unit-${tenantId}`)));
    });

    it(`bloquea a un conjunto ${etiqueta} crear unidades`, async () => {
      const admin = testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId });
      await assertFails(
        setDoc(doc(admin.firestore(), "units", `unit-nueva-${tenantId}`), {
          tenantId,
          unitId: "u-nueva",
          displayName: "202",
          tower: "Principal",
          type: "apartment",
          status: "active",
        }),
      );
    });

    it(`bloquea a un conjunto ${etiqueta} registrar personas`, async () => {
      const admin = testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId });
      await assertFails(
        setDoc(doc(admin.firestore(), "people", `p-${tenantId}`), {
          tenantId,
          fullName: "Alguien",
          email: "alguien@hogaru.test",
          roleType: "owner_occupant",
          occupancyType: "owner_occupant",
          unitId: `unit-${tenantId}`,
          status: "active",
        }),
      );
    });

    it(`bloquea a un conjunto ${etiqueta} borrar sus unidades`, async () => {
      const admin = testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId });
      await assertFails(deleteDoc(doc(admin.firestore(), "units", `unit-${tenantId}`)));
    });

    it(`bloquea a un conjunto ${etiqueta} emitir cobros`, async () => {
      const admin = testEnv.authenticatedContext(uid, { role: "tenant_admin", tenantId });
      await assertFails(
        setDoc(doc(admin.firestore(), "billingStatements", `bs-${tenantId}`), {
          tenantId,
          unitId: `unit-${tenantId}`,
          unitLabel: "101",
          period: "2026-08",
          concept: "administracion",
          amount: 100000,
          balance: 100000,
          status: "pending",
        }),
      );
    });
  }

  it("un conjunto ACTIVO sigue pudiendo crear unidades", async () => {
    // La contraparte imprescindible: la guarda no puede haber roto lo normal.
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "units", "unit-activa-nueva"), {
        tenantId: "tenant-a",
        unitId: "u-activa",
        displayName: "303",
        tower: "Principal",
        type: "apartment",
        status: "active",
      }),
    );
  });

  it("permite a tenant_admin crear amenidades de su tenant", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "amenities", "am-2"), {
        tenantId: "tenant-a",
        name: "Coworking",
        category: "business",
        status: "active",
        createdBy: "admin-1",
        updatedBy: "admin-1",
      }),
    );
  });

  it("permite a tenant_admin actualizar solo campos visibles en tenantUsers propio", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "tenantUsers", "tenant-a_admin-1"), {
        fullName: "Admin Uno",
      }),
    );
  });

  it("permite a admin_tenant legacy actualizar campos visibles en tenantUsers propio", async () => {
    const adminLegacy = testEnv.authenticatedContext("admin-legacy", { role: "admin_tenant", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(adminLegacy.firestore(), "tenantUsers", "tenant-a_admin-legacy"), {
        fullName: "Admin Legacy",
      }),
    );
  });

  it("bloquea que admin cambie campos sensibles en tenantUsers", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "tenantUsers", "tenant-a_admin-1"), {
        role: "security_guard",
      }),
    );
  });

  it("permite a tenant_admin actualizar su propio users con fullName y avatarId", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "users", "admin-1"), {
        fullName: "Admin Uno Editado",
        avatarId: "emoji12",
      }),
    );
  });

  it("bloquea a tenant_admin modificar role en users propio", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "users", "admin-1"), {
        role: "security_guard",
      }),
    );
  });

  it("permite update de users legacy cuando faltan campos de password status", async () => {
    const admin = testEnv.authenticatedContext("admin-missing-flags", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "users", "admin-missing-flags"), {
        fullName: "Admin Missing Flags Editado",
        avatarId: "emoji5",
      }),
    );
  });

  it("permite query tenantUsers por uid pero bloquea leer tenants si falta membership canonico", async () => {
    const admin = testEnv.authenticatedContext("admin-noncanonical", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "tenantUsers", "tenant-a_admin-noncanonical")));

    await assertSucceeds(
      getDocs(query(collection(admin.firestore(), "tenantUsers"), where("uid", "==", "admin-noncanonical"), limit(1))),
    );

    await assertFails(getDoc(doc(admin.firestore(), "tenants", "tenant-a")));
  });

  it("bloquea a tenant_admin crear amenidades en otro tenant", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "amenities", "am-3"), {
        tenantId: "tenant-b",
        name: "Gimnasio",
        category: "sports",
        status: "active",
        createdBy: "admin-1",
        updatedBy: "admin-1",
      }),
    );
  });

  it("bloquea lectura cross-tenant de amenidades", async () => {
    const residentOtherTenant = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(residentOtherTenant.firestore(), "amenities", "am-1")));
  });

  it("permite a residente leer amenidad activa de su tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "amenities", "am-1")));
  });

  it("bloquea a residente leer amenidad inactiva aunque sea de su tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "amenities", "am-inactive")));
  });

  it("permite crear reserva de residente con amenidad activa de su tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(resident.firestore(), "reservations", "res-1"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        amenityId: "am-1",
        amenity: "Salon social",
        date: "2026-03-20",
        startTime: "18:00",
        endTime: "20:00",
        slot: "18:00 - 20:00",
        exclusiveUse: false,
        status: "pending",
        createdBy: "resident-1",
        // La regla exige `startAt` con 30 minutos de margen. La app sí lo manda
        // (`use-reservations.ts`); al test se le había quedado sin actualizar.
        startAt: manana(),
      }),
    );
  });

  it("bloquea crear reserva con amenidad de otro tenant", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(resident.firestore(), "reservations", "res-2"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        amenityId: "am-b-1",
        amenity: "Sala de juntas",
        date: "2026-03-21",
        startTime: "18:00",
        endTime: "20:00",
        slot: "18:00 - 20:00",
        exclusiveUse: false,
        status: "pending",
        createdBy: "resident-1",
      }),
    );
  });

  it("bloquea crear reserva con amenidad inactiva", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(resident.firestore(), "reservations", "res-3"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        amenityId: "am-inactive",
        amenity: "Terraza BBQ",
        date: "2026-03-22",
        startTime: "18:00",
        endTime: "20:00",
        slot: "18:00 - 20:00",
        exclusiveUse: false,
        status: "pending",
        createdBy: "resident-1",
      }),
    );
  });

  it("bloquea query de pre-validacion por amenidad y fecha sin filtro de unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      getDocs(
        query(
          collection(resident.firestore(), "reservations"),
          where("tenantId", "==", "tenant-a"),
          where("amenityId", "==", "am-1"),
          where("date", "==", "2026-03-26"),
        ),
      ),
    );
  });

  it("permite query de pre-validacion cuando incluye filtro por unidad propia", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(
        query(
          collection(resident.firestore(), "reservations"),
          where("tenantId", "==", "tenant-a"),
          where("amenityId", "==", "am-1"),
          where("date", "==", "2026-03-25"),
          where("unitId", "==", "unit-t2-503"),
        ),
      ),
    );
  });

  it("permite al residente cancelar su propia reserva", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(resident.firestore(), "reservations", "res-own-cancel"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        amenityId: "am-1",
        amenity: "Salon social",
        date: "2026-03-25",
        startTime: "18:00",
        endTime: "19:00",
        slot: "18:00 - 19:00",
        exclusiveUse: false,
        status: "cancelled",
        createdBy: "resident-1",
        updatedBy: "resident-1",
        cancelledAt: "2026-03-20T10:00:00.000Z",
      }),
    );
  });

  it("bloquea al residente cancelar reserva creada por otro usuario", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(resident.firestore(), "reservations", "res-other-owner"), {
        tenantId: "tenant-a",
        unitId: "unit-t1-101",
        unitLabel: "T1-101",
        amenityId: "am-1",
        amenity: "Salon social",
        date: "2026-03-26",
        startTime: "18:00",
        endTime: "19:00",
        slot: "18:00 - 19:00",
        exclusiveUse: false,
        status: "cancelled",
        createdBy: "resident-2",
        updatedBy: "resident-1",
        cancelledAt: "2026-03-20T10:00:00.000Z",
      }),
    );
  });

  it("permite al guarda leer reservas del tenant", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(guard.firestore(), "reservations", "res-other-owner")));
  });

  it("permite al guarda leer amenidad activa de su tenant", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(guard.firestore(), "amenities", "am-1")));
  });

  it("bloquea al guarda leer amenidad inactiva de su tenant", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "amenities", "am-inactive")));
  });

  it("permite al guarda leer visitantes del tenant", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(guard.firestore(), "visitorPasses", "vis-1")));
  });

  it("permite al guarda marcar ingreso (scheduled -> inside)", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(guard.firestore(), "visitorPasses", "vis-guard-checkin"), {
        status: "inside",
        checkInAt: "2026-03-21T09:32:00.000Z",
      }),
    );
  });

  it("permite al guarda marcar salida (inside -> completed)", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });

    await assertSucceeds(
      updateDoc(doc(guard.firestore(), "visitorPasses", "vis-guard-checkout"), {
        status: "inside",
        checkInAt: "2026-03-21T09:35:00.000Z",
      }),
    );

    await assertSucceeds(
      updateDoc(doc(guard.firestore(), "visitorPasses", "vis-guard-checkout"), {
        status: "completed",
        checkOutAt: "2026-03-21T10:08:00.000Z",
      }),
    );
  });

  it("bloquea al guarda registrar salida sin ingreso previo", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(guard.firestore(), "visitorPasses", "vis-1"), {
        status: "completed",
        checkOutAt: "2026-03-21T10:10:00.000Z",
      }),
    );
  });

  it("bloquea al guarda editar datos personales del visitante", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(guard.firestore(), "visitorPasses", "vis-1"), {
        visitorName: "Nombre Alterado",
      }),
    );
  });

  it("permite al guarda registrar paquetes en estado pendiente", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(guard.firestore(), "packages", "pkg-guard-1"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        reference: "PK-GUARD-1",
        recipientName: "Carlos Gomez",
        tower: "T2",
        unit: "503",
        description: "Sobre de correspondencia",
        status: "pending",
        registeredBy: "guard-1",
        createdBy: "guard-1",
      }),
    );
  });

  it("permite al guarda marcar paquete como entregado", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(guard.firestore(), "packages", "pkg-guard-1"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        reference: "PK-GUARD-1",
        recipientName: "Carlos Gomez",
        tower: "T2",
        unit: "503",
        description: "Sobre de correspondencia",
        status: "delivered",
        registeredBy: "guard-1",
        updatedBy: "guard-1",
        deliveredAt: "2026-03-20T10:00:00.000Z",
      }),
    );
  });

  it("bloquea al guarda leer datos de otro tenant", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "amenities", "am-b-1")));
  });
});

/**
 * Banderas de funcionalidad y kill switch (Paso 1.1 de docs/hoja-de-ruta-ia.md).
 *
 * Lo que se prueba aquí no es que las banderas funcionen —eso es el resolutor
 * puro, en tests/feature-flags.test.ts— sino las dos cosas que solo las reglas
 * pueden garantizar: que nadie se encienda una capacidad a sí mismo, y que los
 * overrides de un conjunto no se lean desde otro.
 */
describe("Firestore Rules - banderas de funcionalidad", () => {
  const sa = () => testEnv.authenticatedContext("super-1", { role: "superadmin" });
  const adminA = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
  const residentA = () => testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
  const residentB = () => testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });

  it("superadmin crea una bandera con booleanos", async () => {
    await assertSucceeds(
      setDoc(doc(sa().firestore(), "featureFlags", "ai-communications-draft"), {
        enabled: false,
        killSwitch: false,
      }),
    );
  });

  it("rechaza una bandera con enabled en texto", async () => {
    // "true" escrito a mano es el error típico de consola. El lector lo ignora
    // y falla apagado; la regla además impide que llegue a escribirse.
    await assertFails(
      setDoc(doc(sa().firestore(), "featureFlags", "ai-gateway"), { enabled: "true" }),
    );
  });

  it("cualquier sesión puede leer las banderas", async () => {
    await assertSucceeds(getDoc(doc(residentA().firestore(), "featureFlags", "ai-communications-draft")));
  });

  it("un admin de conjunto no puede encenderse una bandera", async () => {
    await assertFails(
      setDoc(doc(adminA().firestore(), "featureFlags", "ai-communications-draft"), { enabled: true }),
    );
  });

  it("superadmin escribe los overrides de un conjunto", async () => {
    await assertSucceeds(
      setDoc(doc(sa().firestore(), "featureFlagOverrides", "tenant-a"), {
        flags: { "ai-communications-draft": true },
      }),
    );
  });

  it("rechaza overrides cuyo campo flags no es un mapa", async () => {
    await assertFails(
      setDoc(doc(sa().firestore(), "featureFlagOverrides", "tenant-b"), { flags: "todo" }),
    );
  });

  it("un miembro lee los overrides de su propio conjunto", async () => {
    await assertSucceeds(getDoc(doc(residentA().firestore(), "featureFlagOverrides", "tenant-a")));
  });

  it("bloquea leer los overrides de otro conjunto", async () => {
    // El motivo de que los overrides no vivan dentro del documento de la
    // bandera: ahí cualquier residente firmado podría enumerar los conjuntos.
    await assertFails(getDoc(doc(residentB().firestore(), "featureFlagOverrides", "tenant-a")));
  });

  it("un admin no puede escribir los overrides de su propio conjunto", async () => {
    await assertFails(
      setDoc(doc(adminA().firestore(), "featureFlagOverrides", "tenant-a"), {
        flags: { "ai-communications-draft": true },
      }),
    );
  });
});

/**
 * Telemetría de IA (Paso 1.5 de docs/hoja-de-ruta-ia.md).
 *
 * Solo la escribe el servidor, igual que auditLogs: una fila que pudiera
 * escribir el cliente no serviría para medir nada — ni el gasto ni la tasa de
 * fallo, que es la métrica que dice si la capacidad sirve.
 */
describe("Firestore Rules - telemetría de IA", () => {
  it("superadmin puede leer el consumo", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "aiUsage", "cualquiera")));
  });

  it("bloquea la lectura a un admin de conjunto", async () => {
    // Son datos de todos los conjuntos a la vez.
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "aiUsage", "cualquiera")));
  });

  it("nadie escribe telemetría desde el cliente, ni el superadmin", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "aiUsage", "inventada"), {
        tenantId: "tenant-a",
        operationKey: "comunicaciones-redactar",
        estimatedCostUsd: 0,
      }),
    );
  });
});

/**
 * Contadores de cuota de IA (Paso 1.6). Un contador que el cliente pudiera
 * tocar no es una cuota: se escriben solo desde el servidor y en transacción.
 */
describe("Firestore Rules - contadores de cuota de IA", () => {
  it("superadmin puede leer los contadores", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "aiQuotaCounters", "t:tenant-a:op:d:2026-08-10")));
  });

  it("bloquea que un admin lea los contadores", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "aiQuotaCounters", "t:tenant-a:op:d:2026-08-10")));
  });

  it("nadie puede bajarse el contador desde el cliente, ni el superadmin", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "aiQuotaCounters", "t:tenant-a:op:d:2026-08-10"), { count: 0 }),
    );
  });
});
