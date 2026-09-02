import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Chip cerrado el 2 sep 2026: `email.ts` tenía la base de producción CLAVADA
 * (`https://www.grupovivaru.com`) y los correos de staging enlazaban a producción.
 * Es el gemelo del defecto que el push tuvo hasta el 29 ago; ahora los dos usan
 * `enlaceAbsoluto`, que decide la base por el proyecto en que corre la función.
 *
 * Se prueba por el CUERPO que sale hacia Resend, no leyendo el fichero: `fetch`
 * se sustituye antes de importar el módulo porque `email.ts` lo captura al cargar.
 */

type Llamada = { url: string; body: string };

const STAGING = "https://vivaru-staging-web--vivaru-staging-02.us-central1.hosted.app";
const PRODUCCION = "https://www.grupovivaru.com";

function stubFetch(llamadas: Llamada[]) {
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    llamadas.push({ url, body: init.body });
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "re_123" }) };
  });
}

function enlacesDelCuerpo(body: string): string[] {
  const html = (JSON.parse(body) as { html: string }).html;
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

describe("los correos enlazan al ambiente en que corre la función", () => {
  const llamadas: Llamada[] = [];

  beforeEach(() => {
    llamadas.length = 0;
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    stubFetch(llamadas);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("notificación en STAGING: el CTA va al host de staging, no a producción", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "vivaru-staging-02");
    const { sendNotificationEmail } = await import("../src/email");
    await sendNotificationEmail({ to: "a@ejemplo.vivaru.app", subject: "x", body: "y", link: "/resident/pqrs" });
    expect(llamadas).toHaveLength(1);
    expect(enlacesDelCuerpo(llamadas[0].body)).toContain(`${STAGING}/resident/pqrs`);
    expect(llamadas[0].body).not.toContain(PRODUCCION + "/resident");
  });

  it("notificación en PRODUCCIÓN: el CTA va a grupovivaru.com", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "hogaru-1");
    const { sendNotificationEmail } = await import("../src/email");
    await sendNotificationEmail({ to: "a@ejemplo.vivaru.app", subject: "x", body: "y", link: "/resident/pqrs" });
    expect(enlacesDelCuerpo(llamadas[0].body)).toContain(`${PRODUCCION}/resident/pqrs`);
  });

  it("correo de acceso en STAGING: un enlace propio (/activar) se prefija con staging", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "vivaru-staging-02");
    const { sendAccountEmail } = await import("../src/email");
    await sendAccountEmail({ to: "a@ejemplo.vivaru.app", fullName: "Ana", link: "/activar?token=t", variant: "welcome" });
    expect(enlacesDelCuerpo(llamadas[0].body)).toContain(`${STAGING}/activar?token=t`);
  });

  it("un enlace ya absoluto (los de Firebase Auth) no se toca en ningún ambiente", async () => {
    vi.stubEnv("GCLOUD_PROJECT", "vivaru-staging-02");
    const { sendAccountEmail } = await import("../src/email");
    await sendAccountEmail({ to: "a@ejemplo.vivaru.app", fullName: "Ana", link: "https://auth.example/x", variant: "reset" });
    expect(enlacesDelCuerpo(llamadas[0].body)).toContain("https://auth.example/x");
  });
});
