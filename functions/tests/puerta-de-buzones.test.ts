import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `PRD-V-PLAT-006` · la puerta de SALIDA. `CA5`, `CA6`, `CA7` y `RN-2`/`RN-4`.
 *
 * **Se prueba por el cuerpo que sale hacia Resend**, no leyendo el fichero: `fetch` se sustituye
 * ANTES de importar el módulo porque `email.ts` lo captura al cargar. Es el patrón de
 * `email-enlace-del-ambiente.test.ts`, que ya cerró un defecto de este mismo módulo.
 *
 * **Y se prueba la cadena entera** —`email.ts` → `buzones-admisibles.ts` → `feature-flags.ts`—
 * contra un doble de Firestore, no cada pieza por su lado. La razón está medida: `CF8` enseñó que
 * una pieza correcta puede colgar de una comprobación que nadie hace, y el 2 sep un guardián pasó
 * en verde vigilando un conjunto vacío. Aquí la afirmación es «no sale el correo», que es lo que
 * le importa a quien lo recibiría.
 */

type Llamada = { url: string; body: string };
type Doc = Record<string, unknown> | undefined;

const MARCADO = "tenant-sin-cliente";
const CON_CLIENTE = "tenant-de-un-cliente";

/** Lo que hay en la base para cada caso. La clave es `coleccion/documento`. */
let base: Record<string, Doc> = {};
/** Lo que se ha escrito en `emailDeliveries` durante la prueba. */
let escrituras: Record<string, unknown>[] = [];

function snap(ruta: string) {
  return { exists: base[ruta] !== undefined, data: () => base[ruta] };
}

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => ({ __ts: true }), fromMillis: (m: number) => ({ __ts: m }) },
  getFirestore: () => ({
    collection: (col: string) => ({
      doc: (id: string) => ({ __ruta: `${col}/${id}`, get: async () => snap(`${col}/${id}`) }),
      add: async (data: Record<string, unknown>) => {
        escrituras.push({ __col: col, ...data });
        return { id: "generado" };
      },
    }),
    getAll: async (...refs: { __ruta: string }[]) => refs.map((r) => snap(r.__ruta)),
  }),
}));

function stubFetch(llamadas: Llamada[]) {
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    llamadas.push({ url, body: init.body });
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "re_123" }) };
  });
}

/** El estado por defecto: la puerta ENCENDIDA y un conjunto marcado. */
function conLaPuertaEncendida(equipo: { dominios?: string[]; direcciones?: string[] } = {}) {
  base = {
    "featureFlags/_global": {},
    "featureFlags/producto-puerta-de-buzones": { enabled: true },
    [`tenants/${MARCADO}`]: { sinClienteDetras: true, isExample: true },
    [`tenants/${CON_CLIENTE}`]: { isExample: true },
    "config/correosDelEquipo": { dominios: equipo.dominios ?? [], direcciones: equipo.direcciones ?? [] },
  };
}

