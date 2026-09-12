import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

/**
 * **`CF9` en las dos direcciones · el `tenantId` de un documento no se muda.**
 *
 * **Hacia dentro.** Si la regla de `update` mira el rol contra `request.resource.data.tenantId`
 * —el valor NUEVO—, un administrador del conjunto A edita un documento del conjunto B
 * cambiándole el `tenantId` a A, y la regla lo aprueba: el rol se comprueba en su propio
 * conjunto. Se reprodujo y se cerró en `amenities` el 12 de septiembre de 2026
 * (`PRD-V-FIX-001`). La tabla `CASOS` cubre los otros dieciocho bloques con la misma forma,
 * sacados con un inventario mecánico de `firestore.rules` y no a ojo.
 *
 * **Hacia fuera.** Si la mira contra el de ANTES pero no impide que cambie, quien puede
 * editar su documento lo EMPUJA a otro conjunto: un PQRS, una visita o un recibo que aparece
 * en un conjunto ajeno. Salió al cerrar lo primero, en siete bloques (tabla `EMPUJES`).
 *
 * Las dos estaban al alcance de cualquiera: el alta de prueba crea un conjunto `trial` con
 * una membresía `tenant_admin` activa, y `tenantOperable` admite `trial`.
 *
 * En `CASOS`, cada colección prueba cuatro cosas:
 *  · el **exploit** — el administrador de A se queda el documento de B. Lo cierra cualquiera
 *    de las dos cláusulas: con la igualdad, el rol del conjunto nuevo ES el del de antes;
 *  · la **mudanza** — un administrador de LOS DOS conjuntos lo pasa de B a A. Ahí el rol de
 *    antes se cumple, así que solo lo cierra que el `tenantId` no cambie. **Es la prueba que
 *    aísla la igualdad**: quitarla deja el exploit cerrado y abre esta;
 *  · la **edición legítima** — el administrador de B edita lo suyo. Es la mitad positiva: la
 *    regla restringe, y lo primero es que no bloquee lo que hoy funciona;
 *  · el **alta**, en los bloques que eran `create, update` y hubo que partir, porque en un
 *    `create` no existe `resource`.
 *
 * **Contra la regla de antes, el exploit, la mudanza y el empuje se aprobaban.** Un
 * `assertFails` que pasa en verde contra la regla vieja no prueba nada: estaría fallando por
 * otra validación del bloque, y por eso cada documento de abajo es uno que su bloque acepta.
 *
 * Fuera, con su motivo: `pushTokens` (reescribir el dueño es su diseño: el id ES el token y
 * reclamarlo exige tenerlo), `tenantOnboarding` y `tenantSettings` (el conjunto sale de la
 * ruta), `documentFolders` (se escribe solo desde el servidor: la regla es `false`), y
 * `treasuryTransfers` y `pettyCashFunds` (una lista cerrada de campos tocables, sin
 * `tenantId`). El guardián estático de todo esto es `tests/el-tenantid-no-se-muda.test.ts`.
 */

let testEnv: RulesTestEnvironment;

const A = "cf9-a";
const B = "cf9-b";
const UNIDAD_B = "unidad-b";

type Caso = {
  coleccion: string;
  /** Un documento del conjunto B que su bloque acepta tal cual. */
  documento: Record<string, unknown>;
  /** Una edición corriente, de las que hace el producto sin tocar el conjunto. */
  edicion: Record<string, unknown>;
  /** El bloque era `create, update` y se partió en dos: el alta también se vigila. */
  partido: boolean;
};

