"use client";

/**
 * ResidentBulkImportWizard
 * ────────────────────────
 * Wizard de 5 pasos para importación masiva de residentes/propietarios desde CSV o XLSX.
 * El paso de columnas permite usar archivos que NO traen los encabezados de la
 * plantilla; el catálogo vive en `src/lib/import/field-catalog.ts`.
 * Espeja a UnitBulkImportWizard. Resuelve la unidad por nombre contra las unidades
 * existentes (la unidad debe existir antes). Detecta duplicados por email/documento.
 *
 * Columnas que se reconocen solas (mayúsc/minúsc indiferente):
 *   nombre | email | telefono | documento | unidad | rol
 * Cualquier otro encabezado se asigna a mano en el paso de columnas.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  hayBloqueantes,
  pickBestSheet,
  mappingIssues,
  missingRequired,
  normalizeHeader,
  suggestMapping,
  summarizeMapping,
  formaDelArchivo,
  valueFor,
} from "@/lib/import/field-catalog";

import { readTabularFile, TabularReadError, type TabularFile } from "@/lib/import/read-tabular";

import { registrarImportacionCallable } from "@/lib/firebase/callables";

import { ColumnMappingStep } from "./ColumnMappingStep";
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

type WizardStep = "upload" | "map" | "review" | "confirm" | "done";

type Props = {
  existingUnits: UnitItem[];
  existingPeople: PersonItem[];
  onImport: (rows: ImportRow[]) => Promise<void>;
  onClose: () => void;
  /** Pista de puesta en marcha, solo para la telemetría. */
  track?: string;
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

/**
 * Lectura cruda de una celda para ENSEÑAR lo que escribió la persona cuando el
 * valor no es válido («Rol inválido: "dueño"»). La resolución real de columnas
 * la hace ahora el catálogo compartido (`src/lib/import/field-catalog.ts`).
 */
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

/**
 * Lo que cada campo acepta, sacado de las tablas de alias de ESTE archivo.
 * Sirve para dos cosas en el paso de columnas: reconocer una columna por su
 * contenido aunque su encabezado no diga nada, y avisar cuando la elegida es
 * inequívocamente otra cosa.
 */
const ACEPTADOS = {
  "person.role": Object.keys(ROLE_ALIASES),
};

