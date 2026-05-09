"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useDocuments } from "@/features/documents/use-documents";

export default function ResidentDocumentsPage() {
  const { user } = useAuth();
  const { items, loading } = useDocuments(user?.tenantId);

  return (
    <Card>
      <CardTitle>Documentos</CardTitle>
      <CardDescription className="mt-1">Reglamentos, actas y circulares compartidas por la administración.</CardDescription>
      <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
        {loading ? <li>Cargando documentos...</li> : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin documentos"
            description="Aun no hay documentos publicados para tu conjunto."
          />
        ) : null}
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-[var(--slate-200)] p-3">
            {item.title}
          </li>
        ))}
      </ul>
    </Card>
  );
}
