"use client";

import { useEffect, useState } from "react";
import { doc, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import {
  codigoPadreDe,
  compararCodigos,
  docIdDeCuenta,
  validarCodigoDeCuenta,
} from "@/lib/finanzas/codigo-de-cuenta";

/**
 * El plan de cuentas del conjunto (`PRD-V-PLAT-003`, entrega 2).
 *
 * La semilla ya la escribe el alta desde 1b-ii (`functions/src/plan-de-cuentas-siembra.ts`);
 * esto es lo que deja al administrador **mantenerlo**: añadir, renombrar y
 * desactivar. Detrás de `producto-plan-de-cuentas`.
 *
 * ## Tres decisiones que no son obvias
 *
 * **1. No hay borrado, y no es una omisión.** El flujo de §5.1 tiene tres
 * acciones —añadir, renombrar, desactivar— y ninguna es borrar. R5 dice que una
 * cuenta con movimientos se desactiva, y las reglas **no pueden comprobar** si
 * los tiene: eso exige consultar `ledgerEntries`. Con un botón de borrar habría
 * que preguntarlo desde el cliente y confiar en la respuesta. Sin él, CF3 y CF4
 * son inalcanzables desde la interfaz, y la regla sigue vetando el borrado de
 * las cuentas de sistema por si alguien llega por otra vía.
 *
 * **2. Crear va en TRANSACCIÓN, no en `setDoc`.** El id es derivado del código,
 * así que un `setDoc` sobre un código que ya existe **no falla: sobrescribe**.
 * Y la regla de `update` lo dejaría pasar —el `code` coincide consigo mismo—,
 * de modo que «crear la 1.3» le cambiaría el nombre a la cuenta de multas y
 * podría dejarla sin `systemKey`, que es justo lo que R3 protege. La
 * transacción lee y se niega si ya está.
 *
 * **3. El padre se deduce del código, no se elige.** La jerarquía vive en el
 * propio código (D1, opción A). Un selector de cuenta padre permitiría colgar la
 * `1.3` de la `2` y dejar el código mintiendo sobre su sitio en el árbol.
 */

export type TipoDeCuenta = "ingreso" | "egreso";

export type ChartAccount = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: TipoDeCuenta;
  parentCode?: string;
  /** Solo en las sembradas. Es el puente con `LedgerCategory` — y lo que hace de sistema a una cuenta. */
  systemKey?: string;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

/** Una cuenta de sistema no se borra ni se renumera (R3). Renombrarla sí. */
export function esCuentaDeSistema(cuenta: Pick<ChartAccount, "systemKey">): boolean {
  return Boolean(cuenta.systemKey);
}

export function useChartOfAccounts(tenantId?: string) {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTenantCollection<ChartAccount>(
      "chartOfAccounts",
      tenantId,
      (items) => {
        // Por código y numéricamente: como texto, la 1.10 se cuela antes de la 1.2.
        setAccounts([...items].sort((a, b) => compararCodigos(a.code, b.code)));
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  return { accounts, loading, error };
}

export type NuevaCuenta = { code: string; name: string; type: TipoDeCuenta };

/**
 * Las tres cosas que pueden fallar al crear, comprobadas **antes** de escribir y
 * **diciendo cuál** (CF5 pide exactamente eso: rechazar diciendo por qué).
 *
 * Se valida contra la lista ya suscrita, que es la misma que ve el formulario.
 * La unicidad de verdad la garantiza la transacción de `createAccount`; esto
 * existe para explicar, no para proteger.
 */
export function validarCuentaNueva(
  valores: NuevaCuenta,
  existentes: ChartAccount[],
): { ok: true; code: string; parentCode?: string } | { ok: false; error: string } {
  const nombre = valores.name.trim();
  if (nombre.length < 3) {
    return { ok: false, error: "El nombre de la cuenta necesita al menos 3 caracteres." };
  }

  const formato = validarCodigoDeCuenta(valores.code);
  if (!formato.ok) return formato;
  const code = formato.code;

  if (existentes.some((c) => c.code === code)) {
    return { ok: false, error: `Ya existe una cuenta con el código ${code} en este conjunto.` };
  }

  const parentCode = codigoPadreDe(code);
  if (parentCode) {
    const padre = existentes.find((c) => c.code === parentCode);
    if (!padre) {
      return {
        ok: false,
        error: `Para crear la ${code} tiene que existir antes la cuenta ${parentCode}.`,
      };
    }
    // Si el padre fuese de otro tipo, la cuenta quedaría contando un ingreso
    // bajo el total de egresos —o al revés— sin que nada lo dijera.
    if (padre.type !== valores.type) {
      return {
        ok: false,
        error: `La cuenta ${parentCode} es de ${padre.type}s, así que la ${code} no puede ser de ${valores.type}s.`,
      };
    }
  }

  return { ok: true, code, parentCode };
}

export async function createAccount(
  tenantId: string,
  userId: string,
  valores: NuevaCuenta,
  existentes: ChartAccount[],
): Promise<string> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  const validacion = validarCuentaNueva(valores, existentes);
  if (!validacion.ok) throw new Error(validacion.error);

  const { code, parentCode } = validacion;
  const ref = doc(db, "chartOfAccounts", docIdDeCuenta(tenantId, code));

  // Leer y escribir en la misma transacción. Ver la decisión 2 de la cabecera:
  // sin esto, «crear» una cuenta que ya existe la sobrescribe en silencio.
  await runTransaction(db, async (tx) => {
    const actual = await tx.get(ref);
    if (actual.exists()) {
      throw new Error(`Ya existe una cuenta con el código ${code} en este conjunto.`);
    }
    tx.set(ref, {
      tenantId,
      code,
      name: valores.name.trim(),
      type: valores.type,
      ...(parentCode ? { parentCode } : {}),
      status: "active",
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return ref.id;
}

/**
 * Renombrar. **El código no se toca nunca** (R4) y aquí no se puede ni por
 * error: vive en el id del documento, así que cambiarlo sería otro documento —y
 * la regla de `update` exige además que coincida—.
 *
 * Renombrar una cuenta de sistema SÍ se permite (R3): es la mitad de CA6.
 */
export async function renameAccount(id: string, userId: string, name: string) {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");
  const nombre = name.trim();
  if (nombre.length < 3) {
    throw new Error("El nombre de la cuenta necesita al menos 3 caracteres.");
  }
  await updateDoc(doc(db, "chartOfAccounts", id), {
    name: nombre,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * CF6 — una cuenta padre con hijas activas no se desactiva.
 *
 * Devuelve las hijas que lo impiden, para poder nombrarlas en el aviso en vez
 * de decir «no se puede» a secas.
 */
export function hijasActivasDe(cuenta: ChartAccount, todas: ChartAccount[]): ChartAccount[] {
  if (codigoPadreDe(cuenta.code)) return []; // ya es hija: la jerarquía es de un nivel
  return todas.filter((c) => c.parentCode === cuenta.code && c.status === "active");
}

export async function setAccountStatus(
  cuenta: ChartAccount,
  userId: string,
  status: "active" | "inactive",
  todas: ChartAccount[],
) {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");

  if (status === "inactive") {
    const hijas = hijasActivasDe(cuenta, todas);
    if (hijas.length > 0) {
      throw new Error(
        `Primero desactiva ${hijas.length === 1 ? "la cuenta" : "las cuentas"} ` +
          `${hijas.map((h) => h.code).join(", ")}, que cuelgan de esta.`,
      );
    }
  }

  await updateDoc(doc(db, "chartOfAccounts", cuenta.id), {
    status,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
}