const CASOS: Caso[] = [
  { coleccion: "units", documento: { label: "T1-101" }, edicion: { label: "T1-101 B" }, partido: true },
  {
    coleccion: "people",
    documento: { fullName: "Ana Ruiz", email: "ana@ejemplo.test" },
    edicion: { phone: "3001234567" },
    partido: false,
  },
  { coleccion: "communications", documento: { title: "Corte de agua" }, edicion: { title: "Corte de agua, jueves" }, partido: true },
  {
    coleccion: "billingStatements",
    documento: { concept: "administracion", amount: 100, status: "pending" },
    edicion: { amount: 120 },
    partido: true,
  },
  { coleccion: "billingSchedules", documento: { name: "Cuota mensual" }, edicion: { name: "Cuota mensual 2027" }, partido: true },
  { coleccion: "billingCampaigns", documento: { name: "Septiembre" }, edicion: { name: "Septiembre, segunda" }, partido: true },
  { coleccion: "billingReminderJobs", documento: { status: "scheduled" }, edicion: { status: "paused" }, partido: true },
  {
    // Sin plan, como los egresos de producción: con plan el estado lo deriva el servidor.
    coleccion: "expenses",
    documento: {
      description: "Energía áreas comunes",
      category: "servicios_publicos",
      amount: 9_950,
      issueDate: "2026-06-20",
      dueDate: "2026-07-05",
      status: "registrado",
      installments: null,
    },
    edicion: { description: "Energía, zonas comunes" },
    partido: false,
  },
  { coleccion: "vendors", documento: { name: "Aseo Total", taxId: "900123456" }, edicion: { name: "Aseo Total SAS" }, partido: true },
  { coleccion: "bankAccounts", documento: { name: "Cuenta corriente", active: true }, edicion: { name: "Cuenta corriente principal" }, partido: true },
  { coleccion: "bankAccountBalances", documento: { openingBalance: 1_000 }, edicion: { openingBalance: 2_000 }, partido: true },
  {
    coleccion: "bankStatementLines",
    documento: { amount: 100, reconciled: false },
    edicion: { description: "Consignación" },
    partido: false,
  },
  {
    coleccion: "ledgerEntries",
    documento: { sourceType: "manual", description: "Ajuste", amount: 100, reconciled: false },
    edicion: { description: "Ajuste de caja" },
    partido: false,
  },
  { coleccion: "financialCounters", documento: { value: 1 }, edicion: { value: 2 }, partido: true },
  {
    coleccion: "documents",
    documento: { name: "Acta de asamblea", category: "asamblea" },
    edicion: { name: "Acta de asamblea ordinaria" },
    partido: true,
  },
  { coleccion: "services", documento: { name: "Gimnasio", status: "active" }, edicion: { name: "Gimnasio y spa" }, partido: true },
  { coleccion: "meteredServices", documento: { name: "Agua" }, edicion: { name: "Agua fría" }, partido: true },
  {
    coleccion: "committee_agreements",
    documento: { title: "Pintura de fachada" },
    edicion: { title: "Pintura de fachada, fase 1" },
    partido: true,
  },
];

type Empuje = {
  coleccion: string;
  /** Un documento del conjunto B, de la unidad de `residente-b` donde aplica. */
  documento: Record<string, unknown>;
  edicionAdmin: Record<string, unknown>;
  /** La edición corriente del residente dueño, si su rama le deja editar. */
  edicionResidente?: Record<string, unknown>;
  /** Su rama de residente le deja tocar cualquier campo: el empuje también es suyo. */
  residenteEmpuja: boolean;
  /** El bloque es `update, delete`: la cláusula nueva tiene que dejar pasar el borrado. */
  conBorrado: boolean;
};

const EMPUJES: Empuje[] = [
  {
    coleccion: "tickets",
    documento: { unitId: UNIDAD_B, createdBy: "residente-b", subject: "Gotera", status: "open" },
    edicionAdmin: { status: "in_progress" },
    edicionResidente: { description: "Gotera en el baño" },
    residenteEmpuja: true,
    conBorrado: false,
  },
  {
    coleccion: "visitorInvitations",
    documento: { unitId: UNIDAD_B, residentUserId: "residente-b", visitorName: "Luis" },
    edicionAdmin: { visitorName: "Luis Pérez" },
    edicionResidente: { visitorName: "Luis P." },
    residenteEmpuja: true,
    conBorrado: true,
  },
  {
    coleccion: "visitorPasses",
    documento: { unitId: UNIDAD_B, createdBy: "residente-b", status: "scheduled", visitorName: "Luis" },
    edicionAdmin: { visitorName: "Luis Pérez" },
    edicionResidente: { visitorName: "Luis P." },
    residenteEmpuja: true,
    conBorrado: false,
  },
  {
    coleccion: "visitorAuthorizations",
    documento: { unitId: UNIDAD_B, createdBy: "residente-b", visitorName: "Luis", startDate: "2026-10-01", startTime: "10:00" },
    edicionAdmin: { visitorName: "Luis Pérez" },
    edicionResidente: { visitorName: "Luis P." },
    residenteEmpuja: true,
    conBorrado: true,
  },
  {
    coleccion: "unitChangeRequests",
    documento: { userId: "residente-b", status: "pending" },
    edicionAdmin: { status: "approved" },
    residenteEmpuja: false,
    conBorrado: false,
  },
  {
    // El residente solo toca `responseCount` (`hasOnly`): su rama ya no dejaba mudar nada.
    coleccion: "surveys",
    documento: { title: "Pintura de fachada", responseCount: 0 },
    edicionAdmin: { title: "Pintura de fachada, fase 1" },
    edicionResidente: { responseCount: 1 },
    residenteEmpuja: false,
    conBorrado: false,
  },
  {
    coleccion: "paymentReceipts",
    documento: { unitId: UNIDAD_B, uploadedBy: "residente-b", status: "pending", amount: 100 },
    edicionAdmin: { status: "approved" },
    residenteEmpuja: false,
    conBorrado: false,
  },
];

