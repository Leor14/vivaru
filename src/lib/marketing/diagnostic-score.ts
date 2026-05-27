import type { DiagnosticAnswers } from "./diagnostic-schema";

/** Score 0-100. Higher = more mature operation. */
export function calculateScore(a: DiagnosticAnswers): number {
  // Tools maturity: 30 pts max, penalises legacy tools.
  let toolsScore = 0;
  if (a.q4_herramientas.includes("otroSoftware")) toolsScore += 25;
  if (a.q4_herramientas.includes("excel")) toolsScore -= 5;
  if (a.q4_herramientas.includes("whatsapp")) toolsScore -= 10;
  if (a.q4_herramientas.includes("libretas")) toolsScore -= 15;
  if (a.q4_herramientas.includes("nada")) toolsScore -= 20;
  toolsScore = Math.max(0, Math.min(30, toolsScore + 30));

  // Morosidad: 30 pts. Lower % = higher score (healthier).
  const morosityScore = 30 * (1 - a.q6_morosidad / 50);

  // Manual hours: 25 pts. Fewer hours = more mature.
  const hoursScore = 25 * (1 - a.q7_horasManuales / 30);

  // Base coverage: 15 pts (timeline does not affect maturity).
  const baseScore = 15;

  return Math.max(
    0,
    Math.min(100, Math.round(toolsScore + morosityScore + hoursScore + baseScore)),
  );
}

export type ScoreCategory = {
  level: "critical" | "warning" | "healthy";
  label: string;
  color: string;
};

export function getScoreCategory(score: number): ScoreCategory {
  if (score < 40) return { level: "critical", label: "Operación en caos", color: "text-brand-red" };
  if (score < 70) return { level: "warning", label: "Margen amplio de mejora", color: "text-brand-amber" };
  return { level: "healthy", label: "Operación madura", color: "text-brand-greenSucc" };
}
