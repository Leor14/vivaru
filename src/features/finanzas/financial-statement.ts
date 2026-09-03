/**
 * El estado financiero **del lado del navegador**.
 *
 * La aritmética ya no vive aquí: vive en `@/lib/finanzas/nucleo-estado-financiero`,
 * que tiene una copia byte a byte en `functions/src/` porque `src/` y `functions/`
 * no pueden importarse entre sí (CLAUDE.md). Este fichero es solo la fachada que
 * habla el idioma del cliente —`LedgerEntry`, `RecaudoDeCartera`— y traduce.
 *
 * **Por qué se movió** (`PRD-V-FLOW-007` entrega 1): `monthlyFinancialArchive`
 * reimplementaba el mismo resumen en línea y se desvió DOS veces sin que nada
 * fallara (R12/R13 y R16). Ver la cabecera del núcleo.
 */
import {
  categoryLabel,
  compararCodigos,
  construirEstadoFinanciero,
  esRecaudoDeCartera,
  type CategoryTotal,
  type EstadoFinanciero,
  type OrigenDelSaldoInicial,
  type PlanParaInformes,
} from "@/lib/finanzas/nucleo-estado-financiero";
import type { RecaudoDeCartera } from "@/lib/finanzas/conceptos-de-cargo";
import type { LedgerEntry } from "@/types/domain";

export { categoryLabel, esRecaudoDeCartera };
export type { CategoryTotal, OrigenDelSaldoInicial, PlanParaInformes };

/** El estado financiero tal y como lo consume la pantalla. */
export type FinancialStatement = EstadoFinanciero;

/**
 * El plan de cuentas, reducido a lo que un informe necesita (**R9** y **CA6**).
 *
 * ## La decisión que R9 no resuelve, y hay que tomar
 *
 * La regla dice «un informe agrupa por `accountCode`; si el asiento no lo tiene,
 * usa `category`». **Leído al pie de la letra parte en DOS filas lo que es una
 * sola cuenta:** los asientos escritos antes de `PLAT-003` caen en el cajón
 * `multa` y los de después en el `1.3`, con el mismo nombre y sumando por
 * separado. El estado financiero mostraría «Multas» dos veces.
 *
 * Y no se puede arreglar migrando: §4 dice que los asientos históricos **no se
 * recalculan**. Así que la categoría se **normaliza** a su código por
 * `systemKey`, que es para lo que ese puente existe. CA8 se sigue cumpliendo —el
 * asiento viejo sigue apareciendo— y además aparece **donde le toca**.
 *
 * ## Sin plan, nada cambia
 *
 * Un conjunto sin plan sembrado no tiene con qué resolver, así que cae en
 * `CATEGORY_LABELS` y se comporta como siempre. Y un plan recién sembrado trae
 * **los mismos nombres** que ese mapa —se eligieron así a propósito—, de modo
 * que encender esto no mueve un solo texto hasta que alguien renombre una
 * cuenta. Que es justo lo que pide CA6.
 */
export function planParaInformes(
  accounts: ReadonlyArray<{ code: string; name: string; systemKey?: string }>,
): PlanParaInformes | undefined {
  if (!accounts.length) return undefined;
  const codigoPorSystemKey = new Map<string, string>();
  const nombrePorCodigo = new Map<string, string>();
  for (const cuenta of accounts) {
    nombrePorCodigo.set(cuenta.code, cuenta.name);
    if (cuenta.systemKey) codigoPorSystemKey.set(cuenta.systemKey, cuenta.code);
  }
  return { codigoPorSystemKey, nombrePorCodigo };
}

/**
 * `buildFinancialStatement` — la fachada de siempre, ahora sobre el núcleo.
 *
 * Se conserva la firma POSICIONAL porque la usan cuarenta y tantos sitios entre
 * pantallas y pruebas, y cambiarla por un objeto en la misma entrega mezclaría
 * dos cosas: mover la aritmética y renombrar sus llamadas. Lo único que cambia
 * es el tercer argumento.
 *
 * **`openingBalance` pasó de `= 0` a opcional, y ese es el arreglo.** Con el
 * valor por defecto en cero, no pasar nada y registrar un saldo de cero eran
 * indistinguibles, y los tres consumidores pasaban `0` a mano sin haber leído
 * ningún saldo: `/admin/finanzas` avisaba «Fondo insuficiente… evita registrar
 * nuevos egresos» a un conjunto con dinero en el banco. `CA9`.
 *
 * Un `0` explícito sigue significando «registrado, y vale cero» — que es lo que
 * dicen dos de los cuatro conjuntos que tienen el documento.
 */
export function buildFinancialStatement(
  entries: LedgerEntry[],
  cuota: number | RecaudoDeCartera,
  openingBalance?: number,
  plan?: PlanParaInformes,
  partidas?: { pendingReceivables?: number; supplierDebt?: number },
): FinancialStatement {
  return construirEstadoFinanciero({
    asientos: entries,
    cuota: typeof cuota === "number" ? cuota : { total: cuota.total, porCategoria: cuota.porCategoria },
    openingBalance,
    plan,
    pendingReceivables: partidas?.pendingReceivables,
    supplierDebt: partidas?.supplierDebt,
  });
}

/** Reexportado para las pantallas que ordenan el plan; vive en el núcleo. */
export { compararCodigos };
