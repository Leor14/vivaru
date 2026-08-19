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
  normalizeSupportCategory,
  normalizeSupportPriority,
  normalizeSupportStatus,
  type SupportTicket,
} from "../src/features/superadmin/support/types";

describe("BLOQUE 1 — types.ts: constantes", () => {
  // El catálogo pasó del inglés de la etapa bitácora al contrato compartido
  // con el portal del administrador (PRD-V-FEAT-001). Soporte es UNA cola
  // vista desde dos lados: dos catálogos serían dos colas.

  describe("SUPPORT_CATEGORIES", () => {
    it("tiene exactamente 4 keys", () => {
      expect(Object.keys(SUPPORT_CATEGORIES)).toHaveLength(4);
    });

    it.each([
      ["tecnico", "Técnico"],
      ["facturacion", "Facturación"],
      ["operativo", "Operativo"],
      ["otro", "Otro"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_CATEGORIES[key]).toBe(label);
    });
  });

  describe("SUPPORT_STATUSES", () => {
    it("tiene los cinco estados del ciclo de vida", () => {
      expect(Object.keys(SUPPORT_STATUSES)).toHaveLength(5);
    });

    it.each([
      ["abierto", "Abierto"],
      ["en_proceso", "En proceso"],
      ["esperando_respuesta", "Esperando tu respuesta"],
      ["resuelto", "Resuelto"],
      ["cerrado", "Cerrado"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_STATUSES[key]).toBe(label);
    });
  });

  describe("SUPPORT_PRIORITIES", () => {
    it("tiene exactamente 3 keys", () => {
      expect(Object.keys(SUPPORT_PRIORITIES)).toHaveLength(3);
    });

    it.each([
      ["alta", "Alta"],
      ["media", "Media"],
      ["baja", "Baja"],
    ] as const)('key "%s" → "%s"', (key, label) => {
      expect(SUPPORT_PRIORITIES[key]).toBe(label);
    });
  });

  describe("compatibilidad con la etapa bitácora", () => {
    // Hoy no hay ningún ticket con estos valores ni en staging ni en
    // producción —comprobado—, pero tolerarlos cuesta cero y romperse
    // delante de un cliente no.
    it("traduce los estados en inglés", () => {
      expect(normalizeSupportStatus("open")).toBe("abierto");
      expect(normalizeSupportStatus("in_progress")).toBe("en_proceso");
      expect(normalizeSupportStatus("resolved")).toBe("resuelto");
    });

    it("traduce categorías y prioridades en inglés", () => {
      expect(normalizeSupportCategory("technical")).toBe("tecnico");
      expect(normalizeSupportPriority("high")).toBe("alta");
    });

    it("un estado desconocido cae en abierto, no desaparece", () => {
      // Es mejor que un ticket raro salga en la cola a que se pierda.
      expect(normalizeSupportStatus("marciano")).toBe("abierto");
      expect(normalizeSupportStatus(undefined)).toBe("abierto");
    });

    it("respeta los valores ya normalizados", () => {
      expect(normalizeSupportStatus("esperando_respuesta")).toBe("esperando_respuesta");
      expect(normalizeSupportCategory("otro")).toBe("otro");
    });
  });

  describe("SupportTicket interface — compatibilidad de tipos", () => {
    /**
     * Estas tres pruebas valen por COMPILAR, no por lo que afirman en runtime.
     *
     * Estuvieron rotas desde que el módulo pasó del vocabulario en inglés al
     * español y de `Timestamp` a ISO: sus fixtures describían un producto que ya
     * no existía. Como los errores de tipo de `tests/` se toleraban como
     * «preexistentes», el fallo no se veía — así que la prueba llevaba meses
     * verificando nada mientras parecía estar ahí. Se reescriben contra el
     * contrato vigente e incluyen los campos de `SUP-001`, para que la próxima
     * vez que alguien cambie el tipo, esto lo diga.
     */
    it("un ticket completo satisface el tipo, con los campos de SUP-001", () => {
      const ticket: SupportTicket = {
        id: "st-001",
        tenantId: "tenant-nogal-bogota",
        tenantName: "Conjunto Residencial El Nogal",
        createdBy: "uid-admin-1",
        createdByName: "Claudia Moreno",
        createdByEmail: "admin@elnogal.co",
        category: "tecnico",
        subject: "Falla en login",
        description: "El admin no puede iniciar sesión desde ayer.",
        priority: "alta",
        status: "en_proceso",
        thread: [
          {
            id: "msg-1",
            role: "cliente",
            authorUid: "uid-admin-1",
            authorName: "Claudia Moreno",
            message: "No podemos entrar.",
            createdAt: "2026-05-09T10:00:00.000Z",
          },
          {
            id: "msg-2",
            role: "vivaru",
            authorUid: "uid-soporte",
            authorName: "Equipo Vivaru",
            message: "Lo estamos mirando.",
            createdAt: "2026-05-09T11:30:00.000Z",
          },
        ],
        createdAt: "2026-05-09T09:00:00.000Z",
        updatedAt: "2026-05-09T11:30:00.000Z",
        lastActivityAt: "2026-05-09T11:30:00.000Z",
        // SUP-001 — sellados al responder por primera vez.
        assignedTo: "uid-soporte",
        assignedToName: "Equipo Vivaru",
        assignedAt: "2026-05-09T11:30:00.000Z",
        firstResponseAt: "2026-05-09T11:30:00.000Z",
      };

      expect(ticket.id).toBe("st-001");
      expect(ticket.status).toBe("en_proceso");
      expect(ticket.thread).toHaveLength(2);
      expect(ticket.firstResponseAt).toBe("2026-05-09T11:30:00.000Z");
    });

    it("los campos de SUP-001 son opcionales: un ticket sin responder es válido", () => {
      const ticket: SupportTicket = {
        id: "st-002",
        tenantId: "tenant-palmas-cdmx",
        tenantName: "Privada Las Palmas",
        createdBy: "uid-admin-2",
        createdByName: "Administración",
        createdByEmail: "admin@privadapalmas.mx",
        category: "facturacion",
        subject: "Cobro duplicado",
        description: "Aparecen dos cobros del mes de abril.",
        priority: "media",
        status: "abierto",
        thread: [],
        createdAt: "2026-04-02T08:00:00.000Z",
      };

      // Es justo el caso que la consola pinta como «sin responder».
      expect(ticket.firstResponseAt).toBeUndefined();
      expect(ticket.assignedTo).toBeUndefined();
      expect(ticket.resolvedAt).toBeUndefined();
    });

    it("los campos de la etapa bitácora siguen aceptándose, para no romper tickets viejos", () => {
      const ticket: SupportTicket = {
        id: "st-003",
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        createdBy: "uid-superadmin-1",
        createdByName: "Superadmin",
        createdByEmail: "super@qintilab.com",
        category: "operativo",
        subject: "Consulta operativa",
        description: "Pregunta sobre proceso de onboarding.",
        priority: "baja",
        status: "cerrado",
        thread: [],
        // Campos de cuando esto era una bitácora interna. No se escriben en
        // tickets nuevos, pero el tipo debe seguir admitiéndolos.
        reportedByName: "Claudia Moreno",
        notes: "Se resolvió por teléfono.",
        closedAt: "2026-04-10T15:00:00.000Z",
      };

      expect(ticket.reportedByName).toBe("Claudia Moreno");
      expect(ticket.thread).toHaveLength(0);
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
  addDoc: (...args: Parameters<typeof mockAddDoc>) => mockAddDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  onSnapshot: (...args: Parameters<typeof mockOnSnapshot>) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: Parameters<typeof mockCollection>) => mockCollection(...args),
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  query: (...args: Parameters<typeof mockQuery>) => mockQuery(...args),
  where: (...args: Parameters<typeof mockWhere>) => mockWhere(...args),
  orderBy: (...args: Parameters<typeof mockOrderBy>) => mockOrderBy(...args),
}));

vi.mock("@/lib/firebase/client", () => ({ db: { _isMock: true } }));

// Las escrituras dejaron de ser directas: van por callable, porque mandan
// correo y sellan campos que el cliente no debe poder falsificar. Los mocks
// de addDoc/updateDoc siguen arriba porque `watchSupportTickets` aun usa
// query/where/orderBy.
const mockUpdateStatus = vi.fn();
const mockReply = vi.fn();
const mockAddNote = vi.fn();

vi.mock("@/lib/firebase/callables", () => ({
  updateSupportTicketStatusCallable: (...a: unknown[]) => mockUpdateStatus(...a),
  replyToSupportTicketCallable: (...a: unknown[]) => mockReply(...a),
  addSupportNoteCallable: (...a: unknown[]) => mockAddNote(...a),
}));

const {
  addInternalNote,
  replyAsVivaru,
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

  describe("escritura — delega en las callables", () => {
    // Ninguna de estas operaciones puede ser una escritura directa: las reglas
    // prohiben escribir en `supportTickets` desde el cliente, tambien al
    // superadmin. Lo que se comprueba aqui es justamente que no lo intenta.

    it("cambiar estado y prioridad va por callable, no por updateDoc", async () => {
      await updateSupportTicket("ticket-1", { status: "resuelto", priority: "alta" });
      expect(mockUpdateStatus).toHaveBeenCalledWith({
        ticketId: "ticket-1",
        status: "resuelto",
        priority: "alta",
      });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("responder como Vivaru va por callable", async () => {
      await replyAsVivaru("ticket-1", "Ya lo revisamos.");
      expect(mockReply).toHaveBeenCalledWith({ ticketId: "ticket-1", message: "Ya lo revisamos." });
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("la nota interna va por callable — nunca al documento del ticket", async () => {
      // Si se escribiera en el propio documento, el administrador la recibiria
      // entera al leerlo: las reglas de Firestore no filtran campos.
      await addInternalNote("ticket-1", "Revisar el limit(30).");
      expect(mockAddNote).toHaveBeenCalledWith({ ticketId: "ticket-1", note: "Revisar el limit(30)." });
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it("ya no existe alta manual de tickets", async () => {
      // El superadmin tecleando a mano quien reporto convertia la herramienta
      // en una bitacora en vez de un canal (PRD-V-FEAT-001).
      const services = await import("../src/features/superadmin/support/services");
      expect("createSupportTicket" in services).toBe(false);
    });
  });

  describe("watchSupportTickets() — filtros en query", () => {
    function getCapturedConstraints(): Array<{ type: string; args: unknown[] }> {
      // mockQuery receives (collection, ...constraints)
      const call = mockQuery.mock.calls[0] as unknown[];
      return call.slice(1) as Array<{ type: string; args: unknown[] }>;
    }

    it("{ status:'abierto' } → aplica where status y orderBy", () => {
      watchSupportTickets({ status: "abierto" }, vi.fn(), vi.fn());

      expect(mockWhere).toHaveBeenCalledWith("status", "==", "abierto");
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");

      const constraints = getCapturedConstraints();
      expect(constraints).toHaveLength(2); // 1 where + 1 orderBy
    });

    it("{ tenantId:'t1', priority:'alta' } → aplica where tenantId y where priority", () => {
      watchSupportTickets({ tenantId: "t1", priority: "alta" }, vi.fn(), vi.fn());

      const whereCalls = mockWhere.mock.calls;
      expect(whereCalls).toContainEqual(["tenantId", "==", "t1"]);
      expect(whereCalls).toContainEqual(["priority", "==", "alta"]);
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
    watchSupportTickets({ status: "abierto" }, vi.fn(), vi.fn());
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

    const unsub = watchSupportTickets({ status: "abierto" }, vi.fn(), vi.fn());
    unsub(); // simula desmontaje del hook
    expect(mockUnsub).toHaveBeenCalledOnce();
  });

  it("cambio de filtros → nueva llamada a onSnapshot (nueva suscripción)", () => {
    const mockUnsub1 = vi.fn();
    const mockUnsub2 = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(mockUnsub1).mockReturnValueOnce(mockUnsub2);

    // Primera suscripción (status: open)
    const unsub1 = watchSupportTickets({ status: "abierto" }, vi.fn(), vi.fn());
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
    watchSupportTickets({ status: "abierto" }, vi.fn(), vi.fn());
    expect(mockWhere).toHaveBeenCalledWith("status", "==", "abierto");
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
