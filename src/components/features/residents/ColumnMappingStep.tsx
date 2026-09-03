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
 *
 * **Desde `PRD-V-FEAT-006` un campo admite VARIAS columnas** (solo los de
 * `person` que lo declaran): «Nombres» + «Apellidos» entran unidas por un
 * separador, y la muestra enseña el valor unido, no la primera columna (`CA7`).
 * Unir es siempre un acto de la persona —la sugerencia nunca lo hace sola— y
 * donde el sistema ya avisa de que la unidad viene partida, el aviso ofrece
 * la unión con un botón (`CA10`).
 */

import { useMemo, useState } from "react";

import {
  MAX_LARGO_DE_SEPARADOR,
  SEPARADOR_POR_DEFECTO,
  columnasDe,
  fieldsFor,
  mappingIssues,
  missingRequired,
  unir,
  type AcceptedValues,
  type Asignacion,
  type ImportEntity,
  type Mapping,
} from "@/lib/import/field-catalog";

type Props = {
  entity: ImportEntity;
  /** Encabezados del archivo, en su orden original. */
  headers: readonly string[];
  /** Filas crudas, solo para enseñar muestras de cada columna. */
  rows: readonly Record<string, string>[];
  mapping: Mapping;
  onChange: (mapping: Mapping) => void;
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
 * Los separadores con nombre. El cuarto es «Otro…», que abre una caja de texto
 * corta (`RN-U7`). El espacio va primero porque es el de los nombres, que son
 * el caso frecuente de `person`.
 */
const SEPARADORES: readonly { valor: string; rotulo: string }[] = [
  { valor: " ", rotulo: "Espacio" },
  { valor: "-", rotulo: "Guion" },
  { valor: "", rotulo: "Sin separador" },
];
const SEPARADOR_PROPIO = "propio";

/**
 * Los primeros valores no vacíos del campo. Tres bastan para reconocerlo y no
 * desbordan la fila; con más, la pantalla se vuelve una tabla y deja de ser un
 * paso de mapeo. **Es el valor UNIDO**, que es lo único que delata un orden
 * invertido —«Pérez Ana»— antes de importar (`CA7`, §12 de `FEAT-006`).
 */
function sampleOf(rows: readonly Record<string, string>[], asignacion: Asignacion): string {
  const values: string[] = [];
  for (const row of rows) {
    const value = unir(row, asignacion);
    if (value) values.push(value);
    if (values.length === 3) break;
  }
  return values.join(", ");
}

const SELECT =
  "w-full rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--slate-800)]";
const BOTON_PEQUENO =
  "rounded-md border border-[var(--slate-200)] px-2 py-1 text-xs text-[var(--slate-600)] hover:bg-[var(--slate-50)]";

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

  // Una columna no puede alimentar dos campos (`RN-U2`). En vez de vigilarlo
  // después, se quita de los desplegables de los demás: el estado inválido no
  // se puede ni construir. Con uniones, «usada» es cualquier columna de
  // cualquier campo, no solo la primera.
  const taken = useMemo(() => new Set(columnasDe(mapping)), [mapping]);

  // Campos cuyo separador se está escribiendo a mano. Es estado de pantalla y
  // no del mapeo: mientras la caja dice «-» el separador ES un guion, pero la
  // persona eligió «Otro…» y la caja tiene que seguir abierta.
  const [propio, setPropio] = useState<Record<string, boolean>>({});

  function asignar(key: string, asignacion: Asignacion | null) {
    onChange({ ...mapping, [key]: asignacion });
  }

  /** Cambia la columna `i` del campo; vacía la quita. Sin columnas, el campo queda sin asignar. */
  function cambiarColumna(key: string, i: number, header: string) {
    const actual = mapping[key] ?? { headers: [], separador: SEPARADOR_POR_DEFECTO };
    const columnas = [...actual.headers];
    if (header) columnas[i] = header;
    else columnas.splice(i, 1);
    asignar(key, columnas.length > 0 ? { ...actual, headers: columnas } : null);
  }

  /** Añade una columna AL FINAL: el orden de unión es el orden en que se añaden (`RN-U1`). */
  function anadirColumna(key: string, header: string) {
    const actual = mapping[key];
    if (!actual || !header) return;
    asignar(key, { ...actual, headers: [...actual.headers, header] });
  }

  function subirColumna(key: string, i: number) {
    const actual = mapping[key];
    if (!actual || i === 0) return;
    const columnas = [...actual.headers];
    [columnas[i - 1], columnas[i]] = [columnas[i], columnas[i - 1]];
    asignar(key, { ...actual, headers: columnas });
  }

  function cambiarSeparador(key: string, separador: string) {
    const actual = mapping[key];
    if (!actual) return;
    asignar(key, { ...actual, separador });
  }

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
            className={`mt-1 ${SELECT}`}
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
          const asignacion = mapping[field.key] ?? null;
          const columnas = asignacion?.headers ?? [];
          const unida = columnas.length > 1;
          const libres = headers.filter((h) => !taken.has(h));
          const muestra = asignacion ? sampleOf(rows, asignacion) : "";
          const aviso = avisos[field.key];
          const separadorConNombre = SEPARADORES.some((s) => s.valor === asignacion?.separador);
          const escribiendoSeparador = unida && (propio[field.key] || !separadorConNombre);

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
                {field.required && <span className="ml-0.5 text-[var(--danger-500)]">*</span>}
              </label>

              <div>
                {(columnas.length > 0 ? columnas : [""]).map((h, i) => (
                  <div key={i} className={`flex items-center gap-1 ${i > 0 ? "mt-1" : ""}`}>
                    <select
                      id={i === 0 ? `map-${field.key}` : `map-${field.key}-${i + 1}`}
                      aria-label={i > 0 ? `Columna ${i + 1} de ${field.label}` : undefined}
                      value={h}
                      onChange={(e) => cambiarColumna(field.key, i, e.target.value)}
                      className={SELECT}
                    >
                      <option value="">
                        {i > 0
                          ? "Quitar esta columna"
                          : field.required
                            ? "Elegir columna…"
                            : "Sin asignar (opcional)"}
                      </option>
                      {headers
                        .filter((x) => x === h || !taken.has(x))
                        .map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                    </select>
                    {i > 0 && (
                      <button
                        type="button"
                        className={BOTON_PEQUENO}
                        aria-label={`Subir «${h}» en ${field.label}`}
                        title="Subir"
                        onClick={() => subirColumna(field.key, i)}
                      >
                        ↑
                      </button>
                    )}
                    {unida && (
                      <button
                        type="button"
                        className={BOTON_PEQUENO}
                        aria-label={`Quitar «${h}» de ${field.label}`}
                        title="Quitar"
                        onClick={() => cambiarColumna(field.key, i, "")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                {field.admiteUnion && columnas.length > 0 && libres.length > 0 && (
                  <select
                    value=""
                    aria-label={`Añadir otra columna a ${field.label}`}
                    onChange={(e) => anadirColumna(field.key, e.target.value)}
                    className="mt-1 rounded-md border border-dashed border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 py-1 text-xs text-[var(--slate-600)]"
                  >
                    <option value="">＋ añadir otra columna…</option>
                    {libres.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                )}

                {unida && asignacion && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--slate-600)]">
                    <label htmlFor={`sep-${field.key}`}>Unir con</label>
                    <select
                      id={`sep-${field.key}`}
                      value={escribiendoSeparador ? SEPARADOR_PROPIO : asignacion.separador}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === SEPARADOR_PROPIO) {
                          setPropio({ ...propio, [field.key]: true });
                        } else {
                          setPropio({ ...propio, [field.key]: false });
                          cambiarSeparador(field.key, v);
                        }
                      }}
                      className="rounded-md border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-1 text-xs text-[var(--slate-800)]"
                    >
                      {SEPARADORES.map((s) => (
                        <option key={s.rotulo} value={s.valor}>
                          {s.rotulo}
                        </option>
                      ))}
                      <option value={SEPARADOR_PROPIO}>Otro…</option>
                    </select>
                    {escribiendoSeparador && (
                      <input
                        id={`sep-propio-${field.key}`}
                        aria-label={`Separador propio de ${field.label}`}
                        maxLength={MAX_LARGO_DE_SEPARADOR}
                        value={asignacion.separador}
                        onChange={(e) => cambiarSeparador(field.key, e.target.value)}
                        className="w-20 rounded-md border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-1 text-xs text-[var(--slate-800)]"
                      />
                    )}
                  </div>
                )}

                {muestra && (
                  <p className="mt-1 truncate text-xs text-[var(--slate-500)]" title={muestra}>
                    {muestra}
                  </p>
                )}

                {aviso && (
                  <div
                    className={`mt-1 text-xs ${
                      aviso.nivel === "bloquea" ? "text-[var(--danger-600)]" : "text-[var(--amber-700)]"
                    }`}
                  >
                    <p>{aviso.mensaje}</p>
                    {aviso.oferta && (
                      <button
                        type="button"
                        className={`${BOTON_PEQUENO} mt-1 font-medium text-[var(--slate-800)]`}
                        onClick={() => asignar(field.key, aviso.oferta ?? null)}
                      >
                        Unir {aviso.oferta.headers.map((h) => `«${h}»`).join(" y ")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <p className="rounded-lg bg-[var(--amber-50)] px-3 py-2 text-sm text-[var(--amber-800)]">
          Falta asignar {missing.length === 1 ? "un dato obligatorio" : `${missing.length} datos obligatorios`}:{" "}
          {missing.map((f) => f.label).join(", ")}.
        </p>
      )}
    </div>
  );
}
