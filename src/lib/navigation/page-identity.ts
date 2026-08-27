import type { AdminSidebarGroup } from "@/components/shared/admin-sidebar";

import { resolveActiveNavHref } from "./active-item";

/**
 * **Quién es esta pantalla, deducido del menú que ya existe.**
 *
 * El producto no tenía forma de decir en qué pantalla estabas: el título de la
 * cabecera es constante *por rol* —el residente leía «Portal del Residente» en
 * sus doce pantallas— y el administrador no tenía cabecera en escritorio. Solo
 * cinco de las diecinueve pantallas del admin se nombraban a sí mismas, y lo
 * hacían desde un bloque de ayuda plegable.
 *
 * Esto lo resuelve **sin crear una lista nueva**: el nombre de cada pantalla y
 * el grupo al que pertenece ya están escritos en el menú lateral. Cualquier otra
 * fuente sería un sitio más que mantener, y en este repositorio eso ya salió
 * caro más de una vez.
 */
export type PageIdentity = {
  /** El grupo, solo cuando aporta algo. Ver `debeMostrarGrupo`. */
  group?: string;
  /** El nombre de la pantalla, tal y como lo dice el menú. */
  title: string;
};

/**
 * **El grupo solo se muestra si hay más de uno.**
 *
 * El administrador tiene seis grupos, así que «Financiero / Cartera» sitúa de
 * verdad. El residente, la portería, el consejo y el superadmin tienen **uno
 * solo** (`MI EDIFICIO`, `PORTERIA`, `COMITE`, `PLATAFORMA`): repetirlo en cada
 * pantalla no informa de nada y compite con el nombre que sí importa.
 *
 * Es una regla derivada, no una lista de excepciones por rol: el día que el
 * residente tenga dos grupos, la migaja aparece sola.
 */
function debeMostrarGrupo(groups: AdminSidebarGroup[]): boolean {
  return groups.filter((grupo) => grupo.label).length > 1;
}

/**
 * Las etiquetas del menú se guardan en mayúsculas porque así se pintan en la
 * barra lateral. En una migaja eso grita, así que se capitaliza —con el locale
 * del producto, que es el que sabe que `CONFIGURACIÓN` baja a `configuración`
 * sin perder la tilde—.
 */
function comoTextoCorrido(etiqueta: string): string {
  const minusculas = etiqueta.toLocaleLowerCase("es-CO");
  return minusculas.charAt(0).toLocaleUpperCase("es-CO") + minusculas.slice(1);
}

/**
 * Devuelve el grupo y el nombre de la pantalla activa, o `null` cuando la ruta
 * no corresponde a ninguna entrada del menú.
 *
 * **`null` no es un fallo**: pasa en rutas legítimas que no son de menú —una
 * ficha de detalle bajo una lista, por ejemplo— y quien llama debe tener un
 * respaldo. Devolver un título inventado sería peor que no devolver ninguno.
 *
 * Una sub-ruta más profunda que una entrada del menú **hereda su nombre**:
 * estando en `/admin/finanzas/egresos/xyz` la pantalla sigue siendo «Egresos»,
 * que es cierto y es lo que dice el ítem marcado en el menú.
 */
export function resolvePageIdentity(
  pathname: string,
  groups: AdminSidebarGroup[],
): PageIdentity | null {
  const hrefs = groups.flatMap((grupo) => grupo.items.map((item) => item.href));
  const activo = resolveActiveNavHref(pathname, hrefs);
  if (!activo) return null;

  for (const grupo of groups) {
    const item = grupo.items.find((candidato) => candidato.href === activo);
    if (!item) continue;

    return grupo.label && debeMostrarGrupo(groups)
      ? { group: comoTextoCorrido(grupo.label), title: item.label }
      : { title: item.label };
  }

  return null;
}
