import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

// La hoja lleva fechas locales, así que la zona se fija aquí: en CI, que corre en UTC, un
// `2026-09-17 19:30` de Bogotá se leería como el 18.
process.env.TZ = "America/Bogota";

import {
  evidenciaInadmisible,
  evidenciasDeLaSolucion,
  nombreSeguro,
  rutaDeEvidencia,
} from "@/features/pqrs/evidencia-de-la-solucion";
import {
  CABECERA_DE_PQRS,
  fechaParaLaHoja,
  filasDePqrs,
  nombreDelArchivoDePqrs,
} from "@/features/pqrs/exportar-pqrs";
import { filasEnCsv, filasEnExcel } from "@/lib/export/hoja-de-calculo";
import { buildUnitIndex } from "@/utils/unitLabel";
import type { Ticket } from "@/types/domain";

const codigo = (ruta: string) => readFileSync(ruta, "utf-8");

const evidencia = (name: string) => ({
  name,
  path: `tenants/t/pqrs-evidence/tk/${name}`,
  url: `https://firebasestorage.example/${name}?token=abc`,
  size: 1024,
  contentType: "image/png",
});

const ticket = (extra: Partial<Ticket> = {}): Ticket => ({
  id: "tk-1",
  tenantId: "tenant-santa-maria",
  unitId: "u-101",
  unitLabel: "APTO 101",
  category: "pqrs",
  subject: "Fuga en el baño",
  status: "resolved",
  updatedAt: "2026-09-17T12:00:00.000Z",
  ...extra,
});

