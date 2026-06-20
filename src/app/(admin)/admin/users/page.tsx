"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/auth-context";
import { db } from "@/lib/firebase/client";
import { createTenantOperationalUserCallable } from "@/lib/firebase/callables";

type TenantUserItem = {
  id: string;
  fullName?: string;
  email?: string;
  role?: "tenant_admin" | "security_guard" | string;
  status?: "active" | "inactive" | string;
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TenantUserItem[]>([]);
  const [loading, setLoading] = useState(Boolean(user?.tenantId));
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"tenant_admin" | "security_guard">("security_guard");

  useEffect(() => {
    if (!user?.tenantId || !db) {
      setLoading(false);
      return;
    }

    const usersQuery = query(collection(db, "users"), where("tenantId", "==", user.tenantId));
    const unsub = onSnapshot(
      usersQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<TenantUserItem, "id">) }));
        setItems(rows);
        setLoading(false);
      },
      (error) => {
        console.error("[admin-users] query failed", error);
        toast.error("No fue posible cargar los usuarios del tenant.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.tenantId]);

  const managedUsers = useMemo(
    () => items.filter((item) => item.role === "tenant_admin" || item.role === "security_guard"),
    [items],
  );

  const pager = usePagination(managedUsers);

  async function handleCreateUser() {
    if (!user?.tenantId) {
      toast.error("No se pudo identificar tu tenant.");
      return;
    }

    if (!fullName.trim() || !email.trim()) {
      toast.error("Completa nombre y correo.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailOk) {
      toast.error("Ingresa un correo con formato válido.");
      return;
    }

    try {
      setSaving(true);
      await createTenantOperationalUserCallable({
        tenantId: user.tenantId,
        fullName,
        email: normalizedEmail,
        role,
        status: "active",
      });

      // El backend genera el enlace y envía el correo (Resend, marca Vivaru).
      toast.success("Usuario creado. Se le envió un correo para definir su contraseña.");

      setFullName("");
      setEmail("");
      setRole("security_guard");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardTitle help="Administra quién tiene acceso al panel de administración. Mantener el listado de usuarios actualizado es una práctica de seguridad esencial: solo quienes realmente lo necesitan deben tener acceso operativo al conjunto.">Administración / Usuarios</CardTitle>
        <CardDescription className="mt-1">
          Crea usuarios operativos del tenant con rol Admin o Guarda de seguridad.
        </CardDescription>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input label="Nombre" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="María García" />
          <Input label="Correo electrónico" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@ejemplo.com" type="email" autoComplete="email" />
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3 text-sm text-[var(--slate-700)] md:col-span-2">
            Al crear el usuario se le enviará un correo para que defina su propia contraseña. No se asignan contraseñas manuales.
          </div>
          <div>
            <label className="block text-sm text-[var(--slate-700)]">
              Rol
              <select
                className="mt-1 block h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as "tenant_admin" | "security_guard")}
              >
                <option value="tenant_admin">Admin</option>
                <option value="security_guard">Guarda de seguridad</option>
              </select>
            </label>
          </div>
        </div>

        <Button className="mt-4" onClick={() => void handleCreateUser()} disabled={saving}>
          {saving ? "Creando..." : "Crear usuario"}
        </Button>
      </Card>

      <Card>
        <CardTitle>Usuarios del tenant</CardTitle>
        <CardDescription className="mt-1">Listado de usuarios operativos activos e inactivos.</CardDescription>

        {/* Mobile: card list */}
        <div className="mt-4 space-y-2 sm:hidden">
          {loading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--slate-200)] px-4 py-3 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48" />
                  <div className="flex items-center gap-2 pt-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </>
          ) : managedUsers.length === 0 ? (
            <p className="py-4 text-sm text-[var(--slate-500)]">No hay usuarios operativos registrados.</p>
          ) : (
            pager.pageItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-[var(--slate-200)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--slate-900)]">{item.fullName ?? "-"}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--slate-500)]">{item.email ?? "-"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-[var(--slate-600)]">
                    {item.role === "security_guard" ? "Guarda de seguridad" : "Admin"}
                  </span>
                  <StatusBadge status={item.status === "inactive" ? "inactive" : "active"} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <div className="mt-4 hidden overflow-x-auto rounded-xl border border-[var(--slate-200)] sm:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Correo</th>
                <th className="px-3 py-2">Rol</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <tr key={i} className="border-t border-[var(--slate-200)]">
                      <td className="px-3 py-2"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-44" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-3 py-2"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    </tr>
                  ))}
                </>
              ) : null}

              {!loading && managedUsers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-[var(--slate-600)]" colSpan={4}>No hay usuarios operativos registrados.</td>
                </tr>
              ) : null}

              {!loading && pager.pageItems.map((item) => (
                <tr key={item.id} className="border-t border-[var(--slate-200)]">
                  <td className="px-3 py-2 font-medium text-[var(--slate-900)]">{item.fullName ?? "-"}</td>
                  <td className="px-3 py-2">{item.email ?? "-"}</td>
                  <td className="px-3 py-2">
                    {item.role === "security_guard" ? "Guarda de seguridad" : "Admin"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status === "inactive" ? "inactive" : "active"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pager.hasPagination ? (
          <TablePager
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            start={pager.start}
            pageSize={pager.pageSize}
            onPrev={pager.prev}
            onNext={pager.next}
          />
        ) : null}
      </Card>
    </section>
  );
}
