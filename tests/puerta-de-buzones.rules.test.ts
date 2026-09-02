import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * `PRD-V-PLAT-006` · la puerta de ENTRADA, **probada contra el emulador y con el patrón real del
 * cliente**. `CA1`, `CA2`, `CA3`, `CA6`, `CA7` y `CA8`.
 *
 * **Por qué contra el emulador y no leyendo la regla.** Una regla se lee bien y hace otra cosa:
 * `updateDoc` fusiona y la regla evalúa el documento RESULTANTE, mientras `setDoc` lo reemplaza —
 * y esa diferencia ya dejó pasar un veto entero en este repositorio. Aquí se escribe con las dos
 * formas a propósito.
 *
 * **Y por qué la puerta de entrada NO sustituye a la de salida:** `people` lo escribe el cliente y
 * lo cubre esta regla; `users` y `tenantUsers` solo los escriben callables, que van con Admin SDK
 * y **no evalúan estas reglas**. Esa mitad la cubre `assertBuzonAdmisible`, probada aparte.
 */

let testEnv: RulesTestEnvironment;

const MARCADO = "tenant-marcado";
const CON_CLIENTE = "tenant-con-cliente";

const admin = (t: string) => testEnv.authenticatedContext(`admin-${t}`, { role: "tenant_admin" }).firestore();
const superadmin = () => testEnv.authenticatedContext("super-1", { role: "superadmin" }).firestore();

/** Deja la base en el estado que pida cada caso, saltándose las reglas. */
async function sembrar(opts: {
  banderaGlobal?: boolean;
  override?: boolean | null;
  killSwitchMaestro?: boolean;
  killSwitchBandera?: boolean;
  equipo?: { dominios?: string[]; direcciones?: string[] } | null;
}) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const t of [MARCADO, CON_CLIENTE]) {
      await setDoc(doc(db, "tenantUsers", `${t}_admin-${t}`), {
        uid: `admin-${t}`, tenantId: t, role: "tenant_admin", status: "active",
      });
    }
    // Los DOS llevan `isExample`: si la puerta lo usara de criterio, el conjunto
    // con cliente caería también. Es el error que traía el chip.
    await setDoc(doc(db, "tenants", MARCADO), { status: "active", isExample: true, sinClienteDetras: true });
    await setDoc(doc(db, "tenants", CON_CLIENTE), { status: "active", isExample: true });

    if (opts.banderaGlobal !== undefined || opts.killSwitchBandera) {
      await setDoc(doc(db, "featureFlags", "producto-puerta-de-buzones"), {
        ...(opts.banderaGlobal !== undefined ? { enabled: opts.banderaGlobal } : {}),
        ...(opts.killSwitchBandera ? { killSwitch: true } : {}),
      });
    }
    if (opts.killSwitchMaestro) await setDoc(doc(db, "featureFlags", "_global"), { killSwitch: true });
    if (opts.override !== undefined && opts.override !== null) {
      await setDoc(doc(db, "featureFlagOverrides", MARCADO), {
        flags: { "producto-puerta-de-buzones": opts.override },
      });
    }
    if (opts.equipo) await setDoc(doc(db, "config", "correosDelEquipo"), opts.equipo);

    // Una persona YA dentro con correo no admisible: es el caso de las once.
    await setDoc(doc(db, "people", "ya-dentro"), {
      tenantId: MARCADO, fullName: "Ya Dentro", email: "medi.paty@gmail.com", phone: "300", status: "active",
    });
  });
}

const persona = (tenantId: string, email: string) => ({
  tenantId, fullName: "Nueva", email, phone: "3001112233", status: "active",
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: { rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(async () => { await testEnv.cleanup(); });

describe("PLAT-006 · la puerta de entrada, con la bandera ENCENDIDA", () => {
  beforeEach(async () => { await sembrar({ banderaGlobal: true, equipo: { dominios: ["qintilab.com"], direcciones: ["dave+res1@hotmail.com"] } }); });

  it("CA1 · crear una persona con gmail en un conjunto marcado FALLA", async () => {
    await assertFails(setDoc(doc(admin(MARCADO), "people", "p1"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("CA2 · con un dominio inerte PASA", async () => {
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "p2"), persona(MARCADO, "ejemplo.t1@ejemplo.vivaru.app")));
  });

  it("CA3 · un dominio del equipo PASA", async () => {
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "p3"), persona(MARCADO, "dev@qintilab.com")));
  });

  it("CA3 · una dirección exacta de la lista PASA, y su `+alias` NO listado FALLA", async () => {
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "p4"), persona(MARCADO, "dave+res1@hotmail.com")));
    await assertFails(setDoc(doc(admin(MARCADO), "people", "p5"), persona(MARCADO, "dave+res2@hotmail.com")));
  });

  it("no distingue mayúsculas", async () => {
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "p6"), persona(MARCADO, "DEV@QintiLab.com")));
  });

  it("CA7 · en un conjunto NO marcado pasa, aunque lleve `isExample` y la bandera esté encendida", async () => {
    await assertSucceeds(setDoc(doc(admin(CON_CLIENTE), "people", "p7"), persona(CON_CLIENTE, "prospecto@gmail.com")));
  });

  // ── La trampa del merge ──────────────────────────────────────────────────
  it("editar OTRO campo de una persona ya dentro NO se bloquea", async () => {
    // `updateDoc` fusiona y la regla ve el documento resultante, con su correo no
    // admisible dentro. Si la regla mirase el correo siempre, esto fallaría — y
    // dejaría las once imposibles de mantener.
    await assertSucceeds(updateDoc(doc(admin(MARCADO), "people", "ya-dentro"), { phone: "3009998877" }));
  });

  it("pero CAMBIARLE el correo a otro no admisible SÍ se bloquea", async () => {
    await assertFails(updateDoc(doc(admin(MARCADO), "people", "ya-dentro"), { email: "otra@gmail.com" }));
  });

  it("y cambiárselo a uno admisible se permite", async () => {
    await assertSucceeds(updateDoc(doc(admin(MARCADO), "people", "ya-dentro"), { email: "limpio@ejemplo.vivaru.app" }));
  });

  it("un `setDoc` que REEMPLAZA con correo no admisible falla igual que el create", async () => {
    await assertFails(setDoc(doc(admin(MARCADO), "people", "ya-dentro"), persona(MARCADO, "otra@gmail.com")));
  });

  it("una persona SIN correo se puede crear", async () => {
    const { email, ...sinCorreo } = persona(MARCADO, "x@x.com");
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "p8"), sinCorreo));
  });
});

