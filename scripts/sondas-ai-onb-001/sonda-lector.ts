/**
 * Sonda del LECTOR (read-tabular) — el caso que el mapeador hereda:
 * un XLSX real con fila de título encima de los encabezados.
 */
import * as XLSX from "xlsx";
import { readTabularFile } from "../../src/lib/import/read-tabular";
import { suggestMapping, missingRequired } from "../../src/lib/import/field-catalog";

// Hoja como la exporta una administración: título en A1 (celda combinada en
// el original), fila en blanco, y los encabezados reales en la fila 3.
const matriz = [
  ["PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES", "", "", "", ""],
  ["", "", "", "", ""],
  ["Unidad", "Nombre", "Correo", "Teléfono", "Rol"],
  ["T1-101", "Ana Pérez", "ana@x.com", "3001112233", "propietario"],
  ["T1-102", "Luis Gómez", "luis@x.com", "3004445566", "inquilino"],
  ["T2-201", "Carla Soto", "carla@x.com", "3007778899", "propietario"],
];

const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), "Padrón");
const buffer: ArrayBuffer = XLSX.write(libro, { type: "array", bookType: "xlsx" });

async function main() {
const file = new File([buffer], "padron.xlsx");
const leido = await readTabularFile(file);
const hoja = leido.sheets[leido.sheetNames[0]];

console.log("Encabezados que ve el asistente:", JSON.stringify(hoja.headers));
console.log("Filas:", hoja.rows.length);
console.log("Primera fila:", JSON.stringify(hoja.rows[0]));

const m = suggestMapping(hoja.headers, "person", {
  rows: hoja.rows,
  accepted: { "person.role": ["propietario", "inquilino", "arrendatario", "residente", "dueno", "otro"] },
});
console.log("\nMapeo sugerido:");
for (const [campo, a] of Object.entries(m)) {
  console.log(`  ${campo.padEnd(22)} ← ${a === null ? "∅" : a.headers.map((h) => `«${h}»`).join(" + ")}`);
}
const faltan = missingRequired(m, "person");
console.log(
  faltan.length === 0
    ? "✔ ningún obligatorio sin mapear"
    : `✘ OBLIGATORIOS SIN MAPEAR: ${faltan.map((f) => f.label).join(", ")}`,
);
}
void main();
