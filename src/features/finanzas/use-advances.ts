"use client";

import { useEffect, useState } from "react";

import {
  applyAdvanceCallable,
  cancelAdvanceCallable,
  undoAdvanceApplicationCallable,
} from "@/lib/firebase/callables";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { Advance, AdvanceApplication } from "@/types/domain";

/**
 * `PRD-V-FLOW-002` — lectura de anticipos. **Es la única parte del módulo que va
 * directa contra Firestore**: escribir pasa siempre por callable (§11.1).
 *
 * **Ninguna de estas consultas pide `orderBy`, y es a propósito.** Una consulta
 * con `orderByField` necesita su índice compuesto y EN LA DIRECCIÓN QUE PIDE:
 * tener `(tenantId, campo ASC)` no sirve para un `orderBy campo desc`. Eso es lo
 * que tuvo rotas cuatro pantallas hasta el 23 de agosto de 2026 con 1553 pruebas
 * en verde, porque el defecto vivía en un índice que solo existe en la nube y
 * ninguna prueba unitaria lo alcanza. Aquí se pide sin ordenar y se ordena en
 * memoria —el patrón de `watchLedger`, el único que nunca se rompió—, así que
 * `FLOW-002` no estrena ni un índice.
 */

/** Orden de lectura: lo más reciente arriba, y desempate estable por id. */
function porFechaDesc<T extends { id: string; date?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.id.localeCompare(b.id));
}

/**
 * Los anticipos del conjunto, o **los de una unidad** si se pasa `unitId`.
 *
 * El residente tiene que pasar el suyo: las reglas solo le conceden los de su
 * unidad, y una consulta sin ese filtro se rechaza entera —Firestore la evalúa
 * contra la regla sin ejecutarla— aunque el resultado fuera a ser el mismo.
 */
export function watchAdvances(
  tenantId: string,
  onData: (items: Advance[]) => void,
  onError: (message: string) => void,
  unitId?: string,
) {
  return (
    subscribeTenantCollection<Advance>(
      "advances",
      tenantId,
      (items) => onData(porFechaDesc(items)),
      onError,
      { equals: unitId ? [{ field: "unitId", value: unitId }] : undefined },
    ) ?? (() => {})
  );
}

/** Los cruces. Mismo criterio de filtro por unidad que `watchAdvances`. */
export function watchAdvanceApplications(
  tenantId: string,
  onData: (items: AdvanceApplication[]) => void,
  onError: (message: string) => void,
  unitId?: string,
) {
  return (
    subscribeTenantCollection<AdvanceApplication>(
      "advanceApplications",
      tenantId,
      (items) => onData(porFechaDesc(items)),
      onError,
      { equals: unitId ? [{ field: "unitId", value: unitId }] : undefined },
    ) ?? (() => {})
  );
}

export type AnticiposDelConjunto = {
  items: Advance[];
  aplicaciones: AdvanceApplication[];
  loading: boolean;
  error: string | null;
};

/**
 * Hook de conveniencia: anticipos y sus cruces a la vez.
 *
 * Los dos hacen falta juntos casi siempre — un anticipo sin sus cruces no puede
 * decir de dónde salió su remanente, y un cruce sin su anticipo no sabe de qué
 * unidad es.
 */
export function useAdvances(tenantId?: string, unitId?: string): AnticiposDelConjunto {
  const [items, setItems] = useState<Advance[]>([]);
  const [aplicaciones, setAplicaciones] = useState<AdvanceApplication[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setItems([]);
      setAplicaciones([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubA = watchAdvances(
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
      unitId,
    );
    const unsubB = watchAdvanceApplications(tenantId, setAplicaciones, () => setAplicaciones([]), unitId);
    return () => {
      unsubA();
      unsubB();
    };
  }, [tenantId, unitId]);

  return { items, aplicaciones, loading, error };
}

/**
 * El saldo a favor **disponible** de una unidad (CA2).
 *
 * Suma el remanente de los `open`, y solo de esos. Un `applied` tiene remanente
 * cero por definición y un `cancelled` puede tener el remanente a cero por
 * haberse anulado, **no por haberse gastado**: sumarlos sería contar dinero que
 * ya no está disponible.
 */
export function saldoAFavor(advances: readonly Advance[], unitId?: string): number {
  return advances
    .filter((a) => a.status === "open" && (!unitId || a.unitId === unitId))
    .reduce((total, a) => total + (typeof a.remaining === "number" ? a.remaining : 0), 0);
}

/** Los cruces vigentes de un anticipo: los que no se han deshecho. */
export function crucesVigentes(
  aplicaciones: readonly AdvanceApplication[],
  advanceId: string,
): AdvanceApplication[] {
  return aplicaciones.filter((a) => a.advanceId === advanceId && !a.reversedAt);
}

// ── Operaciones ──────────────────────────────────────────────────────────────
//
// Se reexportan tal cual, sin envolverlas en lógica. La `operationKey` la genera
// y la CONSERVA la pantalla que abre el formulario: generarla aquí, en cada
// llamada, anularía la protección contra el doble clic — que es toda su gracia.

export { applyAdvanceCallable, cancelAdvanceCallable, undoAdvanceApplicationCallable };
