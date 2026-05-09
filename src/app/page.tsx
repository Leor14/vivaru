import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#ffffff_0%,#f4f7fb_40%,#e5edf6_100%)]">
      <main className="mx-auto grid max-w-6xl gap-6 p-4 pb-16 md:grid-cols-2 md:p-8">
        <section className="rounded-3xl border border-[var(--slate-200)] bg-white p-6 shadow-[0_12px_30px_rgba(13,38,63,0.08)] md:p-8">
          <p className="text-sm font-medium tracking-wide text-[var(--brand-700)] uppercase">
            HOGARU SaaS Multi-tenant
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold text-[var(--brand-900)]">
            Operación residencial premium para propiedad horizontal en Colombia
          </h1>
          <p className="mt-4 text-[var(--slate-700)]">
            MVP listo para superadmin, administración y residentes: comunicaciones, cartera, reservas,
            visitantes, paquetería, PQRS y documentos.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/login">
              <Button>Entrar a HOGARU</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-[var(--slate-500)]">
            Proyecto Firebase configurado para `hogaru-1` mediante variables de entorno.
          </p>
        </section>

        <section className="grid gap-3">
          <Card>
            <CardTitle>Un login universal</CardTitle>
            <CardDescription className="mt-1">
              Un solo acceso para superadmin, administración y residentes. El sistema detecta el rol y redirige al workspace correcto.
            </CardDescription>
            <Link className="mt-4 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/login">
              Ir al login universal
            </Link>
          </Card>
          <Card>
            <CardTitle>Arquitectura por workspaces</CardTitle>
            <CardDescription className="mt-1">
              Layout, navegacion y permisos independientes para cada tipo de usuario.
            </CardDescription>
            <Link className="mt-4 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/login">
              Validar acceso
            </Link>
          </Card>
          <Card>
            <CardTitle>Sesion real con Firebase</CardTitle>
            <CardDescription className="mt-1">
              Fuente de verdad basada en Auth + perfil Firestore ({"`users/{uid}`"} + membresia tenant).
            </CardDescription>
            <Link className="mt-4 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/setup-error">
              Ver diagnostico tecnico
            </Link>
          </Card>
        </section>
      </main>
    </div>
  );
}
