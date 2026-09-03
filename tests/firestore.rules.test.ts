import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, query, runTransaction, setDoc, updateDoc, where } from "firebase/firestore";

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

    // `PRD-V-FLOW-005` — pases capturados por PORTERÍA. Lo que los distingue del flujo de QR es
    // llevar `authorizationStatus`; su ausencia significa «es del QR».
    for (const [id, estado] of [
      ["vis-porteria-pendiente", "pendiente"],
      ["vis-porteria-autorizada", "autorizada"],
      ["vis-porteria-rechazada", "rechazada"],
    ] as const) {
      await setDoc(doc(db, "visitorPasses", id), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        unitLabel: "T2-503",
        visitorName: "Ana Gómez",
        documentNumber: "1020304050",
        qrCodeValue: "",
        hostResidentName: "Residente Demo",
        tower: "T2",
        unit: "503",
        date: "2026-03-21",
        scheduledTime: "10:00",
        status: "scheduled",
        checkInAt: null,
        checkOutAt: null,
        registeredByGuard: true,
        origen: "porteria",
        authorizationStatus: estado,
        // Lo crea el GUARDIA, no el residente: es la razón dura de que resolver sea una callable.
        createdBy: "guard-1",
      });
    }

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

    // FLOW-002. Un cargo que YA lleva anticipo aplicado: sirve para comprobar
    // que el administrador puede seguir editandolo mientras no toque ese campo.
    await setDoc(doc(db, "billingStatements", "bill-con-anticipo"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      period: "2026-04",
      amount: 140000,
      paymentAmount: 0,
      advanceAppliedAmount: 60000,
      balance: 80000,
      status: "pending",
      createdBy: "admin-1",
    });

    // FLOW-001. Un cargo que YA viene de un prorrateo: sirve para comprobar que
    // el administrador puede seguir editandolo mientras no toque su origen.
    await setDoc(doc(db, "billingStatements", "bill-de-reparto"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      period: "2026-08",
      campaignId: "exp_op-1",
      sourceExpenseId: "gasto-ascensor",
      amount: 250000,
      paymentAmount: 0,
      balance: 250000,
      distributionBasisValue: 25,
      status: "pending",
      createdBy: "admin-1",
    });

    // FEAT-004. Un certificado de la unidad del residente `resident-1`.
    // FLOW-003 · ajustes del conjunto, para el calendario de cobranza.
    await setDoc(doc(db, "tenantSettings", "tenant-a"), {
      tenantId: "tenant-a",
      billingCalendar: { noticeDayOfMonth: 5, overdueCycleDays: 15 },
    });

    // FLOW-003 · rastro de entrega. El id ES el del proveedor (§7.1).
    await setDoc(doc(db, "emailDeliveries", "resend-msg-1"), {
      tenantId: "tenant-a",
      providerMessageId: "resend-msg-1",
      recipientEmail: "residente@ejemplo.co",
      recipientUserId: "resident-1",
      notificationKey: "billing_new",
      subject: "Tu cuota de agosto",
      status: "enviado",
    });

    await setDoc(doc(db, "clearanceCertificates", "pys-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      issuedAt: "2026-08-25",
      asOfDate: "2026-08-25",
      code: "PYS-ABC234",
      balanceAtIssue: 0,
      status: "emitido",
    });

    await setDoc(doc(db, "tenantUsers", "tenant-a_committee-1"), {
      uid: "committee-1",
      tenantId: "tenant-a",
      role: "committee",
      unitId: "unit-t1-101",
    });

    await setDoc(doc(db, "advances", "adv-1"), {
      tenantId: "tenant-a",
      unitId: "unit-t2-503",
      unitLabel: "T2-503",
      amount: 60000,
      remaining: 60000,
      origin: "overpayment",
      status: "open",
      date: "2026-04-01",
      sourceOperationKey: "op-1",
      ledgerEntryId: "le-adv-1",
    });

    await setDoc(doc(db, "advanceApplications", "advapp-1"), {
      tenantId: "tenant-a",
      advanceId: "adv-1",
      statementId: "bill-con-anticipo",
      unitId: "unit-t2-503",
      amount: 60000,
      date: "2026-04-05",
      operationKey: "op-cruce-1",
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

    // FLOW-002 CA11: las cuentas del conjunto, y el saldo inicial FUERA de
    // ellas. Una activa y una de baja, que son los dos lados de la regla nueva.
    await setDoc(doc(db, "bankAccounts", "bank-a-activa"), {
      tenantId: "tenant-a",
      label: "Cuenta operativa",
      bankName: "Bancolombia",
      accountNumber: "****4821",
      active: true,
    });
    await setDoc(doc(db, "bankAccounts", "bank-a-baja"), {
      tenantId: "tenant-a",
      label: "Cuenta antigua",
      bankName: "Davivienda",
      accountNumber: "****1200",
      active: false,
    });
    // Documentos: la coleccion mezcla lo compartible con los archivos que
    // genera `monthlyFinancialArchive`, y esos llevan detalle POR UNIDAD.
    await setDoc(doc(db, "documents", "doc-a-reglamento"), {
      tenantId: "tenant-a",
      fileName: "Reglamento-interno.pdf",
      category: "reglamento",
    });
    await setDoc(doc(db, "documents", "doc-a-acta"), {
      tenantId: "tenant-a",
      fileName: "Acta-asamblea.pdf",
      category: "otro",
    });
    await setDoc(doc(db, "documents", "doc-a-cartera"), {
      tenantId: "tenant-a",
      fileName: "Historico-cartera.xlsx",
      category: "financiero",
      source: "cartera_history",
    });
    await setDoc(doc(db, "documents", "doc-a-reporte"), {
      tenantId: "tenant-a",
      fileName: "Reporte-Comite.pdf",
      category: "reporte",
      source: "committee_report",
    });
    await setDoc(doc(db, "documents", "doc-a-sin-categoria"), {
      tenantId: "tenant-a",
      fileName: "Suelto.pdf",
    });

    await setDoc(doc(db, "bankAccountBalances", "bank-a-activa"), {
      tenantId: "tenant-a",
      openingBalance: 85000,
    });

    // REVOPS-001E: un lead y un comercial para probar la propiedad comercial.
    await setDoc(doc(db, "leads", "lead-1"), {
      origen: "demo",
      nombre: "Prospecto Uno",
      email: "prospecto@ejemplo.test",
      status: "nuevo",
    });
    await setDoc(doc(db, "salesReps", "rep-1"), {
      name: "Comercial Uno",
      email: "kam@vivaru.test",
      country: "MX",
      active: true,
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

  /**
   * **`PRD-V-FIX-001` paso 4, invertida el 24 de agosto de 2026.** Esta prueba
   * decía «permite» y era correcta hasta ese día: el residente creaba la reserva
   * por escritura directa y la regla solo validaba **quién y dónde**, no cuánto,
   * cuándo ni si debe. Ahora pasa por `createReservationRequest`.
   *
   * El caso es el que ANTES funcionaba —amenidad activa, su unidad, `startAt`
   * con margen—, para que lo que se mide sea el cierre y no otra cosa.
   */
  it("BLOQUEA crear reserva de residente por escritura directa, aunque todo lo demás esté bien", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
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

  /**
   * **La prueba que distingue «cerrado para el residente» de «cerrado para
   * todos», y no existía.** Tras el paso 4, las dos de abajo —«amenidad de otro
   * tenant» e «inactiva»— pasan **por el motivo equivocado**: al residente le
   * falla todo, así que ya no miden lo suyo. Sin esta, romper también la rama
   * del administrador dejaría la suite entera en verde.
   */
  it("el tenant_admin SÍ conserva su escritura directa tras el paso 4", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "reservations", "res-admin-1"), {
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
        createdBy: "admin-1",
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

  /**
   * `PRD-V-FLOW-005` R1 y CF4 — **a `inside` solo se llega desde `autorizada`**.
   *
   * El registro de ingreso es escritura DIRECTA del guardia, así que esta regla es la única
   * puerta: sin ella, un pase capturado en portería podría entrar estando `pendiente` y la
   * autorización sería decorativa. **Y la callable no cubre este camino**, porque el check-in no
   * pasa por ninguna.
   */
  describe("visita de portería · solo entra la autorizada", () => {
    it("una AUTORIZADA entra, como cualquier otra", async () => {
      const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
      await assertSucceeds(
        updateDoc(doc(guard.firestore(), "visitorPasses", "vis-porteria-autorizada"), {
          status: "inside",
          checkInAt: "2026-03-21T10:05:00.000Z",
        }),
      );
    });

    it("CF4 — una PENDIENTE no entra", async () => {
      const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
      await assertFails(
        updateDoc(doc(guard.firestore(), "visitorPasses", "vis-porteria-pendiente"), {
          status: "inside",
          checkInAt: "2026-03-21T10:05:00.000Z",
        }),
      );
    });

    it("y una RECHAZADA tampoco", async () => {
      const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
      await assertFails(
        updateDoc(doc(guard.firestore(), "visitorPasses", "vis-porteria-rechazada"), {
          status: "inside",
          checkInAt: "2026-03-21T10:05:00.000Z",
        }),
      );
    });

    /**
     * **La condición que hace que las reglas puedan desplegarse primero.** Los 142 pases de los
     * dos ambientes no llevan `authorizationStatus`, así que su ausencia tiene que seguir
     * significando «entra como siempre». Si esta prueba se cae, el despliegue restringe algo vivo.
     */
    it("un pase del flujo de QR, SIN el campo, entra igual que antes", async () => {
      const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
      await assertSucceeds(
        updateDoc(doc(guard.firestore(), "visitorPasses", "vis-guard-checkin"), {
          status: "inside",
          checkInAt: "2026-03-21T09:32:00.000Z",
        }),
      );
    });

    /**
     * `CF2` — **la regla y la callable son dos puertas, y hay que probar las dos.** El residente
     * lee el pase de su unidad (ya lo permitía la regla de lectura, sin cambios), pero **no puede
     * escribir el estado**: no lo creó él, y los campos de autorización son de servidor.
     */
    it("CF2 — el residente NO escribe `authorizationStatus` desde el cliente", async () => {
      const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
      await assertSucceeds(getDoc(doc(resident.firestore(), "visitorPasses", "vis-porteria-pendiente")));
      await assertFails(
        updateDoc(doc(resident.firestore(), "visitorPasses", "vis-porteria-pendiente"), {
          authorizationStatus: "autorizada",
        }),
      );
    });

    it("ni el guardia, que es quien lo creó", async () => {
      const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
      await assertFails(
        updateDoc(doc(guard.firestore(), "visitorPasses", "vis-porteria-pendiente"), {
          authorizationStatus: "autorizada",
          authorizationMedium: "llamada",
        }),
      );
    });
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
 * Feedback del borrador asistido (Paso 2.5). El dato nace en el navegador, y
 * aun así el cliente no escribe aquí: si pudiera, cualquiera podría fabricar la
 * evidencia con la que se decide si la funcionalidad sigue o se retira.
 */
describe("Firestore Rules - feedback del borrador asistido", () => {
  it("superadmin puede leerlo", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "aiFeedback", "cualquiera")));
  });

  it("bloquea la lectura a un admin de conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "aiFeedback", "cualquiera")));
  });

  it("el admin que genera el dato NO puede escribirlo: pasa por el callable", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "aiFeedback", "inventada"), {
        tenantId: "tenant-a",
        operationKey: "comunicaciones-redactar",
        aplicada: true,
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

/**
 * REVOPS-001E — propiedad comercial. La bandeja asigna dueño y referencia de
 * CRM con updateDoc desde la consola, así que el UPDATE de superadmin tiene
 * que estar concedido: antes `leads` era `write: if false` a secas y
 * markTrialAsLost llevaba desde entonces fallando en silencio.
 */
describe("Firestore Rules - propiedad comercial (REVOPS-001E)", () => {
  it("superadmin asigna el dueño de un lead", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(
      updateDoc(doc(sa.firestore(), "leads", "lead-1"), { ownerId: "rep-1", ownerAssignedAt: "2026-08-17" }),
    );
  });

  it("superadmin marca un lead como perdido (el camino de markTrialAsLost)", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(
      updateDoc(doc(sa.firestore(), "leads", "lead-1"), { status: "perdido", lostReason: "precio" }),
    );
  });

  it("un admin de conjunto NO toca leads", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(updateDoc(doc(admin.firestore(), "leads", "lead-1"), { ownerId: "rep-1" }));
  });

  it("ni los lee", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "leads", "lead-1")));
  });

  it("crear y borrar leads sigue vetado, también para superadmin (los crea el servidor)", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(setDoc(doc(sa.firestore(), "leads", "lead-nuevo"), { nombre: "Colado" }));
    await assertFails(deleteDoc(doc(sa.firestore(), "leads", "lead-1")));
  });

  it("superadmin administra el catálogo de comerciales", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(getDoc(doc(sa.firestore(), "salesReps", "rep-1")));
    await assertSucceeds(
      setDoc(doc(sa.firestore(), "salesReps", "rep-2"), {
        name: "Comercial Dos", email: "kam2@vivaru.test", country: "CO", active: true,
      }),
    );
  });

  it("el catálogo es invisible para los conjuntos: ni admin ni residente", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "salesReps", "rep-1")));
    await assertFails(getDoc(doc(resident.firestore(), "salesReps", "rep-1")));
    await assertFails(updateDoc(doc(admin.firestore(), "salesReps", "rep-1"), { active: false }));
  });

  it("superadmin estampa el vendedor al convertir un conjunto", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertSucceeds(
      updateDoc(doc(sa.firestore(), "tenants", "tenant-a"), { vendedorId: "rep-1" }),
    );
  });
});

