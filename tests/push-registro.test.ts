import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAG_CATALOG } from "@/lib/feature-flags/catalog";
import {
  TOPE_DE_DISPOSITIVOS,
  estadoDeSoportePush,
  plataformaActual,
} from "@/lib/push/registro";

/**
 * El detector de soporte de Web Push (PRD-V-PLAT-005 §5). Es la pieza con más
 * ramas del registro y la única que decide QUÉ invitación ve el residente: en
 * iOS sin instalar el permiso ni existe, así que enseñar «Activar» ahí sería
 * un botón que no hace nada — la clase de defecto que este producto ya tuvo.
 */

const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const UA_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

function finge(opts: {
  ua: string;
  maxTouchPoints?: number;
  pushApi?: boolean;
  permiso?: NotificationPermission;
  standalone?: boolean;
}) {
  const navegador: Record<string, unknown> = {
    userAgent: opts.ua,
    maxTouchPoints: opts.maxTouchPoints ?? 0,
  };
  const ventana: Record<string, unknown> = {
    matchMedia: () => ({ matches: opts.standalone ?? false }),
  };
  if (opts.pushApi) {
    navegador.serviceWorker = {};
    ventana.PushManager = class {};
    ventana.Notification = { permission: opts.permiso ?? "default" };
    vi.stubGlobal("Notification", { permission: opts.permiso ?? "default" });
  }
  vi.stubGlobal("navigator", navegador);
  vi.stubGlobal("window", ventana);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("estadoDeSoportePush — los tres mundos de §5", () => {
  it("sin window (SSR) responde sin-soporte y no revienta", () => {
    // No se finge nada: el entorno node ES el caso.
    expect(estadoDeSoportePush()).toBe("sin-soporte");
  });

  it("iPhone en Safari sin instalar → ios-sin-instalar (el paso es añadir a inicio)", () => {
    finge({ ua: UA_IPHONE, pushApi: false });
    expect(estadoDeSoportePush()).toBe("ios-sin-instalar");
  });

  it("iPadOS disfrazado de Mac lo delata el táctil", () => {
    finge({ ua: UA_MAC, maxTouchPoints: 5, pushApi: false });
    expect(estadoDeSoportePush()).toBe("ios-sin-instalar");
  });

  it("un Mac de verdad sin Push API es sin-soporte, no ios-sin-instalar", () => {
    finge({ ua: UA_MAC, maxTouchPoints: 0, pushApi: false });
    expect(estadoDeSoportePush()).toBe("sin-soporte");
  });

  it("iPhone YA instalado con Push API → soportado", () => {
    finge({ ua: UA_IPHONE, pushApi: true, standalone: true });
    expect(estadoDeSoportePush()).toBe("soportado");
  });

  it("Android con Push API → soportado", () => {
    finge({ ua: UA_ANDROID, pushApi: true });
    expect(estadoDeSoportePush()).toBe("soportado");
  });

  it("R5 · permiso denegado → denegado, que la invitación traduce en NO insistir", () => {
    finge({ ua: UA_ANDROID, pushApi: true, permiso: "denied" });
    expect(estadoDeSoportePush()).toBe("denegado");
  });
});

describe("plataformaActual — el campo platform del documento", () => {
  it("distingue android, ios y desktop", () => {
    finge({ ua: UA_ANDROID });
    expect(plataformaActual()).toBe("android");
    finge({ ua: UA_IPHONE });
    expect(plataformaActual()).toBe("ios");
    finge({ ua: UA_MAC });
    expect(plataformaActual()).toBe("desktop");
  });
});

describe("la bandera y el tope, contra la ficha", () => {
  it("producto-notificaciones-push existe en el catálogo del front y NACE APAGADA", () => {
    const ficha = FEATURE_FLAG_CATALOG["producto-notificaciones-push"];
    expect(ficha.defaultEnabled).toBe(false);
    expect(ficha.area).toBe("producto");
  });

  it("D1 · el tope es 5", () => {
    expect(TOPE_DE_DISPOSITIVOS).toBe(5);
  });
});
