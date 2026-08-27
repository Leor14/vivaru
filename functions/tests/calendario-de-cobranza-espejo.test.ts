import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DIA_MAX, MIN_CICLO_DIAS } from "../src/calendario-de-cobranza";

/**
 * **Los dos límites del calendario de cobranza viven en TRES sitios, y nada los vigilaba.**
 *
 * - `functions/src/calendario-de-cobranza.ts` — quien DECIDE si envía.
 * - `firestore.rules` — quien NO SE SALTA, ni escribiendo desde la consola.
 * - `src/features/admin/components/billing-calendar-card.tsx` — quien lo OFRECE al administrador.
 *
 * Que estén tres veces es deliberado y está explicado en cada uno. Lo que no era deliberado es que
 * pudieran discrepar en silencio. El síntoma de la deriva no sería un error: sería el formulario
 * aceptando un ciclo de 3 días y la regla rechazándolo con «no tienes permiso» —que se lee como un
 * problema de rol y no de rango—, o peor, el formulario ofreciendo el día 31 y el aviso no saliendo
 * los meses de 30.
 *
 * **Se compara como TEXTO, no importando.** `functions/` y `src/` no pueden importarse mutuamente
 * —rompe el build de App Hosting, ver `CLAUDE.md`—, y `firestore.rules` no es TypeScript. Es el
 * mismo guardián que protege el catálogo de avisos: leer un fichero no es importarlo.
 */

const RAIZ = path.resolve(__dirname, "../..");

function leer(relativo: string): string {
  const p = path.join(RAIZ, relativo);
  const contenido = fs.readFileSync(p, "utf8");
  // Si el fichero se mueve o se vacía, el test tiene que caerse por eso y no por
  // «no encontré el número», que mandaría a buscar al sitio equivocado.
  expect(contenido.length, `${relativo} está vacío o no se pudo leer`).toBeGreaterThan(100);
  return contenido;
}

/** Saca un entero de la primera captura de `patron`, y falla con el fichero delante si no está. */
function numeroDe(fuente: string, patron: RegExp, donde: string): number {
  const m = fuente.match(patron);
  expect(m, `no encontré ${donde} — ¿se renombró la constante o cambió la forma?`).not.toBeNull();
  return Number(m![1]);
}

describe("El calendario de cobranza dice lo mismo en el servidor, en las reglas y en el formulario", () => {
  const reglas = leer("firestore.rules");
  const formulario = leer("src/features/admin/components/billing-calendar-card.tsx");

  it("el día máximo del mes es el mismo en los tres", () => {
    const enReglas = numeroDe(
      reglas,
      /d\.billingCalendar\.noticeDayOfMonth\s*<=\s*(\d+)/,
      "el tope de `noticeDayOfMonth` en firestore.rules",
    );
    const enFormulario = numeroDe(
      formulario,
      /^const DIA_MAX = (\d+);/m,
      "`DIA_MAX` en billing-calendar-card.tsx",
    );

    expect(enReglas, "las reglas y el servidor discrepan en el día máximo").toBe(DIA_MAX);
    expect(enFormulario, "el formulario y el servidor discrepan en el día máximo").toBe(DIA_MAX);
  });

  it("el ciclo mínimo de vencidas es el mismo en los tres", () => {
    const enReglas = numeroDe(
      reglas,
      /d\.billingCalendar\.overdueCycleDays\s*>=\s*(\d+)/,
      "el mínimo de `overdueCycleDays` en firestore.rules",
    );
    const enFormulario = numeroDe(
      formulario,
      /^const MIN_CICLO_DIAS = (\d+);/m,
      "`MIN_CICLO_DIAS` en billing-calendar-card.tsx",
    );

    expect(enReglas, "las reglas y el servidor discrepan en el ciclo mínimo").toBe(MIN_CICLO_DIAS);
    expect(enFormulario, "el formulario y el servidor discrepan en el ciclo mínimo").toBe(MIN_CICLO_DIAS);
  });

  it("las reglas siguen exigiendo el mínimo del día, que no tiene constante", () => {
    // El 1 no está parametrizado en ninguno de los tres —es el primer día del mes y no va a
    // cambiar—, pero si alguien lo borra de las reglas se abre la puerta al 0 y a los negativos.
    expect(reglas).toMatch(/d\.billingCalendar\.noticeDayOfMonth\s*>=\s*1/);
  });

  it("el formulario escribe con RUTAS PUNTEADAS, nunca el objeto entero", () => {
    // **Esta es la que más protege, y no es de estilo.** `lastNoticeSentAt` y `lastOverdueSentAt`
    // son la memoria de deduplicado del servidor. Escribir `billingCalendar` completo las borra, y
    // el efecto no es un error visible: es que el aviso vuelve a salir a quien ya lo recibió.
    expect(formulario).toMatch(/"billingCalendar\.noticeDayOfMonth"/);
    expect(formulario).toMatch(/"billingCalendar\.overdueCycleDays"/);

    // Y que NO haya una escritura del objeto entero. Se busca la forma que la haría:
    // `billingCalendar:` como clave de un objeto pasado a updateDoc/setDoc.
    expect(
      formulario,
      "el formulario escribe `billingCalendar` entero: eso borraría las marcas del último envío",
    ).not.toMatch(/\bbillingCalendar:\s*\{/);
  });

  it("el formulario no ofrece escribir las marcas del último envío", () => {
    // Son del servidor. El formulario puede LEERLAS para enseñarlas —y lo hace—, pero no debe
    // tener ninguna ruta de escritura hacia ellas.
    expect(formulario).not.toMatch(/"billingCalendar\.lastNoticeSentAt"/);
    expect(formulario).not.toMatch(/"billingCalendar\.lastOverdueSentAt"/);
  });
});
