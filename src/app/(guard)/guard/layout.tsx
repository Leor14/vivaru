import { AppShell } from "@/components/shared/app-shell";

export default function GuardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="security_guard" title="Panel de Porteria">
      {children}
    </AppShell>
  );
}
