/**
 * `PRD-V-PLAT-002` entrega 2 · agrupa los conjuntos para la lista de «Conjuntos con
 * acceso» de la pestaña Admins.
 *
 * **La administradora es un ATAJO para marcar** (E2-D1, E2-R10): la consola ofrece
 * «Marcar los N de …» sobre cada grupo, pero no da acceso por sí misma ni sigue a los
 * conjuntos que se le asocien después. Por eso esto solo ordena lo que ya hay y no
 * inventa vínculos persona–administradora. Los conjuntos sueltos van al final.
 */
export type ConjuntoAgrupable = {
  id: string;
  name: string;
  managementCompanyId?: string;
  managementCompanyName?: string;
};

export type GrupoDeConjuntos<T extends ConjuntoAgrupable> = {
  administradora: { id: string; nombre: string } | null;
  conjuntos: T[];
};

export function agruparConjuntosPorAdministradora<T extends ConjuntoAgrupable>(conjuntos: T[]): GrupoDeConjuntos<T>[] {
  const porAdministradora = new Map<string, GrupoDeConjuntos<T>>();
  const sueltos: T[] = [];

  for (const conjunto of conjuntos) {
    const id = conjunto.managementCompanyId?.trim();
    if (!id) {
      sueltos.push(conjunto);
      continue;
    }
    const grupo = porAdministradora.get(id) ?? {
      administradora: { id, nombre: conjunto.managementCompanyName?.trim() || id },
      conjuntos: [],
    };
    grupo.conjuntos.push(conjunto);
    porAdministradora.set(id, grupo);
  }

  const porNombre = (a: T, b: T) => a.name.localeCompare(b.name, "es-CO");
  const grupos = [...porAdministradora.values()]
    .map((grupo) => ({ ...grupo, conjuntos: [...grupo.conjuntos].sort(porNombre) }))
    .sort((a, b) => (a.administradora?.nombre ?? "").localeCompare(b.administradora?.nombre ?? "", "es-CO"));

  if (sueltos.length > 0) grupos.push({ administradora: null, conjuntos: [...sueltos].sort(porNombre) });
  return grupos;
}
