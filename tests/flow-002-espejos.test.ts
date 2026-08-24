import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { statementChargedAmount, statementSettledAmount } from "@/features/billing/collection";
import { esRecaudoDeCartera } from "@/features/finanzas/financial-statement";
import { computeBalanceStatus } from "@/features/finanzas/use-payments";

/**
 * `PRD-V-FLOW-002` CA17 y §11.3 — **los dos espejos del módulo, vigilados**.
 *
 * `src/` no puede importar de `functions/` sin romper el build de App Hosting,
 * así que `calcularSaldo`/`computeBalanceStatus` y las dos copias de
 * `esRecaudoDeCartera` están duplicadas a mano. Copiar a mano no es el problema:
 * el problema es que **nada avise cuando una se queda atrás**. Ya pasó — R12 se
 * aplicó en `src/` el 22 de agosto de 2026 y nunca llegó a `functions/`, y el
 * informe mensual estuvo contando dos veces con todas las suites en verde.
 *
 * Estas pruebas LEEN los ficheros de `functions/` como texto. Leer no es
 * importar: no entra en el grafo de módulos del build, así que la prohibición de
 * CLAUDE.md no aplica. Mismo mecanismo que `plan-de-cuentas-espejo.test.ts`.
 */

const PAGOS = path.resolve("functions/src/payments.ts");

/**
 * El cuerpo de una función, por llaves equilibradas.
 *
 * **Primero cierra los paréntesis de los parámetros, y no es un detalle.** El
 * `esRecaudoDeCartera` del servidor declara su parámetro con un tipo de objeto
 * en línea, así que la primera `{` después del nombre es la del TIPO y no la del
 * cuerpo: quedarse con ella devolvía la lista de campos en vez del código, y la
 * prueba comparaba dos cosas que no eran ninguna de las dos la aritmética.
 */
function cuerpoDeFuncion(fuente: string, firma: string, fichero: string): string {
  const inicio = fuente.indexOf(firma);
  if (inicio === -1) throw new Error(`No encuentro «${firma}» en ${fichero}`);

  const abreParen = fuente.indexOf("(", inicio + firma.length);
  if (abreParen === -1) throw new Error(`«${firma}» no tiene lista de parámetros en ${fichero}`);
  let paren = 0;
  let finParen = -1;
  for (let i = abreParen; i < fuente.length; i += 1) {
    if (fuente[i] === "(") paren += 1;
    else if (fuente[i] === ")") {
      paren -= 1;
      if (paren === 0) {
        finParen = i;
        break;
      }
    }
  }
  if (finParen === -1) throw new Error(`No se cierran los parámetros de «${firma}» en ${fichero}`);

  // Y después de los parámetros puede venir un TIPO DE RETORNO que también es
  // un objeto entre llaves —`calcularSaldo` devuelve `{ balance, status }`—, así
  // que tampoco vale quedarse con la primera. La regla que distingue las dos: si
  // después de cerrar un bloque viene otra `{`, el que se acaba de cerrar era la
  // anotación y el cuerpo es el siguiente.
  let desde = finParen;
  for (;;) {
    const abre = fuente.indexOf("{", desde);
    if (abre === -1) throw new Error(`«${firma}» no tiene cuerpo en ${fichero}`);
    let nivel = 0;
    let cierra = -1;
    for (let i = abre; i < fuente.length; i += 1) {
      if (fuente[i] === "{") nivel += 1;
      else if (fuente[i] === "}") {
        nivel -= 1;
        if (nivel === 0) {
          cierra = i;
          break;
        }
      }
    }
    if (cierra === -1) throw new Error(`No se cierra «${firma}» en ${fichero}`);
    const siguiente = fuente.slice(cierra + 1).match(/^\s*(.)/)?.[1];
    if (siguiente === "{") {
      desde = cierra + 1;
      continue;
    }
    return fuente.slice(abre + 1, cierra);
  }
}

