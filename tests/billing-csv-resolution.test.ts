// tests/billing-csv-resolution.test.ts
// Bloque 2 — Lógica de resolución de unitId en importación CSV
//
// La lógica cambiada en handleImportCsv es:
//   catalogUnits.find(u => u.label.trim().toLowerCase() === row.apartamento.trim().toLowerCase())
// Esta función captura esa lógica para testearla en aislamiento.

import { describe, expect, it } from "vitest";

// ── Pure logic extracted from handleImportCsv ────────────────────────────────
type CatalogUnit = { id: string; label: string };

function resolveUnitFromCatalog(
  apartamento: string,
  catalogUnits: CatalogUnit[],
): CatalogUnit | undefined {
  return catalogUnits.find(
    (unit) => unit.label.trim().toLowerCase() === (apartamento || "").trim().toLowerCase(),
  );
}

/**
 * Simula el loop de importación CSV:
 * - Resuelve unitId real por label
 * - Acumula filas sin match en failedRows
 * - Retorna { created, failedRows }
 */
function simulateCsvImport(
  rows: Array<{ apartamento: string; fecha: string; monto: number }>,
  catalogUnits: CatalogUnit[],
): { created: Array<{ unitId: string; unitLabel: string }>; failedRows: string[] } {
  const created: Array<{ unitId: string; unitLabel: string }> = [];
  const failedRows: string[] = [];

  for (const row of rows) {
    const matchedUnit = resolveUnitFromCatalog(row.apartamento, catalogUnits);
    if (!matchedUnit) {
      failedRows.push(row.apartamento || "(sin nombre)");
      continue;
    }
    created.push({ unitId: matchedUnit.id, unitLabel: matchedUnit.label });
  }

  return { created, failedRows };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const CATALOG: CatalogUnit[] = [
  { id: "real-id-101", label: "Apto 101" },
  { id: "real-id-202", label: "Apto 202" },
  { id: "real-id-301", label: "Torre 2 Apto 301" },
];

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("CSV import — resolución de unitId desde catálogo", () => {
  it("label 'Apto 101' → unitId 'real-id-101'", () => {
    const { created } = simulateCsvImport(
      [{ apartamento: "Apto 101", fecha: "2026-01", monto: 300_000 }],
      CATALOG,
    );
    expect(created).toHaveLength(1);
    expect(created[0].unitId).toBe("real-id-101");
  });

  it("label 'Apto 202' → unitId 'real-id-202'", () => {
    const { created } = simulateCsvImport(
      [{ apartamento: "Apto 202", fecha: "2026-01", monto: 200_000 }],
      CATALOG,
    );
    expect(created[0].unitId).toBe("real-id-202");
  });

  it("label 'Bodega 5' (no en catálogo) → NO crea cobro, acumula en failedRows", () => {
    const { created, failedRows } = simulateCsvImport(
      [{ apartamento: "Bodega 5", fecha: "2026-01", monto: 50_000 }],
      CATALOG,
    );
    expect(created).toHaveLength(0);
    expect(failedRows).toContain("Bodega 5");
  });

  it("CSV mixto (2 válidas + 1 inválida) → 2 cobros, 1 error, sin explosión", () => {
    const rows = [
      { apartamento: "Apto 101", fecha: "2026-01", monto: 300_000 },
      { apartamento: "Bodega 5", fecha: "2026-01", monto: 50_000 },
      { apartamento: "Apto 202", fecha: "2026-01", monto: 200_000 },
    ];
    const { created, failedRows } = simulateCsvImport(rows, CATALOG);

    expect(created).toHaveLength(2);
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0]).toBe("Bodega 5");

    const unitIds = created.map((c) => c.unitId);
    expect(unitIds).toContain("real-id-101");
    expect(unitIds).toContain("real-id-202");
  });

  it("matching es case-insensitive y tolera espacios extra", () => {
    const { created } = simulateCsvImport(
      [{ apartamento: "  APTO 101  ", fecha: "2026-01", monto: 0 }],
      CATALOG,
    );
    expect(created).toHaveLength(1);
    expect(created[0].unitId).toBe("real-id-101");
  });

  it("unitId creado nunca es slug derivado del label", () => {
    const { created } = simulateCsvImport(
      [{ apartamento: "Torre 2 Apto 301", fecha: "2026-01", monto: 400_000 }],
      CATALOG,
    );
    expect(created[0].unitId).toBe("real-id-301");
    expect(created[0].unitId).not.toMatch(/^unit-/);
  });
});
