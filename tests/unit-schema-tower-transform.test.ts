// tests/unit-schema-tower-transform.test.ts
// Bloque 3 — unitSchema.tower normaliza variantes → "Torre N"

import { describe, expect, it } from "vitest";

// No mocks needed — pure Zod schema
const { unitSchema } = await import("../src/features/admin/schemas");

const BASE = { displayName: "Apto 101", type: "apartment" as const, status: "active" as const };
function parse(tower: string) {
  return unitSchema.parse({ ...BASE, tower });
}
function safeparse(tower: string) {
  return unitSchema.safeParse({ ...BASE, tower });
}

// ── Normalization: debe producir "Torre N" ─────────────────────────────────────
describe("unitSchema.tower — normalización a 'Torre N'", () => {
  const casesNorm: Array<[string, string]> = [
    ["t1", "Torre 1"],
    ["T1", "Torre 1"],
    ["Torre 1", "Torre 1"],   // idempotente
    ["torre1", "Torre 1"],
    ["torre  1", "Torre 1"],  // espacios extra
    ["TORRE1", "Torre 1"],
    ["T  1", "Torre 1"],
    ["t 1", "Torre 1"],
    ["TORRE 1", "Torre 1"],
  ];

  for (const [input, expected] of casesNorm) {
    it(`"${input}" → "${expected}"`, () => {
      expect(parse(input).tower).toBe(expected);
    });
  }
});

// ── Sin cambio: nombres sin número simple pasan como están ────────────────────
describe("unitSchema.tower — valores sin número pasan sin cambio", () => {
  const casesPassthru: string[] = [
    "Torre Central",
    "TORRE CE",
    "Bloque A",
    "Penthouse",
    "Casa de Campo",
  ];

  for (const input of casesPassthru) {
    it(`"${input}" pasa sin cambio`, () => {
      expect(parse(input).tower).toBe(input.trim());
    });
  }
});

// ── Fallos de validación ──────────────────────────────────────────────────────
describe("unitSchema.tower — falla en inputs inválidos", () => {
  it('string vacío "" → error de validación (min 1)', () => {
    const result = safeparse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("tower"))).toBe(true);
    }
  });

  it('whitespace solo " " → error de validación (min 1 tras trim)', () => {
    const result = safeparse("   ");
    expect(result.success).toBe(false);
  });
});

// ── Idempotencia ──────────────────────────────────────────────────────────────
describe("unitSchema.tower — idempotencia del transform", () => {
  const cases = ["Torre 1", "Torre 12", "Torre Central", "TORRE CE"];

  for (const input of cases) {
    it(`parse dos veces "${input}" → mismo resultado`, () => {
      const first = parse(input).tower;
      const second = parse(first).tower;
      expect(second).toBe(first);
    });
  }
});
