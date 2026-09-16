import * as XLSX from "xlsx";

import { ETIQUETA_DE_TIPO, TIPOS_DE_UNIDAD } from "@/lib/units/tipos";

/**
 * **`L-02` — las plantillas de la carga masiva, en un solo sitio y en los dos formatos.**
 *
 * Lote «Análisis de la plataforma», plan `docs/plan-lote-analisis-plataforma.md` (T3.2). La
 * administradora pedía el formato de la carga masiva en Excel, y los asistentes solo daban un CSV
 * cuyos ejemplos no traían parqueaderos ni bodegas, aunque el importador los acepta desde el 1 de
 * septiembre de 2026 (`src/lib/units/tipos.ts`).
 *
 * Los valores de ejemplo van en español y son los que el importador reconoce: si uno deja de
 * resolver, `tests/plantillas-de-importacion.test.ts` enrojece.
 */

export type FilasDePlantilla = readonly (readonly string[])[];

export const PLANTILLA_DE_UNIDADES: FilasDePlantilla = [
  ["nombre", "torre", "tipo", "estado"],
  ["T1-101", "T1", "apartamento", "activo"],
  ["T1-102", "T1", "apartamento", "activo"],
  ["T2-201", "T2", "casa", "activo"],
  ["Local-01", "Local", "oficina", "activo"],
  ["P-012", "Parqueaderos", "parqueadero", "activo"],
  ["B-003", "Bodegas", "bodega", "activo"],
];

export const PLANTILLA_DE_RESIDENTES: FilasDePlantilla = [
  ["nombre", "email", "telefono", "documento", "unidad", "rol"],
  ["Ana Pérez", "ana@correo.com", "3001234567", "12345678", "T1-101", "propietario"],
  ["Luis Gómez", "luis@correo.com", "3009876543", "87654321", "T1-102", "inquilino"],
];

/** Los tipos de unidad que acepta el importador, con su rótulo: salen del catálogo, no a mano. */
export const TIPOS_PARA_LA_PLANTILLA = TIPOS_DE_UNIDAD.map((clave) => ({
  clave,
  etiqueta: ETIQUETA_DE_TIPO[clave],
}));

export function plantillaEnCsv(filas: FilasDePlantilla): string {
  return filas.map((fila) => fila.join(",")).join("\r\n");
}

export function plantillaEnExcel(filas: FilasDePlantilla, hoja: string): ArrayBuffer {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas.map((fila) => [...fila])), hoja);
  return XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export type FormatoDePlantilla = "xlsx" | "csv";

export function descargarPlantilla(filas: FilasDePlantilla, nombreBase: string, formato: FormatoDePlantilla) {
  const blob =
    formato === "xlsx"
      ? new Blob([plantillaEnExcel(filas, "Plantilla")], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      : new Blob([plantillaEnCsv(filas)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreBase}.${formato}`;
  a.click();
  URL.revokeObjectURL(url);
}
