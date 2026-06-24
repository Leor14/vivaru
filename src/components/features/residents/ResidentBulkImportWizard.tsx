"use client";

/**
 * ResidentBulkImportWizard
 * ────────────────────────
 * Wizard de 4 pasos para importación masiva de residentes/propietarios desde CSV.
 * Espeja a UnitBulkImportWizard. Resuelve la unidad por nombre contra las unidades
 * existentes (la unidad debe existir antes). Detecta duplicados por email/documento.
 *
 * Columnas esperadas (mayúsc/minúsc indiferente):
 *   nombre | email | telefono | documento | unidad | rol
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/help-tip";
import type { PersonItem, UnitItem } from "@/features/admin/services";

type Role = PersonItem["roleType"];

type ImportRow = {
  fullName: string;
  email: string;
  phone: string;
  documentNumber?: string;
  roleType: Role;
  occupancyType: Role;
  unitId: string;
  tower: string;
};

type ParsedRow = {
  rowIndex: number;
  raw: Record<string, string>;
  fullName: string;
  email: string;
  phone: string;
  documentNumber: string;
  unitLabel: string;
  role: Role | null;
  unitId: string | null;
  tower: string;
  errors: string[];
  isDuplicate: boolean;
};

type WizardStep = "upload" | "review" | "confirm" | "done";

type Props = {
  existingUnits: UnitItem[];
  existingPeople: PersonItem[];
  onImport: (rows: ImportRow[]) => Promise<void>;
  onClose: () => void;
};

const ROLE_ALIASES: Record<string, Role> = {
  owner_occupant: "owner_occupant",
  propietario: "owner_occupant",
  "propietario residente": "owner_occupant",
  dueno: "owner_occupant",
  owner: "owner_occupant",
  tenant: "tenant",
  inquilino: "tenant",
  arrendatario: "tenant",
  residente: "tenant",
  investor: "investor",
  inversionista: "investor",
  "propietario no residente": "investor",
  other: "other",
  otro: "other",
  otra: "other",
};

const ROLE_LABELS: Record<Role, string> = {
  owner_occupant: "Propietario residente",
  tenant: "Inquilino",
  investor: "Propietario inversionista",
  other: "Otro",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function getField(raw: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(raw).find((k) => normalizeHeader(k) === key);
    if (found !== undefined) return (raw[found] ?? "").trim();
  }
  return "";
}
function normName(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function downloadTemplate() {
  const rows = [
    ["nombre", "email", "telefono", "documento", "unidad", "rol"],
    ["Ana Pérez", "ana@correo.com", "3001234567", "12345678", "T1-101", "propietario"],
    ["Luis Gómez", "luis@correo.com", "3009876543", "87654321", "T1-102", "inquilino"],
  ];
  const csv = rows.map((r) => r.join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_residentes.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { key: WizardStep; label: string }[] = [
    { key: "upload", label: "Archivo" },
    { key: "review", label: "Revisión" },
    { key: "confirm", label: "Confirmar" },
    { key: "done", label: "Listo" },
  ];
  const current = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1 border-b border-[var(--slate-200)] pb-4">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${i < current ? "bg-emerald-100 text-emerald-700" : i === current ? "bg-[var(--brand-700)] text-white" : "bg-[var(--slate-100)] text-[var(--slate-400)]"}`}>
            {i < current ? "✓" : i + 1}
          </div>
          <span className={`text-xs ${i === current ? "font-medium text-[var(--slate-900)]" : "text-[var(--slate-400)]"}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`mx-1 h-px w-6 ${i < current ? "bg-emerald-300" : "bg-[var(--slate-200)]"}`} />}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ row }: { row: ParsedRow }) {
  if (row.errors.length > 0) return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"><XCircle className="h-3 w-3" /> Inválida</span>;
  if (row.isDuplicate) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><AlertCircle className="h-3 w-3" /> Duplicada</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> OK</span>;
}

export function ResidentBulkImportWizard({ existingUnits, existingPeople, onImport, onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const parseFile = useCallback(
    (file: File) => {
      setParseError(null);
      setFileName(file.name);
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.data.length === 0) {
            setParseError("El archivo no contiene filas de datos.");
            return;
          }
          const unitByName = new Map(existingUnits.map((u) => [normName(u.displayName), u]));
          const existingEmails = new Set(existingPeople.map((p) => (p.email || "").toLowerCase()).filter(Boolean));
          const existingDocs = new Set(existingPeople.map((p) => p.documentNumber || "").filter(Boolean));

          const parsed: ParsedRow[] = result.data.map((raw, idx) => {
            const errors: string[] = [];
            const fullName = getField(raw, "nombre", "name", "fullname");
            const email = getField(raw, "email", "correo", "e-mail");
            const phone = getField(raw, "telefono", "celular", "phone", "tel");
            const documentNumber = getField(raw, "documento", "cedula", "documentnumber", "id");
            const unitLabel = getField(raw, "unidad", "unit", "apartamento");
            const roleRaw = normName(getField(raw, "rol", "role", "tipo"));

            if (!fullName) errors.push("Nombre vacío");
            if (!email) errors.push("Email vacío");
            else if (!EMAIL_RE.test(email)) errors.push("Email inválido");

            const role: Role | null = ROLE_ALIASES[roleRaw] ?? null;
            if (!role) errors.push(`Rol inválido: "${roleRaw || "vacío"}"`);

            const unit = unitByName.get(normName(unitLabel));
            if (!unitLabel) errors.push("Unidad vacía");
            else if (!unit) errors.push(`Unidad no encontrada: "${unitLabel}"`);

            const isDuplicate = errors.length === 0 && ((!!email && existingEmails.has(email.toLowerCase())) || (!!documentNumber && existingDocs.has(documentNumber)));

            return {
              rowIndex: idx + 2,
              raw,
              fullName,
              email,
              phone,
              documentNumber,
              unitLabel,
              role,
              unitId: unit?.id ?? null,
              tower: unit?.tower ?? "",
              errors,
              isDuplicate,
            };
          });

          setRows(parsed);
          setSelected(new Set(parsed.filter((r) => r.errors.length === 0 && !r.isDuplicate).map((r) => r.rowIndex)));
          setStep("review");
        },
        error: (err) => setParseError(`Error al leer el archivo: ${err.message}`),
      });
    },
    [existingUnits, existingPeople],
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
    e.target.value = "";
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const allSelected = validRows.length > 0 && validRows.every((r) => selected.has(r.rowIndex));
  const someSelected = validRows.some((r) => selected.has(r.rowIndex));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(validRows.map((r) => r.rowIndex)));
  }
  function toggleRow(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  async function handleImport() {
    const toImport = rows.filter((r) => selected.has(r.rowIndex) && r.errors.length === 0 && r.role && r.unitId);
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      await onImport(
        toImport.map((r) => ({
          fullName: r.fullName,
          email: r.email,
          phone: r.phone,
          documentNumber: r.documentNumber || undefined,
          roleType: r.role!,
          occupancyType: r.role!,
          unitId: r.unitId!,
          tower: r.tower,
        })),
      );
      setImportedCount(toImport.length);
      setStep("done");
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = rows.filter((r) => selected.has(r.rowIndex)).length;
  const invalidCount = rows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate && r.errors.length === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {step === "upload" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slate-100)]"><FileText className="h-7 w-7 text-[var(--slate-500)]" /></div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="font-medium text-[var(--slate-900)]">Selecciona tu archivo CSV</p>
              <HelpTip text="La unidad debe existir antes (importa primero las unidades). Cada residente se vincula a su unidad por el nombre. Si el email o documento ya existe, la fila se marca como duplicada y tú decides si la importas igual." />
            </div>
            <p className="mt-1 text-sm text-[var(--slate-500)]">
              Columnas: <code className="rounded bg-[var(--slate-100)] px-1 py-0.5 text-xs">nombre, email, telefono, documento, unidad, rol</code>
            </p>
          </div>
          {parseError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{parseError}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Seleccionar archivo CSV</Button>
            <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> Descargar plantilla</Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-800">Rol (valores aceptados)</p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              <strong>propietario</strong> (residente) · <strong>inquilino</strong> · <strong>inversionista</strong> (propietario no residente) · <strong>otro</strong>.
              La unidad debe existir; si no la encuentra por nombre, la fila se marca inválida.
            </p>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">{validRows.length - duplicateCount} válidas</span>
            {duplicateCount > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">{duplicateCount} duplicadas</span>}
            {invalidCount > 0 && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">{invalidCount} con errores</span>}
            <span className="ml-auto text-xs text-[var(--slate-500)]">Archivo: <span className="font-medium">{fileName}</span></span>
          </div>
          <div className="responsive-table-wrap rounded-xl border border-[var(--slate-200)]">
            <table className="responsive-table text-sm">
              <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
                <tr>
                  <th className="px-3 py-2 w-8"><input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" className="h-4 w-4 cursor-pointer rounded border-[var(--slate-300)] accent-[var(--brand-700)]" /></th>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelectable = row.errors.length === 0;
                  return (
                    <tr key={row.rowIndex} className={`border-t border-[var(--slate-200)] ${!isSelectable ? "opacity-50" : ""}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(row.rowIndex)} disabled={!isSelectable} onChange={() => isSelectable && toggleRow(row.rowIndex)} aria-label={`Fila ${row.rowIndex}`} className="h-4 w-4 cursor-pointer rounded border-[var(--slate-300)] accent-[var(--brand-700)] disabled:cursor-not-allowed" /></td>
                      <td className="px-3 py-2 text-xs text-[var(--slate-500)]">{row.rowIndex}</td>
                      <td className="px-3 py-2 font-medium text-[var(--slate-900)]">{row.fullName || <span className="italic text-rose-400">vacío</span>}</td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">{row.email || <span className="italic text-rose-400">vacío</span>}</td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">{row.unitLabel || <span className="italic text-rose-400">vacío</span>}</td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">{row.role ? ROLE_LABELS[row.role] : <span className="italic text-rose-400">{getField(row.raw, "rol", "role") || "vacío"}</span>}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge row={row} />
                          {row.errors.map((e, i) => <span key={i} className="text-[10px] text-rose-600">{e}</span>)}
                          {row.isDuplicate && <span className="text-[10px] text-amber-600">Email/documento ya existe</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--slate-500)]">{selectedCount} residente{selectedCount !== 1 ? "s" : ""} seleccionado{selectedCount !== 1 ? "s" : ""} para importar</p>
          <div className="flex justify-between gap-2 border-t border-[var(--slate-200)] pt-3">
            <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); }}>← Cambiar archivo</Button>
            <Button onClick={() => setStep("confirm")} disabled={selectedCount === 0}>Continuar ({selectedCount})</Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-4">
            <p className="font-medium text-[var(--slate-900)]">Resumen de importación</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-[var(--slate-500)]">Residentes a crear</p><p className="text-xl font-semibold text-[var(--brand-700)]">{selectedCount}</p></div>
              <div><p className="text-xs text-[var(--slate-500)]">Archivo</p><p className="truncate font-medium text-[var(--slate-900)]">{fileName}</p></div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs text-[var(--slate-500)]">Vista previa</p>
              {rows.filter((r) => selected.has(r.rowIndex)).slice(0, 5).map((r) => (
                <p key={r.rowIndex} className="text-xs text-[var(--slate-700)]">· {r.fullName} — {r.unitLabel} — {r.role ? ROLE_LABELS[r.role] : ""}</p>
              ))}
              {selectedCount > 5 && <p className="text-xs text-[var(--slate-400)]">… y {selectedCount - 5} más</p>}
            </div>
          </div>
          <div className="flex justify-between gap-2 border-t border-[var(--slate-200)] pt-3">
            <Button variant="outline" onClick={() => setStep("review")} disabled={importing}>← Revisar selección</Button>
            <Button onClick={() => void handleImport()} disabled={importing}>{importing ? "Importando..." : `Importar ${selectedCount} residentes`}</Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-7 w-7 text-emerald-600" /></div>
          <div>
            <p className="text-lg font-semibold text-[var(--slate-900)]">{importedCount} residente{importedCount !== 1 ? "s" : ""} importado{importedCount !== 1 ? "s" : ""}</p>
            <p className="mt-1 text-sm text-[var(--slate-500)]">Ya aparecen en la tabla de personas, vinculados a su unidad.</p>
          </div>
          <div className="w-full rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">¿Qué sigue?</p>
            <p className="mt-2 text-xs text-[var(--slate-700)]">Desde la tabla de personas puedes enviar el acceso (onboarding por enlace) a cada residente para que active su cuenta.</p>
          </div>
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      )}
    </div>
  );
}
