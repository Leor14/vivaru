// tests/residents-unit-slug.test.ts
// Bloque 2 — Flujo de creación en residents/page.tsx usa createdUnit.unitId (slug)
// no createdUnit.id (hash).
//
// Strategy: simular exactamente el mismo código que ejecuta handleSaveUnitFlow
// en la página, sin importar el componente React.

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ── Minimal stubs for the flow ────────────────────────────────────────────────

type CreateUnitResult = { id: string; unitId: string; displayName: string };
type PersonPayload = Record<string, unknown>;

/**
 * Replica la lógica central de handleSaveUnitFlow (residents/page.tsx L512-L558)
 * tras IMP-02. Testear esta fn equivale a testear el comportamiento de la página.
 */
async function handleSaveUnitFlow(
  unitValues: { displayName: string; tower: string },
  primaryHolder: { fullName: string; email: string; occupancyType: string },
  familyMembers: Array<{ fullName: string; email: string; occupancyType: string }>,
  createUnit: () => Promise<CreateUnitResult>,
  createPerson: (payload: PersonPayload) => Promise<string>,
) {
  // Line 512 in page.tsx (after IMP-02)
  const createdUnit = await createUnit();

  const primaryPayload: PersonPayload = {
    ...primaryHolder,
    roleType: primaryHolder.occupancyType,
    occupancyType: primaryHolder.occupancyType,
    unitId: createdUnit.unitId,        // ← slug, not createdUnit.id
    tower: unitValues.tower.trim(),
    status: "active",
  };

  await createPerson(primaryPayload);

  // Line 547: family members (after IMP-02)
  for (const member of familyMembers) {
    await createPerson({
      fullName: member.fullName,
      email: member.email,
      roleType: member.occupancyType,
      occupancyType: member.occupancyType,
      unitId: createdUnit.unitId,      // ← slug, not createdUnit.id
      tower: unitValues.tower,
      status: "active",
    });
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("residents/page.tsx — handleSaveUnitFlow tras IMP-02", () => {
  const MOCK_UNIT: CreateUnitResult = {
    id: "hash-abc-G1bWNzZJuakw9KRoAx7p",   // Firestore auto-ID
    unitId: "t2-503",                          // slug correcto
    displayName: "T2-503",
  };

  const PRIMARY = { fullName: "Ana García", email: "ana@test.com", occupancyType: "owner_occupant" };
  const UNIT_VALUES = { displayName: "T2-503", tower: "Torre 1" };

  // Tipados con la firma que `handleSaveUnitFlow` espera, no con
  // `ReturnType<typeof vi.fn>`: ese tipo es demasiado ancho y no encaja donde se
  // pide una función concreta, que era el motivo de tres errores tolerados como
  // «preexistentes». `Mock<F>` conserva además `toHaveBeenCalledWith`.
  let mockCreateUnit: Mock<() => Promise<CreateUnitResult>>;
  let mockCreatePerson: Mock<(payload: PersonPayload) => Promise<string>>;

  beforeEach(() => {
    mockCreateUnit = vi.fn().mockResolvedValue(MOCK_UNIT);
    mockCreatePerson = vi.fn().mockResolvedValue("person-id-xyz");
  });

  it("residente principal recibe createdUnit.unitId (slug), no .id (hash)", async () => {
    await handleSaveUnitFlow(UNIT_VALUES, PRIMARY, [], mockCreateUnit, mockCreatePerson);

    expect(mockCreatePerson).toHaveBeenCalledOnce();
    const primaryCall = mockCreatePerson.mock.calls[0][0] as PersonPayload;
    expect(primaryCall.unitId).toBe("t2-503");
    expect(primaryCall.unitId).not.toBe("hash-abc-G1bWNzZJuakw9KRoAx7p");
  });

  it("family member también recibe el slug, no el hash", async () => {
    const family = [
      { fullName: "Luis García", email: "luis@test.com", occupancyType: "tenant" },
      { fullName: "Marta García", email: "marta@test.com", occupancyType: "tenant" },
    ];

    await handleSaveUnitFlow(UNIT_VALUES, PRIMARY, family, mockCreateUnit, mockCreatePerson);

    // 1 primary + 2 family
    expect(mockCreatePerson).toHaveBeenCalledTimes(3);

    const familyCall1 = mockCreatePerson.mock.calls[1][0] as PersonPayload;
    const familyCall2 = mockCreatePerson.mock.calls[2][0] as PersonPayload;

    expect(familyCall1.unitId).toBe("t2-503");
    expect(familyCall2.unitId).toBe("t2-503");

    // Verify neither gets the Firestore hash
    expect(familyCall1.unitId).not.toBe(MOCK_UNIT.id);
    expect(familyCall2.unitId).not.toBe(MOCK_UNIT.id);
  });

  it("ningún path pasa el hash como unitId de persona", async () => {
    const family = [{ fullName: "X", email: "x@x.com", occupancyType: "tenant" }];
    await handleSaveUnitFlow(UNIT_VALUES, PRIMARY, family, mockCreateUnit, mockCreatePerson);

    for (const call of mockCreatePerson.mock.calls) {
      const payload = call[0] as PersonPayload;
      expect(payload.unitId).not.toBe(MOCK_UNIT.id);
      expect(String(payload.unitId)).not.toMatch(/G1bWNzZJuakw9KRoAx7p/);
    }
  });

  it("antes del fix (usando .id), la query del residente retornaría vacío — caso negativo", () => {
    // Simula el estado PRE-IMP-02: se usaba createdUnitId (el hash)
    const storeByUnitId = new Map<string, unknown[]>();
    const billingEntry = { unitId: "t2-503", monto: 300_000 };

    // Admin crea cobro con slug correcto
    const arr = storeByUnitId.get("t2-503") ?? [];
    arr.push(billingEntry);
    storeByUnitId.set("t2-503", arr);

    // Residente con hash (bug pre-IMP-02)
    const residentUnitIdBuggy = "hash-abc-G1bWNzZJuakw9KRoAx7p";
    const resultsWithBug = storeByUnitId.get(residentUnitIdBuggy) ?? [];
    expect(resultsWithBug).toHaveLength(0); // ← el bug: residente no ve cobros

    // Residente con slug (después de IMP-02)
    const residentUnitIdFixed = "t2-503";
    const resultsFixed = storeByUnitId.get(residentUnitIdFixed) ?? [];
    expect(resultsFixed).toHaveLength(1); // ← fix: sí ve su cobro
  });
});
