/**
 * IMP-04 — Error Handling Tests
 *
 * Bloque 1 — normalizeFirebaseError() y toastFirebaseError()
 * Bloque 2 — callables.ts delegates to shared utility
 * Bloque 3 — catch blocks in 3 representative pages use toastFirebaseError
 * Bloque 4 — error.tsx and global-error.tsx boundary components
 * Bloque 5 — resident/layout.tsx does not render raw error variable
 */

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted — applied before any import resolves
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { CallableError, normalizeFirebaseError, toastFirebaseError } from "@/lib/utils/error-handler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect visible text from a React element tree. */
function collectText(node: unknown): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  const obj = node as Record<string, unknown>;
  if (obj.props !== undefined) {
    const props = obj.props as Record<string, unknown>;
    return collectText(props.children);
  }
  return "";
}

/** Recursively find all React elements of a given tag/type. */
function findElements(
  node: unknown,
  type: string,
): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  function walk(n: unknown) {
    if (!n || typeof n !== "object") return;
    const el = n as { type?: unknown; props?: Record<string, unknown> };
    if (el.type === type && el.props) results.push(el.props);
    if (el.props) {
      const ch = el.props.children;
      if (Array.isArray(ch)) ch.forEach(walk);
      else if (ch) walk(ch);
    }
  }
  walk(node);
  return results;
}

const ROOT = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 1 — normalizeFirebaseError() y toastFirebaseError()
// ═══════════════════════════════════════════════════════════════════════════

describe("CallableError — el mensaje del servidor llega a la pantalla", () => {
  /**
   * **El defecto, medido en staging el 24 de agosto de 2026.** El servidor
   * devolvía «Ese cruce ya se deshizo», `executeCallable` lo componía bien y lo
   * envolvía en un `Error` plano; aquí se tiraba, porque un `Error` plano no
   * tiene `code` y caía en el genérico. En pantalla se leía «Ocurrió un error
   * inesperado». Afectaba a TODAS las llamadas del producto.
   *
   * No lo cazó ninguna suite: las pruebas comprobaban que el servidor lanza el
   * error correcto, y nadie miraba qué se pintaba.
   */
  it("respeta el mensaje ya escrito para leerse", () => {
    expect(normalizeFirebaseError(new CallableError("Ese cruce ya se deshizo."))).toBe("Ese cruce ya se deshizo.");
  });

  it("y llega al toast, que es donde se veía el genérico", () => {
    toastFirebaseError(new CallableError("Primero deshaz el cruce del 24 de agosto."));
    expect(toast.error).toHaveBeenCalledWith("Primero deshaz el cruce del 24 de agosto.");
  });

  /**
   * **Un `Error` a secas NO pasa**, y esa es la mitad que hace segura la
   * excepción: el texto de una excepción interna enseñado al administrador es
   * peor que no enseñar nada. Solo pasan los marcados como escritos para leerse.
   */
  it("un Error normal sigue cayendo en el genérico", () => {
    expect(normalizeFirebaseError(new Error("TypeError: undefined is not a function"))).toBe(
      "Ocurrió un error inesperado. Intenta de nuevo.",
    );
  });

  it("un CallableError sin mensaje tampoco inventa nada", () => {
    expect(normalizeFirebaseError(new CallableError(""))).toBe("Ocurrió un error inesperado. Intenta de nuevo.");
  });
});

