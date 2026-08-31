import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

import { ESPERA_DE_AUTORIZACION_MS } from "../src/autorizacion-de-visita";
import { registrarVisitaNoAnunciada, resolverAutorizacionDeVisita } from "../src/visita-no-anunciada";

/**
 * `PRD-V-FLOW-005` — la visita que llega sin avisar, **contra una base de verdad**.
 *
 * `autorizacion-de-visita-espejo.test.ts` prueba la derivación de la caducidad, que es pura.
 * **Aquí vive lo que no se puede probar sin Firestore**: la carrera entre dos residentes de la
 * misma unidad (`CA4`), que se resuelve en transacción, y los permisos cruzados — el residente
 * resuelve un documento **que no creó él**, que es la razón dura de que esto sea una callable.
 *
 * `CF2` y `CF4` NO están aquí: viven en `tests/firestore.rules.test.ts`, porque **la regla y la
 * callable son dos puertas** y probar una no dice nada de la otra.
 *
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-prueba";
const OTRO = "conjunto-ajeno";
const GUARDIA = "guardia-1";
const RES_A = "residente-a";
const RES_B = "residente-b";
const UNIDAD = "unit-101";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function membresia(uid: string, role: string, tenantId = TENANT, unitId?: string) {
  await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).set({
    uid, tenantId, role, status: "active", fullName: `Nombre de ${uid}`, ...(unitId ? { unitId } : {}),
  });
}

beforeEach(async () => {
  for (const col of ["visitorPasses", "tenantUsers", "tenants", "users"]) await limpiar(col);
  await db.collection("tenants").doc(TENANT).set({ status: "active", name: "Conjunto de prueba" });
  await membresia(GUARDIA, "security_guard");
  await membresia(RES_A, "resident", TENANT, UNIDAD);
  await membresia(RES_B, "resident", TENANT, UNIDAD);
});

const guardia = { uid: GUARDIA, rol: "security_guard", nombre: "Carlos Portería" };
const capturar = (via: "app" | "llamada" = "app", unitId = UNIDAD) =>
  registrarVisitaNoAnunciada(
    { tenantId: TENANT, unitId, unitLabel: "T1-101", visitorName: "Ana Gómez", documentNumber: "1020304050", via },
    guardia,
  );

describe("la visita que llega sin avisar", () => {
  describe("CA1 y R8 — se captura en cualquier conjunto, tenga QR o no", () => {
    /**
     * **La comprobación de la variante se retiró, y era el nudo de la ficha.** `registerWalkInVisit`
     * exigía `registro_simple`, que a su vez oculta el QR; los DIECISIETE conjuntos de los dos
     * ambientes están en `qr_full`, así que **esto no lo habría visto nadie**.
     */
    it("no se consulta ninguna variante del conjunto", async () => {
      const r = await capturar("app");
      expect(r.visitorPassId).toBeTruthy();
    });

    it("CA2 — la vía A nace pendiente, en `scheduled`, y devuelve a quién preguntar", async () => {
      const r = await capturar("app");
      expect(r.authorizationStatus).toBe("pendiente");
      expect(r.residentes.sort()).toEqual([RES_A, RES_B]);
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      // **No nace en `inside`**: antes creaba el ingreso ya puesto y avisaba de un hecho consumado.
      expect(doc.status).toBe("scheduled");
      expect(doc.checkInAt).toBeNull();
      expect(doc.origen).toBe("porteria");
      expect(doc.authorizationRequestedAt).toBeTruthy();
      expect(doc.authorizationMedium).toBeUndefined();
    });

    it("CA7 y R4 — la vía B autoriza desde el primer segundo, declarando el medio", async () => {
      const r = await capturar("llamada");
      expect(r.authorizationStatus).toBe("autorizada");
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      expect(doc.authorizationMedium).toBe("llamada");
      expect(doc.authorizedBy).toBe(GUARDIA);
      expect(doc.authorizedByName).toBe("Carlos Portería");
      expect(doc.authorizationResolvedAt).toBeTruthy();
    });

    it("CA11 y R7 — sin residentes activos la vía A se rechaza, y se dice qué hacer", async () => {
      await expect(capturar("app", "unidad-vacia")).rejects.toThrow(/llama por tel[eé]fono/i);
    });

    it("…pero la vía B sí funciona en esa misma unidad", async () => {
      const r = await capturar("llamada", "unidad-vacia");
      expect(r.authorizationStatus).toBe("autorizada");
      expect(r.residentes).toEqual([]);
    });
  });

  describe("CA3 — el residente autoriza, y queda la constancia", () => {
    it("con quién, con qué medio y cuándo", async () => {
      const r = await capturar("app");
      const res = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
        { uid: RES_A, role: "resident" },
      );
      expect(res.aplicada).toBe(true);
      expect(res.estado).toBe("autorizada");
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      expect(doc.authorizationStatus).toBe("autorizada");
      expect(doc.authorizedBy).toBe(RES_A);
      expect(doc.authorizedByName).toBe("Nombre de residente-a");
      // `R5`: el medio SIEMPRE, y lo determina quién resuelve, no lo que pida el cliente.
      expect(doc.authorizationMedium).toBe("app");
    });

    it("y puede rechazar, que es la otra mitad", async () => {
      const r = await capturar("app");
      const res = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "rechazar" },
        { uid: RES_B, role: "resident" },
      );
      expect(res.estado).toBe("rechazada");
    });
  });

  describe("CA4 y R6 — dos residentes contestan, y el segundo NO ve un error", () => {
    /**
     * **La carrera es de verdad**: los dos reciben el mismo aviso a la vez y pueden pulsar a la
     * vez. Que el segundo reciba «alguien se te adelantó» y no «algo falló» es la diferencia entre
     * informar y mentir.
     */
    it("gana el primero, y al segundo se le dice QUIÉN resolvió", async () => {
      const r = await capturar("app");
      const primero = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
        { uid: RES_A, role: "resident" },
      );
      const segundo = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "rechazar" },
        { uid: RES_B, role: "resident" },
      );
      expect(primero.aplicada).toBe(true);
      expect(segundo.aplicada).toBe(false);
      expect(segundo.estado).toBe("autorizada");
      expect(segundo.resueltaPor).toBe("Nombre de residente-a");
      // Y lo que importa de verdad: el segundo NO pisó la decisión del primero.
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      expect(doc.authorizedBy).toBe(RES_A);
    });
  });

  describe("CA5 y CA6 — la caducidad, y la vía B que la rescata", () => {
    async function envejecer(id: string) {
      await db.collection("visitorPasses").doc(id).update({
        authorizationRequestedAt: Timestamp.fromMillis(Date.now() - ESPERA_DE_AUTORIZACION_MS - 1000),
      });
    }

    it("CA5 — pasados los cinco minutos el residente ya no la resuelve, SIN que corriera ningún job", async () => {
      const r = await capturar("app");
      await envejecer(r.visitorPassId);
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
          { uid: RES_A, role: "resident" },
        ),
      ).rejects.toThrow(/cinco minutos/i);
      // Y el documento sigue diciendo «pendiente»: el estado es DERIVADO, nadie lo reescribió.
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      expect(doc.authorizationStatus).toBe("pendiente");
    });

    it("CA6 — el guardia la rescata por la vía B SIN recapturar los datos", async () => {
      const r = await capturar("app");
      await envejecer(r.visitorPassId);
      const res = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
        { uid: GUARDIA, role: "security_guard" },
      );
      expect(res.aplicada).toBe(true);
      const doc = (await db.collection("visitorPasses").doc(r.visitorPassId).get()).data()!;
      expect(doc.authorizationMedium).toBe("llamada");
      expect(doc.authorizedBy).toBe(GUARDIA);
      // Los datos del visitante son los mismos: no se recapturó nada.
      expect(doc.visitorName).toBe("Ana Gómez");
    });

    it("y el guardia también puede resolverla ANTES de que expire (R4)", async () => {
      const r = await capturar("app");
      const res = await resolverAutorizacionDeVisita(
        { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
        { uid: GUARDIA, role: "security_guard" },
      );
      expect(res.aplicada).toBe(true);
    });
  });

  describe("los casos que deben fallar", () => {
    it("CF1 — un residente de OTRA unidad no autoriza", async () => {
      await membresia("residente-otra", "resident", TENANT, "unit-999");
      const r = await capturar("app");
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
          { uid: "residente-otra", role: "resident" },
        ),
      ).rejects.toThrow(/no es de tu unidad/i);
    });

    it("CF3 — no se puede declarar un medio distinto del que corresponde", async () => {
      const r = await capturar("app");
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar", medio: "llamada" },
          { uid: RES_A, role: "resident" },
        ),
      ).rejects.toThrow(/medio de esta autorizaci/i);
    });

    /**
     * `CF5`. **Si el administrador pudiera autorizar en nombre de un residente, la constancia
     * dejaría de significar algo** — y significar algo es todo lo que esta ficha aporta.
     */
    it("CF5 — el administrador NO autoriza en nombre del residente", async () => {
      await membresia("admin-1", "tenant_admin");
      const r = await capturar("app");
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
          { uid: "admin-1", role: "tenant_admin" },
        ),
      ).rejects.toThrow(/consulta, no la firma/i);
    });

    it("CF6 — con el conjunto suspendido se deniega EN EL SERVIDOR", async () => {
      const r = await capturar("app");
      await db.collection("tenants").doc(TENANT).set({ status: "suspended" });
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: r.visitorPassId, decision: "autorizar" },
          { uid: RES_A, role: "resident" },
        ),
      ).rejects.toThrow(/suspendido/i);
      await expect(capturar("app")).rejects.toThrow(/suspendido/i);
    });

    it("una visita de otro conjunto no se toca", async () => {
      const r = await capturar("app");
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: OTRO, visitorPassId: r.visitorPassId, decision: "autorizar" },
          { uid: RES_A, role: "resident" },
        ),
      ).rejects.toThrow(/no existe en este conjunto/i);
    });

    it("un pase del flujo de QR no se resuelve por aquí: no es de los que se autorizan", async () => {
      const ref = await db.collection("visitorPasses").add({
        tenantId: TENANT, unitId: UNIDAD, status: "scheduled", visitorName: "Del QR", createdBy: RES_A,
      });
      await expect(
        resolverAutorizacionDeVisita(
          { tenantId: TENANT, visitorPassId: ref.id, decision: "autorizar" },
          { uid: RES_A, role: "resident" },
        ),
      ).rejects.toThrow(/no es de las que se autorizan/i);
    });
  });
});
