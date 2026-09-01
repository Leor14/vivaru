import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  MAX_ROWS,
  TabularReadError,
  readTabularFile,
} from "@/lib/import/read-tabular";

/**
 * `PRD-V-FEAT-002` · XLSX con selección de hoja y `RN-08`.
 *
 * Lo que estas pruebas protegen no es «que lea un Excel»: es que los dos
 * formatos entreguen **exactamente la misma forma**, para que los asistentes no
 * tengan que saber cuál subieron. Cuando esa forma se separa, el fallo aparece
 * en un solo formato y se lee como «a veces no funciona».
 */

function archivoCsv(texto: string, nombre = "padron.csv"): File {
  return new File([texto], nombre, { type: "text/csv" });
}

function archivoXlsx(hojas: Record<string, string[][]>, nombre = "padron.xlsx"): File {
  const libro = XLSX.utils.book_new();
  for (const [hoja, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), hoja);
  }
  const buffer = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buffer], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("los dos formatos entregan la misma forma", () => {
  it("un CSV es un libro de una sola hoja", async () => {
    const leido = await readTabularFile(archivoCsv("nombre,torre\nT1-101,T1\nT1-102,T1"));
    expect(leido.sheetNames).toHaveLength(1);
    const hoja = leido.sheets[leido.sheetNames[0]];
    expect(hoja.headers).toEqual(["nombre", "torre"]);
    expect(hoja.rows).toEqual([
      { nombre: "T1-101", torre: "T1" },
      { nombre: "T1-102", torre: "T1" },
    ]);
  });

  it("un XLSX de una hoja da lo mismo que el CSV equivalente", async () => {
    const csv = await readTabularFile(archivoCsv("nombre,torre\nT1-101,T1"));
    const xlsx = await readTabularFile(
      archivoXlsx({ Hoja1: [["nombre", "torre"], ["T1-101", "T1"]] }),
    );
    expect(xlsx.sheets["Hoja1"]).toEqual(csv.sheets[csv.sheetNames[0]]);
  });
});

describe("selección de hoja", () => {
  it("un libro de tres hojas ofrece las tres", async () => {
    const leido = await readTabularFile(
      archivoXlsx({
        Unidades: [["nombre"], ["T1-101"]],
        Residentes: [["nombre", "email"], ["Ana", "ana@correo.com"]],
        Saldos: [["unidad", "saldo"], ["T1-101", "120000"]],
      }),
    );
    expect(leido.sheetNames).toEqual(["Unidades", "Residentes", "Saldos"]);
    expect(leido.sheets["Residentes"].headers).toEqual(["nombre", "email"]);
  });

  it("una hoja vacía o solo con encabezados no se ofrece", async () => {
    // Elegirla llevaría a un mapeo sin nada que mapear.
    const leido = await readTabularFile(
      archivoXlsx({ Datos: [["nombre"], ["T1-101"]], Notas: [["encabezado sin filas"]] }),
    );
    expect(leido.sheetNames).toEqual(["Datos"]);
  });

  it("un libro sin ninguna hoja con datos falla con un mensaje legible", async () => {
    await expect(readTabularFile(archivoXlsx({ Vacia: [["solo encabezado"]] }))).rejects.toThrow(
      TabularReadError,
    );
  });
});

describe("lo que se corrompe en silencio si no se cuida", () => {
  it("un código con ceros a la izquierda no los pierde", async () => {
    const leido = await readTabularFile(
      archivoXlsx({ H: [["documento"], ["0012345"]] }),
    );
    expect(leido.sheets["H"].rows[0].documento).toBe("0012345");
  });

  it("dos columnas con el mismo nombre no se pisan", async () => {
    const leido = await readTabularFile(
      archivoXlsx({ H: [["telefono", "telefono"], ["300", "301"]] }),
    );
    expect(leido.sheets["H"].headers).toEqual(["telefono", "telefono (2)"]);
    expect(leido.sheets["H"].rows[0]).toEqual({ telefono: "300", "telefono (2)": "301" });
  });
});