// ── FIN-001 · el libro contable no se escribe a mano cuando viene de un pago ──

describe("FIN-001 · asientos de pago: solo el servidor", () => {
  /**
   * Un asiento con `sourceType: "billingStatement"` significa «entró dinero por
   * una cuota». Si el cliente pudiera crearlo, podría registrar el ingreso en el
   * libro **sin mover la cartera** — la incoherencia exacta que esta ficha cierra.
   * Ahora esos asientos nacen dentro de la transacción de `applyPayment`, que
   * corre con Admin SDK y no pasa por estas reglas.
   */
  it("un admin NO puede crear un asiento originado en una cuota", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-pago-a-mano"), {
        tenantId: "tenant-a",
        type: "ingreso",
        amount: 100,
        date: "2026-08-18",
        concept: "Pago inventado",
        sourceType: "billingStatement",
        sourceId: "stmt-1",
      }),
    );
  });

  it("ni el superadmin — la vía es la callable, no el rol", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "ledgerEntries", "le-pago-super"), {
        tenantId: "tenant-a",
        type: "ingreso",
        amount: 100,
        date: "2026-08-18",
        concept: "Pago inventado",
        sourceType: "billingStatement",
        sourceId: "stmt-1",
      }),
    );
  });

  // La regla veta el origen, no la colección: la consola financiera sigue
  // registrando egresos, ajustes y reversos con normalidad.
  it("los movimientos manuales del libro siguen funcionando", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-manual"), {
        tenantId: "tenant-a",
        type: "egreso",
        amount: 50,
        date: "2026-08-18",
        concept: "Compra de bombillas",
        sourceType: "manual",
      }),
    );
  });

  /**
   * `FIN-001` — la marca de idempotencia es del servidor y de nadie más.
   *
   * **Por qué importa más de lo que parece.** Si un cliente pudiera escribir en
   * `paymentOperations`, podría fabricar una marca con la clave de un pago que
   * todavía no ha ocurrido; cuando ese pago se intentara, la función vería la
   * marca, devolvería «ya aplicado» y **no aplicaría nada**. Un cobro anulado en
   * silencio, sin error y sin rastro.
   *
   * Hoy la colección se deniega **por omisión**: no tiene regla, y la lista
   * blanca del comodín solo incluye `communications`. Estas pruebas existen
   * porque esa protección es invisible — el día que alguien añada la colección a
   * esa lista, esto se pone rojo en vez de abrirse en silencio.
   */
  it("un admin NO puede fabricar una marca de idempotencia de pago", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "paymentOperations", "receipt:cualquiera"), {
        tenantId: "tenant-a",
        statementId: "stmt-1",
        amount: 100,
      }),
    );
  });

  it("ni el superadmin puede fabricarla", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "paymentOperations", "receipt:otra"), {
        tenantId: "tenant-a",
        statementId: "stmt-1",
        amount: 100,
      }),
    );
  });

  it("un admin tampoco puede leer las marcas de idempotencia", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "paymentOperations", "receipt:cualquiera")));
  });

  it("y los reversos también", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-reverso"), {
        tenantId: "tenant-a",
        type: "egreso",
        amount: -50,
        date: "2026-08-18",
        concept: "Reverso de compra",
        sourceType: "reversal",
      }),
    );
  });

  // Un asiento sin `sourceType` no se puede confundir con uno de pago, así que
  // no cae en el veto — es el caso de los movimientos antiguos.
  it("un asiento sin sourceType sigue permitido", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-sin-origen"), {
        tenantId: "tenant-a",
        type: "egreso",
        amount: 10,
        date: "2026-08-18",
        concept: "Movimiento sin origen declarado",
      }),
    );
  });
});

/**
 * El recibo lo emite el SERVIDOR, dentro de la transacción del pago (20 ago 2026).
 *
 * **Por qué la regla importa.** Si un cliente pudiera crear un `paymentVoucher`,
 * podría fabricar el recibo de un pago que nunca ocurrió — el reverso exacto del
 * hueco que esta ficha cierra, que era un pago sin recibo. Y si pudiera
 * actualizarlo, podría desanular uno anulado.
 *
 * Hasta el 20 de agosto el cliente SÍ creaba y actualizaba, porque el recibo lo
 * construía el navegador después de aplicar el pago. Al mover la emisión al
 * servidor, esa concesión dejó de hacer falta.
 */
describe("El recibo lo emite el servidor: el cliente solo lee", () => {
  it("un admin NO puede crear un recibo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "paymentVouchers", "pv-inventado"), {
        tenantId: "tenant-a",
        type: "ingreso",
        code: "REC-FALSO",
        issueDate: "2026-08-20",
        amount: 250,
        concept: "Pago que nunca ocurrió",
      }),
    );
  });

  it("ni el superadmin — la vía es la callable, no el rol", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "paymentVouchers", "pv-super"), {
        tenantId: "tenant-a",
        type: "ingreso",
        code: "REC-FALSO",
        issueDate: "2026-08-20",
        amount: 250,
        concept: "Pago que nunca ocurrió",
      }),
    );
  });

  it("un admin NO puede desanular un recibo anulado", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "paymentVouchers", "pv-anulado"), {
        tenantId: "tenant-a",
        type: "ingreso",
        code: "REC-ABC123",
        issueDate: "2026-08-20",
        amount: 250,
        concept: "Pago revertido",
        payerUnitId: "unit-1",
        anulado: true,
      });
    });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "paymentVouchers", "pv-anulado"), { anulado: false }),
    );
  });

  it("pero el admin SÍ lo lee: quitarle la escritura no le quita la vista", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "paymentVouchers", "pv-legible"), {
        tenantId: "tenant-a",
        type: "ingreso",
        code: "REC-XYZ789",
        issueDate: "2026-08-20",
        amount: 250,
        concept: "Pago de alícuota",
        payerUnitId: "unit-1",
      });
    });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "paymentVouchers", "pv-legible")));
  });
});

describe("FEAT-003 · proveedores: solo administración, y sin borrado", () => {
  /**
   * `vendors` guarda datos bancarios de terceros (R7 de PRD-V-FEAT-003). La
   * regla no puede filtrar campos, así que la LECTURA entera queda restringida
   * a administración — un residente no ve ni el nombre, y mucho menos la
   * cuenta. Y no hay borrado desde el cliente (R5): un proveedor con historia
   * se desactiva, no se borra.
   */
  it("un admin crea y edita proveedores de su conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "vendors", "v-1"), {
        tenantId: "tenant-a",
        type: "proveedor",
        legalName: "Electricidad Andina SAS",
        taxId: "900123456",
        status: "active",
      }),
    );
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "vendors", "v-1"), {
        tenantId: "tenant-a",
        type: "proveedor",
        legalName: "Electricidad Andina S.A.S.",
        taxId: "900123456",
        bankName: "Banco X",
        accountNumber: "123-456",
        status: "active",
      }),
    );
  });

  it("un residente NO lee el registro — los datos bancarios de un tercero no son suyos", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "vendors", "v-1")));
  });

  it("un residente NO crea proveedores", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(resident.firestore(), "vendors", "v-res"), {
        tenantId: "tenant-a",
        type: "proveedor",
        legalName: "Intento",
        status: "active",
      }),
    );
  });

  it("un admin NO borra un proveedor — se desactiva (R5)", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "vendors", "v-1")));
  });

  it("un admin de OTRO conjunto no lee ni escribe estos proveedores", async () => {
    const foreign = testEnv.authenticatedContext("admin-b", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(foreign.firestore(), "vendors", "v-1")));
    await assertFails(
      setDoc(doc(foreign.firestore(), "vendors", "v-ajeno"), {
        tenantId: "tenant-a",
        type: "proveedor",
        legalName: "Cruce de conjuntos",
        status: "active",
      }),
    );
  });
});

