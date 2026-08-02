/**
 * tests/imp07-support-module.test.ts
 *
 * IMP-07 — Módulo de soporte: tests puros sin React Testing Library.
 * Bloques: types | schemas | services | watchSupportTickets (hook backing) | rules
 */

import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 1 — types.ts: constantes y tipos
// ─────────────────────────────────────────────────────────────────────────────

import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportTicket,
} from "../src/features/superadmin/support/types";

describe("BLOQUE 1 — types.ts: constantes", () => {
  describe("SUPPORT_CATEGORIES", () => {
    it("tiene exactamente 4 keys", () => {
      expect(Object.keys(SUPPORT_CATEGORIES)).toHaveLength(4);
    });

    it.each([
      ["technical", "Técnico"],
      ["billing", "Facturación"],
      ["operational", "Operativo"],
      ["other", "Otro"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_CATEGORIES[key]).toBe(label);
    });
  });

  describe("SUPPORT_STATUSES", () => {
    it("tiene exactamente 3 keys", () => {
      expect(Object.keys(SUPPORT_STATUSES)).toHaveLength(3);
    });

    it.each([
      ["open", "Abierto"],
      ["in_progress", "En progreso"],
      ["resolved", "Resuelto"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_STATUSES[key]).toBe(label);
    });
  });

  describe("SUPPORT_PRIORITIES", () => {
    it("tiene exactamente 3 keys", () => {
      expect(Object.keys(SUPPORT_PRIORITIES)).toHaveLength(3);
    });

    it.each([
      ["high", "Alta"],
      ["medium", "Media"],
      ["low", "Baja"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_PRIORITIES[key]).toBe(label);
    });
  });

  describe("SupportTicket interface — compatibilidad de tipos", () => {
    it("objeto completo compila sin error de tipo", () => {
      const ticket: SupportTicket = {
        id: "st-001",
        tenantId: "tenant-nogal-bogota",
        tenantName: "Conjunto Residencial El Nogal",
        reportedBy: "admin@elnogal.co",
        reportedByName: "Claudia Moreno",
        category: "technical",
        subject: "Falla en login",
        description: "El admin no puede iniciar sesión desde ayer.",
        priority: "high",
        status: "open",
        createdAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        updatedAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        resolvedAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        createdBy: "uid-superadmin-1",
        notes: "Revisando con el equipo técnico.",
        responseHistory: [
          {
            id: "rh-001",
            message: "Se escaló al equipo de infraestructura.",
            createdAt: "2026-05-09T10:00:00.000Z",
            createdBy: "uid-superadmin-1",
            createdByName: "Superadmin HOGARU",
          },
        ],
      };
      // Si compila → el type es correcto. Runtime: solo verificar que tiene los campos requeridos.
      expect(ticket.id).toBe("st-001");
      expect(ticket.tenantId).toBe("tenant-nogal-bogota");
      expect(ticket.status).toBe("open");
    });

    it("ticket sin resolvedAt es tipo válido (campo opcional)", () => {
      const ticket: SupportTicket = {
        id: "st-002",
        tenantId: "tenant-palmas-cdmx",
        tenantName: "Privada Las Palmas",
        reportedBy: "admin@privadapalmas.mx",
        category: "billing",
        subject: "Cobro duplicado",
        description: "Aparecen dos cobros del mes de abril.",
        priority: "medium",
        status: "in_progress",
        createdAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        updatedAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        createdBy: "uid-superadmin-1",
        // resolvedAt ausente — debe ser válido
      };
      expect(ticket.resolvedAt).toBeUndefined();
    });

    it("ticket con responseHistory vacío es válido", () => {
      const ticket: SupportTicket = {
        id: "st-003",
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        reportedBy: "admin@tenant-a.co",
        category: "operational",
        subject: "Consulta operativa",
        description: "Pregunta sobre proceso de onboarding.",
        priority: "low",
        status: "open",
        createdAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        updatedAt: { toDate: () => new Date() } as unknown as import("firebase/firestore").Timestamp,
        createdBy: "uid-superadmin-1",
        responseHistory: [],
      };
      expect(ticket.responseHistory).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 2 — schemas.ts: validación Zod
// ─────────────────────────────────────────────────────────────────────────────

import { supportTicketCreateSchema } from "../src/features/superadmin/support/schemas";

const VALID_INPUT = {
  tenantId: "t1",
  tenantName: "El Nogal",
  reportedBy: "admin@elnogal.co",
  category: "technical" as const,
  subject: "Falla login",
  description: "No puede entrar desde ayer en el portal.",
  priority: "high" as const,
};

describe("BLOQUE 2 — schemas.ts: validación Zod", () => {
  it("input válido mínimo pasa sin errores", () => {
    const result = supportTicketCreateSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("input válido con campos opcionales pasa", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      reportedByName: "Claudia Moreno",
      notes: "Notas internas del equipo.",
    });
    expect(result.success).toBe(true);
  });

  it("reportedBy no-email → error en reportedBy", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      reportedBy: "no-es-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("reportedBy");
    }
  });

  it("subject < 5 chars → error en subject", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      subject: "cort",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("subject");
    }
  });

  it("subject de 101 chars → error en subject", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      subject: "x".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("subject");
    }
  });

  it("description < 10 chars → error en description", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      description: "breve",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("description");
    }
  });

  it("category 'unknown_cat' → error en category", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      category: "unknown_cat",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("category");
    }
  });

  it("priority 'critical' (no existe) → error en priority", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      priority: "critical",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("priority");
    }
  });

  it("tenantId vacío → error en tenantId", () => {
    const result = supportTicketCreateSchema.safeParse({
      ...VALID_INPUT,
      tenantId: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("tenantId");
    }
  });

  it("schemas.ts no contiene 'required_error' (compatibilidad Zod v4)", () => {
    const schemasPath = path.resolve(__dirname, "../src/features/superadmin/support/schemas.ts");
    const content = fs.readFileSync(schemasPath, "utf8");
    expect(content).not.toContain("required_error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 3 — services.ts: lógica de servicios
// ─────────────────────────────────────────────────────────────────────────────

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockServerTimestamp = vi.fn(() => "SERVER_TS");
const mockCollection = vi.fn(() => "col-ref");
const mockDoc = vi.fn(() => "doc-ref");
const mockQuery = vi.fn((_col, ...constraints) => ({ col: _col, constraints }));
const mockWhere = vi.fn((...args) => ({ type: "where", args }));
const mockOrderBy = vi.fn((...args) => ({ type: "orderBy", args }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
}));

vi.mock("@/lib/firebase/client", () => ({ db: { _isMock: true } }));

const {
  createSupportTicket,
  updateSupportTicket,
  watchSupportTickets,
} = await import("../src/features/superadmin/support/services");

describe("BLOQUE 3 — services.ts", () => {
  beforeEach(() => {
    mockAddDoc.mockResolvedValue({ id: "new-ticket-id" });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockReturnValue(vi.fn()); // returns unsubscribe fn
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createSupportTicket()", () => {
    const baseData = {
      tenantId: "t1",
      tenantName: "El Nogal",
      reportedBy: "admin@elnogal.co",
      category: "technical" as const,
      subject: "Falla login",
      description: "No puede entrar desde ayer.",
      priority: "high" as const,
      createdBy: "uid-super-1",
    };

    it("llama addDoc con status:'open'", async () => {
      await createSupportTicket(baseData, "uid-super-1");
      expect(mockAddDoc).toHaveBeenCalledOnce();
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.status).toBe("open");
    });

    it("incluye createdAt y updatedAt como serverTimestamp()", async () => {
      await createSupportTicket(baseData, "uid-super-1");
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.createdAt).toBe("SERVER_TS");
      expect(payload.updatedAt).toBe("SERVER_TS");
    });

    it("retorna el ID del documento creado", async () => {
      const id = await createSupportTicket(baseData, "uid-super-1");
      expect(id).toBe("new-ticket-id");
    });

    it("NO incluye resolvedAt en la creación", async () => {
      await createSupportTicket(baseData, "uid-super-1");
      const payload = mockAddDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("resolvedAt");
    });
  });

  describe("updateSupportTicket() — status:'in_progress'", () => {
    it("llama updateDoc con updatedAt serverTimestamp()", async () => {
      await updateSupportTicket("ticket-1", { status: "in_progress" });
      expect(mockUpdateDoc).toHaveBeenCalledOnce();
      const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.updatedAt).toBe("SERVER_TS");
    });

    it("NO incluye resolvedAt cuando status es 'in_progress'", async () => {
      await updateSupportTicket("ticket-1", { status: "in_progress" });
      const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("resolvedAt");
    });
  });

  describe("updateSupportTicket() — status:'resolved'", () => {
    it("incluye resolvedAt: serverTimestamp() al resolver", async () => {
      await updateSupportTicket("ticket-1", { status: "resolved" });
      const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.resolvedAt).toBe("SERVER_TS");
    });

    it("también incluye updatedAt al resolver", async () => {
      await updateSupportTicket("ticket-1", { status: "resolved" });
      const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.updatedAt).toBe("SERVER_TS");
    });
  });

  describe("watchSupportTickets() — filtros en query", () => {
    function getCapturedConstraints(): Array<{ type: string; args: unknown[] }> {
      // mockQuery receives (collection, ...constraints)
      const call = mockQuery.mock.calls[0] as unknown[];
      return call.slice(1) as Array<{ type: string; args: unknown[] }>;
    }

    it("{ status:'open' } → aplica where status=='open' y orderBy createdAt desc", () => {
      watchSupportTickets({ status: "open" }, vi.fn(), vi.fn());

      expect(mockWhere).toHaveBeenCalledWith("status", "==", "open");
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");

      const constraints = getCapturedConstraints();
      expect(constraints).toHaveLength(2); // 1 where + 1 orderBy
    });

    it("{ tenantId:'t1', priority:'high' } → aplica where tenantId y where priority", () => {
      watchSupportTickets({ tenantId: "t1", priority: "high" }, vi.fn(), vi.fn());

      const whereCalls = mockWhere.mock.calls;
      expect(whereCalls).toContainEqual(["tenantId", "==", "t1"]);
      expect(whereCalls).toContainEqual(["priority", "==", "high"]);
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("{} sin filtros → solo orderBy, sin where", () => {
      watchSupportTickets({}, vi.fn(), vi.fn());

      expect(mockWhere).not.toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    });

    it("retorna función de cleanup (unsubscribe)", () => {
      const mockUnsub = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(mockUnsub);

      const unsub = watchSupportTickets({}, vi.fn(), vi.fn());
      expect(typeof unsub).toBe("function");
    });

    it("llama onData con tickets cuando snapshot llega", () => {
      const mockTicketDoc = {
        id: "st-001",
        data: () => ({
          tenantId: "t1",
          tenantName: "El Nogal",
          status: "open",
          priority: "high",
          category: "technical",
        }),
      };
      mockOnSnapshot.mockImplementationOnce((_q, onNext: (snap: unknown) => void) => {
        onNext({ docs: [mockTicketDoc] });
        return vi.fn();
      });

      const onData = vi.fn();
      watchSupportTickets({}, onData, vi.fn());

      expect(onData).toHaveBeenCalledOnce();
      const tickets = onData.mock.calls[0][0] as Array<{ id: string }>;
      expect(tickets[0].id).toBe("st-001");
    });

    it("llama onError cuando snapshot falla", () => {
      mockOnSnapshot.mockImplementationOnce(
        (_q: unknown, _onNext: unknown, onError: (e: Error) => void) => {
          onError(new Error("permission-denied"));
          return vi.fn();
        },
      );

      const onError = vi.fn();
      watchSupportTickets({}, vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith("permission-denied");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 4 — use-support.ts: comportamiento de suscripción reactiva
//
// Sin React Testing Library — testeamos watchSupportTickets (el servicio que
// el hook envuelve). El hook es glue puro: llama watchSupportTickets en
// useEffect con cleanup, expone { tickets, loading, error } vía useState.
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 4 — watchSupportTickets (backing de useSupportTickets)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inicia suscripción onSnapshot al llamarse", () => {
    mockOnSnapshot.mockReturnValue(vi.fn());
    watchSupportTickets({ status: "open" }, vi.fn(), vi.fn());
    expect(mockOnSnapshot).toHaveBeenCalledOnce();
  });

  it("{ tickets: [] } estado antes del primer snapshot → onData no llamado aún", () => {
    // onSnapshot que no dispara el callback inmediatamente
    mockOnSnapshot.mockReturnValue(vi.fn());
    const onData = vi.fn();
    watchSupportTickets({ status: "open" }, onData, vi.fn());
    expect(onData).not.toHaveBeenCalled();
  });

  it("cleanup (unsubscribe) se llama al invocar fn retornada", () => {
    const mockUnsub = vi.fn();
    mockOnSnapshot.mockReturnValue(mockUnsub);

    const unsub = watchSupportTickets({ status: "open" }, vi.fn(), vi.fn());
    unsub(); // simula desmontaje del hook
    expect(mockUnsub).toHaveBeenCalledOnce();
  });

  it("cambio de filtros → nueva llamada a onSnapshot (nueva suscripción)", () => {
    const mockUnsub1 = vi.fn();
    const mockUnsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(mockUnsub1).mockReturnValueOnce(mockUnsub2);

    // Primera suscripción (status: open)
    const unsub1 = watchSupportTickets({ status: "open" }, vi.fn(), vi.fn());
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    // Simular cambio de filtros: cancelar primera → crear nueva
    unsub1();
    expect(mockUnsub1).toHaveBeenCalledOnce();

    const unsub2 = watchSupportTickets({ status: "resolved" }, vi.fn(), vi.fn());
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    unsub2();
    expect(mockUnsub2).toHaveBeenCalledOnce();
  });

  it("usa where('status') al filtrar por status", () => {
    mockOnSnapshot.mockReturnValue(vi.fn());
    watchSupportTickets({ status: "open" }, vi.fn(), vi.fn());
    expect(mockWhere).toHaveBeenCalledWith("status", "==", "open");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE 5 — firestore.rules: bloque supportTickets (análisis estático)
// ─────────────────────────────────────────────────────────────────────────────

describe("BLOQUE 5 — firestore.rules: bloque supportTickets", () => {
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  let rulesContent: string;

  beforeEach(() => {
    rulesContent = fs.readFileSync(rulesPath, "utf8");
  });

  it("existe el bloque match /supportTickets/{docId}", () => {
    expect(rulesContent).toContain("match /supportTickets/{docId}");
  });

  // Estas tres afirmaciones fijaban el diseño ANTERIOR, cuando soporte era una
  // bitácora que solo el superadmin escribía. PRD-V-FEAT-001 lo endureció: el
  // administrador del conjunto LEE los suyos, y no escribe NADIE desde el
  // cliente —ni el superadmin—, porque toda escritura manda correo y sella
  // campos que no deben poder falsificarse.

  it("allow read deja leer al superadmin y al admin de su propio conjunto", () => {
    const block = extractBlock(rulesContent, "supportTickets");
    expect(block).toMatch(/allow\s+read\s*:/);
    expect(block).toContain("superadmin()");
    expect(block).toContain("tenantRole(resource.data.tenantId, 'tenant_admin')");
  });

  it("no permite escritura desde el cliente en ningún rol", () => {
    const block = extractBlock(rulesContent, "supportTickets");
    expect(block).toMatch(/allow\s+create,\s*update\s*:\s*if\s+false/);
  });

  it("las notas internas viven en subcolección y solo las lee el superadmin", () => {
    // Es la única información asimétrica del modelo. En el mismo documento, el
    // administrador con permiso de lectura la recibiría entera: las reglas de
    // Firestore NO filtran campos.
    const block = extractBlock(rulesContent, "supportTickets");
    expect(block).toContain("match /internal/{noteId}");
    expect(block).toMatch(/allow\s+write\s*:\s*if\s+false/);
  });

  it("allow delete es false (explícito)", () => {
    const block = extractBlock(rulesContent, "supportTickets");
    expect(block).toMatch(/allow\s+delete\s*:\s*if\s+false/);
  });

  it("el bloque supportTickets aparece después del bloque tickets", () => {
    const ticketsIdx = rulesContent.indexOf("match /tickets/{docId}");
    const supportIdx = rulesContent.indexOf("match /supportTickets/{docId}");
    expect(ticketsIdx).toBeGreaterThan(-1);
    expect(supportIdx).toBeGreaterThan(ticketsIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrae el contenido entre `match /<collection>/{docId} {` y su `}`
 * correspondiente. Suficiente para los tests estáticos de rules.
 *
 * Nota: empieza a contar llaves desde la `{` que cierra la línea del match,
 * ignorando `{docId}` dentro del path del match.
 */
function extractBlock(content: string, collection: string): string {
  const matchLine = `match /${collection}/{docId}`;
  const matchStart = content.indexOf(matchLine);
  if (matchStart === -1) return "";

  // Buscar la '{' de apertura del bloque (después del path del match)
  // Es el '{' que aparece al final de la línea del match statement.
  const pathEnd = matchStart + matchLine.length;
  const blockOpen = content.indexOf("{", pathEnd);
  if (blockOpen === -1) return "";

  let depth = 1;
  let i = blockOpen + 1;
  while (i < content.length) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return content.slice(matchStart, i + 1);
    }
    i++;
  }
  return content.slice(matchStart);
}
