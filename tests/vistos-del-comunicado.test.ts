import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// «Antes del registro» se decide por el día LOCAL: en UTC, un comunicado publicado el 17 a las
// 19:00 de Bogotá ya sería del 18 y dejaría de decir «sin registro».
process.env.TZ = "America/Bogota";

import {
  anteriorAlRegistro,
  claveDeLectura,
  LECTURAS_DESDE,
  resumenDeLecturas,
  textoDeVistos,
  type LecturaDeComunicado,
} from "@/features/communications/lectura-del-comunicado";

const codigo = (ruta: string) => readFileSync(ruta, "utf-8");

const lectura = (communicationId: string, uid: string, name?: string): LecturaDeComunicado => ({
  id: `${communicationId}_${uid}`,
  tenantId: "tenant-santa-maria",
  communicationId,
  uid,
  ...(name ? { name } : {}),
});

/** `L-13`, pág. 5: «Sería bueno saber cuántas personas vieron el comunicado». */
describe("L-13 · cuántas personas vieron un comunicado", () => {
  it("el id lleva los dos lados: una persona no puede contar dos veces", () => {
    expect(claveDeLectura("com-1", "uid-ana")).toBe("com-1_uid-ana");
  });

  it("cuenta PERSONAS, no escrituras", () => {
    const resumen = resumenDeLecturas([
      lectura("com-1", "uid-ana", "Ana Pérez"),
      lectura("com-1", "uid-ana", "Ana Pérez"),
      lectura("com-1", "uid-beto", "Beto Ruiz"),
      lectura("com-2", "uid-ana", "Ana Pérez"),
    ]);
    expect(resumen.get("com-1")?.total).toBe(2);
    expect(resumen.get("com-2")?.total).toBe(1);
  });

  it("quien no tiene nombre guardado NO sale en la lista, pero SÍ cuenta", () => {
    const resumen = resumenDeLecturas([lectura("com-1", "uid-ana", "Ana Pérez"), lectura("com-1", "uid-sin-nombre")]);
    expect(resumen.get("com-1")).toEqual({ total: 2, nombres: ["Ana Pérez"] });
  });

  it("los nombres salen ordenados y sin repetir", () => {
    const resumen = resumenDeLecturas([
      lectura("com-1", "uid-z", "Zoe"),
      lectura("com-1", "uid-a", "Ana"),
      lectura("com-1", "uid-b", "Ana"),
    ]);
    expect(resumen.get("com-1")?.nombres).toEqual(["Ana", "Zoe"]);
  });

  it("una lectura sin comunicado o sin persona no cuenta: no se sabe de qué ni de quién", () => {
    const resumen = resumenDeLecturas([
      { id: "x", tenantId: "t", communicationId: "", uid: "uid-ana" },
      { id: "y", tenantId: "t", communicationId: "com-1", uid: "  " },
    ]);
    expect(resumen.size).toBe(0);
  });

  it("el plural concuerda, y cero no se disfraza de número", () => {
    expect(textoDeVistos(0)).toBe("Nadie todavía");
    expect(textoDeVistos(-1)).toBe("Nadie todavía");
    expect(textoDeVistos(1)).toBe("1 persona");
    expect(textoDeVistos(7)).toBe("7 personas");
  });

  it("un comunicado anterior al registro dice «sin registro», no cero", () => {
    // Los 40 publicados antes del 18 sep enseñarían 0 sin significar que nadie los vio.
    expect(anteriorAlRegistro("2026-09-15T12:00:00.000Z")).toBe(true);
    expect(anteriorAlRegistro(`${LECTURAS_DESDE}T12:00:00.000Z`)).toBe(false);
    expect(anteriorAlRegistro("2026-09-20T12:00:00.000Z")).toBe(false);
    expect(anteriorAlRegistro(undefined)).toBe(false);
    expect(anteriorAlRegistro("no es fecha")).toBe(false);
  });

  it("compara por el día LOCAL: el 17 a las 19:00 de Bogotá sigue siendo el 17", () => {
    // En UTC eso ya es el 18 y el comunicado dejaría de declararse «sin registro».
    expect(anteriorAlRegistro("2026-09-18T00:30:00.000Z")).toBe(true);
  });

  it("acepta un Timestamp de Firestore, que es lo que llega de la base", () => {
    expect(anteriorAlRegistro({ toDate: () => new Date("2026-09-10T12:00:00.000Z") })).toBe(true);
  });
});

describe("L-13 · los sitios del camino", () => {
  it("el residente anota al VER la tarjeta, no al cargar la lista", () => {
    const hook = codigo("src/features/communications/use-lecturas.ts");
    expect(hook).toContain("IntersectionObserver");
    expect(hook).toContain("threshold: 0.6");
    // Idempotente por el id del documento: el conteo no depende de cuántas veces se escriba.
    expect(hook).toContain("claveDeLectura(input.communicationId, input.uid)");
    expect(codigo("src/app/(resident)/resident/communications/page.tsx")).toContain("refDeLectura(item.id)");
  });

  it("la administración enseña el conteo y distingue «sin registro»", () => {
    const pantalla = codigo("src/app/(admin)/admin/communications/page.tsx");
    expect(pantalla).toContain("textoDeVistos(total)");
    expect(pantalla).toContain("anteriorAlRegistro(item.publishedAt ?? item.createdAt)");
  });

  it("anotar la lectura NUNCA rompe la pantalla del residente", () => {
    expect(codigo("src/features/communications/use-lecturas.ts")).toMatch(/\.catch\(\(\) => \{/);
  });

  it("la regla exige la forma del id y cierra los campos", () => {
    const reglas = codigo("firestore.rules");
    const desde = reglas.indexOf("match /communicationReads/{docId}");
    expect(desde).toBeGreaterThan(-1);
    const bloque = reglas.slice(desde, reglas.indexOf("match /", desde + 10));
    expect(bloque).toContain("docId == request.resource.data.communicationId + '_' + request.auth.uid");
    expect(bloque).toContain("request.resource.data.uid == request.auth.uid");
    expect(bloque).toContain("hasOnly(['tenantId', 'communicationId', 'uid', 'name', 'seenAt'])");
    expect(bloque).toContain("allow delete: if false");
  });
});
