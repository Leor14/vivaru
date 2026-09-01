"use client";

/**
 * UnitBulkImportWizard
 * ─────────────────────
 * Wizard de 5 pasos para importación masiva de unidades desde CSV o XLSX.
 *
 * Paso 1 – UPLOAD    : Botón de selección de archivo + plantilla descargable.
 * Paso 2 – MAP       : Qué columna del archivo alimenta cada campo destino.
 * Paso 3 – REVIEW    : Tabla con filas válidas / inválidas / duplicadas.
 *                      Checkboxes para seleccionar cuáles importar.
 * Paso 4 – CONFIRM   : Resumen final antes de escribir en Firestore.
 * Paso 5 – DONE      : Resultado con conteo de unidades importadas.
 *
 * **El archivo ya NO tiene que traer los encabezados de la plantilla.** Esos
 * —nombre, torre, tipo, estado— siguen reconociéndose solos y precargan el
 * mapeo; cualquier otro se asigna a mano en el paso 2. El catálogo de campos
 * destino vive en `src/lib/import/field-catalog.ts`, no aquí.
 *
 * Valores válidos para "tipo" : apartment, house, office, other
 *                               (y alias: apartamento, casa, oficina, otro)
 * Valores válidos para "estado": active, inactive
 *                               (y alias: activo, activa, inactivo, inactiva)
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

import { filaEnElArchivo, readTabularFile, TabularReadError, type TabularFile } from "@/lib/import/read-tabular";
import { ALIAS_DE_TIPO, ETIQUETA_DE_TIPO } from "@/lib/units/tipos";

import { registrarImportacionCallable } from "@/lib/firebase/callables";

import { ColumnMappingStep } from "./ColumnMappingStep";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/shared/help-tip";
import type { UnitItem } from "@/features/admin/services";

// ─── Types ────────────────────────────────────────────────────────────────────

type UnitType = UnitItem["type"];
type UnitStatus = UnitItem["status"];

type ParsedRow = {
  /** Índice original en el CSV (1-based, para mostrar al usuario) */
  rowIndex: number;
  raw: Record<string, string>;
  displayName: string;
  tower: string;
  type: UnitType | null;
  status: UnitStatus | null;
  errors: string[];
  isDuplicate: boolean;
  /** Si es duplicado, el id de la unidad existente */
  duplicateId?: string;
};

type WizardStep = "upload" | "map" | "review" | "confirm" | "done";

type Props = {
  /** Unidades ya existentes — usadas para detección de duplicados. */
  existingUnits: UnitItem[];
  onImport: (
    rows: Array<{ displayName: string; tower: string; type: UnitType; status: UnitStatus }>,
  ) => Promise<void>;
  onClose: () => void;
  /** Pista de puesta en marcha, solo para la telemetría. */
  track?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Los alias de tipo salen del catálogo — ver `src/lib/units/tipos.ts`.
const TYPE_ALIASES = ALIAS_DE_TIPO;

const STATUS_ALIASES: Record<string, UnitStatus> = {
  active: "active",
  activo: "active",
  activa: "active",
  inactive: "inactive",
  inactivo: "inactive",
  inactiva: "inactive",
};

// Los rótulos salen del catálogo. Este fichero llevaba su propia copia, que
// es la séptima de las siete que había que cambiar a la vez.
const TYPE_LABELS = ETIQUETA_DE_TIPO;

/**
 * Lectura cruda de una celda para ENSEÑAR lo que escribió la persona cuando el
 * valor no es válido («Tipo inválido: "casa grande"»). La resolución real de
 * columnas ya no vive aquí: la hace el catálogo compartido
 * (`src/lib/import/field-catalog.ts`). Esto queda porque en el momento de
 * pintar la tabla no hay mapeo a mano, solo la fila.
 */
function getField(raw: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(raw).find((k) => normalizeHeader(k) === key);
    if (found !== undefined) return (raw[found] ?? "").trim();
  }
  return "";
}

