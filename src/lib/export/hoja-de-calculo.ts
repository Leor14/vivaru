import * as XLSX from "xlsx";

/**
 * **Una hoja de cálculo, en Excel o en CSV. El único sitio del repositorio que escribe `xlsx`.**
 *
 * Nació con las plantillas de la carga masiva (`L-02`) dentro de `lib/import/plantillas.ts`, y salió
 * de allí al necesitarla la exportación de PQRS (`L-21`): dejar dos copias del escritor de Excel es
 * el gemelo que este repositorio ya ha pagado varias veces. `plantillas.ts` llama a estas.
 *
 * **La diferencia que importa está en el CSV: aquí se entrecomilla de verdad.** Una plantilla no
 * lleva comas —sus valores son `T1-101`, `apartamento`—, pero la respuesta de un PQRS sí lleva
 * comas, comillas y saltos de línea, y un `join(",")` partiría la fila y correría las columnas sin
 * dar ningún error. El entrecomillado solo se aplica cuando hace falta, así que las plantillas
 * salen byte a byte como antes.
 */

export type FilasDeHoja = readonly (readonly string[])[];

/** RFC 4180: se entrecomilla si el valor lleva coma, comilla, salto de línea o espacios al borde. */
function celda(valor: string): string {
  if (!/[",\r\n]|^\s|\s$/.test(valor)) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

export function filasEnCsv(filas: FilasDeHoja): string {
  return filas.map((fila) => fila.map((v) => celda(String(v ?? ""))).join(",")).join("\r\n");
}

export function filasEnExcel(filas: FilasDeHoja, hoja: string): ArrayBuffer {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas.map((fila) => [...fila])), hoja);
  return XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export type FormatoDeHoja = "xlsx" | "csv";

export function descargarFilas(
  filas: FilasDeHoja,
  nombreBase: string,
  formato: FormatoDeHoja,
  hoja = "Hoja1",
) {
  const blob =
    formato === "xlsx"
      ? new Blob([filasEnExcel(filas, hoja)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      : new Blob([filasEnCsv(filas)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreBase}.${formato}`;
  a.click();
  URL.revokeObjectURL(url);
}