describe("PLAT-003 · plan de cuentas: el id derivado es la unicidad", () => {
  /**
   * El id del documento es `{tenantId}_{code}` (PRD §11.1). Esa derivación es
   * lo ÚNICO que hace que dos pestañas abiertas no puedan crear dos cuentas con
   * el mismo código: la unicidad la impone la base, no una comprobación previa
   * que las dos ganan a la vez.
   *
   * **Los códigos de aquí van del `.50` en adelante desde el 23 de agosto de
   * 2026**, y no es cosmético: por debajo está el rango que se reserva la
   * semilla, así que un `1.9` lo rechazaría el RANGO y estas pruebas pasarían
   * **por el motivo equivocado** — creyendo que prueban la unicidad del id
   * cuando probarían otra cosa. Un verde por la razón que no es vale menos que
   * un rojo.
   *
   * Por eso la regla exige que el id coincida con el código. Sin esa cláusula la
   * derivación es decorativa: bastaría escribir `code: "1.1"` bajo cualquier
   * otro id y habría dos cuentas 1.1 en el mismo conjunto. **Es un fallo que no
   * da síntoma hasta que alguien suma un informe por código.**
   */
  it("un admin crea una cuenta cuyo id coincide con su código", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.60"), {
        tenantId: "tenant-a",
        code: "1.60",
        name: "Eventos y salón comunal",
        type: "ingreso",
        parentCode: "1",
        status: "active",
      }),
    );
  });

  it("el mismo código bajo OTRO id queda rechazado — si no, la unicidad no existe", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "otro-id-cualquiera"), {
        tenantId: "tenant-a",
        code: "1.60",
        name: "Eventos, otra vez",
        type: "ingreso",
        status: "active",
      }),
    );
  });

  it("un id de otro conjunto con datos de este también se rechaza", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-b_1.60"), {
        tenantId: "tenant-a",
        code: "1.60",
        name: "Colada de conjunto",
        type: "ingreso",
        status: "active",
      }),
    );
  });

  it("renombrar y desactivar SÍ se puede: es lo que R3 permite", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.60"), {
        tenantId: "tenant-a",
        code: "1.60",
        name: "Salón comunal",
        type: "ingreso",
        parentCode: "1",
        status: "inactive",
      }),
    );
  });

  // R4. Cambiar el código a otro valor dentro del MISMO documento rompería la
  // derivación: el id seguiría diciendo 1.9 y el dato diría otra cosa.
  it("mover el código dentro del mismo documento queda bloqueado (R4)", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.60"), { code: "1.62" }),
    );
  });

  it("una cuenta creada a mano se puede borrar; una de sistema NO (R3)", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chartOfAccounts", "tenant-a_1.1"), {
        tenantId: "tenant-a",
        code: "1.1",
        name: "Cuotas de administración",
        type: "ingreso",
        parentCode: "1",
        systemKey: "alicuota",
        status: "active",
      });
    });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.1")));
    await assertSucceeds(deleteDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.60")));
  });

  /**
   * **El hueco que dejó pasar un fallo en staging el 23 de agosto de 2026.**
   *
   * Todas las pruebas de arriba escriben con `setDoc`. El formulario NO: crea en
   * una TRANSACCIÓN que lee primero, porque el id es derivado del código y un
   * `setDoc` sobre un código existente no falla —sobrescribe—, lo que le
   * cambiaría el nombre a una cuenta de sistema y podría dejarla sin
   * `systemKey`.
   *
   * Y leer un documento que NO existe es otra cosa que leer uno que sí: en las
   * reglas, `resource` es `null`, así que `resource.data.tenantId` hace fallar
   * la evaluación entera y el `get` se deniega. El banco estaba verde mientras
   * la pantalla respondía «No tienes permiso para realizar esta acción» al
   * crear la primera cuenta.
   *
   * **La lección no es que faltara un caso: es que el banco probaba un camino
   * que el producto no usa.**
   */
  it("un admin PUEDE leer una cuenta que todavía no existe — sin esto la transacción no arranca", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      getDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_9.9")),
    );
  });

  it("crear por TRANSACCIÓN —el camino real del formulario— funciona", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    const db = admin.firestore();
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const ref = doc(db, "chartOfAccounts", "tenant-a_1.61");
        const actual = await tx.get(ref);
        if (actual.exists()) throw new Error("ya existe");
        tx.set(ref, {
          tenantId: "tenant-a",
          code: "1.61",
          name: "Arrendamientos",
          type: "ingreso",
          parentCode: "1",
          status: "active",
        });
      }),
    );
  });

  /**
   * El límite de la rama nueva, dicho con precisión porque es una concesión
   * real: `resource == null` **sí** deja saber que un documento no está, en
   * cualquier conjunto. Lo que no deja es leer uno que sí está. Esa es la misma
   * frontera que ya aceptan `financialCounters` y `survey_responses`, y lo que
   * se revela —la ausencia de un id que ya se conocía— no es dato del vecino.
   */
  it("la rama nueva no abre la puerta: una cuenta que EXISTE en otro conjunto sigue vetada", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chartOfAccounts", "tenant-b_1.1"), {
        tenantId: "tenant-b",
        code: "1.1",
        name: "Cuotas del vecino",
        type: "ingreso",
        parentCode: "1",
        systemKey: "alicuota",
        status: "active",
      });
    });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-b_1.1")));
  });

  /**
   * **El rango reservado.** Va en la regla y no solo en el formulario porque la
   * siembra escribe con el SDK de admin —que no pasa por las reglas—, así que
   * esta cláusula solo restringe lo que crea un administrador.
   *
   * Cierra la colisión de significado: si un conjunto ya usó la `1.9` y mañana
   * la semilla reclama esa `1.9`, el sembrador **la salta en silencio** y ese
   * conjunto se queda con un código que significa otra cosa que en los demás.
   */
  it("un admin NO puede crear una cuenta en el rango de la semilla", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.49"), {
        tenantId: "tenant-a",
        code: "1.49",
        name: "Justo debajo del limite",
        type: "ingreso",
        parentCode: "1",
        status: "active",
      }),
    );
  });

  it("y SÍ puede desde la 50 en adelante", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.50"), {
        tenantId: "tenant-a",
        code: "1.50",
        name: "Cuota de piscina",
        type: "ingreso",
        parentCode: "1",
        status: "active",
      }),
    );
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_2.999"), {
        tenantId: "tenant-a",
        code: "2.999",
        name: "El tope de arriba",
        type: "egreso",
        parentCode: "2",
        status: "active",
      }),
    );
  });

  // El primer nivel es la estructura del libro. Una tercera raíz no sería ni
  // ingreso ni egreso, y ningún informe sabría qué hacer con ella.
  it("un admin no puede crear una cuenta de primer nivel", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_3"), {
        tenantId: "tenant-a",
        code: "3",
        name: "Tercera raiz",
        type: "ingreso",
        status: "active",
      }),
    );
  });

  /**
   * **Lo que el rango NO puede romper.** Renombrar y desactivar una cuenta de
   * sistema es `update`, no `create`, y R3 lo permite —es la mitad de CA6—. Si
   * la cláusula del rango se hubiera puesto en `allow create, update`, el
   * administrador se habría quedado sin poder renombrar ninguna de las veinte
   * cuentas de su plan, y el síntoma sería un «no tienes permiso» al cambiar un
   * nombre.
   */
  it("renombrar una cuenta de sistema sigue funcionando pese al rango (R3, CA6)", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "chartOfAccounts", "tenant-a_1.4"), {
        tenantId: "tenant-a",
        code: "1.4",
        name: "Intereses de mora",
        type: "ingreso",
        parentCode: "1",
        systemKey: "interes_mora",
        status: "active",
      });
    });
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "chartOfAccounts", "tenant-a_1.4"), {
        name: "Intereses moratorios",
      }),
    );
  });

  it("un residente lee el plan pero no lo toca (CF7)", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "chartOfAccounts", "tenant-a_1.1")));
    await assertFails(
      setDoc(doc(resident.firestore(), "chartOfAccounts", "tenant-a_1.5"), {
        tenantId: "tenant-a",
        code: "1.5",
        name: "Intento",
        type: "ingreso",
        status: "active",
      }),
    );
  });

  it("un admin de otro conjunto no lee ni escribe este plan", async () => {
    const foreign = testEnv.authenticatedContext("admin-b", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(foreign.firestore(), "chartOfAccounts", "tenant-a_1.1")));
    await assertFails(
      setDoc(doc(foreign.firestore(), "chartOfAccounts", "tenant-a_1.6"), {
        tenantId: "tenant-a",
        code: "1.6",
        name: "Colada",
        type: "ingreso",
        status: "active",
      }),
    );
  });
});

