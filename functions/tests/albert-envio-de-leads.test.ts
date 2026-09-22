import { describe, expect, it } from "vitest";
import {
  camposParaElLead,
  construirPeticion,
  modoDelAmbiente,
  procesarLead,
  unidadesEstimadas,
  type Envio,
  type PeticionPush,
  type RespuestaPush,
} from "../src/albert-envio-de-leads";

/**
 * El envío de leads a Albert (`vivaruPushLead`). Lo que se prueba: que un lead real de cada
 * origen se traduce al contrato, que lo que falta se omite con motivo en vez de mandarse roto,
 * que staging nunca escribe de verdad y producción no envía, y que un fallo queda en el lead.
 */

const CONSENT = {
  granted: true,
  at: "2026-09-22T12:00:00.000Z",
  policyVersion: "1.0",
  policyUrl: "/legal/privacidad",
  method: "explicit_checkbox",
};

/** Como lo escribe `persistLead` desde `/api/demo`. */
const leadDemo = {
  origen: "demo",
  nombre: "  Ana Prueba ",
  email: "Ana.Prueba@Ejemplo.Vivaru.App",
  telefono: "+57 300 123 4567",
  empresa: "Conjunto Las Palmas",
  cargo: "Administradora",
  unidadesEstimadas: "120",
  consent: CONSENT,
  attribution: { utm_source: "google" },
  status: "nuevo",
};

/** Como lo escribe `persistLead` desde `/api/lead` (diagnóstico). */
const leadDiagnostico = {
  origen: "diagnostico",
  nombre: "Luis Prueba",
  email: "luis@ejemplo.vivaru.app",
  telefono: "3001234567",
  empresa: "Torre Norte",
  unidadesEstimadas: 250,
  consent: CONSENT,
};

/** Como lo escribe `trial-workspace.ts`: sin consentimiento. */
const leadTrial = {
  origen: "trial",
  nombre: "Eva Prueba",
  email: "eva@ejemplo.vivaru.app",
  pais: "mx",
  empresa: "Privada Sur",
};

function respuesta(dryRun: boolean, extra: Partial<RespuestaPush> = {}): RespuestaPush {
  return { ok: true, dryRun, created: true, dealId: "vl_abc123", contactId: "vc_def456", contactReused: false, ...extra };
}

function envioQueResponde(r: RespuestaPush | Error) {
  const llamadas: Array<{ peticion: PeticionPush; dryRun: boolean }> = [];
  const enviar: Envio = async (peticion, dryRun) => {
    llamadas.push({ peticion, dryRun });
    if (r instanceof Error) throw r;
    return r;
  };
  return { enviar, llamadas };
}

