import { AppShell } from "@/components/shared/app-shell";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="superadmin" title="Consola de Operación HOGARU">
      {children}
    </AppShell>
  );
}
