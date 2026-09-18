import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, addDoc, arrayUnion, collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

/**
 * **`L-08b` — el residente crea su propio visitante frecuente, y solo REVOCA lo suyo.**
 *
 * Lote «Análisis de la plataforma», fase 7 (18 sep 2026). Hasta hoy la regla de `visitorPasses`
 * solo exigía al residente unidad propia y `createdBy`, y en el `update` le dejaba reescribir
 * cualquier campo de su pase salvo la unidad. Nadie lo aprovechaba porque el residente no creaba
 * frecuentes; desde el bloque 1, sí. Aquí están los dos lados:
 * - **crear**: el pase nace programado, sin entrada ni nada que solo escriben la portería o el
 *   servidor, y un frecuente dura como mucho un año;
 * - **modificar**: solo la revocación (`status → cancelled` y `cancelledAt`), nunca alargar la
 *   vigencia ni marcarse dentro.
 * Y el borde de la portería: un frecuente revocado mientras estaba dentro sale y **no se reabre**.
 *
 * Se usa `addDoc`/`updateDoc`, que es lo que hace el cliente: la regla ve el documento resultante.
 */

let testEnv: RulesTestEnvironment;

const T = "tenant-frecuente-residente";
const UNIDAD = "unit-fr-201";
const RESIDENTE = "residente-fr";
const VECINO = "residente-fr-vecino";
const GUARDIA = "guardia-fr";

