"use client";

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Error crítico</h2>
          <p style={{ textAlign: "center", maxWidth: "28rem", color: "#64748b" }}>
            La aplicación encontró un error. Por favor recarga la página.
          </p>
          <button
            onClick={reset}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", background: "#1e4d8c", color: "#fff", cursor: "pointer" }}
          >
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