/** `L-21`, pág. 9: «adjuntar la evidencia de la solución» y «descargar en Excel el detalle». */
describe("L-21 · la evidencia de la solución", () => {
  it("acepta captura o PDF y rechaza lo demás, con motivo", () => {
    expect(evidenciaInadmisible({ type: "image/png", size: 1000 })).toBeNull();
    expect(evidenciaInadmisible({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(evidenciaInadmisible({ type: "application/zip", size: 10 })).toMatch(/imágenes|PDF/);
    expect(evidenciaInadmisible({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/MB/);
  });

  it("el nombre del archivo entra en una ruta de Storage sin acentos ni espacios", () => {
    expect(nombreSeguro("Factura de la reparación (final).pdf")).toBe("Factura-de-la-reparacion-final-.pdf");
    expect(nombreSeguro("../../etc/passwd")).toBe("etc-passwd");
    expect(nombreSeguro("   ")).toBe("evidencia");
  });

  it("la ruta cuelga del ticket y de la carpeta que la regla concede", () => {
    const ruta = rutaDeEvidencia({ tenantId: "tenant-x", ticketId: "tk-9", nombre: "foto.png", ahora: 1758000000000 });
    expect(ruta).toBe("tenants/tenant-x/pqrs-evidence/tk-9/1758000000000-foto.png");
  });

  it("enseña la del campo propio, y si no hay, la de la última respuesta con evidencia", () => {
    expect(evidenciasDeLaSolucion(ticket({ resolutionAttachments: [evidencia("a.png")] })).map((e) => e.name)).toEqual(["a.png"]);
    const soloHistorial = ticket({
      responseHistory: [
        { id: "1", message: "vamos", status: "in_progress", createdAt: "2026-09-10", createdBy: "u", attachments: [evidencia("vieja.png")] },
        { id: "2", message: "listo", status: "resolved", createdAt: "2026-09-12", createdBy: "u", attachments: [evidencia("nueva.png")] },
      ],
    });
    expect(evidenciasDeLaSolucion(soloHistorial).map((e) => e.name)).toEqual(["nueva.png"]);
  });

  it("una respuesta sin evidencia no tapa la de la anterior", () => {
    const t = ticket({
      responseHistory: [
        { id: "1", message: "con foto", status: "in_progress", createdAt: "2026-09-10", createdBy: "u", attachments: [evidencia("foto.png")] },
        { id: "2", message: "sin foto", status: "resolved", createdAt: "2026-09-12", createdBy: "u" },
      ],
    });
    expect(evidenciasDeLaSolucion(t).map((e) => e.name)).toEqual(["foto.png"]);
  });

  it("NO confunde `attachments` ni `attachmentUrl` del ticket con evidencia de la solución", () => {
    // En PQRS esos dos campos están vacíos en los 54 tickets de producción, y en otras pantallas
    // significan «el adjunto de quien publicó»: enseñarlos aquí pondría el rótulo más comprometido
    // que hay sobre el archivo equivocado.
    const t = ticket({ attachmentUrl: "https://x/foto-del-residente.png", attachments: [{ name: "suya.png", url: "https://x/suya.png" }] });
    expect(evidenciasDeLaSolucion(t)).toEqual([]);
  });

  it("descarta entradas malformadas en vez de pintar un enlace vacío", () => {
    const t = ticket({ resolutionAttachments: [{ name: "", path: "p", url: "", size: 0, contentType: "" }, evidencia("ok.png")] });
    expect(evidenciasDeLaSolucion(t).map((e) => e.name)).toEqual(["ok.png"]);
  });
});

describe("L-21 · el detalle en una hoja de cálculo", () => {
  const indice = buildUnitIndex([
    { id: "u-101", unitId: "t1-101", displayName: "T1-101", tower: "T1" },
    { id: "G1bWNzZJuakw9KRoAx7p", unitId: "t1-403", displayName: "T1-403", tower: "T1" },
  ] as never);
  const nombres = new Map([["uid-ana", "Ana Pérez"]]);

  it("la cabecera es la del módulo y hay una fila por ticket", () => {
    const filas = filasDePqrs([ticket(), ticket({ id: "tk-2" })], indice, nombres);
    expect(filas[0]).toEqual([...CABECERA_DE_PQRS]);
    expect(filas).toHaveLength(3);
  });

  it("resuelve unidad y persona con las MISMAS funciones que la pantalla (`L-21d`)", () => {
    const sucio = ticket({
      unitId: "G1bWNzZJuakw9KRoAx7p",
      unitLabel: "torre1-G1bWNzZJuakw9KRoAx7p",
      residentId: "uid-ana",
      residentName: "Residente",
    });
    const fila = filasDePqrs([sucio], indice, nombres)[1];
    expect(fila[1]).toBe("T1-403");
    expect(fila[1]).not.toContain("G1bWNzZJuakw9KRoAx7p");
    expect(fila[2]).toBe("Ana Pérez");
  });

  it("sin prioridad la celda va VACÍA: el ticket nació sin ese eje y «Media» sería un invento", () => {
    expect(filasDePqrs([ticket()], indice, nombres)[1][5]).toBe("");
    expect(filasDePqrs([ticket({ priority: "high" })], indice, nombres)[1][5]).toBe("Alta");
  });

  it("las fechas van en `YYYY-MM-DD HH:mm` locales, que ninguna hoja reinterpreta", () => {
    expect(fechaParaLaHoja("2026-09-18T00:30:00.000Z")).toBe("2026-09-17 19:30");
    expect(fechaParaLaHoja(undefined)).toBe("");
    expect(fechaParaLaHoja("no es fecha")).toBe("");
    expect(nombreDelArchivoDePqrs(new Date("2026-09-18T00:30:00.000Z"))).toBe("pqrs-2026-09-17");
  });

  it("en la hoja van los NOMBRES de la evidencia, no sus URLs con token", () => {
    const fila = filasDePqrs([ticket({ resolutionAttachments: [evidencia("acta.pdf"), evidencia("foto.png")] })], indice, nombres)[1];
    expect(fila[13]).toBe("acta.pdf · foto.png");
    expect(fila[13]).not.toContain("token");
  });

  it("una respuesta con comas y saltos de línea NO corre las columnas del CSV", () => {
    // La fila va COMPLETA a propósito: con celdas vacías al principio o al final, releerla no
    // distinguiría «columna corrida» de «celda vacía que la hoja no escribe».
    const filas = filasDePqrs(
      [
        ticket({
          radicado: "PQRS-000123",
          type: "complaint",
          priority: "high",
          message: "Gotea desde el martes",
          radicationDate: "2026-09-10T15:00:00.000Z",
          respondedAt: "2026-09-12T15:00:00.000Z",
          response: 'Se cambió el sifón, la llave y el empaque\nQuedó "sellado"',
          respondedByName: "Marta",
          resolutionAttachments: [evidencia("acta.pdf")],
        }),
      ],
      indice,
      nombres,
    );
    const csv = filasEnCsv(filas);
    expect(csv).toContain('"Se cambió el sifón, la llave y el empaque\nQuedó ""sellado"""');
    // **La prueba de verdad: releer el CSV y comprobar que las columnas no se corrieron.** Con un
    // `join(",")` la respuesta partiría la fila en tres y «Marta» acabaría en otra columna.
    const releido = XLSX.utils.sheet_to_json<string[]>(
      XLSX.read(csv, { type: "string" }).Sheets.Sheet1,
      { header: 1, raw: false },
    );
    expect(releido).toHaveLength(2);
    expect(releido[1]).toHaveLength(CABECERA_DE_PQRS.length);
    expect(releido[1][11]).toBe("Marta");
    expect(releido[1][12]).toContain("la llave y el empaque");
  });

  it("el Excel se lee de vuelta con las mismas celdas", () => {
    const filas = filasDePqrs([ticket({ response: "Con, coma" })], indice, nombres);
    const libro = XLSX.read(filasEnExcel(filas, "PQRS"), { type: "array" });
    const leidas = XLSX.utils.sheet_to_json<string[]>(libro.Sheets.PQRS, { header: 1, raw: false });
    expect(leidas[0]).toEqual([...CABECERA_DE_PQRS]);
    expect(leidas[1][12]).toBe("Con, coma");
  });
});

describe("L-21 · los sitios del camino", () => {
  it("la pantalla baja lo FILTRADO, no la colección entera", () => {
    expect(codigo("src/app/(admin)/admin/pqrs/page.tsx")).toContain("descargarPqrs(filteredItems");
  });

  it("`respondTicket` escribe la evidencia en el ticket y en la entrada del historial", () => {
    const fuente = codigo("src/features/pqrs/use-tickets.ts");
    expect(fuente).toContain("resolutionAttachments: evidencias");
    expect(fuente).toContain("attachments: evidencias");
  });

  it("el residente ve la evidencia de su ticket", () => {
    expect(codigo("src/app/(resident)/resident/pqrs/page.tsx")).toContain("evidenciasDeLaSolucion(ticket)");
  });

  it("la carpeta de Storage existe y es SOLO de administración", () => {
    const reglas = codigo("storage.rules");
    const desde = reglas.indexOf("match /tenants/{tenantId}/pqrs-evidence");
    expect(desde).toBeGreaterThan(-1);
    // Hasta el siguiente `match`, que es donde acaba el bloque: cortar por la primera `}` cortaría
    // dentro de `{tenantId}` y la prueba pasaría sin leer una sola línea de permiso.
    const cierre = reglas.slice(desde, reglas.indexOf("match /", desde + 10));
    expect(cierre).toContain("allow read: if admin(tenantId)");
    expect(cierre).not.toContain("miembro(");
    // Y no está en las dos listas anchas, que conceden por carpeta.
    expect(reglas).not.toContain("'pqrs-evidence'");
  });

  it("el escritor de Excel vive en UN solo sitio", () => {
    const plantillas = codigo("src/lib/import/plantillas.ts");
    expect(plantillas).not.toContain("XLSX.write");
    expect(plantillas).toContain("filasEnExcel");
    expect(codigo("src/features/pqrs/exportar-pqrs.ts")).not.toContain("XLSX.write");
  });
});
