"use client";

import { useState } from "react";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { MailCheck } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEmailError(null);

    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Ingresa un correo con formato válido.");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(value);
    } catch (error) {
      // Anti-enumeración: no revelamos si el correo existe o no.
      // Solo distinguimos un formato de correo inválido reportado por Firebase.
      if (error instanceof FirebaseError && error.code === "auth/invalid-email") {
        setEmailError("Ingresa un correo con formato válido.");
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <Card className="mx-auto w-full max-w-md p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-800)] uppercase tracking-wide">
          <MailCheck className="h-3.5 w-3.5" /> Revisa tu correo
        </p>
        <CardTitle className="mt-3">Si el correo está registrado, te enviamos instrucciones</CardTitle>
        <CardDescription className="mt-2">
          Te enviamos un enlace para restablecer tu contraseña a <strong>{email.trim().toLowerCase()}</strong>. Revisa también tu carpeta de spam. El enlace caduca por seguridad.
        </CardDescription>
        <Link className="mt-4 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/login">
          Volver a iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md p-6">
      <CardTitle>Recuperar contraseña</CardTitle>
      <CardDescription className="mt-2">
        Ingresa tu correo y te enviaremos un enlace para definir una nueva contraseña.
      </CardDescription>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <Input
          type="email"
          label="Correo"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError ?? undefined}
          disabled={submitting}
        />
        <Button className="w-full" type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar enlace de recuperación"}
        </Button>
      </form>

      <div className="mt-4 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3 text-sm text-[var(--slate-700)]">
        ¿Primer ingreso como residente? Si tu acceso fue activado por la administración, ingresa con tu correo y tu número de documento como clave temporal.
      </div>

      <Link className="mt-3 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/login">
        Volver a iniciar sesión
      </Link>
    </Card>
  );
}
