import { describe, expect, it } from "vitest";

import {
  RegistroInvalido,
  normalizarRegistro,
} from "../src/import/telemetria";

/**
 * `PRD-V-FEAT-002`, `CA-13`. Lo que estas pruebas protegen no es el formato:
 * es la decisión de **recortar en vez de rechazar** lo accesorio. Perder la
 * medición entera por un archivo raro sería el peor resultado posible —nos
 * quedaríamos sin el dato justo en el caso interesante—, así que lo que puede
 * venir feo se poda y lo que define la fila se exige.
 */

const base = {
  runId: "abc-123",
  fase: "inicio",
  entidad: "person",
  formato: "csv",
  hojas: 1,
  filas: 180,
  camposPorAlias: 3,
  camposAMano: 2,
  encabezadosSinUsar: ["Saldo", "Notas"],
};

describe("lo que define la fila se exige", () => {
  it("sin runId no hay registro: sin él no se puede parear inicio y fin", () => {
    expect(() => normalizarRegistro({ ...base, runId: "" })).toThrow(RegistroInvalido);
  });

  it("una fase inventada se rechaza", () => {
    expect(() => normalizarRegistro({ ...base, fase: "mitad" })).toThrow(RegistroInvalido);
  });

  it("una entidad inventada se rechaza", () => {
    expect(() => normalizarRegistro({ ...base, entidad: "cobros" })).toThrow(RegistroInvalido);
  });

  it("un conteo negativo se rechaza", () => {
    expect(() => normalizarRegistro({ ...base, filas: -1 })).toThrow(RegistroInvalido);
  });

  it("el fin exige importadas y omitidas, que es lo que se mide", () => {
    expect(() => normalizarRegistro({ ...base, fase: "fin" })).toThrow(RegistroInvalido);
    const r = normalizarRegistro({ ...base, fase: "fin", importadas: 170, omitidas: 10 });
    expect(r.importadas).toBe(170);
    expect(r.omitidas).toBe(10);
  });
});

describe("lo accesorio se recorta en vez de tumbar la medición", () => {
  it("una lista larguísima de encabezados se poda", () => {
    const r = normalizarRegistro({
      ...base,
      encabezadosSinUsar: Array.from({ length: 200 }, (_, i) => `col-${i}`),
    });
    expect(r.encabezadosSinUsar).toHaveLength(40);
  });

  it("un encabezado kilométrico se corta", () => {
    const r = normalizarRegistro({ ...base, encabezadosSinUsar: ["x".repeat(500)] });
    expect(r.encabezadosSinUsar[0]).toHaveLength(80);
  });

  it("la basura que no es texto se cae sola", () => {
    const r = normalizarRegistro({ ...base, encabezadosSinUsar: ["Saldo", 42, null, "  "] });
    expect(r.encabezadosSinUsar).toEqual(["Saldo"]);
  });
});

describe("la pista", () => {
  it("viaja cuando el conjunto la declara", () => {
    expect(normalizarRegistro({ ...base, pista: "cliente" }).pista).toBe("cliente");
  });

  it("y su ausencia no rompe nada: hay conjuntos que no la tienen", () => {
    expect(normalizarRegistro(base).pista).toBeUndefined();
  });
});

describe("lo que NUNCA debe aparecer aquí", () => {
  it("no se copia ningún campo suelto del cuerpo", () => {
    // Un cuerpo con datos de una fila real no debe colarse a la telemetría: se
    // construye un objeto nuevo campo a campo, no se hace spread del entrante.
    const r = normalizarRegistro({ ...base, email: "ana@correo.com", fullName: "Ana Pérez" });
    expect(JSON.stringify(r)).not.toContain("ana@correo.com");
    expect(JSON.stringify(r)).not.toContain("Ana Pérez");
  });
});

/**
 * `AI-ONB-001` · la forma del archivo, que es como se acumula corpus **sin**
 * guardar el archivo (decisión de David, 1 de septiembre de 2026).
 *
 * El cliente ya filtra por «esto se comporta como un vocabulario». Estas
 * pruebas protegen la SEGUNDA puerta, y existe porque el cliente es quien puede
 * mentir: sin tope aquí, una llamada fabricada convertiría la telemetría en el
 * almacén de datos personales que §7 de la PRD existe para evitar.
 */
describe("la forma del archivo viaja, y acotada", () => {
  it("el preámbulo, la unidad partida y el vocabulario desconocido se guardan", () => {
    const r = normalizarRegistro({
      ...base,
      filasDePreambulo: 2,
      unidadPartida: true,
      valoresNoReconocidos: ["ocupado", "arrendado"],
    });
    expect(r.filasDePreambulo).toBe(2);
    expect(r.unidadPartida).toBe(true);
    expect(r.valoresNoReconocidos).toEqual(["ocupado", "arrendado"]);
  });

  it("y su ausencia no rompe nada: un front viejo no manda ninguno", () => {
    const r = normalizarRegistro(base);
    expect(r.filasDePreambulo).toBeUndefined();
    expect(r.unidadPartida).toBeUndefined();
    expect(r.valoresNoReconocidos).toBeUndefined();
  });

  it("un cliente que manda quinientos valores solo deja veinte", () => {
    const r = normalizarRegistro({
      ...base,
      valoresNoReconocidos: Array.from({ length: 500 }, (_, i) => `valor-${i}`),
    });
    expect(r.valoresNoReconocidos).toHaveLength(20);
  });

  it("un valor kilométrico se corta, que es como se cuela un párrafo entero", () => {
    const r = normalizarRegistro({ ...base, valoresNoReconocidos: ["x".repeat(500)] });
    expect(r.valoresNoReconocidos?.[0]).toHaveLength(40);
  });

  it("la basura que no es texto se cae sola", () => {
    const r = normalizarRegistro({
      ...base,
      valoresNoReconocidos: ["ocupado", 42, null, { a: 1 }, "  "],
    });
    expect(r.valoresNoReconocidos).toEqual(["ocupado"]);
  });

  it("un preámbulo negativo se rechaza, como cualquier otro conteo", () => {
    expect(() => normalizarRegistro({ ...base, filasDePreambulo: -3 })).toThrow(RegistroInvalido);
  });

  it("y `unidadPartida` solo acepta un booleano de verdad", () => {
    // Una cadena «true» no es un sí: guardarla dejaría un campo que miente al
    // contarlo, porque cualquier cadena no vacía es verdadera.
    expect(normalizarRegistro({ ...base, unidadPartida: "true" }).unidadPartida).toBeUndefined();
  });
});
