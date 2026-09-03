import { Suspense } from "react";

import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-6">Cargando login...</div>}>
      <LoginForm />
    </Suspense>
  );
}
