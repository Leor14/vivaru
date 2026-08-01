"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ExternalLink, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { useTenantTrial } from "@/features/tenant/use-tenant-trial";
import { db } from "@/lib/firebase/client";

type DemoAccount = { role: string; email: string; password: string };

const ROLE_META: Record<string, { label: string; portal: string; hint: string }> = {
  resident: {
    label: "Residente",
    portal: "/resident",
    hint: "Así ve tu conjunto un residente: sus visitas, paquetes, comunicados y reservas.",
  },
  security_guard: {
    label: "Portería",
    portal: "/guard",
    hint: "Así opera la portería: registro de visitas y entrega de paquetes.",
  },
};

/**
 * "Mis cuentas de prueba" — la pieza central de la Regla B del self-service.
 *
 * Son cuentas TÉCNICAS del propio administrador, no correos de personas
 * reales: le permiten recorrer el portal del residente y el de portería **sin
 * crear un residente de verdad ni compartirle su contraseña a nadie**. Solo
 * existen durante la prueba.
 */
export function DemoAccountsCard() {
  const { user } = useAuth();
  const trial = useTenantTrial(user?.tenantId);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.tenantId || !db) return;
    const unsub = onSnapshot(
      doc(db, "tenantDemoAccounts", user.tenantId),
      (snap) => {
        const raw = snap.data()?.demoAccounts;
        setAccounts(Array.isArray(raw) ? (raw as DemoAccount[]) : []);
      },
      () => setAccounts([]),
    );
    return () => unsub();
  }, [user?.tenantId]);

  // Solo tiene sentido durante la prueba: al convertir, el conjunto opera con
  // usuarios reales.
  if (!trial.isTrial && !trial.isExpired) return null;
  if (accounts.length === 0) return null;

  return (
    <Card className="p-5">
      <CardTitle>Mis cuentas de prueba</CardTitle>
      <CardDescription className="mt-1">
        Entra con estas cuentas para ver cómo se vive Vivaru desde el otro lado. Son tuyas y no
        pertenecen a ninguna persona real, así que no necesitas invitar a nadie todavía.
      </CardDescription>

      <ul className="mt-4 space-y-3">
        {accounts.map((account) => {
          const meta = ROLE_META[account.role] ?? { label: account.role, portal: "/login", hint: "" };
          const show = revealed[account.role] ?? false;
          return (
            <li key={account.role} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--slate-900)]">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--slate-600)]">{meta.hint}</p>
                  <dl className="mt-2 space-y-0.5 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-[var(--slate-500)]">Correo:</dt>
                      <dd className="break-all font-mono text-[var(--slate-800)]">{account.email}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <dt className="text-[var(--slate-500)]">Contraseña:</dt>
                      <dd className="font-mono text-[var(--slate-800)]">
                        {show ? account.password : "••••••••"}
                      </dd>
                      <button
                        type="button"
                        className="text-[var(--slate-500)] hover:text-[var(--slate-800)]"
                        onClick={() => setRevealed((prev) => ({ ...prev, [account.role]: !show }))}
                        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                      >
                        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </dl>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open("/login", "_blank", "noopener")}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Abrir portal
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-[var(--slate-500)]">
        Ábrelas en una ventana privada para no cerrar tu sesión de administrador.
      </p>
    </Card>
  );
}
