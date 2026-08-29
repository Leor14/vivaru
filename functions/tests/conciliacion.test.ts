import { describe, expect, it } from "vitest";

import {
  calcularCandidatos,
  claveNatural,
  clasificar,
  cuentaCompatible,
  dentroDeVentana,
  efectoContable,
  idDeLinea,
  incoherenciasDelPar,
  mismoEfecto,
  motivoValido,
  normalizarDescripcion,
  porQueNoEsCandidato,
  transicionValida,
  type AsientoDelLibro,
  type LineaDeBanco,
} from "../src/conciliacion";

/**
 * `PRD-V-FLOW-004` — las reglas del expediente de conciliación.
 *
 * **Los datos de estas pruebas son los de producción, no inventados**, porque
 * las reglas se fijaron midiéndolos. Donde hace falta un caso que producción no
 * tiene, se construye y **se dice que es construido**.
 *
 * **Y una corrección de método que costó encontrar, escrita aquí para que no
 * vuelva:** la ficha decía que sustituir R2 por «comparar valores absolutos»
 * pondría en verde el par falso de producción. **Es falso.** Ese par está a
 * 260.000 de distancia, así que CUALQUIER comprobación de magnitud lo rechaza —
 * y también lo rechaza la ventana de fecha, por seis días—. Lo que el par
 * demuestra es que **no había ninguna comprobación**, no que la del signo sea la
 * que lo caza. La mitad del signo de R2 protege de otra cosa —casar una salida
 * de banco con una entrada del libro por el mismo importe— y para probarla hace
 * falta un par de igual magnitud y signo contrario, que aquí se construye.
 * Una prueba que dice cazar algo que ya cazaba otra regla no vigila nada.
 */

const linea = (over: Partial<LineaDeBanco> = {}): LineaDeBanco => ({
  id: "L1",
  tenantId: "tenant-santa-maria",
  bankAccountId: "7TY7nFs1sVzOm1S1ISwI",
  date: "2026-06-08",
  description: "Mantenimiento bomba de agua",
  amount: -300000,
  ...over,
});

const asiento = (over: Partial<AsientoDelLibro> = {}): AsientoDelLibro => ({
  id: "A1",
  tenantId: "tenant-santa-maria",
  bankAccountId: "7TY7nFs1sVzOm1S1ISwI",
  date: "2026-06-08",
  type: "egreso",
  amount: 300000,
  reconciled: false,
  ...over,
});

describe("R2 · el efecto contable", () => {
  it.each([
    ["ingreso normal", "ingreso" as const, 3000, 3000],
    ["egreso normal", "egreso" as const, 300000, -300000],
    // Los dos de producción: un reverso conserva el TIPO y niega el MONTO.
    ["reverso de un ingreso — el dinero SALE", "ingreso" as const, -1120000, -1120000],
    ["reverso de un egreso — el dinero VUELVE", "egreso" as const, -300000, 300000],
  ])("%s", (_caso, type, amount, esperado) => {
    expect(efectoContable({ type, amount })).toBe(esperado);
  });

  it("mirar solo el `type` leería un reverso de ingreso como una entrada de dinero", () => {
    const reverso = { type: "ingreso" as const, amount: -1120000 };
    expect(reverso.type).toBe("ingreso");
    expect(efectoContable(reverso)).toBeLessThan(0);
  });
});

describe("R2 · los pares COHERENTES de producción siguen siéndolo", () => {
  // Las cinco formas distintas que hay entre los 18 pares buenos. Si R2 se
  // endurece de más, esto enrojece antes que nada.
  it.each([
    [-150000, "egreso" as const, 150000],
    [3000, "ingreso" as const, 3000],
    [-800000, "egreso" as const, 800000],
    [120000, "ingreso" as const, 120000],
    [250000, "ingreso" as const, 250000],
  ])("línea %i ↔ asiento %s %i", (montoLinea, type, montoAsiento) => {
    expect(mismoEfecto({ type, amount: montoAsiento }, { amount: montoLinea })).toBe(true);
  });
});

describe("R2 · las DOS mitades, separadas — cada una caza algo distinto", () => {
  it("la MAGNITUD: el par falso de producción está a 260.000, y eso lo rechaza", () => {
    expect(mismoEfecto({ type: "ingreso", amount: 40000 }, { amount: -300000 })).toBe(false);
  });

  it("el SIGNO: mismo importe y sentido contrario. **Caso construido: producción no lo tiene**", () => {
    // Una salida de banco de 3.000 contra un ingreso del libro de 3.000.
    // Comparar valores absolutos lo ACEPTARÍA. Es lo único que separa a R2 de
    // una comprobación de magnitud, y por eso vive en su propia prueba.
    const salidaDeBanco = { amount: -3000 };
    const ingresoDelLibro = { type: "ingreso" as const, amount: 3000 };
    expect(Math.abs(efectoContable(ingresoDelLibro))).toBe(Math.abs(salidaDeBanco.amount));
    expect(mismoEfecto(ingresoDelLibro, salidaDeBanco)).toBe(false);
  });
});

