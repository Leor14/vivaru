"use client";

/**
 * Paso de mapeo de columnas — `PRD-V-FEAT-002`, segundo incremento.
 *
 * **POR QUÉ EXISTE.** Hasta ahora el importador solo funcionaba si el archivo
 * traía los encabezados de la plantilla de Vivaru. Un archivo con «No. Depto» o
 * «NOMBRE DEL PROPIETARIO» —que es lo que exporta cualquier administradora—
 * devolvía filas vacías con error y **no había forma de decir qué columna era
 * cuál**. Este paso es esa forma.
 *
 * **SE LISTA POR CAMPO DESTINO, NO POR COLUMNA DEL ARCHIVO**, y la decisión se
 * tomó mirando las dos maquetas. Listar por columna enseña el archivo de la
 * persona, que es más reconocible, pero tiene dos problemas: se puede recorrer
 * la lista entera sin notar que faltó un obligatorio, y un export de treinta
 * columnas —saldos, fechas, notas— convierte la pantalla en treinta filas para
 * llenar seis campos. Listando por campo destino **siempre son los campos que
 * hacen falta y ni uno más**, y saltarse un obligatorio es imposible.
 *
 * **De la otra variante se injertó lo que la hacía reconocible:** cada columna
 * enseña una muestra de sus datos. Se elige «No. Depto» viendo que dentro dice
 * `A-101, A-102`, no adivinando por el nombre.
 */

import { useMemo } from "react";

import {
  fieldsFor,
  mappingIssues,
  missingRequired,
  type AcceptedValues,
  type ImportEntity,
} from "@/lib/import/field-catalog";

type Props = {
  entity: ImportEntity;
  /** Encabezados del archivo, en su orden original. */
  headers: readonly string[];
  /** Filas crudas, solo para enseñar muestras de cada columna. */
  rows: readonly Record<string, string>[];
  mapping: Record<string, string | null>;
  onChange: (mapping: Record<string, string | null>) => void;
  /**
   * Hojas del libro. Un CSV trae una sola y entonces el selector no se enseña:
   * ofrecer «elige hoja» con una única opción es ruido.
   */
  sheetNames?: readonly string[];
  sheetName?: string;
  onSheetChange?: (name: string) => void;
  /**
   * Valores que acepta cada campo, para avisar cuando la columna elegida es
   * inequívocamente otra cosa. Los pone el asistente desde sus propias tablas
   * de alias; aquí no se declara ninguna lista.
   */
  accepted?: AcceptedValues;
};

/**
 * Los primeros valores no vacíos de una columna. Tres bastan para reconocerla y
 * no desbordan la fila; con más, la pantalla se vuelve una tabla y deja de ser
 * un paso de mapeo.
 */
function sampleOf(rows: readonly Record<string, string>[], header: string): string {
  const values: string[] = [];
  for (const row of rows) {
    const value = (row[header] ?? "").trim();
    if (value) values.push(value);
    if (values.length === 3) break;
  }
  return values.join(", ");
}

export function ColumnMappingStep({
  entity,
  headers,
  rows,
  mapping,
  onChange,
  sheetNames = [],
  sheetName,
  onSheetChange,
  accepted = {},
}: Props) {
  const fields = fieldsFor(entity);
  const missing = missingRequired(mapping, entity);
  const avisos = mappingIssues(rows, entity, mapping, accepted);
  const varias = sheetNames.length > 1 && Boolean(onSheetChange);

  // Una columna no puede alimentar dos campos (`RN-02`). En vez de vigilarlo
  // después, se quita de los desplegables de los demás: el estado inválido no
  // se puede ni construir.
  const taken = useMemo(
    () => new Set(Object.values(mapping).filter((h): h is string => Boolean(h))),
    [mapping],
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--slate-800)]">
          ¿Qué columna de tu archivo trae cada dato?
        </p>
        <p className="mt-1 text-sm text-[var(--slate-600)]">
          Ya rellenamos las que reconocimos. Revisa el resto — los datos de cada columna te
          ayudan a identificarla.
        </p>
      </div>

      {varias && (
        <div className="rounded-lg border border-[var(--slate-200)] bg-[var(--slate-50)] px-3 py-2">
          <label
            htmlFor="map-sheet"
            className="block text-xs font-medium text-[var(--slate-700)]"
          >
            Hoja del libro
          </label>
          <select
            id="map-sheet"
            value={sheetName}
            onChange={(e) => onSheetChange?.(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 py-2 text-sm text-[var(--slate-800)]"
          >
            {sheetNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--slate-500)]">
            Cambiar de hoja vuelve a proponer el mapeo con sus columnas.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {fields.map((field) => {
          const value = mapping[field.key] ?? "";
          const muestra = value ? sampleOf(rows, value) : "";

          return (
            <div
              key={field.key}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-start"
            >
              <label
                htmlFor={`map-${field.key}`}
                className="pt-2 text-sm text-[var(--slate-700)]"
              >
                {field.label}
                {field.required && <span className="ml-0.5 text-rose-500">*</span>}
              </label>

              <div>
                <select
                  id={`map-${field.key}`}
                  value={value}
                  onChange={(e) => onChange({ ...mapping, [field.key]: e.target.value || null })}
                  className="w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 py-2 text-sm text-[var(--slate-800)]"
                >
                  <option value="">
                    {field.required ? "Elegir columna…" : "Sin asignar (opcional)"}
                  </option>
                  {headers
                    .filter((h) => h === value || !taken.has(h))
                    .map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                </select>

                {muestra && (
                  <p className="mt-1 truncate text-xs text-[var(--slate-500)]" title={muestra}>
                    {muestra}
                  </p>
                )}

                {avisos[field.key] && (
                  <p
                    className={`mt-1 text-xs ${
                      avisos[field.key]!.nivel === "bloquea" ? "text-rose-600" : "text-amber-700"
                    }`}
                  >
                    {avisos[field.key]!.mensaje}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Falta asignar {missing.length === 1 ? "un dato obligatorio" : `${missing.length} datos obligatorios`}:{" "}
          {missing.map((f) => f.label).join(", ")}.
        </p>
      )}
    </div>
  );
}
