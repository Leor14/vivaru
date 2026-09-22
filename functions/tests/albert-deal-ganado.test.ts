import { describe, expect, it } from "vitest";
import { accionesPorDealGanado, textoDelAviso, type AccionesDeps, type ResumenGanado } from "../src/albert-deal-ganado";
import type { SenalGanado } from "../src/albert-senal-de-vuelta";

/**
 * Qué hace Vivaru cuando un deal se gana: **avisar y marcar, no actuar solo** (David, 22 sep).
 * Lo que se prueba: que el lead queda `convertido`, que el aviso sale aunque el lead no exista,
 * que ningún fallo tumba al otro paso, y que **NUNCA se da de alta un conjunto desde aquí**.
 */

const senal: SenalGanado = {
  dealId: "vl_abc",
  leadId: "lead-1",
  outcome: "won",
  amount: 159,
  closedAt: "2026-09-22T10:00:00Z",
  updatedAt: "2026-09-22T10:00:01Z",
};

const lead = { nombre: "Patricia Prueba", empresa: "Torre Tejerez", email: "patricia@ejemplo.vivaru.app", status: "nuevo" };

function deps(over: Partial<AccionesDeps> = {}) {
  const marcados: string[] = [];
  const avisos: Array<{ asunto: string; cuerpo: string }> = [];
  const base: AccionesDeps = {
    leerLead: async () => lead,
    marcarConvertido: async (leadId) => void marcados.push(leadId),
    avisar: async (asunto, cuerpo) => void avisos.push({ asunto, cuerpo }),
    ...over,
  };
  return { dep: base, marcados, avisos };
}

const TODO_BIEN: ResumenGanado = { leadEncontrado: true, leadMarcado: true, avisoEnviado: true, errores: [] };

describe("accionesPorDealGanado", () => {
  it("marca el lead como convertido y avisa al equipo", async () => {
    const d = deps();
    expect(await accionesPorDealGanado(senal, d.dep)).toEqual(TODO_BIEN);
    expect(d.marcados).toEqual(["lead-1"]);
    expect(d.avisos).toHaveLength(1);
    expect(d.avisos[0].asunto).toContain("Torre Tejerez");
  });

  it("avisa igual cuando el deal no trae lead nuestro", async () => {
    const d = deps({ leerLead: async () => null });
    const r = await accionesPorDealGanado({ ...senal, leadId: null }, d.dep);
    expect(r).toMatchObject({ leadEncontrado: false, leadMarcado: false, avisoEnviado: true, errores: [] });
    expect(d.marcados).toEqual([]);
    expect(d.avisos[0].cuerpo).toContain("no trae un lead de Vivaru");
  });

  it("avisa aunque el lead ya no exista", async () => {
    const d = deps({ leerLead: async () => null });
    const r = await accionesPorDealGanado(senal, d.dep);
    expect(r).toMatchObject({ leadEncontrado: false, leadMarcado: false, avisoEnviado: true });
  });

  it("si el correo falla, el lead se marca igual, y al revés", async () => {
    const soloCorreoRoto = deps({ avisar: async () => { throw new Error("resend caído"); } });
    const r1 = await accionesPorDealGanado(senal, soloCorreoRoto.dep);
    expect(r1).toMatchObject({ leadMarcado: true, avisoEnviado: false });
    expect(r1.errores[0]).toContain("avisar:");

    const soloMarcaRota = deps({ marcarConvertido: async () => { throw new Error("firestore caído"); } });
    const r2 = await accionesPorDealGanado(senal, soloMarcaRota.dep);
    expect(r2).toMatchObject({ leadMarcado: false, avisoEnviado: true });
    expect(r2.errores[0]).toContain("marcar_lead:");
  });

  it("nunca lanza, aunque falle todo", async () => {
    const d = deps({
      leerLead: async () => { throw new Error("uno"); },
      avisar: async () => { throw new Error("dos"); },
    });
    const r = await accionesPorDealGanado(senal, d.dep);
    expect(r).toMatchObject({ leadEncontrado: false, leadMarcado: false, avisoEnviado: false });
    expect(r.errores).toHaveLength(2);
  });
});

describe("textoDelAviso", () => {
  it("dice quién, cuánto y que el alta NO es automática", () => {
    const { asunto, cuerpo } = textoDelAviso(senal, lead, "");
    expect(asunto).toBe("Negocio ganado en Albert — Torre Tejerez · Patricia Prueba · patricia@ejemplo.vivaru.app");
    expect(cuerpo).toContain("Deal: vl_abc");
    expect(cuerpo).toContain("Lead de Vivaru: lead-1");
    expect(cuerpo).toContain("Importe: 159");
    expect(cuerpo).toContain("El alta del conjunto NO se hace sola");
  });

  it("marca el ambiente cuando no es producción", () => {
    expect(textoDelAviso(senal, lead, "[STAGING] ").asunto.startsWith("[STAGING] ")).toBe(true);
  });

  it("un deal sin cifra lo dice en vez de enseñar un 0", () => {
    expect(textoDelAviso({ ...senal, amount: 0 }, lead, "").cuerpo).toContain("Importe: sin cifra");
    expect(textoDelAviso({ ...senal, amount: null }, lead, "").cuerpo).toContain("Importe: sin cifra");
  });
});
