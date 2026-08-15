import { describe, expect, it } from "vitest";

import {
  OPERATION_KEYS,
  findOperation,
  validateOperationInput,
  type OperationDefinition,
} from "../src/ai/catalog";
import { FEATURE_FLAG_DEFAULTS } from "../src/feature-flags";

/**
 * Catálogo de operaciones — Paso 1.3 de docs/hoja-de-ruta-ia.md.
 *
 * Lo que se protege aquí es la regla del paso: nada se invoca si no está en el
 * catálogo, y lo que está declara qué recibe, qué devuelve, quién puede pedirlo
 * y con qué límites. Un catálogo con una entrada mal formada es peor que no
 * tenerlo, porque parece que hay contrato.
 */

const OPERACION = findOperation("comunicaciones-redactar") as OperationDefinition;

function entradaValida() {
  return {
    proposito: "Avisar del corte de agua programado para el sábado",
    hechos: ["El corte va de 8:00 a 14:00", "Afecta a las torres 1 y 2"],
    tono: "informativo" as const,
  };
}

describe("invariantes del catálogo", () => {
  it("tiene al menos una operación registrada", () => {
    // Un catálogo vacío no se puede probar, y el Paso 1.3 no estaría hecho.
    expect(OPERATION_KEYS.length).toBeGreaterThan(0);
  });

  it("cada entrada está bien formada", () => {
    for (const key of OPERATION_KEYS) {
      const op = findOperation(key) as OperationDefinition;

      expect(op.key).toBe(key);
      expect(op.version).toBeGreaterThanOrEqual(1);
      expect(op.modulo.length).toBeGreaterThan(0);
      expect(op.allowedRoles.length).toBeGreaterThan(0);
      expect(op.limits.maxInputChars).toBeGreaterThan(0);
      expect(op.limits.timeoutMs).toBeGreaterThan(0);
      expect(op.limits.maxOutputTokens).toBeGreaterThan(0);
    }
  });

  it("la bandera de cada operación existe en el catálogo de banderas", () => {
    // Una bandera inventada dejaría la operación gobernada por un default y
    // nadie podría apagarla desde /superadmin/flags.
    for (const key of OPERATION_KEYS) {
      const op = findOperation(key) as OperationDefinition;
      expect(Object.keys(FEATURE_FLAG_DEFAULTS)).toContain(op.flag);
    }
  });

  it("ninguna clave lleva punto", () => {
    // Igual que las banderas: se usan como segmento de field path en telemetría
    // y cuotas, y un punto ahí se parsea como anidamiento.
    for (const key of OPERATION_KEYS) expect(key).not.toContain(".");
  });

  it("el superadmin no puede pedir ninguna operación", () => {
    for (const key of OPERATION_KEYS) {
      const op = findOperation(key) as OperationDefinition;
      expect(op.allowedRoles).not.toContain("superadmin");
    }
  });
});

describe("findOperation", () => {
  it("devuelve null para una clave desconocida", () => {
    expect(findOperation("no-existe")).toBeNull();
  });

  it("devuelve null para lo que no sea texto", () => {
    expect(findOperation(undefined)).toBeNull();
    expect(findOperation(42)).toBeNull();
    expect(findOperation({ key: "comunicaciones-redactar" })).toBeNull();
  });

  it("no se deja engañar por propiedades del prototipo", () => {
    // Sin la guarda de hasOwnProperty, "constructor" o "toString" devolverían
    // algo que no es una operación y el resto del código lo trataría como tal.
    expect(findOperation("toString")).toBeNull();
    expect(findOperation("constructor")).toBeNull();
  });
});