describe("construirPeticion", () => {
  it("traduce un lead de demo al contrato, sin la atribución ni datos de más", () => {
    const r = construirPeticion("lead-1", leadDemo);
    expect(r).toEqual({
      ok: true,
      peticion: {
        contact: {
          name: "Ana Prueba",
          email: "ana.prueba@ejemplo.vivaru.app",
          phone: "+57 300 123 4567",
          company: "Conjunto Las Palmas",
          jobTitle: "Administradora",
          consent: { policyVersion: "1.0", acceptedAt: "2026-09-22T12:00:00.000Z" },
        },
        deal: { externalRef: { system: "vivaru", leadId: "lead-1" }, estimatedUnits: 120, amount: 0, origin: "demo" },
      },
    });
  });

  it("traduce un lead de diagnóstico con las unidades numéricas", () => {
    const r = construirPeticion("lead-2", leadDiagnostico);
    expect(r.ok && r.peticion.deal).toMatchObject({ estimatedUnits: 250, origin: "diagnostico" });
    expect(r.ok && r.peticion.contact.phone).toBe("3001234567");
  });

  it("omite con motivo lo que el contrato exige y falta", () => {
    expect(construirPeticion("l", leadTrial)).toEqual({ ok: false, motivo: "sin_consentimiento" });
    expect(construirPeticion("l", { ...leadDemo, consent: { ...CONSENT, granted: false } })).toMatchObject({ motivo: "sin_consentimiento" });
    expect(construirPeticion("l", { ...leadDemo, consent: { ...CONSENT, at: "ayer" } })).toMatchObject({ motivo: "sin_consentimiento" });
    expect(construirPeticion("l", { ...leadDemo, origen: "feria" })).toMatchObject({ motivo: "origen_desconocido" });
    expect(construirPeticion("l", { ...leadDemo, nombre: "A" })).toMatchObject({ motivo: "nombre_invalido" });
    expect(construirPeticion("l", { ...leadDemo, email: "no-es-correo" })).toMatchObject({ motivo: "email_invalido" });
  });

  it("deja fuera lo opcional que viene mal sin perder el lead", () => {
    const r = construirPeticion("l", { ...leadDemo, telefono: "llamar tarde", unidadesEstimadas: "50-100", cargo: "  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.peticion.contact).not.toHaveProperty("phone");
    expect(r.peticion.contact).not.toHaveProperty("jobTitle");
    expect(r.peticion.deal).not.toHaveProperty("estimatedUnits");
  });

  it("manda el país solo si es ISO-2", () => {
    const conPais = construirPeticion("l", { ...leadDemo, pais: "mx" });
    expect(conPais.ok && conPais.peticion.deal.country).toBe("MX");
    const sinPais = construirPeticion("l", { ...leadDemo, pais: "México" });
    expect(sinPais.ok && sinPais.peticion.deal).not.toHaveProperty("country");
  });

  it("recorta a los límites del contrato", () => {
    const r = construirPeticion("l", { ...leadDemo, nombre: "x".repeat(300), empresa: "y".repeat(300) });
    expect(r.ok && r.peticion.contact.name.length).toBe(120);
    expect(r.ok && r.peticion.contact.company?.length).toBe(120);
  });
});

describe("unidadesEstimadas", () => {
  it("acepta enteros y texto con solo dígitos; descarta rangos y decimales", () => {
    expect(unidadesEstimadas(80)).toBe(80);
    expect(unidadesEstimadas(" 300 ")).toBe(300);
    expect(unidadesEstimadas("50-100")).toBeUndefined();
    expect(unidadesEstimadas(12.5)).toBeUndefined();
    expect(unidadesEstimadas(-3)).toBeUndefined();
  });
});

describe("modoDelAmbiente", () => {
  it("staging solo simula y producción está apagada hasta que lo decida David", () => {
    expect(modoDelAmbiente("vivaru-staging-02")).toBe("dryRun");
    expect(modoDelAmbiente("hogaru-1")).toBe("apagado");
    expect(modoDelAmbiente("")).toBe("apagado");
  });
});

describe("procesarLead", () => {
  it("apagado no llama a Albert", async () => {
    const e = envioQueResponde(respuesta(false));
    expect(await procesarLead("l", leadDemo, "apagado", e.enviar)).toEqual({ estado: "apagado" });
    expect(e.llamadas).toHaveLength(0);
  });

  it("en dryRun llama con dryRun y el resultado es simulado", async () => {
    const e = envioQueResponde(respuesta(true));
    const r = await procesarLead("l", leadDemo, "dryRun", e.enviar);
    expect(r.estado).toBe("simulado");
    expect(e.llamadas).toEqual([expect.objectContaining({ dryRun: true })]);
  });

  it("en real llama sin dryRun y el resultado es enviado", async () => {
    const e = envioQueResponde(respuesta(false));
    const r = await procesarLead("l", leadDemo, "real", e.enviar);
    expect(r.estado).toBe("enviado");
    expect(e.llamadas[0].dryRun).toBe(false);
  });

  it("si Albert dice que escribió cuando pedimos simular, es un error y no un éxito", async () => {
    const e = envioQueResponde(respuesta(false));
    expect(await procesarLead("l", leadDemo, "dryRun", e.enviar)).toEqual({ estado: "error", error: "dryRun_no_coincide" });
  });

  it("un lead que se omite no llega a Albert", async () => {
    const e = envioQueResponde(respuesta(true));
    expect(await procesarLead("l", leadTrial, "dryRun", e.enviar)).toEqual({ estado: "omitido", motivo: "sin_consentimiento" });
    expect(e.llamadas).toHaveLength(0);
  });

  it("un fallo de Albert se devuelve como error y no revienta", async () => {
    const e = envioQueResponde(new Error('push_lead_403:{"error":"dry_run_only"}'));
    const r = await procesarLead("l", leadDemo, "dryRun", e.enviar);
    expect(r).toEqual({ estado: "error", error: 'push_lead_403:{"error":"dry_run_only"}' });
  });

  it("una respuesta sin dealId es un error", async () => {
    const e = envioQueResponde({ ok: true, dryRun: true } as RespuestaPush);
    expect(await procesarLead("l", leadDemo, "dryRun", e.enviar)).toEqual({ estado: "error", error: "respuesta_invalida" });
  });
});

describe("camposParaElLead", () => {
  it("simulado deja el plan en albertEnvio y NO toca crmRef", () => {
    const c = camposParaElLead({ estado: "simulado", respuesta: respuesta(true) }, leadDemo);
    expect(c.albertEnvio).toMatchObject({ estado: "simulado", dryRun: true, dealId: "vl_abc123" });
    expect(c).not.toHaveProperty("crmRef");
  });

  it("enviado rellena crmRef en el formato que valida crm-ref.ts, y apunta al deal original si es repetido", () => {
    const nuevo = camposParaElLead({ estado: "enviado", respuesta: respuesta(false) }, leadDemo);
    expect(nuevo.crmRef).toBe("albert:deal:vivaru:vl_abc123");
    const repetido = camposParaElLead(
      { estado: "enviado", respuesta: respuesta(false, { created: false, dealId: "vl_orig", duplicateOf: "vl_orig" }) },
      leadDemo,
    );
    expect(repetido.crmRef).toBe("albert:deal:vivaru:vl_orig");
  });

  it("no pisa un crmRef que el lead ya tenía", () => {
    const c = camposParaElLead({ estado: "enviado", respuesta: respuesta(false) }, { ...leadDemo, crmRef: "albert:deal:vivaru:otro" });
    expect(c).not.toHaveProperty("crmRef");
  });

  it("omitido y error dejan su motivo", () => {
    expect(camposParaElLead({ estado: "omitido", motivo: "sin_consentimiento" }, leadTrial).albertEnvio).toMatchObject({
      estado: "omitido",
      motivo: "sin_consentimiento",
    });
    expect(camposParaElLead({ estado: "error", error: "push_lead_500:x" }, leadDemo).albertEnvio).toMatchObject({
      estado: "error",
      error: "push_lead_500:x",
    });
  });
});
