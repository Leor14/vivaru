import { describe, expect, it } from "vitest";

import {
  MAX_LARGO_DE_SEPARADOR,
  esSeparadorValido,
  fieldsFor,
  hayBloqueantes,
  mappingIssues,
  pickBestSheet,
  suggestMapping,
  summarizeMapping,
  unir,
  valueFor,
  type Asignacion,
  type Mapping,
} from "@/lib/import/field-catalog";
import { readTabularFile } from "@/lib/import/read-tabular";

import { construir, leerCasos } from "../scripts/simulacion-de-cargas/construir";

/**
 * `PRD-V-FEAT-006` — unir varias columnas del archivo en un campo de la persona.
 *
 * **Las fixtures son las del banco de cargas**, construidas desde su JSON y
 * leídas por el camino real (`readTabularFile`), no arreglos escritos a mano:
 * cada criterio nombra la suya y ella es la línea base de antes y el criterio
 * de después. Lo que este fichero NO alcanza es la pantalla —la muestra bajo el
 * campo (`CA7`) y quitar una columna (`CA8`)— ni la validación por fila
 * («Unidad no encontrada», `CA16`): eso vive en React y se mira en el navegador.
 */

// El mismo espejo que `correr.ts`: `ROLE_ALIASES` vive dentro del componente.
const ACEPTADOS = {
  "person.role": ["owner_occupant", "propietario", "propietario residente", "dueno", "owner",
    "tenant", "inquilino", "arrendatario", "residente", "investor", "inversionista",
    "propietario no residente", "other", "otro", "otra"],
};

const CASOS = leerCasos();

async function cargar(numero: string) {
  const caso = CASOS.find((c) => c.nombre.startsWith(`${numero}-`));
  if (!caso) throw new Error(`No hay fixture ${numero}`);
  const bytes = construir(caso);
  const leido = await readTabularFile(new File([new Uint8Array(bytes)], `${caso.nombre}.${caso.formato}`));
  const nombre = pickBestSheet(
    leido.sheetNames.map((n) => ({ name: n, ...leido.sheets[n] })),
    caso.entidad,
    ACEPTADOS,
  );
  const hoja = leido.sheets[nombre];
  const sugerido = suggestMapping(hoja.headers, caso.entidad, { rows: hoja.rows, accepted: ACEPTADOS });
  return { caso, rows: hoja.rows, headers: hoja.headers, sugerido };
}

/** El mapeo sugerido con la unión que declara la fixture encima: lo que haría la persona. */
function conUnion(sugerido: Mapping, unirDe: Record<string, Asignacion> | undefined): Mapping {
  if (!unirDe) throw new Error("la fixture no declara `unir`");
  return { ...sugerido, ...unirDe };
}

