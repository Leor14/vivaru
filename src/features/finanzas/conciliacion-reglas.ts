import type { BankStatementLine, LedgerEntry } from "@/types/domain";

/**
 * `PRD-V-FLOW-004` — las reglas del expediente, **espejo del cliente**.
 *
 * **Espejo de `functions/src/conciliacion.ts`, duplicado a propósito porque
 * `src/` no puede importar de `functions/`** (rompe el build de App Hosting, ver
 * `CLAUDE.md`). **Si cambias uno, cambia el otro** — y el que manda es el del
 * servidor, porque es el único que escribe. Hay un guardián que falla si los dos
 * se separan: `functions/tests/conciliacion-espejo.test.ts`.
 *
 * **Para qué sirve la copia, ya que no decide nada:** para que la bandeja
 * ofrezca **solo** los movimientos que el servidor va a aceptar. Enseñar 74
 * candidatos y que el servidor rechace el elegido es la peor de las dos
 * conductas: la persona hace el trabajo dos veces y aprende a desconfiar del
 * mensaje. La comprobación de verdad sigue estando en la callable.
 */

/** Espejo de `TOLERANCIA_MONEDA` (`functions/src/payments.ts`). */
export const TOLERANCIA_MONEDA = 0.005;

/** Espejo de `VENTANA_DIAS`. Medido: el mayor desfase real entre pares buenos es 1 día. */
export const VENTANA_DIAS = 3;

export type MotivoCodigo =
  | "comision_bancaria"
  | "sin_contraparte"
  | "deposito_no_identificado"
  | "duplicado_del_extracto"
  | "error_de_carga"
  | "linea_eliminada"
  | "reverso_del_asiento"
  | "otro";

/** El catálogo, con el texto que ve quien concilia. Los dos últimos los pone el sistema. */
export const MOTIVOS_DE_RECHAZO: { codigo: MotivoCodigo; label: string }[] = [
  { codigo: "comision_bancaria", label: "Comisión o cargo del banco" },
  { codigo: "sin_contraparte", label: "No hay movimiento que le corresponda" },
  { codigo: "deposito_no_identificado", label: "Depósito sin identificar" },
  { codigo: "duplicado_del_extracto", label: "Está repetida en el extracto" },
  { codigo: "error_de_carga", label: "Error al cargar el extracto" },
  { codigo: "otro", label: "Otro motivo" },
];

export type EstadoCaso = "detectado" | "propuesto" | "aplicado" | "rechazado" | "reversado";
export type Incoherencia = "signo" | "monto" | "fecha" | "cuenta";

/** Cuánto dinero mueve un asiento, **con su signo**. Espejo de `efectoContable`. */
export function efectoContable(asiento: Pick<LedgerEntry, "type" | "amount">): number {
  const signo = asiento.type === "ingreso" ? 1 : -1;
  return signo * Number(asiento.amount ?? 0);
}

export function mismoEfecto(asiento: Pick<LedgerEntry, "type" | "amount">, linea: Pick<BankStatementLine, "amount">): boolean {
  return Math.abs(efectoContable(asiento) - Number(linea.amount ?? 0)) <= TOLERANCIA_MONEDA;
}

export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round(ms / 86_400_000));
}

export function dentroDeVentana(linea: Pick<BankStatementLine, "date">, asiento: Pick<LedgerEntry, "date">): boolean {
  return diasEntre(String(linea.date ?? ""), String(asiento.date ?? "")) <= VENTANA_DIAS;
}

/** Si el asiento declara cuenta, tiene que coincidir; si no la declara, no descarta. */
export function cuentaCompatible(
  linea: Pick<BankStatementLine, "bankAccountId">,
  asiento: Pick<LedgerEntry, "bankAccountId">,
): boolean {
  if (!asiento.bankAccountId) return true;
  return asiento.bankAccountId === linea.bankAccountId;
}

export type Descarte = "otro_conjunto" | "otra_cuenta" | "ya_conciliado" | "anulado" | "efecto" | "fecha";

