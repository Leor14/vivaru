import type { Metadata } from "next";

import { Topbar } from "@/components/marketing/Topbar";
import { DiagnosticFlowLoader } from "@/components/diagnostico/DiagnosticFlowLoader";

export const metadata: Metadata = {
  // Propia, no heredada: el layout ya no declara canonica (heredaba la de /mx).
  alternates: { canonical: "/diagnostico" },
  title: "Diagnóstico de Madurez Digital — Vivaru",
  description:
    "9 preguntas · 4 minutos · reporte personalizado con tu score de madurez digital, pilar prioritario y plan Vivaru recomendado.",
};

export default function DiagnosticoPage() {
  return (
    <>
      <Topbar />
      <main className="min-h-[80vh] bg-background pt-md sm:pt-lg">
        <DiagnosticFlowLoader />
      </main>
    </>
  );
}
