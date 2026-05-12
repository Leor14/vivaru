import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { CreateSurveyInput } from "@/features/surveys/schemas";
import type { Survey, SurveyAnswer } from "@/features/surveys/types";

// ─── Normalizer ────────────────────────────────────────────────────────────────

function normalizeSurvey(id: string, data: Record<string, unknown>): Survey {
  const toDate = (raw: unknown): Date => {
    if (!raw) return new Date(0);
    if (raw instanceof Date) return raw;
    if (typeof raw === "object") {
      const ts = raw as { toDate?: () => Date };
      if (typeof ts.toDate === "function") return ts.toDate();
    }
    return new Date(String(raw));
  };

  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    title: String(data.title ?? ""),
    description: data.description ? String(data.description) : undefined,
    status: (data.status as Survey["status"]) ?? "draft",
    questions: Array.isArray(data.questions) ? (data.questions as Survey["questions"]) : [],
    targetAudience: (data.targetAudience as Survey["targetAudience"]) ?? { type: "all" },
    minResponsesForResults: Number(data.minResponsesForResults ?? 5),
    responseCount: Number(data.responseCount ?? 0),
    publishedAt: data.publishedAt ? toDate(data.publishedAt) : undefined,
    closedAt: data.closedAt ? toDate(data.closedAt) : undefined,
    closingDate: data.closingDate ? toDate(data.closingDate) : undefined,
    createdBy: String(data.createdBy ?? ""),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

// ─── Admin CRUD ────────────────────────────────────────────────────────────────

export async function createSurvey(
  tenantId: string,
  input: CreateSurveyInput,
  createdBy: string,
): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  await addDoc(collection(db, "surveys"), {
    tenantId,
    title: input.title,
    description: input.description ?? null,
    questions: input.questions,
    targetAudience: input.targetAudience,
    minResponsesForResults: input.minResponsesForResults,
    status: "draft",
    responseCount: 0,
    closingDate: input.closingDate ?? null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function publishSurvey(surveyId: string): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  await updateDoc(doc(db, "surveys", surveyId), {
    status: "published",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function closeSurvey(surveyId: string): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  await updateDoc(doc(db, "surveys", surveyId), {
    status: "closed",
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function archiveSurvey(surveyId: string): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  await updateDoc(doc(db, "surveys", surveyId), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
}

// ─── Resident response (write-once transaction) ───────────────────────────────

export async function submitResponse(
  survey: Survey,
  unitId: string,
  answers: SurveyAnswer[],
): Promise<void> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  const responseRef = doc(db, "survey_responses", `${survey.id}_${unitId}`);
  const surveyRef = doc(db, "surveys", survey.id);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(responseRef);
    if (existing.exists()) {
      // Resident already responded — idempotent, return silently
      return;
    }
    transaction.set(responseRef, {
      id: `${survey.id}_${unitId}`,
      surveyId: survey.id,
      tenantId: survey.tenantId,
      unitId,
      answers,
      respondedAt: serverTimestamp(),
    });
    transaction.update(surveyRef, { responseCount: increment(1) });
  });
}

export async function hasResponded(surveyId: string, unitId: string): Promise<boolean> {
  if (!db) return false;

  const responseId = `${surveyId}_${unitId}`;
  const snap = await getDoc(doc(db, "survey_responses", responseId));
  return snap.exists();
}

export async function getSurveyResults(surveyId: string): Promise<SurveyAnswer[][]> {
  if (!db) return [];

  const snap = await getDocs(
    query(collection(db, "survey_responses"), where("surveyId", "==", surveyId)),
  );

  return snap.docs.map((d) => {
    const data = d.data() as { answers?: SurveyAnswer[] };
    return data.answers ?? [];
  });
}

// ─── Real-time listeners ───────────────────────────────────────────────────────

export function getAdminSurveys(
  tenantId: string,
  onData: (surveys: Survey[]) => void,
  onError: (message: string) => void,
) {
  if (!db) return null;

  return onSnapshot(
    query(
      collection(db, "surveys"),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
    ),
    (snapshot) => {
      const surveys = snapshot.docs.map((d) =>
        normalizeSurvey(d.id, d.data() as Record<string, unknown>),
      );
      onData(surveys);
    },
    (error) => {
      console.error("[firestore][surveys:admin]", error);
      onError("No fue posible cargar las encuestas en este momento.");
    },
  );
}

export function getPublishedSurveysForResident(
  tenantId: string,
  onData: (surveys: Survey[]) => void,
  onError: (message: string) => void,
) {
  if (!db) return null;

  return onSnapshot(
    query(
      collection(db, "surveys"),
      where("tenantId", "==", tenantId),
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
    ),
    (snapshot) => {
      const surveys = snapshot.docs.map((d) =>
        normalizeSurvey(d.id, d.data() as Record<string, unknown>),
      );
      onData(surveys);
    },
    (error) => {
      console.error("[firestore][surveys:resident]", error);
      onError("No fue posible cargar las encuestas en este momento.");
    },
  );
}
