import { aCentimos } from "@/lib/finanzas/nucleo-estado-financiero";
import type { Expense, Installment } from "@/types/domain";

/**
 * `PRD-V-FLOW-008` — el calendario de cuotas de una cuenta por pagar.
 *
 * ## Qué resuelve
 *
 * La administradora paga la póliza del seguro **en once cuotas** y hoy teclea el
 * cuadro de pagos a mano, porque en Vivaru un egreso es **un importe con UNA
 * fecha**. Aquí vive la aritmética del plan: validarlo, y decir qué está vencido.
 *
 * ## Por qué la validación vive aparte de la pantalla
 *
 * Un plan que no suma la factura **descuadra la deuda del conjunto para
 * siempre**, y esa cifra la lee el consejo en el informe mensual. La regla tiene
 * que poder comprobarse sin montar un formulario, y la comprueban a la vez el
 * cliente (para no dejar escribir) y el banco de pruebas (para que no se rompa).
 *
 * **Lo que NO está aquí es pagar.** La entrega 1 declara el plan y lo enseña; el
 * pago es la entrega 2 y va **por callable**, porque escribe en dos sitios y
 * sella `paidAmount`.
 */

/** Cuánto suman las cuotas que todavía cuentan — las anuladas no. */
export function sumaDelPlan(cuotas: ReadonlyArray<Pick<Installment, "amount" | "status">>): number {
  return aCentimos(
    cuotas.reduce((total, c) => (c.status === "anulada" ? total : total + (c.amount ?? 0)), 0),
  );
}

export type ProblemaDelPlan =
  | { tipo: "vacio" }
  | { tipo: "sin_vencimiento"; numeros: number[] }
  | { tipo: "numeracion" }
  | { tipo: "importe_no_positivo"; numeros: number[] }
  | { tipo: "no_cuadra"; diferencia: number };

/**
 * Comprueba el plan contra el total de la factura (`RN-01`, `RN-02`, `RN-03`).
 *
 * Devuelve **todos** los problemas, no el primero: quien está tecleando once
 * filas prefiere verlos juntos a descubrirlos de uno en uno.
 */
export function validarPlan(
  cuotas: ReadonlyArray<Pick<Installment, "number" | "dueDate" | "amount" | "status">>,
  totalFactura: number,
): ProblemaDelPlan[] {
  const problemas: ProblemaDelPlan[] = [];

  // `RN-02` · un plan vacío no es un plan. Se comprueba primero porque sobre
  // cero cuotas todo lo demás «cuadra» y devolvería un verde vacío — el mismo
  // error que una puerta que se abre sobre un conjunto sin datos.
  if (cuotas.length === 0) return [{ tipo: "vacio" }];

  // `RN-03` · sin fecha no hay calendario, y sin calendario esto es un egreso
  // normal con pasos de más.
  const sinFecha = cuotas.filter((c) => !c.dueDate).map((c) => c.number);
  if (sinFecha.length > 0) problemas.push({ tipo: "sin_vencimiento", numeros: sinFecha });

  // `RN-02` · consecutivos desde 1 y sin repetir. Con huecos o duplicados, «la
  // cuota 3» deja de identificar una cuota, y es como se la nombra al pagarla.
  const numeros = cuotas.map((c) => c.number).sort((a, b) => a - b);
  const esperados = numeros.length === new Set(numeros).size
    && numeros.every((n, i) => n === i + 1);
  if (!esperados) problemas.push({ tipo: "numeracion" });

  const noPositivos = cuotas.filter((c) => !((c.amount ?? 0) > 0)).map((c) => c.number);
  if (noPositivos.length > 0) problemas.push({ tipo: "importe_no_positivo", numeros: noPositivos });

  // `RN-01` · la suma es el total, al céntimo. **Se compara en céntimos y no con
  // `===` sobre los flotantes crudos**: once cuotas de 100,01 arrastran residuo,
  // y rechazar un plan correcto por un 0,0000001 es peor que no validar.
  const diferencia = aCentimos(aCentimos(totalFactura) - sumaDelPlan(cuotas));
  if (diferencia !== 0) problemas.push({ tipo: "no_cuadra", diferencia });

  return problemas;
}

/**
 * El problema, dicho para una persona. **Nombra la diferencia**, que es lo que
 * `CA1` pide: «no cuadra» obliga a sacar la calculadora; «faltan $11» no.
 */
export function explicarProblema(p: ProblemaDelPlan, formatear: (n: number) => string): string {
  switch (p.tipo) {
    case "vacio":
      return "Un plan de pagos necesita al menos una cuota.";
    case "sin_vencimiento":
      return `Falta la fecha de vencimiento de la cuota ${p.numeros.join(", ")}. Cada cuota necesita la suya.`;
    case "numeracion":
      return "Las cuotas deben ir numeradas desde 1, sin saltos ni repetidas.";
    case "importe_no_positivo":
      return `El importe debe ser mayor que cero: cuota ${p.numeros.join(", ")}.`;
    case "no_cuadra":
      return p.diferencia > 0
        ? `Las cuotas no suman el total de la factura: faltan ${formatear(p.diferencia)}.`
        : `Las cuotas suman más que el total de la factura: sobran ${formatear(-p.diferencia)}.`;
  }
}

// ── El envejecimiento ────────────────────────────────────────────────────────

export type Envejecimiento = { vencido: number; proximo: number };

