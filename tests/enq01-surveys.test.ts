// tests/enq01-surveys.test.ts
// ENQ-01: surveys module — unit tests (services.ts, visibility.ts) + static checks
// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// ─── Firestore mocks ──────────────────────────────────────────────────────────

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection-ref"),
  doc: vi.fn((_, ...segments) => ({ path: segments.join("/") })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  increment: vi.fn((n: number) => ({ __increment: n })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn((...args: unknown[]) => args),
  query: vi.fn((...args: unknown[]) => args),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "__serverTimestamp__"),
  updateDoc: vi.fn(),
  where: vi.fn((...args: unknown[]) => args),
}));

vi.mock("@/lib/firebase/client", () => ({
  db: { type: "firestore" }, // non-null sentinel
}));

import { getDoc, runTransaction, increment } from "firebase/firestore";
import * as clientModule from "@/lib/firebase/client";

import { submitResponse, hasResponded } from "../src/features/surveys/services";
import { canSeeResults, aggregateResults } from "../src/features/surveys/visibility";
import type { Survey, SurveyAnswer } from "../src/features/surveys/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ROOT = join(__dirname, "..");

function makeSurvey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: "survey-1",
    tenantId: "tenant-a",
    title: "Test survey",
    status: "published",
    questions: [],
    targetAudience: { type: "all" },
    minResponsesForResults: 5,
    responseCount: 0,
    createdBy: "user-1",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

const answers: SurveyAnswer[] = [{ questionId: "q1", value: "A" }];

// ─── BLOQUE 1 — submitResponse con runTransaction ─────────────────────────────