describe("FLOW-002 · anticipos: el cliente lee, el servidor escribe", () => {
  /**
   * Un anticipo es dinero. Toda su creación pasa por callable dentro de una
   * transacción, así que desde el navegador **no se escribe ni una**: ni el
   * administrador, ni el superadmin. Es la misma decisión que `FIN-001` tomó
   * para los asientos de pago, por la misma razón.
   */
  it("un admin NO puede crear un anticipo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "advances", "adv-a-mano"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        amount: 999000,
        remaining: 999000,
        origin: "manual",
        status: "open",
      }),
    );
  });

  it("ni el superadmin — la vía es la callable, no el rol", async () => {
    const sa = testEnv.authenticatedContext("super-1", { role: "superadmin" });
    await assertFails(
      setDoc(doc(sa.firestore(), "advances", "adv-super"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        amount: 999000,
        remaining: 999000,
        origin: "manual",
        status: "open",
      }),
    );
  });

  it("tampoco se puede retocar el remanente de uno que ya existe", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(updateDoc(doc(admin.firestore(), "advances", "adv-1"), { remaining: 999000 }));
  });

  it("ni borrarlo: un anticipo se anula con motivo (R9), no se borra", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "advances", "adv-1")));
  });

  it("el administrador sí lo lee", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "advances", "adv-1")));
  });

  /**
   * **El consejo NO lo lee, y el nombre que tenía esta prueba era el defecto.**
   *
   * Se llamaba «es el total de anticipos del conjunto» mientras leía **un
   * anticipo suelto**, con su `unitId` y su `unitLabel`. Eso no es un total: es
   * detalle financiero POR UNIDAD —quién tiene saldo a favor y cuánto—, y el
   * resto del modelo se lo niega al consejo, empezando por `billingStatements`.
   *
   * La PRD §3 le concede un agregado, y **una regla de Firestore no sabe
   * agregar**: o concede el documento entero o no concede nada. Se cierra hasta
   * que `PRD-V-PLAT-004` decida qué pantallas ve el consejo y con qué dato.
   * Cerrarlo hoy no rompe nada: `canAccessPath` lo deja solo en
   * `/admin/documents`. Decisión de David, 24 de agosto de 2026.
   */
  it("el consejo NO lo lee: sería detalle por unidad, no el total que le da la PRD", async () => {
    const com = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(com.firestore(), "advances", "adv-1")));
  });

  it("ni el cruce, que lleva el `unitId` copiado", async () => {
    const com = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(com.firestore(), "advanceApplications", "advapp-1")));
  });

  it("el residente lee el de SU unidad", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(res.firestore(), "advances", "adv-1")));
  });

  // CF7. Es la fila de la tabla de roles que más importa: el saldo a favor de
  // una unidad dice cuánto dinero tiene guardado un vecino.
  it("un residente NO ve el anticipo de otra unidad", async () => {
    const res = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(res.firestore(), "advances", "adv-1")));
  });

  // La lectura no usa `sameTenant` justamente por esto: la portería es miembro
  // del conjunto y no tiene nada que hacer aquí.
  it("la portería no ve nada", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "advances", "adv-1")));
  });

  it("un residente de otro conjunto tampoco", async () => {
    const otro = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(otro.firestore(), "advances", "adv-1")));
  });

  // El cruce lleva `unitId` copiado del anticipo para que esta regla se pueda
  // escribir. Sin ese campo habría que cerrarle la colección entera al residente.
  it("el cruce lo lee el residente de su unidad, y no el de otra", async () => {
    const suyo = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(suyo.firestore(), "advanceApplications", "advapp-1")));
    const ajeno = testEnv.authenticatedContext("resident-2", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(ajeno.firestore(), "advanceApplications", "advapp-1")));
  });

  /**
   * **La CONSULTA, que es lo que hace la pantalla.** Las pruebas de arriba piden
   * documento a documento, y el panel de anticipos no hace eso: lanza una
   * consulta. Firestore la evalúa contra la regla **sin ejecutarla**, así que una
   * consulta puede fallar entera aunque cada documento por separado se lea bien.
   * Es el mismo agujero que dejó seis pruebas de reglas en verde con la pantalla
   * rota, porque escribían con `setDoc` y el producto usaba una transacción.
   */
  it("el administrador consulta los anticipos de su conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(query(collection(admin.firestore(), "advances"), where("tenantId", "==", "tenant-a"))),
    );
    await assertSucceeds(
      getDocs(query(collection(admin.firestore(), "advanceApplications"), where("tenantId", "==", "tenant-a"))),
    );
  });

  /**
   * CF10 y CF7 en forma de consulta. El residente **tiene que** filtrar por su
   * unidad: sin ese `where`, la consulta se rechaza entera aunque el resultado
   * fuese a ser el mismo, y el portal se quedaría sin saldo a favor con un
   * `permission-denied` que parece un fallo de sesión.
   */
  it("el residente consulta CON el filtro de su unidad, y sin él se le rechaza entera", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(
        query(
          collection(res.firestore(), "advances"),
          where("tenantId", "==", "tenant-a"),
          where("unitId", "==", "unit-t2-503"),
        ),
      ),
    );
    await assertFails(
      getDocs(query(collection(res.firestore(), "advances"), where("tenantId", "==", "tenant-a"))),
    );
  });

  // Y no le vale filtrar por la unidad de OTRO, que es el intento evidente.
  it("ni filtrando por la unidad de un vecino", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      getDocs(
        query(
          collection(res.firestore(), "advances"),
          where("tenantId", "==", "tenant-a"),
          where("unitId", "==", "unit-t1-101"),
        ),
      ),
    );
  });

  it("nadie crea un cruce desde el cliente", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "advanceApplications", "advapp-a-mano"), {
        tenantId: "tenant-a",
        advanceId: "adv-1",
        statementId: "bill-1",
        unitId: "unit-t2-503",
        amount: 60000,
      }),
    );
  });
});

describe("FLOW-002 · `advanceAppliedAmount` es del servidor, dentro de un documento que no lo es", () => {
  /**
   * **Esta es la regla que sostiene R4**, y es rara a propósito: no protege una
   * colección, protege **un campo** dentro de un documento que el cliente sigue
   * editando con normalidad.
   *
   * `actualizarBillingStatement` hace un `updateDoc` directo desde el navegador
   * con `paymentAmount` y `balance`. Si lo cruzado con anticipo viviera en
   * `paymentAmount`, una edición a mano lo borraría o lo duplicaría **sin que
   * ningún `advanceApplication` se enterase**. Por eso vive aparte, y por eso
   * el campo se veta aquí.
   */
  it("el administrador sigue editando el cargo con normalidad", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-1"), { paymentAmount: 50000, balance: 70000 }),
    );
  });

  it("y también uno que YA lleva anticipo, mientras no toque ese campo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-con-anticipo"), { paymentAmount: 10000 }),
    );
  });

  // CF11.
  it("pero NO puede cambiar `advanceAppliedAmount`", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-con-anticipo"), { advanceAppliedAmount: 0 }),
    );
  });

  it("ni subirlo, que es la otra mitad del mismo agujero", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-con-anticipo"), { advanceAppliedAmount: 999000 }),
    );
  });

  it("ni estrenarlo en un cargo que no lo tenía", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-1"), { advanceAppliedAmount: 60000 }),
    );
  });

  it("ni crear un cargo que nazca con anticipo aplicado", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "billingStatements", "bill-nace-con-anticipo"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        period: "2026-05",
        amount: 140000,
        advanceAppliedAmount: 140000,
        balance: 0,
        status: "paid",
      }),
    );
  });

  // Crear con el campo en cero (o ausente) tiene que seguir funcionando, o el
  // alta normal de un cargo quedaría denegada por un campo que no usa.
  it("crear un cargo normal sigue funcionando", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "billingStatements", "bill-normal"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        period: "2026-05",
        amount: 140000,
        balance: 140000,
        status: "pending",
      }),
    );
  });
});

describe("FLOW-002 · el asiento del anticipo tampoco lo escribe el cliente", () => {
  /**
   * Va en el mismo veto que `billingStatement` y no solo en la colección
   * `advances`, porque **son dos escrituras distintas**: vetar una y dejar la
   * otra abierta permitiría inflar el ingreso del conjunto con un anticipo que
   * nadie pagó, y el libro cuadraría con un dinero que no existe.
   */
  it("un admin NO puede crear el asiento de entrada de un anticipo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-anticipo-a-mano"), {
        tenantId: "tenant-a",
        type: "ingreso",
        amount: 60000,
        date: "2026-04-01",
        concept: "Anticipo inventado",
        category: "anticipo",
        sourceType: "advance",
      }),
    );
  });

  // La regla veta el ORIGEN, no la categoría: si vetara `category: "anticipo"`
  // seguiría dejando pasar el mismo asiento sin categoría.
  it("y el veto es por origen, no por categoría", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-anticipo-sin-categoria"), {
        tenantId: "tenant-a",
        type: "ingreso",
        amount: 60000,
        date: "2026-04-01",
        concept: "Anticipo inventado",
        sourceType: "advance",
      }),
    );
  });
});

