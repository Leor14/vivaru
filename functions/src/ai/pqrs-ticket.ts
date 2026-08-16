/**
 * Traducción de un ticket de Firestore a la entrada de `pqrs-asistir`.
 *
 * Vive aparte del callable a propósito: el mapeo es la parte que decide QUÉ ve
 * el modelo, y quería poder probarlo sin fabricar una sesión ni un Firestore.
 * El callable se queda con las lecturas y con los permisos.
 *
 * **El historial de producción no es el que midió la Fase 2, y conviene no
 * olvidarlo.** En el gold set, los 18 casos con contexto previo lo traen escrito
 * por el RESIDENTE —son hilos de WhatsApp—; en el producto, `responseHistory` lo
 * escribe solo la administración (`respondTicket` es el único que escribe ahí, y
 * el residente no tiene por dónde añadir). La regla dura del prompt —«clasifica
 * el mensaje, el historial solo sirve para entenderlo»— se afinó contra lo
 * primero y en producción recibe lo segundo. Se mapea fiel al producto, que es
 * lo que habrá en la sombra de la Fase 4, y se deja dicho aquí porque es
 * exactamente el tipo de divergencia que este programa ya ha pagado cuatro
 * veces: el instrumento midiendo algo distinto de la cosa.
 */

/**
 * La variante de PQRS, declarada aquí y no importada.
 *
 * `functions/` no puede importar de `src/` —rompe el `next build` de App
 * Hosting, trampa conocida— y `index.ts` ya declara su propia copia de las
 * variantes por lo mismo. Importarla de ahí traería el índice entero a este
 * módulo, que es el import circular que `http-config.ts` vino a evitar. De los
 * tres males, repetir dos cadenas es el barato: el catálogo de la operación las
 * valida igual, así que una divergencia se cae en la puerta, no en silencio.
 */
export type VariantePqrs = "con_sla" | "buzon_simple";

/** Default = comportamiento actual, igual que en `src/lib/config/module-variants.ts`. */
const VARIANTE_POR_DEFECTO: VariantePqrs = "con_sla";

/** Topes del esquema de entrada (`asistirPqrsInput` en `catalog.ts`). */
const MAX_ASUNTO = 200;
const MAX_MENSAJE = 4000;
const MAX_TEXTO_HISTORIAL = 1000;
const MAX_ENTRADAS_HISTORIAL = 10;

export interface EntradaPqrs {
  asunto?: string;
  mensaje: string;
  historial?: Array<{ autor: "residente" | "administracion"; texto: string }>;
  variante: VariantePqrs;
}

/**
 * Qué se recortó para caber en el esquema. **No es telemetría: se le enseña a la
 * persona.** Un mensaje de 6.000 caracteres analizado hasta el 4.000 produce un
 * resumen que parece completo y no lo es; que el administrador lo sepa cuesta
 * una línea y evita que confíe en algo que no leyó el modelo.
 */
export interface RecorteEntrada {
  /** El mensaje no cabía y se analizó solo su principio. */
  mensaje: boolean;
  /** Entradas de historial que quedaron fuera por el tope de 10. */
  historialOmitido: number;
}

export type ConstruccionEntrada =
  | { ok: true; entrada: EntradaPqrs; recorte: RecorteEntrada }
  | { ok: false; reason: "ticket_sin_texto" };

/** Lo que se usa del documento del ticket. El resto no entra: PRD §7. */
export interface TicketParaAsistir {
  subject?: unknown;
  message?: unknown;
  responseHistory?: unknown;
}

/**
 * ¿Este ticket es de este conjunto?
 *
 * Sale del callable para que la prueba negativa que pide la PRD —«0 acceso
 * cruzado entre conjuntos»— se pueda ejecutar sin levantar un emulador. Una
 * comprobación de seguridad que solo corre cuando alguien se acuerda de
 * arrancar Firestore es una comprobación que un día no corre: el banco de
 * reglas estuvo meses así.
 *
 * **Un ticket ajeno y uno inexistente devuelven lo mismo, y es deliberado.** Si
 * los mensajes se distinguieran, esto sería un detector de tickets ajenos: no
 * enseñaría el contenido, pero confirmaría cuáles existen.
 */
export function ticketPerteneceAlConjunto(ticket: unknown, tenantId: string): ticket is TicketParaAsistir {
  if (!ticket || typeof ticket !== "object") return false;
  const suyo = (ticket as { tenantId?: unknown }).tenantId;
  // Comparación estricta contra el conjunto de la sesión. Nada de repliegues
  // «si no trae tenantId, será nuestro»: un documento sin conjunto es un
  // documento que no se puede afirmar de nadie.
  return typeof suyo === "string" && suyo === tenantId;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * La variante del conjunto, con el default si falta — mismo criterio que
 * `getTenantVisitorsVariant` en `index.ts`: un dato ausente no cambia el
 * comportamiento de un conjunto que ya opera.
 *
 * **Nunca sale del cliente.** Es lo que decide la puerta dura de nulls.
 */
export function variantePqrsDe(settings: unknown): VariantePqrs {
  const mv = (settings as { moduleVariants?: { pqrs?: unknown } } | null | undefined)?.moduleVariants;
  const valor = mv?.pqrs;
  return valor === "buzon_simple" || valor === "con_sla" ? valor : VARIANTE_POR_DEFECTO;
}

export function construirEntradaPqrs(
  ticket: TicketParaAsistir,
  variante: VariantePqrs,
): ConstruccionEntrada {
  const asunto = texto(ticket.subject);
  const cuerpo = texto(ticket.message);

  // El mismo repliegue que ya hace el drawer al pintar la descripción y que hace
  // el portal del residente al crear («message.trim() || subject.trim()»). Un
  // ticket sin ninguna de las dos cosas no es asistible: no hay nada que leer.
  const mensajeCompleto = cuerpo || asunto;
  if (!mensajeCompleto) return { ok: false, reason: "ticket_sin_texto" };

  const mensaje = mensajeCompleto.slice(0, MAX_MENSAJE);

  const historialCompleto = Array.isArray(ticket.responseHistory) ? ticket.responseHistory : [];
  const entradas = historialCompleto
    .map((entrada) => texto((entrada as { message?: unknown } | null)?.message))
    .filter((t) => t.length > 0)
    .map((t) => ({
      // Fiel al producto: en `responseHistory` solo escribe la administración.
      autor: "administracion" as const,
      texto: t.slice(0, MAX_TEXTO_HISTORIAL),
    }));

  // Se quedan las MÁS RECIENTES, no las primeras, y en el orden que pide el
  // esquema: del más viejo al más nuevo. Un hilo largo tiene su información
  // reciente al final, y cortar por el principio dejaría al modelo leyendo la
  // conversación equivocada.
  const historial = entradas.slice(-MAX_ENTRADAS_HISTORIAL);

  return {
    ok: true,
    entrada: {
      ...(asunto ? { asunto: asunto.slice(0, MAX_ASUNTO) } : {}),
      mensaje,
      ...(historial.length ? { historial } : {}),
      variante,
    },
    recorte: {
      mensaje: mensajeCompleto.length > MAX_MENSAJE,
      historialOmitido: entradas.length - historial.length,
    },
  };
}
