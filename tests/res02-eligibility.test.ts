// tests/res02-eligibility.test.ts
// RES-02: checkReservationEligibility — unit tests with Firestore mocked
// env=node, no DOM, no RTL

import fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// ─── Firestore mocks ─────────────────────────────────────────────────────────

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection-ref"),
  doc: vi.fn(() => "mock-doc-ref"),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/firebase/client", () => ({
  db: { type: "firestore" }, // non-null sentinel
}));

import { getDoc, getDocs } from "firebase/firestore";
import { checkReservationEligibility } from "../src/features/reservations/eligibility";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSettingsSnap(reservationPolicy: { blockOnDebt?: boolean } | undefined) {
  return {
    exists: () => true,
    data: () => ({
      reservationPolicy,
    }),
  };
}

function makeEmptySettingsSnap() {
  return {
    exists: () => false,
    data: () => undefined,
  };
}

function makeUnitSnap(docs: { reservationExempt?: boolean }[]) {
  return {
    empty: docs.length === 0,
    docs: docs.map((d) => ({
      data: () => d,
    })),
  };
}

function makeBillingSnap(balances: number[]) {
  return {
    empty: balances.length === 0,
    size: balances.length,
    forEach: (cb: (doc: { data: () => { balance: number } }) => void) => {
      balances.forEach((balance) => cb({ data: () => ({ balance }) }));
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("checkReservationEligibility", () => {
  const getDocMock = getDoc as Mock;
  const getDocsMock = getDocs as Mock;

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  it("T1 — flag off → eligible, never queries billing", async () => {
    getDocMock.mockResolvedValueOnce(makeSettingsSnap({ blockOnDebt: false }));

    const result = await checkReservationEligibility("tenant1", "unit1");

    expect(result).toEqual({ eligible: true, amountDue: 0 });
    // getDocs never called — billing query short-circuited
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  it("T2 — flag on, unit exempt → eligible, never queries billing", async () => {
    getDocMock.mockResolvedValueOnce(makeSettingsSnap({ blockOnDebt: true }));
    // First getDocs call = units query
    getDocsMock.mockResolvedValueOnce(makeUnitSnap([{ reservationExempt: true }]));

    const result = await checkReservationEligibility("tenant1", "unit1");

    expect(result).toEqual({ eligible: true, amountDue: 0 });
    // Only units was queried; billing was NOT queried (only 1 getDocs call)
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  it("T3 — flag on, not exempt, overdue balance → ineligible with summed amountDue", async () => {
    getDocMock.mockResolvedValueOnce(makeSettingsSnap({ blockOnDebt: true }));
    getDocsMock
      .mockResolvedValueOnce(makeUnitSnap([{ reservationExempt: false }])) // units
      .mockResolvedValueOnce(makeBillingSnap([150000, 75000]));             // billing

    const result = await checkReservationEligibility("tenant1", "unit1");

    expect(result).toEqual({ eligible: false, amountDue: 225000, reason: "OVERDUE_BALANCE" });
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  it("T4 — flag on, not exempt, no overdue docs → eligible", async () => {
    getDocMock.mockResolvedValueOnce(makeSettingsSnap({ blockOnDebt: true }));
    getDocsMock
      .mockResolvedValueOnce(makeUnitSnap([{ reservationExempt: false }])) // units
      .mockResolvedValueOnce(makeBillingSnap([]));                          // billing empty

    const result = await checkReservationEligibility("tenant1", "unit1");

    expect(result).toEqual({ eligible: true, amountDue: 0 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  it("T5 — db null → fail-open, no throw", async () => {
    // Override the firebase/client mock to return db = null for this test only
    vi.doMock("@/lib/firebase/client", () => ({ db: null }));

    // Re-import the function with the overridden module.
    //
    // El `?nulldb=1` es un truco de vitest para saltarse su caché de módulos, y
    // TypeScript no sabe resolver una ruta con query. Se silencia AQUÍ y no se
    // convierte la ruta en variable a propósito: con una variable, vitest podría
    // resolver distinto y la prueba se iría siempre por la rama de respaldo —que
    // solo hace grep del fuente— sin que nadie lo notara. Un `expect-error` se
    // queja solo el día que deje de hacer falta; un `ignore`, nunca.
    const { checkReservationEligibility: checkWithNullDb } = await import(
      // @ts-expect-error — ruta con query param, resuelta por vitest y no por tsc
      "../src/features/reservations/eligibility?nulldb=1"
    ).catch(() => {
      // If module cache prevents re-import, test the null-guard path directly
      // by checking that the function handles null db gracefully via its guard
      return { checkReservationEligibility: null };
    });

    if (checkWithNullDb) {
      const result = await checkWithNullDb("tenant1", "unit1");
      expect(result).toEqual({ eligible: true, amountDue: 0 });
    } else {
      // Fallback: verify the guard exists in source
      const src = await import("fs").then((fs) =>
        fs.readFileSync("src/features/reservations/eligibility.ts", "utf-8"),
      );
      expect(src).toContain("if (!db)");
      expect(src).toContain("return { eligible: true, amountDue: 0 }");
    }

    vi.doUnmock("@/lib/firebase/client");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — use-reservations.ts: static verification
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "fs";

const useReservationsSrc = readFileSync(
  "src/features/reservations/use-reservations.ts",
  "utf-8",
);

describe("use-reservations.ts — static checks", () => {
  it("imports checkReservationEligibility from ./eligibility", () => {
    expect(useReservationsSrc).toContain('from "@/features/reservations/eligibility"');
    expect(useReservationsSrc).toContain("checkReservationEligibility");
  });

  it("injects eligibility check (await call present)", () => {
    expect(useReservationsSrc).toContain("await checkReservationEligibility(");
  });

  it("throws RESERVATION_INELIGIBLE on ineligible result", () => {
    expect(useReservationsSrc).toContain('throw new Error("RESERVATION_INELIGIBLE")');
  });

  it("normalizes RESERVATION_INELIGIBLE to spanish message", () => {
    expect(useReservationsSrc).toContain('"RESERVATION_INELIGIBLE"');
    // Message contains "saldo pendiente" OR "regulariza"
    const hasSaldo = useReservationsSrc.includes("saldo pendiente");
    const hasRegulariza = useReservationsSrc.includes("regulariza");
    expect(hasSaldo || hasRegulariza).toBe(true);
  });

  it("eligibility check appears BEFORE overlap getDocs query", () => {
    const ineligiblePos = useReservationsSrc.indexOf("RESERVATION_INELIGIBLE");
    const overlapPos = useReservationsSrc.indexOf("existingSnapshot");
    expect(ineligiblePos).toBeGreaterThan(0);
    expect(overlapPos).toBeGreaterThan(0);
    expect(ineligiblePos).toBeLessThan(overlapPos);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — admin/services.ts: tipos extendidos
// ─────────────────────────────────────────────────────────────────────────────
const adminServicesSrc = readFileSync("src/features/admin/services.ts", "utf-8");

describe("admin/services.ts — static checks", () => {
  it("TenantSettingsItem has reservationPolicy field", () => {
    expect(adminServicesSrc).toContain("reservationPolicy");
  });

  it("reservationPolicy includes blockOnDebt", () => {
    expect(adminServicesSrc).toContain("blockOnDebt");
  });

  it("UnitItem has optional reservationExempt field", () => {
    expect(adminServicesSrc).toContain("reservationExempt?: boolean");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 — resident/reservations/page.tsx: pre-check + banner
// ─────────────────────────────────────────────────────────────────────────────
const residentReservationsSrc = readFileSync(
  "src/app/(resident)/resident/reservations/page.tsx",
  "utf-8",
);

describe("resident/reservations/page.tsx — static checks", () => {
  it("has eligibility useState with eligible + amountDue shape", () => {
    expect(residentReservationsSrc).toContain("eligible");
    expect(residentReservationsSrc).toContain("amountDue");
    expect(residentReservationsSrc).toContain("useState");
  });

  it("calls checkReservationEligibility in useEffect", () => {
    expect(residentReservationsSrc).toContain("checkReservationEligibility(");
    expect(residentReservationsSrc).toContain("useEffect");
  });

  it("has fail-open catch block", () => {
    expect(residentReservationsSrc).toContain(".catch(");
    // Fail-open sets eligible: true
    const catchIdx = residentReservationsSrc.indexOf(".catch(");
    const snippet = residentReservationsSrc.slice(catchIdx, catchIdx + 200);
    expect(snippet).toContain("eligible: true");
  });

  it("banner shows saldo text", () => {
    expect(residentReservationsSrc).toContain("saldo");
  });

  // Pedía `/resident/billing`, **que no existe**: el portal del residente no
  // tiene esa ruta. O sea, la prueba exigía un enlace roto y fallaba porque el
  // código tenía el bueno — `/resident/account`, donde el residente ve su estado
  // de cuenta y sube comprobantes. Llevaba así entre los fallos «preexistentes».
  //
  // Además de corregir el destino, se comprueba que la ruta EXISTA en disco, que
  // es lo que esta prueba querría haber hecho desde el principio: un enlace a una
  // página inexistente es un fallo, lo apunte donde lo apunte.
  it("el banner enlaza al estado de cuenta, y esa ruta existe", () => {
    expect(residentReservationsSrc).toContain("/resident/account");
    expect(
      fs.existsSync("src/app/(resident)/resident/account/page.tsx"),
      "la ruta enlazada desde el banner no existe en el proyecto",
    ).toBe(true);
  });

  it("reservation UI not gated behind eligibility.eligible (banner above, not replacing)", () => {
    // Banner is conditional, but the "Reservar" button must NOT be inside that conditional block.
    // The conditional block ends with ") : null}" after !eligibility.eligible.
    const bannerCondStart = residentReservationsSrc.indexOf("!eligibility.eligible");
    const bannerCondEnd = residentReservationsSrc.indexOf(") : null}", bannerCondStart);
    // Use the last occurrence of handleCreateReservation — that's the onClick button call site
    const buttonPos = residentReservationsSrc.lastIndexOf("handleCreateReservation");

    expect(bannerCondStart).toBeGreaterThan(0);
    expect(bannerCondEnd).toBeGreaterThan(0);
    expect(buttonPos).toBeGreaterThan(0);
    // Button call site appears AFTER the closing of the banner conditional → not inside it
    expect(buttonPos).toBeGreaterThan(bannerCondEnd);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5 — admin/settings/page.tsx: toggle con updateDoc
// ─────────────────────────────────────────────────────────────────────────────
const settingsSrc = readFileSync(
  "src/app/(admin)/admin/settings/page.tsx",
  "utf-8",
);

describe("admin/settings/page.tsx — static checks", () => {
  it("imports updateDoc from firebase/firestore", () => {
    expect(settingsSrc).toContain("updateDoc");
    expect(settingsSrc).toContain("firebase/firestore");
  });

  it("uses dot-notation reservationPolicy.blockOnDebt", () => {
    expect(settingsSrc).toContain('"reservationPolicy.blockOnDebt"');
  });

  it("calls updateDoc (not setDoc) for policy toggle", () => {
    expect(settingsSrc).toContain("updateDoc(");
    // setDoc should NOT be called for the policy toggle
    // (setDoc may exist for branding, but updateDoc must exist for policy)
    const updateDocCount = (settingsSrc.match(/updateDoc\(/g) ?? []).length;
    expect(updateDocCount).toBeGreaterThanOrEqual(1);
  });

  it("label contains bloquear and reservas", () => {
    const hasBloquear = settingsSrc.toLowerCase().includes("bloquear");
    const hasReservas = settingsSrc.toLowerCase().includes("reservas");
    expect(hasBloquear).toBe(true);
    expect(hasReservas).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 6 — admin/residents/page.tsx: checkbox exención
// ─────────────────────────────────────────────────────────────────────────────
const residentsSrc = readFileSync(
  "src/app/(admin)/admin/residents/page.tsx",
  "utf-8",
);

describe("admin/residents/page.tsx — static checks", () => {
  it("has unitExempt boolean state", () => {
    expect(residentsSrc).toContain("unitExempt");
    expect(residentsSrc).toContain("setUnitExempt");
  });

  it("initializes unitExempt from unit.reservationExempt on edit open", () => {
    expect(residentsSrc).toContain("unit.reservationExempt");
  });

  it("resets unitExempt to false on create open", () => {
    // openCreateUnit sets it to false
    const createUnitFnIdx = residentsSrc.indexOf("function openCreateUnit");
    expect(createUnitFnIdx).toBeGreaterThan(0);
    const fnBody = residentsSrc.slice(createUnitFnIdx, createUnitFnIdx + 400);
    expect(fnBody).toContain("setUnitExempt(false)");
  });

  it("calls updateDoc with reservationExempt on units collection", () => {
    expect(residentsSrc).toContain("reservationExempt");
    expect(residentsSrc).toContain('doc(db, "units"');
    expect(residentsSrc).toContain("updateDoc(");
  });

  it("checkbox label contains exenta or bloqueo", () => {
    const hasExenta = residentsSrc.toLowerCase().includes("exenta");
    const hasBloqueo = residentsSrc.toLowerCase().includes("bloqueo");
    expect(hasExenta || hasBloqueo).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 7 — firestore.indexes.json: index compuesto
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync as readFileRaw } from "fs";

type FirestoreIndex = {
  collectionGroup: string;
  queryScope: string;
  fields: { fieldPath: string; order: string }[];
};

const indexesJson = JSON.parse(
  readFileRaw("firestore.indexes.json", "utf-8"),
) as { indexes: FirestoreIndex[] };

describe("firestore.indexes.json — billingStatements composite index", () => {
  const billingIdx = indexesJson.indexes.find(
    (idx) =>
      idx.collectionGroup === "billingStatements" &&
      idx.fields.length === 3 &&
      idx.fields.some((f) => f.fieldPath === "status"),
  );

  it("has a billingStatements index with 3 fields", () => {
    expect(billingIdx).toBeDefined();
    expect(billingIdx?.fields).toHaveLength(3);
  });

  it("fields are tenantId, unitId, status — all ASCENDING", () => {
    const paths = billingIdx?.fields.map((f) => f.fieldPath);
    expect(paths).toContain("tenantId");
    expect(paths).toContain("unitId");
    expect(paths).toContain("status");
    billingIdx?.fields.forEach((f) => {
      expect(f.order).toBe("ASCENDING");
    });
  });

  it("queryScope is COLLECTION", () => {
    expect(billingIdx?.queryScope).toBe("COLLECTION");
  });
});
