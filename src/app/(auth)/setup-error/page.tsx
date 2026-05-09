import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { missingFirebaseEnvKeys } from "@/lib/firebase/config";

export default async function SetupErrorPage({
  searchParams,
}: {
  searchParams?: Promise<{
    reason?: string;
  }>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const hasMissingKeys = missingFirebaseEnvKeys.length > 0;
  const reason = typeof resolvedParams?.reason === "string" ? resolvedParams.reason : null;

  return (
    <Card className="mx-auto w-full max-w-2xl rounded-3xl border border-[var(--danger-600)]/25 bg-white p-6 md:p-8">
      <p className="text-xs font-semibold tracking-wide text-[var(--danger-700)] uppercase">Error de configuración</p>
      <CardTitle className="mt-2 text-2xl">Firebase no esta configurado para este entorno</CardTitle>
      <CardDescription className="mt-3 text-sm text-[var(--slate-700)]">
        {hasMissingKeys
          ? "HOGARU no puede iniciar autenticacion real porque faltan variables de entorno del cliente Firebase."
          : "No se detectan variables faltantes en esta build; revisa variables NEXT_PUBLIC en App Hosting para BUILD y RUNTIME, y vuelve a desplegar."}
      </CardDescription>

      <div className="mt-5 rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-100)] p-4">
        {hasMissingKeys ? (
          <>
            <p className="text-sm font-medium text-[var(--slate-900)]">Variables faltantes:</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--slate-700)]">
              {missingFirebaseEnvKeys.map((key) => (
                <li key={key}>- {key}</li>
              ))}
            </ul>
          </>
        ) : (
          <div className="space-y-2 text-sm text-[var(--slate-700)]">
            <p>Diagnostico: las variables requeridas existen en el bundle, pero la inicializacion del cliente no fue valida en este entorno.</p>
            {reason ? <p className="font-medium text-[var(--slate-900)]">Detalle tecnico: {reason}</p> : null}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login">
          <Button>Reintentar login</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Volver al inicio</Button>
        </Link>
      </div>
    </Card>
  );
}