describe("validación de la entrada", () => {
  it("acepta una entrada válida y devuelve el dato parseado", () => {
    const resultado = validateOperationInput(OPERACION, entradaValida());
    expect(resultado.ok).toBe(true);
  });

  it("rechaza si falta un campo y dice cuál", () => {
    const { proposito: _omitido, ...sinProposito } = entradaValida();
    const resultado = validateOperationInput(OPERACION, sinProposito);

    expect(resultado).toMatchObject({ ok: false, reason: "entrada_invalida" });
    expect(resultado.ok === false && resultado.detail).toContain("proposito");
  });

  it("rechaza campos de más — el esquema es estricto", () => {
    // Que la IA no toque audiencia, torres ni vigencia empieza aquí: si no
    // entran, no pueden salir.
    const resultado = validateOperationInput(OPERACION, { ...entradaValida(), audiencia: "torre-1" });
    expect(resultado).toMatchObject({ ok: false, reason: "entrada_invalida" });
  });

  it("rechaza una lista de hechos vacía", () => {
    const resultado = validateOperationInput(OPERACION, { ...entradaValida(), hechos: [] });
    expect(resultado).toMatchObject({ ok: false, reason: "entrada_invalida" });
  });

  it("rechaza un tono fuera del enum", () => {
    const resultado = validateOperationInput(OPERACION, { ...entradaValida(), tono: "sarcastico" });
    expect(resultado).toMatchObject({ ok: false, reason: "entrada_invalida" });
  });

  it("corta por tamaño antes de mirar el esquema", () => {
    const enorme = {
      ...entradaValida(),
      hechos: Array.from({ length: 20 }, () => "x".repeat(500)),
    };
    const resultado = validateOperationInput(OPERACION, enorme);

    expect(resultado).toMatchObject({ ok: false, reason: "entrada_demasiado_grande" });
  });

  it("tolera una entrada ausente sin reventar", () => {
    expect(validateOperationInput(OPERACION, undefined)).toMatchObject({ ok: false });
    expect(validateOperationInput(OPERACION, null)).toMatchObject({ ok: false });
  });
});

describe("esquema de salida de comunicaciones-redactar", () => {
  function salidaValida() {
    return {
      title: "Corte de agua programado",
      body: "El sábado habrá corte de agua de 8:00 a 14:00 en las torres 1 y 2.",
      notificationSummary: "Corte de agua el sábado de 8:00 a 14:00",
      missingInformation: [],
      qualityFlags: [],
      assumptions: [],
    };
  }

  it("acepta una salida bien formada", () => {
    expect(OPERACION.output.safeParse(salidaValida()).success).toBe(true);
  });

  it("RECHAZA una salida con assumptions — la regla dura de la PRD", () => {
    // Si el modelo asumió un dato que nadie le dio, la propuesta no se inserta
    // sola. El validador del Paso 1.4 tira la respuesta entera.
    const conSupuestos = { ...salidaValida(), assumptions: ["Supuse que el corte es total"] };
    expect(OPERACION.output.safeParse(conSupuestos).success).toBe(false);
  });

  it("rechaza claves de más — salirse del contrato no se ignora", () => {
    const conExtra = { ...salidaValida(), audiencia: "todos" };
    expect(OPERACION.output.safeParse(conExtra).success).toBe(false);
  });

  it("acepta que pida los datos que faltan, con su categoría", () => {
    const pidiendo = {
      ...salidaValida(),
      missingInformation: [{ categoria: "alcance", detalle: "¿Qué torres se ven afectadas?" }],
    };
    expect(OPERACION.output.safeParse(pidiendo).success).toBe(true);
  });

  it("RECHAZA una categoría que no está en la lista", () => {
    // El valor de categorizar es poder ordenar sin adivinar. Una categoría
    // libre lo destruye: la interfaz volvería a buscar palabras, que es
    // justo el defecto que este contrato v2 vino a cerrar.
    const inventada = {
      ...salidaValida(),
      missingInformation: [{ categoria: "presupuesto", detalle: "¿Cuánto cuesta?" }],
    };
    expect(OPERACION.output.safeParse(inventada).success).toBe(false);
  });

  it("RECHAZA un dato que falta sin categoría", () => {
    const suelto = { ...salidaValida(), missingInformation: ["¿Qué torres se ven afectadas?"] };
    expect(OPERACION.output.safeParse(suelto).success).toBe(false);
  });
});
