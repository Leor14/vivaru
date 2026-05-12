/**
 * ENQ-01 Part 2b — Static source verification
 * Read-only string analysis. No DOM, no RTL, no runtime execution.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const adminPage = read("src/app/(admin)/admin/surveys/page.tsx");
const residentPage = read("src/app/(resident)/resident/surveys/page.tsx");
const adminSidebar = read("src/components/shared/admin-sidebar.tsx");
const navigation = read("src/lib/constants/navigation.ts");
const roleSidebarGroups = read("src/lib/navigation/role-sidebar-groups.ts");

// ─── Admin surveys page ────────────────────────────────────────────────────────

describe("Admin surveys page (admin/surveys/page.tsx)", () => {
  it("1. exports a default function component", () => {
    expect(adminPage).toMatch(/export default function\s+\w+/);
  });

  it("2. imports and uses useAdminSurveys", () => {
    expect(adminPage).toContain("useAdminSurveys");
  });

  it("3. has PageView type with 'list' and 'results' values", () => {
    expect(adminPage).toContain('"list"');
    expect(adminPage).toContain('"results"');
  });

  it("4. calls createSurvey in submit handler", () => {
    expect(adminPage).toContain("createSurvey");
    // createSurvey must appear inside an async function body, not just as an import
    expect(adminPage).toMatch(/await createSurvey\(/);
  });

  it("5. calls getSurveyResults on-demand (inside handler, not bare render)", () => {
    // Direct search for the await call — not just the import
    expect(adminPage).toMatch(/await getSurveyResults\(/);
  });

  it("6. has draftQuestions state for dynamic question management", () => {
    expect(adminPage).toMatch(/draftQuestions|DraftQuestion/);
  });

  it("7. has manual validation before createSurvey (empty field check)", () => {
    // validate() fn must exist and createSurvey comes after it
    expect(adminPage).toMatch(/function validate/);
    const validateIdx = adminPage.indexOf("function validate");
    const createIdx = adminPage.indexOf("await createSurvey(");
    expect(validateIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(validateIdx);
  });
});

// ─── Resident surveys page ─────────────────────────────────────────────────────

describe("Resident surveys page (resident/surveys/page.tsx)", () => {
  it("8. exports a default function component", () => {
    expect(residentPage).toMatch(/export default function\s+\w+/);
  });

  it("9. imports and uses useResidentSurveys", () => {
    expect(residentPage).toContain("useResidentSurveys");
  });

  it("10. has AnswerMap or Record<string equivalent for answer accumulation", () => {
    expect(residentPage).toMatch(/AnswerMap|Record<string/);
  });

  it("11. calls submitResponse from features/surveys/services", () => {
    expect(residentPage).toContain("submitResponse");
    expect(residentPage).toMatch(/from ["']@\/features\/surveys\/services["']/);
  });

  it("12. shows responded badge or text for answered surveys", () => {
    expect(residentPage).toMatch(/[Rr]espondid[ao]|responded/);
  });

  it("13. renders RadioGroup or radio input for single choice questions", () => {
    expect(residentPage).toMatch(/RadioGroup|radio/i);
  });

  it("14. renders Checkbox or checkbox input for multiple choice questions", () => {
    expect(residentPage).toMatch(/Checkbox|checkbox/i);
  });
});

// ─── Admin sidebar ─────────────────────────────────────────────────────────────

describe("Admin sidebar (admin-sidebar.tsx)", () => {
  it("15. imports ClipboardList from lucide-react", () => {
    // ClipboardList must appear inside an import block that ends with lucide-react
    expect(adminSidebar).toMatch(/ClipboardList[\s\S]{0,400}from ["']lucide-react["']/);
  });

  it("16. contains route /admin/surveys", () => {
    expect(adminSidebar).toContain("/admin/surveys");
  });

  it("17. contains label 'Encuestas'", () => {
    expect(adminSidebar).toContain("Encuestas");
  });

  it("18. nav element has overflow-y-auto class", () => {
    expect(adminSidebar).toMatch(/<nav[^>]*overflow-y-auto/);
  });

  it("19. has 'Cerrar sesión' button text", () => {
    expect(adminSidebar).toMatch(/[Cc]errar sesi[oó]n/);
  });

  it("20. imports LogOut from lucide-react", () => {
    expect(adminSidebar).toContain("LogOut");
  });
});

// ─── navigation.ts ─────────────────────────────────────────────────────────────

describe("navigation.ts", () => {
  it("21. contains /admin/surveys for admin roles", () => {
    // Must appear in admin_tenant or tenant_admin section
    const adminTenantIdx = navigation.indexOf("admin_tenant");
    const tenantAdminIdx = navigation.indexOf("tenant_admin");
    const residentIdx = navigation.indexOf("resident:");
    // Slice the admin section (between first admin role and resident)
    const adminSection = navigation.slice(
      Math.min(adminTenantIdx, tenantAdminIdx),
      residentIdx > 0 ? residentIdx : navigation.length,
    );
    expect(adminSection).toContain("/admin/surveys");
  });

  it("22. contains /resident/surveys for resident role", () => {
    const residentIdx = navigation.indexOf("resident:");
    const securityIdx = navigation.indexOf("security_guard:");
    const residentSection = navigation.slice(
      residentIdx > 0 ? residentIdx : 0,
      securityIdx > 0 ? securityIdx : navigation.length,
    );
    expect(residentSection).toContain("/resident/surveys");
  });
});

// ─── role-sidebar-groups.ts ────────────────────────────────────────────────────

describe("role-sidebar-groups.ts", () => {
  it("23. imports ClipboardList", () => {
    expect(roleSidebarGroups).toContain("ClipboardList");
  });

  it("24. maps ClipboardList to a surveys/encuestas route", () => {
    // ClipboardList must be the icon value for /admin/surveys or /resident/surveys
    expect(roleSidebarGroups).toMatch(/["']\/(?:admin|resident)\/surveys["']:\s*ClipboardList/);
  });
});
