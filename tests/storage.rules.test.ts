import fs from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadString } from "firebase/storage";
import { afterAll, beforeAll, describe, it } from "vitest";

// Rutas sembradas con reglas desactivadas para luego probar la LECTURA. Sembrar
// importa: leer un objeto que no existe falla con 404, y una prueba de denegado
// pasaría por el motivo equivocado.
const TENANT_A_DOC = "tenants/tenant-a/documents/acta.txt";
const TENANT_B_DOC = "tenants/tenant-b/documents/acta.txt";
const CIERRE_B = "tenants/tenant-b/billing-closures/2026-07-1700000000.xlsx";
const FUERA_DE_TENANT = "uploads/suelto.txt";
const LOGO = "tenants/tenant-a/branding/logo.png";

// Las cuatro carpetas de dinero y gobierno (FIN-000).
const CIERRE = "tenants/tenant-a/billing-closures/2026-07-1700000000.xlsx";
const CARTERA = "tenants/tenant-a/cartera-history/2026-07-01-1700000000.xlsx";
const LIBRO = "tenants/tenant-a/ledger-history/2026-07-1700000000.xlsx";
const REPORTE_COMITE = "tenants/tenant-a/committee-reports/2026-07-1700000000.pdf";

// Comprobantes: propios, del vecino, y los anteriores al cambio de ruta.
const RECIBO_PROPIO = "tenants/tenant-a/payment-receipts/resident-1/1700000000-recibo.png";
const RECIBO_VECINO = "tenants/tenant-a/payment-receipts/resident-9/1700000000-recibo.png";
const RECIBO_VIEJO = "tenants/tenant-a/payment-receipts/unidad-101/1600000000-recibo.png";

const NOTA_PORTERIA = "tenants/tenant-a/visitor-notes/pase-1/1700000000-foto.png";

// Evidencia de soporte: la propia, la de otro miembro, y la plana anterior a
// la segmentación por uid (el nombre del archivo ocupa el hueco del dueño).
const EVIDENCIA_PROPIA = "tenants/tenant-a/support/resident-1/1700000000-evidencia.png";
const EVIDENCIA_AJENA = "tenants/tenant-a/support/resident-9/1700000000-captura.png";
const EVIDENCIA_VIEJA = "tenants/tenant-a/support/1600000000-evidencia.png";

const CARPETA_NO_DECLARADA = "tenants/tenant-a/inventada/archivo.txt";

let testEnv: RulesTestEnvironment;