/**
 * Lo vencido y lo próximo a vencer **de un egreso**, mirando cada cuota.
 *
 * **Con plan, la fecha que manda es la de cada cuota, no la de la factura**
 * (`RN-09` y §4.4). Una póliza de once cuotas tiene tres vencidas y ocho por
 * venir; contarla entera por el `dueDate` de la factura la pone toda de un lado.
 *
 * **Sin plan se comporta exactamente como hasta hoy**: el `dueDate` del egreso
 * decide, y sin `dueDate` no cuenta en ninguno de los dos — no se sabe cuándo
 * vencía, y afirmarlo sería inventarlo.
 */
export function envejecerEgreso(
  egreso: Pick<Expense, "amount" | "dueDate" | "status" | "installments" | "paidAmount">,
  asOf: string,
  corte: string,
): Envejecimiento {
  if (egreso.status !== "registrado") return { vencido: 0, proximo: 0 };

  const cuotas = egreso.installments;
  if (!cuotas || cuotas.length === 0) {
    const pendiente = (egreso.amount ?? 0) - (egreso.paidAmount ?? 0);
    const importe = pendiente > 0 ? pendiente : 0;
    if (!egreso.dueDate) return { vencido: 0, proximo: 0 };
    if (egreso.dueDate < asOf) return { vencido: importe, proximo: 0 };
    if (egreso.dueDate <= corte) return { vencido: 0, proximo: importe };
    return { vencido: 0, proximo: 0 };
  }

  let vencido = 0;
  let proximo = 0;
  for (const c of cuotas) {
    // Solo lo que de verdad se debe: una cuota pagada ya no vence, y una anulada
    // dejó de existir.
    if (c.status !== "pendiente") continue;
    if (!c.dueDate) continue;
    if (c.dueDate < asOf) vencido += c.amount ?? 0;
    else if (c.dueDate <= corte) proximo += c.amount ?? 0;
  }
  return { vencido: aCentimos(vencido), proximo: aCentimos(proximo) };
}

/**
 * La cuota que toca pagar. Es lo que el administrador busca al abrir la pantalla:
 * de once, cuál va ahora.
 *
 * **La más antigua sin pagar, no la siguiente por número.** Se puede pagar la 5
 * antes que la 3 —la vida real no siempre paga en orden, y bloquearlo obligaría a
 * mentir en el registro—, así que lo que toca es la más vieja que siga debiéndose.
 */
export function proximaCuota(cuotas: ReadonlyArray<Installment> | undefined): Installment | undefined {
  if (!cuotas) return undefined;
  return [...cuotas]
    .filter((c) => c.status === "pendiente")
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.number - b.number)[0];
}

/**
 * Lo ya pagado de una factura, **para enseñarlo**.
 *
 * Con plan sale de `paidAmount`, que sella el servidor; sin plan, del estado —un
 * egreso `pagado` se pagó entero—. **Existe porque «pagado» dejó de ser binario**:
 * una factura en `registrado` con tres cuotas saldadas SÍ ha pagado algo, y el
 * bucle que sumaba solo los `pagado` la contaba como cero.
 */
export function pagadoDelEgreso(
  egreso: Pick<Expense, "amount" | "status" | "paidAmount" | "installments">,
): number {
  if (egreso.status === "anulado") return 0;
  if (egreso.installments && egreso.installments.length > 0) {
    return aCentimos(egreso.paidAmount ?? 0);
  }
  return egreso.status === "pagado" ? (egreso.amount ?? 0) : 0;
}

/**
 * **Funde el plan que viene del formulario con el que está guardado.**
 *
 * Existe por un defecto que cazó recorrer staging: **editar la descripción de una
 * factura DESHACÍA sus pagos**. El formulario carga las cuotas quedándose solo con
 * número, fecha e importe —no reenvía lo que sella el servidor—, así que al
 * guardar sobrescribía el array entero y una cuota `pagada` volvía a `pendiente`.
 * `paidAmount` sí quedaba a salvo, protegido por la regla, y por eso el destrozo
 * se veía: **100 pagados y ninguna cuota pagada**, con su asiento huérfano en el
 * libro.
 *
 * La regla de Firestore **no podía impedirlo**: no itera listas. Así que el
 * cuidado tiene que estar aquí, donde sí se conoce lo que había.
 *
 * **Una cuota que no está `pendiente` se conserva ENTERA** —importe y fecha
 * incluidos (`RN-07`)— y **sobrevive aunque el formulario ya no la traiga**: no se
 * borra una cuota que dejó un asiento en el libro.
 */
export function fundirPlan(
  guardadas: ReadonlyArray<Installment> | undefined,
  delFormulario: ReadonlyArray<CuotaDelFormulario> | undefined,
): Installment[] | null {
  const previas = guardadas ?? [];
  const selladas = previas.filter((c) => c.status !== "pendiente");

  if (!delFormulario || delFormulario.length === 0) {
    // Quitar el plan solo se puede si no había nada pagado ni anulado.
    return selladas.length > 0 ? [...selladas] : null;
  }

  const porNumero = new Map(previas.map((c) => [c.number, c]));
  const fundidas: Installment[] = [];
  for (const nueva of delFormulario) {
    const previa = porNumero.get(nueva.number);
    if (previa && previa.status !== "pendiente") {
      fundidas.push(previa);
      continue;
    }
    fundidas.push({ number: nueva.number, dueDate: nueva.dueDate, amount: nueva.amount, status: "pendiente" });
  }

  // Las selladas que el formulario ya no trae vuelven a la lista: no se borran.
  for (const c of selladas) {
    if (!fundidas.some((f) => f.number === c.number)) fundidas.push(c);
  }
  return fundidas.sort((a, b) => a.number - b.number);
}

export type CuotaDelFormulario = { number: number; dueDate: string; amount: number };
