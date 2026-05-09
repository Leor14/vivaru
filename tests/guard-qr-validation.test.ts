import { describe, expect, it } from "vitest";

import {
  getVisitorSortTimestamp,
  normalizeQrPayload,
  resolveVisitorFromQr,
  type VisitorCardItem,
} from "../src/features/visitors/guard-qr-validation";

function makeVisitor(overrides?: Partial<VisitorCardItem>): VisitorCardItem {
  return {
    id: "vis-1",
    tenantId: "tenant-a",
    unitId: "unit-1",
    unitLabel: "T1-101",
    visitorName: "Visitante Uno",
    documentNumber: "123",
    qrCodeValue: "QR-UNO",
    hostResidentName: "Residente Uno",
    tower: "T1",
    unit: "101",
    date: "2026-03-29",
    scheduledTime: "09:00",
    status: "scheduled",
    operationalStatus: "scheduled",
    ...overrides,
  };
}

describe("normalizeQrPayload", () => {
  it("extrae token desde URL", () => {
    const payload = "https://hogaru.app/validate?token=QR-ABC-123";
    expect(normalizeQrPayload(payload)).toBe("QR-ABC-123");
  });

  it("decodifica payload urlencoded", () => {
    expect(normalizeQrPayload("QR%20CODIGO%201")).toBe("QR CODIGO 1");
  });
});

describe("getVisitorSortTimestamp", () => {
  it("prioriza fecha + hora", () => {
    const early = getVisitorSortTimestamp({ date: "2026-03-29", scheduledTime: "08:00" });
    const late = getVisitorSortTimestamp({ date: "2026-03-29", scheduledTime: "09:00" });
    expect(late).toBeGreaterThan(early);
  });

  it("tolera registros legacy sin fecha", () => {
    expect(getVisitorSortTimestamp({ date: "", scheduledTime: "" })).toBe(0);
  });
});

describe("resolveVisitorFromQr", () => {
  it("resuelve visitante valido por QR", () => {
    const visitor = makeVisitor({ id: "vis-1", qrCodeValue: "QR-UNO" });

    const result = resolveVisitorFromQr({
      rawCode: "QR-UNO",
      rows: [visitor],
      tenantId: "tenant-a",
    });

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.visitor.id).toBe("vis-1");
    }
  });

  it("retorna not-found cuando QR no existe", () => {
    const visitor = makeVisitor({ id: "vis-1", qrCodeValue: "QR-UNO" });

    const result = resolveVisitorFromQr({
      rawCode: "QR-DESCONOCIDO",
      rows: [visitor],
      tenantId: "tenant-a",
    });

    expect(result.kind).toBe("not-found");
  });

  it("no cruza tenants al resolver QR", () => {
    const tenantAVisitor = makeVisitor({ id: "vis-a", tenantId: "tenant-a", qrCodeValue: "QR-UNO" });
    const tenantBVisitor = makeVisitor({ id: "vis-b", tenantId: "tenant-b", qrCodeValue: "QR-UNO" });

    const result = resolveVisitorFromQr({
      rawCode: "QR-UNO",
      rows: [tenantAVisitor, tenantBVisitor],
      tenantId: "tenant-a",
    });

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect(result.visitor.id).toBe("vis-a");
    }
  });

  it("normaliza URL escaneada y valida contra token esperado", () => {
    const visitor = makeVisitor({ qrCodeValue: "TOKEN-123" });

    const result = resolveVisitorFromQr({
      rawCode: "https://hogaru.app/access?code=TOKEN-123",
      rows: [visitor],
      tenantId: "tenant-a",
    });

    expect(result.kind).toBe("found");
  });
});