// ── Quién es quién ───────────────────────────────────────────────────────────
// Los alias antiguos (`admin_tenant`, `super_admin`, `security`) siguen vivos en
// tokens ya emitidos. Se prueban porque una regla que solo mire el nombre nuevo
// dejaría a un administrador antiguo fuera de sus propios documentos.
const residente = () => testEnv.authenticatedContext("resident-1", { role: "resident", tenantId: "tenant-a" });
const vecino = () => testEnv.authenticatedContext("resident-9", { role: "resident", tenantId: "tenant-a" });
const admin = () => testEnv.authenticatedContext("admin-1", { role: "tenant_admin", tenantId: "tenant-a" });
const adminAlias = () => testEnv.authenticatedContext("admin-viejo", { role: "admin_tenant", tenantId: "tenant-a" });
const guarda = () => testEnv.authenticatedContext("guard-1", { role: "security_guard", tenantId: "tenant-a" });
const guardaAlias = () => testEnv.authenticatedContext("guard-viejo", { role: "security", tenantId: "tenant-a" });
const comite = () => testEnv.authenticatedContext("committee-1", { role: "committee", tenantId: "tenant-a" });
const superadmin = () => testEnv.authenticatedContext("super-1", { role: "superadmin" });
const superadminAlias = () => testEnv.authenticatedContext("super-viejo", { role: "super_admin" });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "hogaru-1-test",
    storage: {
      rules: fs.readFileSync(path.resolve("storage.rules"), "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
    // **Firestore hace falta aquí desde `PLAT-002`**, y no es un adorno del
    // montaje: `storage.rules` dejó de mirar el claim y ahora resuelve por
    // `tenantUsers/{tenantId}_{uid}` con reglas entre servicios. Sin el
    // emulador de Firestore delante, TODA esta suite denegaría — y pasaría en
    // verde justo las pruebas de denegación, por el motivo equivocado.
    firestore: {
      rules: fs.readFileSync(path.resolve("firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  await testEnv.clearStorage();
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    // Las membresías. Son la autoridad de `storage.rules` desde `PLAT-002`, y
    // el ROL sale de aquí y no del token: la misma persona puede ser
    // administradora de un conjunto y residente de otro.
    const db = context.firestore();
    const membresia = (tenantId: string, uid: string, role: string) =>
      setDoc(doc(db, "tenantUsers", `${tenantId}_${uid}`), { uid, tenantId, role, status: "active" });
    await Promise.all([
      membresia("tenant-a", "resident-1", "resident"),
      membresia("tenant-a", "resident-9", "resident"),
      membresia("tenant-a", "admin-1", "tenant_admin"),
      membresia("tenant-a", "admin-viejo", "admin_tenant"),
      membresia("tenant-a", "guard-1", "security_guard"),
      membresia("tenant-a", "guard-viejo", "security"),
      membresia("tenant-a", "committee-1", "committee"),
      // `resident-1` es TAMBIÉN miembro de `tenant-b`, pero como RESIDENTE.
      // Es lo que prueba que el rol no viaja de un conjunto al otro.
      membresia("tenant-b", "resident-1", "resident"),
      // `admin-1` administra los DOS. Es la administradora de `PLAT-002`, y sin
      // ella nada de lo que este cambio arregla se ejercería.
      membresia("tenant-b", "admin-1", "tenant_admin"),
      // `admin-viejo` administra A y en B es solo RESIDENTE. Su token dice
      // `admin_tenant`; su membresía en B dice `resident`. Manda la membresía.
      membresia("tenant-b", "admin-viejo", "resident"),
    ]);

    const storage = context.storage();
    const sembrar = (ruta: string, contenido: string) => uploadString(ref(storage, ruta), contenido);
    await Promise.all([
      sembrar(TENANT_A_DOC, "acta del conjunto A"),
      sembrar(TENANT_B_DOC, "acta del conjunto B"),
      sembrar(CIERRE_B, "cierre de cartera del conjunto B"),
      sembrar(FUERA_DE_TENANT, "archivo suelto"),
      sembrar(LOGO, "logo"),
      sembrar(CIERRE, "cierre de cartera"),
      sembrar(CARTERA, "historico de cartera"),
      sembrar(LIBRO, "libro contable"),
      sembrar(REPORTE_COMITE, "reporte de comite"),
      sembrar(RECIBO_PROPIO, "comprobante del residente 1"),
      sembrar(RECIBO_VECINO, "comprobante del residente 9"),
      sembrar(RECIBO_VIEJO, "comprobante anterior al cambio de ruta"),
      sembrar(NOTA_PORTERIA, "nota de porteria"),
      sembrar(EVIDENCIA_PROPIA, "evidencia del residente 1"),
      sembrar(EVIDENCIA_AJENA, "evidencia del residente 9"),
      sembrar(EVIDENCIA_VIEJA, "evidencia anterior a la segmentacion"),
      sembrar(CARPETA_NO_DECLARADA, "carpeta que nadie declaro"),
    ]);
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
    await assertSucceeds(getBytes(ref(residente().storage(), TENANT_A_DOC)));
  });

  it("permite a un admin leer archivos de su propio tenant", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), TENANT_A_DOC)));
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
    await assertSucceeds(getBytes(ref(superadmin().storage(), TENANT_A_DOC)));
    await assertSucceeds(getBytes(ref(superadmin().storage(), TENANT_B_DOC)));
  });

  // ── Escritura: solo el propio tenant o superadmin ───────────────────────────

  it("permite a un admin subir archivos a su propio tenant", async () => {
    await assertSucceeds(
      uploadString(ref(admin().storage(), "tenants/tenant-a/documents/nuevo.txt"), "nuevo documento"),
    );
  });

  /**
   * **Esta prueba cambió de actor el 25 de agosto de 2026, no de intención.**
   * Usaba `admin()`, que desde `PLAT-002` administra los DOS conjuntos a
   * propósito —es la administradora de la ficha—, así que la escritura pasó a
   * ser legítima y la prueba se puso roja. El aislamiento que vigila sigue
   * siendo el mismo; lo que hacía falta era un actor que de verdad NO sea
   * miembro del conjunto de destino. `guard-1` lo es de `tenant-a` y de nada
   * más, y se le da un claim que MIENTE diciendo `tenant-b`: si alguien
   * devuelve la regla a mirar el token, esto entra.
   */
  it("bloquea subir archivos a un conjunto donde no se tiene membresía", async () => {
    const sinMembresia = testEnv.authenticatedContext("guard-1", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(
      uploadString(ref(sinMembresia.storage(), "tenants/tenant-b/documents/intruso.txt"), "no permitido"),
    );
  });

  it("permite al superadmin subir a cualquier tenant", async () => {
    await assertSucceeds(
      uploadString(ref(superadmin().storage(), "tenants/tenant-b/documents/super.txt"), "ok"),
    );
  });

  // ── Default-deny fuera de tenants/ ──────────────────────────────────────────

  it("bloquea leer rutas fuera de tenants/ aun autenticado", async () => {
    await assertFails(getBytes(ref(residente().storage(), FUERA_DE_TENANT)));
  });

  it("bloquea escribir rutas fuera de tenants/", async () => {
    await assertFails(uploadString(ref(admin().storage(), "uploads/otro.txt"), "no permitido"));
  });
});

