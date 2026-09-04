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
 * `PRD-V-FLOW-008` entrega 3 · las reglas de `expenses`, **contra el emulador**.
 * `CA5` y `CA9`.
 *
 * ## Por qué contra el emulador y no leyendo la regla
 *
 * `updateDoc` **fusiona** y la regla evalúa el documento RESULTANTE, mientras
 * `setDoc` lo reemplaza; esa diferencia ya dejó pasar un veto entero en este
 * repositorio. Aquí se escribe con las dos formas a propósito.
 *
 * ## Lo que estas pruebas vigilan además
 *
 * **Que la regla nueva no rompa los 52 egresos que ya existen.** Es una regla que
 * RESTRINGE, y la mitad del riesgo de esta entrega es dejar fuera una escritura
 * legítima que hoy funciona.
 */

let testEnv: RulesTestEnvironment;

const T = "cuotas-conjunto";
const SUSPENDIDO = "cuotas-suspendido";

const admin = (t = T) => testEnv.authenticatedContext(`admin-${t}`, { role: "tenant_admin" }).firestore();
const residente = () => testEnv.authenticatedContext("residente-1", {}).firestore();

const once = Array.from({ length: 11 }, (_, i) => ({
  number: i + 1,
  dueDate: `2026-${String(i + 1).padStart(2, "0")}-15`,
  amount: 100,
  status: "pendiente",
}));

/** Un egreso SIN plan, como los 52 de producción. */
const sinPlan = (extra: Record<string, unknown> = {}) => ({
  tenantId: T,
  description: "Energía áreas comunes",
  category: "servicios_publicos",
  amount: 9_950,
  issueDate: "2026-06-20",
  dueDate: "2026-07-05",
  status: "registrado",
  installments: null,
  ...extra,
});

const conPlan = (extra: Record<string, unknown> = {}) => ({
  tenantId: T,
  description: "Póliza de seguro del inmueble",
  category: "seguros",
  amount: 1_100,
  issueDate: "2026-01-02",
  status: "registrado",
  installments: once,
  ...extra,
});

async function sembrar() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "tenants", T), { status: "active" });
    await setDoc(doc(db, "tenants", SUSPENDIDO), { status: "suspended" });
    for (const t of [T, SUSPENDIDO]) {
      await setDoc(doc(db, "tenantUsers", `${t}_admin-${t}`), {
        uid: `admin-${t}`, tenantId: t, role: "tenant_admin", status: "active",
      });
    }
    await setDoc(doc(db, "tenantUsers", `${T}_residente-1`), {
      uid: "residente-1", tenantId: T, role: "resident", status: "active",
    });

    await setDoc(doc(db, "expenses", "sin-plan"), sinPlan());
    await setDoc(doc(db, "expenses", "con-plan"), conPlan());
    // Una factura con una cuota YA PAGADA: la escribió el servidor.
    await setDoc(doc(db, "expenses", "con-pago"), conPlan({
      paidAmount: 100,
      installments: once.map((c) => (c.number === 1 ? { ...c, status: "pagada", ledgerEntryId: "asiento-1" } : c)),
    }));
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

/**
 * **La mitad del riesgo de esta entrega.** La regla RESTRINGE, así que lo primero
 * que hay que probar no es lo que bloquea: es que **no bloquee lo que hoy
 * funciona**.
 */
describe("FLOW-008 · los egresos SIN plan no notan la regla nueva", () => {
  it("se crean como siempre", async () => {
    await assertSucceeds(setDoc(doc(admin(), "expenses", "nuevo"), sinPlan()));
  });

  it("se marcan `pagado` como siempre — sin plan el estado NO es derivado", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "expenses", "sin-plan"), { status: "pagado", paidAt: "2026-07-05" }));
  });

  it("se anulan y se editan como siempre", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "expenses", "sin-plan"), { status: "anulado" }));
    await assertSucceeds(updateDoc(doc(admin(), "expenses", "sin-plan"), { amount: 12_000, description: "Otra cosa" }));
  });

  it("se borran como siempre", async () => {
    await assertSucceeds(deleteDoc(doc(admin(), "expenses", "sin-plan")));
  });

});

/**
 * **`R8` · el calendario NO lo escribe el cliente, ni al crear ni al editar.**
 *
 * Era escritura directa hasta el 4 de septiembre de 2026. Se cerró porque la
 * entrega 2 hizo que la deuda del conjunto derive de las **cuotas vivas**, y
 * entonces el array pasó a sostener un invariante.
 *
 * **Comprobar cuota por cuota no se puede —las reglas no iteran listas—, pero
 * congelar el array entero sí**, y cierra el mismo agujero por el otro lado.
 */
