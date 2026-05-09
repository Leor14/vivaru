"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-workspace-error-boundary]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <section className="space-y-4">
      <Card>
        <CardTitle>No pudimos cargar el workspace de administración</CardTitle>
        <CardDescription className="mt-1">
          Ocurrio un error inesperado en la interfaz de /admin. Puedes reintentar ahora o volver al inicio del modulo.
        </CardDescription>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Reintentar
          </Button>
          <Link href="/admin">
            <Button type="button" variant="outline">
              Ir al dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
