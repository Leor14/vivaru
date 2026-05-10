"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { canAccessPath, routeByRole } from "@/lib/auth/routing";

const schema = z.object({
  email: z.string().email("Correo invalido"),
  password: z.string().min(8, "Minimo 8 caracteres"),
  remember: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const { login, status, error, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
  });

  useEffect(() => {
    if (status === "misconfigured") {
      const reason = error ? `?reason=${encodeURIComponent(error)}` : "";
      router.replace(`/setup-error${reason}`);
      return;
    }

    if (status === "authenticated" && user) {
      if (user.role === "resident" && user.mustChangePassword) {
        router.replace("/resident/change-password-required");
        return;
      }
      router.replace(routeByRole(user.role));
    }
  }, [status, user, router, error]);

  async function onSubmit(values: FormValues) {
    console.info("[login-form] submit:start", { email: values.email });
    try {
      const session = await login(values.email, values.password);
      console.info("[login-form] submit:login-ok", {
        uid: session.uid,
        role: session.role,
        tenantId: session.tenantId,
        mustChangePassword: session.mustChangePassword,
      });

      if (session.role === "resident" && session.mustChangePassword) {
        router.push("/resident/change-password-required");
        return;
      }

      const nextPath = searchParams.get("next");

      if (nextPath && nextPath.startsWith("/") && canAccessPath(session.role, nextPath)) {
        console.info("[login-form] redirect:next", { nextPath });
        router.push(nextPath);
      } else {
        console.info("[login-form] redirect:role", { target: routeByRole(session.role) });
        router.push(routeByRole(session.role));
      }
    } catch (error) {
      console.error("[login-form] submit:error", error);
      toastFirebaseError(error);
    } finally {
      console.info("[login-form] submit:end");
    }
  }

  return (
    <section className="fixed inset-0 isolate overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/hogaru.png')",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-white/58 backdrop-blur-[1.5px]" aria-hidden />

      <div className="relative z-10 flex min-h-full items-center justify-center p-4 sm:p-6">
        <Card className="soft-panel w-full max-w-[460px] rounded-2xl border border-[var(--slate-200)] bg-white p-7 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-9 md:p-10">
        <div className="mb-6 text-left">
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
          <CardDescription className="mt-2">Accede con tu correo para continuar</CardDescription>
        </div>

        {status === "profile_error" ? (
          <div className="mb-4 rounded-xl border border-[var(--danger-600)]/30 bg-red-50 p-3 text-sm text-[var(--danger-700)]">
            {error ?? "Tu perfil no se pudo resolver. Contacta soporte de HOGARU."}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]" htmlFor="email">
              Correo
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              focusStyle="premium"
              {...register("email")}
            />
            {errors.email ? <p className="mt-1 text-xs text-[var(--danger-700)]">{errors.email.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]" htmlFor="password">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              focusStyle="premium"
              {...register("password")}
            />
            {errors.password ? <p className="mt-1 text-xs text-[var(--danger-700)]">{errors.password.message}</p> : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--slate-700)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--slate-300)] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[color:var(--brand-200)] focus-visible:ring-offset-1"
              {...register("remember")}
            />
            Recordar sesión
          </label>

          <Button className="h-12 w-full rounded-[10px]" type="submit" disabled={isSubmitting}>
            <LogIn className="mr-2 h-4 w-4" />
            {isSubmitting ? "Validando acceso..." : "Ingresar"}
          </Button>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-[var(--brand-800)] hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
        </Card>
      </div>
    </section>
  );
}
