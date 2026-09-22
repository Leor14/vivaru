import { describe, expect, it } from "vitest";
import {
  ambienteHabilitado,
  LIMITE_POR_PAGINA,
  PAGINAS_POR_EJECUCION,
  sondearSenales,
  validarRespuesta,
  type Dependencias,
  type Resumen,
  type SenalGanado,
} from "../src/albert-senal-de-vuelta";

/**
 * La señal de vuelta de Albert (`vivaruWonSignals`). Solo registra: lo que se prueba es
 * que cada deal ganado deja UNA fila, que el cursor no se pierde nada ni gira en vacío, y
 * que una respuesta rara no avanza el cursor.
 */

function senal(n: number, updatedAt = `2026-09-22T00:00:${String(n % 60).padStart(2, "0")}Z`): SenalGanado {
  return { dealId: `vl_${n}`, leadId: `lead-${n}`, outcome: "won", amount: 0, closedAt: updatedAt, updatedAt };
}

/** Albert simulado con la semántica del contrato: `since` INCLUSIVO, orden por `updatedAt`. */
function albertSimulado(todas: SenalGanado[]) {
  const pedidas: Array<string | null> = [];
  const pedirPagina: Dependencias["pedirPagina"] = async (since, limit) => {
    pedidas.push(since);
    const signals = [...todas]
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .filter((s) => since === null || s.updatedAt >= since)
      .slice(0, limit);
    return { ok: true, tenantId: "vivaru", count: signals.length, signals };
  };
  return { pedirPagina, pedidas };
}

function almacen(cursorInicial: string | null = null) {
  const filas = new Map<string, SenalGanado>();
  let cursor = cursorInicial;
  const guardados: Array<{ since: string | null; resumen: Resumen }> = [];
  return {
    filas,
    guardados,
    get cursor() {
      return cursor;
    },
    dep: {
      leerCursor: async () => cursor,
      registrar: async (s: SenalGanado) => {
        if (filas.has(s.dealId)) return false;
        filas.set(s.dealId, s);
        return true;
      },
      guardarCursor: async (since: string | null, resumen: Resumen) => {
        cursor = since;
        guardados.push({ since, resumen: { ...resumen } });
      },
    },
  };
}

describe("validarRespuesta", () => {
  const buena = { ok: true, tenantId: "vivaru", count: 1, signals: [senal(1)] };

  it("acepta la respuesta del contrato, con leadId null incluido", () => {
    expect(validarRespuesta(buena).signals).toHaveLength(1);
    const sinLead = { ...buena, signals: [{ ...senal(2), leadId: null }] };
    expect(validarRespuesta(sinLead).signals[0].leadId).toBeNull();
  });

  it("rechaza lo que no es una señal de ganado de Vivaru", () => {
    expect(() => validarRespuesta({ ...buena, ok: false })).toThrow("respuesta_sin_ok");
    expect(() => validarRespuesta({ ...buena, tenantId: "demo" })).toThrow("tenant_inesperado");
    expect(() => validarRespuesta({ ...buena, signals: {} })).toThrow("signals_no_es_lista");
    expect(() => validarRespuesta({ ...buena, signals: [{ ...senal(1), outcome: "lost" }] })).toThrow("outcome");
    expect(() => validarRespuesta({ ...buena, signals: [{ ...senal(1), updatedAt: "ayer" }] })).toThrow("updatedAt");
  });

  it("rechaza un dealId que nuestro validador de crmRef no aceptaría", () => {
    for (const dealId of ["a/b", "a:b", "abc=", ""]) {
      expect(() => validarRespuesta({ ...buena, signals: [{ ...senal(1), dealId }] })).toThrow("dealId");
    }
  });
});

