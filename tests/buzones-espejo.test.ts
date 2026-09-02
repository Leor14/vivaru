import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DOMINIOS_INERTES,
  MENSAJE_PUERTA,
  MOTIVO_RECHAZO,
  dominioDe,
  esDominioInerte,
  laPuertaExplicaElRechazo,
} from "@/lib/buzones/admisibles";

/**
 * `PRD-V-PLAT-006` `CA1` · **el espejo de la puerta de buzones, vigilado.**
 *
 * `src/lib/buzones/admisibles.ts` copia a mano el catálogo de dominios inertes y el motivo que
 * decide `functions/src/buzones-admisibles.ts`, porque `src/` no puede importar de `functions/`
 * sin romper el build de App Hosting. Es el mismo trato que `conceptos-de-cargo` y el catálogo de
 * avisos, y **el daño de copiar nunca fue la copia: fue que nada avisara al quedarse atrás**.
 *
 * Esta prueba LEE el fichero de `functions/` como texto. Leer no es importar —no entra en el grafo
 * de módulos del build—, así que la prohibición de CLAUDE.md no aplica.
 */

const FUENTE = path.resolve("functions/src/buzones-admisibles.ts");
const leerFuente = () => fs.readFileSync(FUENTE, "utf8");

/** Saca una lista de cadenas de un literal `[...]` del fichero, por el nombre de su constante. */
function listaDeLaFuente(texto: string, constante: string): string[] {
  const m = new RegExp(`${constante}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(texto);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("PLAT-006 · el espejo del front no diverge del servidor", () => {
  it("los dominios inertes son los mismos, y en el mismo orden", () => {
    expect(listaDeLaFuente(leerFuente(), "DOMINIOS_INERTES")).toEqual([...DOMINIOS_INERTES]);
  });

  it("el motivo del servidor está DENTRO del mensaje que ve quien teclea", () => {
    // El front añade qué hacer; el servidor no lo dice porque su texto también lo
    // lee una máquina. Lo que no puede es contradecirlo.
    const m = /MOTIVO_RECHAZO\s*=\s*\n?\s*"([^"]+)"/.exec(leerFuente());
    expect(m, "no se encontró MOTIVO_RECHAZO en el servidor").toBeTruthy();
    expect(MOTIVO_RECHAZO).toBe(m![1]);
    expect(MENSAJE_PUERTA).toContain(MOTIVO_RECHAZO);
  });

  it("CONTROL · el extractor lee de verdad el fichero del servidor", () => {
    // Sin esto, un renombrado haría que los dos casos de arriba comparasen `[]`
    // con `[]` y una cadena vacía, y pasarían en verde vigilando nada.
    const texto = leerFuente();
    expect(texto.length).toBeGreaterThan(1000);
    expect(listaDeLaFuente(texto, "DOMINIOS_INERTES").length).toBeGreaterThanOrEqual(4);
    expect(texto).toContain("export const MOTIVO_RECHAZO");
  });
});

describe("PLAT-006 · cuándo la puerta explica un `permission-denied`", () => {
  const base = { conjuntoMarcado: true, puertaEncendida: true, email: "alguien@gmail.com" };

  it("explica cuando el conjunto está marcado, la puerta encendida y el correo no es inerte", () => {
    expect(laPuertaExplicaElRechazo(base)).toBe(true);
  });

  it("NO explica si el conjunto no está marcado", () => {
    expect(laPuertaExplicaElRechazo({ ...base, conjuntoMarcado: false })).toBe(false);
  });

  it("NO explica si la bandera está apagada", () => {
    expect(laPuertaExplicaElRechazo({ ...base, puertaEncendida: false })).toBe(false);
  });

  it("NO explica si el correo es de dominio inerte — ahí el rechazo es de otra cosa", () => {
    // Es la mitad que evita mandar a quien lee a arreglar lo que no está roto.
    expect(laPuertaExplicaElRechazo({ ...base, email: "x@ejemplo.vivaru.app" })).toBe(false);
    expect(laPuertaExplicaElRechazo({ ...base, email: "x@demo.co" })).toBe(false);
  });

  it("un subdominio de uno inerte también es inerte", () => {
    expect(laPuertaExplicaElRechazo({ ...base, email: "x@sub.ejemplo.vivaru.app" })).toBe(false);
  });

  it("sin correo no explica nada", () => {
    expect(laPuertaExplicaElRechazo({ ...base, email: null })).toBe(true);
    // `null` no es inerte, así que sí «explica» — y es correcto: una escritura sin
    // correo que la puerta rechace no existe, porque la regla la deja pasar. El
    // llamador nunca llega aquí en ese caso.
  });
});

describe("PLAT-006 · el troceo del correo", () => {
  it("saca el dominio en minúsculas", () => {
    expect(dominioDe("Alguien@GMAIL.com")).toBe("gmail.com");
  });

  it("usa la ÚLTIMA arroba, que es la que separa el dominio", () => {
    expect(dominioDe("raro@cosa@gmail.com")).toBe("gmail.com");
  });

  it("devuelve null en lo que no es una dirección", () => {
    for (const x of ["", "sin-arroba", "@solodominio", "local@", null, undefined]) {
      expect(dominioDe(x as string)).toBeNull();
    }
  });

  it("y un dominio nulo nunca es inerte", () => {
    expect(esDominioInerte(null)).toBe(false);
  });
});

describe("PLAT-006 · el mensaje LLEGA A LA PANTALLA (lo que faltó en agosto)", () => {
  /**
   * **Esta es la prueba que el defecto de agosto no tenía.** Aquel decía: «las pruebas comprueban
   * que el servidor lanza el error correcto, y nadie miraba qué se pintaba». Aquí se mira lo que
   * se pinta, que es lo único que le importa a quien teclea.
   *
   * Estuvo a punto de repetirse idéntico: la traducción de la puerta lanzaba un `Error` plano, y
   * `normalizeFirebaseError` lo habría convertido en «Ocurrió un error inesperado».
   */
  it("un `ErrorParaElUsuario` con el motivo se pinta TAL CUAL", async () => {
    const { ErrorParaElUsuario, normalizeFirebaseError } = await import("@/lib/utils/error-handler");
    expect(normalizeFirebaseError(new ErrorParaElUsuario(MENSAJE_PUERTA))).toBe(MENSAJE_PUERTA);
    expect(normalizeFirebaseError(new ErrorParaElUsuario(MENSAJE_PUERTA))).toContain(MOTIVO_RECHAZO);
  });

  it("CONTROL · un `Error` plano con el mismo texto NO se pinta: cae en el genérico", async () => {
    // Sin este control, la prueba de arriba pasaría también con la comprobación
    // estrecha de `CallableError` — y el mensaje se perdería en producción.
    const { normalizeFirebaseError } = await import("@/lib/utils/error-handler");
    const pintado = normalizeFirebaseError(new Error(MENSAJE_PUERTA));
    expect(pintado).not.toContain(MOTIVO_RECHAZO);
    expect(pintado).toBe("Ocurrió un error inesperado. Intenta de nuevo.");
  });

  it("un `CallableError` sigue funcionando como antes (no se rompió lo que ya andaba)", async () => {
    const { CallableError, normalizeFirebaseError } = await import("@/lib/utils/error-handler");
    expect(normalizeFirebaseError(new CallableError("Ese cruce ya se deshizo."))).toBe("Ese cruce ya se deshizo.");
  });

  it("y un `permission-denied` sin traducir sigue dando el genérico de permiso", async () => {
    const { normalizeFirebaseError } = await import("@/lib/utils/error-handler");
    expect(normalizeFirebaseError({ code: "permission-denied" })).toBe("No tienes permiso para realizar esta acción.");
  });
});

describe("PLAT-006 · el guardián del emisor: quién LANZA el mensaje", () => {
  /**
   * **Este guardián existe porque una falsación pasó en verde y no era mala.** Al reponer
   * `throw new Error(motivo)` en `services.ts`, las pruebas de arriba siguieron verdes: comprueban
   * que `normalizeFirebaseError` respeta el tipo correcto, pero **ninguna miraba que el emisor lo
   * usara**. Es el mismo hueco que dejó vivo el defecto de agosto, un escalón más arriba.
   *
   * Barre el fichero en vez de fiarse de una lista: la lista envejece y el barrido no.
   */
  const FUENTE_SERVICES = path.resolve("src/features/admin/services.ts");

  it("la traducción de la puerta lanza `ErrorParaElUsuario`, nunca un `Error` plano", () => {
    const texto = fs.readFileSync(FUENTE_SERVICES, "utf8");
    // Los lanzamientos que llevan el motivo de la puerta, sea cual sea su forma.
    const conMotivo = [...texto.matchAll(/throw new (\w+)\(\s*\n?\s*[`"']?\$?\{?motivo/g)].map((m) => m[1]);
    expect(conMotivo.length, "no se encontró ningún lanzamiento con el motivo").toBeGreaterThanOrEqual(2);
    expect([...new Set(conMotivo)]).toEqual(["ErrorParaElUsuario"]);
  });

  it("CONTROL · el barrido encuentra de verdad los lanzamientos que dice vigilar", () => {
    // Si la expresión dejara de cazarlos, el caso de arriba compararía [] con
    // [\"ErrorParaElUsuario\"] y fallaría — pero el `toBeGreaterThanOrEqual` de
    // arriba ya lo cubre. Esto fija además que el fichero es el que se cree.
    const texto = fs.readFileSync(FUENTE_SERVICES, "utf8");
    expect(texto).toContain("motivoDeLaPuertaDeBuzones");
    expect(texto).toContain("conMotivoDeLaPuerta");
  });
});
