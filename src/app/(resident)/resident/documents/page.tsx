"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useDocuments } from "@/features/documents/use-documents";
import { formatDateSafe } from "@/utils/date";

export default function ResidentDocumentsPage() {
  const { user } = useAuth();
  const { items, loading } = useDocuments(user?.tenantId);

  return (
    <Card>
      <CardTitle>Documentos</CardTitle>
      <CardDescription className="mt-1">Reglamentos, actas y circulares compartidas por la administración.</CardDescription>
      <ul className="mt-4 space-y-2 text-sm text-[var(--slate-700)]">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <li key={i} className="rounded-xl border border-[var(--slate-200)] p-3">
                <Skeleton className="h-4 w-4/5 rounded-sm" />
              </li>
            ))}
          </>
        ) : null}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="Sin documentos"
            description="Aún no hay documentos publicados para tu conjunto."
          />
        ) : null}
        {items.map((item) => {
          // El nombre del fichero es lo único que TODO documento trae. Esta lista
          // pintaba `item.title`, que no existe en ninguno: aunque la consulta
          // hubiera devuelto filas, habrían salido en blanco.
          const fecha = formatDateSafe(item.createdAt);
          return (
            <li key={item.id} className="rounded-xl border border-[var(--slate-200)] p-3">
              {item.fileUrl ? (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--brand-700)] underline-offset-2 hover:underline"
                >
                  {item.fileName}
                </a>
              ) : (
                <span className="font-medium">{item.fileName}</span>
              )}
              {item.description ? (
                <p className="mt-1 text-[var(--slate-500)]">{item.description}</p>
              ) : null}
              {fecha ? <p className="mt-1 text-xs text-[var(--slate-500)]">{fecha}</p> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