/** Lo que escribe `createResidentInvitation` (más lo que añade `createTenantDocument`). */
const paseDelResidente = (extra: Record<string, unknown> = {}) => ({
  tenantId: T,
  unitId: UNIDAD,
  unitLabel: "T2-201",
  visitorName: "Marta Gómez",
  documentNumber: "52525252",
  qrCodeValue: `QR-${Math.random().toString(36).slice(2)}`,
  hostResidentName: "Residente Frecuente",
  tower: "T2",
  unit: "201",
  date: "2026-10-01",
  eventDate: "2026-10-01",
  scheduledTime: "2026-10-01T12:00:00.000Z",
  status: "scheduled",
  checkInAt: null,
  checkOutAt: null,
  residentName: "Residente Frecuente",
  createdByName: "Residente Frecuente",
  createdBy: RESIDENTE,
  updatedBy: RESIDENTE,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

const frecuente = (extra: Record<string, unknown> = {}) =>
  paseDelResidente({
    authorizationType: "larga_duracion",
    validFrom: "2026-10-01",
    validUntil: "2027-03-31",
    visitorCategory: "servicio",
    horario: { dias: [1, 3, 5], desde: "07:00", hasta: "17:00" },
    ...extra,
  });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    firestore: {
      rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "tenants", T), { name: "Conjunto Frecuente", status: "active", currency: "COP" });
    for (const [uid, role] of [
      [RESIDENTE, "resident"],
      [VECINO, "resident"],
      [GUARDIA, "security_guard"],
    ] as const) {
      await setDoc(doc(db, "tenantUsers", `${T}_${uid}`), {
        uid,
        tenantId: T,
        role,
        status: "active",
        ...(role === "resident" ? { unitId: UNIDAD } : {}),
        email: `${uid}@hogaru.test`,
      });
    }
    // Pases ya creados, para las pruebas de modificación.
    const { createdAt: _c, updatedAt: _u, ...fijo } = frecuente();
    const base = { ...fijo, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    await setDoc(doc(db, "visitorPasses", "pase-a-revocar"), base);
    await setDoc(doc(db, "visitorPasses", "pase-a-alargar"), base);
    await setDoc(doc(db, "visitorPasses", "pase-a-marcar-dentro"), base);
    await setDoc(doc(db, "visitorPasses", "pase-del-vecino"), base);
    await setDoc(doc(db, "visitorPasses", "pase-con-nota"), base);
    await setDoc(doc(db, "visitorPasses", "pase-que-entra"), { ...base, validUntil: "2099-12-31" });
    await setDoc(doc(db, "visitorPasses", "pase-dentro-a-revocar"), {
      ...base,
      status: "inside",
      checkInAt: Timestamp.now(),
      checkInBy: GUARDIA,
    });
    await setDoc(doc(db, "visitorPasses", "pase-dentro-revocado"), {
      ...base,
      validUntil: "2099-12-31",
      status: "inside",
      checkInAt: Timestamp.now(),
      checkInBy: GUARDIA,
      cancelledAt: Timestamp.now(),
    });
    // Uno por prueba: si compartieran documento, la primera escritura cambiaría el punto de partida
    // de la segunda y una falsación enrojecería las dos.
    await setDoc(doc(db, "visitorPasses", "pase-dentro-revocado-sale"), {
      ...base,
      validUntil: "2099-12-31",
      status: "inside",
      checkInAt: Timestamp.now(),
      checkInBy: GUARDIA,
      cancelledAt: Timestamp.now(),
    });
    await setDoc(doc(db, "visitorPasses", "pase-dentro-vigente"), {
      ...base,
      validUntil: "2099-12-31",
      status: "inside",
      checkInAt: Timestamp.now(),
      checkInBy: GUARDIA,
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

const residente = () => testEnv.authenticatedContext(RESIDENTE, { role: "resident", tenantId: T }).firestore();
const vecino = () => testEnv.authenticatedContext(VECINO, { role: "resident", tenantId: T }).firestore();
const guardia = () => testEnv.authenticatedContext(GUARDIA, { role: "security_guard", tenantId: T }).firestore();

describe("L-08b · el residente CREA su frecuente", () => {
  it("control: una visita de un día, como la escribía el front anterior (sin tipo ni vigencia)", async () => {
    await assertSucceeds(addDoc(collection(residente(), "visitorPasses"), paseDelResidente()));
  });

  it("un frecuente con vigencia, categoría y horario", async () => {
    await assertSucceeds(addDoc(collection(residente(), "visitorPasses"), frecuente()));
  });

  it("borde: un frecuente de exactamente un año sí", async () => {
    await assertSucceeds(
      addDoc(collection(residente(), "visitorPasses"), frecuente({ validFrom: "2026-10-01", validUntil: "2027-10-01" })),
    );
  });

  it("NO: un frecuente de más de un año", async () => {
    await assertFails(
      addDoc(collection(residente(), "visitorPasses"), frecuente({ validFrom: "2026-10-01", validUntil: "2027-10-03" })),
    );
  });

  it("NO: un frecuente sin fecha final (sería para siempre)", async () => {
    const { validUntil: _v, ...sinFin } = frecuente() as ReturnType<typeof frecuente> & { validUntil?: string };
    await assertFails(addDoc(collection(residente(), "visitorPasses"), sinFin));
  });

  it("NO: una vigencia al revés", async () => {
    await assertFails(
      addDoc(collection(residente(), "visitorPasses"), frecuente({ validFrom: "2026-10-10", validUntil: "2026-10-01" })),
    );
  });

  it("NO: nacer dentro", async () => {
    await assertFails(
      addDoc(collection(residente(), "visitorPasses"), frecuente({ status: "inside", checkInAt: Timestamp.now() })),
    );
  });

  it("NO: hacerse pasar por personal del conjunto", async () => {
    await assertFails(addDoc(collection(residente(), "visitorPasses"), frecuente({ alcance: "conjunto" })));
  });

  it("NO: traer una autorización de portería ya resuelta", async () => {
    await assertFails(
      addDoc(collection(residente(), "visitorPasses"), paseDelResidente({ authorizationStatus: "autorizada" })),
    );
  });

  it("NO: un tipo de autorización inventado", async () => {
    await assertFails(
      addDoc(collection(residente(), "visitorPasses"), paseDelResidente({ authorizationType: "permanente" })),
    );
  });
});

describe("L-08b · el residente solo REVOCA lo suyo", () => {
  it("revoca su frecuente programado (scheduled → cancelled)", async () => {
    await assertSucceeds(
      updateDoc(doc(residente(), "visitorPasses", "pase-a-revocar"), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: RESIDENTE,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("revoca uno que está DENTRO sin cambiarle el estado", async () => {
    await assertSucceeds(
      updateDoc(doc(residente(), "visitorPasses", "pase-dentro-a-revocar"), {
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("NO: alargar la vigencia", async () => {
    await assertFails(
      updateDoc(doc(residente(), "visitorPasses", "pase-a-alargar"), { validUntil: "2099-12-31" }),
    );
  });

  it("NO: marcarse dentro", async () => {
    await assertFails(
      updateDoc(doc(residente(), "visitorPasses", "pase-a-marcar-dentro"), {
        status: "inside",
        checkInAt: serverTimestamp(),
        cancelledAt: serverTimestamp(),
      }),
    );
  });

  it("NO: revocar el pase que creó otro residente de la unidad", async () => {
    await assertFails(
      updateDoc(doc(vecino(), "visitorPasses", "pase-del-vecino"), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      }),
    );
  });
});

describe("L-08b · la portería sigue operando los frecuentes del residente", () => {
  // **Por qué están aquí:** el `update` de `visitorPasses` llegó al tope de 1000 expresiones en las
  // denegaciones al añadir la rama de revocación. Una escritura LEGÍTIMA que recorra muchas ramas
  // —la nota del guardia es la última— se denegaría igual si lo alcanzara. Ninguna prueba la cubría.
  it("control: registra la entrada (scheduled → inside)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-que-entra"), {
        status: "inside",
        checkInAt: serverTimestamp(),
        checkInBy: GUARDIA,
      }),
    );
  });

  it("control: añade una nota de portería (la última rama de la regla)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-con-nota"), {
        guardNotes: arrayUnion({ text: "Llegó con herramientas", guardId: GUARDIA, createdAt: Timestamp.now() }),
      }),
    );
  });
});

describe("L-08b · la portería no reabre un frecuente revocado", () => {
  it("control: un frecuente vigente sale y vuelve a quedar habilitado (inside → scheduled)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-dentro-vigente"), {
        status: "scheduled",
        checkOutAt: serverTimestamp(),
        checkOutBy: GUARDIA,
      }),
    );
  });

  it("NO: uno revocado mientras estaba dentro no vuelve a scheduled", async () => {
    await assertFails(
      updateDoc(doc(guardia(), "visitorPasses", "pase-dentro-revocado"), {
        status: "scheduled",
        checkOutAt: serverTimestamp(),
        checkOutBy: GUARDIA,
      }),
    );
  });

  it("pero su salida sí se registra (inside → completed)", async () => {
    await assertSucceeds(
      updateDoc(doc(guardia(), "visitorPasses", "pase-dentro-revocado-sale"), {
        status: "completed",
        checkOutAt: serverTimestamp(),
        checkOutBy: GUARDIA,
      }),
    );
  });
});
