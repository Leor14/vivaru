// tests/finanzas-recibos-admin.test.ts
// La búsqueda de la lista de recibos del administrador.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({ subscribeTenantCollection: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
}));

import { filtrarRecibos } from "@/components/features/finanzas/AdminVouchersCard";
import { codigoDeRecibo } from "@/features/finanzas/comprobante/codigo";
import type { PaymentVoucher } from "@/types/domain";

const recibo = (extra: Partial<PaymentVoucher>): PaymentVoucher =>
  ({
    id: "v1",
    tenantId: "t1",
    type: "ingreso",
    code: "REC-ABC123",
    issueDate: "2026-08-20",
    amount: 430000,
    concept: "Pago de alícuota 2026-05 — T2-204",
    ...extra,
  }) as PaymentVoucher;

describe("filtrarRecibos", () => {
  const lista = [
    recibo({ id: "v1", code: "REC-NZUBW9", payerName: "Juan Herrera", payerUnitLabel: "T2-204" }),
    recibo({ id: "v2", code: "REC-XYZ789", payerName: "Ana Ruiz", payerUnitLabel: "T1-101" }),
    recibo({ id: "v3", code: "REC-QQQ111", payerUnitLabel: "T1-102" }),
  ];

  it("sin búsqueda devuelve todo, y la MISMA referencia", () => {
    // Importa para el useMemo del componente: devolver un array nuevo en cada
    // render haría que la tabla se repintara sin motivo.
    expect(filtrarRecibos(lista, "")).toBe(lista);
    expect(filtrarRecibos(lista, "   ")).toBe(lista);
  });

  it("encuentra por código, sin distinguir mayúsculas", () => {
    expect(filtrarRecibos(lista, "nzubw9").map((v) => v.id)).toEqual(["v1"]);
    expect(filtrarRecibos(lista, "REC-XYZ789").map((v) => v.id)).toEqual(["v2"]);
  });

  it("encuentra por unidad y por pagador", () => {
    expect(filtrarRecibos(lista, "T1-101").map((v) => v.id)).toEqual(["v2"]);
    expect(filtrarRecibos(lista, "herrera").map((v) => v.id)).toEqual(["v1"]);
  });

  it("encuentra por concepto, que es donde vive el período", () => {
    expect(filtrarRecibos(lista, "2026-05")).toHaveLength(3);
  });

  it("tolera recibos sin pagador — el nombre es opcional", () => {
    // `v3` no tiene payerName. Si el filtro no lo tolerara, buscar cualquier
    // cosa reventaría en cuanto un recibo se emitiera sin nombre, que está
    // permitido desde que la cédula dejó de ser obligatoria.
    expect(() => filtrarRecibos(lista, "ruiz")).not.toThrow();
    expect(filtrarRecibos(lista, "T1-102").map((v) => v.id)).toEqual(["v3"]);
  });

  it("devuelve vacío cuando nada coincide", () => {
    expect(filtrarRecibos(lista, "no-existe")).toEqual([]);
  });
});

describe("codigoDeRecibo", () => {
  const base = { code: "", sequentialNumber: undefined } as Pick<
    PaymentVoucher,
    "code" | "sequentialNumber"
  >;

  it("usa el código nuevo cuando existe", () => {
    expect(codigoDeRecibo({ ...base, code: "REC-ABC123" })).toBe("REC-ABC123");
  });

  it("cae al secuencial viejo en los recibos anteriores al cambio", () => {
    // Es el caso real que se vio en producción: el recibo 000000001 no tiene
    // `code`, y leer solo el campo nuevo pintaba «No. undefined» en el PDF.
    expect(codigoDeRecibo({ ...base, sequentialNumber: "000000001" })).toBe("000000001");
  });

  it("prefiere el nuevo si por lo que sea estuvieran los dos", () => {
    expect(codigoDeRecibo({ code: "REC-ABC123", sequentialNumber: "000000001" })).toBe("REC-ABC123");
  });

  it("nunca devuelve undefined: sin ninguno de los dos, devuelve una raya", () => {
    // Un guion es feo, pero es legible. `undefined` en un PDF no lo es, y
    // encima se colaba en el nombre del archivo.
    expect(codigoDeRecibo(base)).toBe("—");
  });
});
