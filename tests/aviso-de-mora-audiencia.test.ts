import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **`D-1` — «Enviar aviso a residentes», en Cartera, le dice «tienes cartera en mora» a todos.**
 *
 * Lote «Análisis de la plataforma», reproducción de la fase 1 del plan (T1.3).
 * `handleSendOverdueBulkMessage` (`admin/billing/page.tsx`) exige elegir unidades, pero crea un
 * comunicado **sin audiencia**, y un comunicado sin `audienceUnitIds` lo ve todo el conjunto.
 * Además, el mensaje de éxito dice «enviado a N unidad(es) en mora».
 *
 * **Cambio sobre el plan:** se reproduce leyendo el código y no sacando ya la construcción del
 * comunicado a una función, para no tocar el producto en una fase que solo reproduce. La
 * extracción, con su prueba de comportamiento, va con el arreglo (T2.3). **La prueba del defecto
 * va con `it.fails`**; la de control comprueba que el guardián encontró la llamada.
 */

const raiz = path.resolve(__dirname, "..");
const pagina = fs.readFileSync(path.join(raiz, "src/app/(admin)/admin/billing/page.tsx"), "utf8");

const inicio = pagina.indexOf("async function handleSendOverdueBulkMessage");
const cuerpo = inicio >= 0 ? pagina.slice(inicio, pagina.indexOf("\n  }\n", inicio)) : "";
const llamada = cuerpo.match(/createCommunication\([\s\S]*?\}\);/)?.[0] ?? "";

describe("D-1 · el aviso de mora de Cartera llega solo a las unidades elegidas", () => {
  it("control: encuentra el aviso masivo y su llamada a createCommunication", () => {
    expect(cuerpo.length).toBeGreaterThan(0);
    expect(llamada).toContain("title:");
  });

  it.fails("DEFECTO D-1: el comunicado del aviso de mora lleva la audiencia de las unidades elegidas", () => {
    expect(llamada).toContain("audienceUnitIds");
  });
});