describe("FLOW-002 CA11 · las cuentas se abren al residente; el saldo no", () => {
  /**
   * El residente tiene que poder decir a qué cuenta pagó, así que tiene que
   * poder leer las cuentas. Hasta el 24 de agosto de 2026 esto era
   * solo-administrador.
   *
   * **Y por eso el saldo inicial ya no vive ahí.** Las reglas conceden el
   * documento entero; no hay forma de enseñar el número de cuenta y esconder el
   * saldo dentro del mismo documento. El número de cuenta sí puede verlo: es a
   * donde transfiere.
   */
  it("el residente lee una cuenta ACTIVA de su conjunto", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(res.firestore(), "bankAccounts", "bank-a-activa")));
  });

  // Una cuenta dada de baja no recibe dinero nuevo, así que nadie fuera de la
  // administración tiene por qué verla.
  it("no lee una dada de baja", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(res.firestore(), "bankAccounts", "bank-a-baja")));
  });

  it("el administrador las lee todas, activa y de baja", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "bankAccounts", "bank-a-activa")));
    await assertSucceeds(getDoc(doc(admin.firestore(), "bankAccounts", "bank-a-baja")));
  });

  it("un residente de otro conjunto no lee ninguna", async () => {
    const otro = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(otro.firestore(), "bankAccounts", "bank-a-activa")));
  });

  /**
   * **Esta es la prueba de la que depende toda la decisión.** Si el saldo se
   * pudiera leer desde el portal del residente, abrir `bankAccounts` habría
   * sido un error y no una migración.
   */
  it("el residente NO lee el saldo inicial", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(res.firestore(), "bankAccountBalances", "bank-a-activa")));
  });

  it("ni el consejo, ni la portería", async () => {
    const com = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(com.firestore(), "bankAccountBalances", "bank-a-activa")));
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "bankAccountBalances", "bank-a-activa")));
  });

  it("el administrador sí lo lee y lo escribe", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "bankAccountBalances", "bank-a-activa")));
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "bankAccountBalances", "bank-a-activa"), {
        tenantId: "tenant-a",
        openingBalance: 90000,
      }),
    );
  });

  /**
   * **La consulta, no el documento.** El producto no pide las cuentas de una en
   * una: `watchActiveBankAccounts` lanza una consulta, y Firestore la evalúa
   * contra la regla **sin ejecutarla**. Una consulta sin `where("active")` se
   * rechaza entera aunque todas las cuentas estuvieran activas — así que si esto
   * no se prueba con la forma exacta que usa la pantalla, la pantalla sale rota
   * con las pruebas en verde.
   */
  it("la consulta del residente pasa CON el filtro de activas y falla sin él", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    const cuentas = collection(res.firestore(), "bankAccounts");
    await assertSucceeds(
      getDocs(query(cuentas, where("tenantId", "==", "tenant-a"), where("active", "==", true))),
    );
    await assertFails(getDocs(query(cuentas, where("tenantId", "==", "tenant-a"))));
  });

  /**
   * **La portería NO entra, y esta prueba es la que lo sostiene.**
   *
   * Hasta el 24 de agosto de 2026 la rama decía `tenantMember`, que incluye a
   * cualquiera con documento en `tenantUsers` — la portería entre ellos. La PRD
   * (§3) le da al `security_guard` «Nada / no puede Acceder», y el comentario de
   * la regla de `advances` evita `sameTenant` diciendo exactamente eso: era una
   * incoherencia dentro del mismo cambio.
   *
   * El punto ciego estaba aquí: existía «ni el consejo, ni la portería», pero
   * **solo para `bankAccountBalances`**. Para la cuenta en sí nadie preguntó.
   */
  it("la portería NO lee una cuenta activa", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "bankAccounts", "bank-a-activa")));
  });

  /**
   * Y tampoco por consulta. Va aparte del documento a propósito: Firestore
   * evalúa la consulta contra la regla **sin ejecutarla**, así que una y otra
   * son preguntas distintas — la lección del 24 de agosto, aplicada al revés.
   */
  it("ni las consulta en bloque, ni con el filtro de activas", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    const cuentas = collection(guard.firestore(), "bankAccounts");
    await assertFails(
      getDocs(query(cuentas, where("tenantId", "==", "tenant-a"), where("active", "==", true))),
    );
    await assertFails(getDocs(query(cuentas, where("tenantId", "==", "tenant-a"))));
  });

  // El consejo tampoco: la PRD no le da cuentas bancarias, y `tenantMember` se
  // las daba de propina.
  it("el consejo tampoco lee las cuentas", async () => {
    const com = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(com.firestore(), "bankAccounts", "bank-a-activa")));
  });

  it("la del administrador pasa sin filtro: las ve todas", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(query(collection(admin.firestore(), "bankAccounts"), where("tenantId", "==", "tenant-a"))),
    );
  });
});

describe("FLOW-002 · el asiento de origen pago se protege en LAS DOS direcciones", () => {
  /**
   * Salió del triaje del 24 de agosto de 2026. El veto miraba solo el documento
   * entrante, y eso dejaba un hueco y un bloqueo, los dos encontrados probando
   * contra el emulador y ninguno visible leyendo la regla.
   */
  async function sembrarAsiento(id: string, sourceType: string) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "ledgerEntries", id), {
        tenantId: "tenant-a", type: "ingreso", date: "2026-08-24", amount: 60000,
        concept: "Anticipo de 101", category: "anticipo", sourceType,
        sourceId: "s-1", operationKey: "op-1", reconciled: false,
      });
    });
  }

  /**
   * **El hueco.** Un `setDoc` sin `merge` omitiendo `sourceType` pasaba el veto,
   * porque el documento entrante no lo traía. Se podía pisar el importe del
   * asiento que sostiene un saldo a favor y borrar su origen.
   */
  it("no se puede SOBRESCRIBIR entero el asiento de un anticipo", async () => {
    await sembrarAsiento("le-adv-sobrescribir", "advance");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-adv-sobrescribir"), {
        tenantId: "tenant-a", type: "ingreso", date: "2026-08-24", amount: 1, concept: "pisado",
      }),
    );
  });

  it("ni el de un cobro", async () => {
    await sembrarAsiento("le-cobro-sobrescribir", "billingStatement");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "ledgerEntries", "le-cobro-sobrescribir"), {
        tenantId: "tenant-a", type: "ingreso", date: "2026-08-24", amount: 1, concept: "pisado",
      }),
    );
  });

  /**
   * **ESTAS DOS AFIRMABAN LO CONTRARIO HASTA `FLOW-004`, y el cambio es
   * deliberado — no es que la regla se haya roto.**
   *
   * El 24 de agosto de 2026 se abrió la conciliación al cliente porque la regla
   * vieja la tenía MUERTA: en un `update` con merge Firestore evalúa el
   * documento RESULTANTE, que conserva el `sourceType`, así que marcar
   * conciliado un asiento de cobro se denegaba — y desde `FIN-001` todos nacen
   * así. Aquello era correcto **para el producto de entonces**, en el que la
   * pantalla escribía el enlace.
   *
   * **`FLOW-004` R8 se lo quita, porque ese permiso es exactamente el que
   * escribió el emparejamiento falso que hay en producción**: una salida de
   * banco de −300.000 casada contra una entrada de +40.000. La comprobación que
   * lo habría impedido es aritmética entre dos documentos, y una regla no puede
   * hacerla. Ahora concilia `reconcileCase`, con Admin SDK.
   *
   * Se conserva la historia escrita porque el mismo campo ha cambiado de
   * contrato dos veces en cinco días, y sin esto la próxima lectura parecería un
   * error.
   */
  it("YA NO se puede marcar conciliado un asiento de cobro desde el cliente (R8)", async () => {
    await sembrarAsiento("le-cobro-conciliar", "billingStatement");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "ledgerEntries", "le-cobro-conciliar"), {
        reconciled: true, bankStatementLineId: "bl-1", reconciledAt: "2026-08-24",
      }),
    );
  });

  it("ni deshacerlo — el de un anticipo tampoco", async () => {
    await sembrarAsiento("le-adv-conciliar", "advance");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "ledgerEntries", "le-adv-conciliar"), {
        reconciled: false, bankStatementLineId: null, reconciledAt: null,
      }),
    );
  });

  /** Pero solo la conciliación: el importe sigue sin poder tocarse. */
  it("lo que NO se puede es cambiarle el importe de paso", async () => {
    await sembrarAsiento("le-adv-importe", "advance");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "ledgerEntries", "le-adv-importe"), {
        reconciled: true, amount: 999999,
      }),
    );
  });

  /** Ni borrarlo: se anula con su reverso, que lo escribe el servidor. */
  it("no se puede BORRAR el asiento de un anticipo", async () => {
    await sembrarAsiento("le-adv-borrar", "advance");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "ledgerEntries", "le-adv-borrar")));
  });

  /** Y la contraparte: un movimiento manual se sigue borrando y editando. */
  it("un movimiento manual sigue siendo editable y borrable", async () => {
    await sembrarAsiento("le-manual-triaje", "");
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "ledgerEntries", "le-manual-triaje"), { amount: 12345 }),
    );
    await assertSucceeds(deleteDoc(doc(admin.firestore(), "ledgerEntries", "le-manual-triaje")));
  });
});

describe("documentos · el residente no alcanza los archivos financieros", () => {
  /**
   * `documents` es UNA coleccion con contenido mezclado. Hasta el 24 de agosto
   * de 2026 la regla era `sameTenant`, o sea todo el mundo del conjunto: el
   * residente y la PORTERIA. Y el documento guarda un `fileUrl` con token de
   * descarga, que **se salta las reglas de Storage** — asi que tener cerrada la
   * carpeta financiera alli no protegia nada.
   */
  it("el residente lee lo compartible", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(res.firestore(), "documents", "doc-a-reglamento")));
    await assertSucceeds(getDoc(doc(res.firestore(), "documents", "doc-a-acta")));
  });

  it("y NO lee el historico de cartera ni el reporte de comite", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(res.firestore(), "documents", "doc-a-cartera")));
    await assertFails(getDoc(doc(res.firestore(), "documents", "doc-a-reporte")));
  });

  // Lista BLANCA: un documento sin categoria no se sabe que es, asi que no pasa.
  it("un documento sin categoria tampoco", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(res.firestore(), "documents", "doc-a-sin-categoria")));
  });

  /**
   * **La prueba que decide si la pantalla carga.** Firestore evalua la consulta
   * contra la regla SIN ejecutarla: pedir la coleccion sin nombrar las
   * categorias se rechaza entera aunque todos los documentos fueran
   * compartibles. Es la trampa de `bankAccounts` y su `active == true`.
   */
  it("la consulta del residente SIN filtrar por categoria se rechaza entera", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      getDocs(query(collection(res.firestore(), "documents"), where("tenantId", "==", "tenant-a"))),
    );
  });

  it("y CON el filtro `in` sobre las compartibles, funciona", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(
        query(
          collection(res.firestore(), "documents"),
          where("tenantId", "==", "tenant-a"),
          where("category", "in", ["asamblea", "comunicado", "acuerdo", "reglamento", "plano", "memoria", "otro"]),
        ),
      ),
    );
  });

  /**
   * **Esta no se podia razonar, habia que medirla.** El flujo del reglamento
   * (`features/regulations/services.ts`) consulta con `category == "reglamento"`,
   * una IGUALDAD contra una regla escrita con `in`. Si Firestore no dedujera que
   * la igualdad prueba la pertenencia, ese flujo se romperia al desplegar.
   */
  it("y la consulta del reglamento, que usa `==` contra una regla con `in`, tambien", async () => {
    const res = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(
      getDocs(
        query(
          collection(res.firestore(), "documents"),
          where("tenantId", "==", "tenant-a"),
          where("category", "==", "reglamento"),
        ),
      ),
    );
  });

  /**
   * El consejo conserva TODO, y no es una concesion nueva: `canAccessPath` le
   * deja solo en `/admin/documents`, esa pantalla consulta sin filtrar, y los
   * reportes de comite son suyos. Cerrarle por categoria lo dejaria sin su
   * unica pantalla.
   */
  it("el consejo lee todo, incluido lo financiero", async () => {
    const com = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(com.firestore(), "documents", "doc-a-cartera")));
    await assertSucceeds(getDoc(doc(com.firestore(), "documents", "doc-a-reglamento")));
    await assertSucceeds(
      getDocs(query(collection(com.firestore(), "documents"), where("tenantId", "==", "tenant-a"))),
    );
  });

  it("el administrador tambien", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "documents", "doc-a-cartera")));
  });

  // Ninguna pantalla de /guard lee esta coleccion, y la regla ya no se la da.
  it("la porteria no lee NINGUNO, ni el compartible", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "documents", "doc-a-reglamento")));
    await assertFails(getDoc(doc(guard.firestore(), "documents", "doc-a-cartera")));
  });

  it("un residente de otro conjunto no lee ninguno", async () => {
    const otro = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(otro.firestore(), "documents", "doc-a-reglamento")));
  });
});

