// tests/billing-migrate-unit-ids.test.ts
// Bloque 5 — Validación de la lógica del script de migración

import { describe, expect, it } from "vitest";

// ── Replica la lógica pura del script ────────────────────────────────────────
// (sin Firebase Admin — testeamos el algoritmo, no la I/O)

const SLUG_PATTERN = /^unit-[a-z0-9]+(-[a-z0-9]+)*$/;

function isSlugId(unitId: string): boolean {
  return SLUG_PATTERN.test(unitId);
}

type MigrationUnit = { id: string; label: string };
type BillingDoc = { id: string; unitId: string; unitLabel: string };

function migrateDoc(
  doc: BillingDoc,
  unitMap: Map<string, string>,
): { action: "updated" | "skipped" | "no_match"; newUnitId?: string } {
  if (!isSlugId(doc.unitId)) {
    return { action: "skipped" };
  }

  const realId = unitMap.get(doc.unitLabel.trim().toLowerCase());
  if (!realId) {
    return { action: "no_match" };
  }

  if (realId === doc.unitId) {
    return { action: "skipped" };
  }

  return { action: "updated", newUnitId: realId };
}

function buildUnitMap(units: MigrationUnit[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of units) {
    map.set(u.label.trim().toLowerCase(), u.id);
  }
  return map;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("migrate-billing-unit-ids — lógica de migración", () => {
  const UNITS: MigrationUnit[] = [
    { id: "real-id-301", label: "Apto 301" },
    { id: "real-id-abc", label: "Bodega 5" },
  ];

  describe("isSlugId", () => {
    it("detecta slug generado por el bug ('unit-apto-301')", () => {
      expect(isSlugId("unit-apto-301")).toBe(true);
    });

    it("detecta slug compuesto ('unit-torre-2-apto-301')", () => {
      expect(isSlugId("unit-torre-2-apto-301")).toBe(true);
    });

    it("no clasifica ID real como slug ('real-id-abc')", () => {
      expect(isSlugId("real-id-abc")).toBe(false);
    });

    it("no clasifica ID Firestore auto-generado como slug ('aBcDeF1234567890')", () => {
      expect(isSlugId("aBcDeF1234567890")).toBe(false);
    });

    it("no clasifica UUID como slug", () => {
      expect(isSlugId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });
  });

  describe("migrateDoc", () => {
    it("slug con match → retorna action='updated' con ID real", () => {
      const unitMap = buildUnitMap(UNITS);
      const result = migrateDoc(
        { id: "doc-1", unitId: "unit-apto-301", unitLabel: "Apto 301" },
        unitMap,
      );
      expect(result.action).toBe("updated");
      expect(result.newUnitId).toBe("real-id-301");
    });

    it("ID ya correcto (no slug) → retorna action='skipped', no toca doc", () => {
      const unitMap = buildUnitMap(UNITS);
      const result = migrateDoc(
        { id: "doc-2", unitId: "real-id-abc", unitLabel: "Bodega 5" },
        unitMap,
      );
      expect(result.action).toBe("skipped");
      expect(result.newUnitId).toBeUndefined();
    });

    it("slug sin match en catálogo → retorna action='no_match'", () => {
      const unitMap = buildUnitMap(UNITS);
      const result = migrateDoc(
        { id: "doc-3", unitId: "unit-bodega-99", unitLabel: "Bodega 99" },
        unitMap,
      );
      expect(result.action).toBe("no_match");
    });

    it("idempotencia — slug que coincide con su propio ID real → skipped", () => {
      // Caso edge: si el ID real fuera igual al slug (improbable pero seguro)
      const specialUnits: MigrationUnit[] = [{ id: "unit-apto-301", label: "Apto 301" }];
      const unitMap = buildUnitMap(specialUnits);
      const result = migrateDoc(
        { id: "doc-4", unitId: "unit-apto-301", unitLabel: "Apto 301" },
        unitMap,
      );
      expect(result.action).toBe("skipped");
    });

    it("matching es case-insensitive", () => {
      const unitMap = buildUnitMap([{ id: "real-id-x", label: "APTO 301" }]);
      const result = migrateDoc(
        { id: "doc-5", unitId: "unit-apto-301", unitLabel: "apto 301" },
        unitMap,
      );
      expect(result.action).toBe("updated");
      expect(result.newUnitId).toBe("real-id-x");
    });
  });

  describe("simulación del loop de migración completo", () => {
    it("procesa batch: 1 corregido, 1 ya-ok, 1 sin-match", () => {
      const unitMap = buildUnitMap(UNITS);
      const docs: BillingDoc[] = [
        { id: "doc-A", unitId: "unit-apto-301", unitLabel: "Apto 301" },  // corregible
        { id: "doc-B", unitId: "real-id-abc", unitLabel: "Bodega 5" },    // ya correcto
        { id: "doc-C", unitId: "unit-bodega-99", unitLabel: "Bodega 99" }, // sin match
      ];

      let corrected = 0;
      let alreadyOk = 0;
      let noMatch = 0;

      for (const doc of docs) {
        const result = migrateDoc(doc, unitMap);
        if (result.action === "updated") corrected++;
        else if (result.action === "skipped") alreadyOk++;
        else noMatch++;
      }

      expect(corrected).toBe(1);
      expect(alreadyOk).toBe(1);
      expect(noMatch).toBe(1);
    });
  });
});
