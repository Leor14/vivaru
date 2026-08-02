// tests/onboarding-steps.test.ts
// Recorrido guiado del administrador: definición de pasos y navegación.
// Lógica pura — sin Firestore, sin DOM.

import { describe, expect, it } from "vitest";

import {
  GUIDE_PARAM,
  ONBOARDING_STEPS,
  activationStepsFor,
  blocksForTrack,
  discoveryStepsFor,
  hrefFor,
  nextStepAfter,
  positionInBlock,
  stepByKey,
  stepsForTrack,
  type OnboardingTrack,
} from "@/lib/onboarding/steps";

const TRACKS: OnboardingTrack[] = ["trial", "cliente"];

describe("definición de los pasos", () => {
  it("no repite claves — la clave es la que viaja en la URL", () => {
    const keys = ONBOARDING_STEPS.map((step) => step.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(TRACKS)("en %s cada paso sabe a dónde ir y qué explicar al llegar", (track) => {
    // Un paso sin `purpose`/`how` sería un checklist a secas: llevaría al
    // usuario a una pantalla y lo dejaría ahí sin saber qué hacer.
    for (const step of stepsForTrack(track)) {
      expect(step.route.startsWith("/admin"), step.key).toBe(true);
      expect(step.title.length, step.key).toBeGreaterThan(0);
      expect(step.why.length, step.key).toBeGreaterThan(0);
      expect(step.purpose.length, step.key).toBeGreaterThan(0);
      expect(step.how.length, step.key).toBeGreaterThan(0);
    }
  });

  it.each(TRACKS)("en %s todo paso pertenece a un bloque de ese recorrido", (track) => {
    const declared = new Set(blocksForTrack(track).map((block) => block.key));
    for (const step of stepsForTrack(track)) {
      expect(declared.has(step.block), `${track}/${step.key}`).toBe(true);
    }
  });

  it("todo paso declara al menos un recorrido", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.tracks.length, step.key).toBeGreaterThan(0);
    }
  });

  it("la prueba activa en 7 pasos y el cliente en 10", () => {
    expect(activationStepsFor("trial")).toHaveLength(7);
    // El cliente lleva tres más que la prueba no puede tener: invitar
    // residentes reales choca con la Regla B, y cobrar con el candado.
    expect(activationStepsFor("cliente")).toHaveLength(10);
  });

  it("filtra los datos sembrados en las colecciones que la siembra toca", () => {
    // units, people y amenities nacen con ejemplos (`trial-seed.ts`). Sin el
    // filtro, el checklist nacería completo el primer día.
    const sembradas = new Set(["units", "people", "amenities"]);
    for (const step of ONBOARDING_STEPS) {
      if (step.signal.kind !== "docs") continue;
      if (!sembradas.has(step.signal.collection)) continue;
      expect(step.signal.filterExamples, step.key).toBe(true);
    }
  });

  it("los pasos de activación se prueban con evidencia, no con un botón", () => {
    // Salvo recorrer los portales, que no deja rastro en los datos.
    const sinEvidencia = activationStepsFor("trial").filter((step) => step.signal.kind === "seen");
    expect(sinEvidencia.map((step) => step.key)).toEqual(["portal-porteria", "portal-residente"]);
  });
});