function generateCsvTemplate(): string {
  const headers = ["nombre", "torre", "tipo", "estado"];
  const examples = [
    ["T1-101", "T1", "apartment", "active"],
    ["T1-102", "T1", "apartment", "active"],
    ["T2-201", "T2", "house", "active"],
    ["Local-01", "Local", "office", "active"],
  ];
  return [headers, ...examples].map((r) => r.join(",")).join("\r\n");
}

function downloadTemplate() {
  const csv = generateCsvTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_unidades.csv";
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
  "unit.type": Object.keys(TYPE_ALIASES),
  "unit.status": Object.keys(STATUS_ALIASES),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div className="flex items-center gap-1 pb-4 border-b border-[var(--slate-200)]">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              i < current
                ? "bg-emerald-100 text-emerald-700"
                : i === current
                  ? "bg-[var(--brand-700)] text-white"
                  : "bg-[var(--slate-100)] text-[var(--slate-400)]"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          <span
            className={`text-xs ${i === current ? "font-medium text-[var(--slate-900)]" : "text-[var(--slate-400)]"}`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`mx-1 h-px w-6 ${i < current ? "bg-emerald-300" : "bg-[var(--slate-200)]"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ row }: { row: ParsedRow }) {
  if (row.errors.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
        <XCircle className="h-3 w-3" /> Inválida
      </span>
    );
  }
  if (row.isDuplicate) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        <AlertCircle className="h-3 w-3" /> Duplicada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> OK
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UnitBulkImportWizard({ existingUnits, onImport, onClose, track }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState<string>("");
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
  /**
   * Cuántas filas se saltó el lector antes de los encabezados, de la hoja
   * ACTIVA. **Derivado y no estado propio**: sigue solo al selector de hoja, y
   * no hay un tercer sitio que acordarse de limpiar al cambiar de archivo.
   */
  const filasDePreambulo = (sheetName && libro?.sheets[sheetName]?.filasDePreambulo) || 0;
  /** Une el inicio y el fin de un mismo intento en la telemetría. */
  const [runId, setRunId] = useState<string>("");

  // ── Parse CSV ──────────────────────────────────────────────────────────────

  /**
   * Construye las filas validadas a partir del mapeo. Se separó del parseo
   * porque ahora se ejecuta DOS veces: al llegar del archivo con el mapeo
   * sugerido, y otra vez si la persona lo corrige en el paso de columnas.
   */
  const buildRows = useCallback(
    (data: Record<string, string>[], mapping: Record<string, string | null>): ParsedRow[] => {
      // Construir slug set de unidades existentes para detección de duplicados
      const existingSlugs = new Map(
        existingUnits.map((u) => [
          u.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          u.id,
        ]),
      );

      return data.map((raw, idx) => {
        const errors: string[] = [];

        const displayName = valueFor(raw, mapping, "unit.displayName");
        const tower = valueFor(raw, mapping, "unit.tower");
        const typeRaw = valueFor(raw, mapping, "unit.type").toLowerCase();
        const statusRaw = valueFor(raw, mapping, "unit.status").toLowerCase();

        if (!displayName) errors.push("Nombre vacío");
        if (!tower) errors.push("Torre vacía");

        const type: UnitType | null = TYPE_ALIASES[typeRaw] ?? null;
        if (!type) errors.push(`Tipo inválido: "${typeRaw || "vacío"}"`);

        const status: UnitStatus | null = STATUS_ALIASES[statusRaw] ?? null;
        if (!status) errors.push(`Estado inválido: "${statusRaw || "vacío"}"`);

        const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const duplicateId = existingSlugs.get(slug);
        const isDuplicate = Boolean(duplicateId) && errors.length === 0;

        return {
          rowIndex: filaEnElArchivo(idx, filasDePreambulo),
          raw,
          displayName,
          tower,
          type,
          status,
          errors,
          isDuplicate,
          duplicateId,
        };
      });
    },
    [existingUnits, filasDePreambulo],
  );

  /** Toma la hoja indicada del libro y propone su mapeo. */
  const usarHoja = useCallback((archivo: TabularFile, nombre: string) => {
    const hoja = archivo.sheets[nombre];
    setSheetName(nombre);
    setHeaders(hoja.headers);
    setRawRows(hoja.rows);
    setMapping(suggestMapping(hoja.headers, "unit", { rows: hoja.rows, accepted: ACEPTADOS }));
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
            "unit",
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
            "unit",
            ACEPTADOS,
          )
        ];
        const sugerido = suggestMapping(hoja.headers, "unit", { rows: hoja.rows, accepted: ACEPTADOS });
        void registrarImportacionCallable({
          runId: id,
          fase: "inicio",
          entidad: "unit",
          ...(track ? { pista: track } : {}),
          formato: /\.xlsx?$/i.test(file.name) ? "xlsx" : "csv",
          hojas: archivo.sheetNames.length,
          filas: hoja.rows.length,
          ...summarizeMapping(hoja.headers, "unit", sugerido),
          // La FORMA del archivo, no su contenido: es como se acumula corpus
          // para `AI-ONB-001` sin guardar el fichero del cliente (§7).
          filasDePreambulo: hoja.filasDePreambulo,
          ...formaDelArchivo(hoja.rows, "unit", sugerido, ACEPTADOS),
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

    // Pre-seleccionar solo las filas válidas y no duplicadas
    setSelected(
      new Set<number>(
        parsed.filter((r) => r.errors.length === 0 && !r.isDuplicate).map((r) => r.rowIndex),
      ),
    );
    setStep("review");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
    // Reset input para permitir recargar el mismo archivo
    e.target.value = "";
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  const validRows = rows.filter((r) => r.errors.length === 0);
  const selectableRows = validRows; // incluye duplicadas si el usuario las marca
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.rowIndex));
  const someSelected = selectableRows.some((r) => selected.has(r.rowIndex));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRows.map((r) => r.rowIndex)));
    }
  }

  function toggleRow(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    const toImport = rows.filter(
      (r) => selected.has(r.rowIndex) && r.errors.length === 0 && r.type && r.status,
    );

    if (toImport.length === 0) return;
    setImporting(true);

    try {
      await onImport(
        toImport.map((r) => ({
          displayName: r.displayName,
          tower: r.tower,
          type: r.type!,
          status: r.status!,
        })),
      );
      setImportedCount(toImport.length);
      setStep("done");

      // Cierre del intento. El par inicio/fin es la métrica: los que empiezan y
      // nunca llegan aquí son exactamente los que se quiere contar.
      void registrarImportacionCallable({
        runId,
        fase: "fin",
        entidad: "unit",
        ...(track ? { pista: track } : {}),
        formato: /\.xlsx?$/i.test(fileName) ? "xlsx" : "csv",
        hojas: libro?.sheetNames.length ?? 1,
        filas: rows.length,
        ...summarizeMapping(headers, "unit", mapping),
        importadas: toImport.length,
        omitidas: rows.length - toImport.length,
      });
    } finally {
      setImporting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedCount = rows.filter((r) => selected.has(r.rowIndex)).length;
  const invalidCount = rows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate && r.errors.length === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator step={step} />

      {/* ── PASO 1: UPLOAD ─────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--slate-100)]">
            <FileText className="h-7 w-7 text-[var(--slate-500)]" />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="font-medium text-[var(--slate-900)]">Selecciona tu archivo</p>
              <HelpTip text="Descarga la plantilla para ver el formato exacto. El nombre de cada unidad es clave: si ya existe una con ese mismo nombre en el conjunto, el sistema la marcará como duplicada y tú decides si importarla de todos modos o descartarla. Mayúsculas, minúsculas y tildes no afectan el reconocimiento de tipo y estado." />
            </div>
            <p className="mt-1 text-sm text-[var(--slate-500)]">
              Columnas requeridas: <code className="rounded-sm bg-[var(--slate-100)] px-1 py-0.5 text-xs">nombre, torre, tipo, estado</code>
            </p>
          </div>

          {parseError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {parseError}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Seleccionar archivo
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Descargar plantilla
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="w-full rounded-xl border border-[var(--slate-200)] bg-[var(--slate-100)] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--slate-500)]">
              Valores válidos
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--slate-700)]">
              <div>
                <p className="font-medium">Tipo</p>
                <p className="text-[var(--slate-500)]">apartment · house · office · other</p>
                <p className="text-[var(--slate-400)]">(o: apartamento · casa · oficina · otro)</p>
              </div>
              <div>
                <p className="font-medium">Estado</p>
                <p className="text-[var(--slate-500)]">active · inactive</p>
                <p className="text-[var(--slate-400)]">(o: activo · inactivo)</p>
              </div>
            </div>
          </div>

          {/* Regla de negocio: unidad vs. persona */}
          <div className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold text-blue-800">
              ¿Qué importa este archivo y qué no?
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              <strong>Este wizard crea únicamente las unidades físicas</strong> del conjunto
              (el apartamento, la casa, el local). <strong>No crea residentes, propietarios ni accesos.</strong>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              Cuando termines, el <strong>paso 2 es «Cargar residentes»</strong>: las personas
              se importan aparte y cada una se engancha a la unidad en la que vive. Si son
              pocas, también puedes darlas de alta a mano con «Crear persona».
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-blue-700">
              La separación es intencional: una unidad puede existir sin nadie dentro —vacía,
              en remodelación, o de un propietario que no vive ahí— y por eso se cargan primero.
            </p>
          </div>
        </div>
      )}

      {/* ── PASO 2: MAPEO DE COLUMNAS ──────────────────────────────────────── */}
      {step === "map" && (
        <div className="flex flex-col gap-4">
          <ColumnMappingStep
            entity="unit"
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
              Cambiar archivo
            </Button>
            <Button onClick={applyMapping} disabled={
                missingRequired(mapping, "unit").length > 0 ||
                hayBloqueantes(mappingIssues(rawRows, "unit", mapping, ACEPTADOS))
              }>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 3: REVIEW ─────────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="flex flex-col gap-3">
          {/* Resumen */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {validRows.length - duplicateCount} válidas
            </span>
            {duplicateCount > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {duplicateCount} duplicadas
              </span>
            )}
            {invalidCount > 0 && (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                {invalidCount} con errores
              </span>
            )}
            <HelpTip text="Válida: fila lista para importar. — Inválida: falta un campo o el valor de tipo/estado no es reconocido; corrígela en el archivo y vuelve a cargarlo. — Duplicada: ya existe una unidad con ese nombre en el conjunto; puedes marcarla igual para crear una segunda unidad, o desmárcarla para omitirla. Solo las filas con checkbox marcado se importarán." />
            <span className="ml-auto text-xs text-[var(--slate-500)]">
              Archivo: <span className="font-medium">{fileName}</span>
            </span>
          </div>

          {/* Tabla de revisión */}
          <div className="responsive-table-wrap rounded-xl border border-[var(--slate-200)]">
            <table className="responsive-table text-sm">
              <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todas las filas válidas"
                      className="h-4 w-4 cursor-pointer rounded-sm border-[var(--slate-300)] accent-[var(--brand-700)]"
                    />
                  </th>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Agrupación</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelectable = row.errors.length === 0;
                  const isChecked = selected.has(row.rowIndex);
                  return (
                    <tr
                      key={row.rowIndex}
                      className={`border-t border-[var(--slate-200)] ${!isSelectable ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isSelectable}
                          onChange={() => isSelectable && toggleRow(row.rowIndex)}
                          aria-label={`Fila ${row.rowIndex}`}
                          className="h-4 w-4 cursor-pointer rounded-sm border-[var(--slate-300)] accent-[var(--brand-700)] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2 text-[var(--slate-500)] text-xs">{row.rowIndex}</td>
                      <td className="px-3 py-2 font-medium text-[var(--slate-900)]">
                        {row.displayName || <span className="text-rose-400 italic">vacío</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">
                        {row.tower || <span className="text-rose-400 italic">vacío</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">
                        {row.type ? TYPE_LABELS[row.type] : <span className="text-rose-400 italic">{getField(row.raw, "tipo", "type") || "vacío"}</span>}
                      </td>
                      <td className="px-3 py-2 text-[var(--slate-700)]">
                        {row.status === "active" ? "Activo" : row.status === "inactive" ? "Inactivo" : <span className="text-rose-400 italic">{getField(row.raw, "estado", "status") || "vacío"}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge row={row} />
                          {row.errors.map((e, i) => (
                            <span key={i} className="text-[10px] text-rose-600">{e}</span>
                          ))}
                          {row.isDuplicate && (
                            <span className="text-[10px] text-amber-600">Ya existe en el conjunto</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[var(--slate-500)]">
            {selectedCount} unidad{selectedCount !== 1 ? "es" : ""} seleccionada{selectedCount !== 1 ? "s" : ""} para importar
            {duplicateCount > 0 && " · Las duplicadas marcadas se agregarán como nuevas unidades"}
          </p>

          <div className="flex justify-between gap-2 border-t border-[var(--slate-200)] pt-3">
            <Button variant="outline" onClick={() => { setStep("map"); setRows([]); }}>
              ← Cambiar archivo
            </Button>
            <Button
              onClick={() => setStep("confirm")}
              disabled={selectedCount === 0}
            >
              Continuar ({selectedCount})
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 3: CONFIRM ────────────────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-4">
            <p className="font-medium text-[var(--slate-900)]">Resumen de importación</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[var(--slate-500)]">Unidades a crear</p>
                <p className="text-xl font-semibold text-[var(--brand-700)]">{selectedCount}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--slate-500)]">Archivo</p>
                <p className="truncate font-medium text-[var(--slate-900)]">{fileName}</p>
              </div>
            </div>
            {/* Vista previa de las primeras 5 */}
            <div className="mt-3 space-y-1">
              <p className="text-xs text-[var(--slate-500)]">Vista previa</p>
              {rows
                .filter((r) => selected.has(r.rowIndex))
                .slice(0, 5)
                .map((r) => (
                  <p key={r.rowIndex} className="text-xs text-[var(--slate-700)]">
                    · {r.displayName} — {r.tower} — {r.type ? TYPE_LABELS[r.type] : ""}
                  </p>
                ))}
              {selectedCount > 5 && (
                <p className="text-xs text-[var(--slate-400)]">
                  … y {selectedCount - 5} unidad{selectedCount - 5 !== 1 ? "es" : ""} más
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Recuerda: solo se crean las unidades físicas</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              Esta importación <strong>no vincula residentes ni propietarios</strong>. Después de confirmar,
              ve a la tabla de residentes y usa <strong>“Crear persona”</strong> para agregar al titular
              de cada unidad, uno a uno. Las unidades recién creadas ya estarán disponibles
              en el selector de unidades del formulario de persona.
            </p>
          </div>

          <div className="flex justify-between gap-2 border-t border-[var(--slate-200)] pt-3">
            <Button variant="outline" onClick={() => setStep("review")} disabled={importing}>
              ← Revisar selección
            </Button>
            <Button onClick={() => void handleImport()} disabled={importing}>
              {importing ? "Importando..." : `Importar ${selectedCount} unidades`}
            </Button>
          </div>
        </div>
      )}

      {/* ── PASO 4: DONE ───────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--slate-900)]">
              {importedCount} unidad{importedCount !== 1 ? "es" : ""} importada{importedCount !== 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--slate-500)]">
              Ya aparecen en la tabla de unidades del conjunto.
            </p>
          </div>

          {/* Próximos pasos */}
          <div className="w-full rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
              ¿Qué sigue?
            </p>
            <ol className="mt-2 space-y-2">
              <li className="flex gap-2 text-xs text-[var(--slate-700)]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-700)] text-[9px] font-bold text-white">1</span>
                <span>Cierra este panel. Las unidades ya están disponibles en la tabla.</span>
              </li>
              <li className="flex gap-2 text-xs text-[var(--slate-700)]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-700)] text-[9px] font-bold text-white">2</span>
                <span>En la sección <strong>Personas asociadas</strong>, usa <strong>“Crear persona”</strong> para agregar al propietario o inquilino de cada unidad.</span>
              </li>
              <li className="flex gap-2 text-xs text-[var(--slate-700)]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-700)] text-[9px] font-bold text-white">3</span>
                <span>Selecciona la unidad correspondiente en el formulario. Repite por cada unidad que tenga residente activo.</span>
              </li>
            </ol>
          </div>

          <Button onClick={onClose}>Cerrar</Button>
        </div>
      )}
    </div>
  );
}
