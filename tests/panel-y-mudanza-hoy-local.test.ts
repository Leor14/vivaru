// tests/panel-y-mudanza-hoy-local.test.ts
// El «hoy», el «ayer» y los meses del Panel de Control, y la fecha mínima de una mudanza, son del
// calendario LOCAL — y ahora una prueba lo ve.
//
// Se arreglaron el 10 de septiembre de 2026 (`d91e1af`), pero salían de una VARIABLE y no de
// `new Date().toISOString()`, así que ni el guardián de `hoy-local` ni ninguna prueba los alcanzaba.
// Al cubrirlos apareció otro defecto: los meses anteriores se calculaban con `setMonth` sobre la fecha
// de hoy, y un 31 eso se desbordaba.
//
// La zona se fija AQUÍ: en una máquina en UTC —la de CI— el día local y el UTC coinciden.
process.env.TZ = "America/Mexico_City";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ventanasDelPanel } from "@/lib/dashboard/fechas-del-panel";
import { primerDiaReservable } from "@/utils/datetimeValidation";

const en = (iso: string) => new Date(iso);

describe("el reloj de esta prueba distingue el día local del UTC", () => {
  it("las 19:00 del 10 en Ciudad de México son las 01:00 del 11 en UTC", () => {
    const d = en("2026-09-11T01:00:00Z");
    expect(d.toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(d.getDate()).toBe(10);
  });
});

describe("las ventanas del Panel de Control son del calendario local", () => {
  it("a las 19:00 del 10, hoy es el 10 y ayer el 9", () => {
    expect(ventanasDelPanel(en("2026-09-11T01:00:00Z"))).toMatchObject({
      hoy: "2026-09-10",
      ayer: "2026-09-09",
      mes: "2026-09",
    });
  });

  it("a las 19:00 del último día del mes, el mes es ESE y no el siguiente", () => {
    expect(ventanasDelPanel(en("2026-09-01T01:00:00Z"))).toMatchObject({
      hoy: "2026-08-31",
      mes: "2026-08",
      mesAnterior: "2026-07",
    });
  });

  it("el día 1, ayer es el último día del mes anterior", () => {
    expect(ventanasDelPanel(en("2026-09-01T18:00:00Z"))).toMatchObject({ hoy: "2026-09-01", ayer: "2026-08-31" });
  });

  it("el 31 de marzo, el mes pasado es FEBRERO: con `setMonth` sobre hoy salía marzo", () => {
    expect(ventanasDelPanel(en("2026-03-31T18:00:00Z"))).toMatchObject({
      mes: "2026-03",
      mesAnterior: "2026-02",
      mesAntesDelAnterior: "2026-01",
    });
  });

  it("el 31 de octubre, el mes pasado es septiembre", () => {
    expect(ventanasDelPanel(en("2026-10-31T18:00:00Z")).mesAnterior).toBe("2026-09");
  });

  it("en enero, los meses anteriores cruzan de año", () => {
    expect(ventanasDelPanel(en("2026-01-15T18:00:00Z"))).toMatchObject({
      mesAnterior: "2025-12",
      mesAntesDelAnterior: "2025-11",
    });
  });
});

describe("la fecha mínima de una mudanza es del calendario local", () => {
  it("a las 19:00 del 10 es el 10, aunque en UTC ya sea el 11", () => {
    expect(primerDiaReservable("reservation", en("2026-09-11T01:00:00Z"))).toBe("2026-09-10");
  });

  it("a las 23:45 del 10 ya es el 11: los 30 minutos de margen cruzan la medianoche", () => {
    expect(primerDiaReservable("reservation", en("2026-09-11T05:45:00Z"))).toBe("2026-09-11");
  });
});

describe("la página y el asistente usan estas funciones, y nadie vuelve a `setMonth`", () => {
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const leer = (ruta: string) => sinComentarios(readFileSync(resolve(process.cwd(), ruta), "utf8"));

  it("el Panel de Control saca sus fechas de `ventanasDelPanel`", () => {
    expect(leer("src/app/(admin)/admin/page.tsx")).toMatch(/ventanasDelPanel\(/);
  });

  it("el asistente de mudanza saca la fecha mínima de `primerDiaReservable`", () => {
    expect(leer("src/components/features/reservations/MudanzaWizard.tsx")).toMatch(/primerDiaReservable\(/);
  });

  it("ningún fichero de `src/` resta meses con `setMonth`: un 31 se desborda al mes siguiente", () => {
    const ficheros = (dir: string): string[] =>
      readdirSync(dir).flatMap((nombre) => {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) return ficheros(ruta);
        return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
      });
    const raiz = resolve(process.cwd(), "src");
    const todos = ficheros(raiz);
    expect(todos.length).toBeGreaterThan(300);
    const conSetMonth = todos
      .filter((f) => /\.setMonth\(/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map((f) => relative(process.cwd(), f));
    expect(conSetMonth).toEqual([]);
  });
});
