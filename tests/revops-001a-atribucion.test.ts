import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  atribucionSchema,
  capturarAtribucion,
  leerAtribucion,
} from "@/lib/marketing/attribution";
import {
  POLITICA_VERSION,
  consentimientoSchema,
  registrarConsentimiento,
} from "@/lib/marketing/lead-consent";

/**
 * `REVOPS-001A` — atribución y consentimiento del lead.
 *
 * Lo que estas pruebas defienden es un dato que NO se reconstruye: un lead que
 * entra sin saber de dónde vino no se atribuye nunca después.
 */

// ── Doble de sessionStorage y de location, que en Node no existen ────────────
function montarNavegador(url: string, referrer = "") {
  const almacen = new Map<string, string>();
  const parsed = new URL(url);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        search: parsed.search,
        pathname: parsed.pathname,
        origin: parsed.origin,
      },
      sessionStorage: {
        getItem: (k: string) => almacen.get(k) ?? null,
        setItem: (k: string, v: string) => void almacen.set(k, v),
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { referrer },
  });
  return almacen;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
});

describe("REVOPS-001A · captura de atribución", () => {
  it("captura los cinco utm_*, el referrer y la ruta de aterrizaje", () => {
    montarNavegador(
      "https://grupovivaru.com/diagnostico?utm_source=google&utm_medium=cpc&utm_campaign=lanzamiento&utm_content=anuncio-a&utm_term=software+conjuntos",
      "https://www.google.com/",
    );
    capturarAtribucion();
    const a = leerAtribucion();

    expect(a?.utm_source).toBe("google");
    expect(a?.utm_medium).toBe("cpc");
    expect(a?.utm_campaign).toBe("lanzamiento");
    expect(a?.utm_content).toBe("anuncio-a");
    expect(a?.utm_term).toBe("software conjuntos");
    expect(a?.referrer).toBe("https://www.google.com/");
    expect(a?.landing).toBe("/diagnostico");
    expect(a?.capturedAt).toBeTruthy();
  });

  // El motivo entero de capturar al ENTRAR y no al enviar el formulario.
  it("la primera visita gana: navegar por el sitio no borra el origen", () => {
    montarNavegador(
      "https://grupovivaru.com/?utm_source=google&utm_campaign=lanzamiento",
      "https://www.google.com/",
    );
    capturarAtribucion();

    // La persona navega a /diagnostico: ya no hay utm_* y el referrer es propio.
    const almacen = leerAtribucion();
    montarNavegadorReusando(almacen);
    capturarAtribucion();

    expect(leerAtribucion()?.utm_source).toBe("google");
    expect(leerAtribucion()?.utm_campaign).toBe("lanzamiento");
  });

  it("un referrer de nuestro propio dominio NO cuenta como origen", () => {
    montarNavegador(
      "https://grupovivaru.com/diagnostico",
      "https://grupovivaru.com/precios",
    );
    capturarAtribucion();
    expect(leerAtribucion()?.referrer).toBeUndefined();
  });

  it("tráfico directo: sin utm_* y sin referrer sigue guardando la ruta", () => {
    montarNavegador("https://grupovivaru.com/", "");
    capturarAtribucion();
    const a = leerAtribucion();
    expect(a?.landing).toBe("/");
    expect(a?.utm_source).toBeUndefined();
    expect(a?.referrer).toBeUndefined();
  });

  it("recorta valores desmesurados en vez de guardarlos enteros", () => {
    montarNavegador(`https://grupovivaru.com/?utm_source=${"x".repeat(5000)}`);
    capturarAtribucion();
    expect(leerAtribucion()!.utm_source!.length).toBe(200);
  });

  it("sin navegador (render en servidor) no lanza ni inventa nada", () => {
    expect(() => capturarAtribucion()).not.toThrow();
    expect(leerAtribucion()).toBeUndefined();
  });
});

describe("REVOPS-001A · el esquema que valida el servidor", () => {
  it("acepta que no venga atribución — el tráfico directo también es un lead", () => {
    expect(atribucionSchema.safeParse(undefined).success).toBe(true);
  });

  it("rechaza un utm_* que excede el tope", () => {
    const r = atribucionSchema.safeParse({ utm_source: "x".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("acepta una atribución completa", () => {
    const r = atribucionSchema.safeParse({
      utm_source: "google",
      utm_medium: "cpc",
      referrer: "https://www.google.com/",
      landing: "/",
    });
    expect(r.success).toBe(true);
  });
});

describe("REVOPS-001A · consentimiento", () => {
  it("rechaza false y rechaza que falte: sin autorización no hay lead", () => {
    expect(consentimientoSchema.safeParse(false).success).toBe(false);
    expect(consentimientoSchema.safeParse(undefined).success).toBe(false);
    expect(consentimientoSchema.safeParse(true).success).toBe(true);
  });

  it("el registro lleva fecha, versión de la política y cómo se dio", () => {
    const c = registrarConsentimiento(new Date("2026-08-18T12:00:00.000Z"));
    expect(c.granted).toBe(true);
    expect(c.at).toBe("2026-08-18T12:00:00.000Z");
    expect(c.policyVersion).toBe(POLITICA_VERSION);
    expect(c.method).toBe("explicit_checkbox");
  });

  // La fecha la pone el servidor: el reloj del cliente lo controla quien envía.
  it("la fecha no viene del cliente", () => {
    const antes = Date.now();
    const c = registrarConsentimiento();
    expect(new Date(c.at).getTime()).toBeGreaterThanOrEqual(antes);
  });
});

/** Rehace el navegador conservando lo ya guardado, simulando navegación interna. */
function montarNavegadorReusando(previo: unknown) {
  const almacen = new Map<string, string>();
  if (previo) almacen.set("vivaru.attribution", JSON.stringify(previo));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        search: "",
        pathname: "/diagnostico",
        origin: "https://grupovivaru.com",
      },
      sessionStorage: {
        getItem: (k: string) => almacen.get(k) ?? null,
        setItem: (k: string, v: string) => void almacen.set(k, v),
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { referrer: "https://grupovivaru.com/" },
  });
}
