import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export default function RestablecerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--slate-200)] bg-white p-6">
          Validando enlace…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