/**
 * **`PLAT-002` — el conjunto activo lo elige el cliente, y elegir mal no abre
 * nada.**
 *
 * Estas dos son las que prueban que el diseño de la administradora es seguro
 * (§10). El selector no lleva callable detrás: cambiar de conjunto es estado de
 * sesión, y `users/{uid}.lastActiveTenantId` es **comodidad, no autoridad**.
 * Que se pueda escribir a mano es correcto **siempre que escribirlo no conceda
 * nada**, y eso es exactamente lo que se mide aquí.
 */

/**
 * **`PRD-V-FEAT-007` · el tema es del dueño y de nadie más.**
 *
 * Tres cosas, y las tres son criterios de la ficha:
 *
 *  · `CA17` — la regla nueva valida el enum **y no rompe** el camino que ya
 *    existía. Las dos mitades, porque una restricción que solo se prueba por su
 *    lado positivo puede estar denegando ediciones de perfil corrientes.
 *  · `CA4` — el `tenant_admin` LEE el documento de un usuario de su conjunto
 *    (eso ya era así y no lo abre esta ficha), pero **no puede escribirle** el
 *    tema. La preferencia es de presentación y es de su dueño.
 *  · `CA8` — con el conjunto **suspendido** el tema se sigue pudiendo cambiar.
 *    Es excepción declarada a `tenantOperable`, con el precedente escrito de
 *    `pushTokens`: a quien tiene el conjunto suspendido solo le queda mirar, y
 *    no vamos a impedirle además elegir cómo lo mira.
 */
describe("FEAT-007 · el tema del usuario", () => {
  const dueno = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });

  it("CA17 · el dueño guarda un tema válido", async () => {
    await assertSucceeds(updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: "oscuro" }));
    await assertSucceeds(updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: "claro" }));
  });

  it("CA17 · DEBE FALLAR: un valor fuera del enum se rechaza", async () => {
    await assertFails(updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: "banana" }));
    await assertFails(updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: "sistema" }));
    await assertFails(updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: 7 }));
  });

  it("CA17 · la OTRA mitad: una edición de perfil corriente sigue pasando", async () => {
    // Si la regla nueva estuviera mal escrita, esto se caería y el producto se
    // quedaría sin poder cambiar el nombre visible.
    await assertSucceeds(
      updateDoc(doc(dueno().firestore(), "users", "admin-1"), { fullName: "Admin Uno Editado" }),
    );
  });

  it("CA4 · DEBE FALLAR: el tenant_admin no escribe el tema de un residente suyo", async () => {
    await assertFails(
      updateDoc(doc(dueno().firestore(), "users", "resident-3"), { tema: "oscuro" }),
    );
  });

  it("CA4 · ni el propio residente puede escribírselo a otro", async () => {
    const residente = testEnv.authenticatedContext("resident-3", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(residente.firestore(), "users", "admin-1"), { tema: "oscuro" }),
    );
  });

  it("CA8 · con el conjunto SUSPENDIDO el tema se sigue cambiando", async () => {
    // Excepción declarada a `tenantOperable`. La regla de `users/{uid}` no lo
    // invoca, y esta prueba es lo que impide que alguien lo «arregle» añadiéndolo.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "admin-susp"), {
        uid: "admin-susp",
        tenantId: "tenant-susp",
        role: "tenant_admin",
        email: "admin-susp@hogaru.test",
        status: "active",
      });
    });
    const suspendido = testEnv.authenticatedContext("admin-susp", { role: "tenant_admin", tenantId: "tenant-susp" });
    await assertSucceeds(
      updateDoc(doc(suspendido.firestore(), "users", "admin-susp"), { tema: "oscuro" }),
    );
  });

  it("no se puede colar un cambio de rol junto al tema", async () => {
    await assertFails(
      updateDoc(doc(dueno().firestore(), "users", "admin-1"), { tema: "oscuro", role: "superadmin" }),
    );
  });
});

describe("PLAT-002 · el último conjunto usado no es una autorización", () => {
  const adminA = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });

  it("un administrador puede anotarse su último conjunto usado", async () => {
    await assertSucceeds(
      updateDoc(doc(adminA().firestore(), "users", "admin-1"), { lastActiveTenantId: "tenant-a" }),
    );
  });

  /**
   * **CF3.** Se escribe a mano el conjunto ajeno —la regla lo permite, porque
   * el campo no gobierna nada— y a continuación se intenta leer ese conjunto.
   * La lectura tiene que seguir denegada: la autoridad es el documento de
   * membresía, que `admin-1` no tiene en `tenant-b`.
   */
  it("apuntarlo a un conjunto ajeno NO da acceso a ese conjunto", async () => {
    const db = adminA().firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "admin-1"), { lastActiveTenantId: "tenant-b" }));
    await assertFails(getDoc(doc(db, "tenants", "tenant-b")));
  });

  /** El campo es nuevo y no puede servir de puerta trasera para el rol. */
  it("no se puede colar un cambio de rol junto al último conjunto usado", async () => {
    await assertFails(
      updateDoc(doc(adminA().firestore(), "users", "admin-1"), {
        lastActiveTenantId: "tenant-a",
        role: "superadmin",
      }),
    );
  });

  /**
   * **CF1, en su forma más simple.** El selector lista las membresías propias
   * consultando por `uid`; pedir las de otra persona tiene que fallar, o el
   * selector sería un directorio de quién administra qué.
   */
  it("solo se listan las membresías propias", async () => {
    const db = adminA().firestore();
    await assertSucceeds(
      getDocs(query(collection(db, "tenantUsers"), where("uid", "==", "admin-1"))),
    );
    await assertFails(
      getDocs(query(collection(db, "tenantUsers"), where("uid", "==", "resident-3"))),
    );
  });
});

/**
 * **`PLAT-002` §7.1 — el registro de administradoras.**
 *
 * Dos cosas que probar, y la segunda es la que suele olvidarse: que **nadie**
 * escriba desde el cliente, ni siquiera el superadmin. Las dos callables van con
 * Admin SDK, que no evalúa estas reglas; dejar la escritura abierta al
 * superadmin sería una segunda puerta al mismo sitio, y la lección de `CF8` es
 * que las dos puertas se olvidan por separado.
 */
