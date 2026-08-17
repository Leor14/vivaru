import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * «Media» no es una decisión — el arreglo del default de prioridad.
 *
 * La sesión de F3 (16 de agosto de 2026) midió la trampa funcionando: de las 7
 * prioridades guardadas, 3 fueron el default `medium` de tickets que nacen sin
 * prioridad. Guardar cualquier corrección escribía también una prioridad que
 * nadie eligió, y la sombra de la Fase 4 la leería como corrección deliberada
 * del administrador. Estas pruebas sostienen el arreglo por sus dos lados: el
 * servicio no escribe el eje no decidido, y la pantalla no vuelve a arrancar
 * el selector en «medium».
 */

// ── Mocks (patrón de billing-create-update) ──────────────────────────────────
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn(() => "doc-ref-stub");

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(),
  subscribeTenantCollection: vi.fn(),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
const { updateTicketClassification } = await import("../src/features/pqrs/use-tickets");

function guardar(priority: "low" | "medium" | "high" | null) {
  return updateTicketClassification({
    ticketId: "ticket-1",
    tenantId: "tenant-nogal-bogota",
    adminUserId: "admin-1",
    category: "maintenance",
    type: "claim",
    priority,
  });
}

afterEach(() => {
  mockUpdateDoc.mockClear();
  mockDoc.mockClear();
});

describe("updateTicketClassification y el eje no decidido", () => {
  it("con priority null NO escribe el campo — ni siquiera como null", async () => {
    await guardar(null);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    // Omitido, no en null: un `priority: null` en el documento sería un tercer
    // estado que ningún lector espera. Ausente ya es como nacen todos.
    expect(payload).not.toHaveProperty("priority");
  });

  it("sin prioridad la clasificación SÍ se guarda entera: la persona clasificó categoría y tipo", async () => {
    await guardar(null);

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.category).toBe("maintenance");
    expect(payload.type).toBe("claim");
    // La marca de la sombra se escribe igual: hubo decisión humana, solo que
    // sobre dos ejes y no sobre tres.
    expect(payload.classifiedAt).toEqual(expect.any(String));
    expect(payload.classifiedBy).toBe("admin-1");
  });

  it("una prioridad elegida se escribe tal cual", async () => {
    await guardar("high");

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.priority).toBe("high");
  });
});

/**
 * La otra mitad vive en la página y no se puede montar aquí: revisión estática,
 * como las demás del repo. Protege contra la regresión EXACTA que se midió —
 * volver a arrancar el selector en «medium».
 */
describe("page.tsx: el selector de prioridad (revisión estática)", () => {
  const fuente = readFileSync(join(__dirname, "../src/app/(admin)/admin/pqrs/page.tsx"), "utf8");

  it("el selector ya no arranca en «medium» cuando el ticket no trae prioridad", () => {
    expect(fuente).not.toContain('selectedTicket.priority ?? "medium"');
    expect(fuente).toContain('selectedTicket.priority ?? ""');
  });

  it("ofrece «Sin prioridad» solo mientras el ticket no la tenga", () => {
    expect(fuente).toContain('<option value="">Sin prioridad</option>');
    expect(fuente).toMatch(/!selectedTicket\.priority \? <option value="">/);
  });

  it("lo que se guarda y lo que se anota al feedback traducen «» a null", () => {
    expect(fuente).toContain('clasPriority === "" ? null : clasPriority');
  });
});
