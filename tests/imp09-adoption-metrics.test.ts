/**
 * tests/imp09-adoption-metrics.test.ts
 *
 * IMP-09 — Dashboard métricas de adopción: tests puros sin React Testing Library.
 * Bloques: types | score | services | indexes | navigation
 */

import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — types.ts: interfaces y constantes
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GlobalAdoptionSummary,
  TenantAdoptionMetrics,
} from "../src/features/superadmin/metrics/types";

const BASE_METRICS: TenantAdoptionMetrics = {
  tenantId: "t-test",
  tenantName: "El Nogal",
  status: "active",
  units: 10,
  activeResidents: 5,
  openTickets: 2,
  ticketsLast30d: 3,
  visitsLast30d: 4,
  billingsLast30d: 2,
  packagesLast30d: 1,
  adoptionScore: 100,
  adoptionLevel: "high",
  fetchedAt: new Date(),
};

describe("BLOQUE 1 — types.ts: interfaces", () => {
  describe("TenantAdoptionMetrics", () => {
    it("objeto mock con todos los campos numéricos requeridos es válido", () => {
      expect(BASE_METRICS.units).toBe(10);
      expect(BASE_METRICS.activeResidents).toBe(5);
      expect(BASE_METRICS.openTickets).toBe(2);
      expect(BASE_METRICS.ticketsLast30d).toBe(3);
      expect(BASE_METRICS.visitsLast30d).toBe(4);
      expect(BASE_METRICS.billingsLast30d).toBe(2);
      expect(BASE_METRICS.packagesLast30d).toBe(1);
      expect(BASE_METRICS.adoptionScore).toBe(100);
    });

    it("planId es opcional — objeto sin planId compila y es undefined", () => {
      const m: TenantAdoptionMetrics = { ...BASE_METRICS };
      expect(m.planId).toBeUndefined();
    });

    it("planId se asigna como string cuando se provee", () => {
      const m: TenantAdoptionMetrics = { ...BASE_METRICS, planId: "plan-premium" };
      expect(m.planId).toBe("plan-premium");
    });

    it("fetchedAt es instancia de Date (no string)", () => {
      expect(BASE_METRICS.fetchedAt).toBeInstanceOf(Date);
      expect(typeof BASE_METRICS.fetchedAt).not.toBe("string");
    });

    it.each(["high", "medium", "low"] as const)(
      'adoptionLevel acepta "%s"',
      (level) => {
        const m: TenantAdoptionMetrics = { ...BASE_METRICS, adoptionLevel: level };
        expect(m.adoptionLevel).toBe(level);
      },
    );

    it.each(["trial", "active", "suspended"] as const)(
      'status acepta "%s"',
      (status) => {
        const m: TenantAdoptionMetrics = { ...BASE_METRICS, status };
        expect(m.status).toBe(status);
      },
    );
  });

  describe("GlobalAdoptionSummary", () => {
    it("tiene todos los campos requeridos con valores correctos", () => {
      const s: GlobalAdoptionSummary = {
        totalTenants: 10,
        activeTenants: 7,
        totalOpenTickets: 15,
        highAdoptionCount: 4,
      };
      expect(s.totalTenants).toBe(10);
      expect(s.activeTenants).toBe(7);
      expect(s.totalOpenTickets).toBe(15);
      expect(s.highAdoptionCount).toBe(4);
    });

    it("todos los campos son numéricos", () => {
      const s: GlobalAdoptionSummary = {
        totalTenants: 0,
        activeTenants: 0,
        totalOpenTickets: 0,
        highAdoptionCount: 0,
      };
      for (const key of [
        "totalTenants",
        "activeTenants",
        "totalOpenTickets",
        "highAdoptionCount",
      ] as const) {
        expect(typeof s[key]).toBe("number");
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — Score de adopción: lógica de cálculo
// ─────────────────────────────────────────────────────────────────────────────

type AdoptionLevel = "high" | "medium" | "low";

/** Replica exacta del algoritmo en services.ts */
function calcScore(
  m: Partial<{
    activeResidents: number;
    ticketsLast30d: number;
    visitsLast30d: number;
    billingsLast30d: number;
    packagesLast30d: number;
  }>,
): { score: number; level: AdoptionLevel } {
  const {
    activeResidents = 0,
    ticketsLast30d = 0,
    visitsLast30d = 0,
    billingsLast30d = 0,
    packagesLast30d = 0,
  } = m;

  const activeModules = [
    activeResidents > 0,
    ticketsLast30d > 0,
    visitsLast30d > 0,
    billingsLast30d > 0,
    packagesLast30d > 0,
  ].filter(Boolean).length;

  const score = Math.round((activeModules / 5) * 100);
  const level: AdoptionLevel =
    score >= 80 ? "high" : score >= 40 ? "medium" : "low";

  return { score, level };
}

describe("BLOQUE 2 — Score de adopción", () => {
  it("5/5 módulos activos → score=100, level=high", () => {
    const result = calcScore({
      activeResidents: 10,
      ticketsLast30d: 3,
      visitsLast30d: 5,
      billingsLast30d: 4,
      packagesLast30d: 2,
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe("high");
  });

  it("4/5 módulos → score=80, level=high (límite high)", () => {
    const result = calcScore({
      activeResidents: 5,
      ticketsLast30d: 0,
      visitsLast30d: 3,
      billingsLast30d: 2,
      packagesLast30d: 1,
    });
    expect(result.score).toBe(80);
    expect(result.level).toBe("high");
  });

  it("3/5 módulos → score=60, level=medium", () => {
    const result = calcScore({
      activeResidents: 3,
      ticketsLast30d: 0,
      visitsLast30d: 2,
      billingsLast30d: 1,
      packagesLast30d: 0,
    });
    expect(result.score).toBe(60);
    expect(result.level).toBe("medium");
  });

  it("2/5 módulos → score=40, level=medium (≥40 es medium, no low)", () => {
    const result = calcScore({
      activeResidents: 1,
      ticketsLast30d: 0,
      visitsLast30d: 0,
      billingsLast30d: 1,
      packagesLast30d: 0,
    });
    expect(result.score).toBe(40);
    expect(result.level).toBe("medium");
  });

  it("1/5 módulos → score=20, level=low", () => {
    const result = calcScore({
      activeResidents: 0,
      ticketsLast30d: 0,
      visitsLast30d: 1,
      billingsLast30d: 0,
      packagesLast30d: 0,
    });
    expect(result.score).toBe(20);
    expect(result.level).toBe("low");
  });

  it("0/5 módulos (tenant vacío) → score=0, level=low", () => {
    const result = calcScore({
      activeResidents: 0,
      ticketsLast30d: 0,
      visitsLast30d: 0,
      billingsLast30d: 0,
      packagesLast30d: 0,
    });
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — services.ts: campos de tiempo y queries
// ─────────────────────────────────────────────────────────────────────────────

const mockGetDocs = vi.fn();
const mockCollection = vi.fn(() => "col-ref");
const mockQuery = vi.fn((_col: unknown, ...constraints: unknown[]) => ({
  col: _col,
  constraints,
}));
const mockWhere = vi.fn((...args: unknown[]) => ({ type: "where", args }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...args: Parameters<typeof mockGetDocs>) => mockGetDocs(...args),
  collection: (...args: Parameters<typeof mockCollection>) => mockCollection(...args),
  query: (...args: Parameters<typeof mockQuery>) => mockQuery(...args),
  where: (...args: Parameters<typeof mockWhere>) => mockWhere(...args),
}));

vi.mock("@/lib/firebase/client", () => ({ db: { _isMock: true } }));

const { fetchAllTenantsMetrics } = await import(
  "../src/features/superadmin/metrics/services"
);

// ── Helpers ──────────────────────────────────────────────────────────────────

const ONE_TENANT_SNAP = {
  size: 1,
  docs: [
    {
      id: "tenant-1",
      data: () => ({ name: "El Nogal", status: "active", planId: "premium" }),
    },
  ],
};

function makeSnap(size: number) {
  return { size, docs: [] };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 3 — services.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish implementations cleared by resetAllMocks
    mockCollection.mockReturnValue("col-ref");
    mockQuery.mockImplementation((_col: unknown, ...c: unknown[]) => ({
      col: _col,
      constraints: c,
    }));
    mockWhere.mockImplementation((...args: unknown[]) => ({
      type: "where",
      args,
    }));
  });

  describe("fetchTenantMetrics() — campos usados en where()", () => {
    beforeEach(() => {
      // First getDocs call → tenants collection → 1 tenant doc
      // Subsequent calls → per-tenant queries → size 0
      mockGetDocs
        .mockResolvedValueOnce(ONE_TENANT_SNAP)
        .mockResolvedValue(makeSnap(0));
    });

    it("tickets 30d usa campo 'updatedAt' — NO 'createdAt'", async () => {
      await fetchAllTenantsMetrics();
      const fields = mockWhere.mock.calls.map((c) => c[0]);
      expect(fields).toContain("updatedAt");
      expect(fields).not.toContain("createdAt");
    });

    it("visitorPasses 30d usa campo 'date'", async () => {
      await fetchAllTenantsMetrics();
      const fields = mockWhere.mock.calls.map((c) => c[0]);
      expect(fields).toContain("date");
    });

    it("billingStatements 30d usa campo 'period'", async () => {
      await fetchAllTenantsMetrics();
      const fields = mockWhere.mock.calls.map((c) => c[0]);
      expect(fields).toContain("period");
    });

    it("packages 30d usa campo 'arrivedAt'", async () => {
      await fetchAllTenantsMetrics();
      const fields = mockWhere.mock.calls.map((c) => c[0]);
      expect(fields).toContain("arrivedAt");
    });

    it("tickets abiertos usa where('status', 'in', [...]) con 'open' e 'in_progress'", async () => {
      await fetchAllTenantsMetrics();
      const inCall = mockWhere.mock.calls.find(
        ([field, op]) => field === "status" && op === "in",
      );
      expect(inCall).toBeDefined();
      const statusArray = inCall![2] as string[];
      expect(statusArray).toContain("open");
      expect(statusArray).toContain("in_progress");
    });

    it("people activos usa where('status', '==', 'active')", async () => {
      await fetchAllTenantsMetrics();
      const activeCall = mockWhere.mock.calls.find(
        ([field, op, val]) =>
          field === "status" && op === "==" && val === "active",
      );
      expect(activeCall).toBeDefined();
    });

    it("todas las queries incluyen where('tenantId', '==', ...) — mínimo 7 veces", async () => {
      await fetchAllTenantsMetrics();
      const tenantIdCalls = mockWhere.mock.calls.filter(
        ([field]) => field === "tenantId",
      );
      // 7 queries per tenant, each filtered by tenantId
      expect(tenantIdCalls.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("fetchTenantMetrics() — comportamiento", () => {
    it("getDocs retorna size=5 para todo → score=100, level=high, fetchedAt=Date", async () => {
      mockGetDocs
        .mockResolvedValueOnce(ONE_TENANT_SNAP)
        .mockResolvedValue(makeSnap(5));

      const results = await fetchAllTenantsMetrics();
      expect(results).toHaveLength(1);
      expect(results[0].adoptionScore).toBe(100);
      expect(results[0].adoptionLevel).toBe("high");
      expect(results[0].fetchedAt).toBeInstanceOf(Date);
    });

    it("getDocs retorna size=0 para todo → score=0, level=low, campos en cero", async () => {
      mockGetDocs
        .mockResolvedValueOnce(ONE_TENANT_SNAP)
        .mockResolvedValue(makeSnap(0));

      const results = await fetchAllTenantsMetrics();
      expect(results[0].adoptionScore).toBe(0);
      expect(results[0].adoptionLevel).toBe("low");
      expect(results[0].units).toBe(0);
      expect(results[0].openTickets).toBe(0);
      expect(results[0].activeResidents).toBe(0);
    });
  });

  describe("fetchAllTenantsMetrics() — comportamiento", () => {
    it("con 3 tenants → resultado tiene 3 elementos", async () => {
      const threeSnap = {
        size: 3,
        docs: [
          { id: "ta", data: () => ({ name: "Tenant A", status: "active" }) },
          { id: "tb", data: () => ({ name: "Tenant B", status: "trial" }) },
          { id: "tc", data: () => ({ name: "Tenant C", status: "suspended" }) },
        ],
      };
      mockGetDocs
        .mockResolvedValueOnce(threeSnap)
        .mockResolvedValue(makeSnap(0));

      const results = await fetchAllTenantsMetrics();
      expect(results).toHaveLength(3);
    });

    it("resultado ordenado por adoptionScore DESC (score 100 primero, 0 último)", async () => {
      const twoSnap = {
        size: 2,
        docs: [
          { id: "ta", data: () => ({ name: "Alta Adopción", status: "active" }) },
          { id: "tb", data: () => ({ name: "Sin Adopción", status: "trial" }) },
        ],
      };

      // ta (tenant A): queries 1–7 → size=5 → score=100
      // tb (tenant B): queries 8–14 → size=0 → score=0
      let callCount = 0;
      mockGetDocs.mockImplementation(() => {
        const n = callCount++;
        if (n === 0) return Promise.resolve(twoSnap);   // tenants
        if (n <= 7) return Promise.resolve(makeSnap(5)); // ta queries
        return Promise.resolve(makeSnap(0));             // tb queries
      });

      const results = await fetchAllTenantsMetrics();
      expect(results[0].tenantId).toBe("ta");
      expect(results[0].adoptionScore).toBe(100);
      expect(results[1].tenantId).toBe("tb");
      expect(results[1].adoptionScore).toBe(0);
    });

    it("resultado siempre ordenado DESC sin importar orden de entrada", async () => {
      const threeSnap = {
        size: 3,
        docs: [
          { id: "ta", data: () => ({ name: "Tenant A", status: "active" }) },
          { id: "tb", data: () => ({ name: "Tenant B", status: "trial" }) },
          { id: "tc", data: () => ({ name: "Tenant C", status: "suspended" }) },
        ],
      };

      // ta: score=100, tb: score=20 (1 módulo), tc: score=0
      let callCount = 0;
      mockGetDocs.mockImplementation(() => {
        const n = callCount++;
        if (n === 0) return Promise.resolve(threeSnap);
        // ta (calls 1–7): all size=5 → score=100
        if (n <= 7) return Promise.resolve(makeSnap(5));
        // tb (calls 8–14): only activeResidents (call 9) returns 1 → 1 module
        if (n === 9) return Promise.resolve(makeSnap(1));
        if (n <= 14) return Promise.resolve(makeSnap(0));
        // tc (calls 15–21): all size=0 → score=0
        return Promise.resolve(makeSnap(0));
      });

      const results = await fetchAllTenantsMetrics();
      expect(results).toHaveLength(3);
      // Scores must be non-increasing
      expect(results[0].adoptionScore).toBeGreaterThanOrEqual(results[1].adoptionScore);
      expect(results[1].adoptionScore).toBeGreaterThanOrEqual(results[2].adoptionScore);
      expect(results[0].adoptionScore).toBe(100);
      expect(results[2].adoptionScore).toBe(0);
    });

    it("con 0 tenants → retorna array vacío", async () => {
      mockGetDocs.mockResolvedValue({ size: 0, docs: [] });

      const results = await fetchAllTenantsMetrics();
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 — firestore.indexes.json: índices estáticos
// ─────────────────────────────────────────────────────────────────────────────

const indexesPath = path.resolve(__dirname, "../firestore.indexes.json");
const indexesJson = JSON.parse(fs.readFileSync(indexesPath, "utf8")) as {
  indexes: Array<{
    collectionGroup: string;
    fields: Array<{ fieldPath: string; order: string }>;
  }>;
};

function hasIndex(collection: string, ...fields: string[]): boolean {
  return indexesJson.indexes.some(
    (idx) =>
      idx.collectionGroup === collection &&
      fields.every((f) => idx.fields.some((fld) => fld.fieldPath === f)),
  );
}

describe("BLOQUE 4 — firestore.indexes.json: índices IMP-09", () => {
  it("existe índice tickets → tenantId + status", () => {
    expect(hasIndex("tickets", "tenantId", "status")).toBe(true);
  });

  it("existe índice tickets → tenantId + updatedAt", () => {
    expect(hasIndex("tickets", "tenantId", "updatedAt")).toBe(true);
  });

  it("existe índice visitorPasses → tenantId + date", () => {
    expect(hasIndex("visitorPasses", "tenantId", "date")).toBe(true);
  });

  it("existe índice billingStatements → tenantId + period", () => {
    expect(hasIndex("billingStatements", "tenantId", "period")).toBe(true);
  });

  it("existe índice packages → tenantId + arrivedAt", () => {
    expect(hasIndex("packages", "tenantId", "arrivedAt")).toBe(true);
  });

  it("existe índice people → tenantId + status", () => {
    expect(hasIndex("people", "tenantId", "status")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5 — navigation.ts + nav icons: verificación estática
// ─────────────────────────────────────────────────────────────────────────────

import { roleNavigation } from "../src/lib/constants/navigation";

describe("BLOQUE 5 — navegación e íconos", () => {
  describe("navigation.ts — rol 'superadmin'", () => {
    const items = roleNavigation["superadmin"];

    it("existe entrada href='/superadmin/metrics'", () => {
      expect(items.some((i) => i.href === "/superadmin/metrics")).toBe(true);
    });

    it("label es 'Métricas' (con tilde)", () => {
      const item = items.find((i) => i.href === "/superadmin/metrics");
      expect(item?.label).toBe("Métricas");
    });

    it("Métricas aparece después de Planes y antes de Soporte", () => {
      const metricsIdx = items.findIndex((i) => i.href === "/superadmin/metrics");
      const plansIdx = items.findIndex((i) => i.href === "/superadmin/plans");
      const supportIdx = items.findIndex((i) => i.href === "/superadmin/support");
      expect(plansIdx).toBeGreaterThanOrEqual(0);
      expect(supportIdx).toBeGreaterThanOrEqual(0);
      expect(metricsIdx).toBeGreaterThan(plansIdx);
      expect(metricsIdx).toBeLessThan(supportIdx);
    });
  });

  describe("navigation.ts — rol 'super_admin'", () => {
    const items = roleNavigation["super_admin"];

    it("existe entrada href='/superadmin/metrics'", () => {
      expect(items.some((i) => i.href === "/superadmin/metrics")).toBe(true);
    });

    it("Métricas aparece después de Planes y antes de Soporte", () => {
      const metricsIdx = items.findIndex((i) => i.href === "/superadmin/metrics");
      const plansIdx = items.findIndex((i) => i.href === "/superadmin/plans");
      const supportIdx = items.findIndex((i) => i.href === "/superadmin/support");
      expect(plansIdx).toBeGreaterThanOrEqual(0);
      expect(supportIdx).toBeGreaterThanOrEqual(0);
      expect(metricsIdx).toBeGreaterThan(plansIdx);
      expect(metricsIdx).toBeLessThan(supportIdx);
    });
  });

  describe("role-sidebar-groups.ts", () => {
    const sidebarContent = fs.readFileSync(
      path.resolve(
        __dirname,
        "../src/lib/navigation/role-sidebar-groups.ts",
      ),
      "utf8",
    );

    it("mapea '/superadmin/metrics' a BarChart2", () => {
      expect(sidebarContent).toContain('"/superadmin/metrics": BarChart2');
    });

    it("BarChart2 está importado de lucide-react", () => {
      expect(sidebarContent).toMatch(
        /import\s*\{[^}]*BarChart2[^}]*\}\s*from\s*["']lucide-react["']/,
      );
    });
  });

  describe("role-nav.tsx", () => {
    const navContent = fs.readFileSync(
      path.resolve(__dirname, "../src/components/shared/role-nav.tsx"),
      "utf8",
    );

    it("mapea '/superadmin/metrics' a BarChart2", () => {
      expect(navContent).toContain('"/superadmin/metrics": BarChart2');
    });

    it("BarChart2 está importado de 'lucide-react'", () => {
      expect(navContent).toMatch(
        /import\s*\{[^}]*BarChart2[^}]*\}\s*from\s*["']lucide-react["']/,
      );
    });
  });
});
