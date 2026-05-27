"use client";

/**
 * Client-side loader for DiagnosticFlow.
 * Wraps next/dynamic { ssr: false } in a Client Component so it can be
 * imported from the (marketing)/diagnostico Server Component page.
 */
import dynamic from "next/dynamic";

const DiagnosticFlow = dynamic(
  () =>
    import("@/components/diagnostico/DiagnosticFlow").then(
      (m) => m.DiagnosticFlow,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="container py-xxl text-center text-sm text-slate-500">
        Preparando tu diagnóstico…
      </div>
    ),
  },
);

export function DiagnosticFlowLoader() {
  return <DiagnosticFlow />;
}