function StepIndicator({ step }: { step: WizardStep }) {
  const steps: { key: WizardStep; label: string }[] = [
    { key: "upload", label: "Archivo" },
    { key: "map", label: "Columnas" },
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

export function ResidentBulkImportWizard({ existingUnits, existingPeople, onImport, onClose, track }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [libro, setLibro] = useState<TabularFile | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  /** Une el inicio y el fin de un mismo intento en la telemetría. */
  const [runId, setRunId] = useState<string>("");

  /**
   * Construye las filas validadas a partir del mapeo. Separado del parseo
   * porque ahora corre dos veces: con el mapeo sugerido, y otra vez si la
   * persona lo corrige en el paso de columnas.
   */
  const buildRows = useCallback(
    (data: Record<string, string>[], mapping: Record<string, string | null>): ParsedRow[] => {
          const unitByName = new Map(existingUnits.map((u) => [normName(u.displayName), u]));
          const existingEmails = new Set(existingPeople.map((p) => (p.email || "").toLowerCase()).filter(Boolean));
          const existingDocs = new Set(existingPeople.map((p) => p.documentNumber || "").filter(Boolean));

          const parsed: ParsedRow[] = data.map((raw, idx) => {
            const errors: string[] = [];
            const fullName = valueFor(raw, mapping, "person.fullName");
            const email = valueFor(raw, mapping, "person.email");
            const phone = valueFor(raw, mapping, "person.phone");
            const documentNumber = valueFor(raw, mapping, "person.documentNumber");
            const unitLabel = valueFor(raw, mapping, "person.unitLabel");
            const roleRaw = normName(valueFor(raw, mapping, "person.role"));

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

          return parsed;
    },
    [existingUnits, existingPeople],
  );

  /** Toma la hoja indicada del libro y propone su mapeo. */
  const usarHoja = useCallback((archivo: TabularFile, nombre: string) => {
    const hoja = archivo.sheets[nombre];
    setSheetName(nombre);
    setHeaders(hoja.headers);
    setRawRows(hoja.rows);
    setMapping(suggestMapping(hoja.headers, "person", { rows: hoja.rows, accepted: ACEPTADOS }));
  }, []);

  const parseFile = useCallback(
    async (file: File) => {
      setParseError(null);
      setFileName(file.name);
      try {
        const archivo = await readTabularFile(file);
        setLibro(archivo);
        // No la primera del libro: la que mejor encaja. En un archivo real la
        // primera fue «Saldos», que no tiene ni tipo ni estado.
        usarHoja(
          archivo,
          pickBestSheet(
            archivo.sheetNames.map((n) => ({ name: n, ...archivo.sheets[n] })),
            "person",
            ACEPTADOS,
          ),
        );
        setStep("map");

        // Telemetría del intento (PRD-V-FEAT-002, CA-13). Best-effort: si falla,
        // la persona no se entera y su importación sigue igual.
        const id = crypto.randomUUID();
        setRunId(id);
        const hoja = archivo.sheets[
          pickBestSheet(
            archivo.sheetNames.map((n) => ({ name: n, ...archivo.sheets[n] })),
            "person",
            ACEPTADOS,
          )
        ];
        const sugerido = suggestMapping(hoja.headers, "person", { rows: hoja.rows, accepted: ACEPTADOS });
        void registrarImportacionCallable({
          runId: id,
          fase: "inicio",
          entidad: "person",
          ...(track ? { pista: track } : {}),
          formato: /\.xlsx?$/i.test(file.name) ? "xlsx" : "csv",
          hojas: archivo.sheetNames.length,
          filas: hoja.rows.length,
          ...summarizeMapping(hoja.headers, "person", sugerido),
          // La FORMA del archivo, no su contenido: es como se acumula corpus
          // para `AI-ONB-001` sin guardar el fichero del cliente (§7).
          filasDePreambulo: hoja.filasDePreambulo,
          ...formaDelArchivo(hoja.rows, "person", sugerido, ACEPTADOS),
        });
      } catch (err) {
        // El lector ya trae el mensaje escrito para la persona; cualquier otra
        // cosa sería un error técnico en pantalla, que no ayuda a nadie.
        setParseError(
          err instanceof TabularReadError
            ? err.message
            : `No se pudo leer el archivo: ${err instanceof Error ? err.message : "formato no reconocido"}`,
        );
      }
    },
    [usarHoja, track],
  );

  /** Aplica el mapeo vigente y pasa a revisión. */
  function applyMapping() {
    const parsed = buildRows(rawRows, mapping);
    setRows(parsed);
    setSelected(new Set(parsed.filter((r) => r.errors.length === 0 && !r.isDuplicate).map((r) => r.rowIndex)));
    setStep("review");
  }

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

      // Cierre del intento. El par inicio/fin es la métrica: los que empiezan y
      // nunca llegan aquí son exactamente los que se quiere contar.
      void registrarImportacionCallable({
        runId,
        fase: "fin",
        entidad: "person",
        ...(track ? { pista: track } : {}),
        formato: /\.xlsx?$/i.test(fileName) ? "xlsx" : "csv",
        hojas: libro?.sheetNames.length ?? 1,
        filas: rows.length,
        ...summarizeMapping(headers, "person", mapping),
        importadas: toImport.length,
        omitidas: rows.length - toImport.length,
      });
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

      {/*
        Respaldo del bloqueo que ya hace la pantalla: aquí también se puede
        llegar desde el recorrido guiado, y sin unidades TODAS las filas
        fallarían con «Unidad no encontrada» — un mensaje que culpa al archivo
        cuando la causa es el orden. Se dice la causa real y se para.
      */}
      {step === "upload" && existingUnits.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <AlertCircle className="h-7 w-7 text-amber-600" />
          </div>
          <p className="font-medium text-[var(--slate-900)]">Primero carga tus unidades</p>
          <p className="max-w-md text-sm text-[var(--slate-600)]">
            Cada persona se vincula a la unidad en la que vive, y este conjunto todavía no
            tiene ninguna. Si importas ahora, ninguna fila encontrará su unidad.
          </p>
          <Button variant="outline" onClick={onClose}>
            Entendido, cargo las unidades
          </Button>
        </div>
      )}

      {step === "upload" && existingUnits.length > 0 && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slate-100)]"><FileText className="h-7 w-7 text-[var(--slate-500)]" /></div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="font-medium text-[var(--slate-900)]">Selecciona tu archivo</p>
              <HelpTip text="La unidad debe existir antes (importa primero las unidades). Cada residente se vincula a su unidad por el nombre. Si el email o documento ya existe, la fila se marca como duplicada y tú decides si la importas igual." />
            </div>
            <p className="mt-1 text-sm text-[var(--slate-500)]">
              Columnas: <code className="rounded-sm bg-[var(--slate-100)] px-1 py-0.5 text-xs">nombre, email, telefono, documento, unidad, rol</code>
            </p>
          </div>
          {parseError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{parseError}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Seleccionar archivo</Button>
            <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" /> Descargar plantilla</Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFileChange} />
          {/* Espeja la tarjeta del asistente de unidades: qué hace esto, qué NO
              hace, y por qué va en segundo lugar. */}
          <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-800">
              ¿Qué importa este archivo y qué no?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              <strong>Este es el paso 2.</strong> Crea a las personas del conjunto —propietarios,
              inquilinos— y <strong>engancha cada una a la unidad en la que vive</strong>. Por eso
              las unidades van antes: si no existen, no hay a qué engancharlas y ninguna fila entra.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              <strong>No envía invitaciones ni crea accesos.</strong> Nadie recibe un correo por
              importar. Avisar a los residentes para que entren a Vivaru es un paso aparte, cuando
              tú lo decidas.
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              Con nombre, correo y unidad basta para arrancar; el teléfono y el documento se
              pueden completar después.
            </p>
          </div>

          <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-800">Rol (valores aceptados)</p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              <strong>propietario</strong> (residente) · <strong>inquilino</strong> · <strong>inversionista</strong> (propietario no residente) · <strong>otro</strong>.
              Define qué ve cada persona y qué puede hacer dentro de Vivaru.
            </p>
          </div>
        </div>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-4">
          <ColumnMappingStep
            entity="person"
            headers={headers}
            rows={rawRows}
            mapping={mapping}
            onChange={setMapping}
            accepted={ACEPTADOS}
            sheetNames={libro?.sheetNames ?? []}
            sheetName={sheetName}
            onSheetChange={(n) => libro && usarHoja(libro, n)}
          />
          <div className="flex justify-between gap-2 border-t border-[var(--slate-200)] pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setHeaders([]);
                setRawRows([]);
                setMapping({});
                setLibro(null);
                setSheetName("");
              }}
            >
              ← Cambiar archivo
            </Button>
            <Button onClick={applyMapping} disabled={
                missingRequired(mapping, "person").length > 0 ||
                hayBloqueantes(mappingIssues(rawRows, "person", mapping, ACEPTADOS))
              }>
              Continuar
            </Button>
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
                  <th className="px-3 py-2 w-8"><input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" className="h-4 w-4 cursor-pointer rounded-sm border-[var(--slate-300)] accent-[var(--brand-700)]" /></th>
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
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.has(row.rowIndex)} disabled={!isSelectable} onChange={() => isSelectable && toggleRow(row.rowIndex)} aria-label={`Fila ${row.rowIndex}`} className="h-4 w-4 cursor-pointer rounded-sm border-[var(--slate-300)] accent-[var(--brand-700)] disabled:cursor-not-allowed" /></td>
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
            <Button variant="outline" onClick={() => { setStep("map"); setRows([]); }}>← Volver a columnas</Button>
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
