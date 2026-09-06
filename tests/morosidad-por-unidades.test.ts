import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { baseDeMorosidad } from "../src/features/billing/collection";

/**
 * **El informe del consejo decía «106% de unidades · 19/18».**
 *
 * Visto en producción el 6 de septiembre de 2026, en el tablero ejecutivo de
 * `Conjunto Residencial Santa Maria`. Un porcentaje de unidades por encima de
 * 100 es imposible por definición, y salía en el documento que se le presenta al
 * consejo y a la asamblea.
 *
 * **La causa, medida:** el conjunto tiene 19 unidades —18 `active` y 1
 * `inactive`— y **las 19 tienen cargos vencidos**, incluida la inactiva
 * (`T1-202`, con $2.240.000 de deuda). El numerador recorría los cargos sin
 * mirar el estado de la unidad; el denominador contaba solo las activas. **El
 * numerador no cabía en el denominador.**
 *
 * **Por qué se ensancha el denominador y NO se filtra el numerador:** filtrar
 * dejaría a `T1-202` fuera de «Mayores deudores» —escondiendo $2.240.000 que
 * alguien debe— y contradiría el «Total vencido», que sí lo cuenta. Una unidad
 * inactiva que debe sigue debiendo.
 */
describe("`baseDeMorosidad` — el denominador contiene al numerador", () => {
  const activas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `u${i}`, status: "active" }));

  it("cuenta las unidades activas cuando nadie debe", () => {
    expect(baseDeMorosidad(activas(18), [])).toBe(18);
  });

  /** El caso exacto de producción: 18 activas + 1 inactiva, y las 19 deben. */
  it("una unidad INACTIVA que debe entra en la base", () => {
    const unidades = [...activas(18), { id: "inactiva", status: "inactive" }];
    const conMora = unidades.map((u) => u.id);
    expect(baseDeMorosidad(unidades, conMora)).toBe(19);
    expect(Math.round((conMora.length / baseDeMorosidad(unidades, conMora)) * 100)).toBe(100);
  });

  it("y sin el arreglo eso daba 106%, que es el defecto", () => {
    const unidades = [...activas(18), { id: "inactiva", status: "inactive" }];
    const soloActivas = unidades.filter((u) => u.status === "active").length;
    expect(Math.round((19 / soloActivas) * 100)).toBe(106);
  });

  it("no infla la base con unidades activas que no deben", () => {
    const unidades = activas(18);
    expect(baseDeMorosidad(unidades, ["u0", "u1"])).toBe(18);
    expect(Math.round((2 / baseDeMorosidad(unidades, ["u0", "u1"])) * 100)).toBe(11);
  });

  /**
   * **Robustez contra la trampa de los identificadores de unidad**, que en este
   * repositorio ya costó cinco unidades desaparecidas: conviven `unit-t1-101`,
   * `t1-101`, `1014` e ids sembrados que PARECEN slugs. Si un `unitId` de un
   * cargo no casa con ningún documento de `units`, sigue entrando en la base —
   * así el porcentaje no puede pasar de 100 ni con los datos torcidos.
   */
  it("un `unitId` que no existe en `units` también entra en la base", () => {
    expect(baseDeMorosidad(activas(3), ["u0", "fantasma"])).toBe(4);
  });

  it("no repite una unidad que está activa Y debe", () => {
    expect(baseDeMorosidad(activas(3), ["u0", "u0", "u1"])).toBe(3);
  });

  it("sin unidades es cero, y el que divide tiene que protegerse", () => {
    expect(baseDeMorosidad([], [])).toBe(0);
  });

  /** La propiedad que resume todo: la tasa nunca puede pasar de 100. */
  it("la tasa nunca supera el 100% con ningún reparto", () => {
    const casos: Array<[number, number, number]> = [
      [18, 1, 19], [5, 0, 5], [0, 3, 3], [10, 2, 4],
    ];
    for (const [nActivas, nInactivasConMora, nConMora] of casos) {
      const unidades = [
        ...activas(nActivas),
        ...Array.from({ length: nInactivasConMora }, (_, i) => ({ id: `x${i}`, status: "inactive" })),
      ];
      const conMora = unidades.slice(0, nConMora).map((u) => u.id);
      const base = baseDeMorosidad(unidades, conMora);
      const tasa = base > 0 ? Math.round((conMora.length / base) * 100) : 0;
      expect(tasa).toBeLessThanOrEqual(100);
    }
  });
});

/** Fuera comentarios y espacios: un comentario no puede satisfacer una prueba. */
function esqueleto(cuerpo: string): string {
  return cuerpo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "").trim();
}

describe("el cableado: la tasa y la fracción usan el MISMO denominador", () => {
  it("el informe calcula la tasa sobre la base, no sobre las activas", () => {
    const hook = esqueleto(fs.readFileSync(path.resolve("src/features/reports/use-committee-report.ts"), "utf8"));
    expect(hook).toContain("constdelinquencyBase=baseDeMorosidad(");
    expect(hook).not.toContain("Math.round((overdueUnits.length/activeUnitsCount)*100)");
  });

  /**
   * **El segundo sitio, que es el que se VE.** El «19/18» de la pantalla no sale
   * del cálculo: lo pinta la tarjeta con `executive.activeUnits`. Arreglar solo
   * la tasa habría dejado «100% de unidades · 19/18» — el número corregido y la
   * fracción todavía imposible.
   */
  it("la tarjeta pinta la fracción con esa misma base", () => {
    const pagina = esqueleto(fs.readFileSync(path.resolve("src/app/(admin)/admin/reports/page.tsx"), "utf8"));
    expect(pagina).toContain("report.billing.overdueUnits.length}/${report.executive.delinquencyBase");
    expect(pagina).not.toContain("report.billing.overdueUnits.length}/${report.executive.activeUnits");
  });

  /**
   * **El pie que explica la métrica también cuenta.** Decía «sobre unidades
   * ACTIVAS», que describía la fórmula vieja; al ensanchar el denominador esa
   * frase se volvió falsa — y la habría dejado yo. Un texto que describe una
   * fórmula que ya no existe es la misma clase de defecto que un comentario que
   * justifica una desviación: se lee el día que se escribe y ninguno más.
   */
  it("el pie de la tarjeta describe el denominador que se usa de verdad", () => {
    const pagina = fs.readFileSync(path.resolve("src/app/(admin)/admin/reports/page.tsx"), "utf8");
    expect(pagina).toContain("sobre las unidades activas y las que deben");
    expect(pagina).not.toContain("saldo vencido sobre unidades activas;");
  });

  /** `activeUnitsCount` SIGUE siendo solo las activas donde debe serlo: las
   *  firmas esperadas de un acuerdo se piden a las unidades activas, no a las
   *  que deben dinero. Ensanchar aquel contador habría pedido firma a una unidad
   *  inactiva y bajado el «% de firma» sin motivo. */
  it("las firmas esperadas siguen contando solo unidades activas", () => {
    const hook = esqueleto(fs.readFileSync(path.resolve("src/features/reports/use-committee-report.ts"), "utf8"));
    expect(hook).toContain("constactiveUnitsCount=units.filter((u)=>u.status===\"active\").length");
    expect(hook).toContain("a.signerUnitIds?.length??0):activeUnitsCount");
  });
});
