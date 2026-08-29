import { afterEach, describe, expect, it, vi } from "vitest";

import { enlaceAbsoluto, esTokenMuerto } from "../src/push";
import { FEATURE_FLAG_DEFAULTS } from "../src/feature-flags";

/**
 * Las partes puras del emisor de Web Push (PRD-V-PLAT-005). El envío real es
 * 📱 (CA1/CA5) y no lo alcanza ninguna suite; lo que sí se vigila aquí es lo
 * que decide sin red: el enlace que FCM exige absoluto, qué código purga un
 * token, y que la bandera exista y nazca apagada.
 */

describe("enlaceAbsoluto — fcmOptions.link exige URL absoluta", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("en el proyecto de staging la base es el host de staging — con la de producción, el toque salía de la app instalada", () => {
    vi.stubEnv("GCLOUD_PROJECT", "vivaru-staging-02");
    expect(enlaceAbsoluto("/resident/communications")).toBe(
      "https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app/resident/communications",
    );
  });

  it("en producción (y sin proyecto declarado) la base es grupovivaru.com", () => {
    vi.stubEnv("GCLOUD_PROJECT", "hogaru-1");
    expect(enlaceAbsoluto("/resident/pqrs")).toBe("https://www.grupovivaru.com/resident/pqrs");
  });

  it("una ruta del catálogo se vuelve absoluta", () => {
    expect(enlaceAbsoluto("/resident/pqrs")).toBe("https://www.grupovivaru.com/resident/pqrs");
  });

  it("una URL ya absoluta no se toca", () => {
    expect(enlaceAbsoluto("https://otro.example/x")).toBe("https://otro.example/x");
  });

  it("sin link se cae a la raíz del producto, nunca a undefined", () => {
    expect(enlaceAbsoluto(null)).toBe("https://www.grupovivaru.com");
    expect(enlaceAbsoluto(undefined)).toBe("https://www.grupovivaru.com");
    expect(enlaceAbsoluto("")).toBe("https://www.grupovivaru.com");
  });
});

describe("esTokenMuerto — qué respuesta de FCM purga el documento", () => {
  it("los tres códigos de token muerto purgan", () => {
    expect(esTokenMuerto("messaging/registration-token-not-registered")).toBe(true);
    expect(esTokenMuerto("messaging/invalid-registration-token")).toBe(true);
    expect(esTokenMuerto("messaging/invalid-argument")).toBe(true);
  });

  it("un fallo transitorio NO purga: borrar por un 500 sería matar dispositivos vivos", () => {
    expect(esTokenMuerto("messaging/internal-error")).toBe(false);
    expect(esTokenMuerto("messaging/server-unavailable")).toBe(false);
    expect(esTokenMuerto("messaging/quota-exceeded")).toBe(false);
    expect(esTokenMuerto(undefined)).toBe(false);
  });
});

describe("la bandera del canal", () => {
  it("existe en el catálogo del servidor y NACE APAGADA", () => {
    expect(FEATURE_FLAG_DEFAULTS["producto-notificaciones-push"]).toBe(false);
  });
});
