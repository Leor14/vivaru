import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * La accion que CREA algo es la accion principal de su pantalla.
 *
 * Medido en el navegador sobre las pantallas del admin: siete de ocho ya lo
 * hacian —«Crear comunicado», «Subir», «Crear reserva», «Nueva encuesta»,
 * «Crear usuario», «Crear autorizacion», «Agregar servicio», todas en el navy de
 * marca— y **Residentes era la unica sin NINGUNA accion principal a la vista**:
 * sus cinco botones eran blancos, incluido «Crear unidad y titular».
 *
 * No fue una decision de diseño nueva: fue seguir el camino que el propio
 * repositorio ya tenia en siete sitios.
 *
 * Lo que NO veta esta prueba: que una pantalla no tenga accion principal. El
 * tablero y Paqueteria no la tienen y es correcto —solo miran y navegan—.
 */
const CREA = /^(Crear|Nueva|Nuevo|Agregar|Subir|Añadir|Anadir)\b/;

/**
 * Excepciones, con su motivo. NO es una lista para silenciar rojos: cada entrada
 * dice por que ese boton crea algo y aun asi NO es la accion principal.
 *
 * La regla de arriba mira el rotulo, y el rotulo no distingue «crear la cosa de
 * esta pantalla» de «añadir una fila dentro de un formulario». Cuando aparezca
 * un caso nuevo hay que decidirlo, no añadirlo aqui por inercia.
 */
const SECUNDARIAS_A_PROPOSITO: Record<string, string> = {
  "Agregar familiar":
    "añade una fila dentro del formulario de unidad (paso «3. Nucleo familiar»); " +
    "la accion principal de ese formulario es su envio, no esta",
};

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

/** Sin comentarios: la prosa de arriba nombra los rotulos que vigila. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("la accion que crea algo es la principal", () => {
  it("ningun boton de crear se pinta como secundario", () => {
    const culpables: string[] = [];
    for (const f of ficheros("src/app/(admin)")) {
      const t = soloCodigo(readFileSync(f, "utf8"));
      for (const m of t.matchAll(/<Button\b([^>]*variant="outline"[^>]*)>([^<]{2,40})<\/Button>/g)) {
        const rotulo = m[2].trim();
        if (!CREA.test(rotulo)) continue;
        if (rotulo in SECUNDARIAS_A_PROPOSITO) continue;
        culpables.push(`${f} · "${rotulo}"`);
      }
    }
    expect(
      culpables,
      `estos botones crean algo y se pintan como secundarios:\n${culpables.join("\n")}`,
    ).toEqual([]);
  });

  it("las excepciones son POCAS y llevan su motivo escrito", () => {
    const entradas = Object.entries(SECUNDARIAS_A_PROPOSITO);
    expect(entradas.length, "si esta lista crece, la regla ya no dice nada").toBeLessThanOrEqual(3);
    for (const [rotulo, motivo] of entradas) {
      expect(motivo.length, `«${rotulo}» esta exceptuado sin explicar por que`).toBeGreaterThan(40);
    }
  });

  it("el guardian mira las pantallas del admin de verdad", () => {
    expect(ficheros("src/app/(admin)").length).toBeGreaterThan(15);
  });
});