// ── FIN-000 · el filtro de rol ───────────────────────────────────────────────
// Antes de esta ficha, cualquier miembro del conjunto —residente, guarda,
// comité— leía Y ESCRIBÍA todo el árbol del conjunto. La regla concedía por
// pertenencia y el comentario de al lado decía «admin and superadmin».

describe("FIN-000 · documentos financieros: solo administración", () => {
  const financieros: Array<[string, string]> = [
    ["el cierre de facturación", CIERRE],
    ["el histórico de cartera", CARTERA],
    ["el libro contable", LIBRO],
    ["el reporte de comité", REPORTE_COMITE],
  ];

  for (const [nombre, ruta] of financieros) {
    it(`un residente NO puede leer ${nombre}`, async () => {
      await assertFails(getBytes(ref(residente().storage(), ruta)));
    });

    it(`un residente NO puede escribir sobre ${nombre}`, async () => {
      await assertFails(uploadString(ref(residente().storage(), ruta), "sobrescrito"));
    });

    it(`el admin SÍ puede leer ${nombre}`, async () => {
      await assertSucceeds(getBytes(ref(admin().storage(), ruta)));
    });
  }

  it("un guarda NO puede leer el cierre de facturación", async () => {
    await assertFails(getBytes(ref(guarda().storage(), CIERRE)));
  });

  // El nombre engaña: el reporte de comité es material financiero del conjunto
  // y hoy ninguna pantalla del rol `committee` lo lee desde Storage.
  it("un miembro del comité NO puede leer el reporte de comité", async () => {
    await assertFails(getBytes(ref(comite().storage(), REPORTE_COMITE)));
  });

  it("el admin puede archivar un cierre nuevo", async () => {
    await assertSucceeds(
      uploadString(ref(admin().storage(), "tenants/tenant-a/billing-closures/2026-08-1700000001.xlsx"), "cierre"),
    );
  });

  // Alias antiguos: si la regla solo mirase el nombre nuevo, estos dos se
  // quedarían fuera de sus propios documentos.
  it("un admin con el claim antiguo `admin_tenant` sigue leyendo los financieros", async () => {
    await assertSucceeds(getBytes(ref(adminAlias().storage(), CIERRE)));
  });

  it("un superadmin con el claim antiguo `super_admin` sigue leyendo los financieros", async () => {
    await assertSucceeds(getBytes(ref(superadminAlias().storage(), CIERRE)));
  });
});

describe("FIN-000 · documentación compartida: la publica la administración", () => {
  it("un residente lee el logo del conjunto", async () => {
    await assertSucceeds(getBytes(ref(residente().storage(), LOGO)));
  });

  it("un residente NO puede sobrescribir el acta del conjunto", async () => {
    await assertFails(uploadString(ref(residente().storage(), TENANT_A_DOC), "acta falsificada"));
  });

  // El filo del agujero que cerró esta ficha: no era solo leer, era BORRAR.
  it("un residente NO puede borrar el acta del conjunto", async () => {
    await assertFails(deleteObject(ref(residente().storage(), TENANT_A_DOC)));
  });

  it("un guarda NO puede sustituir el logo del conjunto", async () => {
    await assertFails(uploadString(ref(guarda().storage(), LOGO), "logo falso"));
  });

  it("el admin publica un comunicado", async () => {
    await assertSucceeds(
      uploadString(ref(admin().storage(), "tenants/tenant-a/communications/1700000001-circular.pdf"), "circular"),
    );
  });
});