describe("R3 · la ventana de fecha", () => {
  it.each([0, 1, 3])("acepta %i días de desfase", (d) => {
    const dia = String(8 + d).padStart(2, "0");
    expect(dentroDeVentana({ date: "2026-06-08" }, { date: `2026-06-${dia}` })).toBe(true);
  });

  it.each([4, 6])("RECHAZA %i días", (d) => {
    const dia = String(8 + d).padStart(2, "0");
    expect(dentroDeVentana({ date: "2026-06-08" }, { date: `2026-06-${dia}` })).toBe(false);
  });

  it("el mayor desfase real entre pares coherentes es 1 día: la ventana no aprieta a nadie", () => {
    expect(dentroDeVentana({ date: "2026-06-02" }, { date: "2026-06-03" })).toBe(true);
  });
});

describe("R1 · la cuenta bancaria no descarta cuando falta", () => {
  it("un asiento SIN cuenta sigue siendo comparable — 16 de los 93 de producción", () => {
    expect(cuentaCompatible({ bankAccountId: "banco-a" }, { bankAccountId: null })).toBe(true);
    expect(cuentaCompatible({ bankAccountId: "banco-a" }, { bankAccountId: undefined })).toBe(true);
  });

  it("pero si la declara, tiene que coincidir", () => {
    expect(cuentaCompatible({ bankAccountId: "banco-a" }, { bankAccountId: "banco-b" })).toBe(false);
  });
});

describe("R1 · por qué un asiento NO es candidato", () => {
  it.each([
    ["otro_conjunto", { tenantId: "otro" }],
    ["otra_cuenta", { bankAccountId: "bank-playas-001" }],
    ["ya_conciliado", { reconciled: true }],
    ["anulado", { reversedByEntryId: "R9" }],
    ["efecto", { amount: 40000, type: "ingreso" as const }],
    ["fecha", { date: "2026-06-02", amount: 300000 }],
  ])("%s", (motivo, over) => {
    expect(porQueNoEsCandidato(linea(), asiento(over))).toBe(motivo);
  });

  it("y el asiento correcto SÍ lo es — si no, lo de arriba no prueba nada", () => {
    expect(porQueNoEsCandidato(linea(), asiento())).toBeNull();
  });
});

describe("El par falso de producción, con nombre y apellidos", () => {
  // Línea sVYB2D (−300.000, «Mantenimiento bomba de agua», 2026-06-08)
  // ↔ asiento igdiGS (+40.000, «Otros ingresos», 2026-06-02).
  const falso = asiento({ id: "igdiGS", type: "ingreso", amount: 40000, date: "2026-06-02", bankAccountId: null });

  it("no habría sido candidato: lo rechazan TRES cosas, no una", () => {
    expect(porQueNoEsCandidato(linea(), falso)).not.toBeNull();
    expect(mismoEfecto(falso, linea())).toBe(false);
    expect(dentroDeVentana(linea(), falso)).toBe(false);
    expect(Math.sign(efectoContable(falso))).not.toBe(Math.sign(linea().amount));
  });

  it("y como YA está escrito, se le ponen nombres sin tocarlo", () => {
    expect(incoherenciasDelPar(linea(), falso)).toEqual(["signo", "monto", "fecha"]);
  });

  it("un par sano no tiene ninguna incoherencia", () => {
    expect(incoherenciasDelPar(linea(), asiento())).toEqual([]);
  });
});

describe("R4 · propuesta SOLO con candidato único", () => {
  // Las seis SPEI de 3.000 del 8 de marzo: idénticas salvo el sufijo del texto.
  const spei = (n: number) => asiento({ id: `A${n}`, type: "ingreso", amount: 3000, date: "2026-03-08" });
  const lineaSpei = linea({ amount: 3000, date: "2026-03-08", description: "SPEI recibido — Pago administracion 2026-03 — T1-103" });

  it("con SEIS candidatos no propone: van a la bandeja", () => {
    const seis = [1, 2, 3, 4, 5, 6].map(spei);
    const r = clasificar(lineaSpei, seis);
    expect(r.candidateLedgerEntryIds).toHaveLength(6); // que encontró algo, primero
    expect(r.status).toBe("detectado");
    expect(r.excepcion).toBe("varios_candidatos");
  });

  it("con UNO propone, y lo nombra", () => {
    const r = clasificar(lineaSpei, [spei(1)]);
    expect(r.status).toBe("propuesto");
    expect(r.candidateLedgerEntryIds).toEqual(["A1"]);
    expect(r.excepcion).toBeNull();
  });

  it("con NINGUNO es excepción — la comisión de −180 de producción", () => {
    const comision = linea({ amount: -180, date: "2026-06-27", description: "Comisión bancaria mensual" });
    const r = clasificar(comision, [spei(1), asiento()]);
    expect(r.candidateLedgerEntryIds).toEqual([]);
    expect(r.status).toBe("detectado");
    expect(r.excepcion).toBe("sin_contraparte");
  });

  it("sobre una lista VACÍA de asientos no dice «propuesto» ni por accidente", () => {
    // Una puerta que se abre sobre un conjunto vacío no verifica nada.
    expect(calcularCandidatos(lineaSpei, [])).toEqual([]);
    expect(clasificar(lineaSpei, []).status).toBe("detectado");
  });
});

