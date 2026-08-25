"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown, Search } from "lucide-react";

import { useAuth } from "@/features/auth/auth-context";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { isTenantWritable } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * **El selector de conjunto de `PRD-V-PLAT-002` §5.2.**
 *
 * Se pinta **solo** con dos membresías o más. Con una —que es el caso de todos
 * los usuarios de hoy— devuelve `null` y no existe: es la condición de CA1, y
 * la razón de que esta entrega no pueda romper a nadie.
 *
 * **Elegir aquí no da acceso a nada.** El conjunto activo es estado de sesión,
 * no una autorización: las reglas de Firestore y las seis callables del dinero
 * vuelven a comprobar la membresía en cada operación (CF1, CF3). Por eso el
 * cambio puede vivir en el cliente sin una callable detrás.
 *
 * Va en la cabecera de la barra lateral, debajo del nombre del conjunto, porque
 * §12 pide que **el conjunto activo esté siempre visible**: el riesgo real de
 * esta funcionalidad no es un acceso indebido, es crear un cargo en el conjunto
 * equivocado por no saber en cuál estás.
 */
export function TenantSwitcher({ className }: { className?: string }) {
  const { user, switchTenant } = useAuth();
  const habilitada = useFeatureFlag("producto-multiconjunto");

  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cajaRef = useRef<HTMLDivElement | null>(null);

  const membresias = useMemo(() => user?.memberships ?? [], [user?.memberships]);

  const visibles = useMemo(() => {
    const texto = filtro.trim().toLowerCase();
    if (!texto) return membresias;
    return membresias.filter((m) => (m.tenantName ?? m.tenantId).toLowerCase().includes(texto));
  }, [membresias, filtro]);

  useEffect(() => {
    if (!abierto) return;
    function alPulsarFuera(evento: MouseEvent) {
      if (cajaRef.current && !cajaRef.current.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alPulsarFuera);
    return () => document.removeEventListener("mousedown", alPulsarFuera);
  }, [abierto]);

  const esAdmin = user?.role === "tenant_admin" || user?.role === "admin_tenant";
  if (!habilitada || !user || !esAdmin || membresias.length < 2) return null;

  const activo = membresias.find((m) => m.tenantId === user.tenantId);
  const nombreActivo = activo?.tenantName ?? user.tenantName ?? user.tenantId ?? "Sin conjunto";

  // El buscador solo aparece cuando la lista deja de caber de un vistazo. La
  // cuenta de administradora que se midió en el inventario lleva dieciséis.
  const conBuscador = membresias.length > 5;

  async function cambiar(tenantId: string) {
    setError(null);
    setCambiando(tenantId);
    try {
      await switchTenant(tenantId);
      // No se cierra el menú ni se limpia el estado: `switchTenant` recarga la
      // página entera, que es lo que garantiza que no sobreviva ningún dato del
      // conjunto anterior (CA4).
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No fue posible cambiar de conjunto.");
      setCambiando(null);
    }
  }

  return (
    <div ref={cajaRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setAbierto((previo) => !previo)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        aria-label={`Conjunto activo: ${nombreActivo}. Cambiar de conjunto`}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-white/80" style={{ fontSize: 12 }}>
          {nombreActivo}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />
      </button>

      {abierto ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-[var(--slate-200)] bg-white p-2 shadow-lg"
        >
          <p className="px-2 pb-1 text-xs text-[var(--slate-500)]">
            {membresias.length} conjuntos
          </p>

          {conBuscador ? (
            <div className="relative mb-1">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--slate-400)]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={filtro}
                onChange={(evento) => setFiltro(evento.target.value)}
                placeholder="Buscar conjunto"
                aria-label="Buscar conjunto"
                className="w-full rounded-lg border border-[var(--slate-200)] py-1.5 pl-7 pr-2 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-300)]"
              />
            </div>
          ) : null}

          {visibles.length === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--slate-500)]">Ningún conjunto coincide.</p>
          ) : null}

          {visibles.map((membresia) => {
            const esActivo = membresia.tenantId === user.tenantId;
            const soloLectura = membresia.status ? !isTenantWritable(membresia.status) : false;
            return (
              <button
                key={membresia.tenantId}
                type="button"
                role="option"
                aria-selected={esActivo}
                disabled={cambiando !== null}
                onClick={() => void cambiar(membresia.tenantId)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  esActivo ? "bg-[var(--slate-100)]" : "hover:bg-[var(--slate-50)]",
                  cambiando !== null && !esActivo ? "opacity-50" : "",
                )}
              >
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  {esActivo ? <Check className="h-4 w-4 text-[var(--brand-600)]" aria-hidden="true" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[var(--slate-900)]">
                    {membresia.tenantName ?? membresia.tenantId}
                  </span>
                  {/* CA10: cada conjunto lleva su propio estado y no lo hereda
                      de la administradora. Decirlo aquí evita descubrirlo al
                      intentar cobrar. */}
                  {soloLectura ? (
                    <span className="block text-xs text-[var(--slate-500)]">
                      {membresia.status === "expired" ? "Prueba vencida · solo lectura" : "Suspendido · solo lectura"}
                    </span>
                  ) : null}
                  {cambiando === membresia.tenantId ? (
                    <span className="block text-xs text-[var(--slate-500)]">Cambiando…</span>
                  ) : null}
                </span>
              </button>
            );
          })}

          {error ? (
            <p role="alert" className="mt-1 px-2 py-1 text-xs text-[var(--danger-700)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
