import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLAVES_SECCION_CARTERA,
  SECCIONES_CARTERA,
  seccionesVisiblesDeCartera,
  vistaEfectivaDeCartera,
} from "../src/features/billing/secciones-cartera";

/**
 * **Partir Cartera (pasada 4 del corte de navegación).**
 *
 * `/admin/billing` medía **4,3 pantallas de scroll con doce bloques apilados**, y
 * son cuatro trabajos: mirar, cobrar, seguir y cerrar. Quien entraba a cerrar un
 * período atravesaba el formulario de crear cobros y cinco listas para llegar.
 *
 * **La restricción dura es que no se rompa nada**, así que lo que más importa
 * aquí no es que las pestañas existan: es que **cada bloque siga estando en
 * exactamente una**, que los modales sigan montados pase lo que pase, y que sin
 * parámetro la pantalla abra por donde abría.
 */

describe("1 · las cuatro secciones", () => {
  it("son cuatro y en el orden del trabajo real", () => {
    expect(SECCIONES_CARTERA.map((s) => s.key)).toEqual(["resumen", "cobrar", "seguimiento", "cierre"]);
  });

  it("las claves de la URL son las de la barra", () => {
    expect(CLAVES_SECCION_CARTERA).toEqual(SECCIONES_CARTERA.map((s) => s.key));
  });
});

describe("2 · `solo_consulta` no ofrece pestañas vacías", () => {
  /**
   * En ese modo la cartera se administra fuera de Vivaru y los bloques de
   * «Cobrar» y «Cierre» ya venían apagados por `!soloConsulta`. Ofrecer sus
   * pestañas enseñaría dos pantallas en blanco.
   */
  it("con la variante completa se ven las cuatro", () => {
    expect(seccionesVisiblesDeCartera(false)).toHaveLength(4);
  });

  it("en solo consulta se ven solo Resumen y Seguimiento", () => {
    expect(seccionesVisiblesDeCartera(true).map((s) => s.key)).toEqual(["resumen", "seguimiento"]);
  });

  it("un enlace a una pestaña que no está en la barra cae a Resumen", () => {
    // `?vista=cierre` sobre un conjunto de solo consulta: sin esto se vería una
    // pantalla vacía sin decir por qué.
    expect(vistaEfectivaDeCartera("cierre", true)).toBe("resumen");
    expect(vistaEfectivaDeCartera("cobrar", true)).toBe("resumen");
  });

  it("y no toca las que sí están", () => {
    expect(vistaEfectivaDeCartera("seguimiento", true)).toBe("seguimiento");
    expect(vistaEfectivaDeCartera("cierre", false)).toBe("cierre");
    for (const clave of CLAVES_SECCION_CARTERA) {
      expect(vistaEfectivaDeCartera(clave, false)).toBe(clave);
    }
  });
});

describe("3 · lo que NO puede quedar dentro de una pestaña", () => {
  /**
   * **Es el riesgo real de esta pasada.** Entre los bloques de contenido de
   * Cartera hay modales, cajones y un `<input>` oculto con `ref`. Si alguno queda
   * dentro de `{vistaEfectiva === "..."}`, **deja de poder abrirse** desde las
   * demás pestañas — y no falla nada: el botón simplemente no hace nada.
   *
   * Se comprueba por texto porque es estructura de JSX, que ninguna prueba de
   * datos alcanza.
   */
  const PAGINA = path.resolve(process.cwd(), "src/app/(admin)/admin/billing/page.tsx");
  const texto = fs.readFileSync(PAGINA, "utf8");
  const lineas = texto.split("\n");

  /** Elementos de primer nivel que tienen que seguir montados siempre. */
  const SIEMPRE_MONTADOS = [
    "<RecordPaymentModal",
    "<BillingEditDrawer",
    "<BillingBulkMessageDrawer",
    "<CoefficientCampaignDialog",
  ];

  it("el fichero se lee y tiene el tamaño esperado", () => {
    // Una puerta que se abre sobre un fichero vacío no verifica nada.
    expect(lineas.length).toBeGreaterThan(2000);
    expect(texto).toContain('ariaLabel="Secciones de Cartera"');
  });

  it("los modales y cajones van DESPUÉS de todas las pestañas", () => {
    /**
     * **La indentación no sirve para esto y la primera versión de esta prueba lo
     * daba por hecho.** El código original ya venía con sangría irregular —el
     * `<Card>` de «Crear nuevo cobro» está a seis espacios AUNQUE esté dentro de
     * su condición— y `CoefficientCampaignDialog` va anidado en un
     * `{user?.tenantId ?` que es legítimo y nada tiene que ver con las pestañas.
     * Medir profundidad por espacios daba un rojo falso.
     *
     * Lo que sí distingue: los modales viven al final del `<section>`, después de
     * la última condición de pestaña. Si alguien sube uno a un bloque, cae por
     * delante y esto enrojece.
     *
     * **La comprobación definitiva es el navegador**, abriendo cada pestaña y
     * viendo que los modales siguen abriéndose. Esto solo evita el descuido.
     */
    const ultimaCondicion = lineas.reduce(
      (ultima, linea, i) => (linea.includes("vistaEfectiva === ") ? i : ultima),
      -1,
    );
    expect(ultimaCondicion, "no hay ninguna condición de pestaña").toBeGreaterThan(-1);
    for (const marca of SIEMPRE_MONTADOS) {
      const i = lineas.findIndex((linea) => linea.includes(marca));
      expect(i, `no encuentro ${marca}`).toBeGreaterThan(-1);
      expect(
        i,
        `${marca} quedó por delante de una condición de pestaña: si está dentro, deja de abrirse desde las demás`,
      ).toBeGreaterThan(ultimaCondicion);
    }
  });

  it("cada bloque de contenido declara UNA sola pestaña", () => {
    // Dos condiciones en la misma línea significarían un bloque que se pinta en
    // dos sitios, o uno que no se pinta en ninguno.
    const conCondicion = lineas.filter((linea) => linea.includes("vistaEfectiva === "));
    expect(conCondicion.length).toBeGreaterThan(4);
    for (const linea of conCondicion) {
      const cuantas = (linea.match(/vistaEfectiva === /g) ?? []).length;
      expect(cuantas, `una línea decide dos pestañas a la vez: ${linea.trim()}`).toBe(1);
    }
  });

  it("las cuatro secciones se usan, ninguna quedó sin contenido", () => {
    for (const clave of CLAVES_SECCION_CARTERA) {
      expect(texto, `la pestaña «${clave}» no envuelve ningún bloque`).toContain(
        `vistaEfectiva === "${clave}"`,
      );
    }
  });
});
