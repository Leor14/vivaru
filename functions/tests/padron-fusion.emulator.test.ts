import { beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "hogaru-1-test";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { descartarGrupoDeDuplicados, fusionarPersonas } from "../src/padron";
import { REFERENCIAS_A_PERSONA } from "../src/referencias-a-persona";

/**
 * `PRD-V-FEAT-005` — la fusión del padrón, **contra una base de verdad**.
 *
 * `tests/padron-duplicados.test.ts` (raíz) prueba la detección, que es una función pura y no
 * toca nada. **Aquí vive el riesgo entero**: repuntar referencias, archivar sin borrar, y el
 * barrido que aborta ante lo desconocido. Nada de eso se puede probar sin Firestore —
 * `arrayRemove`/`arrayUnion` y `listCollections` no tienen sustituto honesto en un doble.
 *
 * **Y la prueba que más importa es `CF3`:** una referencia fuera del inventario detiene la fusión
 * **sin haber escrito nada**. Es el defecto de `mergeUnits` —nueve campos de dieciocho, y borraba
 * igual— que dejó los huérfanos de `tenant-santa-maria`.
 *
 *   export JAVA_HOME="$HOME/.local/java/jdk-21.0.12+8-jre/Contents/Home"
 *   firebase emulators:start --only firestore --project hogaru-1-test
 *   npm --prefix functions run test:emulator
 */

const TENANT = "conjunto-prueba";
const OTRO = "conjunto-ajeno";
const ADMIN = "admin-1";
const ROL = "tenant_admin";

let db: Firestore;

beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  db = getFirestore();
});

