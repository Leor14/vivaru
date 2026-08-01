// tests/onboarding-steps.test.ts
// Recorrido guiado del administrador: definición de pasos y navegación.
// Lógica pura — sin Firestore, sin DOM.

import { describe, expect, it } from "vitest";

import {
  ACTIVATION_STEPS,
  ACTIVATION_TOTAL,
  DISCOVERY_STEPS,
  DISCOVERY_TOTAL,
  GUIDE_PARAM,
  ONBOARDING_BLOCKS,
  ONBOARDING_STEPS,
  hrefFor,
  nextStepAfter,
  positionInBlock,
  stepByKey,
} from "@/lib/onboarding/steps";

describe("definición de los pasos", () => {
  it("no repite claves — la clave es la que viaja en la URL", () => {
    const keys = ONBOARDING_STEPS.map((step) => step.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cada paso sabe a dónde ir y qué explicar al llegar", () => {
    // Un paso sin `purpose`/`how` sería un checklist a secas: llevaría al
    // usuario a una pantalla y lo dejaría ahí sin saber qué hacer.
    for (const step of ONBOARDING_STEPS) {
      expect(step.route.startsWith("/admin"), step.key).toBe(true);
      expect(step.title.length, step.key).toBeGreaterThan(0);
      expect(step.why.length, step.key).toBeGreaterThan(0);
      expect(step.purpose.length, step.key).toBeGreaterThan(0);
      expect(step.how.length, step.key).toBeGreaterThan(0);
    }
  });

  it("todo paso pertenece a un bloque declarado", () => {
    const declared = new Set(ONBOARDING_BLOCKS.map((block) => block.key));
    for (const step of ONBOARDING_STEPS) {
      expect(declared.has(step.block), step.key).toBe(true);
    }
  });

  it("son 7 pasos de activación y el resto es descubrimiento", () => {
    expect(ACTIVATION_TOTAL).toBe(7);
    expect(ACTIVATION_STEPS).toHaveLength(7);
    expect(DISCOVERY_STEPS).toHaveLength(DISCOVERY_TOTAL);
    expect(ACTIVATION_TOTAL + DISCOVERY_TOTAL).toBe(ONBOARDING_STEPS.length);
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
    const sinEvidencia = ACTIVATION_STEPS.filter((step) => step.signal.kind === "seen");
    expect(sinEvidencia.map((step) => step.key)).toEqual(["portal-porteria", "portal-residente"]);
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

  it("posiciona el paso dentro de su bloque, no del total", () => {
    expect(positionInBlock(stepByKey("agrupaciones")!)).toEqual({ index: 1, total: 4 });
    expect(positionInBlock(stepByKey("visita")!)).toEqual({ index: 1, total: 3 });
  });

  it("el siguiente paso salta los que ya están hechos", () => {
    const done = new Set(["residentes", "porteria"]);
    const next = nextStepAfter(stepByKey("unidades")!, (key) => done.has(key));
    expect(next?.key).toBe("visita");
  });

  it("no propone siguiente cuando ya no queda nada pendiente", () => {
    const last = ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1];
    expect(nextStepAfter(last, () => false)).toBeUndefined();
    expect(nextStepAfter(stepByKey("unidades")!, () => true)).toBeUndefined();
  });
});
