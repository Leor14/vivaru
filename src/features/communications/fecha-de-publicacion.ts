/**
 * **`L-12` — la fecha de publicación de un comunicado, legible para el administrador.**
 *
 * Lote «Análisis de la plataforma», plan `docs/plan-lote-analisis-plataforma.md` (T3.4). La
 * plataforma la pone al publicar y el residente ya la ve; la tabla de Comunicaciones no la
 * enseñaba. Llega en formas distintas según quién escribió el documento: un `Timestamp` de
 * Firestore (`createCommunication` usa `serverTimestamp()` y `mapDoc` no lo convierte) o una cadena
 * ISO. Con el mismo formato que la pantalla del residente.
 */
export function fechaDePublicacion(valor: unknown): string | null {
  const fecha = aFecha(valor);
  if (!fecha) return null;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(fecha);
}

function aFecha(valor: unknown): Date | null {
  let fecha: Date | null = null;
  if (valor instanceof Date) fecha = valor;
  else if (typeof valor === "string" && valor) fecha = new Date(valor);
  else if (valor && typeof valor === "object") {
    const v = valor as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === "function") fecha = v.toDate();
    else if (typeof v.seconds === "number") fecha = new Date(v.seconds * 1000);
  }
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
}
