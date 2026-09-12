import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Guardián de `CF9`, en las dos direcciones: el `tenantId` de un documento no se muda.**
 *
 * Un `update` que decide con el `tenantId` NUEVO deja a un administrador del conjunto A
 * quedarse un documento del conjunto B reescribiéndolo. Uno que decide con el de ANTES pero
 * no impide que cambie deja, al revés, empujar un documento propio a otro conjunto. Los dos se
 * cerraron el 12 de septiembre de 2026 —`amenities`, dieciocho bloques de la primera forma y
 * siete de la segunda—, y los dos estaban al alcance de quien abriera una cuenta de prueba.
 *
 * **Mide el fichero, no una lista escrita a mano**: recorre cada `allow` que cubre `update` o
 * `write` y habla del `tenantId` del documento, y exige que diga que no cambia. Un bloque
 * nuevo con cualquiera de las dos formas lo pone en rojo. El comportamiento se prueba contra
 * el emulador en `tests/cf9-conjunto-de-antes.rules.test.ts`.
 *
 * **Los comentarios se quitan ANTES de buscar**: un comentario que nombra la igualdad para
 * explicarla la haría pasar por escrita. Es la trampa de un guardián que cuenta sus propios
 * comentarios.
 */

type Permiso = { linea: number; coleccion: string; ruta: string; ops: string[]; condicion: string };

/** Quita los comentarios `//` que no están dentro de una cadena, conservando los saltos de línea. */
function sinComentarios(texto: string): string {
  let salida = "";
  let comilla: string | null = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      salida += c;
      if (c === "\\") { salida += texto[++i] ?? ""; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === "'" || c === '"') { comilla = c; salida += c; continue; }
    if (c === "/" && texto[i + 1] === "/") {
      while (i < texto.length && texto[i] !== "\n") i++;
      salida += "\n";
      continue;
    }
    salida += c;
  }
  return salida;
}

/** Cada `allow … : if …;` con la ruta del `match` que lo contiene. */
function permisos(reglas: string): Permiso[] {
  const texto = sinComentarios(reglas);
  const rutaEn: string[] = [];
  const pila: { ruta: string; nivel: number }[] = [];
  let nivel = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "{") {
      const antes = texto.slice(texto.lastIndexOf("\n", i) + 1, i);
      const m = antes.match(/match\s+(\S+)\s*$/);
      nivel++;
      if (m) pila.push({ ruta: m[1], nivel });
    } else if (c === "}") {
      while (pila.length && pila[pila.length - 1].nivel === nivel) pila.pop();
      nivel--;
    }
    rutaEn[i] = pila.map((p) => p.ruta).join("");
  }
  const salida: Permiso[] = [];
  const re = /allow\s+([a-z,\s]+?)\s*:\s*if\s+([\s\S]*?);/g;
  for (let m; (m = re.exec(texto)); ) {
    const ruta = rutaEn[m.index] ?? "";
    salida.push({
      linea: texto.slice(0, m.index).split("\n").length,
      coleccion: ruta.match(/\/documents\/([^/]+)/)?.[1] ?? ruta,
      ruta,
      ops: m[1].split(",").map((s) => s.trim()),
      condicion: m[2].replace(/\s+/g, " ").trim(),
    });
  }
  return salida;
}

const IGUALDAD =
  /request\.resource\.data\.tenantId\s*==\s*resource\.data\.tenantId|(?<!request\.)\bresource\.data\.tenantId\s*==\s*request\.resource\.data\.tenantId/;

const hablaDelTenantDelDocumento = (c: string) => /\bresource\.data\.tenantId\b/.test(c);
const siempreFalso = (c: string) => /^\(?false\)?$|&&\s*\(?\s*false\s*\)?$|^\(?\s*false\s*\)?\s*&&/.test(c);
/** El conjunto sale de la ruta (`/tenantSettings/{tenantId}`) y el documento tiene que decir ese. */
const conjuntoDeLaRuta = (p: Permiso) => p.ruta.includes("{tenantId}") && /request\.resource\.data\.tenantId\s*==\s*tenantId\b/.test(p.condicion);
const listaCerradaSinTenant = (c: string) =>
  /affectedKeys\(\)\s*\.hasOnly\(\[[^\]]*\]/.test(c) && !/hasOnly\(\[[^\]]*tenantId/.test(c) && !c.includes("||");

/** Excepciones con su motivo, y la comprobación de que el motivo SIGUE siendo cierto. */
const EXCEPCIONES: Record<string, { motivo: string; sigueSiendoCierto: (condicion: string) => boolean }> = {
  pushTokens: {
    motivo: "reescribir el dueño es su diseño: el id ES el token, y reclamarlo exige tenerlo",
    sigueSiendoCierto: (c) => /request\.resource\.data\.userId\s*==\s*request\.auth\.uid/.test(c),
  },
  treasuryTransfers: { motivo: "lista cerrada de campos tocables, sin `tenantId`", sigueSiendoCierto: listaCerradaSinTenant },
  pettyCashFunds: { motivo: "lista cerrada de campos tocables, sin `tenantId`", sigueSiendoCierto: listaCerradaSinTenant },
};

/** Los bloques que se cerraron: si alguno deja de verse, el guardián se ha quedado ciego. */
const CERRADOS = [
  "amenities", "units", "people", "{collection}", "billingStatements", "billingSchedules",
  "billingCampaigns", "billingReminderJobs", "expenses", "vendors", "bankAccounts",
  "bankAccountBalances", "bankStatementLines", "ledgerEntries", "financialCounters", "documents",
  "services", "meteredServices", "committee_agreements",
  "tickets", "visitorInvitations", "visitorPasses", "visitorAuthorizations", "unitChangeRequests",
  "surveys", "paymentReceipts",
];

const TODOS = permisos(fs.readFileSync(path.resolve("firestore.rules"), "utf8"));
const EDICIONES = TODOS.filter((p) => p.ops.includes("update") || p.ops.includes("write"));

describe("CF9 · el tenantId de un documento no se muda", () => {
  it("recorre de verdad el fichero, y ve los bloques que se cerraron", () => {
    expect(EDICIONES.length).toBeGreaterThan(40);
    const conIgualdad = new Set(EDICIONES.filter((p) => IGUALDAD.test(p.condicion)).map((p) => p.coleccion));
    expect(CERRADOS.filter((c) => !conIgualdad.has(c))).toEqual([]);
  });

  it("ningún update que hable del tenantId del documento deja cambiarlo", () => {
    const abiertos = EDICIONES
      .filter((p) => hablaDelTenantDelDocumento(p.condicion))
      .filter((p) => !siempreFalso(p.condicion))
      .filter((p) => !IGUALDAD.test(p.condicion))
      .filter((p) => !conjuntoDeLaRuta(p))
      .filter((p) => !(p.coleccion in EXCEPCIONES))
      .map((p) => `firestore.rules:${p.linea} ${p.coleccion} [${p.ops.join(",")}]`);
    expect(abiertos).toEqual([]);
  });

  it("cada excepción sigue existiendo y su motivo sigue siendo cierto", () => {
    for (const [coleccion, { motivo, sigueSiendoCierto }] of Object.entries(EXCEPCIONES)) {
      const suyos = EDICIONES.filter((p) => p.coleccion === coleccion && !siempreFalso(p.condicion));
      expect(suyos.length, `${coleccion}: la excepción ya no tiene bloque de edición`).toBeGreaterThan(0);
      for (const p of suyos) expect(sigueSiendoCierto(p.condicion), `${coleccion} (${motivo}) en la línea ${p.linea}`).toBe(true);
    }
  });
});
