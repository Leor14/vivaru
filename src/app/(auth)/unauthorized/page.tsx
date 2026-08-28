import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <Card className="mx-auto w-full max-w-2xl rounded-3xl border border-[var(--slate-200)] bg-white p-6 md:p-8">
      <p className="text-xs font-semibold tracking-wide text-[var(--brand-700)] uppercase">Acceso restringido</p>
      <CardTitle className="mt-2 text-2xl">No tienes permisos para abrir esta sección</CardTitle>
      <CardDescription className="mt-3 text-sm text-[var(--slate-700)]">
        Tu cuenta está activa, pero el perfil con el que entraste no da acceso a esta parte de Vivaru.
      </CardDescription>

      <div className="mt-5 rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-100)] p-4 text-sm text-[var(--slate-700)]">
        Si crees que deberías tener acceso, pídeselo al administrador de tu conjunto: puede revisar tu perfil
        desde Configuración → Usuarios.
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login">
          <Button>Volver al login</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Ir al inicio</Button>
        </Link>
      </div>
    </Card>
  );
}