describe("R5 · el duplicado necesita la descripción DENTRO de la clave", () => {
  const seisSpei = [101, 102, 103, 104, 105, 106].map((u) =>
    linea({
      tenantId: "conjunto-las-playas",
      bankAccountId: "bank-playas-001",
      date: "2026-03-08",
      amount: 3000,
      description: `SPEI recibido — Pago administracion 2026-03 — T1-${u}`,
    }),
  );

  it("las seis dan SEIS claves distintas: ninguna es duplicada de otra", () => {
    expect(new Set(seisSpei.map(claveNatural)).size).toBe(6);
  });

  it("sin la descripción darían UNA sola, y las seis serían «duplicadas»", () => {
    // Es el argumento entero de la regla, y por eso se prueba el contrafactual.
    const sinDescripcion = seisSpei.map((l) => claveNatural({ ...l, description: "" }));
    expect(new Set(sinDescripcion).size).toBe(1);
  });

  it("la misma línea dos veces sí es duplicada", () => {
    expect(claveNatural(seisSpei[0])).toBe(claveNatural({ ...seisSpei[0], id: "otro" }));
  });

  it("la normalización conserva el código de unidad, que es el discriminante", () => {
    expect(normalizarDescripcion("SPEI recibido — Pago administracion — T1-101")).toContain("t1 101");
  });

  it("y absorbe acentos, mayúsculas y espacios de más", () => {
    expect(normalizarDescripcion("  Comisión   BANCARIA  ")).toBe("comision bancaria");
  });
});

describe("R5 · el id derivado, y que un id de documento es GLOBAL", () => {
  it("la misma línea da siempre el mismo id: la base rechaza la segunda carga", () => {
    expect(idDeLinea(linea())).toBe(idDeLinea({ ...linea(), id: "da igual" }));
  });

  it("la MISMA línea en dos conjuntos da ids DISTINTOS", () => {
    // Dos siembras declararon una vez el mismo id en una colección raíz y una
    // borró documentos de la otra. El `tenantId` entra en el hash por eso.
    expect(idDeLinea(linea())).not.toBe(idDeLinea({ ...linea(), tenantId: "otro-conjunto" }));
  });

  it("una descripción con `/` no parte la ruta del documento", () => {
    expect(idDeLinea(linea({ description: "Pago a/c 12/2026" }))).toMatch(/^bsl_[0-9a-f]{32}$/);
  });
});

describe("Estados · ninguno es terminal, y ninguno se reabre en silencio", () => {
  it.each([
    ["detectado", "aplicado"],
    ["propuesto", "aplicado"],
    ["aplicado", "reversado"],
    ["rechazado", "detectado"],
    ["reversado", "aplicado"],
  ] as const)("%s → %s es válida", (de, a) => expect(transicionValida(de, a)).toBe(true));

  it.each([
    ["aplicado", "propuesto"],
    ["rechazado", "aplicado"],
    ["detectado", "reversado"],
  ] as const)("%s → %s NO", (de, a) => expect(transicionValida(de, a)).toBe(false));
});

describe("R6 · el motivo al salir", () => {
  it("rechazar sin motivo no se escribe", () => {
    expect(motivoValido("rechazado", null)).toBe(false);
    expect(motivoValido("rechazado", "inventado")).toBe(false);
  });

  it("`otro` exige texto", () => {
    expect(motivoValido("rechazado", "otro", "  ")).toBe(false);
    expect(motivoValido("rechazado", "otro", "el banco lo devolvió")).toBe(true);
  });

  it("un motivo del catálogo basta", () => {
    expect(motivoValido("rechazado", "comision_bancaria")).toBe(true);
    expect(motivoValido("reversado", "reverso_del_asiento")).toBe(true);
  });

  it("aplicar no exige motivo", () => {
    expect(motivoValido("aplicado")).toBe(true);
  });
});