describe("sondearSenales", () => {
  it("sin deals ganados no registra nada y deja el cursor como estaba", async () => {
    const albert = albertSimulado([]);
    const a = almacen();
    const r = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(r).toMatchObject({ paginas: 1, recibidas: 0, nuevas: 0, repetidas: 0, avisosFallidos: 0, sinAvance: false });
    expect(a.filas.size).toBe(0);
    expect(a.cursor).toBeNull();
    expect(albert.pedidas).toEqual([null]);
  });

  it("registra cada deal ganado UNA vez aunque se sondee dos veces", async () => {
    const albert = albertSimulado([senal(1), senal(2), senal(3)]);
    const a = almacen();
    const primera = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(primera).toMatchObject({ nuevas: 3, repetidas: 0 });
    expect(a.cursor).toBe(senal(3).updatedAt);

    // `since` es inclusivo: la segunda vuelta trae de nuevo el deal del borde.
    const segunda = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(segunda).toMatchObject({ recibidas: 1, nuevas: 0, repetidas: 1 });
    expect(a.filas.size).toBe(3);
  });

  it("pagina hasta vaciar y no pierde el deal del borde entre páginas", async () => {
    const total = LIMITE_POR_PAGINA + 30;
    const todas = Array.from({ length: total }, (_, i) =>
      senal(i, new Date(Date.UTC(2026, 8, 22, 0, 0, i)).toISOString()),
    );
    const albert = albertSimulado(todas);
    const a = almacen();
    const r = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(a.filas.size).toBe(total);
    expect(r.paginas).toBe(2);
    expect(r.nuevas).toBe(total);
    expect(r.repetidas).toBe(1); // el del borde, que vuelve por el `>=`
    expect(albert.pedidas[1]).toBe(todas[LIMITE_POR_PAGINA - 1].updatedAt);
  });

  it("no pasa de PAGINAS_POR_EJECUCION aunque queden señales", async () => {
    const total = LIMITE_POR_PAGINA * (PAGINAS_POR_EJECUCION + 2);
    const todas = Array.from({ length: total }, (_, i) =>
      senal(i, new Date(Date.UTC(2026, 8, 22, 0, 0, 0, i)).toISOString()),
    );
    const albert = albertSimulado(todas);
    const a = almacen();
    const r = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(r.paginas).toBe(PAGINAS_POR_EJECUCION);
    expect(albert.pedidas).toHaveLength(PAGINAS_POR_EJECUCION);
  });

  it("una página llena con el mismo updatedAt que el cursor corta y avisa en vez de girar", async () => {
    const mismo = "2026-09-22T01:00:00Z";
    const todas = Array.from({ length: LIMITE_POR_PAGINA + 5 }, (_, i) => senal(i, mismo));
    const albert = albertSimulado(todas);
    const a = almacen(mismo);
    const r = await sondearSenales({ ...a.dep, pedirPagina: albert.pedirPagina });
    expect(r.sinAvance).toBe(true);
    expect(albert.pedidas).toHaveLength(1);
    expect(a.cursor).toBe(mismo);
  });

  it("si la respuesta es inválida no registra nada ni mueve el cursor", async () => {
    const a = almacen("2026-09-22T00:00:00Z");
    const pedirPagina: Dependencias["pedirPagina"] = async () =>
      ({ ok: true, tenantId: "vivaru", count: 2, signals: [senal(1), { ...senal(2), outcome: "open" }] }) as never;
    await expect(sondearSenales({ ...a.dep, pedirPagina })).rejects.toThrow("outcome");
    expect(a.filas.size).toBe(0);
    expect(a.guardados).toHaveLength(0);
  });

  it("si registrar falla a mitad de página, el cursor no avanza y la siguiente vuelta lo repite", async () => {
    const albert = albertSimulado([senal(1), senal(2), senal(3)]);
    const a = almacen();
    let fallar = true;
    const registrar: Dependencias["registrar"] = async (s) => {
      if (fallar && s.dealId === "vl_2") throw new Error("firestore caído");
      return a.dep.registrar(s);
    };
    await expect(sondearSenales({ ...a.dep, registrar, pedirPagina: albert.pedirPagina })).rejects.toThrow();
    expect(a.cursor).toBeNull();

    fallar = false;
    const r = await sondearSenales({ ...a.dep, registrar, pedirPagina: albert.pedirPagina });
    expect(a.filas.size).toBe(3);
    expect(r).toMatchObject({ nuevas: 2, repetidas: 1 });
  });
});

describe("las acciones del deal ganado", () => {
  it("corren UNA vez por deal: la segunda vuelta no vuelve a avisar", async () => {
    const albert = albertSimulado([senal(1), senal(2)]);
    const a = almacen();
    const vistos: string[] = [];
    const dep = { ...a.dep, pedirPagina: albert.pedirPagina, alVerPorPrimeraVez: async (s: SenalGanado) => void vistos.push(s.dealId) };
    await sondearSenales(dep);
    expect(vistos).toEqual(["vl_1", "vl_2"]);
    await sondearSenales(dep);
    expect(vistos).toEqual(["vl_1", "vl_2"]);
  });

  it("si el aviso falla, la señal QUEDA registrada y el cursor avanza igual", async () => {
    const albert = albertSimulado([senal(1)]);
    const a = almacen();
    const r = await sondearSenales({
      ...a.dep,
      pedirPagina: albert.pedirPagina,
      alVerPorPrimeraVez: async () => { throw new Error("resend caído"); },
    });
    expect(r).toMatchObject({ nuevas: 1, avisosFallidos: 1 });
    expect(a.filas.has("vl_1")).toBe(true);
    expect(a.cursor).toBe(senal(1).updatedAt);
  });
});

describe("ambienteHabilitado", () => {
  it("la consulta vive en PRODUCCIÓN; staging ya no lee el CRM real (David, 22 sep)", () => {
    expect(ambienteHabilitado("hogaru-1")).toBe(true);
    // Albert retira el acceso de staging al tenant real: si esto siguiera en true,
    // la consulta de staging daría 403 cada 10 minutos.
    expect(ambienteHabilitado("vivaru-staging-02")).toBe(false);
    expect(ambienteHabilitado("")).toBe(false);
  });
});
