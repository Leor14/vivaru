"use client";

import { deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BankStatementLine, LedgerEntry } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

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

/** Importa líneas de un extracto CSV. Devuelve cuántas se cargaron y cuántas se omitieron. */
export async function importBankStatementLines(
  tenantId: string,
  userId: string,
  bankAccountId: string,
  csvText: string,
): Promise<{ imported: number; skipped: number }> {
  const { headers, rows } = parseDelimited(csvText);
  const lines = mapRowsToLines(headers, rows);
  const importBatchId = `imp-${Date.now()}`;

  await Promise.all(
    lines.map((line) =>
      createTenantDocument("bankStatementLines", tenantId, userId, {
        bankAccountId,
        date: line.date,
        description: line.description,
        amount: line.amount,
        reconciled: false,
        matchedLedgerEntryId: null,
        importBatchId,
      }),
    ),
  );

  return { imported: lines.length, skipped: rows.length - lines.length };
}

/** Concilia una línea de extracto con un movimiento del libro (enlaza ambos). */
export async function matchLine(
  bankLine: BankStatementLine,
  ledgerEntry: LedgerEntry,
  userId: string,
): Promise<void> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const batch = writeBatch(db);
  batch.update(doc(db, "bankStatementLines", bankLine.id), {
    reconciled: true,
    matchedLedgerEntryId: ledgerEntry.id,
  });
  batch.update(doc(db, "ledgerEntries", ledgerEntry.id), {
    reconciled: true,
    bankStatementLineId: bankLine.id,
    reconciledAt: today(),
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Deshace la conciliación de una línea (y libera el movimiento del libro). */
export async function unmatchLine(bankLine: BankStatementLine, userId: string): Promise<void> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  const batch = writeBatch(db);
  batch.update(doc(db, "bankStatementLines", bankLine.id), {
    reconciled: false,
    matchedLedgerEntryId: null,
  });
  if (bankLine.matchedLedgerEntryId) {
    batch.update(doc(db, "ledgerEntries", bankLine.matchedLedgerEntryId), {
      reconciled: false,
      bankStatementLineId: null,
      reconciledAt: null,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function deleteBankStatementLine(bankLine: BankStatementLine, userId: string): Promise<void> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (bankLine.reconciled && bankLine.matchedLedgerEntryId) {
    await updateDoc(doc(db, "ledgerEntries", bankLine.matchedLedgerEntryId), {
      reconciled: false,
      bankStatementLineId: null,
      reconciledAt: null,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    });
  }
  await deleteDoc(doc(db, "bankStatementLines", bankLine.id));
}
