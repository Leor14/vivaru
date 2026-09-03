"use client";

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";

/**
 * `PRD-V-FLOW-007` entrega 2 — la lectura del informe mensual.
 *
 * **La lectura va DIRECTA y la escritura no.** Son consultas de lista con
 * `tenantId` y `status`, y eso las reglas lo protegen entero. Lo que no puede ir
 * directo es escribir: congelar cifras y sellar quién emitió no lo puede sostener
 * un campo que el cliente escribe. Las cuatro operaciones van por callable.
 *
 * **No hay `orderByField`**, a propósito. Es el patrón de `watchLedger` y
 * `watchDocuments`: pedir sin orden y ordenar en memoria. Un `orderBy` descarta
 * en silencio los documentos que no traen el campo, y una lista vacía se lee como
 * un dato y no como un error — el fallo mudo que ya tuvo la pantalla de
 * documentos del residente.
 */

export type EstadoDelInforme = "borrador" | "emitido" | "publicado" | "anulado";

export type LineaDelInforme = { code: string; label: string; amount: number };

export type MonthlyReport = {
  id: string;
  tenantId: string;
  /** `YYYY-MM`. */
  period: string;
  status: EstadoDelInforme;
  openingBalance: number;
  /**
   * **`ausente` no es `registrado: 0`**, y la pantalla los pinta distinto
   * (`CA4`, `RN-09`): un cero que alguien registró dice que el conjunto abrió sin
   * saldo; la ausencia de dato no dice nada, y escribir «$0» sería afirmarlo.
   */
  openingBalanceSource: "registrado" | "ausente";
  closingBalance: number;
  income: LineaDelInforme[];
  expenses: LineaDelInforme[];
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  receivables: { total: number; byUnit: { unitId: string; unitLabel: string; balance: number; periods: number }[] };
  payables: { total: number; overdue: number; byVendor: { vendorId?: string; vendorName: string; amount: number }[] };
  signatures?: { uid: string; name: string; role: string; signedAt?: { seconds: number } }[];
  issuedBy?: string;
  issuedAt?: { seconds: number };
  documentId?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: { seconds: number };
};

export const ROTULO_DEL_ESTADO: Record<EstadoDelInforme, string> = {
  borrador: "Borrador",
  emitido: "Emitido",
  publicado: "Publicado",
  anulado: "Anulado",
};

/**
 * Los informes del conjunto, **todos los estados**. Solo para la administración.
 *
 * **El consejo NO puede usar esta**: su regla lo restringe por el valor de
 * `status`, así que esta consulta —que no lo nombra— le sería rechazada entera.
 * La suya es `watchInformesEmitidos`, y ahí está explicado el mecanismo.
 */
export function watchMonthlyReports(
  tenantId: string,
  onData: (items: MonthlyReport[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<MonthlyReport>(
      "monthlyReports",
      tenantId,
      (items) => onData([...items].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""))),
      onError,
    ) ?? (() => {})
  );
}

/**
 * Los informes que el CONSEJO puede leer.
 *
 * **El `oneOf` no es cosmético: es lo que hace pasar la consulta.** La regla le
 * concede al `committee` solo los documentos cuyo `status` no es `borrador`, y
 * **Firestore evalúa la consulta contra la regla sin ejecutarla**: sin nombrar los
 * estados, la rechaza entera aunque no hubiera ni un borrador. Es la misma trampa
 * que `bankAccounts` con `active == true` y la de `documents` con las categorías.
 *
 * Y por eso la lista va aquí escrita y no derivada de `ROTULO_DEL_ESTADO`: tiene
 * que ser **exactamente** el complemento de lo que la regla veta, y un cambio en
 * la regla obliga a mirar esta línea.
 */
export function watchInformesEmitidos(
  tenantId: string,
  onData: (items: MonthlyReport[]) => void,
  onError: (message: string) => void,
) {
  return (
    subscribeTenantCollection<MonthlyReport>(
      "monthlyReports",
      tenantId,
      (items) => onData([...items].sort((a, b) => (b.period ?? "").localeCompare(a.period ?? ""))),
      onError,
      { oneOf: { field: "status", values: ["emitido", "publicado", "anulado"] as const } },
    ) ?? (() => {})
  );
}
