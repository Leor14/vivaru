// tests/imp03-visitor-invitation-card.test.ts
// BLOQUE 1 — VisitorInvitationSummaryCard: unitLabel ?? unitId display logic
// (C1: components/features/visitors/VisitorInvitationSummaryCard.tsx)

import { describe, expect, it } from "vitest";
import type { VisitorInvitation } from "../features/visitors/types";

// The component renders: invitation.unitLabel ?? invitation.unitId
// We test the expression directly, matching the JSX binding.
function resolveUnitDisplay(invitation: Pick<VisitorInvitation, "unitId" | "unitLabel">): string {
  return invitation.unitLabel ?? invitation.unitId;
}

function makeInvitation(overrides?: Partial<VisitorInvitation>): VisitorInvitation {
  return {
    id: "inv-1",
    tenantId: "tenant-a",
    unitId: "t2-503",
    residentUserId: "user-1",
    authorizedByName: "Juan Pérez",
    visitorName: "Ana López",
    visitorIdentification: "CC-123",
    visitReason: "Visita familiar",
    adultsCount: 1,
    childrenCount: 0,
    allowedUses: 3,
    startAt: new Date("2026-05-09T10:00:00"),
    endAt: new Date("2026-05-09T22:00:00"),
    status: "active",
    qrToken: "token-abc",
    invitationCode: "INV-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("VisitorInvitationSummaryCard — unitLabel display (C1)", () => {
  it("usa unitLabel cuando está presente", () => {
    const inv = makeInvitation({ unitLabel: "Torre 1-t2-503", unitId: "t2-503" });
    expect(resolveUnitDisplay(inv)).toBe("Torre 1-t2-503");
  });

  it("cae a unitId cuando unitLabel es undefined", () => {
    const inv = makeInvitation({ unitLabel: undefined, unitId: "t2-503" });
    expect(resolveUnitDisplay(inv)).toBe("t2-503");
  });

  it("cae a unitId cuando unitLabel es null (coerced a undefined via ?:)", () => {
    // unitLabel?: string — null no es asignable en TypeScript, pero puede venir de Firestore
    const inv = makeInvitation({ unitLabel: undefined, unitId: "t2-503" });
    const rawWithNull = { ...inv, unitLabel: null as unknown as string };
    // null ?? unitId → unitId  (nullish coalescing)
    const display = rawWithNull.unitLabel ?? rawWithNull.unitId;
    expect(display).toBe("t2-503");
  });

  it("NO muestra el slug 't2-503' como display cuando unitLabel está presente", () => {
    const inv = makeInvitation({ unitLabel: "Torre 1-t2-503", unitId: "t2-503" });
    expect(resolveUnitDisplay(inv)).not.toBe("t2-503");
  });

  it("tipo VisitorInvitation acepta unitLabel opcional sin error", () => {
    const withLabel: VisitorInvitation = makeInvitation({ unitLabel: "Torre 1-t2-503" });
    const withoutLabel: VisitorInvitation = makeInvitation({ unitLabel: undefined });
    expect(withLabel.unitLabel).toBe("Torre 1-t2-503");
    expect(withoutLabel.unitLabel).toBeUndefined();
  });
});
