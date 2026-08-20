import { describe, expect, it } from "vitest";

import { MONEDA_POR_PAIS, PAISES_ACTIVOS, TARIFAS } from "@/lib/pricing/catalog";
import { compensacionCanal, resolverTarifa, segmentoPorUnidades } from "@/lib/pricing/resolve";

/**
 * `REVOPS-001C` — el precio, cableado.
 *
 * Estas pruebas fijan **las cifras de la guía maestra del 12 de agosto de 2026**.
 * Si alguna falla después de tocar el catálogo, la pregunta correcta no es «cómo
 * arreglo la prueba» sino «¿cambió la guía?». Si cambió, se actualizan las dos;
 * si no cambió, el catálogo está mal.
 *
 * Y la mitad de los casos son sobre **cuándo NO hay precio**, que es la parte que
 * de verdad protege: una cotización inventada no la revisa nadie, porque la
 * calculó el sistema.
 */

describe("segmento por número de unidades", () => {
  it("los tramos de la guía: emergente 50–100, core 101–200, enterprise 201+", () => {
    expect(segmentoPorUnidades(50)).toBe("emergente");
    expect(segmentoPorUnidades(100)).toBe("emergente");
    expect(segmentoPorUnidades(101)).toBe("core");
    expect(segmentoPorUnidades(200)).toBe("core");
    expect(segmentoPorUnidades(201)).toBe("enterprise");
    expect(segmentoPorUnidades(5000)).toBe("enterprise");
  });

  // La guía empieza a tarifar en 50. Un conjunto de 30 unidades no es
  // «emergente barato»: es un caso que nadie ha tarifado.
  it("por debajo de 50 no hay segmento, y eso NO es emergente", () => {
    expect(segmentoPorUnidades(49)).toBeNull();
    expect(segmentoPorUnidades(1)).toBeNull();
  });

  it("cero, negativos y basura no caen en ningún tramo", () => {
    expect(segmentoPorUnidades(0)).toBeNull();
    expect(segmentoPorUnidades(-10)).toBeNull();
    expect(segmentoPorUnidades(Number.NaN)).toBeNull();
    expect(segmentoPorUnidades(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("las cifras de la guía maestra, segmento Core y trimestral", () => {
  it("México: base 27, canal 24, final 51", () => {
    const r = resolverTarifa({ pais: "MX", unidades: 150, frecuencia: "trimestral" });
    expect(r).toMatchObject({
      estado: "tarifada",
      currency: "MXN",
      porUnidad: { base: 27, canal: 24, final: 51 },
    });
  });

  it("Colombia: base 5.100, canal 3.400, final 8.500", () => {
    const r = resolverTarifa({ pais: "CO", unidades: 150, frecuencia: "trimestral" });
    expect(r).toMatchObject({
      estado: "tarifada",
      currency: "COP",
      porUnidad: { base: 5100, canal: 3400, final: 8500 },
    });
  });

  it("Ecuador: base 1,90, canal 1,25, final 3,15", () => {
    const r = resolverTarifa({ pais: "EC", unidades: 150, frecuencia: "trimestral" });
    expect(r).toMatchObject({
      estado: "tarifada",
      currency: "USD",
      porUnidad: { base: 1.9, canal: 1.25, final: 3.15 },
    });
  });

  // La guía dice «base incluida» para Panamá, que no es un número. Derivarla
  // restando el 1,80 del reseller sería suponer que esas dos cifras son
  // complementarias, y la guía no lo dice.
  it("Panamá: final 3,77, y la base NO se inventa restando", () => {
    const r = resolverTarifa({ pais: "PA", unidades: 150, frecuencia: "trimestral" });
    expect(r).toMatchObject({ estado: "tarifada", porUnidad: { base: null, canal: null, final: 3.77 } });
  });
});

describe("el total, y el ruido de la coma flotante", () => {
  it("Colombia, 150 unidades: 1.275.000 al mes", () => {
    const r = resolverTarifa({ pais: "CO", unidades: 150, frecuencia: "trimestral" });
    expect(r.estado === "tarifada" && r.totalMensualReferencia).toBe(1_275_000);
  });

  // 3.15 * 150 en coma flotante no da 472.5 limpio. Sin redondeo, la cotización
  // saldría con una cola de decimales que parece un error de cálculo.
  it("Ecuador, 150 unidades: 472,5 exacto, sin cola de decimales", () => {
    const r = resolverTarifa({ pais: "EC", unidades: 150, frecuencia: "trimestral" });
    expect(r.estado === "tarifada" && r.totalMensualReferencia).toBe(472.5);
  });

  it("las unidades fraccionarias se truncan, no se cobran a medias", () => {
    const r = resolverTarifa({ pais: "MX", unidades: 150.9, frecuencia: "trimestral" });
    expect(r).toMatchObject({ estado: "tarifada", unidades: 150, totalMensualReferencia: 7650 });
  });
});

describe("cuándo el sistema dice que NO sabe", () => {
  it("emergente no tiene tarifa publicada, en ningún país", () => {
    for (const pais of PAISES_ACTIVOS) {
      const r = resolverTarifa({ pais, unidades: 80, frecuencia: "trimestral" });
      expect(r).toMatchObject({ estado: "sin-tarifa", segmento: "emergente" });
    }
  });

  it("enterprise tampoco", () => {
    const r = resolverTarifa({ pais: "MX", unidades: 250, frecuencia: "trimestral" });
    expect(r).toMatchObject({ estado: "sin-tarifa", segmento: "enterprise" });
  });

  // La guía dice que mensual existe y es más costosa, pero no publica cifra.
  // «Más costosa» no es un precio.
  it("mensual no tiene tarifa ni siquiera en Core, que es el segmento tarifado", () => {
    const r = resolverTarifa({ pais: "MX", unidades: 150, frecuencia: "mensual" });
    expect(r).toMatchObject({ estado: "sin-tarifa", segmento: "core" });
  });

  // Cuando no hay tarifa igual se resuelve el segmento: es lo que hace falta
  // para pedirla («nos falta Enterprise en México»), en vez de solo fallar.
  it("sin tarifa, el segmento igual se informa para poder reclamarla", () => {
    const r = resolverTarifa({ pais: "CO", unidades: 300, frecuencia: "trimestral" });
    expect(r.segmento).toBe("enterprise");
  });

  it("un conjunto por debajo de la segmentación no tiene ni segmento", () => {
    const r = resolverTarifa({ pais: "MX", unidades: 20, frecuencia: "trimestral" });
    expect(r).toMatchObject({ estado: "sin-tarifa", segmento: null });
  });
});

describe("coherencia del catálogo", () => {
  // Panamá y Ecuador comparten moneda, así que la moneda NO identifica al país.
  // Es justo el motivo por el que el conjunto tiene que guardar su país y no
  // basta con su currency.
  it("USD no distingue Panamá de Ecuador, y sus precios difieren", () => {
    expect(MONEDA_POR_PAIS.PA).toBe(MONEDA_POR_PAIS.EC);
    expect(TARIFAS.trimestral.core.PA?.finalCliente).not.toBe(TARIFAS.trimestral.core.EC?.finalCliente);
  });

  it("Panamá está tarifado pero NO activo — quedó en la nevera", () => {
    expect(TARIFAS.trimestral.core.PA).not.toBeNull();
    expect(PAISES_ACTIVOS).not.toContain("PA");
  });

  // Si alguien publica una base mayor que el final, el canal saldría negativo:
  // Vivaru le estaría pagando al canal más de lo que cobra el cliente.
  it("ninguna tarifa publicada deja al canal en negativo", () => {
    for (const porSegmento of Object.values(TARIFAS)) {
      for (const porPais of Object.values(porSegmento)) {
        for (const tarifa of Object.values(porPais)) {
          if (!tarifa) continue;
          const canal = compensacionCanal(tarifa);
          if (canal !== null) expect(canal).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
