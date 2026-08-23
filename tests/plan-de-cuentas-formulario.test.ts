import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  codigoPadreDe,
  compararCodigos,
  docIdDeCuenta,
  validarCodigoDeCuenta,
} from "@/lib/finanzas/codigo-de-cuenta";
import {
  hijasActivasDe,
  validarCuentaNueva,
  esCuentaDeSistema,
  type ChartAccount,
} from "@/features/finanzas/use-chart-of-accounts";

/**
 * El formulario del plan de cuentas (`PRD-V-PLAT-003` entrega 2).
 *
 * La primera mitad vigila el ESPEJO: `src/lib/finanzas/codigo-de-cuenta.ts` copia
 * a mano el gobierno del código que decide `functions/src/plan-de-cuentas.ts`,
 * porque `src/` no puede importar de `functions/`. La segunda prueba las reglas
 * que las de Firestore no pueden comprobar.
 */

const FUENTE = path.resolve("functions/src/plan-de-cuentas.ts");

/** Extrae el literal de la expresión regular del código, como texto. */
function patronDeFunctions(): string {
  const texto = fs.readFileSync(FUENTE, "utf8");
  const m = texto.match(/const CODIGO_PATTERN = (\/.+\/);/);
  if (!m) throw new Error("No encuentro CODIGO_PATTERN en functions/src/plan-de-cuentas.ts");
  return m[1];
}

function patronDeSrc(): string {
  const texto = fs.readFileSync(path.resolve("src/lib/finanzas/codigo-de-cuenta.ts"), "utf8");
  const m = texto.match(/const CODIGO_PATTERN = (\/.+\/);/);
  if (!m) throw new Error("No encuentro CODIGO_PATTERN en el espejo");
  return m[1];
}

describe("el espejo del código de cuenta no puede divergir", () => {
  it("los dos lados usan LA MISMA expresión, carácter a carácter", () => {
    expect(
      patronDeSrc(),
      "el formato del código divergió entre functions/ y src/: uno aceptaría un " +
        "código que el otro rechaza, y el que manda es el servidor",
    ).toBe(patronDeFunctions());
  });

  it("el id derivado se construye igual en los dos lados", () => {
    const texto = fs.readFileSync(FUENTE, "utf8");
    // La regla de Firestore exige `docId == tenantId + '_' + code`. Si un lado
    // cambiara el separador, la escritura se rechazaría con permission-denied,
    // que se lee como «no tienes permiso» y no como «el id está mal formado».
    expect(texto).toContain("return `${tenantId}_${code}`;");
    expect(docIdDeCuenta("conjunto-las-playas", "1.3")).toBe("conjunto-las-playas_1.3");
  });
});