/** `admin-a` administra A; `admin-b`, B; `admin-ab`, los dos. `residente-b` vive en `unidad-b`. */
const admin = (uid: string) => testEnv.authenticatedContext(uid, { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-b", { role: "resident" }).firestore();
const idDeB = (coleccion: string) => `${coleccion}-de-b`;

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const t of [A, B]) await setDoc(doc(db, "tenants", t), { status: "active" });
    const membresias: [string, string][] = [[A, "admin-a"], [B, "admin-b"], [A, "admin-ab"], [B, "admin-ab"]];
    for (const [t, uid] of membresias) {
      await setDoc(doc(db, "tenantUsers", `${t}_${uid}`), { uid, tenantId: t, role: "tenant_admin", status: "active" });
    }
    await setDoc(doc(db, "tenantUsers", `${B}_residente-b`), {
      uid: "residente-b", tenantId: B, role: "resident", status: "active", unitId: UNIDAD_B,
    });
    for (const c of [...CASOS, ...EMPUJES]) await setDoc(doc(db, c.coleccion, idDeB(c.coleccion)), { tenantId: B, ...c.documento });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: { rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
beforeEach(sembrar);

describe.each(CASOS)("CF9 · $coleccion", (c) => {
  it("DEBE FALLAR: el administrador de otro conjunto se queda el documento reescribiendo su tenantId", async () => {
    await assertFails(updateDoc(doc(admin("admin-a"), c.coleccion, idDeB(c.coleccion)), { tenantId: A, ...c.edicion }));
  });

  it("DEBE FALLAR: ni un administrador de los dos conjuntos lo muda de uno a otro", async () => {
    await assertFails(updateDoc(doc(admin("admin-ab"), c.coleccion, idDeB(c.coleccion)), { tenantId: A, ...c.edicion }));
  });

  it("el administrador del conjunto sigue editando el suyo", async () => {
    await assertSucceeds(updateDoc(doc(admin("admin-b"), c.coleccion, idDeB(c.coleccion)), c.edicion));
  });

  if (c.partido) {
    it("y el alta, que compartía bloque con el update, sigue funcionando", async () => {
      await assertSucceeds(setDoc(doc(admin("admin-b"), c.coleccion, `${c.coleccion}-nuevo`), { tenantId: B, ...c.documento }));
    });
  }
});

describe.each(EMPUJES)("CF9 al revés · $coleccion", (e) => {
  it("DEBE FALLAR: el administrador empuja un documento de su conjunto a otro", async () => {
    await assertFails(updateDoc(doc(admin("admin-b"), e.coleccion, idDeB(e.coleccion)), { tenantId: A, ...e.edicionAdmin }));
  });

  if (e.residenteEmpuja) {
    it("DEBE FALLAR: el residente empuja el suyo a otro conjunto", async () => {
      await assertFails(updateDoc(doc(residente(), e.coleccion, idDeB(e.coleccion)), { tenantId: A, ...e.edicionResidente }));
    });
  }

  it("el administrador sigue editando", async () => {
    await assertSucceeds(updateDoc(doc(admin("admin-b"), e.coleccion, idDeB(e.coleccion)), e.edicionAdmin));
  });

  if (e.edicionResidente) {
    const edicion = e.edicionResidente;
    it("el residente sigue editando el suyo", async () => {
      await assertSucceeds(updateDoc(doc(residente(), e.coleccion, idDeB(e.coleccion)), edicion));
    });
  }

  if (e.conBorrado) {
    it("y el borrado, que comparte bloque con el update, sigue funcionando", async () => {
      await assertSucceeds(deleteDoc(doc(admin("admin-b"), e.coleccion, idDeB(e.coleccion))));
    });
  }
});
