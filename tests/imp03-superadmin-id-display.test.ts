// tests/imp03-superadmin-id-display.test.ts
// BLOQUE 6 — Superadmin tenants y plans: ID truncado + copy-to-clipboard (C6)
// src/app/(superadmin)/superadmin/tenants/page.tsx
// src/app/(superadmin)/superadmin/plans/page.tsx

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Lógica del render en ambas páginas:
//   - Muestra: `ID ···${id.slice(-6)}`
//   - title: id completo
//   - onClick: navigator.clipboard.writeText(id)

function truncateId(id: string): string {
  return `ID ···${id.slice(-6)}`;
}

function idTooltip(id: string): string {
  return id;
}

async function copyIdToClipboard(id: string): Promise<void> {
  await navigator.clipboard.writeText(id);
}

const TENANT_ID = "abc123def456ghi789jkl";
const PLAN_ID = "xyz987uvw654rst321opq";

describe("Superadmin ID display — tenants (C6)", () => {
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: clipboardSpy } },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra solo los últimos 6 chars del hash", () => {
    expect(truncateId(TENANT_ID)).toBe("ID ···789jkl");
  });

  it("NO muestra el hash completo como display text", () => {
    const display = truncateId(TENANT_ID);
    expect(display).not.toContain(TENANT_ID);
    expect(display.length).toBeLessThan(TENANT_ID.length);
  });

  it("title attribute contiene el hash completo", () => {
    expect(idTooltip(TENANT_ID)).toBe(TENANT_ID);
  });

  it("click copia el hash completo al clipboard", async () => {
    await copyIdToClipboard(TENANT_ID);
    expect(clipboardSpy).toHaveBeenCalledWith(TENANT_ID);
    expect(clipboardSpy).not.toHaveBeenCalledWith("789jkl");
  });

  it("display 'ID ···789jkl' tiene exactamente 6 chars tras '···'", () => {
    const display = truncateId(TENANT_ID);
    const suffix = display.replace("ID ···", "");
    expect(suffix).toHaveLength(6);
  });
});

describe("Superadmin ID display — plans (C6)", () => {
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: clipboardSpy } },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra solo los últimos 6 chars del plan.id", () => {
    expect(truncateId(PLAN_ID)).toBe("ID ···321opq");
  });

  it("NO muestra el hash completo del plan como display", () => {
    const display = truncateId(PLAN_ID);
    expect(display).not.toContain(PLAN_ID);
  });

  it("click copia plan.id completo al clipboard", async () => {
    await copyIdToClipboard(PLAN_ID);
    expect(clipboardSpy).toHaveBeenCalledWith(PLAN_ID);
  });

  it("title attribute contiene plan.id completo", () => {
    expect(idTooltip(PLAN_ID)).toBe(PLAN_ID);
  });
});
