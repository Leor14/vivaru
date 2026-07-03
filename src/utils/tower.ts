/**
 * Normalización canónica de "Agrupación" (torre / bloque / manzana).
 *
 * Motivo: el campo nació como texto libre y conviven variantes del mismo valor
 * (`T1`, `torre 1`, `torre1`, `TORRE 1`) que fragmentan filtros y KPIs.
 * Esta función es la ÚNICA regla de canonización: se usa al crear/editar
 * unidades, al enumerar filtros y (en la migración) para consolidar data.
 */

/** Agrupación por defecto para conjuntos de un solo bloque. */
export const DEFAULT_TOWER = "Principal";

const PREFIXES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^t(?:orre)?[\s\-_]*(\d+)$/i, label: "Torre" },
  { pattern: /^b(?:loque)?[\s\-_]*([a-z0-9]+)$/i, label: "Bloque" },
  { pattern: /^m(?:anzana)?[\s\-_]*([a-z0-9]+)$/i, label: "Manzana" },
];

/** Conectores que en español van en minúscula dentro de un nombre propio. */
const CONNECTORS = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("es-CO")
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      if (index > 0 && CONNECTORS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("es-CO") + word.slice(1);
    })
    .join(" ");
}

/**
 * Devuelve la forma canónica de una agrupación:
 * - `t1` / `torre 1` / `TORRE-1` → `Torre 1`
 * - `bloque a` / `B-A` → `Bloque A`
 * - `manzana 3` → `Manzana 3`
 * - resto: espacios colapsados + Title Case (`TORRE CENTRAL` → `Torre Central`)
 * - vacío/nulo → `""` (el caller decide si aplica DEFAULT_TOWER)
 */
export function normalizeTower(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  for (const { pattern, label } of PREFIXES) {
    const match = trimmed.match(pattern);
    if (match) {
      const suffix = match[1];
      // Bloques/manzanas alfabéticos en mayúscula ("a" → "A"); numéricos tal cual.
      const canonical = /^\d+$/.test(suffix) ? suffix : suffix.toLocaleUpperCase("es-CO");
      return `${label} ${canonical}`;
    }
  }
  return titleCase(trimmed);
}

/** Lista de agrupaciones canónicas distintas presentes en un conjunto de valores. */
export function distinctTowers(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const canonical = normalizeTower(value);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }
  return result.sort((a, b) => a.localeCompare(b, "es-CO", { numeric: true }));
}