describe("FEAT-004 · el paz y salvo lo escribe SOLO el servidor", () => {
  /**
   * **La condición del documento es «saldo cero», y el cliente no la evalúa.**
   * Si pudiera crear el certificado, cualquiera se emitiría uno debiendo — y
   * este papel se enseña ante un tercero, no dentro de la aplicación. Por eso la
   * escritura está cerrada del todo, incluso al administrador: las dos callables
   * usan Admin SDK, que no evalúa estas reglas, así que abrirla aquí sería una
   * segunda puerta al mismo sitio. Es la lección de `CF8`.
   */
  it("el administrador lee los de su conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "clearanceCertificates", "pys-1")));
  });

  it("R9 · el residente lee el de SU unidad", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(resident.firestore(), "clearanceCertificates", "pys-1")));
  });

  it("el consejo también lo lee: el certificado no dice nada personal", async () => {
    const committee = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(committee.firestore(), "clearanceCertificates", "pys-1")));
  });

  it("CF3 · un guarda NO lo alcanza", async () => {
    const guard = testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(guard.firestore(), "clearanceCertificates", "pys-1")));
  });

  it("y NADIE lo crea desde el cliente — ni el administrador", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "clearanceCertificates", "pys-falso"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        issuedAt: "2026-08-25",
        asOfDate: "2026-08-25",
        code: "PYS-FALSO2",
        balanceAtIssue: 0,
        status: "emitido",
      }),
    );
  });

  it("ni lo anula a mano: eso es `cancelClearanceCertificate`, que exige motivo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "clearanceCertificates", "pys-1"), { status: "anulado" }),
    );
  });

  // ── FLOW-003 · el rastro de entrega de correo ──────────────────────────────
  //
  // **Lo que estas pruebas vigilan es a QUIÉN se le niega**, no a quién se le concede.
  // La fila guarda la dirección de correo de un residente y qué se le mandó: es detalle
  // personal, y por eso el consejo queda fuera aunque sí lea el paz y salvo. Comprobar
  // solo que el administrador entra dejaría esa línea sin guardián.

  it("el administrador lee el rastro de su conjunto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(getDoc(doc(admin.firestore(), "emailDeliveries", "resend-msg-1")));
  });

  it("el CONSEJO no lo lee, al revés que el paz y salvo — aquí hay dirección de correo", async () => {
    const committee = testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(committee.firestore(), "emailDeliveries", "resend-msg-1")));
  });

  it("el residente NO lee ni el suyo: le corresponde su cartera, no la telemetría de envío", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(getDoc(doc(resident.firestore(), "emailDeliveries", "resend-msg-1")));
  });

  it("un administrador de OTRO conjunto tampoco", async () => {
    const otro = testEnv.authenticatedContext("admin-b", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getDoc(doc(otro.firestore(), "emailDeliveries", "resend-msg-1")));
  });

  it("nadie lo crea desde el cliente — la fila nace en el envío, no en el navegador", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "emailDeliveries", "resend-inventado"), {
        tenantId: "tenant-a",
        providerMessageId: "resend-inventado",
        recipientEmail: "x@y.co",
        notificationKey: "billing_new",
        subject: "falso",
        status: "entregado",
      }),
    );
  });

  it("ni marca un correo como entregado a mano: eso lo hace el webhook con firma", async () => {
    // Es el criterio que sostiene toda la métrica. Si el administrador pudiera
    // escribir aquí, «100% de entrega conocida» pasaría a ser «100% de lo que
    // alguien quiso declarar».
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "emailDeliveries", "resend-msg-1"), { status: "entregado" }),
    );
  });

  // ── FLOW-003 · R5 y R6 en las REGLAS, no solo en el formulario ─────────────
  //
  // §11.2: «si solo se valida en el formulario, se salta con una escritura directa».
  // Y R6 no es cosmético — un ciclo de un día es un correo diario a alguien que debe
  // dinero. Esto es lo que hace que el mínimo sea una regla y no una sugerencia.

  it("el administrador guarda un calendario válido", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        tenantId: "tenant-a",
        billingCalendar: { noticeDayOfMonth: 28, overdueCycleDays: 7 },
      }),
    );
  });

  it("R5 · RECHAZA el día 31 — no existe en todos los meses", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        tenantId: "tenant-a",
        billingCalendar: { noticeDayOfMonth: 31 },
      }),
    );
  });

  it("R6 · RECHAZA un ciclo de 1 día, que es hostigar", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        tenantId: "tenant-a",
        billingCalendar: { overdueCycleDays: 1 },
      }),
    );
  });

  it("acepta `null` en los dos: desactivado no es un valor inválido", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        tenantId: "tenant-a",
        billingCalendar: { noticeDayOfMonth: null, overdueCycleDays: null },
      }),
    );
  });

  /**
   * **La que tolera la AUSENCIA del calendario**, que es el caso de todo conjunto que nunca lo
   * configuró — o sea, los nueve de hoy. Sin esa tolerancia, la regla intentaría leer un campo de
   * un mapa que no existe, y en Firestore eso no devuelve `null`: **da error de evaluación y
   * deniega**. El administrador se quedaría sin poder guardar ningún ajuste.
   *
   * **Ojo con cómo se prueba, porque el primer intento no probaba nada.** Un `updateDoc` sobre un
   * documento que YA tiene calendario llega a la regla con el calendario dentro —`updateDoc` es
   * una fusión y la regla ve el resultado—, así que la rama de ausencia nunca se ejercitaba: la
   * prueba pasaba igual con la tolerancia quitada. Hace falta un documento SIN calendario.
   */
  it("un conjunto que nunca configuró calendario guarda sus otros ajustes", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        tenantId: "tenant-a",
        emailFooterHtml: "<p>Conjunto A</p>",
      }),
    );
  });

  /**
   * **EL FORMULARIO NO ESCRIBE ASÍ, y las cinco pruebas de arriba no lo cubrían.**
   *
   * Todas usan `setDoc` con el objeto entero. `BillingCalendarCard` usa `updateDoc` con **rutas
   * punteadas** —`billingCalendar.noticeDayOfMonth`— porque escribir el objeto completo borraría
   * `lastNoticeSentAt` y `lastOverdueSentAt`, que son la memoria de deduplicado del servidor.
   *
   * Son primitivas distintas y la regla las ve distinto: con ruta punteada, Firestore fusiona y la
   * regla evalúa el documento RESULTANTE. Probar solo `setDoc` es exactamente el defecto que costó
   * una sesión con `chartOfAccounts` —«el banco probaba un camino que el producto no usa»—, y por
   * eso estas cuatro existen.
   */
  it("el formulario guarda con RUTAS PUNTEADAS, que es como escribe de verdad", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        "billingCalendar.noticeDayOfMonth": 15,
        "billingCalendar.overdueCycleDays": 30,
      }),
    );
  });

  it("y por ruta punteada la regla SIGUE rechazando el día 31", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        "billingCalendar.noticeDayOfMonth": 31,
      }),
    );
  });

  it("y sigue rechazando un ciclo por debajo del mínimo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        "billingCalendar.overdueCycleDays": 3,
      }),
    );
  });

  /**
   * **La que de verdad protege el dato del servidor.** Desactivar borra el campo con
   * `deleteField()`, no guarda `null`. Si esto se denegara, el administrador no podría apagar el
   * aviso desde la pantalla y acabaría haciéndolo desde la consola — que es donde no hay reglas de
   * formulario.
   */
  it("desactivar borrando el campo también pasa, y deja el calendario sin esa clave", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "tenantSettings", "tenant-a"), {
        "billingCalendar.noticeDayOfMonth": deleteField(),
        "billingCalendar.overdueCycleDays": deleteField(),
      }),
    );
  });

  it("un residente no guarda ajustes, calendario válido o no", async () => {
    const resident = testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(resident.firestore(), "tenantSettings", "tenant-a"), {
        billingCalendar: { noticeDayOfMonth: 5, overdueCycleDays: 15 },
      }),
    );
  });

  it("ni lo borra, que es como se taparía un rebote", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "emailDeliveries", "resend-msg-1")));
  });

  it("ni lo borra, que es como se perdería el rastro de un papel que ya salió", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(deleteDoc(doc(admin.firestore(), "clearanceCertificates", "pys-1")));
  });
});

describe("FLOW-001 · el sello del prorrateo y la anulación los escribe SOLO el servidor", () => {
  /**
   * **Dos vetos de campo dentro de un documento que el cliente sigue editando**,
   * igual que `advanceAppliedAmount` de `FLOW-002` y por el mismo motivo: el
   * administrador hace `updateDoc` directo sobre sus cargos con normalidad.
   *
   * **Por qué no se comprueba el `campaignId`.** Sería lo natural —«¿esta
   * corrida es de un reparto?»— y exige LEER la corrida: otro `get()` dentro de
   * una regla cuyo propio comentario avisa de que un acceso más la lleva al
   * límite y la hace fallar con **error de evaluación**. Denegaría igual, y las
   * pruebas pasarían en verde por el motivo equivocado. Por eso el guardián
   * mira un campo del propio documento, que no cuesta accesos.
   *
   * **Y el control importa tanto como los vetos.** Sin las dos pruebas que
   * SUCEDEN, retirar la guarda entera dejaría este bloque en verde; y una
   * guarda de más dejaría al administrador sin poder editar sus cargos, que es
   * romper cartera para proteger un campo.
   */
  it("CONTROL · el administrador sigue creando un cargo normal", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      setDoc(doc(admin.firestore(), "billingStatements", "bill-normal-flow001"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        period: "2026-08",
        amount: 100000,
        balance: 100000,
        status: "pending",
      }),
    );
  });

  it("CONTROL · y sigue editando uno que vino de un reparto, mientras no toque su origen", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-de-reparto"), {
        paymentAmount: 50000,
        balance: 200000,
      }),
    );
  });

  it("pero NO puede crear un cargo con el sello de un reparto", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "billingStatements", "bill-falso-reparto"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        period: "2026-08",
        sourceExpenseId: "gasto-ascensor",
        amount: 250000,
        balance: 250000,
        status: "pending",
      }),
    );
  });

  it("ni estrenarle el sello a un cargo que no venía de ninguno", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-1"), { sourceExpenseId: "gasto-ascensor" }),
    );
  });

  it("ni cambiarle la factura de origen a uno que sí venía", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-de-reparto"), { sourceExpenseId: "otra-factura" }),
    );
  });

  it("ni ANULAR un cargo a mano: eso es `cancelDistribution`, que comprueba R7 y exige motivo", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-de-reparto"), { status: "cancelled", balance: 0 }),
    );
  });

  it("ni firmar la anulación con el autor y el motivo que quiera", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      updateDoc(doc(admin.firestore(), "billingStatements", "bill-de-reparto"), {
        cancelledBy: "otro-admin",
        cancellationReason: "lo dijo el consejo",
      }),
    );
  });

  it("y un cargo NUEVO tampoco puede nacer anulado", async () => {
    const admin = testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
    await assertFails(
      setDoc(doc(admin.firestore(), "billingStatements", "bill-nace-anulado"), {
        tenantId: "tenant-a",
        unitId: "unit-t2-503",
        period: "2026-08",
        amount: 100000,
        balance: 0,
        status: "cancelled",
      }),
    );
  });
});

describe("PLAT-002 · managementCompanies: solo superadmin lee, y nadie escribe", () => {
  const sa = () => testEnv.authenticatedContext("super-1", { role: "superadmin" });
  const adminA = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
  const residenteA = () => testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });

  it("el superadmin lee el registro", async () => {
    await assertSucceeds(getDoc(doc(sa().firestore(), "managementCompanies", "adm-1")));
  });

  /**
   * §7.1 pedía «lectura para los miembros de un conjunto asociado» y eso NO se
   * puede expresar aquí: haría falta iterar conjuntos. Se cerró al superadmin y
   * el NOMBRE se desnormalizó en `tenants`, que los miembros ya leen. Estas dos
   * fijan la decisión: el registro lleva `taxId`, correo y teléfono, y no es
   * para todo el que tenga sesión.
   */
  it("un administrador de conjunto NO lo lee", async () => {
    await assertFails(getDoc(doc(adminA().firestore(), "managementCompanies", "adm-1")));
  });

  it("y un residente tampoco", async () => {
    await assertFails(getDoc(doc(residenteA().firestore(), "managementCompanies", "adm-1")));
  });

  it("NADIE escribe desde el cliente — ni el superadmin", async () => {
    await assertFails(
      setDoc(doc(sa().firestore(), "managementCompanies", "adm-nueva"), {
        name: "Administra S.A.",
        country: "CO",
        status: "active",
      }),
    );
  });

  it("ni borra", async () => {
    await assertFails(deleteDoc(doc(sa().firestore(), "managementCompanies", "adm-1")));
  });
});

/**
 * `PRD-V-FLOW-004` R8 — **el enlace entre el extracto y el libro lo escribe solo
 * el servidor.**
 *
 * Estas reglas no comprueban que un emparejamiento sea correcto: **no pueden**.
 * La comprobación es aritmética entre dos documentos y una regla tendría que
 * leer el asiento para hacerla. Lo que hacen es **cerrar el camino viejo**, para
 * que la callable no conviva con un atajo por el navegador — que es como se
 * escribió, el 20 de agosto, la conciliación de −300.000 contra +40.000 que
 * sigue en producción.
 *
 * **Se prueba con `updateDoc`, no con `setDoc`**, porque es lo que hace el
 * producto: en un `update` con merge Firestore evalúa el documento
 * **resultante**, y esa diferencia ya costó tener la conciliación muerta y en
 * verde durante semanas.
 */
