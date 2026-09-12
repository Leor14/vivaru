import { describe, expect, it } from "vitest";

import { entradaDelHilo, prefijoDeAdjuntos } from "../src/support";

/**
 * `PRD-V-FIX-005` · H3c / R4 — la ruta de un adjunto del equipo no lleva su uid.
 *
 * La tercera vía al uid del equipo: un adjunto se subía a `tenants/{t}/support/{uid}/…` y esa
 * ruta —y su `url`, que la lleva codificada— viajaba en el hilo que el administrador del conjunto
 * lee entero. Decisión de David del 11 sep (opción A): el equipo sube a una carpeta neutra,
 * `support/equipo/…`. El cliente sigue bajo su propio uid, que es suyo.
 */

const UID = "uid-equipo-fix005";

describe("FIX-005 · H3c · la carpeta de los adjuntos", () => {
  it("el equipo sube a support/equipo/, sin su uid", () => {
    expect(prefijoDeAdjuntos("t-1", UID, true)).toBe("tenants/t-1/support/equipo/");
  });

  it("el cliente sigue bajo su propio uid", () => {
    expect(prefijoDeAdjuntos("t-1", "uid-cliente", false)).toBe("tenants/t-1/support/uid-cliente/");
  });

  it("CF6 · una respuesta del equipo con adjunto no lleva el uid en ningún campo, url incluida", () => {
    const path = `${prefijoDeAdjuntos("t-1", UID, true)}1726100000000-captura.png`;
    const entrada = entradaDelHilo({
      esVivaru: true,
      uid: UID,
      autorNombre: "Equipo Vivaru",
      nowIso: "2026-09-12T02:00:00.000Z",
      id: "m3",
      message: "Mira la captura",
      adjuntos: [
        {
          name: "captura.png",
          path,
          url: `https://firebasestorage.googleapis.com/v0/b/x/o/${encodeURIComponent(path)}?alt=media&token=abc`,
          size: 10,
          contentType: "image/png",
        },
      ],
    });
    expect(JSON.stringify(entrada)).not.toContain(UID);
  });
});
