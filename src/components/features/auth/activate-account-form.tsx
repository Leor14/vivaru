"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAccountInviteCallable, activateAccountCallable } from "@/lib/firebase/callables";

type Status = "verifying" | "ready" | "blocked" | "success";

function isStrong(pwd: string) {
  return (
    pwd.length >= 8 &&
    /[a-z]/.test(pwd) &&
    /[A-Z]/.test(pwd) &&
    /\d/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

const BLOCKED_COPY: Record<string, { title: string; description: string }> = {
  invalid: {
    title: "Enlace no válido",
    description: "Este enlace de activación no es válido. Pídele a tu administrador que te reenvíe el acceso.",
  },
  expired: {
    title: "El enlace expiró",
    description: "Tu enlace de activación caducó. Pídele a tu administrador que te reenvíe el acceso.",
  },
  used: {
    title: "El enlace ya se usó",
    description: "Esta invitación ya fue utilizada. Si ya activaste tu cuenta, inicia sesión; si no, pide que te reenvíen el acceso.",
  },
};

export function ActivateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<Status>("verifying");
  const [blockedKey, setBlockedKey] = useState<string>("invalid");
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setBlockedKey("invalid");
      setStatus("blocked");
      return;
    }
    getAccountInviteCallable(token)
      .then((res) => {
        if (res.status === "valid") {
          setEmail(res.email ?? "");
          setFullName(res.fullName ?? "");
          setStatus("ready");
        } else {
          setBlockedKey(res.status);
          setStatus("blocked");
        }
      })
      .catch(() => {
        setBlockedKey("invalid");
        setStatus("blocked");
      });
  }, [token]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!isStrong(password)) {
      setFormError("La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y símbolo.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Las contraseñas no coinciden.");
      return;
    }

    setSubmitting(true);
    try {
      await activateAccountCallable({ token, password });
      setStatus("success");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No fue posible activar la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "verifying") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardDescription>Validando invitación…</CardDescription>
      </Card>
    );
  }

  if (status === "blocked") {
    const copy = BLOCKED_COPY[blockedKey] ?? BLOCKED_COPY.invalid;
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription className="mt-2">{copy.description}</CardDescription>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => router.push("/login")}>Ir a iniciar sesión</Button>
          <Button variant="outline" onClick={() => router.push("/forgot-password")}>
            ¿Olvidaste tu contraseña?
          </Button>
        </div>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-800)]">
          <CheckCircle2 className="h-4 w-4" /> Cuenta activada
        </p>
        <CardTitle className="mt-3">¡Listo, {fullName || "bienvenido"}!</CardTitle>
        <CardDescription className="mt-2">
          Tu contraseña quedó configurada. Ya puedes iniciar sesión con tu correo.
        </CardDescription>
        <Button className="mt-4" onClick={() => router.push("/login")}>
          Iniciar sesión
        </Button>
      </Card>
    );
  }

  // status === "ready"
  return (
    <Card className="mx-auto w-full max-w-md">
      <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-800)]">
        <ShieldCheck className="h-4 w-4" /> Activa tu cuenta
      </p>
      <CardTitle className="mt-3">Crea tu contraseña</CardTitle>
      <CardDescription className="mt-1">
        {email ? `Para ${email}. ` : ""}Elige una contraseña segura para entrar a Vivaru.
      </CardDescription>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-[var(--slate-700)]">
          Nueva contraseña
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--slate-700)]">
          Confirmar contraseña
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <p className="text-xs text-[var(--slate-500)]">
          Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.
        </p>
        {formError && (
          <p className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">{formError}</p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Activando…" : "Activar cuenta"}
        </Button>
      </form>
    </Card>
  );
}
