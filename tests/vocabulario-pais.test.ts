import { describe, expect, it } from "vitest";

import { AYUDA, capitalizar, terminosDePais } from "@/lib/config/vocabulario-pais";

/**
 * El vocabulario de propiedad horizontal por país.
 *
 * Estas pruebas no comprueban gramática: fijan **que cada mercado lee su
 * palabra**. Si alguien cambia un término sin querer, un administrador
 * mexicano empieza a ver la palabra colombiana y no lo dice nadie — un fallo
 * de esos que no rompe ninguna pantalla.
 */

describe("cada país lee su palabra", () => {
  it("Colombia dice coeficiente de copropiedad; México, indiviso; Ecuador, alícuota", () => {
    expect(terminosDePais("CO").coeficiente).toBe("coeficiente de copropiedad");
    expect(terminosDePais("MX").coeficiente).toBe("indiviso");
    expect(terminosDePais("EC").coeficiente).toBe("alícuota");
  });

  /**
   * El inmueble entero: la palabra más visible del producto, y la última que
   * llegó aquí. Hasta el 27 de agosto de 2026 la pantalla decía «Tenant».
   */
  it("Colombia dice conjunto; México y Ecuador, condominio", () => {
    expect(terminosDePais("CO").copropiedad).toBe("conjunto");
    expect(terminosDePais("MX").copropiedad).toBe("condominio");
    expect(terminosDePais("EC").copropiedad).toBe("condominio");
  });

  /**
   * Que México y Ecuador coincidan HOY no los hace el mismo caso: se
   * decidieron por vías distintas —México por David, Ecuador contra Habitanto—
   * y pueden separarse. Esto fija que quien cambie uno no arrastre al otro sin
   * enterarse.
   */
  it("México y Ecuador coinciden por casualidad, no por compartir la entrada", () => {
    expect(terminosDePais("MX").copropiedad).toBe(terminosDePais("EC").copropiedad);
    expect(terminosDePais("MX").coeficiente).not.toBe(terminosDePais("EC").coeficiente);
  });

  it("la cuota mensual también cambia de nombre", () => {
    expect(terminosDePais("CO").cuotaMensual).toBe("cuota de administración");
    expect(terminosDePais("MX").cuotaMensual).toBe("cuota de mantenimiento");
    // En Ecuador la misma palabra nombra el porcentaje y la cuota. No es
    // nuestro descuido: es su ley. Por eso ahí el texto de ayuda importa más.
    expect(terminosDePais("EC").cuotaMensual).toContain("alícuota");
  });

  it("el código llega en minúscula y se resuelve igual", () => {
    expect(terminosDePais("mx").coeficiente).toBe(terminosDePais("MX").coeficiente);
  });
});

describe("lo desconocido cae en neutro, nunca en un país concreto", () => {
  it("sin país no se adivina", () => {
    expect(terminosDePais(undefined).coeficiente).toBe("porcentaje de copropiedad");
    expect(terminosDePais("").coeficiente).toBe("porcentaje de copropiedad");
  });

  it("un país fuera de los mercados abiertos tampoco hereda el de otro", () => {
    const cl = terminosDePais("CL");
    expect(cl.coeficiente).toBe("porcentaje de copropiedad");
    expect(cl.coeficiente).not.toBe(terminosDePais("CO").coeficiente);
  });

  /**
   * El neutro del inmueble NO puede ser «conjunto»: es la palabra colombiana,
   * y caer en ella es exactamente adivinar el país de quien lee. «Copropiedad»
   * es el término legal común a los tres.
   */
  it("sin país, el inmueble no cae en la palabra de ningún mercado", () => {
    expect(terminosDePais(undefined).copropiedad).toBe("copropiedad");
    for (const pais of ["CO", "EC", "MX"]) {
      expect(terminosDePais(undefined).copropiedad).not.toBe(terminosDePais(pais).copropiedad);
    }
  });
});