export function porQueNoEsCandidato(linea: BankStatementLine, asiento: LedgerEntry): Descarte | null {
  if (asiento.tenantId !== linea.tenantId) return "otro_conjunto";
  if (!cuentaCompatible(linea, asiento)) return "otra_cuenta";
  if (asiento.reconciled) return "ya_conciliado";
  if (asiento.reversedByEntryId) return "anulado";
  if (!mismoEfecto(asiento, linea)) return "efecto";
  if (!dentroDeVentana(linea, asiento)) return "fecha";
  return null;
}

export function calcularCandidatos(linea: BankStatementLine, asientos: LedgerEntry[]): LedgerEntry[] {
  return asientos.filter((a) => porQueNoEsCandidato(linea, a) === null);
}

/**
 * **Con dos o más candidatos NO se propone.** Es R4, y no es prudencia: de las
 * ocho líneas pendientes de producción, **ninguna** tiene candidato único, así
 * que proponer «el más parecido» acertaría cero veces y sugeriría mal seis.
 */
export function clasificar(
  linea: BankStatementLine,
  asientos: LedgerEntry[],
): { status: "detectado" | "propuesto"; excepcion: "sin_contraparte" | "varios_candidatos" | null; candidatos: LedgerEntry[] } {
  const candidatos = calcularCandidatos(linea, asientos);
  if (candidatos.length === 1) return { status: "propuesto", excepcion: null, candidatos };
  return {
    status: "detectado",
    excepcion: candidatos.length === 0 ? "sin_contraparte" : "varios_candidatos",
    candidatos,
  };
}

/** Qué tiene de malo un emparejamiento que YA existe. **No lo corrige: lo nombra.** */
export function incoherenciasDelPar(linea: BankStatementLine, asiento: LedgerEntry): Incoherencia[] {
  const fallos: Incoherencia[] = [];
  const efecto = efectoContable(asiento);
  if (Math.sign(efecto) !== Math.sign(Number(linea.amount ?? 0))) fallos.push("signo");
  if (Math.abs(Math.abs(efecto) - Math.abs(Number(linea.amount ?? 0))) > TOLERANCIA_MONEDA) fallos.push("monto");
  if (!dentroDeVentana(linea, asiento)) fallos.push("fecha");
  if (!cuentaCompatible(linea, asiento)) fallos.push("cuenta");
  return fallos;
}

export const ETIQUETA_INCOHERENCIA: Record<Incoherencia, string> = {
  signo: "el banco y el libro van en sentidos contrarios",
  monto: "los importes no coinciden",
  fecha: "se llevan más de 3 días",
  cuenta: "son de cuentas bancarias distintas",
};

/**
 * **La normalización de la descripción, que es la mitad de R5.** Conserva letras
 * y dígitos, que es donde vive `T1-101` — el único discriminante entre seis SPEI
 * del mismo día por el mismo importe.
 */
export function normalizarDescripcion(raw: string | undefined | null): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function claveNatural(
  linea: Pick<BankStatementLine, "tenantId" | "bankAccountId" | "date" | "amount" | "description">,
): string {
  return [
    linea.tenantId,
    linea.bankAccountId,
    linea.date,
    Number(linea.amount ?? 0).toFixed(2),
    normalizarDescripcion(linea.description),
  ].join("|");
}

/**
 * El id del documento de la línea, derivado de su clave natural. **Espejo de
 * `idDeLinea`** — el servidor lo calcula con `node:crypto` y aquí va por Web
 * Crypto, pero el hash es el mismo SHA-256 sobre la misma cadena, y por eso las
 * dos partes coinciden en el id sin hablarse.
 *
 * Es asíncrono porque `crypto.subtle` lo es. Va por hash y no por la clave en
 * claro porque una descripción puede traer `/`, que partiría la ruta del
 * documento, y porque **el `tenantId` entra dentro**: dos conjuntos con la misma
 * línea no pueden colisionar, que es la trampa de que un id de documento es
 * global.
 */
export async function idDeLinea(
  linea: Pick<BankStatementLine, "tenantId" | "bankAccountId" | "date" | "amount" | "description">,
): Promise<string> {
  const datos = new TextEncoder().encode(claveNatural(linea));
  const buffer = await crypto.subtle.digest("SHA-256", datos);
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `bsl_${hex.slice(0, 32)}`;
}
