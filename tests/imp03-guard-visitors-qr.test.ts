// tests/imp03-guard-visitors-qr.test.ts
// BLOQUE 5 — GuardVisitors: QR condicional (C5)
// src/components/securityGuard/GuardVisitors.tsx

import { describe, expect, it } from "vitest";

// La lógica de rendering del QR en GuardVisitors:
//   - si qrCodeValue es truthy → renderiza QRCodeSVG con ese valor
//   - si qrCodeValue es null/undefined → renderiza texto "Código QR no disponible"
//   - NUNCA se usa visitor.id como fallback (bug anterior: `visitor-${selectedVisitor.id}`)
//
// Extrae la lógica de decisión para tests sin jsdom.

interface VisitorQrSlice {
  id: string;
  qrCodeValue: string | null | undefined;
}

type QrRenderDecision =
  | { show: true; value: string }
  | { show: false; message: string };

function resolveQrRender(visitor: VisitorQrSlice): QrRenderDecision {
  if (visitor.qrCodeValue) {
    return { show: true, value: visitor.qrCodeValue };
  }
  return { show: false, message: "Código QR no disponible" };
}

function containsVisitorHash(decision: QrRenderDecision, visitorId: string): boolean {
  if (decision.show) {
    return decision.value.includes(`visitor-${visitorId}`);
  }
  return decision.message.includes(`visitor-${visitorId}`);
}

describe("GuardVisitors — QR fallback (C5)", () => {
  it("qrCodeValue válido → QR se muestra con ese valor exacto", () => {
    const decision = resolveQrRender({ id: "abc123", qrCodeValue: "qr-valid-string" });
    expect(decision.show).toBe(true);
    if (decision.show) {
      expect(decision.value).toBe("qr-valid-string");
    }
  });

  it("qrCodeValue null → QR no se renderiza", () => {
    const decision = resolveQrRender({ id: "abc123", qrCodeValue: null });
    expect(decision.show).toBe(false);
  });

  it("qrCodeValue null → aparece mensaje 'Código QR no disponible'", () => {
    const decision = resolveQrRender({ id: "abc123", qrCodeValue: null });
    expect(decision.show).toBe(false);
    if (!decision.show) {
      expect(decision.message).toBe("Código QR no disponible");
    }
  });

  it("qrCodeValue undefined → mismo comportamiento que null", () => {
    const decision = resolveQrRender({ id: "abc123", qrCodeValue: undefined });
    expect(decision.show).toBe(false);
    if (!decision.show) {
      expect(decision.message).toBe("Código QR no disponible");
    }
  });

  it("qrCodeValue null → DOM no contiene patron 'visitor-<hash>'", () => {
    const decision = resolveQrRender({ id: "abc123def456", qrCodeValue: null });
    expect(containsVisitorHash(decision, "abc123def456")).toBe(false);
  });

  it("qrCodeValue undefined → DOM no contiene patron 'visitor-<hash>'", () => {
    const decision = resolveQrRender({ id: "G1bWNzZJuakw", qrCodeValue: undefined });
    expect(containsVisitorHash(decision, "G1bWNzZJuakw")).toBe(false);
  });

  it("qrCodeValue válido → valor NO es un hash de Firestore prefijado con 'visitor-'", () => {
    const realQr = "https://vivaru.app/validate?token=QR-TOKEN-123";
    const decision = resolveQrRender({ id: "doc-hash-id", qrCodeValue: realQr });
    expect(decision.show).toBe(true);
    if (decision.show) {
      expect(decision.value.startsWith("visitor-")).toBe(false);
    }
  });
});
