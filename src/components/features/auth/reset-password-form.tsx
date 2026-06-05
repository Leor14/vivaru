"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase/client";

type Status = "verifying" | "ready" | "invalid" | "success";

function isStrong(pwd: string) {
  return (
    pwd.length >= 8 &&
    /[a-z]/.test(pwd) &&
    /[A-Z]/.test(pwd) &&
    /\d/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth || !oobCode || (mode && mode !== "resetPassword")) {
      setStatus("invalid");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((mail) => {
        setEmail(mail);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [mode, oobCode]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!isStrong(newPassword)) {
      setFormError("La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y símbolo.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    if (!auth || !oobCode) {
      setStatus("invalid");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus("success");
    } catch (error) {
      if (error instanceof FirebaseError && (error.code === "auth/expired-action-code" || error.code === "auth/invalid-action-code")) {
        setStatus("invalid");
        return;
      }
      setFormError(error instanceof Error ? error.message : "No fue posible actualizar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "verifying") {
    return (
      <Card className="mx-auto w-full max-w-md p-6">
        <CardTitle>Validando enlace…</CardTitle>
        <CardDescription className="mt-2">Un momento por favor.</CardDescription>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card className="mx-auto w-full max-w-md p-6">
        <CardTitle>El enlace no es válido o expiró</CardTitle>
        <CardDescription className="mt-2">
          Por seguridad, los enlaces caducan y solo se pueden usar una vez. Solicita uno nuevo desde la pantalla de inicio de sesión.
        </CardDescription>
        <Link className="mt-4 inline-block text-sm text-[var(--brand-700)] hover:underline" href="/forgot-password">
          Solicitar un nuevo enlace
        </Link>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="mx-auto w-full max-w-md p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-800)] uppercase tracking-wide">
          <CheckCircle2 className="h-3.5 w-3.5" /> Listo
        </p>
        <CardTitle className="mt-3">Tu contraseña quedó definida</CardTitle>
        <CardDescription className="mt-2">
          Ya puedes iniciar sesión con tu correo y tu nueva contraseña.
        </CardDescription>
        <Link className="mt-4 inline-block text-sm font-semibold text-[var(--brand-700)] hover:underline" href="/login">
          Ir a iniciar sesión
        </Link>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md p-6">
      <div className="mb-4 flex flex-col items-center text-center">
        <img src="/images/vivaru.jpeg" alt="Vivaru" className="mb-4 h-12 w-12 rounded-xl object-contain shadow-sm" />
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-800)] uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5" /> Define tu contraseña
        </p>
      </div>
      <CardTitle>Crea tu contraseña de Vivaru</CardTitle>
      <CardDescription className="mt-2">
        Para la cuenta <strong>{email}</strong>. Elige una contraseña segura para acceder al portal.
      </CardDescription>

      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <Input
          type="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={submitting}
        />
        <Input
          type="password"
          label="Confirmar nueva contraseña"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={formError ?? undefined}
          disabled={submitting}
        />
        <Button className="h-11 w-full" type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </Card>
  );
}
