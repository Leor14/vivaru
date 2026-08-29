import { createHash } from "node:crypto";

import { TOLERANCIA_MONEDA } from "./payments";

/**
 * `PRD-V-FLOW-004` — el núcleo de reglas del expediente de conciliación.
 *
 * **Este fichero es puro a propósito: no lee ni escribe Firestore.** Las reglas
 * que decide (qué es candidato, qué es duplicado, qué transición es válida) son
 * las que la ficha fijó **midiendo producción**, y tienen que poder probarse y
 * **falsarse** sin emulador. Las callables que las usan viven aparte.
 *
 * **Por qué existe, en una frase:** la pantalla de conciliación ofrecía todos
 * los asientos sin conciliar ordenados por cercanía de monto y `matchLine` no
 * comprobaba nada, así que en producción hay una salida de banco de −300.000
 * casada contra un ingreso de +40.000 — y el producto la cuenta como conciliada.
 */

// ── Constantes de las reglas ────────────────────────────────────────────────

/**
 * R3. **Medido, no elegido:** el mayor desfase entre pares coherentes reales de
 * producción es **1 día**; el par falso estaba a **6**. Tres deja aire para el
 * fin de semana sin volver a admitirlo.
 */
export const VENTANA_DIAS = 3;

/** R6. Catálogo CERRADO. Abrirlo antes de ver qué se usa es inventar complejidad. */
export const MOTIVOS = [
  "comision_bancaria",
  "sin_contraparte",
  "deposito_no_identificado",
  "duplicado_del_extracto",
  "error_de_carga",
  "linea_eliminada",
  "reverso_del_asiento",
  "otro",
] as const;
export type MotivoCodigo = (typeof MOTIVOS)[number];

export type EstadoCaso = "detectado" | "propuesto" | "aplicado" | "rechazado" | "reversado";

export type Incoherencia = "signo" | "monto" | "fecha" | "cuenta";

/** Lo mínimo que estas reglas necesitan de una línea de extracto. */
export type LineaDeBanco = {
  id: string;
  tenantId: string;
  bankAccountId: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  description?: string;
  /** Positivo = entra dinero; negativo = sale. */
  amount: number;
};

/** Lo mínimo que estas reglas necesitan de un asiento del libro. */
export type AsientoDelLibro = {
  id: string;
  tenantId: string;
  bankAccountId?: string | null;
  date: string;
  type: "ingreso" | "egreso";
  amount: number;
  reconciled?: boolean;
  reversedByEntryId?: string | null;
};

// ── R2 · La coherencia de efecto ────────────────────────────────────────────

/**
 * **El efecto contable de un asiento: cuánto dinero mueve, con su signo.**
 *
 * Es la regla que cierra el defecto, y no es «comparar valores absolutos» con
 * otro nombre. Dos motivos, y el segundo es el que no se ve venir:
 *
 * 1. Comparar `|monto|` casa una SALIDA de banco con una ENTRADA del libro. Es
 *    exactamente lo que pasó el 20 de agosto.
 * 2. **Un reverso lleva monto NEGATIVO conservando el tipo del asiento que
 *    anula** (`reverseLedgerEntry`: «mismo tipo, monto negativo»). En
 *    producción hay uno con `type: "ingreso"` y `amount: −1.120.000`: el dinero
 *    SALE. Mirar solo el `type` lo leería como una entrada.
 *
 * Verificado contra los datos antes de escribirlo: da coherentes **18 de los 19**
 * pares que existen, y el que no lo es, es el defecto.
 */
export function efectoContable(asiento: Pick<AsientoDelLibro, "type" | "amount">): number {
  const signo = asiento.type === "ingreso" ? 1 : -1;
  return signo * Number(asiento.amount);
}

/** Igualdad de dinero **con signo**, con la tolerancia que ya usa `payments.ts`. */
export function mismoEfecto(asiento: Pick<AsientoDelLibro, "type" | "amount">, linea: Pick<LineaDeBanco, "amount">): boolean {
  return Math.abs(efectoContable(asiento) - Number(linea.amount)) <= TOLERANCIA_MONEDA;
}

// ── R3 · La ventana de fecha ────────────────────────────────────────────────

