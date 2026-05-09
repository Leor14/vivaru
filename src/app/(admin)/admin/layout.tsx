import { AppShell } from "@/components/shared/app-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AppShell role="tenant_admin" title="Administración del Edificio">
        {children}
      </AppShell>
    </div>
  );
}
