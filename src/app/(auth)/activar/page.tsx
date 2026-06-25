import { Suspense } from "react";

import { ActivateAccountForm } from "@/components/features/auth/activate-account-form";

export default function ActivarPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--slate-200)] bg-white p-6">
          Validando invitación…
        </div>
      }
    >
      <ActivateAccountForm />
    </Suspense>
  );
}
