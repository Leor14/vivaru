/**
 * Surveys Bloque A + B — static contract verification. No DOM, no RTL.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf-8");

const types   = read("src/features/surveys/types.ts");
const schemas = read("src/features/surveys/schemas.ts");
const svc     = read("src/features/surveys/services.ts");
const page    = read("src/app/(admin)/admin/surveys/page.tsx");

// ─── Survey type ──────────────────────────────────────────────────────────────

describe("Survey type (types.ts)", () => {
  it("1. Survey has closingDate field", () => {
    expect(types).toMatch(/closingDate/);
  });
  it("2. closingDate is optional", () => {
    expect(types).toMatch(/closingDate\?/);
  });
});

// ─── Schema ───────────────────────────────────────────────────────────────────

describe("Schema (schemas.ts)", () => {
  it("3. schema includes closingDate", () => {
    expect(schemas).toMatch(/closingDate/);
  });
  it("4. closingDate uses z.coerce.date or z.date", () => {
    expect(schemas).toMatch(/z\.coerce\.date|z\.date/);
  });
  it("5. closingDate is optional in schema", () => {
    expect(schemas).toMatch(/closingDate.*optional|optional.*closingDate/s);
  });
});

// ─── Services ─────────────────────────────────────────────────────────────────

describe("Services (services.ts)", () => {
  it("6. exports deleteSurvey", () => {
    expect(svc).toMatch(/export async function deleteSurvey/);
  });
  it("7. deleteSurvey uses deleteDoc", () => {
    const fn = svc.match(/function deleteSurvey[\s\S]+?^}/m)?.[0] ?? svc;
    expect(fn).toMatch(/deleteDoc/);
  });
  it("8. exports updateSurvey", () => {
    expect(svc).toMatch(/export async function updateSurvey/);
  });
  it("9. updateSurvey uses updateDoc", () => {
    const fn = svc.match(/function updateSurvey[\s\S]+?^}/m)?.[0] ?? svc;
    expect(fn).toMatch(/updateDoc/);
  });
  it("10. updateSurvey includes serverTimestamp", () => {
    const fn = svc.match(/function updateSurvey[\s\S]+?^}/m)?.[0] ?? svc;
    expect(fn).toMatch(/serverTimestamp/);
  });
  it("11. normalizeSurvey maps closingDate", () => {
    const fn = svc.match(/function normalizeSurvey[\s\S]+?^}/m)?.[0] ?? svc;
    expect(fn).toMatch(/closingDate/);
  });
});

// ─── Page: closingDate form ───────────────────────────────────────────────────

describe("Page — closingDate in form", () => {
  it("12. useState for closingDate exists", () => {
    expect(page).toMatch(/closingDate.*useState|useState.*closingDate/s);
  });
  it("13. input type=\"date\" for closingDate", () => {
    expect(page).toMatch(/type="date"/);
  });
  it("14. closingDate passed to createSurvey / handleSubmit", () => {
    expect(page).toMatch(/closingDate.*new Date|closingDate.*handleSubmit/s);
  });
  it("15. openCreateDrawer resets closingDate to \"\"", () => {
    const fn = page.match(/function openCreateDrawer[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/setClosingDate\s*\(\s*""\s*\)/);
  });
});

// ─── Page: Cierre column ──────────────────────────────────────────────────────

describe("Page — Cierre column", () => {
  it("16. column with header 'Cierre' or key 'closingDate'", () => {
    expect(page).toMatch(/"Cierre"|key.*closingDate|closingDate.*header/s);
  });
  it("17. column shows 'Sin fecha' when closingDate absent", () => {
    expect(page).toMatch(/Sin fecha/);
  });
});

// ─── Page: filters ────────────────────────────────────────────────────────────

describe("Page — filters", () => {
  it("18. filterStatus state exists", () => {
    expect(page).toMatch(/filterStatus/);
  });
  it("19. filterText state exists", () => {
    expect(page).toMatch(/filterText/);
  });
  it("20. filteredSurveys computed", () => {
    expect(page).toMatch(/filteredSurveys/);
  });
  it("21. filteredSurveys filters by status", () => {
    expect(page).toMatch(/filterStatus.*status|status.*filterStatus/s);
  });
  it("22. filteredSurveys filters by title (toLowerCase/includes)", () => {
    expect(page).toMatch(/toLowerCase|includes.*filterText|filterText.*includes/s);
  });
  it("23. DataTable receives filteredSurveys", () => {
    expect(page).toMatch(/rows=\{filteredSurveys\}/);
  });
  it("24. chips for Todas / Borrador / Publicadas / Cerradas", () => {
    expect(page).toMatch(/Todas/);
    expect(page).toMatch(/Borrador/);
    expect(page).toMatch(/Publicadas/);
    expect(page).toMatch(/Cerradas/);
  });
});

// ─── Page: edit drafts ────────────────────────────────────────────────────────

describe("Page — edit drafts", () => {
  it("25. editingSurvey state exists", () => {
    expect(page).toMatch(/editingSurvey/);
  });
  it("26. openEditDrawer function exists", () => {
    expect(page).toMatch(/function openEditDrawer|openEditDrawer\s*=/);
  });
  it("27. openEditDrawer calls setTitle", () => {
    const fn = page.match(/function openEditDrawer[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/setTitle/);
  });
  it("28. openEditDrawer calls setDraftQuestions", () => {
    const fn = page.match(/function openEditDrawer[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/setDraftQuestions/);
  });
  it("29. openEditDrawer calls setClosingDate", () => {
    const fn = page.match(/function openEditDrawer[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/setClosingDate/);
  });
  it("30. openEditDrawer opens drawer (setDrawerOpen or setEditingSurvey)", () => {
    const fn = page.match(/function openEditDrawer[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/setDrawerOpen|setEditingSurvey/);
  });
  it("31. Drawer title is conditional (Editar vs Nueva)", () => {
    expect(page).toMatch(/Editar encuesta.*Nueva encuesta|editingSurvey.*Editar/s);
  });
  it("32. submit button shows 'Guardar cambios' in edit mode", () => {
    expect(page).toMatch(/Guardar cambios/);
  });
  it("33. handleSubmit bifurcates on editingSurvey", () => {
    const fn = page.match(/async function handleSubmit[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/editingSurvey/);
  });
  it("34. edit mode calls updateSurvey", () => {
    expect(page).toMatch(/updateSurvey/);
  });
  it("35. create mode calls createSurvey", () => {
    expect(page).toMatch(/createSurvey/);
  });
});

// ─── Page: delete drafts ──────────────────────────────────────────────────────

describe("Page — delete drafts", () => {
  it("36. pendingDeletion (or deletingId) state exists", () => {
    expect(page).toMatch(/pendingDeletion|deletingId/);
  });
  it("37. handleDelete function exists", () => {
    expect(page).toMatch(/function handleDelete|handleDelete\s*=/);
  });
  it("38. handleDelete calls deleteSurvey", () => {
    const fn = page.match(/async function handleDelete[\s\S]+?\n  \}/)?.[0] ?? page;
    expect(fn).toMatch(/deleteSurvey/);
  });
  it("39. ConfirmDeleteDialog (or equivalent) used for confirmation", () => {
    expect(page).toMatch(/ConfirmDeleteDialog|ConfirmDialog|AlertDialog/);
  });
  it("40. draft RowActions includes Eliminar", () => {
    expect(page).toMatch(/Eliminar/);
  });
  it("41. draft RowActions includes Editar", () => {
    expect(page).toMatch(/Editar/);
  });
  it("42. Eliminar action has danger prop or red class", () => {
    expect(page).toMatch(/danger.*true|danger:\s*true|text-red|text-\[var\(--danger/);
  });
});
