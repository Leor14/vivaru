/**
 * `PRD-V-FLOW-002` — lo que queda del reparto **del lado del cliente**.
 *
 * **La regla R7 ya no vive aquí.** El orden en que se imputa el dinero —del
 * cargo más antiguo al más nuevo— y la aritmética de la propuesta se mudaron al
 * servidor el 24 de agosto de 2026, que es lo que recomienda §11.3:
 * `previewPaymentAllocationCallable` pide la vista previa en vez de calcularla.
 * No era desconfianza —`aplicarPago` topa cada línea al saldo del cargo mire lo
 * que mire la pantalla— sino sitio: una regla de negocio en el navegador es una
 * regla que el servidor no puede garantizar y que el próximo cliente de la API
 * no hereda.
 *
 * Aquí se quedan **dos cosas que son de la pantalla y no del dominio**: saber
 * qué cargos ofrecer para marcar, y validar el reparto que el administrador
 * editó a mano antes de mandarlo. Las dos son inmediatas y no pueden esperar un
 * viaje de red por tecla.
 */

import { computeBalanceStatus } from "@/features/finanzas/use-payments";
import type { BillingStatement } from "@/types/domain";

/** Lo mínimo que hace falta de un cargo para decidir si ofrecerlo. */
export type CargoParaReparto = Pick<BillingStatement, "id"> &
  Partial<Pick<BillingStatement, "amount" | "paymentAmount" | "advanceAppliedAmount" | "dueDate" | "period">>;

export type LineaDeReparto = {
  statementId: string;
  amount: number;
};

