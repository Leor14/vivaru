import { EmptyState } from "@/components/shared/empty-state";

export default function SuperadminAuditPage() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-[var(--slate-900)]">Auditoria de plataforma</h2>
      <EmptyState
        title="Eventos de seguridad"
        description="Visualiza trazabilidad de operaciónes sensibles registradas en auditLogs."
      />
    </section>
  );
}