describe("FIN-000 · comprobantes de pago: cada residente con el suyo", () => {
  it("un residente sube su comprobante", async () => {
    await assertSucceeds(
      uploadString(ref(residente().storage(), "tenants/tenant-a/payment-receipts/resident-1/1700000002-pago.png"), "pago"),
    );
  });

  // Sin esta lectura la subida se rompe: el código pide la URL de descarga
  // inmediatamente después de subir, y getDownloadURL pasa por `allow read`.
  it("un residente lee su propio comprobante (lo exige getDownloadURL)", async () => {
    await assertSucceeds(getBytes(ref(residente().storage(), RECIBO_PROPIO)));
  });

  it("un residente NO lee el comprobante de su vecino", async () => {
    await assertFails(getBytes(ref(residente().storage(), RECIBO_VECINO)));
  });

  it("un residente NO escribe en la carpeta de su vecino", async () => {
    await assertFails(
      uploadString(ref(vecino().storage(), "tenants/tenant-a/payment-receipts/resident-1/intruso.png"), "no"),
    );
  });

  it("el admin lee el comprobante de cualquier residente", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), RECIBO_PROPIO)));
    await assertSucceeds(getBytes(ref(admin().storage(), RECIBO_VECINO)));
  });

  // Los comprobantes anteriores al cambio viven bajo el id de UNIDAD. Nadie los
  // reclama como propios, así que quedan para quien los revisa.
  it("el admin lee los comprobantes anteriores al cambio de ruta y el residente no", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), RECIBO_VIEJO)));
    await assertFails(getBytes(ref(residente().storage(), RECIBO_VIEJO)));
  });
});

describe("FIN-000 · notas de portería", () => {
  it("un guarda guarda y lee su nota de visitante", async () => {
    await assertSucceeds(
      uploadString(ref(guarda().storage(), "tenants/tenant-a/visitor-notes/pase-2/1700000003-foto.png"), "foto"),
    );
    await assertSucceeds(getBytes(ref(guarda().storage(), NOTA_PORTERIA)));
  });

  it("un guarda con el claim antiguo `security` también", async () => {
    await assertSucceeds(getBytes(ref(guardaAlias().storage(), NOTA_PORTERIA)));
  });

  it("un residente NO lee las notas de portería", async () => {
    await assertFails(getBytes(ref(residente().storage(), NOTA_PORTERIA)));
  });

  it("el admin lee las notas de portería", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), NOTA_PORTERIA)));
  });
});

// La carpeta que FIN-000 dejó anotada como trabajo aparte: era plana y abierta
// a todo el conjunto. Ahora va segmentada por quien sube, como los comprobantes.
describe("Soporte · evidencia segmentada por quien la sube", () => {
  it("quien sube adjunta bajo su uid y lee lo suyo (lo exige getDownloadURL)", async () => {
    await assertSucceeds(
      uploadString(ref(residente().storage(), "tenants/tenant-a/support/resident-1/1700000004-foto.png"), "evidencia"),
    );
    await assertSucceeds(getBytes(ref(residente().storage(), EVIDENCIA_PROPIA)));
  });

  it("NO lee la evidencia de otro miembro", async () => {
    await assertFails(getBytes(ref(residente().storage(), EVIDENCIA_AJENA)));
  });

  it("NO escribe bajo el uid de otro", async () => {
    await assertFails(
      uploadString(ref(vecino().storage(), "tenants/tenant-a/support/resident-1/intruso.png"), "no"),
    );
  });

  // El admin abre y responde los tickets del conjunto: lee todo support/,
  // incluida la evidencia que subió otra persona.
  it("el admin lee toda la evidencia del conjunto", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), EVIDENCIA_PROPIA)));
    await assertSucceeds(getBytes(ref(admin().storage(), EVIDENCIA_AJENA)));
  });

  it("el superadmin también — es quien atiende la bandeja", async () => {
    await assertSucceeds(getBytes(ref(superadmin().storage(), EVIDENCIA_AJENA)));
  });

  it("un admin de OTRO conjunto no lee esta evidencia", async () => {
    const adminB = testEnv.authenticatedContext("admin-2", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getBytes(ref(adminB.storage(), EVIDENCIA_PROPIA)));
  });

  // La evidencia anterior al cambio vive plana: el nombre del archivo cae en
  // el hueco del dueño y no es el uid de nadie. Queda solo para administración,
  // mismo criterio que los comprobantes viejos por unidad.
  it("la evidencia plana anterior al cambio queda solo para administración", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), EVIDENCIA_VIEJA)));
    await assertFails(getBytes(ref(residente().storage(), EVIDENCIA_VIEJA)));
  });

  it("y ya nadie puede subir plano, sin dueño en la ruta", async () => {
    await assertFails(
      uploadString(ref(residente().storage(), "tenants/tenant-a/support/1700000005-plano.png"), "plano"),
    );
  });
});

