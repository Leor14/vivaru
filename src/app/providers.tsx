"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-context";
import { ErrorTracker } from "@/components/observability/ErrorTracker";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePathname = typeof pathname === "string" ? pathname : "";
  const isResilientPublicRoute =
    safePathname.startsWith("/setup-error") || safePathname.startsWith("/unauthorized");

  if (isResilientPublicRoute) {
    return (
      <>
        <ErrorTracker />
        {children}
        <Toaster richColors position="top-center" />
      </>
    );
  }

  return (
    <AuthProvider>
      <ErrorTracker />
      {children}
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
