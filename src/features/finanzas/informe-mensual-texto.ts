import type { MonthlyReport } from "@/features/finanzas/use-monthly-reports";

/**
 * Cómo se LEE un informe mensual en pantalla (`PRD-V-FLOW-007`), para la administración y
 * para el consejo. Vive en un `.ts` sin componentes para que una prueba lo alcance.
 */

/** `YYYY-MM` → «Marzo de 2026». El período es lo que la gente reconoce del informe. */
export function rotuloDelPeriodo(period: string): string {
  const [y, m] = period.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (Number.isNaN(d.getTime())) return period;
  const texto = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fechaDelSello(sello: { seconds: number } | undefined): string {
  if (!sello?.seconds) return "";
  return new Date(sello.seconds * 1000).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Quién firmó, **y con qué cargo**. El cargo lo escribe el servidor al firmar
 * (`identidadParaFirmar`): «Administración» o «Consejo de administración». Antes la lista
 * pintaba solo nombres, y con el consejo firmando no se distinguía quién firmó por qué.
 */
export function firmantes(informe: Pick<MonthlyReport, "signatures">): string {
  return (informe.signatures ?? []).map((f) => (f.role ? `${f.name} (${f.role})` : f.name)).join(", ");
}
