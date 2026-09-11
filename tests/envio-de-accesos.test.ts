import { describe, expect, it } from "vitest";

import { resumirEnvioDeAccesos } from "@/features/residents/envio-de-accesos";

/**
 * `PRD-V-FIX-004` `CA7` — «Enviar acceso a N» dice POR QUÉ no pudo con cada uno.
 *
 * El bucle de `/admin/residents` tragaba el error (`catch {}`) y el aviso final solo
 * nombraba a la persona. Desde `FIX-004` el servidor rechaza con un motivo que le dice
 * al administrador qué hacer —«Registra al residente con otro correo»—, y un aviso que
 * lo tira convierte un rechazo explicado en un misterio.
 */

describe("FIX-004 · CA7 · el envío en bloque dice por qué falló cada uno", () => {
  it("sin fallos, un éxito con el total y el plural bien", () => {
    expect(resumirEnvioDeAccesos(3, 3, [])).toEqual({ tipo: "exito", texto: "Acceso enviado a 3 personas." });
    expect(resumirEnvioDeAccesos(1, 1, []).texto).toBe("Acceso enviado a 1 persona.");
  });

  it("con un rechazo, lo nombra CON su motivo", () => {
    const r = resumirEnvioDeAccesos(2, 3, [{ nombre: "Ana Pérez", motivo: "Ese correo ya tiene una cuenta de administración." }]);
    expect(r.tipo).toBe("aviso");
    expect(r.texto).toContain("2 de 3");
    expect(r.texto).toContain("Ana Pérez");
    expect(r.texto).toContain("Ese correo ya tiene una cuenta de administración.");
  });

  it("agrupa por motivo: el mismo motivo no se repite por cada persona", () => {
    const motivo = "Motivo A.";
    const r = resumirEnvioDeAccesos(0, 2, [
      { nombre: "Ana", motivo },
      { nombre: "Luis", motivo },
    ]);
    expect(r.texto.split(motivo).length - 1).toBe(1);
    expect(r.texto).toContain("Ana");
    expect(r.texto).toContain("Luis");
  });

  it("con muchos nombres, recorta y dice cuántos más", () => {
    const fallidas = ["A", "B", "C", "D", "E"].map((nombre) => ({ nombre, motivo: "M." }));
    expect(resumirEnvioDeAccesos(0, 5, fallidas).texto).toContain("y 2 más");
  });

  it("con muchos motivos distintos, enseña los dos primeros y cuenta el resto", () => {
    const texto = resumirEnvioDeAccesos(0, 3, [
      { nombre: "A", motivo: "M1." },
      { nombre: "B", motivo: "M2." },
      { nombre: "C", motivo: "M3." },
    ]).texto;
    expect(texto).toContain("M1.");
    expect(texto).toContain("M2.");
    expect(texto).not.toContain("M3.");
    expect(texto).toContain("1 motivo más");
  });
});