function numero(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lo que le falta a un cargo para quedar saldado.
 *
 * **Se pregunta a `computeBalanceStatus` y no se resta a mano.** Es el espejo
 * declarado de `calcularSaldo` (§11.3) —con su guardián de texto—, y es quien
 * sabe que lo cubierto con anticipos cuenta para saldar aunque no esté en
 * `paymentAmount` (R4). Una resta escrita aquí sería una tercera copia, y la
 * tercera es la que se olvida de actualizar.
 *
 * Sirve para **decidir qué ofrecer y qué enseñar**: qué cargos tienen deuda, y
 * cuánto debe cada uno. El reparto en sí lo propone el servidor.
 */
export function deudaDelCargo(cargo: CargoParaReparto): number {
  return computeBalanceStatus(
    numero(cargo.amount),
    numero(cargo.paymentAmount),
    numero(cargo.advanceAppliedAmount),
    cargo.dueDate,
  ).balance;
}

/**
 * Ordena cargos **para enseñarlos**, del más antiguo al más nuevo.
 *
 * **Es presentación, no reparto.** El orden con el que se imputa el dinero lo
 * decide el servidor (§11.3); esto solo evita que un desplegable de cargos salga
 * en el orden en que Firestore los devolvió. Si algún día los dos criterios
 * divergieran no se movería un peso: quien elige aquí elige uno explícitamente,
 * y el servidor topa lo que se aplique.
 *
 * Un cargo sin `dueDate` cae a su período, que es el mismo criterio con el que
 * se decide la mora. El desempate por `id` hace que dos aperturas del mismo
 * formulario enseñen lo mismo.
 */
export function ordenarParaMostrar<T extends CargoParaReparto>(cargos: readonly T[]): T[] {
  const clave = (c: CargoParaReparto) => c.dueDate ?? (c.period ? `${c.period}-01` : "9999-12-31");
  return [...cargos].sort((a, b) => clave(a).localeCompare(clave(b)) || a.id.localeCompare(b.id));
}

/**
 * ¿Cuadra un reparto editado a mano? (CF5)
 *
 * **La suma puede ser MENOR que el importe y eso es correcto**: la diferencia es
 * sobrante y se convierte en anticipo (R2). Lo que el servidor rechaza es que se
 * pase. Escribirlo como «tiene que ser exactamente igual» es el error fácil, y
 * dejaría al administrador sin poder repartir 100 entre dos cargos de 30
 * dejando 40 a favor, que es un caso normal.
 *
 * Se valida aquí **además** de en el servidor porque un botón que se deja pulsar
 * para recibir un error es peor que un botón desactivado con el motivo escrito.
 */
export function repartoCuadra(lineas: readonly LineaDeReparto[], importe: number): boolean {
  const suma = lineas.reduce((s, l) => s + numero(l.amount), 0);
  return lineas.every((l) => numero(l.amount) > 0) && suma <= numero(importe) + 0.005;
}

/**
 * Aplica los ajustes escritos a mano sobre la propuesta del servidor.
 *
 * **No recalcula el reparto: solo sustituye lo que el administrador tocó.** Lo
 * que no tocó se queda como lo propuso el servidor, y lo que libera al bajar una
 * línea **no se reparte solo al siguiente cargo** — queda como sobrante, que es
 * lo que el servidor va a hacer con ello.
 *
 * Un ajuste **vacío no es un cero**: significa «deja la sugerencia». Tratarlo
 * como cero borraría la línea en cuanto alguien seleccionara y borrara el
 * contenido de la casilla para reescribirlo.
 */
export function aplicarAjustes(
  sugerido: readonly LineaDeReparto[],
  importe: number,
  ajustes: Readonly<Record<string, string>>,
): { lineas: LineaDeReparto[]; sobrante: number } {
  const lineas = sugerido.map((linea) => {
    const ajuste = ajustes[linea.statementId];
    return ajuste !== undefined && ajuste.trim() !== ""
      ? { statementId: linea.statementId, amount: numero(ajuste) }
      : linea;
  });
  // **Un ajuste sobre un cargo que la propuesta NO incluye también viaja.**
  //
  // Hasta el 24 de agosto de 2026 esto solo recorría `sugerido`, así que lo
  // escrito sobre un cargo sin línea propuesta **se tiraba en silencio**: la
  // pantalla pinta la casilla para todo cargo marcado —tenga línea o no, porque
  // cuando el importe se agotó en los anteriores no la hay—, de modo que el
  // producto ofrecía el gesto y después lo ignoraba. El administrador veía su
  // número escrito, el botón activo, y el cargo salía sin cobrar.
  //
  // Se añade al final, que es donde le toca: la propuesta va del más antiguo al
  // más nuevo (R7) y un cargo sin línea es, por construcción, posterior a los
  // que sí la tienen.
  //
  // **Vacío y cero no crean línea.** Vacío significa «deja la sugerencia», y
  // aquí no hay sugerencia que dejar; y el servidor rechaza toda línea que no
  // sea mayor que cero, así que crearla convertiría un cero inofensivo en un
  // cobro rechazado entero.
  const yaPropuestos = new Set(sugerido.map((l) => l.statementId));
  for (const [statementId, ajuste] of Object.entries(ajustes)) {
    if (yaPropuestos.has(statementId)) continue;
    if (ajuste === undefined || ajuste.trim() === "") continue;
    const amount = numero(ajuste);
    if (amount <= 0) continue;
    lineas.push({ statementId, amount });
  }
  const asignado = lineas.reduce((s, l) => s + l.amount, 0);
  return { lineas, sobrante: Math.max(numero(importe) - asignado, 0) };
}

/** En qué punto está la propuesta de reparto que sirve el servidor. */
export type EstadoPropuesta = "pendiente" | "recibida" | "error";

/**
 * Qué se le puede decir al administrador sobre el sobrante — **y cuándo no se
 * le puede decir nada**.
 *
 * Existe porque la pantalla lo dijo mal. El sobrante se calcula contra la
 * propuesta del servidor, y **antes de que llegue la propuesta la lista está
 * vacía**, así que el sobrante es el importe ENTERO: al abrir el cobro, durante
 * el viaje de red, la pantalla anunciaba «Sobran $140.000: quedarán como saldo a
 * favor de la unidad» sobre un pago que no dejaba ni un peso a favor. Y si la
 * llamada fallaba, `sugerido` se quedaba vacío **para siempre** y el aviso se
 * quedaba puesto.
 *
 * **Una lista vacía es un estado legítimo** —CA8: un pago sin cargos pendientes
 * se convierte íntegro en anticipo—, así que «está vacía» no distingue «todavía
 * no ha llegado» de «no hay nada que proponer». Por eso hace falta el estado
 * explícito y no basta con mirar la longitud.
 */
export type AvisoDelSobrante =
  | { tipo: "ninguno" }
  | { tipo: "calculando" }
  | { tipo: "error" }
  | { tipo: "a-favor"; sobrante: number }
  | { tipo: "contra-el-cargo"; sobrante: number }
  | { tipo: "sin-destino"; sobrante: number };

export function avisoDelSobrante(args: {
  estado: EstadoPropuesta;
  sobrante: number;
  /** Lo que responde el servidor: si la bandera de anticipos está encendida. */
  seraAnticipo: boolean;
  /** Si este envío va a llevar `allocations` (reparto entre varios cargos). */
  vaPorReparto: boolean;
}): AvisoDelSobrante {
  if (args.estado === "error") return { tipo: "error" };
  if (args.estado === "pendiente") return { tipo: "calculando" };
  if (!(args.sobrante > 0)) return { tipo: "ninguno" };
  if (args.seraAnticipo) return { tipo: "a-favor", sobrante: args.sobrante };
  // Sin anticipos, un reparto que no llega al importe lo rechaza el servidor:
  // no hay dónde guardar la diferencia. Por la ruta de un solo cargo sí se
  // contabiliza entera contra él, que es el comportamiento de siempre.
  return args.vaPorReparto
    ? { tipo: "sin-destino", sobrante: args.sobrante }
    : { tipo: "contra-el-cargo", sobrante: args.sobrante };
}