describe("PLAT-006 · la puerta de buzones en la salida", () => {
  const llamadas: Llamada[] = [];

  beforeEach(() => {
    llamadas.length = 0;
    escrituras = [];
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("GCLOUD_PROJECT", "hogaru-1");
    stubFetch(llamadas);
    conLaPuertaEncendida();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const enviar = async (extra: Record<string, unknown>) => {
    const { sendNotificationEmail } = await import("../src/email");
    return sendNotificationEmail({
      to: "alguien@gmail.com",
      subject: "aviso de cuota",
      body: "y",
      link: "/resident/cartera",
      ...extra,
    });
  };

  // ── CA5 ──────────────────────────────────────────────────────────────────
  it("CA5 · conjunto marcado + dirección no admisible: NO sale, y deja fila `rechazado-puerta`", async () => {
    const id = await enviar({ tenantId: MARCADO });

    expect(llamadas).toHaveLength(0); // cero llamadas a Resend: no salió
    expect(id).toBeNull();
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toMatchObject({
      __col: "emailDeliveries",
      tenantId: MARCADO,
      recipientEmail: "alguien@gmail.com",
      status: "rechazado-puerta",
    });
    // `RN-4`: la fila lleva MOTIVO. Sin él, quien la lea no sabe qué corregir.
    expect(escrituras[0].motivo).toBeTruthy();
  });

  it("CA5 · el rechazo deja fila AUNQUE `producto-entrega-de-correo` esté apagada", async () => {
    // La bandera del rastro de entrega está apagada (no aparece en `base`, y su
    // default de catálogo es `false`). Un envío aceptado no dejaría fila; un
    // RECHAZO sí, porque rechazar en silencio es peor que enviar (`RN-4`).
    await enviar({ tenantId: MARCADO });
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].status).toBe("rechazado-puerta");
  });

  // ── CA2 en la salida: lo inerte pasa ─────────────────────────────────────
  it("una dirección de dominio inerte SÍ sale del conjunto marcado", async () => {
    await enviar({ tenantId: MARCADO, to: "ejemplo.t1-101@ejemplo.vivaru.app" });
    expect(llamadas).toHaveLength(1);
    expect(escrituras).toHaveLength(0);
  });

  // ── CA3 · la lista del equipo, y el `+alias` que NO se normaliza ─────────
  it("CA3 · un dominio del equipo pasa", async () => {
    conLaPuertaEncendida({ dominios: ["qintilab.com"] });
    await enviar({ tenantId: MARCADO, to: "dev@qintilab.com" });
    expect(llamadas).toHaveLength(1);
  });

  it("CA3 · una dirección exacta de la lista pasa, y su `+alias` NO listado NO pasa", async () => {
    conLaPuertaEncendida({ direcciones: ["david.macar.18@hotmail.com"] });

    await enviar({ tenantId: MARCADO, to: "david.macar.18@hotmail.com" });
    expect(llamadas).toHaveLength(1);

    // El mismo buzón con alias: si bastara con quitar el `+…`, una dirección
    // listada abriría una familia infinita de direcciones admitidas.
    await enviar({ tenantId: MARCADO, to: "david.macar.18+res1@hotmail.com" });
    expect(llamadas).toHaveLength(1); // sigue habiendo UNA sola: la segunda no salió
  });

  it("la comparación no distingue mayúsculas", async () => {
    conLaPuertaEncendida({ direcciones: ["caro_ap_03@outlook.com"] });
    await enviar({ tenantId: MARCADO, to: "Caro_AP_03@Outlook.com" });
    expect(llamadas).toHaveLength(1);
  });

  // ── CA6 · la bandera es el freno de verdad ───────────────────────────────
  it("CA6 · con la bandera APAGADA el mismo envío SALE", async () => {
    base["featureFlags/producto-puerta-de-buzones"] = { enabled: false };
    await enviar({ tenantId: MARCADO });
    expect(llamadas).toHaveLength(1);
    expect(escrituras).toHaveLength(0);
  });

  it("CA6 · el override POR CONJUNTO manda sobre la global (la vía del canario)", async () => {
    base["featureFlags/producto-puerta-de-buzones"] = { enabled: false };
    base[`featureFlagOverrides/${MARCADO}`] = { flags: { "producto-puerta-de-buzones": true } };
    await enviar({ tenantId: MARCADO });
    expect(llamadas).toHaveLength(0);
  });

  // ── CA7 · un conjunto no marcado no se toca ──────────────────────────────
  it("CA7 · conjunto SIN la marca: sale aunque la bandera esté encendida", async () => {
    await enviar({ tenantId: CON_CLIENTE });
    expect(llamadas).toHaveLength(1);
  });

  it("CA7 · `isExample` NO marca: el conjunto de trial tiene `isExample` y su correo sale", async () => {
    // El prospecto del trial se registra con su correo real por diseño. Si la
    // puerta derivara la marca de `isExample`, esto no saldría — y era el
    // criterio que traía el chip.
    expect(base[`tenants/${CON_CLIENTE}`]).toMatchObject({ isExample: true });
    await enviar({ tenantId: CON_CLIENTE, to: "prospecto@gmail.com" });
    expect(llamadas).toHaveLength(1);
  });

  // ── El correo interno de Vivaru no pasa por la puerta ────────────────────
  it("un envío SIN conjunto (las bandejas de Vivaru) no pasa por la puerta", async () => {
    // `notifyInbox`, `supportInbox` y comercial: cuatro de los ocho envíos. Si la
    // puerta fuese ciega a la dirección, los avisos de trial se cortarían el día
    // que alguien tocara la lista del equipo.
    await enviar({ to: "comercial@qintilab.com" });
    expect(llamadas).toHaveLength(1);
  });

  // ── El correo de cuenta, que es el más peligroso ─────────────────────────
  it("el correo de ACCESO a un conjunto marcado no sale y deja fila", async () => {
    const { sendAccountEmail } = await import("../src/email");
    await sendAccountEmail({
      to: "medi.paty@gmail.com",
      fullName: "Patricia",
      link: "/activar?token=t",
      variant: "welcome",
      tenantId: MARCADO,
    });
    expect(llamadas).toHaveLength(0);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toMatchObject({ status: "rechazado-puerta", notificationKey: "cuenta" });
  });

  it("el correo de ACCESO sin conjunto sigue saliendo (no se rompe lo que ya andaba)", async () => {
    const { sendAccountEmail } = await import("../src/email");
    await sendAccountEmail({ to: "a@ejemplo.vivaru.app", fullName: "Ana", link: "/activar?token=t", variant: "welcome" });
    expect(llamadas).toHaveLength(1);
  });

  // ── `RN-5` · la puerta no rompe la operación que la disparó ──────────────
  it("RN-5 · un rechazo NO lanza: devuelve null y quien llamó sigue su curso", async () => {
    await expect(enviar({ tenantId: MARCADO })).resolves.toBeNull();
  });
});
