import { describe, expect, it } from "vitest";

import {
  CONCEPTOS_DE_CARGO,
  CUENTA_OTROS_INGRESOS,
  SEMILLA_PLAN_DE_CUENTAS,
  codigoPadreDe,
  cuentaParaConcepto,
  cuentaPorSystemKey,
  docIdDeCuenta,
  validarCodigoDeCuenta,
} from "../src/plan-de-cuentas";

/**
 * Lo que estas pruebas cuidan no es el formato: es **en qué cuenta cae el
 * dinero**. Los dos huecos que corrigió la 1.1 de la PRD viven aquí, y los dos
 * eran silenciosos — ni rompían el build ni daban error en pantalla.
 */

/** Las 13 categorías que el libro ya usaba antes de esta PRD. Ninguna puede perderse. */
const LEDGER_CATEGORY_ANTES = [
  "nomina", "servicios_publicos", "mantenimiento", "proveedores",
  "administracion", "seguros", "impuestos", "otros",
  "alicuota", "extraordinaria", "interes_mora", "arriendo", "otros_ingresos",
];

describe("validarCodigoDeCuenta — el defecto de Habitanto fue no validar", () => {
  it("acepta un nivel y dos niveles", () => {
    expect(validarCodigoDeCuenta("1")).toEqual({ ok: true, code: "1" });
    expect(validarCodigoDeCuenta("3.23")).toEqual({ ok: true, code: "3.23" });
    expect(validarCodigoDeCuenta("  1.2  ")).toEqual({ ok: true, code: "1.2" });
  });

  it("rechaza el tercer nivel: el MVP es de dos", () => {
    expect(validarCodigoDeCuenta("1.2.3").ok).toBe(false);
  });

  it("rechaza los puntos de más, que es literalmente lo que se le ensució a Habitanto", () => {
    expect(validarCodigoDeCuenta("3.").ok).toBe(false);
    expect(validarCodigoDeCuenta(".9").ok).toBe(false);
    expect(validarCodigoDeCuenta("3..9").ok).toBe(false);
  });

  it("rechaza ceros a la izquierda — 03 y 3 serían dos cuentas distintas con el mismo sitio", () => {
    expect(validarCodigoDeCuenta("03").ok).toBe(false);
    expect(validarCodigoDeCuenta("3.09").ok).toBe(false);
    expect(validarCodigoDeCuenta("0").ok).toBe(false);
  });

  it("rechaza lo que no es numérico, y dice por qué (CF5)", () => {
    const r = validarCodigoDeCuenta("CAJA");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("1.2");
  });

  it("rechaza el vacío", () => {
    expect(validarCodigoDeCuenta("").ok).toBe(false);
    expect(validarCodigoDeCuenta("   ").ok).toBe(false);
  });
});

describe("la semilla", () => {
  it("son 18 documentos: 16 cuentas con systemKey y 2 padres", () => {
    expect(SEMILLA_PLAN_DE_CUENTAS).toHaveLength(18);
    expect(SEMILLA_PLAN_DE_CUENTAS.filter((c) => c.systemKey)).toHaveLength(16);
  });

  it("no pierde ninguna de las 13 categorías que el libro ya usaba", () => {
    for (const key of LEDGER_CATEGORY_ANTES) {
      expect(cuentaPorSystemKey(key), `falta la cuenta de ${key}`).toBeDefined();
    }
  });

  it("añade las tres que faltaban, y por eso la métrica de éxito es alcanzable", () => {
    for (const key of ["multa", "reparacion", "parqueadero"]) {
      const cuenta = cuentaPorSystemKey(key);
      expect(cuenta?.type).toBe("ingreso");
    }
  });

  it("no repite códigos ni systemKeys", () => {
    const codes = SEMILLA_PLAN_DE_CUENTAS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    const keys = SEMILLA_PLAN_DE_CUENTAS.map((c) => c.systemKey).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todos los códigos pasan su propia validación", () => {
    for (const c of SEMILLA_PLAN_DE_CUENTAS) {
      expect(validarCodigoDeCuenta(c.code).ok, `${c.code} no valida`).toBe(true);
    }
  });

  it("toda cuenta hija declara un padre que existe y coincide con su código", () => {
    const codes = new Set(SEMILLA_PLAN_DE_CUENTAS.map((c) => c.code));
    for (const c of SEMILLA_PLAN_DE_CUENTAS) {
      expect(c.parentCode).toBe(codigoPadreDe(c.code));
      if (c.parentCode) expect(codes.has(c.parentCode)).toBe(true);
    }
  });

  it("el padre y la hija son del mismo tipo", () => {
    const porCodigo = new Map(SEMILLA_PLAN_DE_CUENTAS.map((c) => [c.code, c]));
    for (const c of SEMILLA_PLAN_DE_CUENTAS) {
      if (c.parentCode) expect(c.type).toBe(porCodigo.get(c.parentCode)?.type);
    }
  });

  it("mata la discrepancia de etiquetas: una sola forma de «Intereses de mora»", () => {
    expect(cuentaPorSystemKey("interes_mora")?.name).toBe("Intereses de mora");
  });
});