describe("FLOW-008 · `R8` · el array `installments` está congelado", () => {
  it("un egreso NO puede nacer con un plan por delante", async () => {
    await assertFails(setDoc(doc(admin(), "expenses", "otro-plan"), conPlan()));
  });

  it("nacer SIN plan sigue siendo lo normal", async () => {
    await assertSucceeds(setDoc(doc(admin(), "expenses", "otro-normal"), sinPlan()));
  });

  it("editar las cuotas desde el cliente: RECHAZADO, aunque sean las pendientes", async () => {
    await assertFails(
      updateDoc(doc(admin(), "expenses", "con-plan"), {
        installments: once.map((c) => ({ ...c, dueDate: `2026-${String(c.number).padStart(2, "0")}-20` })),
      }),
    );
  });

  it("marcar una cuota `pagada` a mano: RECHAZADO — era el agujero de `R8`", async () => {
    // Sin este veto, un cliente manipulado bajaba la deuda del conjunto sin pasar
    // por el servidor y sin dejar un asiento en el libro.
    await assertFails(
      updateDoc(doc(admin(), "expenses", "con-plan"), {
        installments: once.map((c) => ({ ...c, status: "pagada", ledgerEntryId: "inventado" })),
      }),
    );
  });

  it("anularlas todas para dejar la deuda en cero: RECHAZADO", async () => {
    await assertFails(
      updateDoc(doc(admin(), "expenses", "con-plan"), {
        installments: once.map((c) => ({ ...c, status: "anulada" })),
      }),
    );
  });

  it("quitar el plan entero: RECHAZADO", async () => {
    await assertFails(updateDoc(doc(admin(), "expenses", "con-plan"), { installments: null }));
  });

  it("pero editar OTRA cosa de una factura con plan SÍ se puede", async () => {
    // Es lo que hace la pantalla al guardar: el egreso por escritura directa y el
    // plan por la callable. Si esto fallara, no se podría ni corregir un texto.
    await assertSucceeds(updateDoc(doc(admin(), "expenses", "con-plan"), { description: "Póliza (corregida)" }));
  });
});

describe("FLOW-008 · `CA5` · lo que sella el SERVIDOR no lo escribe el cliente", () => {
  it("`paidAmount` no se puede inventar al crear", async () => {
    await assertFails(setDoc(doc(admin(), "expenses", "trampa"), conPlan({ paidAmount: 1_100 })));
  });

  it("`paidAmount` no se puede mover al editar — ni subir ni bajar", async () => {
    await assertFails(updateDoc(doc(admin(), "expenses", "con-pago"), { paidAmount: 1_100 }));
    await assertFails(updateDoc(doc(admin(), "expenses", "con-pago"), { paidAmount: 0 }));
  });

  it("tampoco con `setDoc`, que REEMPLAZA en vez de fusionar", async () => {
    // Las dos formas a propósito: la regla ve documentos distintos según cuál se
    // use, y probar solo una deja la otra sin vigilar.
    await assertFails(setDoc(doc(admin(), "expenses", "con-pago"), conPlan({ paidAmount: 500 })));
  });

  it("editar OTRA cosa de una factura con pagos SÍ se puede: `paidAmount` va igual", async () => {
    await assertSucceeds(updateDoc(doc(admin(), "expenses", "con-pago"), { description: "Póliza 2026 (corregida)" }));
  });

  it("los sellos de anulación son del servidor", async () => {
    await assertFails(updateDoc(doc(admin(), "expenses", "con-plan"), { voidReason: "porque sí" }));
    await assertFails(updateDoc(doc(admin(), "expenses", "con-plan"), { voidedBy: "admin-cuotas-conjunto" }));
  });
});

describe("FLOW-008 · `CA3` en la regla · con plan, el ESTADO lo deriva el servidor", () => {
  it("el cliente NO puede marcar `pagado` una factura con cuotas pendientes", async () => {
    // Sería bajar la deuda del conjunto sin que nadie pagara nada.
    await assertFails(updateDoc(doc(admin(), "expenses", "con-plan"), { status: "pagado" }));
  });

  it("tampoco puede ANULARLA a mano: anular conserva lo pagado y eso lo hace la callable", async () => {
    await assertFails(updateDoc(doc(admin(), "expenses", "con-plan"), { status: "anulado" }));
  });

  it("y no puede nacer `pagado` con un plan por delante", async () => {
    await assertFails(setDoc(doc(admin(), "expenses", "nace-pagado"), conPlan({ status: "pagado" })));
  });
});

describe("FLOW-008 · borrar una factura con cuotas pagadas", () => {
  it("NO se borra: sus cuotas dejaron asientos en el libro", async () => {
    await assertFails(deleteDoc(doc(admin(), "expenses", "con-pago")));
  });

  it("una con plan pero SIN pagos todavía sí se borra", async () => {
    await assertSucceeds(deleteDoc(doc(admin(), "expenses", "con-plan")));
  });
});

describe("FLOW-008 · `CA9` · el conjunto suspendido y quién no es administrador", () => {
  it("un conjunto suspendido no crea ni edita egresos", async () => {
    await assertFails(
      setDoc(doc(admin(SUSPENDIDO), "expenses", "sus-1"), { ...sinPlan(), tenantId: SUSPENDIDO }),
    );
  });

  it("un residente no lee ni escribe egresos: no son suyos", async () => {
    await assertFails(setDoc(doc(residente(), "expenses", "res-1"), sinPlan()));
    await assertFails(updateDoc(doc(residente(), "expenses", "sin-plan"), { amount: 1 }));
  });
});
