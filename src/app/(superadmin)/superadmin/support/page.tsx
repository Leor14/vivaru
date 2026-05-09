import { EmptyState } from "@/components/shared/empty-state";

export default function SuperadminSupportPage() {
  return (
    <div className="space-y-3">
      <EmptyState
        title="Centro de soporte operaciónal"
        description="Vista lista para lookup por tenant/usuario, timeline de auditoria e incidentes."
      />
    </div>
  );
}