describe("la cuenta bancaria de México no se identifica igual", () => {
  it("México pide CLABE de 18 dígitos; Colombia y Ecuador, número de cuenta", () => {
    expect(terminosDePais("MX").identificadorCuenta.label).toBe("CLABE interbancaria");
    expect(terminosDePais("MX").identificadorCuenta.maxLength).toBe(18);
    expect(terminosDePais("CO").identificadorCuenta.label).toBe("Nº de cuenta");
    expect(terminosDePais("CO").identificadorCuenta.maxLength).toBeUndefined();
  });

  it("cambian las ETIQUETAS del tipo de cuenta, nunca los valores guardados", () => {
    // Si el valor cambiara, el mismo dato significaría cosas distintas según
    // desde dónde se lea — y un conjunto puede corregir su país.
    for (const pais of ["CO", "EC", "MX", undefined]) {
      expect(terminosDePais(pais).tiposCuenta.map((t) => t.value)).toEqual(["corriente", "ahorros"]);
    }
    expect(terminosDePais("MX").tiposCuenta[0].label).toBe("Cheques");
    expect(terminosDePais("CO").tiposCuenta[0].label).toBe("Corriente");
  });
});

describe("los textos de ayuda nombran las palabras de los otros países", () => {
  /**
   * Es lo que hace que el icono complemente al mapa en vez de sustituirlo:
   * quien busca «indiviso» y ve «coeficiente» necesita reconocerse.
   */
  it("la ayuda del coeficiente nombra los tres términos", () => {
    for (const palabra of ["coeficiente de copropiedad", "alícuota", "indiviso"]) {
      expect(AYUDA.coeficiente).toContain(palabra);
    }
  });

  /**
   * Aportado por David el 22 ago 2026 y faltaba: el porcentaje no solo manda
   * sobre lo que se paga, también sobre **el peso del voto en asamblea**. Es
   * la mitad del concepto, y vale igual en los tres países.
   */
  it("dice que el porcentaje manda sobre el pago Y sobre el voto", () => {
    for (const texto of [AYUDA.coeficiente, AYUDA.coeficienteResidente]) {
      expect(texto).toContain("gastos comunes");
      expect(texto).toContain("voto en asamblea");
    }
  });

  /**
   * El término legal es correcto para el administrador —trabaja con escrituras
   * y actas— pero el condómino rara vez lo usa: piensa en la cuota. Así que al
   * residente se le explica sin exigirle la palabra, y se le ofrece por si la
   * necesita para casarla con su escritura.
   */
  it("el texto del residente ofrece el término sin exigirlo, y lo ata a la escritura", () => {
    expect(AYUDA.coeficienteResidente).toContain("escritura");
    for (const palabra of ["indiviso", "coeficiente de copropiedad", "alícuota"]) {
      expect(AYUDA.coeficienteResidente).toContain(palabra);
    }
  });

  it("la ayuda de la corrida explica el mecanismo, que es igual en los tres países", () => {
    expect(AYUDA.corridaPorCoeficiente).toContain("resto mayor");
    expect(AYUDA.corridaPorCoeficiente).toContain("vista previa");
  });

  it("la de datos bancarios avisa de la CLABE", () => {
    expect(AYUDA.datosBancarios).toContain("CLABE");
  });
});

describe("capitalizar", () => {
  it("pone la primera en mayúscula sin tocar el resto", () => {
    expect(capitalizar("indiviso")).toBe("Indiviso");
    expect(capitalizar("coeficiente de copropiedad")).toBe("Coeficiente de copropiedad");
  });

  it("respeta las tildes", () => {
    expect(capitalizar("alícuota")).toBe("Alícuota");
  });

  /** Es como lo usa el pie de `app-shell`: «Condominio: Torres del Valle». */
  it("sirve para encabezar el pie con el término del país", () => {
    expect(capitalizar(terminosDePais("MX").copropiedad)).toBe("Condominio");
    expect(capitalizar(terminosDePais("CO").copropiedad)).toBe("Conjunto");
  });
});
