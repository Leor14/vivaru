"use client";

export default function RouteError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-[var(--slate-900)]">Algo salió mal</h2>
      <p className="max-w-md text-center text-sm text-[var(--slate-600)]">
        Ocurrió un error inesperado. Puedes intentar recargar la página o volver al inicio.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-[var(--brand-700)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-800)]"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
