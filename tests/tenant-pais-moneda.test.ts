import { describe, expect, it } from "vitest";

import { currencyForCountry } from "@/lib/currency";
import { PLAN_SERVICIO_COMPLETO, PLAN_TRIAL } from "@/lib/pricing/catalog";

/**
 * El país del conjunto y la moneda que se deriva de él.
 *
 * Esto existe por un defecto concreto: `createTenantWorkspace` tiene lista
 * blanca de campos y **no escribía `currency`**, aunque el formulario sí la
 * recogía. Como la lectura la defaultea a `"COP"`, todo conjunto creado desde la
 * consola nacía colombiano — y el defecto se tapaba a sí mismo, porque nunca
 * había un hueco visible, solo un valor equivocado.
 *
 * `currencyForCountry` es **gemelo** de `functions/src/country-currency.ts`. No
 * se puede importar de allí (rompe el build de App Hosting), así que estas
 * pruebas son lo que impide que se separen sin que nadie lo note.
 */

describe("moneda derivada del país", () => {
  it("los tres mercados con moneda propia", () => {
    expect(currencyForCountry("CO")).toBe("COP");
    expect(currencyForCountry("MX")).toBe("MXN");
    expect(currencyForCountry("EC")).toBe("USD");
  });

  it("los dolarizados no son un supuesto: Panamá y El Salvador usan USD", () => {
    expect(currencyForCountry("PA")).toBe("USD");
    expect(currencyForCountry("SV")).toBe("USD");
  });

  it("acepta minúsculas, que es lo que llega de un formulario", () => {
    expect(currencyForCountry("mx")).toBe("MXN");
    expect(currencyForCountry("co")).toBe("COP");
  });

  // El atajo viejo era `pais === "CO" ? "COP" : "MXN"`, y con él un conjunto en
  // Chile habría emitido cobros en pesos mexicanos.
  it("un país fuera de los mercados actuales cae en USD, no en MXN", () => {
    expect(currencyForCountry("CL")).toBe("USD");
    expect(currencyForCountry("AR")).toBe("USD");
  });

  it("sin país devuelve MXN, igual que el gemelo de functions", () => {
    expect(currencyForCountry(undefined)).toBe("MXN");
    expect(currencyForCountry("")).toBe("MXN");
  });
});

describe("el vocabulario de planes, después de reconciliarlo", () => {
  // Vivaru se vende como un solo servicio. Estos dos valores son los ÚNICOS que
  // debería escribir el sistema; starter/plus/premium describían un producto que
  // no existe y ya no se ofrecen en la consola.
  it("solo hay dos: en prueba y contratado", () => {
    expect(PLAN_TRIAL).toBe("trial");
    expect(PLAN_SERVICIO_COMPLETO).toBe("completo");
  });

  // Espejo de TRIAL_PLAN_ID y FULL_SERVICE_PLAN_ID en
  // functions/src/trial-workspace.ts. Si divergen, un conjunto convertido por el
  // trial y uno creado a mano dejan de parecerse.
  it("no son ninguno de los del vocabulario antiguo", () => {
    for (const viejo of ["starter", "plus", "premium"]) {
      expect(PLAN_TRIAL).not.toBe(viejo);
      expect(PLAN_SERVICIO_COMPLETO).not.toBe(viejo);
    }
  });
});
