import type { AdminSidebarBadge, AdminSidebarGroup } from "@/components/shared/admin-sidebar";

/**
 * **Las dos reglas del menú plegable (pasada 2), fuera del componente para poder
 * probarlas.** Dentro de `AdminSidebar` solo se podrían mirar por el navegador, y
 * las dos protegen algo que se pierde en silencio si se rompe.
 */

/**
 * **Si el menú ofrece plegar, que es solo cuando hay más de un grupo.**
 *
 * Con un grupo único —el residente, la portería, el consejo, el superadmin— el
 * ítem activo está SIEMPRE dentro de él, y como el grupo activo nunca se pliega,
 * el control no haría nada nunca. Un chevron que no responde es peor que no
 * tenerlo: enseña una capacidad que no existe.
 *
 * Es la misma regla que decide la migaja en `page-identity.ts` —un grupo solo
 * informa si hay otro del que distinguirlo— y por eso se escribe igual aquí en
 * vez de listar los roles a mano.
 */
export function permitePlegarGrupos(groups: AdminSidebarGroup[]): boolean {
  return groups.filter((group) => group.label).length > 1;
}

/**
 * Si un grupo se pliega o no.
 *
 * **El grupo de la pantalla actual NUNCA se pliega**, aunque el administrador lo
 * hubiera plegado antes. Si se plegara, el ítem marcado desaparecería del menú y
 * con él la única señal de dónde está — que es justo el defecto que esta pasada
 * viene a arreglar, reintroducido por la puerta de atrás.
 *
 * El primer grupo no tiene etiqueta y por eso no se pliega: es el Panel de
 * Control, que queda siempre a la vista.
 */
export function debePlegarse(
  label: string | undefined,
  contieneActivo: boolean,
  guardado: Record<string, boolean>,
): boolean {
  if (!label) return false;
  if (contieneActivo) return false;
  return Boolean(guardado[label]);
}

/**
 * Los pendientes de un grupo, para subirlos a su cabecera cuando está plegado.
 *
 * Sin esto, plegar «Operativo» escondería los PQRS sin atender **sin decirlo**, y
 * un distintivo existe precisamente para que no haga falta abrir nada para verlo.
 * El tono se contagia hacia arriba: si alguno de dentro es rojo, el del grupo es
 * rojo — un pendiente urgente no se degrada por viajar con otros que no lo son.
 */
export function pendientesDelGrupo(
  group: AdminSidebarGroup,
  badges: Record<string, AdminSidebarBadge | undefined> | undefined,
): { count: number; tone: AdminSidebarBadge["tone"] } {
  let count = 0;
  let hayRojo = false;
  for (const item of group.items) {
    const badge = badges?.[item.href];
    if (!badge) continue;
    count += badge.count;
    if (badge.tone === "red") hayRojo = true;
  }
  return { count, tone: hayRojo ? "red" : "amber" };
}
