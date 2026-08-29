"use client";

import { deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { collection } from "firebase/firestore";

import {
  ensureReconciliationCasesCallable,
  reconcileCaseCallable,
  rejectReconciliationCaseCallable,
  releaseReconciliationCallable,
  reopenReconciliationCaseCallable,
} from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BankStatementLine, LedgerEntry, ReconciliationCase } from "@/types/domain";

import { claveNatural, idDeLinea } from "./conciliacion-reglas";

// ── Helpers puros (parsing de extracto CSV) ───────────────────────────────

/**
 * Parsea un monto en formatos comunes LATAM/US. Convención: coma decimal y
 * punto de miles por defecto; resuelve el caso ambiguo según el separador más
 * a la derecha cuando ambos aparecen. Devuelve null si no es numérico.
 */
export function parseMoney(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^0-9.,-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandSep).join("");
    s = s.replace(decimalSep, ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    // Múltiples puntos o grupo final de 3 dígitos => separador de miles.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = parts.join("");
    }
  }

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Normaliza una fecha a YYYY-MM-DD desde YYYY-MM-DD o dd/mm/yyyy(-). "" si inválida. */
export function normalizeDate(raw: string): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = m[2].padStart(2, "0");
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${month}-${day}`;
  }
  return "";
}

function splitFields(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseDelimited(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = String(text ?? "")
    .split(/\r\n|\r|\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headerLine = lines[0];
  const delimiter = (headerLine.match(/;/g) ?? []).length > (headerLine.match(/,/g) ?? []).length ? ";" : ",";
  const headers = splitFields(headerLine, delimiter).map((h) => h.toLowerCase());

  const rows = lines.slice(1).map((line) => {
    const values = splitFields(line, delimiter);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    return row;
  });
  return { headers, rows };
}

export type ParsedBankLine = { date: string; description: string; amount: number };

function pickKey(headers: string[], candidates: string[]): string | null {
  for (const header of headers) {
    if (candidates.some((c) => header.includes(c))) return header;
  }
  return null;
}

/** Mapea filas crudas del CSV a líneas de extracto válidas. */
export function mapRowsToLines(headers: string[], rows: Record<string, string>[]): ParsedBankLine[] {
  const dateKey = pickKey(headers, ["fecha", "date"]);
  const descKey = pickKey(headers, ["descrip", "concepto", "detalle", "description", "glosa"]);
  const amountKey = pickKey(headers, ["monto", "valor", "importe", "amount", "debito", "credito"]);
  if (!dateKey || !amountKey) return [];

  const result: ParsedBankLine[] = [];
  for (const row of rows) {
    const date = normalizeDate(row[dateKey] ?? "");
    const amount = parseMoney(row[amountKey] ?? "");
    if (!date || amount === null) continue;
    result.push({
      date,
      description: descKey ? (row[descKey] ?? "").trim() : "",
      amount,
    });
  }
  return result;
}

// ── Servicios ──────────────────────────────────────────────────────────────

export function watchBankStatementLines(
  tenantId: string,
  onData: (items: BankStatementLine[]) => void,
  onError: (message: string) => void,
  bankAccountId?: string,
) {
  return (
    subscribeTenantCollection<BankStatementLine>(
      "bankStatementLines",
      tenantId,
      (items) => onData([...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))),
      onError,
      { equals: bankAccountId ? [{ field: "bankAccountId", value: bankAccountId }] : undefined },
    ) ?? (() => {})
  );
}

/**
 * Importa las líneas de un extracto CSV.
 *
 * **R5 — reimportar el mismo extracto ya no duplica nada.** Antes sí: cada carga
 * creaba documentos nuevos con id automático, así que subir dos veces el mismo
 * fichero dejaba el extracto contado por duplicado **sin un solo error en
 * pantalla**. Ahora el id del documento **se deriva del contenido**, de modo que
 * la segunda carga apunta al mismo documento en vez de crear otro.
 *
 * **Y la clave lleva la descripción dentro**, que es la mitad de la regla: sin
 * ella, seis SPEI de 3.000 del mismo día —que son seis pagos de seis unidades
 * distintas— se leerían como cinco duplicados.
 *
 * Las líneas anteriores al expediente conservan su id, porque hay asientos
 * apuntándoles; para ellas la comparación es por `naturalKey`, que se lee antes
 * de escribir. **Es una comprobación previa y por tanto tiene carrera**, a
 * diferencia del id derivado; la ventana es finita y se cierra sola cuando esas
 * líneas dejen de existir. Se dice en vez de dejarlo implícito.
 */
export async function importBankStatementLines(
  tenantId: string,
  userId: string,
  bankAccountId: string,
  csvText: string,
): Promise<{ imported: number; skipped: number; duplicated: number; casos: number; casosFallaron: boolean }> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const { headers, rows } = parseDelimited(csvText);
  const lines = mapRowsToLines(headers, rows);
  const importBatchId = `imp-${Date.now()}`;

  // Lo que ya hay en esta cuenta, para no repetirlo. Se comparan las DOS formas:
  // el id derivado (las nuevas) y la clave natural (las anteriores).
  const existentes = await getDocs(
    query(
      collection(db, "bankStatementLines"),
      where("tenantId", "==", tenantId),
      where("bankAccountId", "==", bankAccountId),
    ),
  );
  const idsPresentes = new Set(existentes.docs.map((d) => d.id));
  const clavesPresentes = new Set(
    existentes.docs.map((d) => {
      const data = d.data() as BankStatementLine;
      return typeof data.naturalKey === "string" && data.naturalKey
        ? data.naturalKey
        : claveNatural({ ...data, tenantId, bankAccountId });
    }),
  );

  let imported = 0;
  let duplicated = 0;

  for (const line of lines) {
    const cuerpo = {
      tenantId,
      bankAccountId,
      date: line.date,
      description: line.description,
      amount: line.amount,
    };
    const naturalKey = claveNatural(cuerpo);
    const id = await idDeLinea(cuerpo);
    if (idsPresentes.has(id) || clavesPresentes.has(naturalKey)) {
      duplicated += 1;
      continue;
    }
    idsPresentes.add(id);
    clavesPresentes.add(naturalKey);
    await setDoc(doc(db, "bankStatementLines", id), {
      ...cuerpo,
      naturalKey,
      reconciled: false,
      matchedLedgerEntryId: null,
      importBatchId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    imported += 1;
  }

  /**
   * **`CA1` — el expediente nace con la línea.**
   *
   * Va aquí y no en la pantalla para que no dependa de que quien llame se
   * acuerde. Y **no tumba la importación si falla**: las líneas ya están
   * escritas y son utilizables; lo que no puede es fallar **en silencio**, así
   * que el resultado lo dice y la pantalla lo cuenta.
   */
  let casos = 0;
  let casosFallaron = false;
  try {
    const r = await ensureReconciliationCasesCallable({ tenantId, bankAccountId });
    casos = r.created;
  } catch {
    casosFallaron = true;
  }

  return { imported, skipped: rows.length - lines.length, duplicated, casos, casosFallaron };
}

/**
 * `PRD-V-FLOW-004` — concilia una línea con un movimiento del libro.
 *
 * **Antes esto escribía en dos colecciones desde el navegador sin comprobar
 * nada**, y por eso en producción hay una salida de banco de −300.000 casada
 * contra una entrada de +40.000. Ahora lo decide el servidor, que es el único
 * que puede leer los dos documentos a la vez y negarse.
 */
export async function matchLine(
  tenantId: string,
  bankLine: BankStatementLine,
  ledgerEntry: LedgerEntry,
  expectedVersion?: number,
): Promise<void> {
  await reconcileCaseCallable({
    tenantId,
    bankStatementLineId: bankLine.id,
    ledgerEntryId: ledgerEntry.id,
    expectedVersion,
  });
}

/** Deshace la conciliación de una línea. Deja rastro: el caso vuelve a `detectado`. */
export async function unmatchLine(tenantId: string, bankLine: BankStatementLine, expectedVersion?: number): Promise<void> {
  await reopenReconciliationCaseCallable({ tenantId, bankStatementLineId: bankLine.id, expectedVersion });
}

/** R6 — descarta una línea con motivo. Sin motivo del catálogo, el servidor se niega. */
export async function rejectLine(
  tenantId: string,
  bankLine: BankStatementLine,
  motivoCodigo: string,
  motivoTexto?: string,
  expectedVersion?: number,
): Promise<void> {
  await rejectReconciliationCaseCallable({
    tenantId,
    bankStatementLineId: bankLine.id,
    motivoCodigo,
    motivoTexto,
    expectedVersion,
  });
}

/** Los expedientes del conjunto. Los escribe el servidor; aquí solo se leen. */
export function watchReconciliationCases(
  tenantId: string,
  onData: (items: ReconciliationCase[]) => void,
  onError: (message: string) => void,
) {
  return subscribeTenantCollection<ReconciliationCase>("reconciliationCases", tenantId, onData, onError) ?? (() => {});
}

/**
 * Borra una línea del extracto.
 *
 * **La conciliación se suelta por el servidor, no aquí.** Antes este camino
 * escribía directamente en el asiento; la regla de R8 se lo impide, y además el
 * borrado tiene que dejar su rastro en el expediente como cualquier otra salida.
 */
export async function deleteBankStatementLine(tenantId: string, bankLine: BankStatementLine): Promise<void> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (bankLine.reconciled && bankLine.matchedLedgerEntryId) {
    await releaseReconciliationCallable({ tenantId, ledgerEntryId: bankLine.matchedLedgerEntryId });
  }
  await deleteDoc(doc(db, "bankStatementLines", bankLine.id));
}
