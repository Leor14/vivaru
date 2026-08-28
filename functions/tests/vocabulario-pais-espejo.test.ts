import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { terminoCoeficiente, terminoCopropiedad, terminoCuotaMensual } from "../src/vocabulario-pais";

/**
 * **El vocabulario de país vive DUPLICADO, y hasta hoy nada vigilaba las copias.**
 *
 * `src/lib/config/vocabulario-pais.ts` es el canónico —lo que ve el
 * administrador en pantalla— y `functions/src/vocabulario-pais.ts` es el espejo
 * con el que el servidor redacta: los errores de la corrida por coeficiente y
 * el aviso del recibo, que lee un residente. Las dos cabeceras llevan desde
 * agosto de 2026 diciendo «si cambias uno, cambia el otro», y eso era una
 * frase, no un guardián — exactamente el hueco que `notification-catalog-espejo`
 * cerró para el catálogo de avisos.
 *
 * **El síntoma de la deriva no rompe nada**, que es lo que la hace cara: la
 * pantalla diría «indiviso» y el correo del mismo conjunto «coeficiente», y las
 * 1198 pruebas del front y las 568 del servidor seguirían en verde. Es el mismo
 * modo de fallo que documenta la cabecera del canónico.
 *
 * Se escribió el 27 de agosto de 2026, al añadir el cuarto término
 * (`copropiedad`) y darse cuenta de que el tercero nunca tuvo vigilancia.
 *
 * **Se compara como TEXTO, no importando.** `functions/` y `src/` no pueden
 * importarse mutuamente —rompe el build de App Hosting, ver CLAUDE.md—, así que
 * se lee el fichero y se extraen las cadenas. Leer un fichero no es importarlo.
 */

const CANONICO = path.join(__dirname, "..", "..", "src", "lib", "config", "vocabulario-pais.ts");

/**
 * Saca `{ CO: "conjunto", EC: …, MX: … }` para un campo del canónico.
 *
 * Recorre el fichero de arriba abajo: cada `XX: {` abre un país y cada
 * `campo: "…"` posterior pertenece a ese país. Es el mismo recorrido que usa el
 * guardián del catálogo de avisos, y por la misma razón: no depende de que los
 * dos ficheros tengan la misma forma, solo de que marquen las claves igual.
 */
function extraerDelCanonico(fuente: string, campo: string): Record<string, string> {
  const combinado = new RegExp(`^  ([A-Z]{2}): \\{$|^    ${campo}: "((?:[^"\\\\]|\\\\.)*)",$`, "gm");
  const salida: Record<string, string> = {};
  let pais: string | null = null;
  for (const m of fuente.matchAll(combinado)) {
    if (m[1]) pais = m[1];
    else if (pais && m[2] !== undefined) salida[pais] = m[2];
  }
  return salida;
}

/** El neutro del canónico, que es un objeto aparte y no lleva país. */
function extraerNeutroDelCanonico(fuente: string, campo: string): string {
  const bloque = fuente.match(/const NEUTRO: TerminosPais = \{([\s\S]*?)\n\};/);
  if (!bloque) throw new Error("No se encontró el bloque NEUTRO en el canónico");
  const m = bloque[1].match(new RegExp(`^  ${campo}: "((?:[^"\\\\]|\\\\.)*)",$`, "m"));
  if (!m) throw new Error(`El canónico no tiene neutro para «${campo}»`);
  return m[1];
}

const fuente = fs.readFileSync(CANONICO, "utf8");

/**
 * Los tres términos que el servidor refleja. El canónico lleva además los tipos
 * de cuenta y los textos de ayuda: **eso NO es deriva**, el espejo es parcial a
 * propósito porque el servidor no los necesita para hablar.
 */
const REFLEJADOS = [
  { campo: "coeficienteCorto", resolver: terminoCoeficiente },
  { campo: "cuotaMensual", resolver: terminoCuotaMensual },
  { campo: "copropiedad", resolver: terminoCopropiedad },
] as const;

describe("el espejo del servidor dice las mismas palabras que la pantalla", () => {
  for (const { campo, resolver } of REFLEJADOS) {
    it(`«${campo}» coincide en los tres mercados`, () => {
      const esperado = extraerDelCanonico(fuente, campo);
      // Si el recorrido dejara de encontrar los países, todo pasaría en vacío y
      // el guardián sería decorativo. Se comprueba que encontró los tres.
      expect(Object.keys(esperado).sort()).toEqual(["CO", "EC", "MX"]);
      for (const [pais, palabra] of Object.entries(esperado)) {
        expect(resolver(pais)).toBe(palabra);
      }
    });

    it(`«${campo}» cae en el mismo neutro a los dos lados`, () => {
      expect(resolver(undefined)).toBe(extraerNeutroDelCanonico(fuente, campo));
      // Un país fuera de los mercados abiertos tampoco hereda el de otro.
      expect(resolver("CL")).toBe(extraerNeutroDelCanonico(fuente, campo));
    });
  }
});