describe("cuentaParaConcepto — R11, y las dos resoluciones que no son obvias", () => {
  it("LOS SIETE conceptos tienen cuenta propia: ninguno cae en R8", () => {
    for (const concepto of CONCEPTOS_DE_CARGO) {
      const r = cuentaParaConcepto(concepto);
      expect(r.porDefecto, `${concepto} cae en otros_ingresos`).toBe(false);
    }
  });

  it("el cargo `administracion` va a la cuenta de INGRESO, no a la de egreso homónima (CA12)", () => {
    const r = cuentaParaConcepto("administracion");
    expect(r.code).toBe("1.1");
    expect(cuentaPorSystemKey("alicuota")?.code).toBe("1.1");
    // Y la trampa, dicha al revés: la de egreso existe y NO es ésta.
    expect(cuentaPorSystemKey("administracion")?.code).toBe("2.5");
  });

  it("el cargo `otro` va a otros ingresos, no a «Otros egresos»", () => {
    expect(cuentaParaConcepto("otro").code).toBe(CUENTA_OTROS_INGRESOS);
    expect(cuentaPorSystemKey("otros")?.code).toBe("2.8");
  });

  it("una multa va a multas — el caso de CA3 y de la métrica de éxito", () => {
    expect(cuentaParaConcepto("multa").code).toBe("1.3");
  });

  it("un cargo sin concepto es cuota de administración, que es el default del campo", () => {
    expect(cuentaParaConcepto(undefined)).toEqual({ code: "1.1", porDefecto: false });
    expect(cuentaParaConcepto(null)).toEqual({ code: "1.1", porDefecto: false });
    expect(cuentaParaConcepto("")).toEqual({ code: "1.1", porDefecto: false });
  });

  it("un concepto desconocido cae en otros ingresos Y SE MARCA, para que alguien avise (R8/CA9)", () => {
    const r = cuentaParaConcepto("criptomonedas");
    expect(r).toEqual({ code: CUENTA_OTROS_INGRESOS, porDefecto: true });
  });

  it("toda cuenta del mapa existe en la semilla y es de ingreso", () => {
    for (const concepto of CONCEPTOS_DE_CARGO) {
      const { code } = cuentaParaConcepto(concepto);
      const cuenta = SEMILLA_PLAN_DE_CUENTAS.find((c) => c.code === code);
      expect(cuenta?.type, `${concepto} → ${code}`).toBe("ingreso");
    }
  });
});

describe("docIdDeCuenta — la unicidad la garantiza la base, no el cliente", () => {
  it("deriva el id del código", () => {
    expect(docIdDeCuenta("tenant-santa-maria", "1.1")).toBe("tenant-santa-maria_1.1");
  });

  it("dos conjuntos pueden tener el mismo código sin chocar", () => {
    expect(docIdDeCuenta("a", "1.1")).not.toBe(docIdDeCuenta("b", "1.1"));
  });
});
