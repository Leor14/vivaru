import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <Card className="mx-auto w-full max-w-md p-6">
      <CardTitle>Recuperacion por correo deshabilitada</CardTitle>
      <CardDescription className="mt-2">
        Este proyecto usa restablecimiento administrado con clave temporal basada en documento.
      </CardDescription>
      <div className="mt-4 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3 text-sm text-[var(--slate-700)]">
        Solicita al administrador de tu copropiedad que restablezca tu acceso. Luego ingresa con tu correo y tu numero de documento como clave temporal.
      </div>
      <Link className="mt-3 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/login">
        Volver a iniciar sesion
      </Link>
    </Card>
  );
}
