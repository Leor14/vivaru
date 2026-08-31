/**
 * **Detección de personas duplicadas en el padrón. Función pura y lectura: no escribe nada.**
 *
 * `PRD-V-FEAT-005`. El padrón de producción tenía **13 registros duplicados de 68** el 30 de
 * agosto de 2026, todos en `tenant-santa-maria`, y el producto no tenía forma de verlos: hoy solo
 * se evitan duplicados **en el momento del alta**, y blindar la puerta no limpia la casa.
 *
 * **No lleva IA, y decirlo es parte del trabajo:** las tres reglas de aquí encuentran los trece.
 * El hueco donde un modelo tendría que demostrar que aporta es la cola larga —«Ma. José» contra
 * «María José», apellidos invertidos, un dígito bailado—, y ahora se puede medir contra un suelo.
 */

export type ReglaDeDuplicado = "documento" | "correo" | "nombre";

/** Lo mínimo que hace falta para comparar. Deliberadamente menos que `PersonItem`. */
export type PersonaComparable = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  documentNumber?: string | null;
  /** Uid de la cuenta de acceso. Decide `R5`: ver `cuentasDistintas`. */
  authUid?: string | null;
  /** Marca de fusión previa. Un registro ya fusionado NO vuelve a la lista. */
  fusionadaEn?: unknown;
};

export type MotivoDeGrupo = { regla: ReglaDeDuplicado; valor: string };

export type GrupoDeDuplicados = {
  /**
   * **Huella de los ids implicados, y por eso caduca sola.** Un descarte se guarda contra esta
   * clave; si mañana entra un cuarto «David Carmona», la clave cambia y el grupo **vuelve a
   * salir**. Un descarte que silencia para siempre convierte la pantalla en un sitio donde los
   * problemas se esconden (`CA7`).
   */
  clave: string;
  /** Por qué el sistema cree que son la misma persona. Se enseña siempre (`R8`). */
  motivos: MotivoDeGrupo[];
  ids: string[];
};

/** Sin tildes, sin dobles espacios, sin mayúsculas. Un valor vacío no agrupa a nadie. */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CLAVES: { regla: ReglaDeDuplicado; de: (p: PersonaComparable) => string }[] = [
  { regla: "documento", de: (p) => normalizarTexto(p.documentNumber) },
  { regla: "correo", de: (p) => normalizarTexto(p.email) },
  { regla: "nombre", de: (p) => normalizarTexto(p.fullName) },
];

/** La huella del grupo: sus ids, ordenados. Estable entre corridas. */
export function claveDelGrupo(ids: readonly string[]): string {
  return [...ids].sort().join("·");
}

/**
 * Agrupa por coincidencia EXACTA de documento, correo o nombre normalizado.
 *
 * **Un grupo por clave de coincidencia, y NO por cierre transitivo.** Encadenar los grupos que
 * comparten a alguien parece más limpio y es peligroso: en producción, «David Cancelo» y «Luis
 * Otero» comparten el documento `65465465`, así que la transitividad los mete —junto a un tercer
 * «Luis»— en un mismo grupo de cuatro personas con dos nombres distintos. **Un duplicado se ve;
 * una fusión mala, no**, así que cada propuesta se queda pequeña y con su porqué delante (`R8`).
 *
 * Lo que sí se colapsa es un grupo **contenido en otro**: los siete «David Carmona» coinciden por
 * correo Y por nombre con el mismo conjunto de ids, y sus dos documentos distintos forman
 * subgrupos de 3 y 4 dentro. Enseñar eso como cuatro filas sería repetir el mismo problema cuatro
 * veces; se enseña como uno con sus motivos.
 *
 * **No mira `tenantId`:** el llamador pasa las personas de UN conjunto. Cruzar conjuntos no es un
 * grupo posible (`R2`) y la callable lo vuelve a comprobar, porque una regla del cliente no
 * protege nada.
 */
export function detectarDuplicados(personas: readonly PersonaComparable[]): GrupoDeDuplicados[] {
  // Un registro ya fusionado está archivado: si volviera a entrar, el grupo se reformaría solo
  // y la pantalla diría que el trabajo no se hizo.
  const vivas = personas.filter((p) => !p.fusionadaEn);

  const porClave = new Map<string, { motivo: MotivoDeGrupo; ids: string[] }>();
  for (const { regla, de } of CLAVES) {
    const cubos = new Map<string, string[]>();
    for (const persona of vivas) {
      const valor = de(persona);
      if (!valor) continue;
      cubos.set(valor, [...(cubos.get(valor) ?? []), persona.id]);
    }
    for (const [valor, ids] of cubos) {
      if (ids.length < 2) continue;
      porClave.set(`${regla}|${valor}`, { motivo: { regla, valor }, ids: [...ids].sort() });
    }
  }

  // Colapsar los contenidos en otro, quedándose con el mayor y acumulando los motivos.
  const candidatos = [...porClave.values()].sort((a, b) => b.ids.length - a.ids.length);
  const grupos: { ids: string[]; motivos: MotivoDeGrupo[] }[] = [];
  for (const candidato of candidatos) {
    const contenedor = grupos.find((g) => candidato.ids.every((id) => g.ids.includes(id)));
    if (contenedor) {
      contenedor.motivos.push(candidato.motivo);
      continue;
    }
    grupos.push({ ids: candidato.ids, motivos: [candidato.motivo] });
  }

  return grupos
    .map((g) => ({ clave: claveDelGrupo(g.ids), motivos: g.motivos, ids: g.ids }))
    .sort((a, b) => b.ids.length - a.ids.length || a.clave.localeCompare(b.clave));
}

/**
 * Las cuentas de acceso **distintas** dentro de un grupo (`R5`).
 *
 * **Distintas, no «cuántos registros tienen cuenta», y la diferencia la encontró medir.** En
 * producción, «Luis» y «Luis Otero» son dos registros de `people` que apuntan al **mismo** uid:
 * eso es una persona con la ficha duplicada y se fusiona sin problema. Contar registros con
 * `authUid` lo habría bloqueado como si fueran dos personas con acceso propio, que es justo el
 * caso que `R5` sí tiene que frenar.
 */
export function cuentasDistintas(personas: readonly PersonaComparable[]): string[] {
  return [...new Set(personas.map((p) => String(p.authUid ?? "").trim()).filter(Boolean))].sort();
}

export const ETIQUETA_DE_REGLA: Record<ReglaDeDuplicado, string> = {
  documento: "mismo documento",
  correo: "mismo correo",
  nombre: "mismo nombre",
};
