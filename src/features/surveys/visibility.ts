import type { Survey, SurveyAnswer, SurveyResultsAggregated, QuestionType } from "@/features/surveys/types";

/**
 * Returns true if the given survey's results are visible to a viewer.
 *
 * Results are visible when:
 *   - The survey is closed, OR
 *   - The response count has reached the minimum threshold
 *
 * Results are never visible for drafts.
 */
export function canSeeResults(survey: Survey): boolean {
  if (survey.status === "draft") return false;
  if (survey.status === "closed") return true;
  return survey.responseCount >= survey.minResponsesForResults;
}

/**
 * Aggregates raw survey responses into a structured summary.
 *
 * @param survey - The survey document (used for question metadata and responseCount)
 * @param allAnswers - Array of answer arrays, one per response (from getSurveyResults)
 * @returns SurveyResultsAggregated — pass totalInvited=0 from caller if unit count is unknown
 */
export function aggregateResults(
  survey: Survey,
  allAnswers: SurveyAnswer[][],
): SurveyResultsAggregated {
  const totalInvited = 0; // Completed by the UI layer once it has the unit count
  const totalResponded = survey.responseCount;
  const participationRate = totalResponded / Math.max(totalInvited, 1);

  const byQuestion: SurveyResultsAggregated["byQuestion"] = {};

  for (const question of survey.questions) {
    const { id: qId, type } = question;

    if (type === "text") {
      byQuestion[qId] = { type, textAnswers: [] };
    } else {
      byQuestion[qId] = { type, counts: {} };
    }
  }

  for (const answerSet of allAnswers) {
    for (const answer of answerSet) {
      const entry = byQuestion[answer.questionId];
      if (!entry) continue;

      const { type } = entry;

      if (type === "text") {
        if (typeof answer.value === "string" && answer.value.trim()) {
          entry.textAnswers = entry.textAnswers ?? [];
          entry.textAnswers.push(answer.value.trim());
        }
      } else if (type === "single_choice" || type === "likert") {
        const key = String(answer.value);
        entry.counts = entry.counts ?? {};
        entry.counts[key] = (entry.counts[key] ?? 0) + 1;
      } else if (type === "multiple_choice") {
        if (Array.isArray(answer.value)) {
          entry.counts = entry.counts ?? {};
          for (const selection of answer.value) {
            const key = String(selection);
            entry.counts[key] = (entry.counts[key] ?? 0) + 1;
          }
        }
      }
    }
  }

  return { totalInvited, totalResponded, participationRate, byQuestion };
}