describe("normalizeFirebaseError()", () => {
  describe("known codes — without namespace prefix", () => {
    it.each([
      ["permission-denied", "No tienes permiso para realizar esta acción."],
      ["unauthenticated", "Tu sesión ha expirado. Vuelve a iniciar sesión."],
      ["not-found", "No se encontró la información solicitada."],
      ["already-exists", "Este registro ya existe."],
      ["unavailable", "El servicio no está disponible. Intenta de nuevo."],
      ["internal", "Ocurrió un error interno. Intenta de nuevo."],
      ["invalid-argument", "Los datos enviados no son válidos."],
      ["resource-exhausted", "Demasiadas solicitudes. Espera un momento."],
    ])('code "%s" → "%s"', (code, expected) => {
      expect(normalizeFirebaseError({ code })).toBe(expected);
    });
  });

  describe("known codes — with namespace prefix (strip before lookup)", () => {
    it("firestore/permission-denied → same message as bare permission-denied", () => {
      expect(normalizeFirebaseError({ code: "firestore/permission-denied" })).toBe(
        normalizeFirebaseError({ code: "permission-denied" }),
      );
    });

    it("functions/not-found → same message as bare not-found", () => {
      expect(normalizeFirebaseError({ code: "functions/not-found" })).toBe(
        normalizeFirebaseError({ code: "not-found" }),
      );
    });
  });

  describe("fallback for unrecognised / non-Firebase errors", () => {
    const FALLBACK = "Ocurrió un error inesperado. Intenta de nuevo.";

    it("unknown code → fallback", () => {
      expect(normalizeFirebaseError({ code: "unknown-code-xyz" })).toBe(FALLBACK);
    });

    it("plain Error object → fallback", () => {
      expect(normalizeFirebaseError(new Error("mensaje técnico interno"))).toBe(FALLBACK);
    });

    it("null → fallback", () => {
      expect(normalizeFirebaseError(null)).toBe(FALLBACK);
    });

    it("undefined → fallback", () => {
      expect(normalizeFirebaseError(undefined)).toBe(FALLBACK);
    });

    it("direct string → fallback", () => {
      expect(normalizeFirebaseError("string directo")).toBe(FALLBACK);
    });
  });

  describe("no friendly message leaks Firebase internals", () => {
    const FORBIDDEN = ["Firebase", "Firestore", "permission", "insufficient"];

    const ALL_CODES = [
      "permission-denied",
      "unauthenticated",
      "not-found",
      "already-exists",
      "unavailable",
      "failed-precondition",
      "invalid-argument",
      "internal",
      "resource-exhausted",
      "cancelled",
      "deadline-exceeded",
      "data-loss",
      "aborted",
      "unknown-xyz",
    ];

    it.each(ALL_CODES)('code "%s": message contains no forbidden words', (code) => {
      const msg = normalizeFirebaseError({ code });
      for (const word of FORBIDDEN) {
        expect(msg, `"${word}" must not appear in: "${msg}"`).not.toContain(word);
      }
    });

    it("no message contains Firestore collection path patterns", () => {
      for (const code of ALL_CODES) {
        const msg = normalizeFirebaseError({ code });
        expect(msg, `collection path must not appear in: "${msg}"`).not.toMatch(/\/[a-zA-Z_-]+\//);
      }
    });
  });
});

// ---------------------------------------------------------------------------

describe("toastFirebaseError()", () => {
  const toastErrorMock = vi.mocked(toast.error);

  beforeEach(() => {
    toastErrorMock.mockClear();
  });

  it("calls toast.error exactly once with the friendly Spanish message", () => {
    toastFirebaseError({ code: "permission-denied" });
    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock).toHaveBeenCalledWith("No tienes permiso para realizar esta acción.");
  });

  it("does NOT pass the raw error code to toast.error", () => {
    toastFirebaseError({ code: "permission-denied" });
    expect(toastErrorMock).not.toHaveBeenCalledWith("permission-denied");
    expect(toastErrorMock).not.toHaveBeenCalledWith(
      expect.stringContaining("permission-denied"),
    );
  });

  it("does NOT forward the Firebase SDK's internal message to the user", () => {
    toastFirebaseError({
      code: "permission-denied",
      message: "Missing or insufficient permissions",
    });
    const [calledWith] = toastErrorMock.mock.calls[0] as [string];
    expect(calledWith).not.toContain("Missing or insufficient permissions");
    expect(calledWith).not.toMatch(/Firebase|Firestore|permission/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 2 — callables.ts delegates to the shared utility
// ═══════════════════════════════════════════════════════════════════════════

describe("callables.ts — no duplicate error dictionary", () => {
  const callablesSrc = fs.readFileSync(
    path.join(ROOT, "src/lib/firebase/callables.ts"),
    "utf-8",
  );

  it('does not contain "permission-denied" as a hardcoded message dict key', () => {
    // A duplicate dict would look like: "permission-denied": "..."
    expect(callablesSrc).not.toMatch(/"permission-denied"\s*:/);
  });

  it('imports normalizeFirebaseError from @/lib/utils/error-handler', () => {
    expect(callablesSrc).toContain('from "@/lib/utils/error-handler"');
    expect(callablesSrc).toContain("normalizeFirebaseError");
  });

  it("normalizeCallableError delegates to normalizeFirebaseError (delegation call present in source)", () => {
    expect(callablesSrc).toMatch(/normalizeFirebaseError\(error\)/);
  });

  it("normalizeFirebaseError produces the authoritative message for permission-denied", () => {
    // Since callables delegates to this fn, its output IS the callable output for known codes
    expect(normalizeFirebaseError({ code: "permission-denied" })).toBe(
      "No tienes permiso para realizar esta acción.",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 3 — catch blocks wired to toastFirebaseError (3 representative pages)
// ═══════════════════════════════════════════════════════════════════════════

describe("catch blocks: Firebase internals hidden, friendly message shown", () => {
  const toastErrorMock = vi.mocked(toast.error);
  const RAW_SDK_MESSAGE = "Missing or insufficient permissions";
  const firebasePermissionError = {
    code: "permission-denied",
    message: RAW_SDK_MESSAGE,
    name: "FirebaseError",
  };
  const FRIENDLY = "No tienes permiso para realizar esta acción.";

  beforeEach(() => {
    toastErrorMock.mockClear();
  });

  // ── Resident portal: PQRS page ───────────────────────────────────────────

  describe("Resident — pqrs/page.tsx", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "src/app/(resident)/resident/pqrs/page.tsx"),
      "utf-8",
    );

    it("source uses toastFirebaseError in catch block", () => {
      expect(src).toContain("toastFirebaseError(error)");
    });

    it("source does NOT use the old toast.error(error.message) pattern", () => {
      expect(src).not.toMatch(/toast\.error\(error instanceof Error \? error\.message/);
    });

    it("FirebaseError(permission-denied) → friendly toast, no raw SDK message", () => {
      // Simulates: catch (error) { toastFirebaseError(error); }
      toastFirebaseError(firebasePermissionError);
      expect(toastErrorMock).toHaveBeenCalledWith(FRIENDLY);
      const [calledWith] = toastErrorMock.mock.calls[0] as [string];
      expect(calledWith).not.toContain(RAW_SDK_MESSAGE);
      expect(calledWith).not.toMatch(/Firebase|Firestore|permission/);
    });
  });

  // ── Admin portal: communications/page.tsx ────────────────────────────────

  describe("Admin — communications/page.tsx", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "src/app/(admin)/admin/communications/page.tsx"),
      "utf-8",
    );

    it("source uses toastFirebaseError in catch blocks", () => {
      expect(src).toContain("toastFirebaseError(createError)");
      expect(src).toContain("toastFirebaseError(error)");
    });

    it("source does NOT use the old toast.error(error.message) pattern", () => {
      expect(src).not.toMatch(/toast\.error\(.*instanceof Error.*\.message/);
    });

    it("FirebaseError(permission-denied) → friendly toast, no raw SDK message", () => {
      toastFirebaseError(firebasePermissionError);
      expect(toastErrorMock).toHaveBeenCalledWith(FRIENDLY);
      const [calledWith] = toastErrorMock.mock.calls[0] as [string];
      expect(calledWith).not.toContain(RAW_SDK_MESSAGE);
    });
  });

  // ── Security Guard portal: GuardPackagesList ─────────────────────────────

  describe("SecurityGuard — GuardPackagesList.tsx", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "src/components/securityGuard/GuardPackagesList.tsx"),
      "utf-8",
    );

    it("source uses toastFirebaseError in catch block", () => {
      expect(src).toContain("toastFirebaseError(error)");
    });

    it("source does NOT use the old toast.error(error.message) pattern", () => {
      expect(src).not.toMatch(/toast\.error\(error instanceof Error \? error\.message/);
    });

    it("FirebaseError(permission-denied) → friendly toast, no raw SDK message", () => {
      toastFirebaseError(firebasePermissionError);
      expect(toastErrorMock).toHaveBeenCalledWith(FRIENDLY);
      const [calledWith] = toastErrorMock.mock.calls[0] as [string];
      expect(calledWith).not.toContain(RAW_SDK_MESSAGE);
      expect(calledWith).not.toMatch(/Firebase|Firestore|permission/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 4 — error.tsx y global-error.tsx (pure function / JSX tree tests)
// ═══════════════════════════════════════════════════════════════════════════

// Lazy-import to avoid module-level side-effects; these files have no Firebase deps.
// esbuild (vitest default transform) handles the "use client" directive and JSX.

describe("error.tsx — Next.js route error boundary", async () => {
  const { default: RouteError } = await import("../src/app/error");
  const technicalError = Object.assign(new Error("FirebaseError: Missing or insufficient permissions"), {
    digest: "secret-digest-abc123",
  });
  const resetMock = vi.fn();

  it("renders without throwing", () => {
    expect(() => RouteError({ error: technicalError, reset: resetMock })).not.toThrow();
  });

  it("does not expose error.message in rendered text", () => {
    const element = RouteError({ error: technicalError, reset: resetMock });
    const text = collectText(element);
    expect(text).not.toContain("FirebaseError");
    expect(text).not.toContain("Missing or insufficient permissions");
    expect(text).not.toContain("secret-digest-abc123");
  });

  it("does not expose error.digest in rendered text", () => {
    const element = RouteError({ error: technicalError, reset: resetMock });
    const text = collectText(element);
    expect(text).not.toContain("secret-digest-abc123");
  });

  it("contains friendly Spanish text for the user", () => {
    const element = RouteError({ error: technicalError, reset: resetMock });
    const text = collectText(element);
    expect(text).toMatch(/Algo salió mal|error inesperado|Intentar de nuevo/i);
  });

  it("has a <button> element that fires the reset callback on click", () => {
    const element = RouteError({ error: technicalError, reset: resetMock });
    const buttons = findElements(element, "button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[0].onClick).toBe(resetMock);
  });
});

describe("global-error.tsx — Next.js root error boundary", async () => {
  const { default: GlobalError } = await import("../src/app/global-error");
  const technicalError = new Error("Critical internal crash details");
  const resetMock = vi.fn();

  it("renders without throwing", () => {
    expect(() => GlobalError({ error: technicalError, reset: resetMock })).not.toThrow();
  });

  it("does not expose error.message in rendered text", () => {
    const element = GlobalError({ error: technicalError, reset: resetMock });
    const text = collectText(element);
    expect(text).not.toContain("Critical internal crash details");
    expect(text).not.toContain("FirebaseError");
  });

  it("contains friendly Spanish text for the user", () => {
    const element = GlobalError({ error: technicalError, reset: resetMock });
    const text = collectText(element);
    expect(text).toMatch(/Error crítico|error crítico|recarga|Recargar/i);
  });

  it("has a <button> that fires the reset callback on click", () => {
    const element = GlobalError({ error: technicalError, reset: resetMock });
    const buttons = findElements(element, "button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    expect(buttons[0].onClick).toBe(resetMock);
  });

  it("includes <html> root element (required by Next.js for global-error)", () => {
    const element = GlobalError({ error: technicalError, reset: resetMock });
    // The root element must be 'html'
    const el = element as { type?: string };
    expect(el.type).toBe("html");
  });

  it("includes <body> inside <html>", () => {
    const element = GlobalError({ error: technicalError, reset: resetMock });
    const bodies = findElements(element, "body");
    expect(bodies.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BLOQUE 5 — resident/layout.tsx: profile_error does not render raw error
// ═══════════════════════════════════════════════════════════════════════════

describe("resident/layout.tsx — profile_error branch hides raw error variable", () => {
  const layoutSrc = fs.readFileSync(
    path.join(ROOT, "src/app/(resident)/resident/layout.tsx"),
    "utf-8",
  );

  it("CardDescription does not interpolate {error} expression", () => {
    const match = layoutSrc.match(/<CardDescription[\s\S]*?<\/CardDescription>/);
    expect(match, "CardDescription block must exist in layout").toBeTruthy();
    const block = match![0];
    expect(block).not.toContain("{error}");
    expect(block).not.toContain("error.message");
    // No JSX expression with 'error' identifier
    expect(block).not.toMatch(/\{[^}]*\berror\b[^}]*\}/);
  });

  it("CardDescription contains only static friendly text", () => {
    const match = layoutSrc.match(/<CardDescription[\s\S]*?<\/CardDescription>/);
    const block = match![0];
    expect(block).toContain("No pudimos cargar tu perfil");
  });

  it("error variable from useAuth() is only used in console.error, not in JSX output", () => {
    // Collect every line referencing 'error' that is not a comment or console call
    const lines = layoutSrc.split("\n");
    const jsxErrorLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) return false;
      if (trimmed.includes("console.error")) return false;
      if (trimmed.includes("const {") || trimmed.includes("status ===")) return false;
      // Only flag if 'error' appears in a JSX interpolation or as rendered content
      return /\{[^}]*\berror\b[^}]*\}/.test(line);
    });
    expect(
      jsxErrorLines,
      `Raw error must not be interpolated in JSX:\n${jsxErrorLines.join("\n")}`,
    ).toHaveLength(0);
  });

  it("'FirebaseError: permission-denied' string cannot reach the DOM via {error}", () => {
    // Structural proof: {error} is absent from template → the value
    // "FirebaseError: permission-denied" can never be rendered by this branch
    const match = layoutSrc.match(/<CardDescription[\s\S]*?<\/CardDescription>/);
    const block = match![0];
    expect(block).not.toMatch(/\{[^}]*error[^}]*\}/);
    // Confirm the static replacement is present
    expect(block).toMatch(/contacta a la administración/);
  });
});