describe("el formato del código — D1, opción A", () => {
  it("acepta un nivel y dos niveles", () => {
    expect(validarCodigoDeCuenta("1").ok).toBe(true);
    expect(validarCodigoDeCuenta("1.2").ok).toBe(true);
    expect(validarCodigoDeCuenta("999.999").ok).toBe(true);
  });

  it("recorta los espacios en vez de rechazar por ellos", () => {
    const r = validarCodigoDeCuenta("  2.3  ");
    expect(r.ok && r.code).toBe("2.3");
  });

  // Los tres defectos medidos en el plan de Habitanto, uno por uno.
  it("rechaza el tercer nivel, los ceros a la izquierda y el punto de más", () => {
    for (const malo of ["1.2.3", "01", "1.02", "1.", ".1", "1..2", "3,9", "abc", ""]) {
      expect(validarCodigoDeCuenta(malo).ok, `«${malo}» debería rechazarse`).toBe(false);
    }
  });

  it("cuando rechaza, DICE qué falla (CF5)", () => {
    const r = validarCodigoDeCuenta("1.2.3");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(20);
  });

  it("el padre se deduce del código, no se elige", () => {
    expect(codigoPadreDe("1.3")).toBe("1");
    expect(codigoPadreDe("2")).toBeUndefined();
  });

  it("ordena por número y no como texto: la 1.2 va antes que la 1.10", () => {
    const ordenado = ["1.10", "2", "1.2", "1"].sort(compararCodigos);
    expect(ordenado).toEqual(["1", "1.2", "1.10", "2"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const PLAN: ChartAccount[] = [
  { id: "t_1", tenantId: "t", code: "1", name: "Ingresos", type: "ingreso", status: "active" },
  { id: "t_1.1", tenantId: "t", code: "1.1", name: "Cuotas de administración", type: "ingreso", parentCode: "1", systemKey: "alicuota", status: "active" },
  { id: "t_1.3", tenantId: "t", code: "1.3", name: "Multas", type: "ingreso", parentCode: "1", systemKey: "multa", status: "inactive" },
  { id: "t_2", tenantId: "t", code: "2", name: "Egresos", type: "egreso", status: "active" },
  { id: "t_2.1", tenantId: "t", code: "2.1", name: "Nómina", type: "egreso", parentCode: "2", systemKey: "nomina", status: "active" },
];

describe("crear una cuenta — las tres cosas que pueden fallar", () => {
  it("crea una cuenta válida y deduce su padre", () => {
    const r = validarCuentaNueva({ code: "1.9", name: "Cuota de vigilancia", type: "ingreso" }, PLAN);
    expect(r).toEqual({ ok: true, code: "1.9", parentCode: "1" });
  });

  it("CF1 — un código repetido se rechaza nombrándolo", () => {
    const r = validarCuentaNueva({ code: "1.1", name: "Otra cosa", type: "ingreso" }, PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1.1");
  });

  it("CF1 — y también contra una cuenta INACTIVA, que sigue ocupando su número", () => {
    // Si el código de una cuenta desactivada se pudiera reutilizar, sus asientos
    // históricos pasarían a agruparse bajo un rubro que no es el suyo.
    const r = validarCuentaNueva({ code: "1.3", name: "Recargos", type: "ingreso" }, PLAN);
    expect(r.ok).toBe(false);
  });

  it("CF5 — el formato inválido se rechaza diciendo por qué", () => {
    const r = validarCuentaNueva({ code: "1.2.3", name: "Algo", type: "ingreso" }, PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("1.2");
  });

  it("una hija sin padre se rechaza diciendo qué cuenta falta", () => {
    const r = validarCuentaNueva({ code: "7.1", name: "Algo", type: "ingreso" }, PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("7");
  });

  /**
   * Es el mismo defecto que R11 previene en el mapa de conceptos: si la `2.9`
   * pudiera nacer como ingreso colgando de «Egresos», su importe sumaría al
   * total de ingresos mientras se muestra bajo el árbol de egresos. Nada en la
   * pantalla lo delataría, y el descuadre no tendría explicación visible.
   */
  it("una hija no puede ser de distinto tipo que su padre", () => {
    const r = validarCuentaNueva({ code: "2.9", name: "Cuota rara", type: "ingreso" }, PLAN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2");
  });

  it("el nombre no puede quedarse en dos letras", () => {
    expect(validarCuentaNueva({ code: "1.9", name: "ab", type: "ingreso" }, PLAN).ok).toBe(false);
  });
});

describe("desactivar — CF6 y R3", () => {
  it("CF6 — una cuenta padre con hijas activas no se puede desactivar, y se dice cuáles", () => {
    const padre = PLAN.find((c) => c.code === "1")!;
    const hijas = hijasActivasDe(padre, PLAN);
    expect(hijas.map((h) => h.code)).toEqual(["1.1"]);
  });

  it("las hijas INACTIVAS no cuentan: si todas lo están, el padre ya se puede desactivar", () => {
    const soloInactivas = PLAN.map((c) =>
      c.code === "1.1" ? { ...c, status: "inactive" as const } : c,
    );
    const padre = soloInactivas.find((c) => c.code === "1")!;
    expect(hijasActivasDe(padre, soloInactivas)).toEqual([]);
  });

  it("una cuenta hija nunca tiene hijas: la jerarquía es de un nivel", () => {
    const hija = PLAN.find((c) => c.code === "1.1")!;
    expect(hijasActivasDe(hija, PLAN)).toEqual([]);
  });

  it("R3 — lo que hace de sistema a una cuenta es su systemKey, no su código", () => {
    expect(esCuentaDeSistema(PLAN.find((c) => c.code === "1.1")!)).toBe(true);
    // Las dos cuentas padre son estructura y NO llevan systemKey: son las únicas
    // de la semilla que la interfaz no marca como estándar.
    expect(esCuentaDeSistema(PLAN.find((c) => c.code === "1")!)).toBe(false);
  });
});