describe("FLOW-004 · el expediente de conciliación", () => {
  const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
  const otroAdmin = () => testEnv.authenticatedContext("admin-2", { role: "tenant_admin", tenantId: "tenant-b" });
  const residente = () => testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
  const sa = () => testEnv.authenticatedContext("super-1", { role: "superadmin" });

  beforeAll(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "bankStatementLines", "bsl-suelta"), {
        tenantId: "tenant-a",
        bankAccountId: "cta-1",
        date: "2026-06-08",
        description: "SPEI recibido — T1-101",
        amount: 3000,
        reconciled: false,
        matchedLedgerEntryId: null,
      });
      await setDoc(doc(db, "bankStatementLines", "bsl-casada"), {
        tenantId: "tenant-a",
        bankAccountId: "cta-1",
        date: "2026-06-08",
        description: "Mantenimiento",
        amount: -300000,
        reconciled: true,
        matchedLedgerEntryId: "le-flow004-manual",
      });
      await setDoc(doc(db, "ledgerEntries", "le-flow004-manual"), {
        tenantId: "tenant-a",
        type: "egreso",
        amount: 300000,
        date: "2026-06-08",
        concept: "Mantenimiento",
        sourceType: "manual",
        reconciled: false,
      });
      await setDoc(doc(db, "ledgerEntries", "le-flow004-cobro"), {
        tenantId: "tenant-a",
        type: "ingreso",
        amount: 3000,
        date: "2026-06-08",
        concept: "Pago de cuota",
        sourceType: "billingStatement",
        reconciled: false,
      });
      // `PRD-V-FEAT-005` — una decisión de fusión, con su snapshot dentro.
      await setDoc(doc(db, "personMergeDecisions", "pmd-existente"), {
        tenantId: "tenant-a",
        tipo: "fusion",
        claveDelGrupo: "p1·p2",
        survivorId: "p1",
        mergedIds: ["p2"],
        motivo: "misma persona, dos altas",
        snapshot: { personas: { p2: { fullName: "David Carmona", documentNumber: "SGWE34675JKG" } }, referencias: [] },
        estado: "completada",
        decidedBy: "admin-a",
      });
      await setDoc(doc(db, "reconciliationCases", "bsl-suelta"), {
        tenantId: "tenant-a",
        bankAccountId: "cta-1",
        bankStatementLineId: "bsl-suelta",
        status: "detectado",
        version: 0,
        candidateLedgerEntryIds: [],
        matchedLedgerEntryId: null,
        excepcion: "sin_contraparte",
        incoherencias: [],
      });
    });
  });

  describe("la línea del extracto", () => {
    it("un admin puede importar una línea, que nace SUELTA", async () => {
      await assertSucceeds(
        setDoc(doc(admin().firestore(), "bankStatementLines", "bsl-nueva"), {
          tenantId: "tenant-a",
          bankAccountId: "cta-1",
          date: "2026-07-01",
          description: "Depósito",
          amount: 1000,
          reconciled: false,
          matchedLedgerEntryId: null,
        }),
      );
    });

    it("pero NO puede importarla ya conciliada", async () => {
      await assertFails(
        setDoc(doc(admin().firestore(), "bankStatementLines", "bsl-nace-casada"), {
          tenantId: "tenant-a",
          bankAccountId: "cta-1",
          date: "2026-07-01",
          description: "Depósito",
          amount: 1000,
          reconciled: true,
          matchedLedgerEntryId: "le-flow004-manual",
        }),
      );
    });

    it("**R8** · no puede conciliarla a mano — es el camino que escribió el par falso", async () => {
      await assertFails(
        updateDoc(doc(admin().firestore(), "bankStatementLines", "bsl-suelta"), {
          reconciled: true,
          matchedLedgerEntryId: "le-flow004-manual",
        }),
      );
    });

    it("ni deshacer una conciliación a mano", async () => {
      await assertFails(
        updateDoc(doc(admin().firestore(), "bankStatementLines", "bsl-casada"), {
          reconciled: false,
          matchedLedgerEntryId: null,
        }),
      );
    });

    it("ni el superadmin: la coherencia no tiene excepción por rol", async () => {
      await assertFails(
        updateDoc(doc(sa().firestore(), "bankStatementLines", "bsl-suelta"), {
          reconciled: true,
          matchedLedgerEntryId: "le-flow004-manual",
        }),
      );
    });

    it("lo que NO es el enlace se sigue pudiendo corregir", async () => {
      // El veto es sobre dos campos, no sobre la colección: quien concilia tiene
      // que poder arreglar una descripción mal parseada del CSV.
      await assertSucceeds(
        updateDoc(doc(admin().firestore(), "bankStatementLines", "bsl-suelta"), {
          description: "SPEI recibido — T1-101 (corregido)",
        }),
      );
    });

    it("un admin de otro conjunto no la ve", async () => {
      await assertFails(getDoc(doc(otroAdmin().firestore(), "bankStatementLines", "bsl-suelta")));
    });
  });

  describe("el asiento del libro", () => {
    it("**R8** · nadie le escribe la marca de conciliado desde el navegador", async () => {
      // Y este es `manual`, que es justo el tipo que el veto anterior NO cubría:
      // el emparejamiento falso de producción se escribió sobre uno así.
      await assertFails(
        updateDoc(doc(admin().firestore(), "ledgerEntries", "le-flow004-manual"), {
          reconciled: true,
          bankStatementLineId: "bsl-suelta",
        }),
      );
    });

    it("ni sobre un asiento de cobro", async () => {
      await assertFails(
        updateDoc(doc(admin().firestore(), "ledgerEntries", "le-flow004-cobro"), {
          reconciled: true,
          bankStatementLineId: "bsl-suelta",
        }),
      );
    });

    it("un movimiento manual nace sin conciliar y eso sigue permitido", async () => {
      await assertSucceeds(
        setDoc(doc(admin().firestore(), "ledgerEntries", "le-flow004-nuevo"), {
          tenantId: "tenant-a",
          type: "egreso",
          amount: 50,
          date: "2026-07-01",
          concept: "Bombillas",
          sourceType: "manual",
          reconciled: false,
        }),
      );
    });

    it("pero no nace ya conciliado", async () => {
      await assertFails(
        setDoc(doc(admin().firestore(), "ledgerEntries", "le-flow004-nace-casado"), {
          tenantId: "tenant-a",
          type: "egreso",
          amount: 50,
          date: "2026-07-01",
          concept: "Bombillas",
          sourceType: "manual",
          reconciled: true,
          bankStatementLineId: "bsl-suelta",
        }),
      );
    });

    it("anular un movimiento manual sigue funcionando — es el camino de `reverseLedgerEntry`", async () => {
      await assertSucceeds(
        updateDoc(doc(admin().firestore(), "ledgerEntries", "le-flow004-manual"), {
          reversedByEntryId: "le-reverso-x",
        }),
      );
    });
  });

  describe("el expediente", () => {
    it("la administración lo lee", async () => {
      await assertSucceeds(getDoc(doc(admin().firestore(), "reconciliationCases", "bsl-suelta")));
    });

    it("**un residente NO** — la descripción del extracto nombra unidades", async () => {
      await assertFails(getDoc(doc(residente().firestore(), "reconciliationCases", "bsl-suelta")));
    });

    it("un admin de otro conjunto tampoco", async () => {
      await assertFails(getDoc(doc(otroAdmin().firestore(), "reconciliationCases", "bsl-suelta")));
    });

    it("NADIE lo escribe desde el cliente — ni el superadmin", async () => {
      await assertFails(
        setDoc(doc(sa().firestore(), "reconciliationCases", "bsl-inventado"), {
          tenantId: "tenant-a",
          bankAccountId: "cta-1",
          bankStatementLineId: "bsl-inventado",
          status: "aplicado",
          version: 0,
          candidateLedgerEntryIds: [],
          matchedLedgerEntryId: "le-flow004-manual",
          excepcion: null,
          incoherencias: [],
        }),
      );
    });

    it("ni cambia el motivo de uno que ya existe", async () => {
      // Si el navegador pudiera reescribirlo, el motivo de un descarte valdría
      // lo que valga el navegador.
      await assertFails(
        updateDoc(doc(admin().firestore(), "reconciliationCases", "bsl-suelta"), {
          status: "aplicado",
          motivoCodigo: "otro",
        }),
      );
    });

    it("ni lo borra", async () => {
      await assertFails(deleteDoc(doc(admin().firestore(), "reconciliationCases", "bsl-suelta")));
    });
  });

  /**
   * `PRD-V-FEAT-005` — las decisiones sobre el padrón duplicado.
   *
   * **Se prueba, no se lee.** El documento lleva dentro el `snapshot` de las personas pisadas
   * —nombre, documento, correo—, así que es a la vez lo único que hace reversible una fusión y
   * un volcado de datos personales. Las dos cosas piden la misma regla: la administración lo lee
   * y **nadie lo escribe desde el cliente**.
   */
  describe("las decisiones del padrón", () => {
    it("la administración las lee", async () => {
      await assertSucceeds(getDoc(doc(admin().firestore(), "personMergeDecisions", "pmd-existente")));
    });

    it("**un residente NO** — el snapshot lleva documentos de identidad de otros", async () => {
      await assertFails(getDoc(doc(residente().firestore(), "personMergeDecisions", "pmd-existente")));
    });

    it("un admin de otro conjunto tampoco", async () => {
      await assertFails(getDoc(doc(otroAdmin().firestore(), "personMergeDecisions", "pmd-existente")));
    });

    it("NADIE la escribe desde el cliente — ni el superadmin", async () => {
      // Si el navegador pudiera escribir el snapshot, «se puede deshacer» sería una frase y no
      // una garantía: valdría lo que valga el navegador.
      await assertFails(
        setDoc(doc(sa().firestore(), "personMergeDecisions", "pmd-inventada"), {
          tenantId: "tenant-a",
          tipo: "fusion",
          claveDelGrupo: "p3·p4",
          survivorId: "p3",
          mergedIds: ["p4"],
          motivo: "inventado",
          snapshot: {},
        }),
      );
    });

    it("ni reescribe el motivo de una que ya existe", async () => {
      await assertFails(
        updateDoc(doc(admin().firestore(), "personMergeDecisions", "pmd-existente"), { motivo: "otro" }),
      );
    });

    it("ni borra el snapshot, que es lo único que permite volver atrás", async () => {
      await assertFails(deleteDoc(doc(admin().firestore(), "personMergeDecisions", "pmd-existente")));
    });
  });
});
