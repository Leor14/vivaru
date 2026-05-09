"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePathname = typeof pathname === "string" ? pathname : "";
  const isResilientPublicRoute =
    safePathname.startsWith("/setup-error") || safePathname.startsWith("/unauthorized");

  if (isResilientPublicRoute) {
    return (
      <>
        {children}
        <Toaster richColors position="top-center" />
      </>
    );
  }

  return (
    <AuthProvider>
      {children}
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