async function limpiar(col: string) {
  const snap = await db.collection(col).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

async function persona(id: string, over: Record<string, unknown> = {}) {
  await db.collection("people").doc(id).set({ tenantId: TENANT, fullName: "David Carmona", ...over });
}

beforeEach(async () => {
  for (const col of ["people", "units", "packages", "tickets", "personMergeDecisions", "tenantUsers"]) {
    await limpiar(col);
  }
  await db.collection("tenantUsers").doc(`${TENANT}_${ADMIN}`).set({ uid: ADMIN, tenantId: TENANT, role: "tenant_admin", status: "active" });
  await db.collection("tenants").doc(TENANT).set({ status: "active" });
});

const actor = { uid: ADMIN, role: ROL };

describe("fusionar personas del padrón", () => {
  describe("CA5 — tras fusionar, CERO referencias apuntan a los archivados", () => {
    it("repunta TODOS los campos del inventario, escalares y listas", async () => {
      await persona("superviviente");
      await persona("duplicada");
      // Un campo de lista y los tres escalares de `packages`, que es donde estaban los dos que
      // ninguna lista escrita a mano habría incluido.
      await db.collection("units").doc("u1").set({ tenantId: TENANT, ownerIds: ["duplicada", "otra"], residentIds: ["duplicada"] });
      await db.collection("packages").doc("p1").set({ tenantId: TENANT, residentId: "duplicada", deliveredToId: "duplicada", receivedBy: "duplicada" });

      const res = await fusionarPersonas(
        { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "misma persona, dos altas" },
        actor,
      );

      expect(res.ok).toBe(true);
      const unidad = (await db.collection("units").doc("u1").get()).data()!;
      expect(unidad.ownerIds.sort()).toEqual(["otra", "superviviente"]);
      expect(unidad.residentIds).toEqual(["superviviente"]);
      const paquete = (await db.collection("packages").doc("p1").get()).data()!;
      expect(paquete.residentId).toBe("superviviente");
      expect(paquete.deliveredToId).toBe("superviviente");
      expect(paquete.receivedBy).toBe("superviviente");
      expect(res.repuntadas).toBe(5);
    });

    /**
     * **`deliveredToId` y `receivedBy` son MIXTOS**: llevan un id de persona cuando el guarda
     * elige del directorio y un **uid** cuando lo recoge el residente. Repuntar por igualdad los
     * deja en paz, y esta prueba es la que lo fija: sin ella, «repuntar el campo» podría
     * convertirse algún día en «escribir el superviviente en el campo».
     */
    it("y NO toca un uid que vive en el mismo campo mixto", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await db.collection("packages").doc("p-uid").set({ tenantId: TENANT, deliveredToId: "uid-de-auth-ajeno", receivedBy: "uid-de-auth-ajeno" });
      await db.collection("packages").doc("p-per").set({ tenantId: TENANT, deliveredToId: "duplicada" });

      await fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor);

      expect((await db.collection("packages").doc("p-uid").get()).data()!.deliveredToId).toBe("uid-de-auth-ajeno");
      expect((await db.collection("packages").doc("p-per").get()).data()!.deliveredToId).toBe("superviviente");
    });
  });

  describe("CF3 — una referencia fuera del inventario ABORTA la fusión", () => {
    /**
     * **Esta prueba es el guardián del inventario, y `CF8` se falsa quitándole un campo.** Si
     * alguien borra `packages.receivedBy` de `REFERENCIAS_A_PERSONA`, la prueba de arriba deja de
     * pasar: su referencia pasa a ser desconocida y la fusión aborta.
     */
    it("no escribe NADA, y nombra el campo desconocido", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await db.collection("packages").doc("p1").set({ tenantId: TENANT, residentId: "duplicada" });
      // `tickets.residentId` está en la lista de «parece y no es»: lleva un uid. Si un día
      // llevara un id de persona, esto es lo que tiene que pasar.
      await db.collection("tickets").doc("t1").set({ tenantId: TENANT, residentId: "duplicada" });

      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor),
      ).rejects.toThrow(/tickets\.residentId/);

      // Y lo que hace que «aborta» signifique algo: la base quedó intacta.
      expect((await db.collection("packages").doc("p1").get()).data()!.residentId).toBe("duplicada");
      expect((await db.collection("people").doc("duplicada").get()).data()!.fusionadaEn).toBeUndefined();
      expect((await db.collection("personMergeDecisions").get()).size).toBe(0);
    });
  });

  describe("CA6 y R7 — sin snapshot no hay fusión", () => {
    it("deja la decisión con snapshot, motivo, autor y fecha", async () => {
      await persona("superviviente");
      await persona("duplicada", { documentNumber: "SGWE34675JKG" });
      await db.collection("packages").doc("p1").set({ tenantId: TENANT, residentId: "duplicada" });

      const res = await fusionarPersonas(
        { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "mismo documento y correo" },
        actor,
      );

      const decision = (await db.collection("personMergeDecisions").doc(res.decisionId).get()).data()!;
      expect(decision.tipo).toBe("fusion");
      expect(decision.motivo).toBe("mismo documento y correo");
      expect(decision.decidedBy).toBe(ADMIN);
      expect(decision.decidedAt).toBeTruthy();
      expect(decision.estado).toBe("completada");
      // El snapshot tiene que traer el documento PISADO entero, o no se puede deshacer.
      expect(decision.snapshot.personas.duplicada.documentNumber).toBe("SGWE34675JKG");
      // Y las referencias movidas, que es la otra mitad de poder volver atrás.
      expect(decision.snapshot.referencias).toContainEqual(
        expect.objectContaining({ coleccion: "packages", campo: "residentId", docId: "p1" }),
      );
    });

    it("las fusionadas se ARCHIVAN con su porqué, no se borran", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "el porqué" }, actor);

      const doc = await db.collection("people").doc("duplicada").get();
      expect(doc.exists, "la persona NO se borra").toBe(true);
      expect(doc.data()!.fusionadaHaciaId).toBe("superviviente");
      expect(doc.data()!.fusionadaMotivo).toBe("el porqué");
      expect(doc.data()!.fusionadaPor).toBe(ADMIN);
    });

    it("y una ya fusionada no se vuelve a fusionar", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor);
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor),
      ).rejects.toThrow(/ya se fusionó/);
    });
  });

  describe("los casos que deben fallar", () => {
    it("CF1 y CF6 — no se cruzan conjuntos, ni siendo superadministrador", async () => {
      await persona("superviviente");
      await persona("ajena", { tenantId: OTRO });
      const superadmin = { uid: "root", role: "superadmin" };
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["ajena"], motivo: "x" }, superadmin),
      ).rejects.toThrow(/otro conjunto/);
    });

    it("CF2 — sin nadie que fusionar, no es una fusión", async () => {
      await persona("superviviente");
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: [], motivo: "x" }, actor),
      ).rejects.toThrow(/ninguna persona/);
    });

    it("CF4 — dos cuentas de acceso DISTINTAS se rechazan, nombrándolas", async () => {
      await persona("superviviente", { authUid: "uid-A" });
      await persona("duplicada", { authUid: "uid-B" });
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor),
      ).rejects.toThrow(/uid-A, uid-B/);
    });

    /** El caso REAL de producción: «Luis» y «Luis Otero» apuntan al mismo uid. Es una persona. */
    it("…pero dos fichas del MISMO uid sí se fusionan: es una persona, no dos", async () => {
      await persona("superviviente", { authUid: "uid-compartido" });
      await persona("duplicada", { authUid: "uid-compartido" });
      const res = await fusionarPersonas(
        { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "misma cuenta" },
        actor,
      );
      expect(res.ok).toBe(true);
    });

    it("sin motivo no se fusiona: una decisión sin porqué obliga a reabrirla entera", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "  " }, actor),
      ).rejects.toThrow(/motivo/i);
    });

    it("CF7 — con el conjunto suspendido se deniega EN EL SERVIDOR", async () => {
      await db.collection("tenants").doc(TENANT).set({ status: "suspended" });
      await persona("superviviente");
      await persona("duplicada");
      await expect(
        fusionarPersonas({ tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" }, actor),
      ).rejects.toThrow(/suspendido/);
    });

    it("quien no es administrador del conjunto no fusiona", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await expect(
        fusionarPersonas(
          { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "x" },
          { uid: "otro", role: "tenant_admin" },
        ),
      ).rejects.toThrow(/permiso/i);
    });
  });

  /**
   * **Esta prueba existe por lo que se vio EJECUTANDO la primera fusión de producción**, no por
   * leer el código: al terminar, los seis ids archivados quedan escritos en
   * `personMergeDecisions.mergedIds` y el del superviviente en `survivorId` — porque ese documento
   * existe justamente para nombrarlos. **El barrido los ve como referencias**, y como esa colección
   * no está (ni debe estar) en el inventario, la SIGUIENTE fusión de esa persona abortaría.
   *
   * Un superviviente que no se puede volver a fusionar es un callejón sin salida que solo aparece
   * en la segunda pasada, cuando ya nadie está mirando.
   */
  describe("una persona que ya sobrevivió a una fusión se puede volver a fusionar", () => {
    it("la decisión anterior no bloquea la siguiente", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await persona("tercera");
      await fusionarPersonas(
        { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "primera" },
        actor,
      );
      // Ahora `personMergeDecisions` nombra a «superviviente» y a «duplicada».
      expect((await db.collection("personMergeDecisions").get()).size).toBe(1);

      const segunda = await fusionarPersonas(
        { tenantId: TENANT, survivorId: "tercera", mergedIds: ["superviviente"], motivo: "segunda" },
        actor,
      );
      expect(segunda.ok).toBe(true);
    });

    it("y el registro de la decisión NO se reescribe: es historia, no dato de producto", async () => {
      await persona("superviviente");
      await persona("duplicada");
      await persona("tercera");
      const primera = await fusionarPersonas(
        { tenantId: TENANT, survivorId: "superviviente", mergedIds: ["duplicada"], motivo: "primera" },
        actor,
      );
      await fusionarPersonas(
        { tenantId: TENANT, survivorId: "tercera", mergedIds: ["superviviente"], motivo: "segunda" },
        actor,
      );
      const antes = (await db.collection("personMergeDecisions").doc(primera.decisionId).get()).data()!;
      // Si el barrido repuntara la decisión, esto diría «tercera» y la historia sería falsa.
      expect(antes.survivorId).toBe("superviviente");
      expect(antes.mergedIds).toEqual(["duplicada"]);
    });
  });

  describe("CA7 — descartar un grupo", () => {
    it("guarda la decisión contra la huella de sus ids", async () => {
      await persona("a");
      await persona("b", { fullName: "Jorge Pardo" });
      const res = await descartarGrupoDeDuplicados({ tenantId: TENANT, ids: ["b", "a"], motivo: "son hermanos" }, actor);
      expect(res.clave).toBe("a·b");
      const snap = await db.collection("personMergeDecisions").where("tipo", "==", "descarte").get();
      expect(snap.size).toBe(1);
      expect(snap.docs[0].data().motivo).toBe("son hermanos");
    });

    it("y la huella CAMBIA si entra un tercero, así que el grupo vuelve a salir", async () => {
      await persona("a");
      await persona("b");
      await persona("c");
      const dos = await descartarGrupoDeDuplicados({ tenantId: TENANT, ids: ["a", "b"], motivo: "no" }, actor);
      const tres = await descartarGrupoDeDuplicados({ tenantId: TENANT, ids: ["a", "b", "c"], motivo: "no" }, actor);
      expect(tres.clave).not.toBe(dos.clave);
    });

    it("CF5 — descartar sin motivo se rechaza", async () => {
      await persona("a");
      await persona("b");
      await expect(
        descartarGrupoDeDuplicados({ tenantId: TENANT, ids: ["a", "b"], motivo: "" }, actor),
      ).rejects.toThrow(/por qué/i);
    });
  });

  describe("el inventario, como objeto", () => {
    it("no tiene entradas repetidas", () => {
      const claves = REFERENCIAS_A_PERSONA.map((r) => `${r.coleccion}.${r.campo}`);
      expect(new Set(claves).size).toBe(claves.length);
    });

    it("y cubre listas, no solo campos escalares", () => {
      // La trampa que ya mordió una vez: buscar campos escalares dijo que ninguno de los siete
      // «David Carmona» estaba referenciado, y dos lo estaban desde `units.ownerIds`.
      expect(REFERENCIAS_A_PERSONA.some((r) => r.esLista)).toBe(true);
    });
  });
});
