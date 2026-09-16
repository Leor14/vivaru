/**
 * **`L-11` — decir que la portería tiene su propio panel.**
 *
 * Lote «Análisis de la plataforma», plan `docs/plan-lote-analisis-plataforma.md` (T3.3). La
 * administradora pedía «dos perfiles», uno para ella y otro para la portería, y ya existen: el rol
 * de portería entra a `/guard`, que tiene Visitantes, Reservas y Paquetería. No se veía desde
 * estas pantallas. Es la clase «existe y no se ve» del modelo de priorización (v0.4, §3).
 */
export function NotaPanelDePorteria({ queHace }: { queHace: string }) {
  return (
    <p className="mt-2 text-xs leading-relaxed text-[var(--slate-500)]">
      <strong className="font-medium text-[var(--slate-700)]">La portería tiene su propio panel.</strong>{" "}
      Quien tenga el rol de portería entra con su cuenta y {queHace}.
    </p>
  );
}
