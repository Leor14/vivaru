"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

type ErrorLog = {
  id: string;
  message: string;
  stack: string | null;
  context: string | null;
  url: string | null;
  severity: "error" | "warning";
  uid: string | null;
  tenantId: string | null;
  role: string | null;
  createdAt: unknown;
};

function formatDate(value: unknown): string {
  try {
    const date = value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;
    if (!date) return "—";
    return date.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function SuperadminErrorsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoadError("Firestore no está configurado en este entorno.");
      setLoading(false);
      return;
    }
    const q = query(collection(db, "errorLogs"), orderBy("createdAt", "desc"), limit(200));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ErrorLog, "id">) })));
        setLoading(false);
      },
      (error) => {
        setLoadError(error.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const errorCount = useMemo(() => logs.filter((l) => l.severity !== "warning").length, [logs]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--slate-900)]">Errores del cliente</h2>
        <p className="mt-1 text-sm text-[var(--slate-500)]">
          Errores no controlados capturados en los portales (últimos 200). {errorCount} marcados como error.
        </p>
      </div>

      {loadError && (
        <Card>
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{loadError}</p>
        </Card>
      )}

      {!loading && logs.length === 0 && !loadError && (
        <EmptyState title="Sin errores registrados" description="No hay errores capturados todavía. Buena señal." />
      )}

      {logs.length > 0 && (
        <Card>
          <CardTitle help="Cada fila es un error no controlado (excepción suelta o promesa rechazada) reportado por el navegador de un usuario. Sirve para detectar fallos en producción sin depender de que el usuario los reporte.">Registro de errores</CardTitle>
          <CardDescription className="mt-1">Más recientes primero. Pasa el cursor sobre el mensaje para ver el detalle técnico.</CardDescription>
          <div className="responsive-table-wrap mt-3 rounded-xl border border-[var(--slate-200)]">
            <table className="responsive-table text-sm">
              <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Sev.</th>
                  <th className="px-3 py-2">Mensaje</th>
                  <th className="px-3 py-2">Origen</th>
                  <th className="px-3 py-2">Conjunto</th>
                  <th className="px-3 py-2">Rol</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--slate-200)] align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--slate-500)]">{formatDate(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${log.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                        {log.severity === "warning" ? "Aviso" : "Error"}
                      </span>
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <p className="font-medium text-[var(--slate-900)]" title={log.stack ?? undefined}>{log.message}</p>
                      {log.context && <p className="text-[11px] text-[var(--slate-400)]">{log.context}</p>}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-[var(--slate-500)]" title={log.url ?? undefined}>{log.url ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-[var(--slate-500)]">{log.tenantId ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-[var(--slate-500)]">{log.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
