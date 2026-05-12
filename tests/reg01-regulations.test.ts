/**
 * REG-01 — Firma Digital de Reglamento
 * Static source-verification tests. No DOM, no RTL, no code execution.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function src(rel: string) {
  return readFileSync(resolve(root, rel), "utf-8");
}

// ─── Load files ───────────────────────────────────────────────────────────────

const types        = src("src/features/regulations/types.ts");
const services     = src("src/features/regulations/services.ts");
const useReg       = src("src/features/regulations/use-regulation.ts");
const adminPage    = src("src/app/(admin)/admin/regulations/page.tsx");
const residentPage = src("src/app/(resident)/resident/regulations/page.tsx");
const sidebar      = src("src/components/shared/admin-sidebar.tsx");
const navigation   = src("src/lib/constants/navigation.ts");
const roleGroups   = src("src/lib/navigation/role-sidebar-groups.ts");
const firestoreRules  = src("firestore.rules");
const firestoreIndexes = src("firestore.indexes.json");

// ─── types.ts ────────────────────────────────────────────────────────────────

describe("types.ts", () => {
  it("1. Exporta RegulationSignature con campo id", () => {
    expect(types).toMatch(/export\s+interface\s+RegulationSignature/);
    expect(types).toMatch(/\bid\s*:/);
  });

  it("2. RegulationSignature tiene campo regulationId", () => {
    expect(types).toMatch(/regulationId\s*:/);
  });

  it("3. RegulationSignature tiene campo unitId", () => {
    expect(types).toMatch(/unitId\s*:/);
  });

  it("4. RegulationSignature tiene campo signedBy", () => {
    expect(types).toMatch(/signedBy\s*:/);
  });

  it("5. RegulationSignature tiene campo signedAt", () => {
    expect(types).toMatch(/signedAt\s*:/);
  });

  it("6. RegulationSignature tiene campo regulationVersion", () => {
    expect(types).toMatch(/regulationVersion\s*:/);
  });
});

// ─── services.ts ─────────────────────────────────────────────────────────────

describe("services.ts", () => {
  it("7. Importa runTransaction de firebase/firestore", () => {
    expect(services).toMatch(/runTransaction/);
    expect(services).toMatch(/from\s+['"]firebase\/firestore['"]/);
  });

  it("8. Tiene función signRegulation exportada", () => {
    expect(services).toMatch(/export\s+async\s+function\s+signRegulation/);
  });

  it("9. signRegulation usa runTransaction (patrón write-once)", () => {
    expect(services).toMatch(/runTransaction/);
    // Ensure runTransaction is called inside signRegulation body
    const signBlock = services.slice(services.indexOf("signRegulation"));
    expect(signBlock).toMatch(/runTransaction/);
  });

  it("10. signRegulation verifica existence antes de escribir (.exists())", () => {
    const signBlock = services.slice(services.indexOf("signRegulation"));
    expect(signBlock).toMatch(/\.exists\(\)/);
  });

  it("11. Tiene función getActiveRegulation exportada", () => {
    expect(services).toMatch(/export\s+async\s+function\s+getActiveRegulation/);
  });

  it("12. setActiveRegulation usa updateDoc (NO setDoc)", () => {
    expect(services).toMatch(/export\s+async\s+function\s+setActiveRegulation/);
    const setBlock = services.slice(services.indexOf("setActiveRegulation"));
    // Must use updateDoc
    expect(setBlock).toMatch(/updateDoc/);
    // Must NOT call setDoc inside setActiveRegulation (search until next export)
    const nextExport = setBlock.indexOf("\nexport ", 1);
    const body = nextExport > 0 ? setBlock.slice(0, nextExport) : setBlock.slice(0, 300);
    expect(body).not.toMatch(/setDoc/);
  });

  it("13. Tiene función getRegulationSignatures exportada", () => {
    expect(services).toMatch(/export\s+async\s+function\s+getRegulationSignatures/);
  });

  it("14. Tiene función hasSignedRegulation exportada", () => {
    expect(services).toMatch(/export\s+async\s+function\s+hasSignedRegulation/);
  });

  it("15. ID determinístico: template literal con regulationId + _ + unitId", () => {
    // Pattern: `${regulation.id}_${unitId}` or `${regulationId}_${unitId}`
    expect(services).toMatch(/`\$\{[^}]*[Ii][Dd][^}]*\}_\$\{[^}]*unitId[^}]*\}`/);
  });
});

// ─── use-regulation.ts ───────────────────────────────────────────────────────

describe("use-regulation.ts", () => {
  it("16. Exporta useActiveRegulation", () => {
    expect(useReg).toMatch(/export\s+function\s+useActiveRegulation/);
  });

  it("17. Exporta useRegulationSignatures", () => {
    expect(useReg).toMatch(/export\s+function\s+useRegulationSignatures/);
  });

  it("18. Usa onSnapshot para tiempo real", () => {
    expect(useReg).toMatch(/onSnapshot/);
  });
});

// ─── Admin page ───────────────────────────────────────────────────────────────

describe("Admin page (admin/regulations/page.tsx)", () => {
  it("19. Exporta un componente por default", () => {
    expect(adminPage).toMatch(/export\s+default\s+function/);
  });

  it("20. Llama setActiveRegulation", () => {
    expect(adminPage).toMatch(/setActiveRegulation/);
  });

  it("21. Renderiza una tabla para el estado de firmas", () => {
    expect(adminPage).toMatch(/<table/i);
  });

  it("22. Tiene estado de carga / loading durante el upload", () => {
    // uploading state or disabled during upload
    expect(adminPage).toMatch(/uploading/);
  });

  it("23. Acepta solo PDF", () => {
    expect(adminPage).toMatch(/accept\s*=\s*["']application\/pdf["']/);
  });
});

// ─── Resident page ────────────────────────────────────────────────────────────

describe("Resident page (resident/regulations/page.tsx)", () => {
  it("24. Exporta un componente por default", () => {
    expect(residentPage).toMatch(/export\s+default\s+function/);
  });

  it("25. Usa getMySignature o hasSignedRegulation para estado previo", () => {
    expect(residentPage).toMatch(/getMySignature|hasSignedRegulation/);
  });

  it("26. Llama signRegulation en el submit", () => {
    expect(residentPage).toMatch(/signRegulation/);
  });

  it("27. Tiene <iframe para previsualizar el PDF", () => {
    expect(residentPage).toMatch(/<iframe/);
  });

  it("28. Tiene checkbox de aceptación antes del botón de firma", () => {
    expect(residentPage).toMatch(/type\s*=\s*["']checkbox["']/);
  });

  it('29. Maneja el error "ALREADY_SIGNED"', () => {
    expect(residentPage).toMatch(/ALREADY_SIGNED/);
  });
});

// ─── Navegación ───────────────────────────────────────────────────────────────

describe("Navegación", () => {
  it("30. admin-sidebar.tsx contiene /admin/regulations", () => {
    expect(sidebar).toMatch(/\/admin\/regulations/);
  });

  it('31. admin-sidebar.tsx contiene "Reglamento"', () => {
    expect(sidebar).toMatch(/Reglamento/);
  });

  it("32. admin-sidebar.tsx importa ScrollText de lucide-react", () => {
    expect(sidebar).toMatch(/ScrollText/);
    expect(sidebar).toMatch(/from\s+['"]lucide-react['"]/);
  });

  it("33. navigation.ts contiene /admin/regulations", () => {
    expect(navigation).toMatch(/\/admin\/regulations/);
  });

  it("34. navigation.ts contiene /resident/regulations", () => {
    expect(navigation).toMatch(/\/resident\/regulations/);
  });

  it("35. role-sidebar-groups.ts importa ScrollText", () => {
    expect(roleGroups).toMatch(/ScrollText/);
  });
});

// ─── Firestore rules ──────────────────────────────────────────────────────────

describe("Firestore rules", () => {
  it("36. firestore.rules contiene regulation_signatures", () => {
    expect(firestoreRules).toMatch(/regulation_signatures/);
  });

  it("37. Bloque regulation_signatures tiene allow create para residentes", () => {
    // Extract the block
    const blockStart = firestoreRules.indexOf("regulation_signatures");
    expect(blockStart).toBeGreaterThan(-1);
    const block = firestoreRules.slice(blockStart, blockStart + 1200);
    expect(block).toMatch(/allow\s+create/);
  });

  it("38. allow update y allow delete son false (o ausentes — deny por defecto)", () => {
    const blockStart = firestoreRules.indexOf("regulation_signatures");
    const block = firestoreRules.slice(blockStart, blockStart + 1200);
    // Either explicitly `if false` or no update/delete allow (absence = deny)
    const hasExplicitFalse = /allow\s+update,?\s*delete\s*:\s*if\s+false/.test(block);
    const hasNoUpdate = !/allow\s+update\s*:/.test(block.replace(/update,\s*delete/, "")) || block.includes("if false");
    expect(hasExplicitFalse || hasNoUpdate).toBe(true);
  });
});

// ─── Firestore indexes ────────────────────────────────────────────────────────

describe("Firestore indexes", () => {
  it("39. firestore.indexes.json contiene regulation_signatures", () => {
    expect(firestoreIndexes).toMatch(/regulation_signatures/);
  });

  it("40. Índice de regulation_signatures incluye regulationId", () => {
    const blockStart = firestoreIndexes.indexOf("regulation_signatures");
    expect(blockStart).toBeGreaterThan(-1);
    // Get a reasonable window after the collection declaration
    const block = firestoreIndexes.slice(blockStart, blockStart + 500);
    expect(block).toMatch(/regulationId/);
  });

  it("41. Índice incluye signedAt", () => {
    const blockStart = firestoreIndexes.indexOf("regulation_signatures");
    const block = firestoreIndexes.slice(blockStart, blockStart + 500);
    expect(block).toMatch(/signedAt/);
  });
});
