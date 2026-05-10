/**
 * tests/imp11-time-select.test.ts
 *
 * IMP-11 — TimeSelect dropdown (30-min intervals) tests puros Vitest env=node.
 * Bloques: opciones generadas | static TimeSelect.tsx | static visitors/new/page.tsx
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Réplica de la lógica de generación (copiada del componente para env=node)
// ─────────────────────────────────────────────────────────────────────────────

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 5; h <= 23; h++) {
  for (const m of [0, 30]) {
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h < 12 ? "a.m." : "p.m.";
    const displayHour = h > 12 ? h - 12 : h;
    const displayMin = String(m).padStart(2, "0");
    TIME_OPTIONS.push({ value, label: `${displayHour}:${displayMin} ${period}` });
  }
}

function findOpt(value: string) {
  return TIME_OPTIONS.find((o) => o.value === value);
}

const ROOT = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — TIME_OPTIONS: opciones generadas
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 1 — TIME_OPTIONS: opciones generadas", () => {
  it("total 38 opciones (05:00–23:30, 19h × 2)", () => {
    expect(TIME_OPTIONS).toHaveLength(38);
  });

  it("primera opción: value=05:00, label=5:00 a.m.", () => {
    expect(TIME_OPTIONS[0].value).toBe("05:00");
    expect(TIME_OPTIONS[0].label).toBe("5:00 a.m.");
  });

  it("última opción: value=23:30, label=11:30 p.m.", () => {
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1].value).toBe("23:30");
    expect(TIME_OPTIONS[TIME_OPTIONS.length - 1].label).toBe("11:30 p.m.");
  });

  it('value "05:00" existe (con padding)', () => {
    expect(findOpt("05:00")).toBeDefined();
  });

  it('value "09:30" existe (con padding, no "9:30")', () => {
    expect(findOpt("09:30")).toBeDefined();
    expect(findOpt("9:30")).toBeUndefined();
  });

  it('NO existe value "5:00" (sin padding)', () => {
    expect(findOpt("5:00")).toBeUndefined();
  });

  it('12:00 → "12:00 p.m." (mediodía)', () => {
    expect(findOpt("12:00")?.label).toBe("12:00 p.m.");
  });

  it('12:30 → "12:30 p.m."', () => {
    expect(findOpt("12:30")?.label).toBe("12:30 p.m.");
  });

  it('11:30 → "11:30 a.m." (última a.m.)', () => {
    expect(findOpt("11:30")?.label).toBe("11:30 a.m.");
  });

  it('13:00 → "1:00 p.m." (sin leading zero en display)', () => {
    expect(findOpt("13:00")?.label).toBe("1:00 p.m.");
  });

  it('05:00 → "5:00 a.m." (sin leading zero en display)', () => {
    expect(findOpt("05:00")?.label).toBe("5:00 a.m.");
  });

  it("todos los values son únicos", () => {
    const unique = new Set(TIME_OPTIONS.map((o) => o.value));
    expect(unique.size).toBe(38);
  });

  it("todos los labels son únicos", () => {
    const unique = new Set(TIME_OPTIONS.map((o) => o.label));
    expect(unique.size).toBe(38);
  });

  it('08:00 → "8:00 a.m."', () => {
    expect(findOpt("08:00")?.label).toBe("8:00 a.m.");
  });

  it('08:30 → "8:30 a.m."', () => {
    expect(findOpt("08:30")?.label).toBe("8:30 a.m.");
  });

  it('20:00 → "8:00 p.m."', () => {
    expect(findOpt("20:00")?.label).toBe("8:00 p.m.");
  });

  it('20:30 → "8:30 p.m."', () => {
    expect(findOpt("20:30")?.label).toBe("8:30 p.m.");
  });

  it('NO existe value "04:30" (antes del rango)', () => {
    expect(findOpt("04:30")).toBeUndefined();
  });

  it('NO existe value "00:00" (medianoche)', () => {
    expect(findOpt("00:00")).toBeUndefined();
  });

  it('NO existe value "24:00"', () => {
    expect(findOpt("24:00")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — TimeSelect.tsx: verificación estática del componente
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 2 — TimeSelect.tsx: verificación estática", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "src/components/ui/TimeSelect.tsx"),
    "utf-8",
  );

  it("usa forwardRef", () => {
    expect(src).toMatch(/forwardRef/);
  });

  it("ref tipado como HTMLSelectElement", () => {
    expect(src).toMatch(/forwardRef<HTMLSelectElement/);
  });

  it("exporta TimeSelect", () => {
    expect(src).toMatch(/export\s+const\s+TimeSelect/);
  });

  it('displayName = "TimeSelect"', () => {
    expect(src).toMatch(/TimeSelect\.displayName\s*=\s*["']TimeSelect["']/);
  });

  it("<select> tiene ref={ref}", () => {
    expect(src).toMatch(/ref=\{ref\}/);
  });

  it('placeholder option con value=""', () => {
    expect(src).toMatch(/<option\s+value=""\s*>/);
  });

  it("importa cn para clases condicionales", () => {
    expect(src).toMatch(/import.*cn.*from/);
  });

  it("prop error?: string presente en interface", () => {
    expect(src).toMatch(/error\?:\s*string/);
  });

  it("prop label?: string presente en interface", () => {
    expect(src).toMatch(/label\?:\s*string/);
  });

  it("error causa cambio de borde (border-red-500 o border-destructive)", () => {
    expect(src).toMatch(/error.*border-red-500|border-destructive.*error/s);
  });

  it("NO usa componente <Input> (es <select> nativo)", () => {
    expect(src).not.toMatch(/<Input\b/);
  });

  it("usa elemento <select> nativo", () => {
    expect(src).toMatch(/<select\b/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — visitors/new/page.tsx: verificación estática
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 3 — visitors/new/page.tsx: verificación estática", () => {
  const src = fs.readFileSync(
    path.join(ROOT, "src/app/(resident)/resident/visitors/new/page.tsx"),
    "utf-8",
  );

  it("importa TimeSelect", () => {
    expect(src).toMatch(/import.*TimeSelect.*from/);
  });

  it('NO existe <Input type="time">', () => {
    expect(src).not.toMatch(/type="time"/);
  });

  it("existen exactamente 2 usos de <TimeSelect", () => {
    const matches = src.match(/<TimeSelect\b/g);
    expect(matches).toHaveLength(2);
  });

  it('un <TimeSelect tiene register("startTime")', () => {
    expect(src).toMatch(/register\("startTime"\)/);
  });

  it('un <TimeSelect tiene register("endTime")', () => {
    expect(src).toMatch(/register\("endTime"\)/);
  });

  it('NO contiene "minStartTimeValue"', () => {
    expect(src).not.toContain("minStartTimeValue");
  });

  it('NO contiene "minVisitorDateTime"', () => {
    expect(src).not.toContain("minVisitorDateTime");
  });

  it('NO contiene "isSameDay" (import eliminado)', () => {
    expect(src).not.toContain("isSameDay");
  });

  it('NO contiene "toTimeInputValue" (import eliminado)', () => {
    expect(src).not.toContain("toTimeInputValue");
  });

  it('NO contiene "getMinAllowedDateTime" (import eliminado)', () => {
    expect(src).not.toContain("getMinAllowedDateTime");
  });
});