describe("PLAT-006 · CA6 — la bandera es el freno de verdad", () => {
  it("con la bandera APAGADA, el mismo create PASA", async () => {
    await sembrar({ banderaGlobal: false, equipo: { dominios: [] } });
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "q1"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("SIN documento de bandera (default del catálogo = false) también PASA", async () => {
    await sembrar({ equipo: { dominios: [] } });
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "q2"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("el override POR CONJUNTO enciende sobre una global apagada (la vía del canario)", async () => {
    await sembrar({ banderaGlobal: false, override: true, equipo: { dominios: [] } });
    await assertFails(setDoc(doc(admin(MARCADO), "people", "q3"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("el override APAGA sobre una global encendida", async () => {
    await sembrar({ banderaGlobal: true, override: false, equipo: { dominios: [] } });
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "q4"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("el kill switch de la bandera manda sobre el override", async () => {
    await sembrar({ banderaGlobal: true, override: true, killSwitchBandera: true, equipo: { dominios: [] } });
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "q5"), persona(MARCADO, "alguien@gmail.com")));
  });

  it("el kill switch MAESTRO apaga la puerta entera", async () => {
    await sembrar({ banderaGlobal: true, override: true, killSwitchMaestro: true, equipo: { dominios: [] } });
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "q6"), persona(MARCADO, "alguien@gmail.com")));
  });
});

describe("PLAT-006 · sin lista del equipo la puerta se cierra de MÁS, no de menos", () => {
  it("sin `config/correosDelEquipo` solo pasan los dominios inertes", async () => {
    await sembrar({ banderaGlobal: true, equipo: null });
    await assertFails(setDoc(doc(admin(MARCADO), "people", "r1"), persona(MARCADO, "dev@qintilab.com")));
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "r2"), persona(MARCADO, "x@ejemplo.vivaru.app")));
  });
});

describe("PLAT-006 · CA8 — quién manda sobre la marca y sobre la lista", () => {
  beforeEach(async () => { await sembrar({ banderaGlobal: true, equipo: { dominios: ["qintilab.com"] } }); });

  it("el `tenant_admin` NO puede marcar su propio conjunto", async () => {
    await assertFails(updateDoc(doc(admin(MARCADO), "tenants", MARCADO), { sinClienteDetras: false }));
  });

  it("el `tenant_admin` NO puede DESmarcarlo para colar una dirección", async () => {
    await assertFails(setDoc(doc(admin(MARCADO), "tenants", MARCADO), { status: "active", sinClienteDetras: false }));
  });

  it("el superadmin sí marca y desmarca", async () => {
    await assertSucceeds(updateDoc(doc(superadmin(), "tenants", CON_CLIENTE), { sinClienteDetras: true }));
  });

  it("el `tenant_admin` NO puede LEER la lista del equipo", async () => {
    // Contiene direcciones del equipo: no es dato del conjunto.
    await assertFails(getDoc(doc(admin(MARCADO), "config", "correosDelEquipo")));
  });

  it("ni escribirla para meterse su propio dominio", async () => {
    await assertFails(setDoc(doc(admin(MARCADO), "config", "correosDelEquipo"), { dominios: ["gmail.com"] }));
  });

  // ── El control. Sin esto, los `assertFails` de arriba podrían estar
  // fallando por una razón que no es la puerta.
  it("CONTROL · el mismo administrador SÍ puede hacer la operación equivalente permitida", async () => {
    // Si el `tenant_admin` no pudiera escribir `people` en absoluto, todos los
    // `assertFails` de CA1 pasarían sin que la puerta existiera.
    await assertSucceeds(setDoc(doc(admin(MARCADO), "people", "control-1"), persona(MARCADO, "ok@ejemplo.vivaru.app")));
    await assertSucceeds(updateDoc(doc(admin(MARCADO), "people", "control-1"), { phone: "300" }));
  });

  it("CONTROL · y el superadmin puede leer la lista que al admin se le niega", async () => {
    const snap = await assertSucceeds(getDoc(doc(superadmin(), "config", "correosDelEquipo")));
    expect(snap.exists()).toBe(true);
  });
});