/** Normaliza para comparar aritmética y no estilo: fuera espacios y comentarios. */
function esqueleto(cuerpo: string): string {
  return cuerpo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

describe("§11.3 · `calcularSaldo` y `computeBalanceStatus` no se pueden separar", () => {
  const servidor = esqueleto(cuerpoDeFuncion(fs.readFileSync(PAGOS, "utf8"), "export function calcularSaldo", PAGOS));

  /**
   * **La aritmética, no el texto.** Los dos nombran distinto sus parámetros —uno
   * en español, el otro heredó los ingleses— y uno recibe el «hoy» mientras el
   * otro lo calcula, así que compararlos carácter a carácter fallaría siempre y
   * la prueba acabaría desactivada. Lo que tiene que coincidir es la resta y las
   * tres ramas del estado.
   */
  it("los dos restan lo pagado Y lo cubierto con anticipos (R4)", () => {
    expect(servidor).toContain("totalCobrado-pagado-anticipoAplicado");
    // Y el de `src/`, ejercitado: 140 de cargo, 40 pagados, 60 de anticipo.
    expect(computeBalanceStatus(140_000, 40_000, 60_000, "2026-06-05")).toEqual({
      balance: 40_000,
      status: "overdue",
    });
  });

  it("los dos topan el saldo en cero y no lo dejan negativo", () => {
    expect(servidor).toContain("bruto>0?bruto:0");
    expect(computeBalanceStatus(100_000, 150_000, 0).balance).toBe(0);
  });

  /**
   * **`paid` se decide por el BRUTO, no por el saldo topado.** Con el topado, un
   * sobrepago daría `balance: 0` y la rama de vencimiento nunca se alcanzaría —
   * mismo resultado hoy, pero por accidente. El servidor lo escribe así y el
   * espejo tiene que escribirlo igual.
   */
  it("los dos deciden el estado por el bruto, y solo entonces miran el vencimiento", () => {
    expect(servidor).toContain('bruto<=0?"paid"');
    expect(computeBalanceStatus(140_000, 140_000, 0, "1999-01-01").status).toBe("paid");
    expect(computeBalanceStatus(140_000, 0, 0, "2999-01-01").status).toBe("pending");
  });
});

describe("CA17 · el anticipo NO se excluye del libro, y nadie puede añadirlo «por simetría»", () => {
  const fuenteServidor = fs.readFileSync(PAGOS, "utf8");
  const cuerpoServidor = esqueleto(cuerpoDeFuncion(fuenteServidor, "export function esRecaudoDeCartera", PAGOS));
  const RUTA_SRC = path.resolve("src/features/finanzas/financial-statement.ts");
  const cuerpoCliente = esqueleto(
    cuerpoDeFuncion(fs.readFileSync(RUTA_SRC, "utf8"), "export function esRecaudoDeCartera", RUTA_SRC),
  );

  /**
   * El asiento de entrada de un anticipo **cuenta como ingreso del período**
   * (R5, CA7). No lo agrega Cartera —`cuotaIncome` suma `paymentAmount` de los
   * cargos y un anticipo no es un cargo—, así que si el libro también lo
   * excluyera **el anticipo desaparecería del estado financiero**: el dinero
   * estaría en el banco y en ninguna línea del informe.
   */
  it("un asiento de anticipo NO es recaudo de Cartera", () => {
    expect(esRecaudoDeCartera({ sourceType: "advance", category: "anticipo" })).toBe(false);
  });

  it("y su reverso tampoco, que es la otra mitad", () => {
    expect(esRecaudoDeCartera({ sourceType: "reversal", reversedSourceType: "advance", category: "anticipo" })).toBe(
      false,
    );
  });

  /**
   * **El guardián, y el riesgo exacto que cubre.** `alicuota` está excluida por
   * convivencia con los asientos viejos. La tentación es añadir `anticipo` a esa
   * lista «por analogía», y eso **compila y pasa todas las suites de hoy**: la
   * señal sería que el estado financiero deja de cuadrar con el banco, meses
   * después. Por eso el criterio es de texto y no de comportamiento.
   */
  it("ninguno de los dos cuerpos menciona «anticipo»", () => {
    expect(cuerpoCliente).not.toContain("anticipo");
    expect(cuerpoServidor).not.toContain("anticipo");
  });

  it("ni «advance»: excluir por origen sería el mismo error escrito en inglés", () => {
    expect(cuerpoCliente.toLowerCase()).not.toContain("advance");
    expect(cuerpoServidor.toLowerCase()).not.toContain("advance");
  });

  // Los dos cuerpos tienen que decir lo mismo, comparados sin espacios: es lo
  // único que caza que alguien añada una rama en un lado y no en el otro.
  it("los dos cuerpos son el mismo cuerpo", () => {
    expect(cuerpoCliente).toBe(cuerpoServidor);
  });
});

describe("R16 · el «% de recaudo» del informe automático mide lo mismo que la pantalla", () => {
  const fuentePagos = fs.readFileSync(PAGOS, "utf8");
  const INDEX = path.resolve("functions/src/index.ts");
  const fuenteIndex = fs.readFileSync(INDEX, "utf8");

  /**
   * **El tercer espejo, y nació de que el segundo ya había fallado igual.**
   *
   * R12 se aplicó en `src/` y no llegó a `functions/`, y el informe mensual
   * contó dos veces durante un día con las suites en verde. **R16 repitió la
   * historia**: el porcentaje pasó a medir liquidación en `src/` el 24 de agosto
   * de 2026 y el archivo automático siguió calculando `Σ paymentAmount / Σ
   * amount`. Una unidad que cubre julio con un anticipo de junio sale al 0 % con
   * la cuota saldada, porque el cruce no toca `paymentAmount` a propósito (R4).
   */
  it("el servidor calcula lo liquidado como facturado menos saldo, igual que `src/`", () => {
    const servidor = esqueleto(cuerpoDeFuncion(fuentePagos, "export function montoLiquidadoDelCargo", PAGOS));
    expect(servidor).toContain("Math.max(facturado-saldo,0)");

    const RUTA_SRC = path.resolve("src/features/billing/collection.ts");
    const cliente = esqueleto(
      cuerpoDeFuncion(fs.readFileSync(RUTA_SRC, "utf8"), "export function statementSettledAmount", RUTA_SRC),
    );
    expect(cliente).toContain("Math.max(charged-balance,0)");
  });

  /**
   * **Y el de `src/`, ejercitado con el caso que lo motiva:** un cargo de 140.000
   * cubierto entero con un anticipo cruzado. `paymentAmount` es cero —el cruce no
   * lo toca— y sin embargo no se debe nada.
   */
  it("un cargo saldado con un anticipo está liquidado al 100 %, con paymentAmount en cero", () => {
    const cargo = { amount: 140_000, paymentAmount: 0, advanceAppliedAmount: 140_000, balance: 0 };
    expect(statementSettledAmount(cargo)).toBe(140_000);
    expect(statementChargedAmount(cargo)).toBe(140_000);
  });

  /** Un sobrepago viejo no puede pasar del 100 %: por eso se resta el saldo. */
  it("un sobrepago anterior a FLOW-002 no pasa del 100 %", () => {
    expect(statementSettledAmount({ amount: 140_000, paymentAmount: 200_000, balance: 0 })).toBe(140_000);
  });

  /**
   * **El guardián que impide que el informe automático se vuelva a quedar atrás.**
   * Qué lo pondría rojo de verdad: que alguien devuelva el porcentaje a
   * `recaudado`, que es exactamente lo que había hasta el 24 de agosto de 2026.
   */
  it("`monthlyFinancialArchive` calcula los dos porcentajes sobre lo LIQUIDADO", () => {
    const cuerpo = esqueleto(fuenteIndex);
    expect(cuerpo).toContain("Math.round((liquidado/facturado)*100)");
    expect(cuerpo).toContain("Math.round((v.l/v.f)*100)");
    expect(cuerpo).not.toContain("Math.round((recaudado/facturado)*100)");
    expect(cuerpo).not.toContain("Math.round((v.r/v.f)*100)");
  });

  /** Y su gemelo manual, que produce un fichero con el mismo nombre y columnas. */
  it("el histórico que exporta /admin/billing usa la fórmula única, no la suya", () => {
    const RUTA = path.resolve("src/app/(admin)/admin/billing/page.tsx");
    const cuerpo = esqueleto(fs.readFileSync(RUTA, "utf8"));
    expect(cuerpo).toContain("e.liquidado+=statementSettledAmount(s)");
    expect(cuerpo).toContain("Math.round((v.liquidado/v.facturado)*100)");
    expect(cuerpo).not.toContain("Math.round((v.recaudado/v.facturado)*100)");
  });
});
