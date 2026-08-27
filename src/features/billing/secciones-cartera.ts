/**
 * **Los cuatro trabajos de Cartera (pasada 4 del corte de navegación).**
 *
 * `/admin/billing` medía **4,3 pantallas de scroll con doce bloques apilados**, y
 * esos doce bloques no son un trabajo: son cuatro. Mirar cómo va la cartera,
 * cobrar, seguir lo cobrado y cerrar el mes. Quien entraba a cerrar un período
 * pasaba por el formulario de crear cobros y por cinco listas para llegar.
 *
 * Las pestañas **pintan los mismos componentes que antes** — la pasada envuelve,
 * no reescribe— y la barra de vistas de lista que ya existía queda entera dentro
 * de «Seguimiento», sin tocarse.
 *
 * Esto es la parte pura, fuera de la página, para poder probarla.
 */

export type SeccionDeCartera = {
  key: "resumen" | "cobrar" | "seguimiento" | "cierre";
  label: string;
};

export const SECCIONES_CARTERA: readonly SeccionDeCartera[] = [
  { key: "resumen", label: "Resumen" },
  { key: "cobrar", label: "Cobrar" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "cierre", label: "Cierre" },
] as const;

export const CLAVES_SECCION_CARTERA = SECCIONES_CARTERA.map((seccion) => seccion.key);

/**
 * En `solo_consulta` **la cartera se administra fuera de Vivaru**: los bloques de
 * «Cobrar» y «Cierre» ya venían apagados por `!soloConsulta`, así que ofrecer sus
 * pestañas enseñaría dos pantallas vacías. Se retiran de la barra.
 */
const CLAVES_EN_SOLO_CONSULTA = new Set(["resumen", "seguimiento"]);

export function seccionesVisiblesDeCartera(soloConsulta: boolean): readonly SeccionDeCartera[] {
  return soloConsulta
    ? SECCIONES_CARTERA.filter((seccion) => CLAVES_EN_SOLO_CONSULTA.has(seccion.key))
    : SECCIONES_CARTERA;
}

/**
 * La sección que se pinta de verdad.
 *
 * Una URL con `?vista=cierre` sobre un conjunto de `solo_consulta` apunta a una
 * pestaña que no está en la barra: sin esto se vería **una pantalla vacía sin
 * decir por qué**, que es peor que abrir por donde abre siempre. Cae a «Resumen»,
 * igual que un valor desconocido.
 */
export function vistaEfectivaDeCartera(
  vista: SeccionDeCartera["key"],
  soloConsulta: boolean,
): SeccionDeCartera["key"] {
  return seccionesVisiblesDeCartera(soloConsulta).some((seccion) => seccion.key === vista)
    ? vista
    : "resumen";
}