/** Días de diferencia entre dos fechas ISO. Negativo o positivo da igual: se usa el valor absoluto. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round(ms / 86_400_000));
}

export function dentroDeVentana(linea: Pick<LineaDeBanco, "date">, asiento: Pick<AsientoDelLibro, "date">): boolean {
  return diasEntre(linea.date, asiento.date) <= VENTANA_DIAS;
}

// ── R1 · La cuenta bancaria, que NO descarta cuando falta ───────────────────

/**
 * **Si el asiento declara cuenta, tiene que coincidir; si no la declara, no
 * descarta.** Medido: **16 de los 93** asientos de producción no tienen
 * `bankAccountId` —4 de ellos manuales, y uno es la contraparte del par falso—.
 * Exigirla los dejaría fuera para siempre de cualquier conciliación, que es
 * peor que admitirlos y comprobarlos por monto y fecha.
 */
export function cuentaCompatible(linea: Pick<LineaDeBanco, "bankAccountId">, asiento: Pick<AsientoDelLibro, "bankAccountId">): boolean {
  if (!asiento.bankAccountId) return true;
  return asiento.bankAccountId === linea.bankAccountId;
}

// ── R1 · Candidato, y por qué no lo es ──────────────────────────────────────

export type Descarte = "otro_conjunto" | "otra_cuenta" | "ya_conciliado" | "anulado" | "efecto" | "fecha";

/**
 * Devuelve `null` si el asiento ES candidato, o el motivo del descarte.
 * **Devuelve el motivo y no un booleano a propósito:** la bandeja tiene que
 * poder decir por qué un asiento que la persona esperaba ver no está.
 */
export function porQueNoEsCandidato(linea: LineaDeBanco, asiento: AsientoDelLibro): Descarte | null {
  if (asiento.tenantId !== linea.tenantId) return "otro_conjunto";
  if (!cuentaCompatible(linea, asiento)) return "otra_cuenta";
  if (asiento.reconciled) return "ya_conciliado";
  if (asiento.reversedByEntryId) return "anulado";
  if (!mismoEfecto(asiento, linea)) return "efecto";
  if (!dentroDeVentana(linea, asiento)) return "fecha";
  return null;
}

export function esCandidato(linea: LineaDeBanco, asiento: AsientoDelLibro): boolean {
  return porQueNoEsCandidato(linea, asiento) === null;
}

export function calcularCandidatos(linea: LineaDeBanco, asientos: AsientoDelLibro[]): string[] {
  return asientos.filter((a) => esCandidato(linea, a)).map((a) => a.id);
}

// ── R4 · Clasificar: propuesta SOLO con candidato único ─────────────────────

export type Clasificacion = {
  status: Extract<EstadoCaso, "detectado" | "propuesto">;
  excepcion: "sin_contraparte" | "varios_candidatos" | null;
  candidateLedgerEntryIds: string[];
};

/**
 * **Con dos o más candidatos NO se propone.** Medido: ninguna de las 8 líneas
 * pendientes de producción tiene candidato único —seis son SPEI de 3.000 del
 * mismo día que solo se distinguen por el código de unidad del texto—, así que
 * proponer «el más parecido» habría acertado **cero veces** y sugerido mal seis.
 * Una propuesta que acierta la mitad de las veces es peor que ninguna: se
 * confirma sin mirar.
 */
export function clasificar(linea: LineaDeBanco, asientos: AsientoDelLibro[]): Clasificacion {
  const candidateLedgerEntryIds = calcularCandidatos(linea, asientos);
  if (candidateLedgerEntryIds.length === 1) {
    return { status: "propuesto", excepcion: null, candidateLedgerEntryIds };
  }
  return {
    status: "detectado",
    excepcion: candidateLedgerEntryIds.length === 0 ? "sin_contraparte" : "varios_candidatos",
    candidateLedgerEntryIds,
  };
}

// ── §5.4 · Nombrar lo que ya está escrito, sin reescribirlo ─────────────────

/**
 * Qué tiene de malo un emparejamiento que YA existe. **No lo corrige**: el
 * criterio de `roadmap-finance` §9 es que los datos de conjuntos de ejemplo no
 * se tocan hasta que entre un pago real. El expediente les pone nombre.
 */