describe("RN-08 · el tope de filas", () => {
  it(`rechaza un archivo de ${MAX_ROWS + 1} filas y dice cómo partirlo`, async () => {
    const filas = ["nombre"].concat(Array.from({ length: MAX_ROWS + 1 }, (_, i) => `U-${i}`));
    await expect(readTabularFile(archivoCsv(filas.join("\n")))).rejects.toThrow(/máximo/i);
  });

  it(`acepta ${MAX_ROWS} exactas`, async () => {
    const filas = ["nombre"].concat(Array.from({ length: MAX_ROWS }, (_, i) => `U-${i}`));
    const leido = await readTabularFile(archivoCsv(filas.join("\n")));
    expect(leido.sheets[leido.sheetNames[0]].rows).toHaveLength(MAX_ROWS);
  });
});

describe("archivos que no sirven", () => {
  it("un CSV sin encabezados falla con mensaje legible", async () => {
    await expect(readTabularFile(archivoCsv(""))).rejects.toThrow(TabularReadError);
  });
});

/**
 * `AI-ONB-001` · la fila de título encima de los encabezados.
 *
 * Medido el 1 de septiembre de 2026 contra este lector: un XLSX con el título
 * de la administración en A1 convertía **el título en encabezado y los
 * encabezados reales en datos**, y el paso de mapeo llegaba a proponer «PADRÓN
 * GENERAL DE PROPIETARIOS» como correo electrónico. El archivo estaba bien; lo
 * que fallaba era la suposición de que los encabezados viven en la fila 0.
 */
describe("dónde empiezan los encabezados de verdad", () => {
  const conTitulo = [
    ["PADRÓN GENERAL DE PROPIETARIOS — CONJUNTO LOS ROBLES", "", "", ""],
    ["", "", "", ""],
    ["Unidad", "Nombre", "Correo", "Rol"],
    ["T1-101", "Ana Pérez", "ana@x.com", "propietario"],
    ["T1-102", "Luis Gómez", "luis@x.com", "inquilino"],
  ];

  it("un XLSX con título y fila en blanco encima encuentra los encabezados", async () => {
    const leido = await readTabularFile(archivoXlsx({ "Padrón": conTitulo }));
    const hoja = leido.sheets["Padrón"];
    expect(hoja.headers).toEqual(["Unidad", "Nombre", "Correo", "Rol"]);
    expect(hoja.rows).toHaveLength(2);
    expect(hoja.rows[0]).toEqual({
      Unidad: "T1-101",
      Nombre: "Ana Pérez",
      Correo: "ana@x.com",
      Rol: "propietario",
    });
  });

  it("y el CSV equivalente hace exactamente lo mismo — el defecto era de los DOS", async () => {
    // El título sobrevive a «Guardar como CSV», así que arreglar solo el XLSX
    // habría dejado el gemelo roto.
    const texto = conTitulo.map((f) => f.join(",")).join("\n");
    const leido = await readTabularFile(archivoCsv(texto));
    const hoja = leido.sheets[leido.sheetNames[0]];
    expect(hoja.headers).toEqual(["Unidad", "Nombre", "Correo", "Rol"]);
    expect(hoja.rows).toHaveLength(2);
  });

  it("un archivo normal no cambia: la fila 0 sigue siendo la de encabezados", async () => {
    const leido = await readTabularFile(
      archivoXlsx({ H: [["Unidad", "Nombre"], ["T1-101", "Ana"]] }),
    );
    expect(leido.sheets["H"].headers).toEqual(["Unidad", "Nombre"]);
    expect(leido.sheets["H"].rows).toHaveLength(1);
  });

  it("un archivo de UNA sola columna conserva su encabezado", async () => {
    // Ninguna fila llega a dos celdas con texto, así que la regla se retira y
    // vuelve la fila 0. Sin esta salida, un archivo de una columna se quedaría
    // sin encabezados.
    const leido = await readTabularFile(archivoCsv("documento\n0012345\n0067890"));
    const hoja = leido.sheets[leido.sheetNames[0]];
    expect(hoja.headers).toEqual(["documento"]);
    expect(hoja.rows.map((r) => r.documento)).toEqual(["0012345", "0067890"]);
  });

  it("una hoja con título y encabezados pero SIN datos no se ofrece", async () => {
    await expect(
      readTabularFile(
        archivoXlsx({ H: [["PADRÓN GENERAL", "", ""], ["Unidad", "Nombre", "Correo"]] }),
      ),
    ).rejects.toThrow(TabularReadError);
  });
});