describe("B1: submitResponse — runTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T1 — primer submit: llama transaction.set y transaction.update", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set: vi.fn(),
      update: vi.fn(),
    };
    (runTransaction as Mock).mockImplementation(async (_db: unknown, fn: (t: typeof transaction) => Promise<void>) => {
      await fn(transaction);
    });

    await submitResponse(makeSurvey(), "unit-1", answers);

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(transaction.set).toHaveBeenCalledOnce();
    expect(transaction.update).toHaveBeenCalledOnce();
    expect(transaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ responseCount: expect.anything() }),
    );
  });

  it("T2 — segundo submit: idempotente, no modifica nada", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: () => true }),
      set: vi.fn(),
      update: vi.fn(),
    };
    (runTransaction as Mock).mockImplementation(async (_db: unknown, fn: (t: typeof transaction) => Promise<void>) => {
      await fn(transaction);
    });

    await expect(submitResponse(makeSurvey(), "unit-1", answers)).resolves.toBeUndefined();

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("T3 — hasResponded: false cuando doc no existe", async () => {
    (getDoc as Mock).mockResolvedValue({ exists: () => false });

    const result = await hasResponded("survey-1", "unit-1");

    expect(result).toBe(false);
    expect(getDoc).toHaveBeenCalledOnce();
    const calledRef = (getDoc as Mock).mock.calls[0][0] as { path: string };
    expect(calledRef.path).toContain("survey-1_unit-1");
  });

  it("T4 — hasResponded: true cuando doc existe", async () => {
    (getDoc as Mock).mockResolvedValue({ exists: () => true });

    const result = await hasResponded("survey-1", "unit-1");

    expect(result).toBe(true);
  });

  it("T5 — db null → lanza error, runTransaction no llamado", async () => {
    vi.spyOn(clientModule, "db", "get").mockReturnValue(null as unknown as typeof clientModule.db);

    await expect(submitResponse(makeSurvey(), "unit-1", answers)).rejects.toThrow(
      "Firebase no esta configurado en este entorno.",
    );
    expect(runTransaction).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ─── BLOQUE 2 — canSeeResults y aggregateResults ──────────────────────────────

describe("B2: visibility — canSeeResults", () => {
  it("T6 — status closed → true (responseCount irrelevante)", () => {
    expect(canSeeResults(makeSurvey({ status: "closed", responseCount: 0, minResponsesForResults: 5 }))).toBe(true);
  });

  it("T7 — published + responseCount >= min → true", () => {
    expect(canSeeResults(makeSurvey({ status: "published", responseCount: 5, minResponsesForResults: 5 }))).toBe(true);
  });

  it("T8 — published + responseCount < min → false", () => {
    expect(canSeeResults(makeSurvey({ status: "published", responseCount: 3, minResponsesForResults: 5 }))).toBe(false);
  });

  it("T9 — draft → false aunque tenga muchas respuestas", () => {
    expect(canSeeResults(makeSurvey({ status: "draft", responseCount: 10, minResponsesForResults: 1 }))).toBe(false);
  });
});

describe("B2: visibility — aggregateResults", () => {
  it("T10 — single_choice: cuenta por opción", () => {
    const survey = makeSurvey({
      responseCount: 3,
      questions: [{ id: "q1", type: "single_choice", text: "Q1", options: ["A", "B", "C"], required: true }],
    });
    const allAnswers: SurveyAnswer[][] = [
      [{ questionId: "q1", value: "A" }],
      [{ questionId: "q1", value: "B" }],
      [{ questionId: "q1", value: "A" }],
    ];
    const result = aggregateResults(survey, allAnswers);
    expect(result.byQuestion["q1"].counts?.["A"]).toBe(2);
    expect(result.byQuestion["q1"].counts?.["B"]).toBe(1);
    expect(result.totalResponded).toBe(3);
  });

  it("T11 — multiple_choice: cada selección suma 1", () => {
    const survey = makeSurvey({
      responseCount: 2,
      questions: [{ id: "q1", type: "multiple_choice", text: "Q1", options: ["A", "B", "C"], required: true }],
    });
    const allAnswers: SurveyAnswer[][] = [
      [{ questionId: "q1", value: ["A", "B"] }],
      [{ questionId: "q1", value: ["B", "C"] }],
    ];
    const result = aggregateResults(survey, allAnswers);
    expect(result.byQuestion["q1"].counts?.["A"]).toBe(1);
    expect(result.byQuestion["q1"].counts?.["B"]).toBe(2);
    expect(result.byQuestion["q1"].counts?.["C"]).toBe(1);
  });

  it("T12 — likert: counts por valor numérico (key = string)", () => {
    const survey = makeSurvey({
      responseCount: 3,
      questions: [{ id: "q1", type: "likert", text: "Q1", required: true }],
    });
    const allAnswers: SurveyAnswer[][] = [
      [{ questionId: "q1", value: 4 }],
      [{ questionId: "q1", value: 5 }],
      [{ questionId: "q1", value: 4 }],
    ];
    const result = aggregateResults(survey, allAnswers);
    expect(result.byQuestion["q1"].counts?.["4"]).toBe(2);
    expect(result.byQuestion["q1"].counts?.["5"]).toBe(1);
  });

  it("T13 — text: acumula strings, no agrega counts", () => {
    const survey = makeSurvey({
      responseCount: 2,
      questions: [{ id: "q1", type: "text", text: "Q1", required: false }],
    });
    const allAnswers: SurveyAnswer[][] = [
      [{ questionId: "q1", value: "Excelente gestión" }],
      [{ questionId: "q1", value: "Mejorar la piscina" }],
    ];
    const result = aggregateResults(survey, allAnswers);
    expect(result.byQuestion["q1"].textAnswers).toHaveLength(2);
    expect(result.byQuestion["q1"].counts).toBeUndefined();
  });
});

// ─── BLOQUE 3 — types.ts y schemas.ts: verificación estática ─────────────────

describe("B3: types.ts — exports y estructura", () => {
  const src = readFileSync(join(ROOT, "src/features/surveys/types.ts"), "utf8");

  it("exporta todos los tipos requeridos", () => {
    expect(src).toContain("export type QuestionType");
    expect(src).toContain("export interface Survey");
    expect(src).toContain("export interface SurveyQuestion");
    expect(src).toContain("export interface SurveyResponse");
    expect(src).toContain("export interface SurveyAnswer");
    expect(src).toContain("export interface SurveyResultsAggregated");
  });

  it("QuestionType incluye los 4 valores", () => {
    expect(src).toContain('"single_choice"');
    expect(src).toContain('"multiple_choice"');
    expect(src).toContain('"likert"');
    expect(src).toContain('"text"');
  });

  it("SurveyResponse.id tipado como string (ID determinístico)", () => {
    // id: string should appear within the SurveyResponse interface block
    const responseBlock = src.slice(src.indexOf("interface SurveyResponse"));
    expect(responseBlock).toMatch(/id:\s*string/);
  });

  it("SurveyAnswer.value acepta string | string[] | number", () => {
    expect(src).toMatch(/value:\s*string\s*\|\s*string\[\]\s*\|\s*number/);
  });
});

describe("B3: schemas.ts — exports y validaciones", () => {
  const src = readFileSync(join(ROOT, "src/features/surveys/schemas.ts"), "utf8");

  it("exporta createSurveySchema", () => {
    expect(src).toContain("createSurveySchema");
  });

  it("valida mínimo 1 pregunta y máximo 10", () => {
    expect(src).toMatch(/\.min\(1/);
    expect(src).toMatch(/\.max\(10/);
  });

  it("validación cruzada tower via superRefine o refine", () => {
    expect(src).toMatch(/superRefine|\.refine\(/);
    expect(src).toContain('"tower"');
  });
});

// ─── BLOQUE 4 — services.ts: garantías de implementación ─────────────────────

describe("B4: services.ts — garantías de implementación", () => {
  const src = readFileSync(join(ROOT, "src/features/surveys/services.ts"), "utf8");

  it("importa runTransaction, no writeBatch ni setDoc", () => {
    expect(src).toContain("runTransaction");
    expect(src).not.toContain("writeBatch");
    expect(src).not.toContain("setDoc");
  });

  it("ID determinístico: construye surveyId_unitId", () => {
    expect(src).toMatch(/`\$\{survey\.id\}_\$\{unitId\}`/);
  });

  it("existence check antes de transaction.set", () => {
    const submitBlock = src.slice(src.indexOf("async function submitResponse"));
    expect(submitBlock).toMatch(/existing\.exists\(\)/);
    // return debe aparecer antes de transaction.set en el bloque
    const existsIdx = submitBlock.indexOf("existing.exists()");
    const setIdx = submitBlock.indexOf("transaction.set");
    expect(existsIdx).toBeLessThan(setIdx);
  });

  it("exporta todas las funciones requeridas", () => {
    const fns = [
      "createSurvey",
      "publishSurvey",
      "closeSurvey",
      "archiveSurvey",
      "submitResponse",
      "hasResponded",
      "getSurveyResults",
      "getAdminSurveys",
      "getPublishedSurveysForResident",
    ];
    for (const fn of fns) {
      // Match both `export function` and `export async function`
      expect(src).toMatch(new RegExp(`export (async )?function ${fn}\\(`));
    }
  });
});

// ─── BLOQUE 5 — use-surveys.ts: hooks con cleanup ────────────────────────────

describe("B5: use-surveys.ts — hooks con onSnapshot y cleanup", () => {
  const src = readFileSync(join(ROOT, "src/features/surveys/use-surveys.ts"), "utf8");

  it("exporta useAdminSurveys y useResidentSurveys", () => {
    expect(src).toContain("export function useAdminSurveys");
    expect(src).toContain("export function useResidentSurveys");
  });

  it("usa getAdminSurveys / getPublishedSurveysForResident (onSnapshot internamente)", () => {
    expect(src).toContain("getAdminSurveys");
    expect(src).toContain("getPublishedSurveysForResident");
  });

  it("retorna unsubscribe en cleanup del useEffect", () => {
    expect(src).toMatch(/return \(\) => \{[\s\S]*?unsub[\s\S]*?\}/);
  });

  it("useResidentSurveys filtra por published (via getPublishedSurveysForResident)", () => {
    // Either the hook itself has "published" or calls the published-specific service fn
    expect(src).toMatch(/published|getPublishedSurveysForResident/);
  });
});

// ─── BLOQUE 6 — radio-group.tsx y checkbox.tsx: accesibilidad y API ──────────

describe("B6: radio-group.tsx — estructura y accesibilidad", () => {
  const src = readFileSync(join(ROOT, "src/components/ui/radio-group.tsx"), "utf8");

  it("usa forwardRef", () => {
    expect(src).toContain("forwardRef");
  });

  it("exporta RadioGroup y RadioItem como named exports", () => {
    expect(src).toContain("export const RadioGroup");
    expect(src).toContain("export function RadioItem");
  });

  it("usa <input type=\"radio\"> nativo", () => {
    expect(src).toContain('type="radio"');
  });

  it("label asociado al input via htmlFor", () => {
    expect(src).toContain("htmlFor");
  });
});

describe("B6: checkbox.tsx — estructura y accesibilidad", () => {
  const src = readFileSync(join(ROOT, "src/components/ui/checkbox.tsx"), "utf8");

  it("usa forwardRef con ref tipado como HTMLInputElement", () => {
    expect(src).toContain("forwardRef");
    expect(src).toContain("HTMLInputElement");
  });

  it("usa <input type=\"checkbox\"> nativo", () => {
    expect(src).toContain('type="checkbox"');
  });

  it("acepta props: checked, onChange, label, id", () => {
    expect(src).toContain("checked");
    expect(src).toContain("onChange");
    expect(src).toContain("label");
    expect(src).toContain("id");
  });

  it("label asociado al input via htmlFor", () => {
    expect(src).toContain("htmlFor");
  });
});

// ─── BLOQUE 7 — firestore.rules: surveys y survey_responses ──────────────────

describe("B7: firestore.rules — reglas ENQ-01", () => {
  const src = readFileSync(join(ROOT, "firestore.rules"), "utf8");

  it("existe bloque match para surveys", () => {
    expect(src).toMatch(/match\s+\/surveys\/\{/);
  });

  it("surveys: read permitido para tenant members (admin o residente)", () => {
    const surveysBlock = src.slice(src.indexOf("match /surveys/{"), src.indexOf("match /survey_responses/{"));
    expect(surveysBlock).toMatch(/allow read/);
    expect(surveysBlock).toMatch(/tenantAdminOrSuper|tenantRole/);
  });

  it("surveys: write solo para admin", () => {
    const surveysBlock = src.slice(src.indexOf("match /surveys/{"), src.indexOf("match /survey_responses/{"));
    // Rules may split create/update and delete across lines
    expect(surveysBlock).toMatch(/allow create/);
    expect(surveysBlock).toMatch(/allow delete/);
    expect(surveysBlock).toMatch(/tenantAdminOrSuper/);
    // Residents must NOT have a write allow in this block
    expect(surveysBlock).not.toMatch(/allow create[^;]+residentOwnUnit/);
  });

  it("existe bloque match para survey_responses", () => {
    expect(src).toMatch(/match\s+\/survey_responses\/\{/);
  });

  it("survey_responses: read solo para admin", () => {
    const responsesBlock = src.slice(src.indexOf("match /survey_responses/{"));
    expect(responsesBlock).toMatch(/allow read/);
    expect(responsesBlock).toMatch(/tenantAdminOrSuper/);
  });

  it("survey_responses: create verifica unitId del residente", () => {
    const responsesBlock = src.slice(src.indexOf("match /survey_responses/{"));
    expect(responsesBlock).toMatch(/allow create/);
    expect(responsesBlock).toMatch(/unitId/);
    expect(responsesBlock).toMatch(/residentOwnUnit/);
  });

  it("survey_responses: update y delete denegados", () => {
    const responsesBlock = src.slice(src.indexOf("match /survey_responses/{"));
    expect(responsesBlock).toMatch(/allow update.*delete.*if false|update, delete: if false/);
  });
});

// ─── BLOQUE 8 — firestore.indexes.json: nuevos indexes ───────────────────────

describe("B8: firestore.indexes.json — indexes ENQ-01", () => {
  const src = readFileSync(join(ROOT, "firestore.indexes.json"), "utf8");
  const json = JSON.parse(src) as { indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order: string }>; queryScope: string }> };

  it("existe index para surveys con tenantId + status + createdAt DESC", () => {
    const idx = json.indexes.find(
      (i) =>
        i.collectionGroup === "surveys" &&
        i.fields.some((f) => f.fieldPath === "tenantId" && f.order === "ASCENDING") &&
        i.fields.some((f) => f.fieldPath === "status" && f.order === "ASCENDING") &&
        i.fields.some((f) => f.fieldPath === "createdAt" && f.order === "DESCENDING"),
    );
    expect(idx).toBeDefined();
    expect(idx?.queryScope).toBe("COLLECTION");
  });

  it("existe index para survey_responses con surveyId ASC + respondedAt ASC", () => {
    const idx = json.indexes.find(
      (i) =>
        i.collectionGroup === "survey_responses" &&
        i.fields.some((f) => f.fieldPath === "surveyId" && f.order === "ASCENDING") &&
        i.fields.some((f) => f.fieldPath === "respondedAt" && f.order === "ASCENDING"),
    );
    expect(idx).toBeDefined();
    expect(idx?.queryScope).toBe("COLLECTION");
  });
});