describe("FEAT-006 · unir columnas en un campo de la persona", () => {
  it("CA1 · «Nombres» + «Apellidos» por espacio dan «Ana María Pérez Ruiz»", async () => {
    const { rows, sugerido, caso } = await cargar("50");
    const m = conUnion(sugerido, caso.unir);
    expect(valueFor(rows[0], m, "person.fullName")).toBe("Ana María Pérez Ruiz");
    expect(valueFor(rows[1], m, "person.fullName")).toBe("Luis Gómez Salas");
  });

  it("CA2 · «Torre» + «Apto» por guion dan T1-101, y el bloqueo se levanta", async () => {
    const { rows, sugerido, caso } = await cargar("53");
    expect(hayBloqueantes(mappingIssues(rows, "person", sugerido, ACEPTADOS))).toBe(true);
    const m = conUnion(sugerido, caso.unir);
    expect(valueFor(rows[0], m, "person.unitLabel")).toBe("T1-101");
    expect(valueFor(rows[3], m, "person.unitLabel")).toBe("T2-101");
    expect(hayBloqueantes(mappingIssues(rows, "person", m, ACEPTADOS))).toBe(false);
  });

  it("CA3 · tres columnas de nombre (MX) se unen en el orden en que se añadieron", async () => {
    const { rows, sugerido, caso } = await cargar("51");
    const m = conUnion(sugerido, caso.unir);
    expect(valueFor(rows[0], m, "person.fullName")).toBe("Renata Villalobos Argüello");
    expect(valueFor(rows[2], m, "person.fullName")).toBe("Sofía Elena Quintanilla Ordaz");
  });

  it("CA4 · «Apellidos» añadida DESPUÉS de «Nombres» da «Ana María Arciniegas Peralta», no al revés", async () => {
    const { rows, sugerido, caso } = await cargar("52");
    // En el archivo «Apellidos» va ANTES que «Nombres». El orden de unión es
    // el de la persona (`RN-U1`), no el del archivo.
    expect(rows[0] && Object.keys(rows[0])[0]).toBe("Apellidos");
    const m = conUnion(sugerido, caso.unir);
    expect(valueFor(rows[0], m, "person.fullName")).toBe("Ana María Arciniegas Peralta");
    // Y si las añadiera en el orden del archivo saldría el nombre invertido:
    // nada lo rechaza, y por eso la muestra unida es la mitigación (§12).
    const alReves: Mapping = { ...m, "person.fullName": { headers: ["Apellidos", "Nombres"], separador: " " } };
    expect(valueFor(rows[0], alReves, "person.fullName")).toBe("Arciniegas Peralta Ana María");
  });

  it("CA5 · la última columna vacía no deja espacio al final", async () => {
    const { rows, sugerido, caso } = await cargar("57");
    const m = conUnion(sugerido, caso.unir);
    // Elena: sin segundo apellido.
    expect(valueFor(rows[2], m, "person.fullName")).toBe("Elena Sofía Duarte");
  });

  it("CA6 · una columna vacía EN MEDIO da «Camilo Bustamante Loaiza» con UN espacio", async () => {
    const { rows, sugerido, caso } = await cargar("57");
    const m = conUnion(sugerido, caso.unir);
    expect(valueFor(rows[1], m, "person.fullName")).toBe("Camilo Bustamante Loaiza");
    // Ricardo: hueco en medio y al final a la vez.
    expect(valueFor(rows[3], m, "person.fullName")).toBe("Ricardo Fajardo");
    // Y ninguna fila del archivo lleva dos espacios seguidos ni espacios en los bordes.
    for (const row of rows) {
      const v = valueFor(row, m, "person.fullName");
      expect(v).not.toMatch(/  /);
      expect(v).toBe(v.trim());
    }
  });

  it("CA5/CA6 · con todas las partes vacías el campo queda vacío, no un separador suelto", () => {
    expect(unir({ a: "", b: " " }, { headers: ["a", "b"], separador: "-" })).toBe("");
  });

  it("CA9 · la telemetría cuenta los campos con más de una columna", async () => {
    const { headers, sugerido, caso } = await cargar("51");
    expect(summarizeMapping(headers, "person", sugerido).camposUnidos).toBe(0);
    const m = conUnion(sugerido, caso.unir);
    const resumen = summarizeMapping(headers, "person", m);
    expect(resumen.camposUnidos).toBe(1);
    // Las dos columnas de apellido dejan de estar sin usar.
    expect(resumen.encabezadosSinUsar).toEqual([]);
    // Y una unión es trabajo de la persona, aunque una de sus columnas fuera la sugerida.
    expect(resumen.camposAMano).toBeGreaterThanOrEqual(1);
  });

  it("CA10 · el aviso de unidad partida OFRECE unir, con guion y la agrupación primero", async () => {
    for (const [numero, esperado] of [["53", ["Torre", "Apto"]], ["54", ["Bloque", "Depto"]]] as const) {
      const { rows, sugerido } = await cargar(numero);
      const aviso = mappingIssues(rows, "person", sugerido, ACEPTADOS)["person.unitLabel"];
      expect(aviso?.nivel, numero).toBe("bloquea");
      expect(aviso?.oferta, numero).toEqual({ headers: [...esperado], separador: "-" });
    }
  });

  it("CA10 · aceptar la oferta deja aplicada la unión y levanta el bloqueo", async () => {
    const { rows, sugerido } = await cargar("54");
    const aviso = mappingIssues(rows, "person", sugerido, ACEPTADOS)["person.unitLabel"];
    const aceptado: Mapping = { ...sugerido, "person.unitLabel": aviso!.oferta! };
    const despues = mappingIssues(rows, "person", aceptado, ACEPTADOS);
    expect(despues["person.unitLabel"]).toBeUndefined();
    expect(hayBloqueantes(despues)).toBe(false);
    expect(valueFor(rows[0], aceptado, "person.unitLabel")).toBe("A-301");
  });

  it("CA10 · la duda por FORMA también ofrece unir: la sospecha trae salida", () => {
    // Una agrupación con un nombre que el catálogo no conoce, reconocida solo
    // porque sus valores se repiten. Es la duda del detector, y la oferta es
    // la misma que en el bloqueo.
    const rows = [
      { Sector: "1", Apto: "101", Nombre: "Ana Restrepo", Correo: "a@x.com", Rol: "propietario" },
      { Sector: "1", Apto: "102", Nombre: "Jairo Villalba", Correo: "b@x.com", Rol: "propietario" },
      { Sector: "1", Apto: "201", Nombre: "Marta Ocampo", Correo: "c@x.com", Rol: "arrendatario" },
      { Sector: "2", Apto: "101", Nombre: "Diego Salas", Correo: "d@x.com", Rol: "propietario" },
      { Sector: "2", Apto: "102", Nombre: "Sara Pinto", Correo: "e@x.com", Rol: "propietario" },
      { Sector: "2", Apto: "201", Nombre: "Iván Mejía", Correo: "f@x.com", Rol: "arrendatario" },
    ];
    const m = suggestMapping(Object.keys(rows[0]), "person", { rows, accepted: ACEPTADOS });
    const aviso = mappingIssues(rows, "person", m, ACEPTADOS)["person.unitLabel"];
    expect(aviso?.nivel).toBe("duda");
    expect(aviso?.oferta).toEqual({ headers: ["Sector", "Apto"], separador: "-" });
  });

  it("CA11 · ignorar la oferta deja el aviso exactamente como estaba", async () => {
    const { rows, sugerido } = await cargar("53");
    const antes = mappingIssues(rows, "person", sugerido, ACEPTADOS);
    // «Ignorar» es no tocar el mapeo. El archivo no cambió, así que tampoco el aviso.
    const despues = mappingIssues(rows, "person", { ...sugerido }, ACEPTADOS);
    expect(despues).toEqual(antes);
    expect(hayBloqueantes(despues)).toBe(true);
  });

  it("CA12 · un mapeo recién sugerido NUNCA trae un campo con dos columnas — en los 51 archivos", async () => {
    let comprobados = 0;
    for (const caso of CASOS) {
      let hoja;
      try {
        const leido = await readTabularFile(
          new File([new Uint8Array(construir(caso))], `${caso.nombre}.${caso.formato}`),
        );
        hoja = leido.sheets[leido.sheetNames[0]];
      } catch {
        continue; // los que el lector rechaza no tienen mapeo que juzgar
      }
      const m = suggestMapping(hoja.headers, caso.entidad, { rows: hoja.rows, accepted: ACEPTADOS });
      for (const [campo, a] of Object.entries(m)) {
        expect(a === null || a.headers.length === 1, `${caso.nombre} · ${campo}`).toBe(true);
      }
      comprobados += 1;
    }
    // La fixture 66 —el nombre entero Y sus dos mitades en el mismo archivo— es
    // la que lo pone a prueba, y tiene que estar entre los comprobados.
    expect(CASOS.some((c) => c.nombre.startsWith("66-"))).toBe(true);
    expect(comprobados).toBeGreaterThan(40);
  });

  it("CA13 · «Rol» no admite unión, y un mapeo que la fuerce BLOQUEA", async () => {
    const { rows, sugerido } = await cargar("64");
    expect(fieldsFor("person").find((f) => f.key === "person.role")?.admiteUnion).toBeFalsy();
    const forzado: Mapping = { ...sugerido, "person.role": { headers: ["Calidad", "Ocupación"], separador: " " } };
    const aviso = mappingIssues(rows, "person", forzado, ACEPTADOS)["person.role"];
    expect(aviso?.nivel).toBe("bloquea");
    expect(aviso?.mensaje).toContain("no admite unir");
  });

  it("CA14 · una columna ya usada en un campo no puede alimentar otro", async () => {
    const { rows, sugerido } = await cargar("50");
    // «Nombres» ya alimenta el nombre completo; meterla también en el documento
    // es el estado que la pantalla no deja construir. Si llega, bloquea.
    const forzado: Mapping = { ...sugerido, "person.documentNumber": { headers: ["Nombres"], separador: " " } };
    const avisos = mappingIssues(rows, "person", forzado, ACEPTADOS);
    expect(avisos["person.documentNumber"]?.nivel).toBe("bloquea");
    expect(avisos["person.documentNumber"]?.mensaje).toContain("ya alimenta");
    expect(hayBloqueantes(avisos)).toBe(true);
  });

  it("CA15 · un separador propio de más de 5 caracteres no se acepta", async () => {
    expect(esSeparadorValido("-----")).toBe(true);
    expect(esSeparadorValido("------")).toBe(false);
    expect(MAX_LARGO_DE_SEPARADOR).toBe(5);
    const { rows, sugerido } = await cargar("50");
    const forzado: Mapping = { ...sugerido, "person.fullName": { headers: ["Nombres", "Apellidos"], separador: " ---- " } };
    expect(mappingIssues(rows, "person", forzado, ACEPTADOS)["person.fullName"]?.nivel).toBe("bloquea");
  });

  it("CA16 · la torre sin prefijo une a «1-101», que no es como se llama ninguna unidad", async () => {
    const { rows, sugerido, caso } = await cargar("56");
    const m = conUnion(sugerido, caso.unir);
    // El bloqueo se levanta —el archivo ya no funde unidades—…
    expect(hayBloqueantes(mappingIssues(rows, "person", m, ACEPTADOS))).toBe(false);
    // …y el valor unido es literal: sin plantilla, «1» + «101» NO da «T1-101».
    // Es la limitación declarada en §4; la fila saldrá «Unidad no encontrada»
    // en la revisión, que se comprueba en pantalla.
    expect(valueFor(rows[0], m, "person.unitLabel")).toBe("1-101");
    expect(valueFor(rows[0], m, "person.unitLabel")).not.toBe("T1-101");
  });

  it("CA17 · ningún campo de UNIDADES admite unión, y forzarla bloquea", async () => {
    expect(fieldsFor("unit").every((f) => !f.admiteUnion)).toBe(true);
    const { rows, sugerido } = await cargar("60");
    const forzado: Mapping = { ...sugerido, "unit.displayName": { headers: ["Torre", "Número"], separador: "-" } };
    const aviso = mappingIssues(rows, "unit", forzado, { "unit.type": ["apartamento"], "unit.status": ["activo"] })["unit.displayName"];
    expect(aviso?.nivel).toBe("bloquea");
  });
});