describe("diferencias entre recorridos", () => {
  it("solo el cliente puede invitar residentes y cobrar", () => {
    const soloCliente = ONBOARDING_STEPS.filter((s) => !s.tracks.includes("trial")).map((s) => s.key);
    expect(soloCliente.sort()).toEqual(["invitaciones", "primer-cobro", "primer-pago"]);
  });

  it("el pago se detecta en el cobro, no en un recibo del residente", () => {
    // `paymentReceipts` solo lo CREA el residente (ver firestore.rules): el
    // administrador ni siquiera tiene permiso. Si la señal apuntara ahí, el
    // paso jamás se completaría y el cliente se quedaría en 9 de 10.
    const paso = stepByKey("primer-pago", "cliente");
    expect(paso?.signal).toEqual({
      kind: "docs",
      collection: "billingStatements",
      filterExamples: true,
      positiveField: "paymentAmount",
    });
  });

  it("emitir y pagar son el mismo documento en dos momentos", () => {
    const cobro = stepByKey("primer-cobro", "cliente");
    const pago = stepByKey("primer-pago", "cliente");
    expect(cobro?.signal).toMatchObject({ collection: "billingStatements" });
    expect(pago?.signal).toMatchObject({ collection: "billingStatements" });
    // Lo que los distingue es el abono, no la colección.
    expect((cobro?.signal as { positiveField?: string }).positiveField).toBeUndefined();
  });

  it("el bloque de cobro no existe en la prueba", () => {
    expect(blocksForTrack("trial").map((b) => b.key)).not.toContain("cobrar");
    expect(blocksForTrack("cliente").map((b) => b.key)).toContain("cobrar");
  });

  it("el paso de vista previa financiera es solo de la prueba", () => {
    // Para un cliente esos módulos están abiertos: mirarlos con datos de
    // ejemplo no tiene sentido, los usa de verdad.
    expect(stepsForTrack("trial").map((s) => s.key)).toContain("financiero");
    expect(stepsForTrack("cliente").map((s) => s.key)).not.toContain("financiero");
  });

  it("al cliente no se le dice que no puede invitar por correo", () => {
    // Ese texto es cierto en la prueba (Regla B) y falso para un cliente.
    const trial = stepByKey("residentes", "trial");
    const cliente = stepByKey("residentes", "cliente");
    expect(trial?.how).toContain("no se envían invitaciones");
    expect(cliente?.how).not.toContain("no se envían invitaciones");
  });

  it("al cliente se le dice que importe, no que cree una para probar", () => {
    expect(stepByKey("unidades", "trial")?.title).toBe("Crea tu primera unidad");
    expect(stepByKey("unidades", "cliente")?.title).toBe("Importa tus unidades");
  });

  it("los bloques compartidos cambian de nombre según el recorrido", () => {
    const t = blocksForTrack("trial").find((b) => b.key === "configura");
    const c = blocksForTrack("cliente").find((b) => b.key === "configura");
    expect(t?.title).toBe("Pon a punto tu conjunto");
    expect(c?.title).toBe("Carga tu conjunto");
  });

  it("el bloque de descubrimiento existe en ambos", () => {
    for (const track of TRACKS) {
      expect(discoveryStepsFor(track).length).toBeGreaterThan(0);
    }
  });
});

describe("navegación del recorrido", () => {
  it("el enlace lleva el parámetro que abre la ayuda al llegar", () => {
    const step = stepByKey("unidades");
    expect(step).toBeDefined();
    expect(hrefFor(step!)).toBe(`/admin/residents?${GUIDE_PARAM}=unidades`);
  });

  it("stepByKey tolera ausencia de parámetro", () => {
    expect(stepByKey(null)).toBeUndefined();
    expect(stepByKey("no-existe")).toBeUndefined();
  });

  it("un paso de otro recorrido no se resuelve", () => {
    expect(stepByKey("primer-cobro", "trial")).toBeUndefined();
    expect(stepByKey("primer-cobro", "cliente")).toBeDefined();
  });

  it("posiciona el paso dentro de su bloque, no del total", () => {
    expect(positionInBlock(stepByKey("agrupaciones")!)).toEqual({ index: 1, total: 4 });
    expect(positionInBlock(stepByKey("visita")!)).toEqual({ index: 1, total: 3 });
    // El mismo bloque tiene un paso más para el cliente: las invitaciones.
    expect(positionInBlock(stepByKey("visita", "cliente")!, "cliente")).toEqual({
      index: 1,
      total: 4,
    });
  });

  it("el siguiente paso salta los que ya están hechos", () => {
    const done = new Set(["residentes", "porteria"]);
    const next = nextStepAfter(stepByKey("unidades")!, (key) => done.has(key));
    expect(next?.key).toBe("visita");
  });

  it("no propone siguiente cuando ya no queda nada pendiente", () => {
    const trial = stepsForTrack("trial");
    expect(nextStepAfter(trial[trial.length - 1], () => false)).toBeUndefined();
    expect(nextStepAfter(stepByKey("unidades")!, () => true)).toBeUndefined();
  });
});