export function incoherenciasDelPar(linea: LineaDeBanco, asiento: AsientoDelLibro): Incoherencia[] {
  const fallos: Incoherencia[] = [];
  const efecto = efectoContable(asiento);
  if (Math.sign(efecto) !== Math.sign(Number(linea.amount))) fallos.push("signo");
  if (Math.abs(Math.abs(efecto) - Math.abs(Number(linea.amount))) > TOLERANCIA_MONEDA) fallos.push("monto");
  if (!dentroDeVentana(linea, asiento)) fallos.push("fecha");
  if (!cuentaCompatible(linea, asiento)) fallos.push("cuenta");
  return fallos;
}

// ── R5 · Duplicados del extracto ────────────────────────────────────────────

/**
 * Minúsculas, sin acentos, sin signos y con los espacios colapsados. La
 * descripción es lo único que separa seis SPEI idénticos del mismo día, así que
 * normalizarla de más borraría el discriminante: se conservan los dígitos y las
 * letras, que es donde vive `T1-101`.
 */
export function normalizarDescripcion(raw: string | undefined | null): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * **La descripción va DENTRO de la clave, y es la mitad de la regla.** Medido
 * sobre las 27 líneas de producción: sin ella salen **4 grupos de duplicados
 * que suman 20 líneas legítimas** —los SPEI del mismo día por el mismo importe—;
 * con ella, **cero**. Una clave que marca duplicado lo que no lo es hace que
 * nadie vuelva a mirar la lista.
 */
export function claveNatural(linea: Pick<LineaDeBanco, "tenantId" | "bankAccountId" | "date" | "amount" | "description">): string {
  return [
    linea.tenantId,
    linea.bankAccountId,
    linea.date,
    Number(linea.amount).toFixed(2),
    normalizarDescripcion(linea.description),
  ].join("|");
}

/**
 * El id del documento de la línea, derivado de su clave natural.
 *
 * **La unicidad la garantiza la BASE, no una lectura previa** — como hace
 * `chartOfAccounts` con `{tenantId}_{code}`—, porque dos importaciones a la vez
 * ganan cualquier comprobación hecha antes de escribir.
 *
 * Va por `hash` y no por la clave en claro por dos razones: la descripción puede
 * traer `/`, que en una ruta de Firestore parte el documento, y la clave puede
 * pasar del límite de longitud de un id. **El `tenantId` entra en el hash**, así
 * que dos conjuntos no pueden colisionar aunque tengan la misma línea — que es
 * la trampa de que **un id de documento es global**.
 */
export function idDeLinea(linea: Parameters<typeof claveNatural>[0]): string {
  return `bsl_${createHash("sha256").update(claveNatural(linea)).digest("hex").slice(0, 32)}`;
}

/** El id del caso ES el de su línea: un caso por línea, garantizado por la base. */
export function idDeCaso(bankStatementLineId: string): string {
  return bankStatementLineId;
}

// ── Estados y transiciones ──────────────────────────────────────────────────

/**
 * **No hay estado terminal absoluto, y es deliberado.** `aplicado` es el cierre
 * normal y `rechazado` el cierre con motivo, pero los dos se reabren — **solo
 * por un hecho** (un reverso, un borrado, una decisión con motivo escrito),
 * nunca en silencio.
 */
export const TRANSICIONES: Record<EstadoCaso, EstadoCaso[]> = {
  detectado: ["propuesto", "aplicado", "rechazado"],
  propuesto: ["aplicado", "rechazado", "detectado"],
  aplicado: ["reversado", "detectado"],
  rechazado: ["detectado"],
  reversado: ["aplicado", "rechazado", "detectado"],
};

export function transicionValida(de: EstadoCaso, a: EstadoCaso): boolean {
  return TRANSICIONES[de]?.includes(a) ?? false;
}

/** R6 · Salir por rechazo o por reverso EXIGE motivo, y `otro` exige texto. */
export function motivoValido(estado: EstadoCaso, codigo?: string | null, texto?: string | null): boolean {
  if (estado !== "rechazado" && estado !== "reversado") return true;
  if (!codigo || !(MOTIVOS as readonly string[]).includes(codigo)) return false;
  if (codigo === "otro") return typeof texto === "string" && texto.trim().length > 0;
  return true;
}
