import Link from "next/link";

/**
 * Página 404 con marca Vivaru (reemplaza el "This page could not be found."
 * por defecto de Next.js). En español y con una salida clara de recuperación.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--surface-soft,#f7f8fc)] px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#3b4fd0] to-[#9b3df0] text-xl font-extrabold text-white">
          V
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--brand-700,#3b4fd0)]">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--slate-900,#0f172a)]">
          No encontramos esta página
        </h1>
        <p className="mt-2 text-sm text-[var(--slate-600,#475569)]">
          El enlace puede haber cambiado, caducado o no existir. Vuelve al inicio para continuar.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl bg-[var(--brand-700,#3b4fd0)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Volver al inicio
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center rounded-xl border border-[var(--slate-300,#cbd5e1)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--slate-800,#1e293b)] hover:bg-[var(--slate-100,#f1f5f9)]"
          >
            Ir al Panel de Control
          </Link>
        </div>
      </div>
    </main>
  );
}