describe("FIN-000 · una carpeta que nadie declaró nace cerrada", () => {
  // Deliberado, y es lo contrario de lo que pasaba antes: la concesión ancha
  // hacía que cualquier carpeta nueva naciera abierta a todo el conjunto.
  it("ni siquiera el admin escribe en una carpeta fuera de las listas", async () => {
    await assertFails(
      uploadString(ref(admin().storage(), "tenants/tenant-a/inventada/otro.txt"), "sin declarar"),
    );
  });

  it("ni el admin la lee", async () => {
    await assertFails(getBytes(ref(admin().storage(), CARPETA_NO_DECLARADA)));
  });

  it("el superadmin tampoco — la lista manda sobre el rol", async () => {
    await assertFails(getBytes(ref(superadmin().storage(), CARPETA_NO_DECLARADA)));
  });
});

/**
 * **`PLAT-002` — el conjunto activo deja de ser el del claim.**
 *
 * Estas son las que faltaban, y su ausencia era el hallazgo: `storage.rules`
 * autorizaba por `request.auth.token.tenantId` y **ninguna prueba ejercía a un
 * administrador operando un conjunto distinto del de su token**. Como Firestore
 * ya resolvía por membresía, la pantalla parecía correcta y Storage denegaba
 * entero — documentos, comprobantes, portería y soporte.
 *
 * El claim de estas sesiones dice `tenant-a` A PROPÓSITO. Si alguien devuelve
 * `storage.rules` a mirar el token, estas cuatro se caen.
 */
describe("PLAT-002 · Storage resuelve por membresía, no por el claim", () => {
  it("un administrador con membresía en DOS conjuntos lee el segundo, aunque su claim diga el primero", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), TENANT_B_DOC)));
  });

  it("y también sus carpetas de dinero, que son solo de administración", async () => {
    await assertSucceeds(getBytes(ref(admin().storage(), CIERRE_B)));
  });

  it("y puede escribir en el segundo conjunto", async () => {
    await assertSucceeds(
      uploadString(ref(admin().storage(), "tenants/tenant-b/documents/subida-plat002.txt"), "acta nueva"),
    );
  });

  /**
   * **El rol NO viaja entre conjuntos.** `admin-viejo` lleva `admin_tenant` en
   * el token y administra `tenant-a`, pero en `tenant-b` su membresía dice
   * `resident`. Lee lo compartido y **no** lo financiero. Si el rol saliera del
   * token —como salía—, aquí entraría a la cartera de un conjunto que no
   * administra.
   */
  it("el rol sale de la membresía: administra A y en B es residente", async () => {
    await assertSucceeds(getBytes(ref(adminAlias().storage(), TENANT_B_DOC)));
    await assertFails(getBytes(ref(adminAlias().storage(), CIERRE_B)));
  });

  /**
   * El gemelo obligatorio: sin membresía sigue sin haber acceso. Sin esta, una
   * regla que concediera a todo el mundo pasaría las tres de arriba en verde.
   */
  it("sin membresía en el conjunto no hay acceso, aunque el claim lo diga", async () => {
    const impostor = testEnv.authenticatedContext("guard-1", { role: "tenant_admin", tenantId: "tenant-b" });
    await assertFails(getBytes(ref(impostor.storage(), TENANT_B_DOC)));
    await assertFails(getBytes(ref(impostor.storage(), CIERRE_B)));
  });
});
